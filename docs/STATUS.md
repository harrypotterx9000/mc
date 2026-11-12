# 项目状态（STATUS）

- 更新时间：2026-11-12
- 当前阶段：**phase-05 自建服务器 — 已验收（2026-11-12）；代码提交 `817bad3`；docs 收尾为当前 HEAD**
- 下一阶段：**phase-06 双存档**（未开始，需用户明确指令；未提前修改）
- 代码版本：phase-05 代码提交 `817bad3`（`server/index.mjs` `VERSION=0.5.0`；基线 `3b8b2e0`）；docs 收尾为当前 HEAD
- 当前分支：`develop`（跟踪 `origin/opusmc-integration`；未新建/切换/重置分支）

## Git

| 项 | 值 |
|---|---|
| 仓库 | `D:\ds\REA\opusmc` |
| 当前分支 | `develop`（跟踪 `origin/opusmc-integration`） |
| HEAD | phase-05 代码 `817bad3`；docs 收尾为当前 HEAD |
| phase-04 代码 | `553ceed`（`feat(phase-04): run as an independent browser game`） |
| phase-05 | **已验收（2026-11-12），代码 `817bad3`；docs 收尾为当前 HEAD**：35 个文件（13 修改 + 2 删除 + 20 新增）；新增 `server/`、`js/mp.js`、根目录启动/停止脚本、阶段文档；独立验收 F-A…F-F 已修复并复验；24 个既有 JS 仅做 CRLF→LF 归一（内容无 diff） |
| 工作区 | phase-05 代码已提交 `817bad3`；docs 收尾为当前 HEAD；无 stash、无临时分支、无未提交代码 |
| 远程 | phase-05 代码 `817bad3`；docs 收尾为当前 HEAD；推送目标 `origin/opusmc-integration`；未合并、未强推、未打标签 |
| 历史代码 | phase-03 `025cba8`；phase-02 `a9dc47b`；phase-01 `15154bd`；基线 `2798c08` |

> `D:\Projects\OpusMC` 仍是 phase-01 副本；phase-02/03/04/05 只在 `D:\ds\REA\opusmc`。如以那份为准，
> 需用户确认后单独同步，禁止直接覆盖。

## 整体状态

- **阶段**：phase-00/01/02/03/04 完成并验收；phase-05 已验收（2026-11-12）；phase-06 起未开始。
- **运行方式（多人）**：双击 `start-server.bat` 或 `node server\index.mjs` → 浏览器打开
  `http://127.0.0.1:8080/` → 多人游戏 → 自建服务器房间。
- **运行方式（单人）**：`node scripts\serve.mjs` 或同一个自建服务器页面；单人仍用 IndexedDB `mc-js-clone`。
- **身份**：无账号；昵称 + 服务器临时 ID（`p_` + 16 hex）+ 会话令牌（120 秒恢复窗口）；昵称不是身份。
- **外观**：`mcjs-look` 本设备保存；服务器只广播外观给同房间玩家。
- **多人**：自建服务器（本机）；旧房间服务/`NetClient`/`p2p` 保留为遗留路径。
- **代码规模**：`index.html` **87** 个脚本；`js/` **91** 个 `.js` + `emoji.webp`（新增 `js/mp.js`）；
  服务端 9 个 `.mjs` + `config.json` + 2 个 `.ps1` + `README.md`。
- **实现测试**：服务端集成 **62/62**；双浏览器 E2E **18/18**；单人回归 **6/6**；修复复核
  **F-A 1257/1257 + 19/19 + 存档 3/3**、**F-B 7/7**、**F-C 18/18**、**F-D 35/35 无 CRLF-only**、
  **F-E/F-F 6/6**；91 JS + 9 server mjs `node --check`；启动/停止/状态/端口占用实测。
- **验收**：用户已确认验收结束（2026-11-12）；**代码 `817bad3`，docs 收尾为当前 HEAD**。提交/推送由本次交接执行。

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

- **真实局域网两台物理设备**加入同一房间：未测。
- **HTTPS/WSS、公网、NAT、反向代理、域名**：未做、未测（phase-08）。
- **10 人压力、20 TPS 实际负载、100k 方块/5000 方块实体上限、连续运行 > 1 小时**：未测。
- **服务端生物 AI、红石/流体/战斗/物品语义完整权威**：明确不做（K-67/K-69）。
- **世界存档跨版本**：`seed + 覆盖层` 依赖相同世界生成版本；跨版本未测（K-73）。
- **真实 Android/iOS 真机、真实 GPU/手机 FPS、发热、内存**：未测；phase-04 已豁免，本阶段未重测。
- **真实网络中断/移动网络切换/服务器重启时正在对局**：未测；只测本机断线重连与优雅重启。
- **管理接口远程拒绝的双机验证**：已在本机用 LAN IP 实测 403（K-80 更新）。
- **内容过滤/举报/封禁/管理员公告**：旧服务领域，本阶段不做。
- K-39 `chunk stall`：phase-07 处理，未修复。

## 阶段进度

| 阶段 | 状态 | 内容 |
|---|---|---|
| phase-04 浏览器 | 完成并验收（带豁免）；代码 `553ceed` | 平台层、自有资源、静态服务器、网页入口、设备输入、兼容性 |
| phase-05 服务器 | **已验收（2026-11-12）；代码 `817bad3`** | 自建服务器、房间/邀请码、临时 ID、真实短时重连、服务端权威基础、多人存档、F-1 |
| phase-06 双存档 | 未开始 | 单人 IndexedDB 与多人服务器存档独立管理 |
| phase-07 性能 | 未开始 | 区块/Worker/GPU/内存/网络优化，真实设备测量；含 K-39 |
| phase-08 部署 | 未开始 | 先 LAN；HTTPS/WSS、公网、NAT 后续 |
| phase-09 验收 | 未开始 | 全阶段回归、真机与发布验收 |

## 待办（phase-05 结束后）

1. **phase-05 已提交**：代码 `817bad3`；docs 收尾为当前 HEAD；推送目标 `origin/opusmc-integration`。
2. 不自动进入 phase-06；下一阶段需用户明确指令。
3. phase-06 前置：区分单人 IndexedDB 与服务器 `srv~` 世界管理；不要把服务器世界写进单人存档。
4. 遗留：旧房间服务/`/api/skin`/管理员公告/旧 `mcjs-room-key`（K-36/K-44/K-45/K-63/K-77）；
   `NET_CONFIG.rooms` 仍指旧服务；`announce=false`。
5. K-39 留 phase-07；真实 LAN/公网/TLS 属 phase-08；真实设备发布前重新评估。
6. `D:\Projects\OpusMC` 未同步；如以那份为准，需要用户确认后单独同步。

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
