# phase-00 初始化与整体复核 · 交接（HANDOFF）

- 状态：**phase-00 已结束**；**phase-01 未开始**（等待用户明确发送“执行阶段 1”）
- 交接时间：2026-11-06
- 代码基线：`2798c08`（`v0.1.0-integration`）
- 当前 HEAD：阶段 0 收尾 docs 提交（父提交 `e49a54c`；哈希见 `git log -1`）
- 工作区：**干净**；阶段 0 收尾文档已提交（仅 `docs/`）；游戏源码无改动，无 stash
- 远程：PR #1 未合并；`origin/main=6c476c0`；本次未推送

## 1. 本阶段目标

只读复核当前工作区，回答：

1. 实际基线、入口、脚本数量、可运行版本；
2. 平台/账号/网络依赖；
3. 游戏逻辑与服务端的分离难度；
4. 哪些模块保留、可删、必须重构；
5. 服务端缺什么、风险与实施顺序。

**本阶段禁止修改代码。**

## 2. 实际完成情况

- Git/文件/入口/加载顺序复核
- Toy / Account / 云存档 / 公告 / 签到 / 遥测 / 反馈依赖清单
- `NetClient` / `RoomService` / `NetConfig` / `p2p` 网络结构复核
- `Game.tick` / `useEquipment` / `UI.open` / `CreditsScreen` 补丁链复核
- 核心模拟模块的无头加载与世界生成验证
- 无头浏览器启动、创建世界、保存/读取验证
- 阶段 1 删除入口的精确文件/行号清单
- 10 项改造决策 + 1-A 边界确认
- 本阶段文档收尾（STATUS/ARCHITECTURE/CHANGELOG/KNOWN_ISSUES/HANDOFF/START-HERE/DECISIONS）

**未做**：没有修改任何游戏源码；没有执行阶段 1；没有推送远程。

## 3. 关键修改文件

### 游戏源码

**无。** `js/`、`index.html`、`scripts/`、`sounds/` 均未修改。

### 本次文档

| 文件 | 变更 |
|---|---|
| `docs/STATUS.md` | 更新阶段、HEAD、代码基线、整体状态、待办 |
| `docs/ARCHITECTURE.md` | 更正 `Game.prototype` 统计口径；新增 §9 复核补充 |
| `docs/CHANGELOG.md` | 新增 phase-00 复核与交接（已随 docs 提交） |
| `docs/KNOWN_ISSUES.md` | 新增阶段 0 发现的依赖/环境/兼容性风险 |
| `docs/phases/phase-00-initialization/HANDOFF.md` | 本文件 |
| `docs/START-HERE.md` | 同步基线、阶段状态与阶段 1 入口 |
| `docs/DECISIONS.md` | 新增 ADR-011 |

## 4. 关键技术决策（用户已确认）

| # | 决策 |
|---|---|
| 1 | 保留 `e49a54c`；阶段分支从当前 `develop` 创建；代码基线仍为 `2798c08` |
| 2 | 阶段 1 **先更新 `PROJECT_SPEC.md` §6**，加入“欢迎来到 OpusMC（用户协议窗口）”和“你是哪种玩家？”两个界面的删除，再改代码 |
| 3 | 只开放普通 7 款披风 + 活动款；**管理员款保持隐藏** |
| 4 | 删除签到后，企鹅/金苹果等活动款装饰**随活动一起删除**；最终只留普通 7 款 |
| 5 | 删除“你是哪种玩家”后，**新世界默认关教程**；旧存档 `meta.tutorial` 保留 |
| 6 | 阶段 1 只删“选项入口 + 反馈面板”；**保留 `Telemetry` 核心与 `GAME_BUILD`**，遥测模块整体清理留到后续 |
| 7 | 服务端采用 **B/C 混合**：协议词汇/区块编码复用 `p2p.js`，传输换 WebSocket；`NetClient` 保留为“直连原版代理”的遗留功能 |
| 8 | 服务端允许引入 `ws`（**唯一依赖**） |
| 9 | 阶段 8 **先交付 LAN**；公网 HTTPS/WSS 后续再验收 |
| 10 | 本地 `cloud` 元数据与 `mcjs-cloud-dirty-*` **原样保留**；每月手动/脚本清理一次，不自动删 |
| 11 | 阶段 1 采用 **1-A**：删除 `UnlockScreen` 的同时让 `onlineGate()` 直接放行，避免活引用；这会提前完成阶段 2 的多人门槛部分 |

## 5. 测试结果

### 已通过（实测）

| 测试 | 结果 |
|---|---|
| 静态服务器 `GET /` | 200，16,469 B |
| `GET /js/game.js` | 200，186,140 B |
| 无头 Edge 156 + SwiftShader 启动 | `game.state='title'`，WebGL2，0 游戏错误 |
| 创建世界（seed 12345） | `play`，62 区块，4,783 ms |
| 存档/读取 | `DB.backend='idb'`，`DB.listWorlds()` 返回 `probe-world` |
| Node v26.13.0 加载核心模块 | 成功（需浏览器全局垫片） |
| Node 生成区块 | 98,304 方块，183 ms |

