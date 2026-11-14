# phase-03 独立验收报告

- 日期：2026-11-12
- 范围：`develop` @ `73c8af5` 之上的 **未提交** phase-03 改动
- 状态：**独立验收已结束，用户已要求阶段交接；代码 `025cba8` 已提交并推送**
- 代码状态：验收期间**未修改源码**；只新增/更新验收与交接文档
- 工作区：`D:\ds\REA\opusmc`
- 环境：Windows；Node v26.13.0；Edge 157.0.4341.46 无头 + SwiftShader；CDP `127.0.0.1:9446`；静态服务器 `127.0.0.1:8080`；视口 1280×720，另有手机仿真 390×844 / 844×390
- 结论：**核心验收标准 10/10 PASS；自动化回归 68 PASS / 0 FAIL / 1 BLOCKED；另发现 1 个非阻断性 UI 缺陷（F-1，FAIL）。因存在 BLOCKED 项与未修复 UI 缺陷，不宣称 phase-03 完全验收通过，不进入 phase-04。**

## 1. 代码检查

### 1.1 文件清单（完整 Git Diff）

| 类别 | 文件 |
|---|---|
| 新增 | `js/guest.js`；`docs/phases/phase-03-guest-mode/PLAN.md`、`TEST_REPORT.md`、`HANDOFF.md`、`ACCEPTANCE.md` |
| 修改（源码/页面，15） | `index.html`、`js/ui.js`、`js/skins.js`、`js/capes.js`、`js/cosmetics.js`、`js/net.js`、`js/p2p.js`、`js/screens.js`、`js/onboard.js`、`js/social.js`、`js/mobile.js`、`js/extras.js`、`js/audio.js`、`js/perf.js`、`js/touch.js` |
| 修改（文档，8） | `docs/ARCHITECTURE.md`、`CHANGELOG.md`、`DECISIONS.md`、`KNOWN_ISSUES.md`、`PROJECT_SPEC.md`、`START-HERE.md`、`STATUS.md`、`docs/testing/regression-checklist.md` |
| 删除 | `js/account.js`、`js/toy.js`、`js/cloudsave.js`、`js/checkin.js`、`docs/phases/phase-03-guest-mode/.gitkeep` |

- `git diff --stat`（不含未跟踪文件）：28 个文件，+448 / −2111。
- `index.html`：88 → **85** 个脚本；`js/`：92 → **89** 个 `.js`。
- 顶层 class：206 → **194**；`*Screen`：77 → **66**。
- `git diff --check`：通过。

### 1.2 删除功能的调用入口

| 被删除功能 | 检查 | 结果 |
|---|---|---|
| `Account` 单例 / `Account.data` | 功能代码无 `Account.` 引用；运行期 `typeof Account === 'undefined'` | PASS |
| Bilibili 登录 / 识别码 / 关注 / 三连 | 无 `loginBili`、`Toy`、`/api/gate`；运行期无 Bilibili 请求 | PASS |
| 账号登录界面 / 资料界面 / 管理员 / 冻结名单 | `LoginScreen` / `AccountScreen` / `CodeLoginScreen` / `AdminScreen` / `FrozenScreen` 均为 `undefined` | PASS |
| 账号云存档 | `CloudSave` / `CloudScreen` 为 `undefined`；无 `/api/cloud`；世界列表无云端入口 | PASS |
| 云端冲突 / 云状态 / 云过期提示 | 随 `cloudsave.js` 删除；`Game.loadWorld`/`quitToTitle`/`startTitle`/`WorldListScreen` 的云包装均已消失 | PASS |
| 签到 | `Checkin` / `CheckinScreen` 为 `undefined`；标题、暂停无签到入口；无 `/api/event`、`/api/account/checkin` | PASS |
| 账号绑定状态 / 房间 token | `hello` / `host` / `join` 均无 token（本地 WS 实测） | PASS |
| Toy 身份 / 分享 / 二维码 / 容器模式 | `Toy` 为 `undefined`；邀请卡与照片界面无分享/二维码/相册入口；移动端无 Toy 容器桥 | PASS |
| 解锁判断 | `Account.has` / `Capes`/`Cosmetics` 账号拥有判定已无引用；23 披风 / 8 装饰 0 锁定 | PASS |
| 平台账号专属资源 | 无 `js/(toy|account|cloudsave|checkin).js` 请求；图片数据中未发现账号品牌资源 | PASS |

