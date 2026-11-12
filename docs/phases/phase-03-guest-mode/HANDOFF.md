# phase-03 彻底移除账号系统并建立访客模式 · 交接

- 状态：**客户端改造完成、验收结束、交接完成；代码与 docs 均已提交并推送**
- 日期：2026-11-12
- 工作区：`D:\ds\REA\opusmc`（会话工作区）
- 分支：`develop`（跟踪 `origin/opusmc-integration`；与远程同步）
- 基线：`73c8af5`（phase-02 docs 收尾）；phase-02 代码 `a9dc47b`
- 工作区：**干净**（代码与 docs 已提交/推送）
- 远程：已推送 `origin/opusmc-integration`

> 路径说明：`D:\Projects\OpusMC` 是 phase-01 同内容副本；phase-02/03 的改动只在
> `D:\ds\REA\opusmc`。如以 `D:\Projects\OpusMC` 为准，需要用户确认后单独同步，禁止直接覆盖。

## 1. 本阶段目标

1. 彻底移除账号系统：`Account`、Bilibili 登录、Toy 身份、B站 UID、关注/三连、解锁判断、账号 API、登录/资料界面、账号绑定、账号云存档、相关资源。
2. 建立最小访客身份：昵称、服务器临时玩家 ID、房间 ID、连接状态、短期重连信息；不做注册/登录/密码/邮箱/手机号/永久账号。
3. 迁移皮肤、披风、联机、P2P、云存档、界面等所有 `Account.data` / `Toy.*` / `CloudSave.*` / `Checkin.*` 调用方。
4. 删除账号式云存档；单人继续 IndexedDB。
5. 活动款装饰不随签到删除；保留 `mcjs-look`。
6. 不进入 phase-04；不提交；不扩大范围。

## 2. 实际完成

### 2.1 删除的模块

| 文件 | 行数 | 内容 |
|---|---|---|
| `js/account.js` | 510 | `Account`、`LoginScreen`、`CodeShowScreen`、`CodeLoginScreen`、`AccountScreen`、`FrozenScreen`、`AdminScreen`、`ToyDiagScreen`、`FollowGateScreen`、`singleGate`、`onlineGate`、`g_netName`、`ACCOUNT_SETTINGS`、`xhr`、`drawCard`/`drawIcon`、`RoomService`/`Game.saveSettings` 包装 |
| `js/toy.js` | 335 | B站 Toy SDK、`ToyError`、mock 面板、资料/关注/三连、内容检查、分享、二维码、容器模式、页面关闭事件 |
| `js/cloudsave.js` | 323 | `CloudSave`、云端存档界面、云冲突、云状态/过期提示、`DB.putChunks` 脏块记录、多个 Game/WorldList/Title 包装 |
| `js/checkin.js` | 566 | `Checkin`、`CheckinScreen`、`/api/account/checkin`、`/api/event`、奖励/穿戴、标题/暂停签到补丁 |

`index.html` 脚本 **88 → 85**；`js/` **92 → 89** 个 `.js`。`drawCard` 移到 `js/ui.js`。

### 2.2 新增 `js/guest.js`（`GuestSession`）

- 只负责：昵称、临时玩家 ID、房间 ID、连接状态、短期重连信息。
- 昵称：1–16 字符，去控制字符/引号；`localStorage` 的 `mcjs-guest-name`；镜像 `settings.netName`；首次可从旧 `settings.netName` 接管一次。
- 临时玩家 ID：`connected(id)` 只由网络层调用；远程房间来自旧协议 `login.eid`；本地 P2P 主机没有服务端 ID，只有 `local_...` 且 `serverAssigned=false`。
- 房间：`beginConnect(code)` 规范化并设置；`leaveRoom()` 清空。
- 连接：`idle` / `connecting` / `connected` / `disconnected`。
- 重连：`sessionStorage` 的 `mcjs-guest-resume`，5 分钟；`resumeInfo()` 只给提示，不自动认证；主动离开清除。
- 没有注册、登录、密码、邮箱、手机号、永久账号或用户资料数据库。

### 2.3 迁移的文件

