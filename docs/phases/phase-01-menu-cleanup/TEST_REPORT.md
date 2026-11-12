# phase-01 测试报告（已完成，代码提交 `15154bd`）

- 日期：2026-11-06
- 结论：**通过本地静态与无头浏览器回归；真实 GPU/真机未测**
- 独立验收：**35 项 PASS，1 项 NOT TESTED，0 项 FAIL**
- 2026-11-12 补测：唯一 NOT TESTED（末影龙通关实际触发 `CreditsScreen`）已由 phase-02 真实流程 **8/8 PASS**；见 `docs/phases/phase-02-unlock-removal/TEST_REPORT.md` §7
- 代码状态：已提交，`develop` @ `15154bd`；文档收尾为当前 HEAD

## 环境

| 项 | 值 |
|---|---|
| 仓库 | `D:\Projects\OpusMC` |
| 服务 | `node scripts/serve.mjs`，`127.0.0.1:8080` |
| 浏览器 | Edge 156 无头 + SwiftShader（Vulkan 1.3.0，16 线程，16 GB） |
| Node | v26.13.0 |
| 视口 | 1280×720（截图 1254×627） |
| 配置 | 全新临时 profile；首启测试前清空 localStorage |

## 静态检查

| 检查 | 结果 |
|---|---|
| 全量 `node --check`（92 个 `.js`） | 通过 |
| `index.html` 脚本数 | 88 |
| 88 个脚本 HTTP 状态 | 全部 200 |
| `js/news.js` / `js/telemetry.js` 请求 | 无；直接访问 404 |
| `/api/telemetry` 请求 | 无 |
| 已删除标识引用扫描 | `AgreementScreen`、`PlayerKindScreen`、`LEGAL`、`playerKind`、`legalV`、`FeedbackScreen`、`postFeedback`、`feedbackShot`、`TelemetryScreen`、`Telemetry`、`UnlockScreen`、`UnlockSparks`、`NewsBoard`、`NewsScreen`、`allUnlocked`、`offlineBack` 均无残留 |
| `git diff --check` | 无空白错误 |

## 运行时测试

| 用例 | 期望 | 实测 |
|---|---|---|
| 首启（无设置） | 不出现协议/玩家类型；进入画质设置 | `QualityScreen`；两屏 `undefined` |
| 首启画质基准 | 标题世界就绪后开始，不卡死 | 标题世界约 8 s 就绪后进入 `detect`，约 16 s 到 `pick`；全程可响应 |
| 返回玩家 | 直接标题 | `TitleScreen` |
| 标题按钮 | 单人/多人/皮肤和装饰/选项/退出；无登录/解锁/反馈 | 通过 |
| 标题绘制文字 | 仅 `OpusMC` + 按钮 + splash | 通过，无 B 站/Toy/非官方文案 |
| 选项 | 无遥测/制作人员/协议；账号仍在 | 通过；选项 10 项 |
| 创建世界 | `play`，区块 > 0，新世界 tutorial=-1 | `play`，61 区块，`tutorial=-1` |
| 暂停菜单 | 无反馈；选项/说明/回标题正常 | 通过 |
| 多人入口 | `onlineGate` 放行，打开 `MultiplayerScreen` | 通过 |
| 衣柜 | 打开正常；披风页可绘制；无解锁面板 | `WardrobeScreen`，18 个控件 |
| 存档 | 创建的世界可列出 | `DB.listWorlds()` → `acceptance-world` |
| 账号界面（未登录） | 打开正常，无解锁按钮 | `AccountScreen`，按钮为登录/完成 |
| 遥测模块 | `Telemetry` undefined；无 telemetry 脚本/请求 | 通过 |
| 游戏说明 | 打开正常 | `HelpScreen` |
| `game.errLog` | 空 | 空 |
| 控制台 | 无 ReferenceError | 仅原版噪音：铜门贴图缺失、ReadPixels 性能警告 |

## 截图

- `D:\ds\REA\_work\phase01-after-firstrun.png`
- `D:\ds\REA\_work\phase01-title.png`
- `D:\ds\REA\_work\phase01-options.png`
- `D:\ds\REA\_work\phase01-pause.png`
- `D:\ds\REA\_work\phase01-wardrobe.png`
- 原始结果：`D:\ds\REA\_work\phase01-test-result.json`

## 未测试 / NOT TESTED

- 真实 GPU 60 FPS、手机 30/60 FPS
- Android/iOS 真机、触控、发热、内存
- 登录后的账号界面与解锁状态同步
- 签到活动（需原服务/账号）
- 末影龙通关后的 `CreditsScreen` 实机触发（**已由 phase-02 补测通过**）
- 多人服务器、LAN、HTTPS/WSS
- 长时间运行

## 已知噪音（非本阶段回归）

- `missing tile i_waxed_*_copper_door`（原版存在）
- SwiftShader `GPU stall due to ReadPixels`（画质基准设计使然）
- `favicon.ico` 404