### 1.3 跨文件依赖

| 依赖 | 检查 | 结果 |
|---|---|---|
| `drawCard` | 唯一定义在 `js/ui.js`；调用方 `onboard.js`/`p2p.js`/`skins.js`/`social.js` | PASS |
| `GuestSession` | 唯一 `const` 定义；`netconfig.js` 后、`net.js` 前加载；`net`/`p2p`/`skins`/`cosmetics`/`mobile`/`extras`/`social` 运行时调用 | PASS |
| `Skins ↔ Capes ↔ Cosmetics` | 只读 `Skins.look()` / `Skins.mine()`；无 `Account.data.skin` 回退 | PASS |
| `NetClient ↔ RoomService` | 真实 `joinRoom` 通过本地 WS 服务器收到 `login.eid`；`hello` 无 token | PASS |
| `p2p ↔ GuestSession` | `LocalHost` 通过本地 WS 信令收到 `hosted`；P2P host 消息无 token | PASS |
| `save.js` / `DB` | 云存档对 `DB.putChunks` 的包装已移除；单人保存/刷新恢复通过 | PASS |
| `screens ↔ onboard ↔ mobile` | 标题/选项/暂停/首启重排正常；手机 stage 与触控布局正常 | PASS |

### 1.4 Monkey Patch 与包装顺序

| 方法 | 当前定义位置 | 结果 |
|---|---|---|
| `Game.tick` | capes、cmdrun、enchant、extras、items3（3 处）、mobs_animals、onboard、p2p、raids（2 处）、redstone，共 10 文件 / 13 处 | 与 phase-02 集合一致；未新增/删除包装 |
| `NetClient.onMessage` | cmdblock、extras（2）、net（8）、skins；共 4 文件 / 12 处 | `social.js` 的聊天内容检查包装已移除；其余顺序未变 |
| `NetClient.chat` | 仅 `net.js` | 社交内容检查包装已移除；原始聊天方法保留 |
| `Game.drawMob` | capes、mobitems（2）、mobs_animals、skins、vmobs，共 5 文件 / 6 处 | 未变 |
| `Game.useEquipment` | equip、items3、itemuse、vehicles，共 4 处 | 未变 |
| `Game.startTitle` | `net.js` → `onboard.js` | `cloudsave.js` 包装已移除；顺序 net → onboard 正确 |
| `Game.quitToTitle` | `p2p.js` | `cloudsave.js` 包装已移除 |
| `Game.loadWorld` | `cmdrun.js`/`extras.js`/`raids.js` | `cloudsave.js` 包装已移除 |
| `PauseScreen.layout` | `mobile.js`/`p2p.js` | `checkin.js` 的签到包装已移除 |
| `OptionsScreen.layout` | `controls.js`/`onboard.js` | 账号入口行删除；皮肤入口保留 |
| `DB.putChunks` | `p2p.js` | `cloudsave.js` 的云脏块包装已移除 |
| `UI.open` | `redstone.js` | 无 telemetry/账号包装 |
| `RoomService.key` / `api` | 仅 `net.js` 原始对象 | `account.js` 的 token/key 包装已移除 |
| `TitleScreen.layout` / `drawExtra`、`WorldListScreen.layout/drawExtra` | 无包装 | 云存档/签到/账号注入均已消失 |

### 1.5 全局变量与单例

| 符号 | 检查 | 结果 |
|---|---|---|
| `Account`、`Toy`、`CloudSave`、`Checkin` | 运行期类型 | 全部 `undefined` |
| `LoginScreen`、`AccountScreen`、`CodeLoginScreen`、`AdminScreen`、`FrozenScreen`、`ToyDiagScreen`、`CloudScreen`、`CloudConflictScreen`、`CheckinScreen` | 运行期类型 | 全部 `undefined` |
| `singleGate`、`onlineGate`、`g_netName`、`ACCOUNT_SETTINGS`、`textOk`、`Stage.inToy` | 静态引用 | 0 |
| `GuestSession` | 定义数 / 全局 | 1 个；`typeof === 'object'` |
| `RoomService` / `NetClient` / `Skins` / `Capes` / `Cosmetics` | 定义数 | 各 1 个，未被误删 |

