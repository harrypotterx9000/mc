# phase-03 访客模式 · 测试报告

- 日期：2026-11-12
- 阶段：phase-03 彻底移除账号系统并建立访客模式
- 代码：phase-03 代码 `025cba8`（已提交并推送）；docs 收尾为当前 HEAD；基线 `73c8af5`
- 环境：Windows；Node v26.13.0；Edge 157.0.4341.46 无头 + SwiftShader；CDP `127.0.0.1:9445`；静态服务器 `node scripts/serve.mjs`（`127.0.0.1:8080`）
- 结论：**静态检查通过；核心运行时 33/33 PASS；首启流程 1/1 PASS；0 FAIL；`game.errLog` 为空；无未捕获 JS 异常。真实房间加入 / 真实 P2P 客人因原服务 403 为 BLOCKED（本报告只记录实现阶段）。**
- 独立验收：见同目录 `ACCEPTANCE.md`；**68 PASS / 0 FAIL / 1 BLOCKED + F-1 非阻断 UI FAIL**（同名昵称房间所有权）。

## 1. 静态检查

| 检查 | 结果 | 证据 |
|---|---|---|
| 全量语法 | **PASS** | `js/` **89** 个 `.js` 全部 `node --check` 通过 |
| 页面脚本数 | **PASS** | `index.html` **85** 个 `<script src="js/...">`（88 − 4 删除 + 1 新增 `guest.js`） |
| 删除文件 | **PASS** | `js/account.js`、`js/toy.js`、`js/cloudsave.js`、`js/checkin.js` 不存在 |
| 账号/云/签到/Toy 符号 | **PASS** | 运行时代码无 `Account`、`Toy`、`CloudSave`、`Checkin`、`LoginScreen`、`AccountScreen`、`singleGate`、`onlineGate`、`Stage.inToy`；仅注释与 `texts.js` 基础数据中有历史字样 |
| 账号/云 API | **PASS** | 运行时代码无 `/api/account`、`/api/cloud`、`/api/event`、`/api/gate`、`mcjs-account`、`token` 发送 |
| 旧文件引用 | **PASS** | `index.html` 不再引用 `toy.js` / `account.js` / `cloudsave.js` / `checkin.js` |
| 脚本引用完整性 | **PASS** | 页面 85 个脚本全部加载 200；`js/guest.js` 已加载；无 404 |
| 类/界面计数 | **PASS** | 顶层 `class` **194**（phase-02 206 − 12）；`*Screen` **66**（77 − 11） |
| 空白错误 | **PASS** | `git diff --check` 无输出 |

## 2. 运行时测试（无头 Edge + SwiftShader）

测试脚本（仓库外）：`D:\ds\REA\_work\phase03-test.mjs`、`phase03-onboard.mjs`；
结果：`D:\ds\REA\_work\phase03-test-result.json`、`phase03-onboard-result.json`。

### 2.1 启动与移除检查

| # | 检查 | 结果 | 实际 |
|---|---|---|---|
| 1 | 启动直达标题 | PASS | `state=title`、`TitleScreen` |
| 2 | `Account` / `Toy` / `CloudSave` / `Checkin` 不存在 | PASS | 均为 `undefined` |
| 3 | 登录/账号/识别码界面类不存在 | PASS | `LoginScreen` / `AccountScreen` / `CodeLoginScreen` 均为 `undefined` |
| 4 | `GuestSession` 存在且初始为 idle | PASS | `connection=idle`，昵称为空 |
| 5 | 未连服务器时只有临时本地 ID | PASS | `local_...`，`serverAssigned=false` |
| 6 | 启动 `errLog` 为空 | PASS | `[]` |
| 7 | 无 `/api/account`、`/api/cloud`、`/api/event`、`/api/gate`、`/api/checkin`、`/api/news` 请求 | PASS | 全流程 0 个匹配 |
| 8 | 无 Bilibili / bilitoy 请求 | PASS | 0 个 |
| 9 | 不再请求 `toy.js` / `account.js` / `cloudsave.js` / `checkin.js` | PASS | 0 个 |
| 10 | `guest.js` 已加载 | PASS | 请求记录中有 |

### 2.2 菜单与首启

| # | 检查 | 结果 | 实际 |
|---|---|---|---|
| 11 | 标题无账号/登录/识别码入口 | PASS | 标题只有单人/多人/皮肤和装饰/说明/选项/退出/全屏 |
| 12 | 选项无「账号…」入口 | PASS | 选项行无账号/登录/识别码 |
| 13 | 暂停菜单无签到/账号/登录 | PASS | 无 |
| 14 | 首启流程无登录界面 | PASS | `QualityScreen → DeviceScreen → DifferencesScreen → TitleScreen`；`LoginScreen`/`Account` 均 `undefined`；`onboarded=true` |

