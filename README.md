# Word Rush · CELPIP 词汇冲刺

单文件 CELPIP 练习应用（词汇 / 阅读 / 写作），部署在 GitHub Pages。

**这是构建产物仓库，不要直接在这里改 `index.html`。**

## 来源

源码在本地 `思培练习/celpip-v2/`：

- `app.template.html` — 应用模板（改这个）
- `build.mjs` — 把 `web-app/data/*.json` 内联进模板，产出 `WordRush.html` 和 `dist/index.html`

更新流程：

```bash
node celpip-v2/build.mjs
```

然后在 `dist/` 里提交推送，GitHub Actions 自动部署。

## 当前状态

- Phase 0 — 部署上线，进度存 localStorage，**设备间不同步**
- Phase 1 — 接 Supabase，双设备进度互通（未开始）
