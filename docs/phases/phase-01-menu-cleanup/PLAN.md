# phase-01 主菜单删减与功能修改 · 计划（冻结）

- 日期：2026-11-06
- 分支约束：按用户指令**不切换/不新建/不重置分支**，直接修改 `develop` 工作区
- 提交：已验收；代码提交 `15154bd`（`develop`），文档收尾为当前 HEAD
- 前置：PROJECT_SPEC §6 已加入首启两屏删除（第 8 项）

## 范围（只做这些）

1. 删除进入主菜单前的「欢迎来到 OpusMC」（`AgreementScreen`）与「你是哪种玩家？」（`PlayerKindScreen`）及只服务它们的代码、事件、状态、资源。
2. 删除主菜单公告面板（`js/news.js`：吊牌、公告板、未读/自动弹出、编辑/发布、公告礼物领取）。
3. 删除「解锁披风和联机」面板（`UnlockScreen`）及其入口/专属交互；多人门槛按 1-A 直接放行。
4. 删除选项菜单的「遥测数据」「制作人员名单与致谢」「用户协议和隐私说明」入口；整体移除遥测模块。
5. 删除主菜单指定文字：左上角黄色登录文字、登录提示、B 站 Toy 发布文案、非官方/UP 主自制文案。
6. 删除反馈面板：入口、面板、表单、状态、提交逻辑、截图逻辑、只服务它的资源。
7. 清理：脚本引用、未定义变量、悬空函数、无效监听、无用资源、不再使用的 API。

## 明确不做

- 不开放皮肤/披风/装饰（phase-02）。
- 不删除账号、登录、云存档、签到、Toy SDK（phase-03）。
- 不重写联机协议、不新增服务器（phase-05）。
- 不调整画质/性能/触控体系。
- 不改管理员披风隐藏规则、不删除结局 `CreditsScreen`。
- 不提交、不合并、不推送。

## 冻结的删除清单

| 对象 | 位置 |
|---|---|
| `AgreementScreen` / `LEGAL` / `legalV` | `onboard.js`、`OptionsScreen` 覆盖 |
| `PlayerKindScreen` / `PLAYER_KINDS` / `playerKind` | `onboard.js`、`game.js`、`extras.js` |
| `NewsBoard` / `NewsScreen` / `NewsEditScreen` / `js/news.js` | `news.js`、`index.html` |
| `UnlockScreen` / `UnlockSparks` / `unlockCelebrate` / `Account.allUnlocked` / `has('online')` | `account.js`、`screens.js`、`skins.js`、`net.js`、`ui.js` |
| `TelemetryScreen` / 选项「遥测数据」/ `js/telemetry.js` | `telemetry.js`、`screens.js`、全部 `Telemetry` 调用点 |
| 选项「制作人员名单与致谢」「用户协议和隐私说明」 | `screens.js`、`onboard.js` |
| `FeedbackScreen` / `postFeedback` / `feedbackShot` / `FEEDBACK_KINDS` | `telemetry.js`、`screens.js`、`social.js` |
| 标题登录/解锁/反馈入口与底部文案 | `screens.js`、`cloudsave.js` |
| Toy 性能上报脚本 / 启动页脚 | `index.html` |

## 验收口径

- 标题无登录/解锁/反馈入口，无指定 B 站/Toy 文字。
- 首启不再出现协议窗口与玩家类型选择；新世界默认无教程。
- 公告吊牌/面板/自动弹出不存在，`js/news.js` 不再请求。
- 选项无遥测/制作人员/协议；遥测模块整体移除；结局 `CreditsScreen` 保留。
- 反馈无入口/面板/提交；举报仍可用。
- 控制台无 `ReferenceError`，`game.errLog` 为空。
- 单人创建/加载/保存、暂停菜单、衣柜、多人入口可用。
- 不提交；等待用户验收。