### 2.3 昵称与 GuestSession

| # | 检查 | 结果 | 实际 |
|---|---|---|---|
| 15 | 多人界面显示昵称输入 | PASS | 字段标签「昵称（1–16 个字符）」 |
| 16 | 多人界面无登录/账号文案 | PASS | 无 |
| 17 | 昵称可中文、写入本地 | PASS | `测试玩家`；`mcjs-guest-name`；`settings.netName` |
| 18 | 加入时传入昵称和邀请码 | PASS | `joinRoom('ABC123','测试玩家')`（stub 捕获） |
| 19 | `beginConnect` / `connected` 状态 | PASS | `connecting` → `connected`；房间 `ROOM01` |
| 20 | 服务器 ID 为权威 | PASS | `playerId=12345`、`serverAssigned=true` |
| 21 | 断开后保留短期重连信息 | PASS | 5 分钟内 `room/playerId/name`；`expiresIn=300000` |
| 22 | 主动离开清除身份与重连信息 | PASS | `room=''`、`idle`、`resume=null`、`serverAssigned=false` |

### 2.4 外观与活动款

| # | 检查 | 结果 | 实际 |
|---|---|---|---|
| 23 | 衣柜数量 | PASS | 19 皮肤（默认+18）、23 披风、3 帽子、1 宠物、1 前缀 |
| 24 | 全部可点、0 锁定 | PASS | 各页签 `locked=0` |
| 25 | 活动款披风仍可用 | PASS | `penguin` / `penguinwalk` / `goldapple` 全部 `unlocked=true` |
| 26 | 8 个装饰仍可用 | PASS | `Cosmetics.has()` 全部 true |
| 27 | 游客保存外观只写 `mcjs-look` | PASS | 皮肤/披风/帽子/宠物/前缀完整写入；无账号调用 |
| 28 | 保存提示 | PASS | 「已保存在这台设备上」；`dirty=false` |

### 2.5 单人、刷新与最终状态

| # | 检查 | 结果 | 实际 |
|---|---|---|---|
| 29 | 创建并进入单人世界 | PASS | `play`；`phase03-test`；116 区块（首次 121）；约 0.5 s |
| 30 | 单人存档写入 IndexedDB | PASS | `DB.listWorlds()` 含 `phase03-test` |
| 31 | 世界内 `errLog` 为空 | PASS | `[]` |
| 32 | 刷新后外观恢复 | PASS | 完整恢复 `mcjs-look` 六项 |
| 33 | 刷新后单人世界仍在 | PASS | `phase03-test` 仍在 |
| 34 | 刷新后仍无账号 | PASS | `Account=undefined`；昵称仍为 `测试玩家` |

### 2.6 截图

| 文件 | 内容 |
|---|---|
| `D:\ds\REA\_work\phase03-multiplayer.png` | 多人界面：昵称输入，无登录 |
| `D:\ds\REA\_work\phase03-wardrobe.png` | 衣柜：全部外观可选 |
| `D:\ds\REA\_work\phase03-world.png` | 单人世界进入 `play` |

## 3. 结果

- 自动化：**33 PASS / 0 FAIL**（`phase03-test-result.json`）
- 首启：**1 PASS / 0 FAIL**（`phase03-onboard-result.json`）
- `game.errLog`：最终为空
- 未捕获页面异常：0
- 控制台仅保留原版噪音（missing tile / favicon / SwiftShader ReadPixels 等），无账号/Toy 相关错误

## 4. 未验证 / BLOCKED / 独立验收发现

- 真实房间服务加入、真实 P2P 客人连接：原服务 `xz.honghemc.cn:8443` 本机 403/CORS（K-02/K-40/K-43）——**BLOCKED**。
- 实际断线重连握手：只验证 5 分钟 `resumeInfo` 提示；端到端重连未实现（K-50）——**BLOCKED**。
- 真实服务器签发临时玩家 ID：现有协议用 `login.eid`；本地 P2P 主机仍是 provisional（K-42）——**NOT TESTED / phase-05**。
- 两名玩家互看昵称/外观：无可用服务器——**NOT TESTED**。
- 真实 GPU / 手机 / 平板 / 触控 / 长时间运行 / 性能：未测。
- 原房间服务的 `/api/skin`、管理员全服公告轮询、旧 `mcjs-room-key`：保留但未改，属 phase-05。
- 同名昵称房间所有权（F-1）：独立验收发现并复现，非阻断 UI；phase-05 服务端身份解决（见 `ACCEPTANCE.md`）。
