# phase-05 自建服务器 · 独立验收报告（ACCEPTANCE）

- 日期：2026-11-12
- 验收对象：`D:\ds\REA\opusmc` 中的 phase-05 改动（验收后代码提交 `817bad3`）
- 分支：`develop`；起点 HEAD `3b8b2e0`；phase-05 代码 `817bad3`；docs 收尾为当前 HEAD
- 验收方式：完整 Diff 复核 + 静态依赖/补丁检查 + 独立功能与回归测试 + 对抗性协议测试
- **初检结论（修复前）：不通过（F-A…F-F），不得宣称 phase-05 完成。**
- **修复复核（2026-11-12）：F-A…F-F 已修复并通过复验；已验收（2026-11-12）；代码 `817bad3`；docs 收尾为当前 HEAD；已推送；未进入 phase-06。**

## 1. 验收范围与证据

- 完整规范化 Diff（初检时忽略 24 个既有 CRLF-only 噪音）：`D:\ds\REA\_work\phase05-accept-full.diff`
- 修复后完整 Diff（35 个，raw = normalized，UTF-8）：`D:\ds\REA\_work\phase05-final-full.diff`
- 实现测试（既有）：`_work/phase05-test-2026-11-12T11-18-38-410Z/result.json`（62/62）
- 双浏览器 E2E（既有）：`_work/phase05-browser-result.json`（18/18）
- 单人回归（本次复跑）：`_work/phase05-sp-result.json`（6/6）
- 本次独立验收：
  - `_work/phase05-accept-browser-result.json`（晚加入/刷新恢复/合法花方块）
  - `_work/phase05-accept-flower-result.json`（服务端拒绝合法方块 ID 41）
  - `_work/phase05-blockids-compare.json`（游戏 `BLOCKS` 与服务器白名单对比）
  - `_work/phase05-accept-static.json`（客户端无 `be` 上报的静态证据）
  - `_work/phase05-accept-crlf.json`（CRLF-only 文件）
  - `_work/phase05-accept-ws.mjs`、`phase05-accept-shutdown.mjs`、`phase05-accept-regression.mjs`、`phase05-accept-origin.mjs`（本次测试脚本）

## 2. Diff 与文件清单

规范化 Diff：**34 个文件**（13 个修改 + 2 个删除 + 19 个新增）。

新增：

- `js/mp.js`
- `server/README.md`、`blockids.mjs`、`config.json`、`config.mjs`、`http.mjs`、`index.mjs`、`log.mjs`、
  `protocol.mjs`、`rooms.mjs`、`status.ps1`、`stop.ps1`、`storage.mjs`、`ws.mjs`
- `start-server.bat`、`stop-server.bat`
- `docs/phases/phase-05-server/{PLAN,TEST_REPORT,HANDOFF}.md`

修改：`.gitignore`、`README.md`、`docs/{ARCHITECTURE,CHANGELOG,DECISIONS,KNOWN_ISSUES,PROJECT_SPEC,START-HERE,STATUS}.md`、
`index.html`、`js/net.js`、`js/netconfig.js`、`js/screens.js`。

删除：`server/.gitkeep`、`docs/phases/phase-05-server/.gitkeep`（仅占位文件）。

> 原始 `git add -A` 临时索引显示 58 个文件，其中 24 个是 **既有 CRLF-only 差异**（HEAD 为 LF，工作区为 CRLF）。
> 这些文件不在本阶段 Diff 范围内；但**直接 `git add -A` 会把它们一起暂存**，提交前必须只暂存本阶段文件，或经用户确认统一换行。
> 证据：`_work/phase05-accept-crlf.json`。

## 3. 代码检查

