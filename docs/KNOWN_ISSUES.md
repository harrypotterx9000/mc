# 已知问题（KNOWN_ISSUES）

> 只记录**已观察到**的问题与**明确的未知**；未测过的能力标 NOT TESTED。

## 运行 / 资源

| # | 问题 | 影响 | 状态 |
|---|---|---|---|
| K-01 | 音效包已补入：`js/sound_events.js` + `sounds/sfx/*`（4,849 个 m4a，43.2 MB） | 原版音效可用（未逐条试听） | **已解决** 2026-11-06 |
| K-02 | 加载时请求原作者房间服务 `xz.honghemc.cn:8443/api/news`、`/api/event` | 控制台 CORS/网络错误；不影响单机 | 已知；phase-01 删公告，phase-03 清账号/内容接口 |
| K-03 | 页面仍包含 Toy 性能上报脚本（head 内联） | 无父窗口时无害；将来清理 | 已知，phase-01/03 处理 |
| K-04 | `js/netconfig.js` 仍指向原作者房间服务 | 联机不可用（本阶段不需要） | 已知，phase-05 替换 |

## 游戏内容

| # | 问题 | 影响 | 状态 |
|---|---|---|---|
| K-05 | `end_city` / `monument` 结构无处理器，`/locate` 找不到 | 原版内容缺失 | 已确认（非本阶段目标） |
| K-06 | 末影龙躯体伤害为 `×0.25 + 1`，与原版纯 0.25 倍不同 | 躯体略耐打 | 已确认，待评估 |
| K-07 | 讲台/幽匿感测体/避雷针作为红石源无信号实现 | 红石行为缺失 | 已确认 |
| K-08 | 命令方块矿车只渲染不执行 | 红石/命令内容缺失 | 已确认 |

## 平台 / 多人

| # | 问题 | 影响 | 状态 |
|---|---|---|---|
| K-09 | 仓库内无服务器端代码 | 无法自建多人，需 phase-05 新写 | 已确认 |
| K-10 | 客户端解锁/伤害等为客户端声明 | 联机公平性风险 | 已在 PROJECT_SPEC 用服务端权威解决 |
| K-11 | 原 P2P 主机信任客人改动（无校验） | 联机作弊面 | 待 phase-05 处理 |

## 阶段 0 复核新增（改造前必须处理）

