# 项目状态（STATUS）

- 更新时间：2026-11-06
- 当前阶段：**phase-01 主菜单删减与功能修改 —— 已完成，验收结束**
- 下一阶段：**phase-02 解锁移除**（未开始，需用户明确指令）
- 代码版本：**`15154bd`**（`feat(phase-01): remove onboarding, news, unlock, feedback and telemetry`）
- 当前分支：`develop`（阶段 0 后未创建 `phase/*` 分支，按用户指令留在 `develop`）

## Git

| 项 | 值 |
|---|---|
| 仓库 | `D:\Projects\OpusMC` |
| 当前分支 | `develop`（跟踪 `origin/opusmc-integration`，ahead 5：阶段 0 两个 docs 提交 + phase-01 代码提交 + phase-01 docs 收尾） |
| HEAD | phase-01 docs 收尾提交（哈希见 `git log -1`；父提交 `15154bd`） |
| phase-01 代码提交 | **`15154bd`** |
| 代码基线 | `2798c08`（`v0.1.0-integration`） |
| 工作区 | **干净**（phase-01 代码与文档均已提交；无 stash、无未跟踪文件） |
| 远程 | PR #1 未合并；本次未推送、未合并、未强推 |

> phase-01 的代码提交为 `15154bd`；本次文档收尾为当前 HEAD。远程推送、合并到 `main`、PR 操作均需用户另行确认。

## 整体状态

- **单机**：可运行；标题、首次画质设置、创建世界、暂停菜单、保存并返回标题均已实测。
- **多人**：标题入口不再要求登录/解锁（1-A）；但仓库仍无服务器端，实际联机仍不可用。
- **账号/云存档**：仍存在；phase-01 只删除标题登录入口与解锁面板，账号界面仍可从 选项 → 账号 进入。
- **公告**：主菜单公告模块整体删除；服务端公告/签到接口仍会被账号/签到模块访问（phase-03 处理）。
- **反馈**：入口、面板、提交逻辑与截图逻辑全部删除；聊天/举报内容检查仅保留举报。
- **遥测**：选项入口、`TelemetryScreen`、`Telemetry` 核心与 `js/telemetry.js` 整体删除；`GAME_BUILD` 移到 `js/game.js`；无 `/api/telemetry` 请求。
- **首启**：`AgreementScreen`（欢迎来到 OpusMC）与 `PlayerKindScreen`（你是哪种玩家）删除；首启从画质设置开始，等待标题世界就绪后再打开。
- **代码规模**：`index.html` 加载 **88** 个脚本；`js/` **92** 个 `.js` + `emoji.webp`。

## phase-01 已完成

### 任务 1：删除首启两屏

- 删除 `AgreementScreen`、`LEGAL`、`legalV` 状态与用户协议/隐私文本。
- 删除 `PlayerKindScreen`、`PLAYER_KINDS`、`playerKind` 状态与选择逻辑。
- 首启链改为：画质设置 → 设备 → 登录（仍在）→ “这个版本有什么不一样” → 标题。
- 新世界默认关教程（`meta.tutorial ?? -1`）；旧存档 `meta.tutorial` 保留。
- 小地图/死亡点默认改为仅在设置显式为开时显示（原先由 `playerKind` 决定）。

### 任务 2：删除主菜单公告面板

- 删除 `js/news.js`（公告吊牌、公告板、编辑/发布、公告礼物领取、自动弹出、未读标记）。
- 删除 `index.html` 的 `js/news.js` 引用；脚本数 90 → 89（K-27 再删 `telemetry.js` 后为 88）。
- 删除 `skins.js` 中公告礼物查询/跳转；保留签到奖励逻辑。
- `checkin.js` 不再依赖公告吊牌位置，签到按钮使用标题右上角固定回退位置。
- 保留：聊天里的管理员全服公告（`social.js`，与公告板无关）、签到活动、`Cosmetics`。

### 任务 3：删除解锁披风和联机面板

- 删除 `UnlockScreen` 及标题「解锁披风和联机」入口。
- 删除账号界面「解锁…」入口、衣柜「三连解锁：用正版玩家的皮肤」入口、锁定披风的解锁点击。
- 删除 `UnlockSparks` 解锁特效、`unlockCelebrate`、解锁专用图标与 `Account.allUnlocked`。
- `onlineGate()` 改为直接放行（1-A）；多人游戏不再要求账号/关注/三连。
- 删除 `net.js` 中依 `UnlockScreen` 的 gate 回退；服务端 gate 错误只显示文字。
- 保留：普通披风/皮肤的内部解锁数据与渲染；phase-02 再统一开放。

### 任务 4：删除选项菜单指定项

- 删除「遥测数据…」与 `TelemetryScreen`；K-27 后续把 `js/telemetry.js`、全部 `Telemetry` 调用与遥测包装一并删除。
- 删除「制作人员名单与致谢…」入口；`CreditsScreen`（末影龙结局）保留。
- 删除「用户协议和隐私说明」入口（随 `AgreementScreen` 删除）。
- `GAME_BUILD` 移到 `js/game.js`；`Telemetry` 核心已删除（K-27 已解决）。

### 任务 5：删除主菜单指定文字

