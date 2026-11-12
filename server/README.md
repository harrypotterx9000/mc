# OpusMC 自建服务器（Windows）

这是 OpusMC 的多人服务器：一个 Node.js 进程同时提供网页、房间服务和世界存档。
它运行在项目所有者的电脑上，不依赖 Bilibili、Toy 或任何外部游戏平台。

- 零 npm 依赖：只用 Node.js 自带模块；不需要 `npm install`。
- 不在服务器渲染画面：客户端负责 WebGL2 渲染、摄像机、UI、输入和本地表现。
- 没有账号、注册、登录或身份数据库；只有服务器签发的**临时玩家 ID**和房间邀请码。

## 1. 环境

- Windows 10/11 电脑。
- Node.js 20 或更新版本（本项目在 Node.js v26.13.0 上测试）。
- 检查：在命令提示符运行 `node --version`。

## 2. 一键启动

双击项目根目录的 `start-server.bat`，或在项目目录运行：

```powershell
node server\index.mjs
```

看到“游戏地址：http://127.0.0.1:8080/”后，用 Chrome / Edge 打开这个地址。

- 不要双击 `index.html`：`file://` 会被浏览器拦截，游戏会提示改用 http。
- 默认只绑定 `127.0.0.1`，只有本机能访问。要让同一局域网的电脑加入，见第 5 节。
- 默认端口 8080；被占用时改 `server/config.json` 的 `port`。

## 3. 正常关闭

- 双击项目根目录的 `stop-server.bat`（推荐），或在服务器窗口按 `Ctrl+C`。
- 停止脚本会请求服务器保存所有房间、写备份、删除 pid 文件并退出；失败时才提示是否强制结束进程。
- 不要直接关闭电源或强制结束进程；关机/休眠/注销时服务器会停止，多人世界在这段时间不可用。

## 4. 数据、存档与备份

所有运行期数据在 `server/data/`（已被 `.gitignore` 忽略，不会被网页服务公开）：

```
server/data/
  worlds/room-<邀请码>/world.json   每个房间的种子、出生点、方块改动、方块实体、玩家状态
  backups/room-<邀请码>/*.json      自动备份（默认保留最近 10 份）
  logs/server-YYYY-MM-DD.log        JSONL 日志（默认保留 14 天）
  admin-token.txt                   本机管理令牌（只在本机使用，不要分享）
  server.pid                        正在运行的服务器进程信息
```

- 自动保存：默认每 60 秒 + 房间关闭 + 正常关闭；写文件使用临时文件 + 原子替换。
- 备份：默认每 10 分钟最多一份（`backupEveryMinutes`），保留 `backupKeep` 份。
- 世界存档是“种子 + 改动”，不是完整地形：客户端按相同种子生成地形，再应用服务器保存的改动。
  因此**不要删除或改变游戏的世界生成版本**去打开旧房间；升级游戏后请先备份并验证。
- 恢复备份：先停止服务器，把 `backups/room-<code>/<时间>.json` 复制为
  `worlds/room-<code>/world.json`，再启动。损坏的 `world.json` 在启动时会自动尝试最新备份，
  并在日志中记录 `world_recovered_from_backup`。

## 5. 局域网联机（可选）

编辑 `server/config.json`：

```json
"host": "0.0.0.0",
"port": 8080
```

重启服务器，并让 Windows 防火墙放行该端口（专用网络）。其他电脑用本机 IP 访问，例如
`http://192.168.1.20:8080/`。所有人必须访问同一台服务器。

- 自建服务器默认同源连接；如果页面由别的静态服务器提供，可在游戏的“自建服务器房间”界面填写服务器地址，
  或在 `js/netconfig.js` 的 `server` 填地址。
- 本阶段没有 HTTPS/WSS、公网端口映射、NAT 穿透、反向代理或域名；**不要直接暴露到公网**。
  公网部署和 TLS 属于后续部署阶段。

## 6. 玩家与房间规则

- 邀请码：服务器生成 8 位，字符集去掉了易混的 `I/O/0/1`；不提供公开房间列表。
- 昵称：1–16 字符；重名由服务器追加数字（如 `Alice2`）。昵称**不是身份**，权限只看服务器会话。
- 临时玩家 ID：`p_` + 16 位十六进制，服务器签发；房间关闭/会话过期后失效。
- 断线恢复：客户端在本标签页保存会话令牌；断线或刷新后 120 秒内可恢复同一临时 ID（可在配置中调整）。
  服务端只保存令牌的 SHA-256，不保存明文。
