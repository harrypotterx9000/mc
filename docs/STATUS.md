# 项目状态（STATUS）

- 更新时间：2026-11-12
- 当前阶段：**phase-03 客户端改造完成，验收结束；代码已提交 `025cba8`，docs 收尾为当前 HEAD**
- 下一阶段：**phase-04 浏览器兼容**（未开始，需用户明确指令）
- 代码版本：`025cba8`（phase-03 代码）；docs 收尾为当前 HEAD
- 当前分支：`develop`（跟踪 `origin/opusmc-integration`；与远程同步）

## Git

| 项 | 值 |
|---|---|
| 仓库 | `D:\ds\REA\opusmc`（会话工作区；`D:\Projects\OpusMC` 未同步） |
| 当前分支 | `develop`（跟踪 `origin/opusmc-integration`；与远程同步） |
| HEAD | docs 收尾为当前 HEAD（见 `git log -1`）；phase-03 代码 `025cba8` |
| 代码基线 | `2798c08`；phase-01 `15154bd`；phase-02 `a9dc47b`；phase-03 `025cba8` |
| phase-03 改动 | 修改 15 个源码/页面文件；删除 4 个模块；新增 `js/guest.js`；新增 4 个阶段文档；**已提交 `025cba8`** |
| 工作区 | **干净**（代码与 docs 已提交；与远程同步） |
| 远程 | phase-03 代码 `025cba8` + docs 收尾已推送 `origin/opusmc-integration`；未合并、未强推、未打标签 |

> `D:\Projects\OpusMC` 仍是 phase-01 副本；如以那份为准，需要用户确认后单独同步，禁止直接覆盖。

## 整体状态

- **阶段**：phase-00/01/02 已完成；phase-03 客户端改造完成、验收结束、代码已提交 `025cba8`；phase-04 未开始。
- **身份**：没有账号、注册、登录、密码、邮箱、手机号、识别码、Bilibili 登录、Toy 身份。玩家只用昵称；临时玩家 ID 由服务器按房间会话分配。
- **访客会话**：新增 `GuestSession`（`js/guest.js`）：昵称、临时玩家 ID、房间 ID、连接状态、5 分钟短期重连信息；不做永久身份。
- **外观**：全部皮肤/披风/装饰仍直接可用；外观只保存在本设备 `mcjs-look`，不再同步账号；活动款（企鹅/金苹果等）**保留**。
- **多人**：标题「多人游戏」直接进入；昵称必填；邀请码/公开房间/直接连接/本地房间保留；不再发送账号 token。
- **云存档**：账号式云存档、云端存档界面、云冲突处理删除；单人存档继续 IndexedDB。
- **签到**：签到界面、`/api/account/checkin`、`/api/event` 删除；活动款装饰不随签到删除。
- **B站/Toy**：`js/toy.js` 删除；Toy 资料、关注/三连、内容检查、分享、二维码、容器模式、页面关闭桥全部移除。
- **代码规模**：`index.html` 加载 **85** 个脚本；`js/` **89** 个 `.js` + `emoji.webp`；顶层 class **194**、`*Screen` **66**。
- **验收状态**：客户端核心 10/10 PASS；自动化 **68 PASS / 0 FAIL / 1 BLOCKED**；另有 **1 个非阻断 UI FAIL（F-1，同名昵称满员房误判）**。真实房间、真实 P2P 客人、实际断线重连、服务端签发 ID 为 BLOCKED，留 phase-05。

## phase-03 客户端改造已完成（阶段验收已结束）

### 任务 1：清理账号系统

- 删除 `js/account.js`：`Account` 单例、B站登录、识别码、账号资料、管理员、冻结名单、`ToyDiagScreen`、`singleGate`/`FollowGateScreen`、`onlineGate`、账号设置同步、账号 token 注入。
- 删除 `js/toy.js`：`Toy` SDK、`ToyError`、mock 面板、关注/三连、内容检查、分享/二维码、容器模式、页面关闭事件。
- 删除 `js/cloudsave.js`：`CloudSave`、`CloudScreen`、`CloudConflictScreen`、云同步/下载/删除/冲突/过期提示。
- 删除 `js/checkin.js`：`Checkin`、`CheckinScreen`、签到入口与奖励领取。
- 删除标题账号按钮、选项「账号…」入口、首启登录步骤、账号相关文案。
- `drawCard` 从删除的 `account.js` 移到 `js/ui.js`，避免其他界面缺函数。