| 检查项 | 方式 | 结果 | 证据 |
|---|---|---|---|
| 完整 Diff / 文件清单 | 临时索引 `git diff --cached --ignore-cr-at-eol` | PASS（34 个预期文件） | `phase05-accept-full.diff` |
| 删除功能的调用入口 | `git diff --diff-filter=D`；全库 `Account` 搜索 | PASS（只删除 `.gitkeep`；无账号回归） | 见 §5 回归 |
| 跨文件依赖 | 入口/模块导入/全局引用扫描 | PASS | `server/*`、`js/mp.js` 引用均存在 |
| Monkey Patch / 包装顺序 | 对照 `p2p.js`、`net.js`、`screens.js` 与 `mp.js` 包装链 | PASS | 单人与双人回归均通过 |
| 全局变量/单例 | 名称冲突、`game.mpClient`、`GuestSession`、`MPServer` | PASS（未发现重复定义；`Account` 仍不存在） | 回归测试 |
| 事件监听器/资源 | `addEventListener`/`setInterval`/`setTimeout` 扫描 | PASS（无新增 DOM 监听；服务器进程退出时清理；存在一处 WS 心跳定时器未显式清理的轻微资源问题） | 代码扫描 |
| 误删共用模块 | 删除清单 + 单人/旧多人入口回归 | PASS（未删任何共用 JS 模块） | 回归测试 |

## 4. 功能测试

| 测试项目 | 测试方式 | 结果 | 证据 |
|---|---|---|---|
| 静态页面/白名单/缓存/HEAD/304 | HTTP + curl | PASS | 62/62 集成测试 |
| 目录穿越/`server/data`/配置不可访问 | curl `--path-as-is` | PASS（404） | 本次 curl：`/../server/config.json` 等 404 |
| 房间创建/邀请码/加入/退出/满员 | WebSocket 协议 + 浏览器 UI | PASS | 62/62；E2E 18/18 |
| 临时玩家 ID / 会话令牌 | 协议 + 刷新恢复 | PASS | `phase05-accept-browser-result.json` |
| 房主权限/踢人/关房/转移 | 协议 + 浏览器 | PASS | 62/62；E2E 18/18 |
| 玩家位置/视角/状态/外观同步 | 双浏览器 + 快照 | PASS | E2E 18/18 |
| 方块变化同步（合法 ID 1） | 双浏览器 | PASS | E2E block test |
| **合法方块 ID 白名单完整性** | 浏览器 `BLOCKS` 全量 vs 服务器白名单；协议发送 ID 41 | **FAIL（43 个合法 ID 被拒绝）** | `phase05-blockids-compare.json`、`phase05-accept-flower-result.json` |
| 晚加入后接收既有方块覆盖层 | 双浏览器 | PASS | `phase05-accept-browser-result.json` |
| 方块实体（箱子/告示牌等）协议同步 | 原始 WebSocket `be` | PASS（服务器协议层） | 62/62 |
| **客户端方块实体变更上报** | 静态代码路径 + 端到端 | **FAIL（`MPClient` 没有发送 `be` 的路径）** | `phase05-accept-static.json` |
| 掉落物/拾取 | 协议 + 双浏览器 | PASS（基本） | 62/62；E2E |
| 世界时间 | 快照/`env` | PASS | 62/62；E2E |
| 断线自动重连 | 关闭 WebSocket 后恢复 | PASS | E2E 18/18 |
| 刷新页面 + 继续上次房间 | 浏览器重载 + `resume` | PASS | `phase05-accept-browser-result.json` |
| 移动校正/超距方块/非法协议 | 协议对抗 | PASS | 62/62 |
| WebSocket 握手/分片/ping/pong/close/未掩码拒绝 | 原始 socket | PASS（5/5） | `phase05-accept-ws.mjs` |
| WebSocket Origin 拒绝 | 原始握手 | PASS（evil 403、同源 101） | `phase05-accept-origin.mjs` |
| 管理接口无令牌/错令牌/本机令牌 | HTTP | PASS | 62/62 |
| 管理接口非回环拒绝 | 绑定 `0.0.0.0`，经 LAN IP 请求 | PASS（LAN IP 403，回环 200） | 本次测试 |
| 正常启动/配置/日志/pid | `start-server.bat`/默认启动 | PASS | 实测 |
| 自动保存/备份/损坏回退 | 停止、损坏、重启 | PASS | 62/62 |
| **正常关闭（`stop.ps1`，有房间）** | 有房间运行后执行 `stop.ps1` | **FAIL（曾 8 秒超时强制退出、pid 残留）** | `phase05-accept-browser-data/logs` 中 `shutdown_forced` |
| 有活动玩家时关闭 | 原始 WebSocket + 管理关闭 | PASS（1001，保存，pid 删除） | `phase05-accept-shutdown.mjs` |
| 加入限流 | 低限额服务器 | PASS | 62/62 |
| 创建限流/消息限流/心跳超时/连接上限 | — | **NOT TESTED** | 未覆盖 |
| 真实 LAN 双设备/10 人/长时间 | — | **NOT TESTED** | 无设备/压力环境 |
| HTTPS/WSS/公网/NAT | — | **NOT TESTED / 未实现** | phase-08 |
| 真实 Android/iOS/GPU/移动端 | — | **NOT TESTED** | 本阶段未重跑 |

