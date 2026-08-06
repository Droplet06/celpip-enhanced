/* Word Rush service worker —— stale-while-revalidate

   整个 app 就是一个 HTML 文件，所以缓存策略很简单：
   命中缓存立刻返回（离线、弱网都能秒开），同时后台悄悄拉新版本，
   下次打开就是新的。不用版本号做缓存失效 —— 每次成功的网络请求
   都会顺手覆盖缓存。

   关键约束：只碰同源的 GET。Supabase 的同步请求（跨域、且多为 POST）
   必须原样走网络，被缓存会造成「看起来同步了其实没上传」。 */

const CACHE = 'wordrush';
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
    }).catch(() => null);

    e.waitUntil(fresh);                                   // 返回缓存后仍要让后台更新跑完
    if (cached) return cached;

    const res = await fresh;
    return res || new Response('离线，且本地没有缓存', {
      status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  })());
});
