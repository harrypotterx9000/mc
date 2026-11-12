# OpusMC

独立的浏览器体素游戏（WebGL2），不依赖 B 站 Toy 容器或账号。支持单人和自建服务器多人。

## 运行

### 多人 + 页面（自建服务器，推荐）

```powershell
# 双击 start-server.bat，或在项目目录运行：
node server\index.mjs
```

然后用 Chrome / Edge 打开 `http://127.0.0.1:8080/`，进入“多人游戏 → 自建服务器房间”。

- 正常关闭：`stop-server.bat` 或服务器窗口 `Ctrl+C`。
- 本阶段服务器只默认绑定 `127.0.0.1`；局域网/公网/TLS 说明见 [`server/README.md`](server/README.md)。
- 电脑关机、休眠或注销时服务器停止，多人世界在这段时间不可用。

### 单人（静态页面）

```powershell
node scripts\serve.mjs
```

再用浏览器打开 `http://127.0.0.1:8080/`。这条路径没有 WebSocket/房间，单人世界仍保存在浏览器 IndexedDB。

- 不要直接双击 `index.html`：`file://` 会被明确拦截，因为 Worker/资源加载需要 http(s)。
- 端口占用：`$env:PORT=8081; node scripts\serve.mjs`。
- 项目文档从 [`docs/START-HERE.md`](docs/START-HERE.md) 开始。