## 5. 回归测试

| 测试项目 | 测试方式 | 结果 | 证据 |
|---|---|---|---|
| 单人世界创建/编辑/保存/刷新恢复 | Chrome headless | PASS（6/6） | `phase05-sp-result.json` |
| 单人暂停菜单保持旧布局（无房间按钮） | 浏览器 UI | PASS（5/5） | `phase05-accept-regression.mjs` |
| 旧多人界面仍可打开（创建/我的房间/自建入口） | 浏览器 UI | PASS | 同上 |
| 无账号回归、`GuestSession` 保留 | 全局检查 + UI | PASS | 同上 |
| `scripts/serve.mjs` 静态服务 | HTTP | PASS | index/mp.js 200，config 403 |
| 旧公开房间服务 | 公网服务 | **BLOCKED**（403/CORS，K-02/K-40） | 既有问题 |
| P2P 本地房间真实连接 | 旧房间服务/WebRTC | **BLOCKED / NOT TESTED** | 依赖不可用 |
| NetClient 原版代理直连 | 原代理 | **BLOCKED**（仓库无代理） | 既有遗留 |
| 移动端/真机 | — | **NOT TESTED** | 本阶段未重跑 |

## 6. 发现的问题

### F-A（关键，必须修复）合法方块 ID 被服务器拒绝

- 服务器从 `js/blockdata.js` + `js/blocks.js` 的**正则**生成白名单，只捕获了 `defBlock(128 + i)` 的起始值，
  没有展开 `WOOLS`/`SGLASS`/`CONCRETE` 与 `FLOWER_IDS` 动态 ID。
- 游戏实际 `BLOCKS` 1257 个 ID；服务器白名单 1214 个；**缺 43 个**：
  - 花朵：`41,42,43,44,98,99,100,101,102`
  - 羊毛：`129..143`（128 是唯一被捕获的起始值）
  - 染色玻璃：`145..155`（144 是起始值）
  - 混凝土：`161..168`（160 是起始值）
- 协议测试：发送合法花朵 ID 41 → `reject`“方块 ID 无效”；ID 1 正常。玩家在多人游戏中放置这些方块会被服务器拒绝，
  客户端随后回滚区块；连续 8 次还会累计协议错误并断开。
- `Room` 启动时也用该白名单过滤已保存方块；含这些 ID 的旧存档会被**静默丢弃**。
- 证据：`phase05-blockids-compare.json`、`phase05-accept-flower-result.json`；服务器启动日志
  `block_ids_loaded {"count":1214}`。

### F-B（重要，必须修复或明确豁免）客户端没有方块实体上报

- `MPClient` 只处理服务器下发的 `blockEntities`/`be`，**没有任何发送 `be` 的代码路径**。
- 因而箱子/熔炉/告示牌等内容不会由正常客户端同步；服务器端 `be` 只有测试客户端会触发。
- 文档/测试报告把“方块实体同步”写成已实现，属于过度声明。
- 证据：`phase05-accept-static.json`；`js/mp.js` 只有接收分支（约 216/241 行）。

