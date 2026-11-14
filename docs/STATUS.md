# 项目状态（STATUS）

- 更新时间：2026-11-14
- 当前阶段：**phase-08 网络部署 — 验收结束；已提交并推送 `origin/opusmc-integration`**
- 下一阶段：**phase-09 验收**（未开始；不自动进入）
- 代码版本：phase-08 代码 `ef8c540`；docs `d8b237a`/`597a15f`；已推送（远程 tip `597a15f`；推送记录为当前 HEAD）
- 当前分支：`develop`（未新建/切换/重置分支）

## Git

| 项 | 值 |
|---|---|
| 仓库 | `D:\ds\REA\opusmc` |
| 当前分支 | `develop`（跟踪 `origin/opusmc-integration`） |
| HEAD | 推送记录为当前 HEAD（`docs: record phase-08 push`）；phase-08 内容 tip `597a15f`；代码 `ef8c540` |
| phase-08 | **验收结束（真实设备用户实测）；代码 `ef8c540`；docs `d8b237a`/`597a15f`；已推送 `origin/opusmc-integration`** |
| phase-07 | **验收结束（2026-11-13）；代码 `508fcc8`；docs `a2bdb0e`；已推送** |
| 工作区 | phase-08 代码/文档已提交并推送；工作区干净（除 1 个与本阶段无关的未跟踪文件 `REAopusmc<U+F022>`）；无 stash |
| 远程 | phase-07/08 已推送 `origin/opusmc-integration`；未合并、未强推；PR #1 未合并 |
| 历史代码 | phase-06 `b4833b8`；phase-05 `817bad3`；phase-04 `553ceed`；phase-03 `025cba8`；phase-02 `a9dc47b`；phase-01 `15154bd`；基线 `2798c08` |

> `D:\Projects\OpusMC` 仍是 phase-01 副本；phase-02/03/04/05/06/07/08 只在 `D:\ds\REA\opusmc`。如以那份为准，
> 需用户确认后单独同步，禁止直接覆盖。

## 整体状态

- **阶段**：phase-00/01/02/03/04/05/06 完成并验收；phase-07 验收结束；**phase-08 验收结束（真实设备用户实测）；代码 `ef8c540`；已推送 `origin/opusmc-integration`**。
- **运行方式（本机多人）**：双击 `start-server.bat` 或 `node server\index.mjs` → 浏览器打开
  `http://127.0.0.1:8080/` → 多人游戏 → 自建服务器房间。
- **运行方式（局域网）**：双击 `start-lan.bat`（或 `node server\index.mjs --lan`）→ 所有设备
  （包括电脑）打开打印的 **`游戏地址（局域网）`**；`127.0.0.1` 仅本机；防火墙放行专用网络。
- **运行方式（公网）**：**Cloudflare Tunnel 是本阶段正式支持/验收的公网路径**（无需公网 IP/端口转发）；
  Caddy + 公网 IPv4/域名保留为**备用模板**，未运行验证，不属于正式验收路径。
  详见 `docs/deployment/REMOTE.md`。本阶段未配置端口转发。
- **运行方式（单人）**：`node scripts\serve.mjs` 或同一个自建服务器页面；单人仍用 IndexedDB `mc-js-clone`。
- **身份**：无账号；昵称 + 服务器临时 ID（`p_` + 16 hex）+ 会话令牌（120 秒恢复窗口）；昵称不是身份。
- **外观**：`mcjs-look` 本设备保存；服务器只广播外观给同房间玩家。
- **多人**：自建服务器（本机/局域网/经隧道或反代）；旧房间服务/`NetClient`/`p2p` 保留为遗留路径。
- **双存档**：单人世界只写浏览器 `mc-js-clone`；服务器世界只写 `server/data/worlds/room-<code>/`；
  `srv~<邀请码>` 不进入 IndexedDB；同名不覆盖；断线/刷新不删除服务器世界。
- **代码规模**：`index.html` **87** 个脚本；`js/` **91** 个 `.js` + `emoji.webp`（未新增脚本/文件）；
  服务端 **10** 个 `.mjs`（phase-08 新增 `netutil.mjs`）+ `config.json` + 2 个 `.ps1` + `README.md`；
  根目录新增 `start-lan.bat`，新增 `deploy/` 配置。