- 房主：创建者。房主**主动离开**时房主转给最早加入的其他玩家；房间已空则保留为“无房主”，下一位加入者成为房主。
  房主短暂断线时保留房主身份，等待恢复窗口结束。
- 房主权限：移出玩家、关闭房间；普通玩家不能。房间关闭后邀请码失效，世界保存在磁盘上。
- 人数：服务器上限默认 10，单房 2–10 人（创建时选择）。
- 限流：按 IP 限制加入/创建尝试；按连接限制消息、方块、聊天、方块实体、掉落/拾取；超限拒绝或断开。
- 一个 IP 可以开多个标签页调试，但受连接上限和房间上限约束。

## 7. 安全边界

- 静态服务只提供游戏自己的 `index.html`、`js/*`、`sounds/sfx/*`、`favicon.svg`；
  `docs/`、`scripts/`、`server/`、`server/data/`、`.git`、点文件和目录列表都不提供。
- 管理接口只接受本机回环地址 + `server/data/admin-token.txt` 中的令牌；普通玩家不可达。
- WebSocket 消息有大小/结构/类型/频率校验；协议错误过多会断开连接。
- 客户端传来的房主/管理员/权限字段一律忽略；权限只由服务器会话决定。
- 服务器不信任客户端的位置和方块操作：会做距离/速度/界内/频率/合法方块 ID 检查，异常位置下发校正。
- 本阶段不实现完整反作弊，也不模拟服务端生物 AI/红石/流体；边界见
  `docs/ARCHITECTURE.md` §14 与 `docs/KNOWN_ISSUES.md` 的 phase-05 项。

## 8. 配置（server/config.json）

| 项 | 默认 | 说明 |
|---|---|---|
| `serverName` | OpusMC 自建服务器 | `/healthz` 与界面显示 |
| `host` | `127.0.0.1` | 局域网改为 `0.0.0.0` |
| `port` | `8080` | 网页、WebSocket、管理接口共用 |
| `dataDir` | `server/data` | 世界/备份/日志；不要放进可公开的目录 |
| `staticRoot` | `.` | 游戏静态文件根 |
| `maxRooms` | 8 | 同时打开的房间上限 |
| `maxPlayersPerRoom` | 10 | 单房上限（2–16） |
| `maxConnections` | 64 | 同时 WebSocket 连接上限 |
| `inviteCodeLength` | 8 | 邀请码长度（6–12） |
| `joinPerMinute` / `joinBurst` | 5 / 3 | 按 IP 的加入尝试限流 |
| `createPerMinute` / `createBurst` | 4 / 2 | 按 IP 的创建尝试限流 |
| `autosaveSeconds` | 60 | 自动保存间隔 |
| `backupEveryMinutes` | 10 | 备份间隔 |
| `backupKeep` | 10 | 每房保留备份数 |
| `resumeSeconds` | 120 | 断线恢复窗口 |
| `snapshotHz` | 10 | 玩家/物品快照频率（2–20） |
| `maxBlocksPerRoom` | 100000 | 每房方块改动上限 |
| `maxBlockEntitiesPerRoom` | 5000 | 每房方块实体上限 |
| `maxItemsPerRoom` | 200 | 每房掉落物上限 |
| `logRetentionDays` | 14 | 日志保留天数 |
| `adminLocalhostOnly` | true | 管理接口只允许本机 |
| `allowedOrigins` | `[]` | 额外允许的浏览器 Origin（一般不用） |

配置文件的 UTF-8 BOM 会被容忍；修改后重启服务器生效。

## 9. 运行状态与排查

- 浏览器或命令行访问 `http://127.0.0.1:8080/healthz` 查看运行状态。
- `server\status.ps1` 查看状态和房间（可加 `-Config <配置文件>`）。
- 日志在 `server/data/logs/`，常见事件：`server_start`、`room_created`、`room_joined`、`world_saved`、
  `owner_transferred`、`world_recovered_from_backup`、`shutdown_done`。
- 端口占用：修改 `port`，或先停止占用端口的程序。
- 提示“服务器已经在运行”：先运行 `stop-server.bat`，或检查 `server/data/server.pid` 是否指向已退出的进程。
- 客户端提示“连不上游戏服务器”：确认服务器窗口还在、地址和端口正确、页面是用该服务器打开的。
- 电脑休眠/关机/注销后服务器不可用；没有后台常驻或开机自启。

## 10. 不在本阶段范围

账号/登录、HTTPS/WSS、公网/NAT、反向代理、PWA/离线、服务器端生物 AI、完整红石/流体/战斗权威、
真实设备性能、跨版本存档迁移。阶段边界以 `docs/PROJECT_SPEC.md` 与 `docs/phases/phase-05-server/` 为准。
