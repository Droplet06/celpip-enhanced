# Word Rush · CELPIP 词汇冲刺

单文件 CELPIP 练习应用（词汇 / 阅读 / 写作），进度跨设备同步。

**线上：** https://celpip-enhanced.pages.dev

> ⚠️ **这是构建产物仓库，不要直接改这里的 `index.html`。**
> 改了会在下次构建时被覆盖。源码在本地 `思培练习/celpip-v2/`。

---

## 怎么改

源码文件：

| 文件 | 作用 |
|---|---|
| `celpip-v2/app.template.html` | 应用本体（UI、游戏逻辑、同步层）—— **改这个** |
| `celpip-v2/build.mjs` | 把词库和配置内联进模板，产出成品 |
| `celpip-v2/supabase.config.json` | Supabase 地址和 anon key，构建时注入 |
| `celpip-v2/assets/` | PWA 图标 / manifest / service worker |
| `celpip-v2/tools/make-icons.py` | 重新生成图标（改配色时才需要跑） |
| `web-app/data/*.json` | 词库、阅读、写作题库（**唯一真源**） |

改完后：

```bash
node celpip-v2/build.mjs
cd celpip-v2/dist
git add -A && git commit -m "..." && git push
```

推送后 Cloudflare Pages 自动部署，约 1 分钟生效。

---

## 部署

**Cloudflare Pages**，接 GitHub 仓库 `Droplet06/celpip-enhanced` 自动构建：

- Production branch: `main`
- Framework preset: None
- Build command: **留空**（`dist/` 里已是成品，不需要构建）
- Build output directory: `/`

> 历史说明：最早用的是 GitHub Pages + Actions，后来 `github-pages` 环境的部署保护规则
> 会让 deploy 步骤干等 15 分钟后超时，排查成本过高，遂整体迁到 Cloudflare。
> 这个仓库里已经没有任何 GitHub Actions workflow。

---

## 后端（Supabase）

项目 `rjreewvuelxctriwxpar`，表结构见源码侧 `celpip-v2/supabase/schema.sql`。

- **`wordrush_state`** —— 一行一个用户，整个进度存成一个 `jsonb`。
  单用户场景不需要拆表，进度 blob 只有几 KB。
- **`keepalive`** —— 专供定时任务戳的表，见下方。
- RLS 只允许登录用户读写自己那行。anon key 公开在前端是设计如此，**RLS 才是防线**。

登录用邮箱 + 密码（后台已关掉邮件验证）。不用 magic link 是因为在外面不一定方便收邮件，
也因此不需要维护 OAuth redirect 白名单 —— 换域名时零配置改动。

### 同步策略

**字段级合并，不是 last-write-wins。** 关键点：一台旧设备绝不能覆盖另一台上刚练完的进度。

状态几乎全是单调增长的，所以逐字段取「更靠前」的一方，并且合并是**幂等**的
（同一份数据重复同步不会让计数翻倍）。几个容易写错的地方：

- 出词/出题顺序数组一旦生成就**锁定**，两边不一致会让整个出题顺序错乱
- 连击取 `lastGoalDay` 更晚的一方，**不能取 max** —— 否则断掉的连击会被复活
- 跨天时 `dailyDone` 不能串着累加

---

## ⚠️ 保活（重要）

**免费版 Supabase 连续 7 天无 API 活动会暂停项目，暂停约 90 天后项目被删除。**
上一个 CELPIP 项目就是这么消失的，连带云端进度全没。

现在由 **cron-job.org** 每 3 天 GET 一次（独立于 GitHub，已实测 200）：

```
https://rjreewvuelxctriwxpar.supabase.co/rest/v1/keepalive?select=id
Header: apikey: <anon key>
```

**保活的真正风险是「悄无声息地停了」**，所以 cron-job.org 上要开着失败通知邮件。
如果长期不用，回来第一件事是确认 Supabase 项目还在、没被暂停。

---

## 本地进度与域名的关系

localStorage 按域名隔离。换域名后本地看起来是空存档，**但云端进度不会丢** ——
用同一账号登录一次就会合并回来。这也是当初优先做同步层的原因。
