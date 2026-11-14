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
- 默认只绑定 `127.0.0.1`；局域网和外网说明见下面的“局域网”和“外网”两节。
- 电脑关机、休眠或注销时服务器停止，多人世界在这段时间不可用。

### 局域网（手机 + 电脑，同一 Wi-Fi）

```powershell
# 双击 start-lan.bat，或在项目目录运行：
node server\index.mjs --lan
```

启动后会打印：

```
游戏地址（局域网）：http://<电脑局域网IP>:8080/
仅本机访问（服务器电脑）：http://127.0.0.1:8080/
```

**所有设备（包括这台电脑）都打开同一个“游戏地址（局域网）”**，再进入“多人游戏 → 自建服务器房间”
创建/加入。`127.0.0.1` 只用于服务器电脑本机，不要用它生成/分享邀请链接。
首次需要允许 Windows 防火墙的专用网络。完整步骤、防火墙脚本和排查见
[`docs/deployment/LAN.md`](docs/deployment/LAN.md)。

### 外网（HTTPS/WSS）

- **Cloudflare Tunnel 是本阶段正式支持并通过实测的公网部署路径**（不需要公网 IPv4、不需要端口转发）。
- 有公网 IPv4 + 域名时也保留了 [`deploy/Caddyfile`](deploy/Caddyfile)，但它是**备用模板**：
  尚未完成实际运行验证，**不属于本阶段正式验收通过的部署路径**。
- 管理接口和 `server/data/` 不会暴露到公网；**不要把 8080 直接端口转发到公网**。
- 完整方案、NAT/CGNAT 限制与实测边界见 [`docs/deployment/REMOTE.md`](docs/deployment/REMOTE.md)。
  本阶段没有配置任何端口转发；Caddy 公网入站未实测，不得写成已通过。

### 单人（静态页面）

```powershell
node scripts\serve.mjs
```

再用浏览器打开 `http://127.0.0.1:8080/`。这条路径没有 WebSocket/房间，单人世界仍保存在浏览器 IndexedDB。

- 不要直接双击 `index.html`：`file://` 会被明确拦截，因为 Worker/资源加载需要 http(s)。
- 端口占用：`$env:PORT=8081; node scripts\serve.mjs`。
- 项目文档从 [`docs/START-HERE.md`](docs/START-HERE.md) 开始。

## 性能与画质

- 视频设置 → **测试性能并推荐画质…**：在实时画面上测量帧时间和显卡完成时间，给出低/中/高/极高/自定义建议；
  不会自动改设置，Esc 可取消并恢复。
- 低/中画质会限制远距离实体、地面阴影和瞬态粒子，并自动降低分辨率（手机最低 40%、桌面 50%）；
  高/极高保留完整渲染距离和光影档。可手动关闭动态分辨率。
- 手机上 `renderDist`/阴影/显存页有单独预算；桌面优先 60 FPS，手机优先 30 FPS、中高性能争取 60。
- 服务器 `/healthz` 只显示房间/玩家；TPS/tick/CPU/RSS 在管理员状态或 `server\status.ps1` 中查看。
- 真实手机/显示器、真实 LAN 性能仍需实测；headless/视口模拟数据不代表真机（见
  [`docs/testing/performance-baseline.md`](docs/testing/performance-baseline.md)）。

## 存档

两种世界分开保存，互不覆盖：
- **单人世界**：只保存在当前浏览器的 IndexedDB `mc-js-clone`；创建、加载、保存、删除、刷新恢复都不需要
  服务器或账号。
- **服务器多人世界**：只保存在服务器电脑的 `server/data/worlds/room-<邀请码>/world.json`；由服务器定时保存、
  正常关闭保存、备份，并在损坏时回退备份。浏览器不会把它写进单人存档，单人世界也不会写进服务器目录。
- 同名世界/房间不会互相覆盖；断线、刷新页面或离开房间都不会删除服务器世界。
- 旧云存档残留（`cloud` 字段、`mcjs-cloud-dirty-*` 等）不再读取，也不会自动删除；旧本地世界仍可读取。
- 备份/恢复与目录说明见 [`server/README.md`](server/README.md)。