- **实现测试（phase-07）**：桌面固定场景首轮 8 项 60 FPS（headless + 真实 ANGLE/AMD 核显）；重复测试光影 3/4
  为 59.8/57.1 FPS（边际波动，未稳定 60）；手机 3120×1440
  视口模拟 30 s 稳定 60 FPS（基线 44.8）；SwiftShader + 8× CPU 限速 K-39 基线 3 次/46 s → 修复 0 次/约 9 s；
  服务器 2/5/10/30 连接 19.97–20.00 TPS；phase-05 62/62 + 18/18 + 6/6、phase-06 22/22 + 31/31、
  91 JS + 9 mjs `node --check` 全部 PASS。
- **实现测试（phase-08）**：LAN 协议 22/22 + 双浏览器 15/15 + 邀请链接一致性 8/8；Cloudflare Tunnel
  公网 HTTPS/WSS 协议 22/22 + 浏览器 15/15（前两次 quick tunnel 资产流超时，第三次通过）；
  check-host.net 外部节点 5/6 200（1 个超时）；公网管理接口（含令牌）403；
  phase-05/06 回归全部 PASS；91 JS + 10 mjs `node --check` PASS。
- **验收**：phase-07 **验收结束（2026-11-13）**；phase-08 **验收结束（真实设备用户实测）；代码 `ef8c540`；
  docs `d8b237a`/`597a15f`；已推送 `origin/opusmc-integration`**。Caddy 公网路径为备用模板，
  未运行验证，不属于正式验收路径。

## phase-08 已实现内容（验收结束；代码 `ef8c540`；已推送）

### 任务 1：局域网部署（模式 A）

- 新增 `node server\index.mjs --lan` 与 `start-lan.bat`：绑定 `0.0.0.0`；**主地址优先选择有效私有 IPv4**，
  回环地址单独标为“仅本机访问”；默认 `start-server.bat` 仍只绑定 `127.0.0.1`。
- 所有设备（包括服务器电脑）使用同一个 **`游戏地址（局域网）`**；客户端同源 `ws://`；
  邀请链接跟随页面地址，修复后专项 8/8 覆盖多次建房、刷新/恢复和多个邀请码。
- 新增 `deploy/windows/firewall-lan.ps1`：管理员、默认只放行专用网络、`-Remove`、`-IncludePublic`。
- 新增 `docs/deployment/LAN.md`：IP/启动/防火墙/同地址/建房加入/验证/排查/安全/关闭。
- 实测：LAN 启动输出主地址为 LAN、127 标为本机；LAN 地址 HTTP/WS、建房/加入、同 seed、
  方块/聊天/玩家同步；LAN 管理接口 403、回环+令牌 200；`/server/data`、`/docs`、`/scripts`、`/.git`
  不可访问；两个独立 Chrome profile 15/15。
- **真实手机 LAN 实测通过（用户报告 2026-11-14）**：手机单人游戏、移动、转视角、放置、破坏、刷新重进；
  第二台手机作为客户端加入 LAN 房间。服务器日志显示 `E7UDCMQT` 房间从 LAN 私有地址
  `192.168.1.9` 加入（电脑侧 `192.168.1.18`），2 名玩家。

### 任务 2：外网 HTTPS/WSS（模式 B）

- 新增 `server/netutil.mjs`：代理感知的 `cleanIp`/`isLoopback`/`forwardedIp`/`clientIp`；
  只有直连是本机回环时才信任转发头。
- `server/http.mjs`：管理接口要求“直连回环 + 转发地址回环”，代理/隧道后的远程管理请求 403。
- `server/ws.mjs`：`conn.ip` 使用真实客户端 IP，代理后限流/日志不再全挤在 `127.0.0.1`。
- **Cloudflare Tunnel 是本阶段正式支持/验收的公网路径**；`deploy/cloudflared/config.yml.example`
  为命名隧道模板；`docs/deployment/REMOTE.md` 含验收范围、NAT/CGNAT、安全、排查、回滚。
- `deploy/Caddyfile` 保留为**备用模板**：未实际运行验证，不属于正式验收路径；
  不得写成 Caddy 公网已通过。
- 实测（修复后）：Cloudflare quick tunnel 公网 HTTPS 页面/`/healthz` 200；`wss://` 协议 22/22、
  浏览器 15/15（前两次 quick tunnel 资产流超时，第三次通过）；公网管理接口无令牌/带令牌均 403；
  `server/data` 等 404；check-host.net 外部节点 5/6 200（1 个超时）。
- **真实手机蜂窝公网实测通过（用户报告 2026-11-14）**：关闭 Wi-Fi 后经 Cloudflare HTTPS 进入世界、
  渲染、移动、转视角、放置、破坏、刷新重进。服务器日志显示 `XF6BT4YQ` 房间有蜂窝 IPv6 客户端加入，
  与电脑侧公网出口客户端组成 2 名玩家。用户说明“PIN 验证”指 Cloudflare quick tunnel 临时地址的
  **邮箱验证**；该验证属于 Cloudflare 外部流程，不是 OpusMC 的 PIN/账号功能。