### F-C（重要，必须修复）`stop.ps1` 有房间时曾无法正常关闭

- 在一次有开放房间的运行中，`stop.ps1` 请求关闭后服务器日志出现 `shutdown_forced`（8 秒超时），
  进程以退出码 1 结束，`server.pid` 残留；`stop.ps1` 返回 1。
- `shutdown()` 先 `await httpServer.close()`，再 `manager.stop()` 保存房间；HTTP keep-alive/残留连接
  可能让 `close()` 阻塞，导致房间保存被推迟到 8 秒强制退出之后。
- 同一天另一次有房间的 `stop.ps1` 在 0.6 秒内成功，说明是**不稳定/挂起风险**而非必然复现；但已观察到真实失败，
  必须修复并用重复测试验证。
- 证据：`_work/phase05-accept-browser-data/logs/server-2026-11-12.log` 中 `shutdown_forced`；
  `phase05-accept-shutdown.mjs`（Node 客户端路径）则 PASS，不能替代 PowerShell 路径。

### F-D（提交前必须处理）CRLF-only 既有文件

- 工作区有 24 个 phase-05 之前的 JS 文件是 CRLF，而 HEAD 是 LF；规范化 Diff 为空，但 `git add -A` 会把它们暂存。
- 本阶段没有修改这些文件；提交时只能按明确路径暂存本阶段文件，或经用户确认统一换行。
- 证据：`phase05-accept-crlf.json`。

### F-E（已修复，见 §8）掉落物距离阈值不一致

- 客户端 `dropItem` 在距离 8 内发给服务器，服务器只接受 6 内；极端移动/延迟下物品可能被服务器拒绝并从客户端消失。
- 证据：`js/mp.js` 的 `dropItem` 过滤与 `server/rooms.mjs` 的 `dist3(pos,p.pos) > 6`。
- 修复：客户端发送阈值收紧到 4.5，服务器仍为 6；7m 不发送、1m 正常发送（§8 6/6）。

### F-F（已修复，见 §8）WebSocket 关闭事件未校验 socket 身份

- `MPClient.onClose()` 不检查触发关闭的是否是当前 `this.ws`；旧 socket 的延迟 close 可能清空新 socket 或触发多余重连。
- 修复：`onClose(ws)` 校验当前 socket，旧 socket 的 open/message/error/close 全部忽略；§8 6/6 通过。

### F-G（测试覆盖缺口，可推迟）

- 创建限流、消息限流、心跳超时、连接上限未测。
- 房间界面的“移出/关闭/复制/离开”按钮没有实际点击测试；邀请链接未测。
- 旧 P2P/NetClient 真实连接无法测试（外部服务/代理不可用）。

## 7. 最终结论

### 已完成事项

- 服务端、客户端、房间/邀请码、临时身份、断线恢复、玩家/方块/时间同步、存档/备份、
  静态/WS 安全、启动/状态/日志等主体实现已完成。
- 既有实现测试 62/62、双浏览器 18/18、单人 6/6；本次独立验收新增的 WS 5/5、关闭 7/7、
  回归 5/5、晚加入/刷新恢复/管理 Origin/非回环等均通过。

### 未完成事项

- 合法方块 ID 白名单不完整（F-A）。
- 客户端方块实体上报缺失（F-B）。
- `stop.ps1` 有房间时的正常关闭不稳定（F-C）。
- CRLF-only 文件导致提交范围风险（F-D）。
- 真实 LAN/10 人/长时间/TLS/移动端未测；创建/消息限流、心跳、连接上限未测。

### 必须修复

> 以下是初检时的必须修复项；F-A…F-F 已在 §8 修复复核中关闭。

1. F-A：补齐/重做方块 ID 白名单（覆盖 41-44、98-102、128-143、144-155、160-168），
   增加“游戏 `BLOCKS` 全量 vs 服务器白名单”自动测试；确认含这些 ID 的存档能加载。
