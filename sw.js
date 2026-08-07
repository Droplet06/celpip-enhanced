/* Word Rush service worker

   两套策略：

   1. 打开页面（navigate 请求）—— **网络优先，超时 NAV_TIMEOUT 回落缓存**。
      整个 app 就是这一个 HTML。纯 stale-while-revalidate 的话，部署后第一次
      打开拿到的还是旧版，要再开一次才更新 —— 用户在外地只会以为「改动没生效」。
      网络优先让一次打开就是新版；超时回落保证弱网/离线照样秒开。

   2. 其余同源 GET（图标、manifest）—— stale-while-revalidate，
      这些几乎不变，先给缓存最快，后台顺手更新。

   关键约束：只碰同源的 GET。Supabase 的同步请求（跨域、且多为 POST）
   必须原样走网络，被缓存会造成「看起来同步了其实没上传」。 */

const CACHE = 'wordrush';
const NAV_TIMEOUT = 2500;   // 等网络的上限：再久不如先把缓存版本给用户
const SHELL = ['./', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(SHELL.map(u => c.add(u))))   // 单个资源失败不该拖垮整个安装
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;                       // 同步的 POST 一律直连
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;             // Supabase 等跨域请求不拦

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req, { ignoreSearch: true });

    const fresh = fetch(req).then(res => {
      if (res && res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    }).catch(() => null);                                 // 网络挂了当作「没结果」，不要抛出去

    const offline = () => new Response('离线，且本地没有缓存', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });

    if (req.mode === 'navigate') {                        // 打开页面：网络优先
      const timed = await Promise.race([
        fresh,
        new Promise(r => setTimeout(() => r(null), NAV_TIMEOUT)),
      ]);
      if (timed) return timed;
      e.waitUntil(fresh);                                 // 超时了也让它跑完，把新版写进缓存
      return cached || (await fresh) || offline();
    }

    e.waitUntil(fresh);                                   // 其余资源：返回缓存后让后台更新跑完
    if (cached) return cached;
    return (await fresh) || offline();
  })());
});