- **未做/未测**：Caddy + 公网 IPv4/域名、路由器端口转发（未配置、未实测）；公网长期稳定性/10 人并发；
  手机型号/OS/浏览器版本/截图录屏未提供（用户明确不提交）。

### 任务 3：回归与边界

- phase-05 服务端 62/62、双浏览器 18/18、单人 6/6；phase-06 服务端 22/22、浏览器 31/31（修复后复跑）。
- `start-lan.bat` 包装启动/`stop.ps1` 正常关闭/`status.ps1` 状态查询均实测；默认本机模式行为未变。
- 新增已知边界 K-95…K-100；Caddy 备用模板、长期/10 人和未测项均如实标注。

## phase-07 已实现内容（验收结束；代码 `508fcc8`；已推送）

### 任务 1：测试基线

- 固定 Chrome profile、固定 `phase07 normal` / `phase07 building` 世界、固定相机与实体；桌面用 headless Chrome 157
  + 真实 ANGLE/D3D11（AMD 核显），另设 SwiftShader + CPU 限速的 K-39 条件。
- 记录 FPS、平均/p50/p95/p99/最慢帧、JS 堆、GPU timer、draw call、buffer 上传、区块生成/装饰/完成/网格耗时、
  MP ping RTT/流量、服务器 TPS/tick/CPU/RSS。完整表见 `docs/testing/performance-baseline.md`。

### 任务 2：电脑端

- 普通地形、48×48 建筑、240 实体、80 僵尸战斗、光影 1–4：本机固定场景均 60 FPS（`maxFps=60`）。
- 保留渲染距离 2–16、五档光影、自定义；视频设置新增“测试性能并推荐画质…”，按实时测量推荐/应用；
  Esc 可取消并恢复原设置；每个世界 12 s 后给一次不强制修改的实测建议。
- 方块编辑的 `flushMesh()` 按帧预算分批；编辑压力测试 p99 25.0→20.8 ms、最慢 29.2→20.9 ms。

### 任务 3：手机端

- 手机区块主线程预算 8 ms；动态分辨率下限 40%、首次降 20%，按平均帧/迟到比例归因，默认 60 目标；
  手机顶点 arena 4 MB；低/中档限制实体距离/地面阴影/粒子。
- 3120×1440 视口模拟（桌面 GPU，不是真机）：基线 30 s 后 44.8 FPS，优化 60.0 FPS；动态分辨率 0.9→0.5。
- 真实手机、发热、电池、触控手感仍 **NOT TESTED**。

### 任务 4：画质分级

- 低/中/高/极高/自定义保留；单项修改仍切自定义；低档自动关光影、低/中档有实体/阴影/粒子预算。
- 画质推荐依据实测帧时间/GPU 完成时间，不只看设备型号；不自动覆盖玩家设置。

### 任务 5：服务器性能

- 发现并修复 Windows 50 ms `setInterval` 实际约 16.1 TPS 的调度问题：10 ms 唤醒 + 50 ms 到期补 tick。
- 本机机器人 2/5/10/30 连接（10/30 人含方块编辑）：19.97–20.00 TPS，tick 平均 0.12–0.39 ms，CPU 0.4–2.7%，
  RSS 63–67 MB；广播一次编码多连接复用。
- 管理接口增加 `perf`；公开 `/healthz`/`/api/status` 隐藏 CPU/内存/tick。真实 LAN/公网/TLS 未测。

### 任务 6：K-39

- `chunkWatchdog()` 不再“同一 7×7 缺失 8 s”就重请求；有归属/有进展/存档读取/管线忙时等待。
- SwiftShader + CPU 8× 限速：基线刷新 46.6/46.9 s + 3 次 `chunk stall`；修复后 8.8/8.7 s + 0 次。

## phase-06 已实现内容（已验收；代码 `b4833b8`；docs 收尾为当前 HEAD）

### 任务 1：本地存档

- 保留 `js/save.js` 的 IndexedDB `mc-js-clone`（`worlds` / `chunks`）与 localStorage/内存回退；
  未改数据库名、对象仓库、keyPath、区块编码。