### 1.6 事件监听器与资源

| 项 | 检查 | 结果 |
|---|---|---|
| Toy `window.message` 监听 | 随 `toy.js` 删除 | PASS |
| `FollowGateScreen` 的 `visibilitychange` / `focus` 监听 | 随 `account.js` 删除 | PASS |
| 云存档 `visibilitychange` / `setInterval` | 随 `cloudsave.js` 删除 | PASS |
| 新增页面关闭处理 | `social.js` 的 `pagehide`（关闭连接 + 保留重连提示） | PASS |
| 既有 `main.js` 保存 / `touch.js` 可见性监听 | 未改 | PASS |
| 页面脚本 | 85 个引用全部存在；`guest.js` 在 `net.js` 前；无删除文件引用 | PASS |
| 资源 | 无账号/Toy 资源引用；音效懒加载仍为 `sound_events.js` | PASS |

### 1.7 共用模块

| 共用模块 | 是否误删 | 结果 |
|---|---|---|
| `js/ui.js`（`drawCard`） | 否；从账号文件移入 | PASS |
| `js/net.js`（`RoomService`/`NetClient`） | 否；仅去 token/账号包装 | PASS |
| `js/save.js` / `DB` | 否；单人存档正常 | PASS |
| `js/skins.js` / `capes.js` / `cosmetics.js` | 否；外观正常 | PASS |
| `js/p2p.js` / `mobile.js` / `social.js` / `extras.js` / `screens.js` | 否；改用 `GuestSession` 或浏览器能力 | PASS |

## 2. 功能测试（阶段验收标准）

测试脚本（仓库外）：`_work/phase03-acceptance.mjs`、`phase03-acceptance-mobile.mjs`、`phase03-acceptance-net.mjs`、`phase03-acceptance-extra.mjs`、`phase03-acceptance-ttl.mjs`。
结果文件：`_work/phase03-acceptance-result.json`、`phase03-acceptance-mobile-result.json`、`phase03-acceptance-net-result.json`。

| 测试项目 | 测试方式 | 结果 | 证据 |
|---|---|---|---|
| 不出现登录界面 | 全新 profile 首启，驱动 Quality→Device→Differences→Title | **PASS** | 序列无 `LoginScreen`；`typeof LoginScreen === 'undefined'` |
| 不出现注册界面 | 全局类/入口扫描 + 首启/标题/选项 | **PASS** | 无注册类；无注册入口 |
| 不请求 Bilibili 登录接口 | CDP Network 全流程记录 | **PASS** | 无 bilibili/bilitoy URL |
| 不请求原账号 API | CDP Network 全流程记录 | **PASS** | 无 `/api/account`、`/api/cloud`、`/api/event`、`/api/gate`、`/api/checkin` |
| 可以直接进入单人游戏 | 从标题 `createWorld` 平地世界 | **PASS** | `state=play`；`acceptance-world`；170 区块 |
| 可以通过昵称加入多人游戏（客户端路径） | 真实 `Game.joinRoom` + 本地 WS 服务器 | **PASS** | `hello` 带昵称/房间/key、无 token；服务端 `eid=7` → `GuestSession.playerId=7` |
| 可以通过昵称加入多人游戏（原服务） | 尝试旧房间服务 `/api/public` | **BLOCKED** | `base=https://xz.honghemc.cn:8443`，返回「不允许从这个网页访问」 |
| 外观可以正常保存 | 衣柜改六项并保存 | **PASS** | `mcjs-look` 六项完整；提示「已保存在这台设备上」 |
| 刷新后外观恢复 | 重新加载页面 | **PASS** | 皮肤/披风/帽子/宠物/前缀完整恢复 |
| 不存在未定义的 `Account` | 运行期类型 + 全仓静态扫描 | **PASS** | `typeof Account === 'undefined'`；无 `Account.` 功能引用 |
| 没有账号模块残留的无效调用 | 0 未捕获异常 + 0 `errLog` + 符号扫描 | **PASS** | 68 项运行时检查无异常；`game.errLog=[]` |
| 活动款装饰不随签到删除 | 衣柜/披风/装饰枚举 | **PASS** | `penguin`/`penguinwalk`/`goldapple` 全部 true；8 装饰全部 true |
| 第一人称/第三人称外观 | `Skins.mine` + 渲染预览 | **PASS** | `skin/cape/hat/pet/pre` 全部从本地外观取得 |
| 单人存档 IndexedDB | 保存/刷新/世界列表 | **PASS** | `DB.listWorlds()` 含 `acceptance-world` |
| 无云端存档界面 | 世界列表/暂停/标题 | **PASS** | 无云端/账号入口 |
| 无签到界面 | 标题/暂停 | **PASS** | 无签到入口；`CheckinScreen` undefined |
| 无 Toy 分享/二维码 | 邀请卡、照片界面 | **PASS** | 仅「复制链接/复制邀请码」「保存图片」 |
| 页面关闭不抛异常 | 派发 `pagehide` | **PASS** | 无异常；会话回到 idle |