- 删除标题左上角「登录」按钮及其「登录后可以联机、云存档、换皮肤和披风」提示。
- 删除 `cloudsave.js` 在标题底部绘制的「登录后可以联机、云存档、换皮肤和披风」。
- 删除标题底部「OpusMC · 仅在 B站 Toy 平台发布」与「非官方作品-UP主自制toy」；保留 `OpusMC` 标识。
- 删除启动页脚「非官方作品 · 仅在 B站 Toy 平台发布」及其 CSS。
- 删除 `index.html` 头部 Toy 性能上报内联脚本（原 3–219 行，约 10 KB）。

### 任务 6：删除反馈面板

- 删除 `FeedbackScreen`、`postFeedback`、`feedbackShot`、`FEEDBACK_KINDS`。
- 删除标题「反馈问题」、暂停菜单「反馈问题」、遥测界面「反馈问题…」。
- `social.js` 内容检查只包裹 `ReportScreen`，不再引用 `FeedbackScreen`。
- 无反馈提交请求、无反馈专属状态。

### 任务 7：清理

- `index.html` 88 个脚本全部 200；`js/news.js`、`js/telemetry.js` 不再请求。
- 删除 `#bootnote` CSS、解锁专用图标、标题/公告/反馈/解锁相关悬空标识。
- 全量 `node --check` 通过（92 个 `.js`）。
- 无 `AgreementScreen` / `PlayerKindScreen` / `LEGAL` / `playerKind` / `legalV` / `FeedbackScreen` / `UnlockScreen` / `NewsBoard` / `TelemetryScreen` / `Telemetry` / `UnlockSparks` 残留引用。
- 浏览器实测 `game.errLog` 为空；控制台仅原版噪音（铜门贴图缺失、SwiftShader ReadPixels 警告）。

## 已验证（phase-01 独立验收）

| 测试 | 结果 |
|---|---|
| 静态服务器 GET `/` | 200，6,754 B；88 个脚本全部 200 |
| 全量 JS 语法检查 | 92 个 `.js` 全部通过 |
| 首启（无设置） | 进入 `QualityScreen`；两屏均 undefined；完整链可到标题 |
| 首启画质基准 | 标题世界就绪后开始；`detect` → `pick`，无卡死 |
| 返回玩家 | 直接进入 `TitleScreen` |
| 标题按钮 | 单人游戏、多人游戏、皮肤和装饰、选项…、退出游戏；无登录/反馈/解锁 |
| 标题绘制文字 | 仅 `OpusMC` + 按钮 + 随机 splash；无 B 站/Toy/非官方文案 |
| 选项 | 无遥测/制作人员/用户协议；账号入口仍在 |
| 创建世界 | `play`，61 区块，`tutorial=-1` |
| 暂停菜单 | 无反馈问题；游戏说明/选项/保存回标题正常 |
| 多人入口 | `onlineGate` 直接放行，打开 `MultiplayerScreen`，无登录/解锁 |
| 衣柜 | `WardrobeScreen` 打开；锁定披风点击无异常 |
| 存档 | `DB.listWorlds()` 返回 `acceptance-world` |
| 账号界面 | 未登录与 mock 登录态均可打开，无解锁按钮 |
| 签到结构 | 伪造活动状态下标题按钮与 `CheckinScreen` 可打开 |
| 结局界面 | `CreditsScreen` 类存在且可绘制 |
| 遥测 | `Telemetry` undefined；无 `telemetry.js` / `/api/telemetry` 请求 |
| 控制台/`game.errLog` | 无 ReferenceError；`game.errLog` 为空 |

独立验收结果：**35 项 PASS，1 项 NOT TESTED，0 项 FAIL**。
NOT TESTED：末影龙通关实际触发 `CreditsScreen`（只验证类与绘制）。

## 未验证 / NOT TESTED

- 真实 GPU 的 60 FPS；手机 30/60 FPS
- Android Chrome / iOS Safari 真机、触控、发热、内存
- 长时间运行（>1 小时）
- 自建多人服务器与 LAN 双设备
- 真实登录后的账号界面、解锁状态同步、签到活动（需原服务/账号）
- 末影龙通关后的 `CreditsScreen` 实机触发
- HTTPS/WSS、NAT、反向代理、备份恢复

## 尚未完成的阶段

| 阶段 | 状态 | 内容 |
|---|---|---|
| phase-02 解锁移除 | 未开始 | 开放普通披风/皮肤/装饰；管理员款保持隐藏；活动款按 phase-02/03 时序处理 |
| phase-03 访客模式 | 未开始 | 删除账号、登录、云存档、公告接口、签到、Toy 绑定 |
| phase-04 浏览器 | 未开始 | 桌面/手机/平板兼容、触控、全屏、缓存与性能入口 |
| phase-05 服务器 | 未开始 | 自建服务器、房间/邀请码、服务端权威同步、多人存档 |
| phase-06 双存档 | 未开始 | 单人 IndexedDB 与多人服务器存档独立管理 |
| phase-07 性能 | 未开始 | 区块/Worker/GPU/内存/网络优化，真实设备测量 |
| phase-08 部署 | 未开始 | 先 LAN；HTTPS/WSS、公网、NAT 后续 |
| phase-09 验收 | 未开始 | 全阶段回归、真机与发布验收 |

## 待办（下一阶段前）

1. **phase-02 解锁移除**：开放普通披风/皮肤/装饰；管理员款保持隐藏；活动款按 phase-02/03 时序处理。
2. 开始 phase-02 前需用户明确指令；当前不得提前修改。
3. 合并/推送/PR 操作需用户另行确认。
4. phase-03 仍负责账号、登录、云存档、公告接口、签到、Toy 的清理。