- 创建、加载、保存、删除、世界列表、刷新恢复均有浏览器实测（31/31 中覆盖）。
- 本地存档不依赖服务器登录/房间：单人回归在无 WebSocket 的静态服务器下通过（创建/编辑/保存/刷新恢复）。
- 新增 `DB.newWorldId()`：世界 ID 加随机后缀并检查已存在，避免同毫秒/同名覆盖。
- 删除一个同名世界不影响另一个；被删世界的区块键清空。

### 任务 2：服务器存档

- 继续使用 `server/data/worlds/room-<code>/world.json`、原子写、按房串行保存、定时保存、
  正常关闭保存、备份轮换/保留。
- 新增：`world.json` **能解析但结构无效**也回退最新备份；恢复后原子写回；`dir` 与目录名不一致
  时拒绝加载（不跨房）。
- 异常退出（`SIGKILL`）后重启，恢复最近一次定时保存；最多丢失 `autosaveSeconds` 内改动。
- 每房独立目录/邀请码；同名房间不互相覆盖。

### 任务 3：避免存档冲突

- 客户端 `srv~<邀请码>` 世界由 `js/mp.js` 重定向到服务器；`js/save.js` 增加第二层防线：
  `srv~` 不进本地读/写/删/列表，泄漏记录只隐藏不删除。
- `Game.saveWorld/quitToTitle/captureIcon` 对 `srv~` 世界跳过本地保存。
- 玩家断线/刷新/离开都不删除服务器世界；刷新后可凭 `sessionStorage` 会话令牌恢复。
- 本地世界与服务器世界同名时各自独立；单人列表不显示服务器世界，服务器数据目录不含本地世界。
- 界面明确区分：单人列表“仅保存在此浏览器”，多人入口/创建/离开房间提示服务器存档。

### 任务 4：旧存档保护

- 修改前用旧代码创建真实旧存档样本（两个同名世界，`gen=1` 超平坦 + `gen=2`，旧 `cloud` 字段，
  旧 `mcjs-cloud-dirty-*`/`mcjs-account` 键）；修改后同一 origin 复验可读、可继续保存。
- 不删除、不迁移旧云存档残留；旧服务不可用无法安全迁移，保留原样。
- 旧 `gen=1`/`gen=2` 本地世界无需迁移即可读取。

## phase-05 已实现内容

### 任务 1：服务端架构

- 零 npm 依赖 Node 服务端：`server/index.mjs`、`config.mjs`、`log.mjs`、`storage.mjs`、`blockids.mjs`、
  `ws.mjs`、`protocol.mjs`、`rooms.mjs`、`http.mjs`。
- 自写 RFC 6455 WebSocket；一个进程同时提供静态页面、房间、WS、状态接口、存档。
- 网页静态资源服务、房间服务、WebSocket、临时玩家 ID、邀请码、多人世界、状态同步、服务端存档、
  备份、`/healthz`/`status.ps1`、JSONL 日志、pid、正常关闭。
- 未添加账号/注册/登录/身份数据库。

### 任务 2：客户端/服务端分工

- 客户端：WebGL2 渲染、摄像机、UI、输入、本地画面/动画、地形确定性生成、生物/红石/流体/战斗本地模拟、
  合理本地预测。
- 服务器：临时身份、房间、邀请码、世界状态（seed + 方块覆盖层 + 方块实体）、游戏时间、玩家/物品同步、
  玩家交互校验、世界存档、网络连接、关键规则的**基本**权威校验。
- 服务器不渲染画面，不把 DOM/Canvas/Renderer/UI 搬进服务器。

### 任务 3：协议

- 优先复用 `p2p.js` 的词汇（`welcome/state/pstate/b/be/E/env/chat/give/drop/pickup`）与方块记录思路；
  传输改为自建 WebSocket，身份/权限/校验/存档由服务器实现。
- `NetClient` 保留为“直连原版 Java 代理”的遗留功能；没有因为已有 `net.js` 就假定服务器已实现。

### 任务 4：多人房间

- 创建、服务器生成 8 位邀请码（去易混字符）、加入、退出、玩家列表、房间信息、关闭、人数上限（2–10）。
- 房主权限：踢人/关闭；普通玩家不可；权限只由服务器会话决定；忽略客户端权限字段。
- 房主短暂断线保留房主；主动离开/被移出/恢复过期时转移；空房保留“无房主”，下一位加入者成为房主。
- 加入/创建按 IP 限流；不提供公开房间列表。

### 任务 5：多人同步

- 玩家位置/视角/状态/外观：10 Hz `state` + 快照；`pstate` 每 10 秒保存。
- 方块变化：玩家动作窗口 + 服务器校验 + 广播 + 覆盖层存档；加入时完整增量。
- 方块实体：服务器最后写入胜出；客户端对已加载方块实体做差异上报（排除 `open/lid/viewers`），
  初始化/晚加入与增量都同步；大小/数量限制。