### 任务 2：访客身份模块

- 新增 `js/guest.js`，加载在 `netconfig.js` 与 `net.js` 之间。
- `name`：玩家自选，1–16 字符，去控制字符/引号；保存在 `mcjs-guest-name`，并镜像 `settings.netName`。
- `playerId`：远程房间的服务器分配（现有联机协议 `login.eid`）；本地 P2P 主机没有服务端 ID，只给 `local_...` 临时占位；未连服务器时 `serverAssigned=false`。
- `roomId`：`beginConnect` 设置，`leaveRoom` 清除。
- `connection`：`idle` / `connecting` / `connected` / `disconnected`。
- 短期重连：`sessionStorage` 的 `mcjs-guest-resume`，5 分钟；主动离开清除；仅作提示，不冒充服务器身份。

### 任务 3：原有功能迁移

| 文件 | 迁移 |
|---|---|
| `js/skins.js` | 删除账号外观接管与 `Account.update`；保留 `mcjs-look`；删除签到锁定分支；前缀预览用 `GuestSession.displayName` |
| `js/capes.js` | 删除 `Account.data.skin` 回退，只读 `Skins.look()` |
| `js/cosmetics.js` | 名字前缀识别用 `g.net.name` / `GuestSession.name` |
| `js/net.js` | `hello` 不再发送 token；昵称输入始终显示；`login.eid` 交给 `GuestSession`；连接/失败状态迁移；多人界面删除账号特权判断 |
| `js/p2p.js` | host/join 不再发送 token；昵称统一 `GuestSession`；本地房间连接状态迁移；删除 `onlineGate` |
| `js/screens.js` | 单人/多人直接放行；删除标题账号按钮与 Toy 退出分支 |
| `js/onboard.js` | 首启画质 → 设备 → 差异说明；删除登录步骤与账号选项；文案改为访客/本地存档 |
| `js/social.js` | 删除 Toy 内容检查/二维码/分享/页面关闭桥；保留邀请卡复制、管理员聊天公告；`pagehide` 离房 |
| `js/mobile.js` | 删除 Toy 容器模式/安全区桥；保留 CSS 横屏与触控 |
| `js/extras.js` | 照片条删除账号名/B站文案/二维码；保留保存图片 |

### 任务 4：账号式云存档

- 已删除；单人世界仍使用 IndexedDB `mc-js-clone`。
- 旧 `cloud` 元数据与 `mcjs-cloud-dirty-*` 不自动清理（K-20），作为死数据保留。

### 任务 5：测试

- 89 个 `.js` 全量 `node --check` 通过；`index.html` 85 个脚本；`git diff --check` 通过。
- 无头 Edge 157 + SwiftShader：核心运行时 **33/33 PASS**；首启流程 **1/1 PASS**；0 FAIL；`game.errLog` 为空；0 未捕获异常。
- 无 `/api/account`、`/api/cloud`、`/api/event`、`/api/gate`、`/api/checkin`、`/api/news` 请求；无 Bilibili/bilitoy 请求。
- 标题/选项/暂停/首启均无登录、注册、账号、识别码、签到入口。
- 昵称可中文、写入本地；加入参数正确；`GuestSession` 服务器 ID/短期重连信息/离房状态正确。
- 18 皮肤 + 23 披风 + 3 帽子 + 1 宠物 + 1 前缀全部可用、0 锁定；活动款披风与 8 个装饰保留。
- 游客保存外观 → 刷新恢复；单人世界创建/保存 → 刷新恢复。
- 截图/结果：`D:\ds\REA\_work\phase03-*`；详细：`docs/phases/phase-03-guest-mode/TEST_REPORT.md`。

### 独立验收（2026-11-12）

- 主验收 **47 PASS / 1 BLOCKED**；手机回归 **9 PASS**；真实连接/P2P 主机 **8 PASS**；照片/页面关闭 **3 PASS**；重连 TTL **1 PASS**；合计 **68 PASS / 0 FAIL / 1 BLOCKED**。
- 另发现 **1 个非阻断 UI FAIL（F-1）**：同名昵称时满员房间被客户端误判为「我的房间」；服务端身份/所有权留 phase-05。
- BLOCKED：旧房间服务 403、真实 P2P 客人、实际断线重连、服务端签发 ID（phase-05）。
- 报告：`docs/phases/phase-03-guest-mode/ACCEPTANCE.md`。
- 结论：**客户端核心 10/10 验收项通过；端到端联机/重连仍 BLOCKED，F-1 为非阻断 UI FAIL；代码已提交 `025cba8`，docs 收尾为当前 HEAD。**

