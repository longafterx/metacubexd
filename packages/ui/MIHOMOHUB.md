# MihomoHub 接入

`MIHOMOHUB_BUILD=true pnpm build:ui` 构建 Hub 专用静态 UI；普通构建保持原版 XD Endpoint 与浏览器历史行为。

- 实例配置来自 `/api/v1/instances`；Endpoint 仅包含同源 `/mihomo/{id}` 和空 Secret。
- 历史来自服务端 SQLite，独立维度 TOP 不支持跨维度钻取。连接摘要为生命周期流量，不能作为窗口流量相加。
- 时间窗口转换为 UTC 完整时间桶，缺少观测显示为空白。切换范围取消旧请求并通过代次防止迟到回填。
- 旧 localStorage Endpoint 可显式保留或清除，不静默上传；旧 IndexedDB 历史不导入，Hub 不再写浏览器流量历史。
- Hub 不提供 Agent、远程内核管理或配置文件写入。运行时控制沿用 Go Gateway 的权限策略。
- Hub 关闭 PWA；Ubuntu Latin 300/400/500/700 字体来自 `@fontsource/ubuntu@5.2.8`，遵守随文件提供的 Ubuntu Font Licence。其他字符沿用系统字体回退。

验证：`pnpm --filter @metacubexd/ui test:unit`、`pnpm --filter @metacubexd/ui typecheck`；后端 `scripts/smoke-hub.mjs` 验证真实页面与 Fake Mihomo。更新上游时，优先检查 Endpoint Store、查询缓存 key、四条 WebSocket、Agent capability probe 及普通构建行为。