- 掉落物：服务器实体、拾取距离/延迟/上限。
- 世界时间：服务器 20 TPS 时钟，40 tick 广播；空房暂停。
- 进入/离开/断线恢复：`players/join/leave`；120 秒 `resume`。
- 状态快照 + 增量：`welcome/blocks/blockEntities/items/ready` + `E/b/be/env`。
- **不每帧发完整世界**；**生物不同步**（本阶段边界）。

### 任务 6：服务端权威

- 校验房间成员、权限、方块坐标/ID/meta/Y 界/距离/频率、移动速度/界内、协议结构、掉落/拾取、
  方块实体/聊天/名称。
- 超速移动 `correct`；超距方块 `reject` 且不广播；非房主不能踢/关房；被踢者令牌失效。
- 不要求复杂反作弊；边界见 ARCHITECTURE §14.3、KNOWN_ISSUES K-67…K-80。

### 任务 7：服务器安全

- `server/data` 不在静态白名单；`docs/`、`scripts/`、`server/`、`.git`、点文件、目录、穿越均拒绝。
- 管理接口仅本机回环 + 管理令牌；普通玩家不可达；令牌不写日志；LAN IP 访问管理接口已实测 403。
- 输入/WS 消息结构/大小/频率校验；邀请码限流；异常连接断开；客户端权限标识不可信。

### 任务 8：启动和管理

- 根目录 `start-server.bat` / `stop-server.bat`；`server/config.json`；`server/stop.ps1`/`status.ps1`。
- 数据目录 `server/data/`（worlds/backups/logs/admin-token/pid）；自动保存（默认 60 秒 + 关闭 + 正常关闭）。
- 备份（默认每 10 分钟、保留 10 份）；损坏 `world.json` 启动时回退最新备份。
- `/healthz`、`/api/status`、`status.ps1`；日志按日保留 14 天。
- 正常关闭：管理接口/`stop-server.bat`/`Ctrl+C`；pid 清理。
- 电脑关机/休眠/注销时服务器不可用；部署说明在 `server/README.md`。

## 已验证（phase-08）

| 测试 | 结果 |
|---|---|
| LAN 启动输出 | 主地址为 `http://192.168.1.18:18110/`；`127.0.0.1` 单独标为“仅本机访问”；默认本机模式仍只显示 `127.0.0.1` |
| LAN 邀请链接一致性（多次建房/加入/刷新恢复/多邀请码） | **8/8 PASS**；刷新/恢复后仍为 LAN 地址 |
| LAN 协议（LAN 地址 HTTP/WS/建房/加入/同 seed/方块） | **22/22 PASS** |
| LAN 浏览器 E2E（两个独立 Chrome profile） | **15/15 PASS**；同地址、同 seed、方块/聊天/玩家同步 |
| 公网 Cloudflare Tunnel HTTPS/WSS 协议 | **22/22 PASS**（修复后复测） |
| 公网浏览器 E2E（HTTPS/WSS） | **15/15 PASS**；`wss://`、无 mixed-content；前两次 quick tunnel 资产流超时，第三次通过 |
| 公网管理接口（无令牌/带令牌） | **403 / 403**；回环+令牌 200 |
| 公网静态边界（`server/data`、`docs`、`scripts`、`.git`） | **404** |
| check-host.net 外部节点 | 修复后 **5/6 节点 200**（1 个超时）；此前 6/6 节点 200 |
| `start-lan.bat` / `stop.ps1` / `status.ps1` | PASS |
| 防火墙脚本非管理员 | 拒绝并 exit 1（未改系统）；**实际规则添加/删除仍 BLOCKED（非管理员）**；但手机 LAN 实测已通过（系统已有 node.exe Public 入站规则） |
| **真实手机 LAN（用户报告）** | **PASS**：单人游戏、移动、转视角、放置、破坏、刷新重进；手机作为第二客户端加入 LAN 房间（服务器日志 `E7UDCMQT`，LAN 私有地址客户端） |
| **真实手机公网蜂窝（用户报告）** | **PASS**：关闭 Wi-Fi 经 Cloudflare HTTPS 进入世界、渲染、移动、转视角、放置、破坏、刷新重进；服务器日志 `XF6BT4YQ` 有蜂窝 IPv6 客户端加入 |
| 第二台物理手机/电脑 | **PASS（用户报告 + 服务器日志）**；用户未提供型号/OS/浏览器/截图/录屏 |
| Caddy + 公网 IPv4/域名 | **BLOCKED / NOT TESTED**；备用模板，不属于正式验收路径 |
| phase-05 服务端/双浏览器/单人 | **62/62、18/18、6/6 PASS**（修复后复跑） |
| phase-06 服务端/浏览器 | **22/22、31/31 PASS**（修复后复跑） |
| 静态 | 91 JS + 10 server mjs + 1 scripts mjs `node --check`；87 页面脚本；`git diff --check` PASS |

