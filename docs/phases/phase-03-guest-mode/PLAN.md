# phase-03 彻底移除账号系统并建立访客模式 · 计划

- 状态：**客户端改造完成、验收结束；代码 `025cba8` 已提交并推送；docs 收尾为当前 HEAD；端到端联机/重连留 phase-05**
- 日期：2026-11-12
- 工作区：`D:\ds\REA\opusmc`
- 分支：`develop`（按用户约束不新建/切换/重置分支）
- 基线：`73c8af5`（phase-02 docs 收尾）；phase-02 代码 `a9dc47b`，已验收
- 用户指令：执行阶段 3；不新建注册/登录；不进入阶段 4；不提交、不推送

## 1. 目标

1. 删除账号、Bilibili 登录、Toy 身份、识别码、关注/三连、账号资料、账号 API、账号绑定状态。
2. 删除账号式云存档；单人存档继续使用 IndexedDB。
3. 新增最小访客会话模块 `GuestSession`：昵称、临时玩家 ID、房间 ID、连接状态、短期重连信息。
4. 迁移所有 `Account.data` / `Account.*` / `Toy.*` / `CloudSave.*` / `Checkin.*` 调用方。
5. 保留 `mcjs-look` 本设备外观保存；多人同步外观继续走现有 `look` 消息。
6. 活动款装饰（企鹅 / 金苹果等）**不随签到删除**，继续可用。

## 2. 删除清单

| 文件 | 理由 | 迁移 |
|---|---|---|
| `js/account.js` | 账号单例、登录、识别码、账号资料、管理员、Toy 诊断、`singleGate`/`onlineGate`、`ToyDiagScreen` | `drawCard` 移到 `ui.js`；`onlineGate`/`singleGate` 直接放行；账号按钮/选项入口删除 |
| `js/toy.js` | B站 Toy SDK：资料、关注、三连、内容检查、分享、二维码、容器模式、页面关闭 | 浏览器等价：复制链接/下载图片/`pagehide`；容器模式删除；内容检查由 phase-05 服务端负责 |
| `js/cloudsave.js` | 账号绑定云存档、云端存档界面、云冲突、云状态元数据 | 删除界面与同步；本地 `cloud` 元数据保留为死数据（K-20） |
| `js/checkin.js` | 签到活动（`/api/account/checkin`、`/api/event`） | 删除签到入口/界面/接口；活动款披风与装饰保留 |

同时删除 `index.html` 中四个 `<script>` 引用，并新增 `js/guest.js`；脚本数 88 → **85**（`js/` 92 → **89** 个 `.js`）。

## 3. 新增 `js/guest.js`（`GuestSession`）

加载位置：`netconfig.js` 之后、`net.js` 之前（`index.html` 第 117 个脚本位附近）。

职责（只做这些）：

- `name`：玩家自选昵称；去除控制字符/引号，1–16 字符；保存在 `localStorage` 的 `mcjs-guest-name`，并镜像到 `settings.netName`。
- `playerId`：**服务器分配的临时玩家 ID**。客户端只通过 `GuestSession.assign(id)` 接收；当前联机协议在 `NetClient` 收到 `login{m.eid}` 时调用。单人/尚未连服务器时只提供带 `provisional` 标记的本地随机 ID，明确不是权威身份。
- `roomId`：当前房间/邀请码；`enterRoom()` 设置，`leaveRoom()` 清除。
- `connection`：`idle` / `connecting` / `connected` / `disconnected`。
- 短期重连信息：`sessionStorage` 的 `mcjs-guest-resume`，记录房间、昵称、服务器 ID 与时间戳，5 分钟有效；只保存、不自动冒充服务器身份。页面关闭/刷新可读取；显式离开房间清除。
- **不包含**注册、登录、密码、邮箱、手机号、永久账号、账号数据库。

服务端权威边界：当前仓库还没有 phase-05 服务器；`m.eid` 是现有联机协议里服务端分配的实体 ID，先作为房间内临时 ID 的权威来源。phase-05 自建服务器时必须签发并校验自己的临时玩家 ID，客户端不得把本地 `provisional` ID 当作已认证身份。

## 4. 迁移清单