## 已验证（phase-03）

| 测试 | 结果 |
|---|---|
| 启动直达标题 | PASS |
| 无账号/Toy/云/签到全局 | PASS |
| 无登录/账号界面类 | PASS |
| 无账号/云/B站请求 | PASS |
| 首启无登录步骤 | PASS |
| 多人昵称输入 | PASS |
| 加入传昵称/邀请码 | PASS |
| GuestSession 状态与短期重连信息 | PASS |
| 外观保存/刷新恢复 | PASS |
| 活动款保留 | PASS |
| 单人创建/保存/刷新 | PASS |
| 全量语法 | 89/89 PASS |
| 同名昵称房间所有权（F-1） | **FAIL（非阻断 UI）** |

## 未验证 / BLOCKED / NOT TESTED

- 真实房间服务加入、真实房间列表：原服务 `xz.honghemc.cn:8443` 本机 403/CORS（K-02/K-40）。
- 真实 P2P 本地房间双端互连（WebRTC 信令不可用；仅 P2P 主机信令用本地 WS 验证）。
- 真实服务器签发临时玩家 ID：现有协议用 `login.eid`；本地 P2P 主机仍是 provisional ID；phase-05 自建服务器需自行签发。
- 实际断线重连握手：**BLOCKED**；当前只验证了 5 分钟 `resumeInfo` 提示，端到端重连未实现。
- 两名玩家互看昵称/外观。
- 真实 GPU 60 FPS、手机/平板真机、触控、发热、长时间运行。
- 原服务 `/api/skin`、管理员全服公告轮询、旧 `mcjs-room-key`（保留，phase-05）。
- HTTPS/WSS、公网、备份恢复。

## 尚未完成的阶段

| 阶段 | 状态 | 内容 |
|---|---|---|
| phase-03 访客模式 | **客户端完成、验收结束；代码 `025cba8`；端到端 BLOCKED** | 删除账号/登录/Toy/云存档/签到；新增 GuestSession；外观本设备保存；真实房间/重连留 phase-05 |
| phase-04 浏览器 | 未开始 | 桌面/手机/平板兼容、触控、全屏、缓存与性能入口 |
| phase-05 服务器 | 未开始 | 自建服务器、房间/邀请码、服务端权威、临时玩家 ID、真实重连、多人存档 |
| phase-06 双存档 | 未开始 | 单人 IndexedDB 与多人服务器存档独立管理 |
| phase-07 性能 | 未开始 | 区块/Worker/GPU/内存/网络优化，真实设备测量 |
| phase-08 部署 | 未开始 | 先 LAN；HTTPS/WSS、公网、NAT 后续 |
| phase-09 验收 | 未开始 | 全阶段回归、真机与发布验收 |

## 待办（下一阶段前）

1. **已完成**：phase-03 代码 `025cba8` 与 docs 收尾均已提交并推送 `origin/opusmc-integration`；不要重写历史、不要强推。
2. 合并/PR 操作仍需用户确认；当前 PR #1 仍未合并。
3. phase-05 自建服务器必须：签发并校验临时玩家 ID；实现真实短时重连；处理 `/api/skin`、管理员公告、旧 `mcjs-room-key` 替换；实现服务端权威外观/移动/存档；解决 F-1 的房间所有权。
4. `D:\Projects\OpusMC` 未同步；如以那份为准，需要用户确认后单独同步。

## phase-02 历史（已完成并验收，代码 `a9dc47b`）

- 全部皮肤/披风/装饰（含 `adm*` 与活动款）开放；多人入口无门槛；邀请码保留。
- `mcjs-look` 本设备外观保存为 phase-03 访客模式保留了路径。
- 独立验收 35 项 PASS；末影龙结局 8/8 PASS；K-41 单独立项。

## phase-01 历史（已完成并验收，代码 `15154bd`）

- 删除首启两屏、公告面板、解锁面板、反馈面板、遥测、制作人员/协议入口；脚本 90 → 88；`js/` 94 → 92。