证据：`D:\ds\REA\_work\phase08-fix-*`、`_work/phase08-real-device-evidence.txt`、`server/data/logs/`
（房间 E7UDCMQT / XF6BT4YQ）；详细：`docs/phases/phase-08-deployment/TEST_REPORT.md`。

## 已验证（phase-07）

| 测试 | 结果 |
|---|---|
| 桌面固定场景（普通/建筑/240 实体/战斗/光影 1–4） | 首轮 **8/8 场景 60 FPS**；重复测试光影 3/4 **59.8/57.1**（headless + 真实 ANGLE/AMD 核显；maxFps=60） |
| 主菜单 / 多人房间 | 60.0 / 59.9 FPS；房间 RTT 1.3 ms、8 s 接收 26.5 KB |
| 手机视口模拟 3120×1440（30 s 稳定） | 基线 44.8 → **优化 60.0 FPS**，动态分辨率 0.9→0.5；**非真机** |
| 方块编辑压力（70 次，区块边界） | p99 25.0→20.8 ms，最慢 29.2→20.9 ms |
| K-39（SwiftShader + CPU 8×，两轮刷新） | 基线 3 次/46 s → 修复 **0 次/约 9 s** |
| 服务器 2/5/10/30 连接 | **19.97–20.00 TPS**；tick 0.12–0.39 ms；CPU 0.4–2.7% |
| 长时间运行 | 8 分钟 480 s：平均 59.08 FPS，p5 53.4；无错误；>1 小时未测 |
| phase-05/06 回归 | **62/62、18/18、6/6、22/22、31/31 PASS** |
| 静态 | 91 JS + 9 mjs `node --check` PASS；87 页面脚本；`git diff --check` PASS；本阶段 LF；`status.ps1` 保留 BOM |
| 独立验收修复 | 3/3 修复（动态分辨率目标、粒子满额异常、画质建议 maxFps）；复测光影 3/4 为 59.8/57.1 FPS（边际波动，未稳定 60） |

## 已验证（phase-06）

| 测试 | 结果 |
|---|---|
| 服务端双存档（同房名隔离/定时保存/断线存活/重启恢复/备份/语法+结构损坏回退写回/异常退出） | **22/22 PASS** |
| 浏览器双存档（旧存档/本地 CRUD/刷新/同名/服务器同名隔离/`srv~` 防线/房间刷新恢复/离开/断线） | **31/31 PASS** |
| 改造前旧存档样本复验（`gen=1` / `gen=2` / 旧 cloud 字段 / 旧键） | PASS |
| phase-05 服务端回归 | **62/62 PASS** |
| phase-05 双浏览器 E2E 回归 | **18/18 PASS** |
| phase-05 单人回归 | **6/6 PASS** |
| 91 JS + 9 server mjs `node --check` | PASS |
| `index.html` 脚本数 | 87（未变） |
| `git diff --check` / 本阶段文件 LF / 无 BOM | PASS |

证据：`D:\ds\REA\_work\phase06-*`；详细：`docs/phases/phase-06-dual-save/TEST_REPORT.md`。

## 已验证（phase-05）

| 测试 | 结果 |
|---|---|
| 服务端集成（协议/安全/房间/同步/权限/存档/备份/关闭/限流） | **62/62 PASS** |
| 双浏览器多人 E2E（创建/加入/互看/移动/方块/聊天/重连/踢人/关房） | **18/18 PASS** |
| 单人回归（创建/编辑/保存/刷新恢复） | **6/6 PASS** |
| 91 个 `js/*.js` + 9 个 `server/*.mjs` `node --check` | PASS |
| `index.html` 脚本数 | 87 |
| `git diff --check` | PASS |
| `scripts/serve.mjs` 回归（index/mp.js/拒绝 config） | PASS |
| `stop.ps1` / `status.ps1` / 端口占用启动 | PASS |
| 修复复核 F-A：方块 ID 全量、19 个动态 ID、羊毛存档恢复 | **1257/1257 + 19/19 + 3/3 PASS** |
| 修复复核 F-B：方块实体初始/增量/继续恢复双客户端 | **7/7 PASS** |
| 修复复核 F-C：有脏房间 + 活动连接 `stop.ps1` | **18/18 PASS（3 轮）** |
| 修复复核 F-D：完整 Diff 无 CRLF-only | **35/35，raw = normalized** |
| 修复复核 F-E/F-F：掉落距离 / 旧 socket close | **6/6 PASS** |
| 独立验收补充：晚加入/刷新恢复/Origin/非回环管理/目录穿越 | PASS |
| 浏览器 E2E 未捕获异常 | 0；最近一轮 `game.errLog` 为空；此前轮次 B 曾一次已知 `chunk stall`（K-39/K-53） |