| 文件 | 变更 |
|---|---|
| `index.html` | 删除 4 个脚本，新增 `guest.js`（netconfig 后、net 前）；加载条总数 85 |
| `js/ui.js` | 新增 `drawCard` |
| `js/skins.js` | 删除账号外观接管/`Account.update`/签到锁定分支；保留 `mcjs-look`；`GuestSession.displayName` 用于前缀预览；保存提示改为本设备 |
| `js/capes.js` | 删除 `Account.data.skin` 回退 |
| `js/cosmetics.js` | 名字前缀识别用 `g.net.name` / `GuestSession.name` |
| `js/net.js` | `hello` 无 token；昵称输入始终显示；`login.eid → GuestSession.connected`；`leaveServer(keepGuest)`；删除 `sup`/账号 `mine` 判断 |
| `js/p2p.js` | host/join 无 token；昵称统一 `GuestSession`；本地房间连接状态迁移；删除 `onlineGate` |
| `js/screens.js` | 单人/多人直接放行；删除标题账号按钮与 Toy 退出分支 |
| `js/onboard.js` | 首启画质 → 设备 → 差异说明；删除登录步骤与账号选项；文案改访客/本地存档 |
| `js/social.js` | 删除 Toy 内容检查/二维码/分享/页面关闭桥；保留邀请卡复制和管理员聊天公告；`pagehide` 离房 |
| `js/mobile.js` | 删除 Toy 容器/安全区桥；保留 CSS 横屏与触控 |
| `js/extras.js` | 照片条删除账号名/B站文案/二维码；保留保存图片 |
| `js/audio.js`、`js/perf.js`、`js/touch.js` | 清理旧平台注释 |

## 3. 关键实现细节

### 3.1 为什么先迁移再删除

- `account.js` 定义了 `drawCard`、`onlineGate`、`singleGate`、`RoomService`/`Game.saveSettings` 包装；直接删除会留下未定义函数。
- 处理顺序：`drawCard` 移 `ui.js` → 标题/选项/首启直接放行 → 网络/P2P 不再发 token → 外观去账号 → 最后删四个文件。
- 删除后运行时 `Account`/`Toy`/`CloudSave`/`Checkin` 均为 `undefined`，0 未捕获异常。

### 3.2 服务器临时 ID

- 现有旧房间协议在 `login` 消息里给 `eid`；`NetClient` 收到后调用 `GuestSession.connected(String(m.eid))`。
- 没有把 `GuestSession.playerId` 发回服务器，也没有用昵称当身份；客户端不能自称已认证。
- phase-05 自建服务器必须：连接时签发房间会话 ID、服务端保存昵称→ID、重连时校验、拒绝客户端自报 ID。

### 3.3 外观

- `Skins.look()` 只读本地 `mcjs-look`；`Skins.saveLook()` 只写本地。
- 多人 `look` 消息保留：`Skins.mine()` / `NetClient.onMessage('look')` 未改；但真实联机未测。
- 活动款披风（`penguin`/`penguinwalk`/`goldapple`）与 8 个装饰继续全部可用，签到删除不影响。

### 3.4 保留项

- 单人 IndexedDB `mc-js-clone`。
- 邀请码、公开房间列表、直接连接、本地 P2P 房间。
- 正版皮肤 `/api/skin`（不是账号 API；K-36）。
- 管理员聊天公告轮询 `/api/announce`（phase-01 明确保留；K-44）。
- 旧 `mcjs-room-key` 房间管理凭据（K-45）。
- 旧 `mcjs-account`、`cloud` 元数据、`mcjs-cloud-dirty-*` 不自动清理（K-20/K-46）。

## 4. 测试结果

- 静态：89 个 `.js` `node --check` 全过；`index.html` 85 个脚本；`git diff --check` 通过。
- 无头 Edge 157 + SwiftShader：核心 **33/33 PASS**；首启 **1/1 PASS**；0 FAIL；`game.errLog` 为空；0 未捕获异常。
- 无 `/api/account`、`/api/cloud`、`/api/event`、`/api/gate`、`/api/checkin`、`/api/news` 或 Bilibili 请求。
- `Account`/`Toy`/`CloudSave`/`Checkin`/`LoginScreen`/`AccountScreen` 均 `undefined`。
- 昵称可中文并本地保存；加入参数正确；`GuestSession` 服务器 ID/离房状态正确。
- 18 皮肤 + 23 披风 + 3 帽子 + 1 宠物 + 1 前缀全部可用、0 锁定；活动款与 8 装饰保留。
- 游客外观保存 → 刷新恢复；单人世界创建/保存 → 刷新恢复。
- 截图/结果：`D:\ds\REA\_work\phase03-*`；详细：同目录 `TEST_REPORT.md`。
- 独立验收：同目录 `ACCEPTANCE.md`；**68 PASS / 0 FAIL / 1 BLOCKED**（旧服务 403、真实 P2P 客人、实际重连），另有 **1 个非阻断 UI FAIL（F-1，同名昵称房间所有权）**；客户端核心 10/10 通过，端到端 phase-03 未宣称完成。