| # | 问题 | 影响 | 状态 |
|---|---|---|---|
| K-12 | `GAME_BUILD` 定义在 `js/telemetry.js:20`，被 `onboard.js:372/388/428/429` 直接使用 | 若先删遥测文件，首启/更新界面会 `ReferenceError` | 待 phase-01/03；阶段 1 保留遥测核心 |
| K-13 | `social.js:31` 直接引用 `FeedbackScreen` | 先删反馈面板会让聊天/举报内容检查 `ReferenceError` | phase-01 必须同步改 `social.js` |
| K-14 | `UnlockScreen` 被 `onlineGate()` 调用（`account.js:687-699`） | 阶段 1 删解锁界面会产生活引用 | phase-01 采用 **1-A**：删界面同时让 `onlineGate()` 直接放行（未实施） |
| K-15 | `account.js` 包装了 `RoomService.key/api` 与 `Game.saveSettings` | 删账号文件时若其他模块仍读 `Account` 会出错 | phase-03 逐文件迁移后最后删 |
| K-16 | `game.js:607` 提示“请双击启动游戏.bat”，仓库无此文件 | 用户按提示找不到启动器 | 待 phase-05/08 补启动脚本，或先改文案 |
| K-17 | `scripts/serve.mjs` 以项目根为静态根、`cache-control: no-store`、仅绑定 `127.0.0.1` | 阶段 5 若把存档放项目内会被下载；LAN/缓存不可用 | phase-04/05 改白名单、缓存、LAN 绑定 |
| K-18 | 无 `package.json`、无 `ws` 依赖 | 阶段 5 不能直接起 WebSocket 服务 | 已确认允许引入 `ws`（唯一依赖）；未实施 |
| K-19 | iOS Safari 的 Pointer Lock / Fullscreen 限制 | 手机端可能只能用触屏路径，不能锁定鼠标/全屏 | 未真机验证；phase-04 处理 |
| K-20 | 本地 `cloud` 元数据与 `mcjs-cloud-dirty-*` 保留 | 云存档删除后成为死数据；不能自动清理 | 按用户决策保留；每月手动/脚本清理一次（phase-06 写说明） |
| K-21 | 活动款装饰（企鹅/金苹果）与签到绑定 | 签到删除后装饰也要删除，不能只隐藏 | phase-02 暂开放；phase-03 随活动删除；最终只留普通 7 款 |
| K-22 | 主菜单“制作人员名单与致谢…”实际打开 `HelpScreen`，不是 `CreditsScreen` | 容易误删结局界面 | 只删 `screens.js:388` 选项行；`dims.js` 的 `CreditsScreen` 保留 |
| K-23 | `PROJECT_SPEC.md` §6 未列出“欢迎来到 OpusMC / 你是哪种玩家”删除 | 与用户阶段 1 新清单不一致 | phase-01 第一步更新 SPEC |
| K-24 | `PROJECT_SPEC.md` §11 仍写基线 `2798c08`，实际 HEAD `e49a54c`（仅文档） | 新会话可能误判 HEAD | 文档已同步；SPEC 待 phase-01 更新或注明 |
| K-25 | 阶段 1/2 的多人门槛边界 | 删解锁面板后，阶段 2 前多人仍可能弹旧登录/门槛 | 已确认 1-A：阶段 1 删界面并直接放行 |
| K-26 | 音效包 43.2 MB，静态服务器无缓存/压缩 | 首次加载与 LAN 传输慢 | phase-04 加缓存；不删内容 |

## 服务端 / 环境依赖

| 项 | 现状 |
|---|---|
| Node.js | 本机 **v26.13.0**；无 `package.json`；阶段 5 允许 `ws` 作为唯一依赖 |
| 服务器代码 | **不存在**；`server/` 仅 `.gitkeep` |
| 静态服务器 | `scripts/serve.mjs`，仅 `127.0.0.1`、GET/HEAD、无缓存 |
| 原版 Java 服务器/代理 | **不在仓库**；`NetClient` 仅保留作遗留直连功能 |
| 浏览器实测 | Edge 156 无头 + SwiftShader 启动/创建世界通过；真实 GPU、Android、iOS 未测 |
| 网络 | 阶段 8 先 LAN；HTTPS/WSS、NAT、公网未配置、未测试 |
| 数据目录 | 阶段 5 必须放静态根之外，且不能暴露管理接口 |

## 兼容性注意事项

- 单人存档 `mc-js-clone` 的 `worlds/chunks` 结构必须保持；旧世界要能继续读。
- 旧存档的 `meta.tutorial` 保留原值；**仅新世界**默认关教程（用户决策）。
- 删除账号前，皮肤/披风/装饰选择要先迁到浏览器本地；不能让 `skins/capes/cosmetics` 继续读 `Account.data`。
- `cloud` 元数据、`mcjs-cloud-dirty-*` 不主动删；每月清理前先备份。
- 管理员披风保持隐藏；普通 7 款 + 活动款按阶段 2/3 的时序处理。
- `p2p`/`net` 的 Monkey Patch 与 `DB` 拦截不能在未替换前直接删文件。

## 未测试（NOT TESTED）

- 电脑端 60 FPS / 手机端 30–60 FPS：**无真实设备测量**
- 手机/平板真机触控、横屏、安全区、发热、内存
- iOS Safari 的 Pointer Lock / Fullscreen / 音频解锁
- 长时间运行（>1 小时）内存与稳定性
- 多人（自建服务器）全部功能、LAN 双设备
- HTTPS/WSS、公网 NAT、反向代理
- 服务器存档备份/恢复演练
- 阶段 1–9 的任何代码改动（均未开始）