证据：`D:\ds\REA\_work\phase05-*`；详细：`docs/phases/phase-05-server/TEST_REPORT.md`。

## 未验证 / NOT TESTED / 本阶段边界

- **真实局域网第二台物理设备**：**用户实测通过（2026-11-14，手机 LAN）**；服务器日志显示 LAN 私有地址
  客户端加入房间 E7UDCMQT。用户未提供手机型号/OS/浏览器/截图（按用户要求不提交）。
- **Caddy + 公网 IPv4/域名、路由器端口转发**：未配置、未实测；Caddy 仅备用模板，**不属于正式验收路径**；
  本机无公网 IPv4/域名（K-96）。
- **手机蜂窝/另一个物理网络发起 WSS**：**用户实测通过（2026-11-14，手机蜂窝 + Cloudflare HTTPS）**；
  服务器日志显示蜂窝 IPv6 客户端加入房间 XF6BT4YQ。
- **HTTPS/WSS**：已用 Cloudflare quick tunnel + 真实手机蜂窝实测；quick tunnel 临时、无 SLA，
  大资产偶尔超时（修复后公网浏览器前两次超时、第三次通过），不能当长期地址（K-97）。
- **Windows 防火墙规则真实添加/删除**：脚本非管理员拒绝已测；实际规则添加/删除未执行
  （当前非管理员；本机网络为 Public，K-99）。手机 LAN 实测说明当前入站路径可用。
- **10 人压力、20 TPS 实际负载、100k 方块/5000 方块实体上限、连续运行 > 1 小时**：未测。
- **服务端生物 AI、红石/流体/战斗/物品语义完整权威**：明确不做（K-67/K-69）。
- **世界存档跨版本**：`seed + 覆盖层` 依赖相同世界生成版本；跨版本未测（K-73）。
- **真实手机功能已测，但型号/OS/浏览器/GPU/发热/电池/帧率未提供**：用户明确不提交设备信息；
  不写成性能达标。
- **真实网络中断/移动网络切换/服务器重启时正在对局**：未测；只测本机断线重连与优雅重启。
- **管理接口远程拒绝的双机验证**：已在本机用 LAN IP 实测 403、公网经 Tunnel 带令牌仍 403（K-80 更新）；
  真实手机未访问管理接口，仍缺第二台机器。
- **内容过滤/举报/封禁/管理员公告**：旧服务领域，本阶段不做。
- **旧云存档从旧服务恢复/迁移**：不做；旧服务不可用、无账号数据，只保留本地残留不删除（K-20/K-46/K-82）。
- **服务器世界下载/统一世界列表**：不做；服务器世界仅通过邀请码/继续房间进入（K-83）。
- **异常退出零丢失**：不承诺；最多丢失 `autosaveSeconds` 内改动（默认 60 秒，K-84）。
- **在线恢复备份 UI**：不做；启动自动回退，或停服务器手动复制（K-85）。
- K-39 `chunk stall`：**phase-07 已修复（验收结束）**；SwiftShader + CPU 8× 限速 0 次/约 9 s。

## 阶段进度

| 阶段 | 状态 | 内容 |
|---|---|---|
| phase-04 浏览器 | 完成并验收（带豁免）；代码 `553ceed` | 平台层、自有资源、静态服务器、网页入口、设备输入、兼容性 |
| phase-05 服务器 | **已验收（2026-11-12）；代码 `817bad3`** | 自建服务器、房间/邀请码、临时 ID、真实短时重连、服务端权威基础、多人存档、F-1 |
| phase-06 双存档 | **已验收（2026-11-12）；代码 `b4833b8`；docs 收尾为当前 HEAD** | 单人 IndexedDB 与服务器世界隔离、旧存档保护、损坏恢复、同名不覆盖 |
| phase-07 性能 | **验收结束（2026-11-13）；代码 `508fcc8`；已推送** | 帧预算/动态分辨率/画质建议/实体粒子内存/网络诊断/20 TPS 调度/K-39；K-93/K-94 保留 |
| phase-08 部署 | **验收通过（真实设备用户实测）；等待提交确认；未提交** | LAN 主地址/邀请链接修复 + Cloudflare Tunnel HTTPS/WSS（正式验收路径，手机蜂窝实测）+ Caddy 备用模板；代理感知管理边界 |
| phase-09 验收 | 未开始 | 全阶段回归、真机与发布验收 |