## 5. 关键决策

1. **整文件删除，不做空壳**：账号/Toy/云/签到不保留兼容层；需要的能力迁到浏览器或 phase-05 服务器。见 ADR-015。
2. **服务端权威临时 ID**：客户端只接收服务器 ID；本地 `local_...` 只作占位。phase-05 必须替换旧 `eid`。
3. **外观只在本设备**：保留 `mcjs-look`，删除账号同步；符合“无账号访客”定位。
4. **活动款不随签到删除**：用户明确要求；签到删除后活动款继续可用。
5. **多人房间能力不动**：邀请码/公开列表/直接连接/本地房间保留；只去掉账号 token 与账号特权。
6. **Toy 整体移除**：B站内容检查/分享/二维码/容器模式不再保留；内容检查归 phase-05 服务端。
7. **房间所有权不能用昵称推断**：同名昵称时客户端 `mine` 会误判满员房间（F-1/K-47）；phase-05 必须用服务端身份/所有权。
8. **提交与推送**：代码 `025cba8` 与 docs 收尾均已提交并推送；未强推。

## 6. 当前 Git

| 项 | 值 |
|---|---|
| 分支 | `develop`（跟踪 `origin/opusmc-integration`；与远程同步） |
| HEAD | docs 收尾为当前 HEAD（见 `git log -1`）；phase-03 代码 `025cba8` |
| phase-03 | **已提交 `025cba8`；代码与 docs 已推送** |
| 工作区 | **干净**；代码+docs 均已提交 |
| 远程 | 已推送 phase-03；未合并、未强推、未打标签 |

## 7. 下一阶段前置条件（phase-04）

1. 用户明确发送“执行阶段 4”；不得提前修改。
2. phase-03 代码已提交/推送；docs 收尾提交并推送；不要重写历史，不要强推。
3. phase-04 负责桌面/手机/平板兼容、触控、全屏、缓存与性能入口；不要重做账号/访客身份。
4. `GuestSession` 的昵称/连接状态可继续作为 UI 数据源；不要恢复 `Account`。
5. 真实联机/P2P/重连仍依赖 phase-05；phase-04 不要把旧房间服务 403 当作回归失败。
6. F-1（同名昵称房间所有权）和本地 P2P 主机 provisional ID 留给 phase-05 服务端身份处理。

## 8. 下一阶段需要特别检查的文件和依赖

| 文件/依赖 | 检查点 |
|---|---|
| `js/guest.js` | 唯一身份入口；不要把 `playerId` 发回服务器或当认证；phase-05 替换 ID 签发 |
| `js/net.js` / `js/p2p.js` | `hello`/`host`/`join` 无 token；`login.eid` 只用于 `GuestSession`；房间 key 仍是旧凭据 |
| `js/skins.js` / `js/capes.js` / `js/cosmetics.js` | 只读 `mcjs-look`；不要恢复账号回退；活动款保留 |
| `js/ui.js` | `drawCard` 已移到这里；其他界面依赖它 |
| `index.html` | 85 个脚本；`guest.js` 必须在 `net.js` 前；不要重新加 toy/account/cloudsave/checkin |
| `docs/KNOWN_ISSUES.md` | K-42…K-50、K-36/K-40、K-41 现状；phase-04 验收前复核 |
| `docs/PROJECT_SPEC.md` | §3 访客身份；§11.8 phase-03 约束 |
| `server/` | phase-05 才实现；现在仍是 `.gitkeep` |

## 9. 已知遗留

- 真实房间加入/P2P 互连未测（原服务 403/CORS）。
- phase-05 服务器尚未签发/校验自己的临时玩家 ID（K-42）；本地 P2P 主机仍是 provisional ID。
- 实际断线重连握手未实现，只有 5 分钟 `resumeInfo` 提示（K-50）。
- F-1：同名昵称时满员房间被客户端误判为「我的房间」（K-47）。
- `/api/skin`、管理员公告轮询、旧 `mcjs-room-key` 未替换（K-36/K-44/K-45）。
- 手机安全区在移除 Toy 容器后为 0（K-48）。
- 真实 GPU/手机/长时间运行未测。
- K-41 末地返回传送门问题仍未修（单独立项）。