| 文件 | 迁移 |
|---|---|
| `js/skins.js` | 删除账号外观接管/`Account.update`；保留 `mcjs-look`、保存/刷新恢复、`look` 消息；锁定/签到分支删除；前缀预览用 `GuestSession.name` |
| `js/capes.js` | 删除 `Account.data.skin` 回退，只读 `Skins.look()` |
| `js/cosmetics.js` | 名字前缀识别用 `g.net.name` / `GuestSession.name` |
| `js/screens.js` | 删除标题账号按钮；单人/多人直接放行；`quitGame` 删 Toy 分支 |
| `js/onboard.js` | 首启画质 → 设备 → 差异说明，不再插登录；选项「账号…」入口删除；差异文案改成访客/本地存档 |
| `js/net.js` | `hello` 不再发送账号 token；多人界面始终显示昵称输入；删除 `sup`/`mine` 的账号判断；`login` 时把 `eid` 交给 `GuestSession`；连接状态迁移 |
| `js/p2p.js` | host/join 不再发送 token；昵称统一 `GuestSession`；本地房间连接状态迁移；删除 `onlineGate` 调用 |
| `js/social.js` | 删除 Toy 内容检查/二维码/分享/`onPageClose`；邀请卡保留复制链接/邀请码；用 `pagehide` 离开房间 |
| `js/mobile.js` | 删除 Toy 容器模式/安全区块；保留 CSS 横屏与触控 |
| `js/extras.js` | 照片条删 B站 文案/账号名/二维码；保留下载图片；分享按钮删除 |
| `js/ui.js` | 新增 `drawCard`（原 `account.js` 的公共绘图函数） |

## 5. 保留项

- 单人 IndexedDB `mc-js-clone` 存档结构。
- 本地外观 `mcjs-look`。
- 邀请码、公开房间列表、直接连接、本地 P2P 房间。
- 正版皮肤查询 `/api/skin`（不属于账号 API；phase-05 再决定）。
- 聊天里的管理员全服公告（phase-01 明确保留，与本阶段账号无关）。
- `mcjs-room-key` 房间管理凭据（浏览器本地房间凭据，不是玩家账号；phase-05 替换）。
- 旧 `mcjs-account`、`cloud` 元数据、`mcjs-cloud-dirty-*` 不自动删除（K-20/K-31）。

## 6. 测试计划

静态：

- 85 个脚本全部 `node --check`；`index.html` 脚本数 85；`git diff --check`。
- 全仓 `Account` / `Toy` / `CloudSave` / `Checkin` / `LoginScreen` / `/api/account` / `/api/cloud` 残留扫描为 0（注释与历史数据除外）。
- 无 `js_account.js` 等旧名文件；无新增账号 UI 类。

运行时（无头 Edge + SwiftShader，CDP）：

- 启动直达标题，不出现登录/注册/识别码/云存档/签到界面。
- 网络请求不含 `/api/account`、`/api/cloud`、`/api/event`、`/api/gate`、Bilibili/Toy 接口。
- 无 `Account`、`Toy`、`CloudSave`、`Checkin` 全局（未定义不抛错）。
- 单人：创建世界 → 进入 `play` → 保存/刷新恢复。
- 多人：多人界面显示昵称输入；改昵称后写入 `mcjs-guest-name`；模拟房间加入调用 `joinRoom`，`GuestSession.roomId` 正确；不发送 token。
- 外观：游客保存 → `mcjs-look` → 刷新恢复；披风/帽子/前缀仍可预览。
- 活动款：企鹅/金苹果披风、活动装饰仍可用。
- `game.errLog` 为空。

## 7. 文档

实现与测试后更新：`STATUS.md`、`ARCHITECTURE.md`、`DECISIONS.md`（ADR-015）、`CHANGELOG.md`、`KNOWN_ISSUES.md`、`PROJECT_SPEC.md` §11、`START-HERE.md`、本阶段 `TEST_REPORT.md`、`HANDOFF.md`。

## 8. 边界

- 不实现 phase-05 服务器；不新增注册/登录；不重写渲染、世界生成、红石等无关模块。
- 不提交、不推送；验收结束，等待用户提交指令。
- 未实测项标 NOT TESTED。