## 交接与下一阶段前置

1. **phase-08 验收结束（真实设备用户实测）**：代码 `ef8c540`；docs `d8b237a`/`597a15f`；
   已推送 `origin/opusmc-integration`；不自动进入 phase-09。
2. phase-08 前置保持：`mc-js-clone` 结构、`srv~` 拦截、服务器 `seed + 覆盖层`、87 页面脚本/91 JS 未改；
   服务端新增 `netutil.mjs`（10 个 `.mjs`），部署时不能只复制旧 `server/`。
3. 已实测（修复后）：LAN 启动输出/邀请链接 8/8、LAN 协议 22/22、LAN 浏览器 15/15；
   Cloudflare Tunnel HTTPS/WSS 协议 22/22、浏览器 15/15（第三次通过）；
   **真实手机 LAN（单人/移动/视角/放置/破坏/刷新）与手机蜂窝公网（HTTPS/进入/渲染/移动/视角/放置/破坏/刷新）
   用户报告 PASS**；服务器日志有 LAN 与蜂窝客户端加入。
4. 未测：Caddy + 公网 IPv4/域名/端口转发、Windows 防火墙脚本实际添加/删除、公网长期稳定性/带宽/
   10 人并发、真实手机型号/OS/GPU/发热/帧率；不得写成已通过（K-95…K-100）。
5. K-93：光影 3/4 固定分辨率重复轮次 59.8/57.1 FPS；K-94：网络流量为字符近似；
   phase-08 quick tunnel URL 已失效，不能当固定地址；Caddy 备用模板不得写成已通过；
   “PIN/邮箱验证”是 Cloudflare 临时地址外部流程，不是应用功能。
6. 遗留：旧房间服务/`/api/skin`/管理员公告/旧 `mcjs-room-key`（K-36/K-44/K-45/K-63/K-77）；
   `NET_CONFIG.rooms` 仍指旧服务；`announce=false`。旧云存档残留不删除。
7. `D:\Projects\OpusMC` 未同步；如以那份为准，需要用户确认后单独同步。

## phase-04 历史（已完成并验收；代码 `553ceed`）

- 新增 `js/platform.js`；`index.html` 86 脚本、`js/` 90 JS；自有静态服务器白名单 + ETag/304 + 缓存；
  桌面/移动输入、安全区/视口、兼容性面板；`NET_CONFIG.announce=false`。
- 实现测试 Edge 37/37、Chrome 37/37、旧 Chrome 83 9/9、移动模拟 21/21、降级 7/7、兼容面板 3/3。
- 独立验收 Edge 44/44、Chrome 43/45（2 项 K-39）、移动模拟 25/25、兼容/降级 7/7、phase-03 回归 33/33。
- 用户豁免真实 Android/iOS 补测；K-39 留 phase-07；代码 `553ceed` 已推送，未合并。

## phase-03 历史（客户端完成、验收结束；代码 `025cba8`）

- 删除 `account.js`、`toy.js`、`cloudsave.js`、`checkin.js`；新增 `guest.js`（`GuestSession`）；index 85 脚本。
- 全部外观开放并保存在本设备 `mcjs-look`；单人 IndexedDB；无账号/B站/Toy/云存档/签到。
- 实现测试 33/33 + 首启 1/1；独立验收 68 PASS / 0 FAIL / 1 BLOCKED + F-1；真实联机/重连留 phase-05。
- F-1（同名昵称房间所有权）已由 phase-05 服务器身份/所有权解决；旧路径仍保留。

## phase-02 历史（已完成并验收，代码 `a9dc47b`）

- 全部皮肤/披风/装饰（含 `adm*` 与活动款）开放；多人入口无门槛；邀请码保留。
- `mcjs-look` 本设备外观保存；独立验收 35 项 PASS；末影龙结局 8/8 PASS。

## phase-01 历史（已完成并验收，代码 `15154bd`）

- 删除首启两屏、公告面板、解锁面板、反馈面板、遥测、制作人员/协议入口；脚本 90 → 88；`js/` 94 → 92。
