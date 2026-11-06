# phase-01 主菜单删减与功能修改 · 交接（HANDOFF）

- 状态：**已完成；验收结束；代码已提交**
- 日期：2026-11-06
- phase-01 代码提交：**`15154bd`**
- 当前分支：`develop`
- 文档收尾：当前 HEAD（哈希见 `git log -1`）
- 工作区：干净；无 stash、无未跟踪文件
- 远程：未推送、未合并；PR #1 未合并

## 1. 本阶段目标

按用户冻结清单完成主菜单删减与功能修改，不进入 phase-02：

1. 删除进入主菜单前的「欢迎来到 OpusMC」和「你是哪种玩家？」两屏及专属代码/状态/资源。
2. 删除主菜单公告面板；保留与签到/聊天公告/Cosmetics 的共用部分。
3. 删除「解锁披风和联机」面板、入口与专属交互；多人门槛按 1-A 直接放行。
4. 删除选项菜单的「遥测数据」「制作人员名单与致谢」「用户协议和隐私说明」入口。
5. 删除主菜单指定文字，包括登录提示、B 站/Toy 发布文案、非官方/UP 主自制文案。
6. 删除反馈入口、面板、表单、状态、提交与截图逻辑。
7. 清理脚本引用、悬空标识、事件监听、无用资源与不再使用的 API。

## 2. 实际完成情况

### 任务 1：首启两屏

- 删除 `AgreementScreen`、`LEGAL`、`legalV` 与用户协议/隐私文本。
- 删除 `PlayerKindScreen`、`PLAYER_KINDS`、`playerKind`。
- 首启链：`startTitle` → 等 `titleWorldReady()`（最多 8 s）→ `QualityScreen` → `DeviceScreen` → 登录 → `DifferencesScreen` → 标题。
- 新世界 `tutorial = meta.tutorial ?? -1`；旧存档保留。
- 小地图/死亡点改为仅在显式开启时显示。

### 任务 2：公告

- 删除 `js/news.js` 及 `index.html` 引用；公告吊牌、公告板、未读/自动弹出、编辑/发布、公告礼物领取全部消失。
- 保留签到、聊天里的管理员全服公告、`Cosmetics`。
- `checkin.js` 不再读取公告吊牌位置，签到按钮使用标题右上角固定回退位置。
- `skins.js` 删除公告礼物查询/跳转，保留签到奖励说明。

### 任务 3：解锁/联机

- 删除 `UnlockScreen`、标题入口、账号界面入口、衣柜解锁按钮、锁定披风解锁点击。
- 删除 `UnlockSparks`、`unlockCelebrate`、解锁图标、`Account.allUnlocked`、`Account.has('online')`。
- `onlineGate(g, then) { return then(); }`（1-A）；`net.js` 删除 `UnlockScreen` 回退。
- 普通披风/皮肤的内部解锁数据仍在，phase-02 再开放。

### 任务 4：选项与遥测

- 删除选项「遥测数据…」「制作人员名单与致谢…」「用户协议和隐私说明」。
- 删除 `TelemetryScreen`；K-27 后续删除 `js/telemetry.js`、全部 `Telemetry` 调用/包装；`GAME_BUILD` 移到 `js/game.js`。
- `CreditsScreen`（末影龙结局）保留。

### 任务 5：主菜单文字

- 删除标题左上角登录按钮与登录提示、标题底部登录说明。
- 删除「OpusMC · 仅在 B站 Toy 平台发布」与「非官方作品-UP主自制toy」；保留 `OpusMC` 标识。
- 删除启动页脚与 `#bootnote` CSS；删除 head 内 Toy 性能上报脚本。

### 任务 6：反馈

- 删除 `FeedbackScreen`、`postFeedback`、`feedbackShot`、`FEEDBACK_KINDS`。
- 删除标题/暂停/遥测界面反馈入口。
- `social.js` 内容检查只包裹 `ReportScreen`；举报保留。

### 任务 7：清理

- K-27：移除遥测模块/脚本/请求；无 `Telemetry` 全局、无 `/api/telemetry`。
- 92 个 `.js` 全量 `node --check` 通过；88 个脚本全部 200。
- 已删标识无代码残留；`game.errLog` 为空。

## 3. 关键修改文件

| 文件 | 变更 |
|---|---|
| `index.html` | 删除 Toy 性能脚本、启动页脚、`news.js`/`telemetry.js` 引用、`#bootnote`；脚本 90 → 88 |
| `js/onboard.js` | 删除首启两屏；首启链适配标题世界就绪；删除协议入口 |
| `js/game.js` | 新世界默认关教程；`GAME_BUILD` 从 telemetry.js 移入 |
| `js/extras.js` | 小地图/死亡点不再依赖 `playerKind`；移除遥测计数 |
| `js/screens.js` | 删除标题登录/反馈/解锁入口、底部平台文案、选项三项、暂停反馈 |
| `js/cloudsave.js` | 删除标题底部「登录后可以联机…」 |
| `js/news.js`（删） | 公告吊牌/公告板/编辑/发布/礼物/自动弹出/未读 |
| `js/telemetry.js`（删） | 遥测核心、反馈、`TelemetryScreen`、`GAME_BUILD` |
| `js/social.js` | 内容检查只包裹 `ReportScreen`；删除遥测 flush |
| `js/account.js` | 删除 `UnlockScreen`、解锁入口/特效、online 解锁状态；`onlineGate` 放行 |
| `js/net.js` | 删除 gate 错误里的 `UnlockScreen` 回退 |
| `js/skins.js` | 删除解锁按钮与公告礼物跳转；锁定披风无解锁入口 |
| `js/checkin.js` | 签到入口不依赖公告；删除遥测计数 |
| `js/capes.js` | 更新解锁/公告相关注释 |
| `js/ui.js` | 删除 `UnlockSparks` 绘制 |
| `js/p2p.js` / `render.js` / `save.js` / `touch.js` / `toy.js` | K-27：移除遥测计数、纹理自检、DB 记录、全屏/导航计数 |