**主验收结果：47 PASS / 0 FAIL / 1 BLOCKED。**

## 3. 回归测试

| 测试项目 | 测试方式 | 结果 | 证据 |
|---|---|---|---|
| 首启完整流程 | Quality→Device→Differences→Title | PASS | 无登录；`onboarded=true` |
| 标题/选项/暂停 | 逐屏 `layout()` 与入口标签 | PASS | 无账号/登录/签到；皮肤入口保留 |
| 世界列表 | 打开 `WorldListScreen` | PASS | 无云端/账号；导入按钮保留 |
| 单人创建/进入 | `createWorld` 平地世界 | PASS | `play`、170 区块 |
| 游戏 tick 链 | 比较 `tickCount` | PASS | 5 → 36（约 1.3 s） |
| `saveSettings`（账号包装删除后） | 设 FOV=90 保存 | PASS | localStorage 读到 90 |
| 暂停菜单本地房间入口 | `PauseScreen.layout` | PASS | 有「开房间」；无签到 |
| 手机端启动 | 390×844 + 触控仿真 | PASS | `kind=phone`、触控对象存在、CSS 横屏 `rot=true` |
| 手机端横屏 | 844×390 | PASS | `Stage`/`UI` 尺寸正确，安全区 0 |
| 手机端进入世界/触控布局 | 手机创建世界 + `touch.layout()` | PASS | `play`；布局成功；暂停无账号/签到 |
| 真实 NetClient 加入 | 本地 WS 服务器 | PASS | `hello` 无 token；`login.eid` → GuestSession |
| P2P 主机信令 | 本地 WS 服务器 | PASS | `host` 无 token；`hosted` → GuestSession；关闭清理 |
| 照片界面 | `Photo.take` + `PhotoScreen.layout` | PASS | 仅保存/关闭；无 Toy 分享 |
| 页面关闭 | `pagehide` | PASS | 无异常；会话 idle |
| 重连 TTL | 过期 `mcjs-guest-resume` | PASS | 过期返回 null 并清除 |
| 外观/披风/装饰渲染 | 衣柜计数与预览 | PASS | 19/23/3/1/1；0 锁定 |

**回归合计：9（手机）+ 8（真实连接/P2P）+ 3（照片/关闭）+ 1（TTL）= 21 PASS。**

## 4. 发现的问题

| # | 问题 | 影响 | 分类 |
|---|---|---|---|
| F-1 | `MultiplayerScreen` 用「房主名 === 当前昵称」判断 `mine`；两名玩家可自选相同昵称。实测同名时满员房间显示「进入」且 `enabled=true`、`blue=true` | 仅为客户端 UI 误判；服务端应拒绝，且旧服务本身不可用 | **FAIL（非阻断，UI）**；需 phase-05 服务端唯一身份/所有权解决 |
| F-2 | 旧房间服务 `xz.honghemc.cn:8443` 返回 403/CORS，真实公开房间/邀请码加入不可测 | 真实联机不可用 | **BLOCKED** |
| F-3 | 实际断线重连握手未实现；只保存并校验了 5 分钟 `resumeInfo` | 短时间重连还没有端到端能力 | **BLOCKED**（需 phase-05 服务器会话） |
| F-4 | 真实 P2P 客人加入（WebRTC 双端）未测；只测了 P2P host 信令 | 客人侧本地房间未验证 | **BLOCKED** |
| F-5 | 本地 P2P 主机没有服务端 `eid`，`GuestSession.playerId` 是 provisional `local_...` | 主机身份不是服务器签发 | **NOT TESTED / 需 phase-05** |
| F-6 | `/api/skin`、管理员公告轮询、旧 `mcjs-room-key` 仍使用原服务 | 旧服务不可用时相关功能不可用 | **NOT TESTED**；K-36/K-44/K-45 |
| F-7 | 移除 Toy 容器后手机安全区为 0（刘海/胶囊不避让） | 手机 UI 可能贴近边缘 | **可推迟** phase-04 |
| F-8 | Toy 平台内容检查已移除；聊天/房间名/举报文本不再有客户端内容过滤 | 内容治理缺失 | **可推迟** phase-05 服务端 |