2. F-B：补客户端 `be` 同步，或明确把“方块实体同步”移出本阶段范围并同步修改文档/测试；
   需要用户确认后才能作为豁免。
3. F-C：调整关闭顺序（先/并行保存，再关闭 HTTP；`closeAllConnections`/`Connection: close`），
   用 `stop.ps1` 在有房间、有脏数据、有活动连接的情况下重复验证退出码 0、pid 删除、存档完整。
4. F-D：提交时只暂存本阶段文件；不要 `git add -A`，除非用户确认统一换行。

### 可以推迟

- F-E、F-F；创建/消息限流、心跳、连接上限测试；房间按钮/邀请链接 UI 测试；
  真实 LAN、10 人、长时间、TLS/公网、移动端/真机；旧 P2P/NetClient 验证。

### 是否满足阶段验收标准

**初检：否。** F-A 是关键功能失败（正常建造方块被拒绝、旧存档可能丢块），F-C 是正常关闭可靠性失败，
F-B 是已声明功能的缺口。因此 phase-05 **未通过独立验收**；不得提交为“已完成”，不得进入 phase-06。

## 8. 修复复核（2026-11-12）

针对 F-A…F-F 的修复与复验：

| 修复项 | 修复内容 | 复验结果 | 证据 |
|---|---|---|---|
| F-A 方块 ID | `blockids.mjs` 展开花朵/羊毛/玻璃/混凝土动态表；服务器 1257 个 ID 与游戏 `BLOCKS` 完全一致 | **PASS**：1257/1257，动态 19/19 接受，未知 5000 仍拒绝；羊毛 129 存档重启后 welcome 仍带 | `phase05-blockids-compare.json`、`phase05-fix-a-test.mjs`、`phase05-fix-a-restore.mjs` |
| F-B 方块实体 | `MPClient` 增加 `be` 差异上报（排除 `open/lid/viewers`，500ms 最多 2 条）；晚加入/继续时应用服务器初始实体 | **PASS**：7/7（初始箱子、晚加入、修改增量、继续恢复） | `phase05-fix-b-test.mjs` |
| F-C 正常关闭 | 先停止接新连接并保存，再关闭 HTTP/强制清空连接；管理响应 `Connection: close` | **PASS**：有脏房间 + 活动连接 3 轮 `stop.ps1` 均 0.7s 退出 0，方块保存、pid 删除、无 `shutdown_forced` | `phase05-fix-c-test.mjs` 18/18 |
| F-D CRLF | 24 个既有 JS 文件由 CRLF 归一为 LF；显式刷新索引，不提交无关行尾 | **PASS**：完整 Diff raw=normalized=35，无 CRLF-only | `phase05-final-full.diff` |
| F-E 掉落距离 | 客户端发送阈值从 8 收紧到 4.5（服务器仍 6，留延迟余量）；远处掉落保持本地 | **PASS**：7m 不发送、1m 发送 6/6 | `phase05-fix-ef-test.mjs` |
| F-F 旧 socket close | socket 身份绑定到 `onClose(ws)`；旧 socket 的 open/message/error/close 全部忽略；cleanup 清空 `ws` | **PASS**：旧 close 不覆盖新 socket，当前 close 清空 6/6 | `phase05-fix-ef-test.mjs` |

修复后回归：服务端 **62/62**、双浏览器 **18/18**（最近一轮无 `chunk stall`）、单人 **6/6**、
晚加入/刷新恢复 **7/7**、活动玩家关闭 **7/7**、`node --check`/`git diff --check` 通过。

**修复后结论：F-A…F-F 已关闭，代码/测试层面满足阶段验收标准；用户已验收（2026-11-12）；代码 `817bad3`，docs 收尾为当前 HEAD；已推送。**
创建/消息限流、心跳/连接上限、真实 LAN/10 人/长跑/TLS/移动端仍未测试，不能宣称已通过。