## 4. 关键技术决策

1. 首启两屏整体删除；首启等待 `titleWorldReady()`，避免画质基准在未建好的场景上卡死（K-35）。
2. 新世界默认无教程；旧 `meta.tutorial` 保留；小地图/死亡点不再由 `playerKind` 自动开启。
3. 公告模块整体删除；签到、聊天公告与 `Cosmetics` 保留；签到入口改用固定位置。
4. 解锁面板删除 + 1-A 放行；皮肤/披风内部解锁数据保留到 phase-02。
5. 遥测：K-27 要求下整体移除，而非保留核心；`GAME_BUILD` 移到 `js/game.js`。
6. 反馈整体删除；举报保留。
7. 按用户指令未创建 `phase/*` 分支，直接在 `develop` 提交；未推送、未合并。

详见 `DECISIONS.md` ADR-012/ADR-013。

## 5. 测试结果

- 独立验收：**35 项 PASS，1 项 NOT TESTED，0 项 FAIL**。
- 首启/画质/设备/登录/版本说明/标题全链通过。
- 标题、选项、暂停、创建世界、保存/读回、多人入口、衣柜、签到结构、账号 mock、结局界面绘制、`WhatsNew` 包装链均通过。
- `Telemetry` undefined；无 `telemetry.js` / `/api/telemetry`；`GAME_BUILD` 版本文字正常。
- `game.errLog` 为空；控制台仅原版噪音。
- NOT TESTED：末影龙通关实际触发 `CreditsScreen`（只验证类存在与绘制）。
- 环境限制：真实 GPU/手机、真实账号/签到、自建多人服务器、HTTPS/WSS 未测。
- 详细记录：同目录 `TEST_REPORT.md`。

## 6. 当前 Git

| 项 | 值 |
|---|---|
| 分支 | `develop` |
| phase-01 代码提交 | **`15154bd`** |
| 文档收尾 | 当前 HEAD（`git log -1`） |
| 代码基线 | `2798c08`（`v0.1.0-integration`） |
| 工作区 | 干净 |
| 远程 | 未推送、未合并、未强推 |
| 分支说明 | 按用户指令未创建/切换 `phase/*` 分支 |

## 7. 下一阶段前置条件（phase-02）

1. 用户明确发送 **“执行阶段 2”**；不得提前修改。
2. 确认工作区干净、HEAD 为本次 docs 收尾提交；读取 `STATUS.md`、`DECISIONS.md`、`KNOWN_ISSUES.md`。
3. 确认 phase-02 边界：开放普通 7 款披风 + 活动款；管理员款（`adm*`）保持隐藏；活动款在 phase-03 随签到/活动删除。
4. 确认是否继续保留账号/云存档（phase-03 才删除）；phase-02 只做“解锁移除/直接可用”，不得新建账号系统。
5. 不引入服务器端改造；多人门槛已在 phase-01 按 1-A 放行。

## 8. 下一阶段需要特别检查的文件和依赖

| 文件/依赖 | 检查点 |
|---|---|
| `js/capes.js` | `Capes.unlocked()`、`Capes.list`、`admin`/`ev` 标记；管理员款隐藏；普通 7 款 + 活动款开放 |
| `js/skins.js` | `Account.has('skin')`、正版皮肤入口、`WardrobeScreen` 保存/登录依赖 |
| `js/cosmetics.js` | 帽子/宠物/前缀的 `has`/活动款判断；签到奖励来源 |
| `js/account.js` | `Account.has`、`unlocks`、`checkUnlocks`、`loadGate`；phase-03 才整体删除 |
| `js/checkin.js` | 活动款奖励与 phase-02/03 时序；签到入口仍保留 |
| `js/net.js` / `js/p2p.js` | `sendLook`/外观同步；多人玩家披风/皮肤显示 |
| `js/cloudsave.js` / `js/save.js` | 账号设置、外观选择持久化；旧存档兼容 |
| `js/ui.js` / `js/screens.js` | 标题/衣柜入口与锁定提示；不要恢复 `UnlockScreen` |
| `docs/KNOWN_ISSUES.md` | K-28（未解锁披风/皮肤）、K-30、K-31/K-32、K-34 |
| `docs/PROJECT_SPEC.md` §6 | 第 9/10 项“必须开放”的验收口径 |

## 9. 未做 / 明确不做

- 未开放皮肤/披风/装饰（phase-02）。
- 未删除账号/登录/云存档/签到/Toy（phase-03）；遥测已在 K-27 移除。
- 未改联机协议、未写服务器（phase-05）。
- 未做性能/触控/部署改造。
- 未推送、未合并、未进入 phase-02。

## 10. 已知遗留

- 未解锁非活动款披风/正版皮肤在 phase-02 前不可获得（K-28）。
- 旧 `mcjs-news*`、`playerKind`、`legalV`、`settings.telemetry` 为死数据（K-31/K-32）。
- `DifferencesScreen` 现在对所有首启玩家显示（K-30）。
- 首启画质设置会先显示标题数秒（K-35）。
- 选项里仍有禁用占位「联机…」（K-34，不是解锁面板入口）。
- 账号/登录/云存档/签到/Toy 仍在，phase-03 处理。