## 5. 最终结论

### 1. 已完成事项

- 账号、Bilibili 登录、Toy 身份、识别码、关注/三连、账号资料/API/绑定、账号云存档、签到、Toy 平台桥已删除。
- `GuestSession` 已建立：昵称、服务器临时 ID、房间、连接状态、5 分钟短期重连信息。
- 外观、披风、装饰、联机入口、P2P、页面关闭、照片、邀请卡、手机布局完成迁移。
- 89 个 JS 语法通过；85 个页面脚本；自动化运行时 **68 PASS / 0 FAIL / 1 BLOCKED**；另复现 1 个非阻断 UI 缺陷（F-1，FAIL）；主套件无未捕获异常、`errLog` 为空。

### 2. 未完成事项

- 真实房间服务加入与公开房间列表（BLOCKED）。
- 真实 P2P 客人连接（BLOCKED）。
- 实际断线重连握手与服务端临时 ID 签发/校验（BLOCKED，phase-05）。
- 本地 P2P 主机的服务器签发 ID（未测/phase-05）。
- `/api/skin`、管理员公告、旧 `mcjs-room-key` 替换（未测/phase-05）。
- 真实 GPU、手机/平板真机、长时间运行（NOT TESTED）。

### 3. 发现的问题

- F-1：同名昵称导致满员房间的客户端「是我的房间」误判（非阻断 UI，实测）。
- F-2～F-4：真实服务/重连/P2P 客人受限。
- F-5～F-8：本地 P2P ID、旧接口、手机安全区、内容检查的后续事项。

### 4. 必须修复的问题

- **本阶段客户端范围内无关键失败**。
- 若验收要求「真实房间可加入 + 实际短时重连 + 服务端唯一临时 ID」端到端成立，则 **F-2/F-3/F-4 必须在 phase-05 服务器完成后才能通过**，不能在本阶段宣称完成。
- F-1 建议在 phase-05 用服务端房间所有权/唯一玩家 ID 替代昵称推断；当前不阻断本阶段客户端验收。

### 5. 可以推迟的问题

- F-1（服务端身份/所有权）
- F-5（本地 P2P 主机临时 ID）
- F-6（`/api/skin`、管理员公告、旧 room key）
- F-7（手机安全区）
- F-8（服务端内容检查）
- 真实 GPU/真机/长时间运行

### 6. 是否满足阶段验收标准

- **阶段 3 的 10 项核心验收标准：满足（10/10 PASS）。** 账号系统移除、访客身份模块、外观本地保存、单人游戏、昵称加入路径、无 `Account`、无账号/云/B站请求、活动款保留均通过。
- **完整阶段验收：不满足/未完成。** 真实房间服务、真实 P2P 客人、实际断线重连与服务端签发 ID 为 BLOCKED，须 phase-05 承接；另有 F-1 同名昵称 UI 缺陷（FAIL，非阻断）。
- 因此：**不宣称 phase-03 完全验收通过，也不自动进入 phase-04**；用户已结束验收并要求阶段交接；本报告与 HANDOFF 记录 F-1、BLOCKED 项及后续 phase-05 前置条件。

---

### 证据索引

- 主验收：`D:\ds\REA\_work\phase03-acceptance-result.json`
- 手机回归：`D:\ds\REA\_work\phase03-acceptance-mobile-result.json`
- 真实连接/P2P：`D:\ds\REA\_work\phase03-acceptance-net-result.json`
- 截图：`D:\ds\REA\_work\phase03-accept-*.png`
- 复现脚本：`D:\ds\REA\_work\phase03-acceptance*.mjs`
- 静态检查：89 个 `node --check`、85 个脚本、`git diff --check` 通过