### 未测试 / NOT TESTED

- 真实 GPU 的 60 FPS；手机 30/60 FPS
- Android Chrome / iOS Safari 真机
- 长时间运行内存/稳定性
- 多人（自建服务器）与 LAN 双设备
- HTTPS/WSS、NAT、反向代理
- 服务器备份恢复演练
- 阶段 1 及以后任何代码改动

## 6. 当前 Git

| 项 | 值 |
|---|---|
| 分支 | `develop` |
| HEAD | 阶段 0 收尾 docs 提交（父 `e49a54c`；哈希见 `git log -1`） |
| 代码基线 | `2798c08` = `v0.1.0-integration` |
| 标签 | `v0.1.1-context=e49a54c`；`v0.1.0-integration=2798c08`；`v0.1.0-preproject=3913860`；`v0.0.0-original=6090828` |
| 工作区 | 干净；阶段 0 收尾文档已提交（仅 `docs/`）；无代码改动、无 stash、无未跟踪文件 |
| 远程 | PR #1 未合并；未推送、未强推 |

> 本次文档改动已随阶段 0 docs 提交进入仓库，只含 `docs/`，未夹带代码；未推送远程。

## 7. 下一阶段前置条件

1. 用户明确发送 **“执行阶段 1”**。
2. 先更新 `docs/PROJECT_SPEC.md` §6（加入两个首启界面删除）并同步 `STATUS.md`。
3. 从当前 `develop`（含阶段 0 文档提交）创建 `phase/01-menu-cleanup`。
4. 冻结阶段 1 的文字、入口、资源清单（见第 8 节）。
5. 按 **1-A** 处理 `UnlockScreen`/`onlineGate`。
6. 同步处理 `social.js` 对 `FeedbackScreen` 的引用；保留 `Telemetry`/`GAME_BUILD`。
7. 测试主菜单、单人创建/加载/保存、控制台无 `ReferenceError`、无悬空入口。
8. 阶段 1 验收通过后才提交；合并到 `develop` 仍需用户确认。

## 8. 下一阶段需要特别检查的文件和依赖

| 文件/依赖 | 检查点 |
|---|---|
| `index.html` | 删除 head 内 Toy 性能脚本（3–219）；删除启动页脚（245）；删除对应 `<script src>` 时注意顺序 |
| `onboard.js` | `AgreementScreen`、`PlayerKindScreen`、`Onboarding.start` 链、`OptionsScreen` 协议入口；`playerKind` 对 `game.js:221` 教程判断的影响；`GAME_BUILD` 保留 |
| `news.js` | `NewsBoard`、`NewsScreen`、`NewsEditScreen`、标题 `layout/drawExtra/mouseDown` 注入；`checkin.js:120` 的 `signRect`；`skins.js:157` 的礼物判断 |
| `screens.js` | `TitleScreen` 登录/解锁/反馈入口；`OptionsScreen` 的 387/388；`PauseScreen` 的反馈入口；主菜单 134/135 文字 |
| `telemetry.js` | 删 `FeedbackScreen`、`postFeedback`、`feedbackShot`、`TelemetryScreen` 内反馈按钮；**保留** `Telemetry`、`GAME_BUILD` |
| `social.js` | `textOk()` 中 `FeedbackScreen` 引用；不先改会导致聊天/举报 `ReferenceError` |
| `account.js` | `UnlockScreen`、`onlineGate`、`CreateRoomScreen` 的 gate 回退；1-A 放行后不要留下死引用；账号主体留到 phase-03 |
| `ui.js` | `UnlockSparks.draw` 对 `account.js` 的引用；随解锁界面删除 |
| `game.js` | `meta.tutorial` 的 `playerKind` 默认；新世界默认关教程 |
| `capes.js` / `skins.js` / `cosmetics.js` | 管理员款隐藏；活动款 phase-02 暂开放、phase-03 删除；`Account.data` 读取点 |
| `docs/PROJECT_SPEC.md` | §6 新增两个首启界面；§11 基线/阶段状态同步 |
| `scripts/serve.mjs` | 本阶段不改；阶段 5 前不要把 `server/data` 放进静态根 |

## 9. 交接方式

新会话按以下顺序读：

1. `docs/START-HERE.md`
2. `docs/PROJECT_SPEC.md`
3. `docs/STATUS.md`
4. `docs/ARCHITECTURE.md` §9
5. `docs/DECISIONS.md` ADR-011
6. `docs/KNOWN_ISSUES.md`
7. 本文件

不要重新导入源码、不要重建 PR、不要凭记忆推断 HEAD；先执行 `git status` / `git log -3` / `git branch -vv` 核实。

## 10. 未完成 / 明确不做

- 阶段 1–9 全部未开始。
- 本阶段没有改任何游戏功能，没有删任何入口。
- 没有服务器、没有访客模块、没有双存档改造、没有性能测量、没有部署。
- 没有推送、没有合并 PR #1。