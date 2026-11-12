# OpusMC

独立的浏览器体素游戏（WebGL2），不依赖 B 站 Toy 容器或账号。

## 运行

```powershell
node scripts\serve.mjs
```

然后用 Chrome / Edge 打开 `http://127.0.0.1:8080/`。

- 不要直接双击 `index.html`：`file://` 会被明确拦截，因为 Worker/资源加载需要 http(s)。
- 手机/局域网测试：`$env:HOST='0.0.0.0'; node scripts\serve.mjs`（仅开发测试，生产部署另见文档）。
- 项目文档从 [`docs/START-HERE.md`](docs/START-HERE.md) 开始。
