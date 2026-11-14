# phase-09 完整验收 · 验收单（ACCEPTANCE）

- 日期：2026-11-14
- 验收对象：`develop` @ `b4c66a1`；被验收代码 = phase-08 `ef8c540`（仅 docs 差异）
- 自动化/本机结果：**256/256 PASS**；阶段回归 **184/184 PASS**
- 真机相关：**Android Chrome、iOS Safari、两台不同物理设备 = 本阶段 NOT TESTED**；
  **用户已决定接受 phase-08 的真实设备证据作为参考（代码相同，仅 docs 差异）**
- 当前状态：**带条件验收通过（用户 2026-11-14 确认）；docs 已提交并推送 `origin/opusmc-integration`
  （验收文档 `84f858d`）；代码未改；未合并**

> 验收决定（2026-11-14，用户确认）：
> 1. E/F 的真机项接受 phase-08 真实设备证据（LAN 手机 + 电脑、蜂窝手机 + 电脑），phase-09 本阶段
>    仍如实标 **NOT TESTED**，不写成本阶段真机通过；phase-08 未提供手机 OS/浏览器型号，因此不能据此
>    断言“Android Chrome 与 iOS Safari 各自通过”。
> 2. 旧房间服务入口/选项占位保留，记录为已知遗留，不在本阶段删除。
> 3. 验收通过后只提交 docs；随后按用户 2026-11-14 指令推送 `origin/opusmc-integration`（`84f858d`）；
>    未合并。

## A. 菜单

| 检查 | 结果 | 说明 |
|---|---|---|
| 主菜单公告面板/吊牌/未读角标/自动弹出已删除 | **PASS** | 无 `NewsBoard`/`NewsScreen`，`js/news.js` 不存在，页面不引用 |
| 「解锁披风和联机」面板已删除 | **PASS** | `UnlockScreen` 不存在；标题/多人无解锁入口 |
| 选项「遥测数据」「制作人员名单与致谢」「用户协议和隐私说明」已删除 | **PASS** | 四个浏览器逐屏打开选项及 4 个子页；无这些入口；`Telemetry` 不存在 |
| 主菜单指定 B 站/Toy 文字已删除 | **PASS** | 标题/帮助/首启文案无 B 站/Toy 文案 |
| 「反馈问题」面板已删除 | **PASS** | `FeedbackScreen` 不存在；举报仍可用（未改） |
| 登录/注册/账号资料/账号绑定界面与入口已删除 | **PASS** | 标题/选项/多人/暂停均无；全局符号 `undefined` |
| Bilibili / Toy 身份依赖已删除 | **PASS** | 无 `Toy.*` 调用、无 B 站登录/关注/三连/分享桥；无 B 站域名请求 |
| 首启「欢迎来到 OpusMC」协议窗口与「你是哪种玩家？」已删除 | **PASS** | 全新 profile 首启序列只有 `TitleScreen → QualityScreen` |
| 没有残留入口和无效交互 | **PASS（指定项）/ 附条件** | 指定项无残留。**非指定**的旧房间服务入口仍存在（见 A.1），不在本阶段删除 |

### A.1 非指定的遗留入口（记录，不在本阶段重构）

1. `MultiplayerScreen` 仍保留旧房间服务的公开房间列表、创建房间、我的房间、刷新、直接连接；
   本机打开时公开房间区域显示旧服务错误“不允许从这个网页访问”。**自建服务器入口不受影响**，
   这是 phase-05 起保留的旧路径（K-02/K-40/K-47/K-63/K-77）。
2. 选项里的 `联机…` 为禁用占位；`皮肤与装饰…`、`语言…`、`聊天设置…`、`资源包…` 显示“本复刻版暂不支持”。
   属既有占位（K-34），不是账号/解锁入口，点击不产生交互。
3. `social.js` 仍有 `[公告]` 聊天前缀；`NET_CONFIG.announce=false`，没有入口、定时器或请求（K-44）。

> 删除这些遗留需要改 `net.js`/`screens.js` 大段旧路径或改变 phase-03…08 的保留决定，超出“验收”范围；
> 已记录，等用户决定是否另立清理阶段。

## B. 账号

| 检查 | 结果 | 证据 |
|---|---|---|
| 没有 Bilibili 登录 | **PASS** | 无登录入口/`Account`/`Toy`；无 bilibili 域名请求（4 个浏览器网络审计） |
| 没有注册和登录 | **PASS** | 多人只有昵称；`fields=[name,code]`；无 password/email/account/login 字段 |
| 没有账号资料 | **PASS** | `welcome.you` 字段 `pid,name,token,owner,state`；玩家列表 `pid,name,owner,mode,look` |
| 没有账号绑定 | **PASS** | 无绑定界面/API；`/api/account`、`/api/profile`、`/api/auth` 404 |
| 没有账号式云存档 | **PASS** | 无 `/api/cloud`、`CloudSave`、`mcjs-account`/`mcjs-cloud-*` 读写；客户端 0 处云 endpoint |
| 没有 Toy 身份依赖 | **PASS** | 无 `Toy` 全局/调用；无 Toy/Bilibili 域名请求 |
| 服务端也没有账号路由 | **PASS** | `/api/cloud`、`/api/login`、`/api/register` 等 404；日志无账号字段 |

## C. 访客模式

| 检查 | 结果 | 证据 |
|---|---|---|
| 可以设置昵称 | **PASS** | 多人界面昵称输入；`mcjs-guest-name`；首启不强制 |
| 服务器分配临时玩家 ID | **PASS** | `p_` + 16 hex；创建/加入/重连均服务器签发 |
| 可以创建房间 | **PASS** | Chrome/Edge 两个独立客户端均可创建；8 位邀请码 |
| 可以使用邀请码加入房间 | **PASS** | 协议 + 浏览器 UI 均通过；同 seed |
| 多个昵称相同的玩家可以被正确区分 | **PASS** | `同名牌`/`同名牌2`，pid 不同，权限按 pid |
| 断线后按规则恢复或重新生成会话 | **PASS** | 窗口内 resume 同 pid + pstate；过期后新 join 新 pid；错误 token 拒绝 |
| 不依赖账号 | **PASS** | 清空/不写账号键仍可玩；协议 hello 只带昵称 |

## D. 存档

| 检查 | 结果 | 证据 |
|---|---|---|
| IndexedDB 本地世界正常 | **PASS** | `mc-js-clone`/`worlds`/`chunks`；创建/编辑/保存/刷新/重载/同名/删除 17/17 |
| 服务器多人世界正常 | **PASS** | `server/data/worlds/room-<code>/world.json`；seed+覆盖层；双客户端同步 |
| 浏览器刷新不会导致服务器世界丢失 | **PASS** | 刷新后 resume 同 pid；方块仍在；`world.json` 有方块 |
| 服务器重启后可以恢复世界 | **PASS** | 正常关闭/reload/新进程；`room_loaded`；方块仍在；两客户端重进 |
| 两类存档不会互相覆盖 | **PASS** | 同名本地世界 `w…` 与 `srv~<code>` 并存；`DB.getWorld(srv~)`/`chunkKeys` 空；服务器目录只有 `room-*` |
| 旧存档/旧云残留不被清理 | **PASS（既有边界）** | phase-06 已验收；本阶段未改格式，未删除残留 |

## E. 浏览器

| 浏览器 | 本机结果 | 说明 |
|---|---|---|
| Windows Chrome 157 | **PASS** | 29/29 UI；双客户端；60 FPS |
| Windows Edge 157 | **PASS** | 29/29 UI；双客户端；60 FPS |
| Android Chrome | **NOT TESTED（本阶段）** | 仅 Chromium Android UA + 视口模拟 29/29；触控/发热/电池未测。**用户接受 phase-08 真机证据**，但 phase-08 未提供 OS/浏览器型号，不能断言 Android Chrome 通过 |
| iOS Safari | **NOT TESTED（本阶段）** | 本机无 WebKit/Safari；只做 iOS UA/视口模拟 29/29（Chromium），**不能当作 Safari 通过**。**用户接受 phase-08 真机证据**，同样不能断言 iOS Safari 具体通过 |

## F. 多人游戏

| 检查 | 结果 | 说明 |
|---|---|---|
| 至少两个不同设备连接同一服务器 | **本阶段 NOT TESTED / 用户接受 phase-08 证据** | 本机实测为 **Chrome + Edge 两个独立浏览器进程**；phase-08 用户真实手机 + 电脑曾连同一服务器（E7UDCMQT/XF6BT4YQ），代码相同，作为参考证据 |
| 玩家移动 | **PASS（本机双进程）** | A 移动 +3 格，B mirror netPos 3.5；phase-08 真机亦报告移动通过 |
| 方块修改 | **PASS（本机双进程）** | 双向（stone/dirt）；phase-08 真机亦报告放置/破坏通过 |
| 世界状态 | **PASS（本机双进程）** | 同 seed、同房间时钟/天气、同方块覆盖层 |
| 退出和重新加入 | **PASS（本机双进程）** | 离开后房间保留；重新加入新会话；方块仍在 |
| 阶段 8 真实手机 LAN/蜂窝 | **参考证据（不是 phase-09 实测）** | 用户 2026-11-14 实测通过；phase-09 代码与 phase-08 相同（docs 差异），用户接受作为 phase-09 E/F 的参考 |

## G. 性能

| 设备/场景 | 真实数据 | 状态 |
|---|---|---|
| Windows Chrome 157 + AMD ANGLE D3D11，8 个固定场景 | **8/8 60 FPS**；GPU 5.58–15.31 ms；draw 187–2505 | **PASS（headless）** |
| Windows Edge 157，同场景 | **60.0 FPS**，601 帧/10 s，p95 16.8 ms | **PASS（headless）** |
| 手机视口 3120×1440（**模拟**，桌面 GPU） | 57.7/60.0 FPS；低画质+maxFps30 为 29 FPS | **PASS（模拟，不是真机）** |
| 服务器 2/5/10/30 连接 | 19.97–20.01 TPS；tick 0.14–0.71 ms；CPU 1.0–3.8%；RSS 61–65 MB | **PASS（本机机器人）** |
| 5 分钟长跑 | 平均 59.36 FPS，p5 56.1；heap 151–480 MB 锯齿，无单调增长 | **PASS（5 分钟）** |
| 真实手机/显示器/发热/电池 | — | **NOT TESTED（本阶段；用户接受 phase-08 参考）** |
| >1 小时连续运行 | — | **NOT TESTED** |

## H. 代码质量

| 检查 | 结果 |
|---|---|
| 未定义函数 | **PASS**：运行时 15 个关键补丁目标均为 function；全流程无 `ReferenceError` |
| 无效全局变量 | **PASS**：删除的 11 个全局符号均 `undefined`；没有恢复账号/Toy/Telemetry |
| 失效的事件监听 | **PASS**：window 27/document 13/canvas 3；无已删除屏幕/账号模块绑定 |
| 失效脚本引用 | **PASS**：87 个页面脚本 + 懒加载资源全部存在；88 个脚本资源加载成功 |
| 断裂的 Monkey Patch | **PASS**：20 组跨文件覆盖均有先前定义；运行时 15 个目标存在 |
| 无效 API 请求 | **PASS**：同源无 4xx/5xx；无账号/云请求；唯一外部请求是旧房间服务 |
| 资源加载错误 | **PASS**：同源资源失败 0；`js/sounds.js` 的 `file://` 分支不可达 |
| 控制台异常 | **PASS**：4 个浏览器 + 双客户端 + 质量流程 0 未捕获异常；`game.errLog` 空 |
| 长时间运行内存增长 | **PASS（5 分钟）**：heap 锯齿 151–480 MB，末 120 s 下降；mesh/arena 回落到 109/128 MB；>1 小时未测 |

## 总体验收结论

1. **A–D、H 本机通过**；E 的 Windows Chrome/Edge 通过；E 的 Android Chrome/iOS Safari 与
   F 的两台物理设备 **本阶段 NOT TESTED**，用户接受 phase-08 真实设备证据作为参考。
2. 阶段回归在验收提交上全部通过：**184/184**。
3. 本阶段没有修改任何功能代码（`js/`、`server/`、`index.html` 与 phase-08 `ef8c540` 相同），
   只新增/更新 phase-09 文档；没有发现需要立即修复的新缺陷。
4. 非指定的旧房间服务入口保留（K-02/K-34/K-44/K-63/K-77），用户确认“保留并记录为已知遗留”，
   不在本阶段删除。
5. **验收状态：带条件验收通过（用户 2026-11-14 确认）**。
   - 条件/边界：E 的 Android/iOS 真机、F 的两台物理设备、真实显示器/有头浏览器、手机发热/电池、
     >1 小时长跑、真实公网 Tunnel 本轮重跑 = **NOT TESTED**；phase-08 证据仅作参考，
     phase-08 未提供手机 OS/浏览器型号，不能写成“Android Chrome 与 iOS Safari 各自通过”。
   - 交付：phase-09 文档已提交并推送 `origin/opusmc-integration`（`84f858d`）；
     功能代码保持 phase-08 `ef8c540`；未合并。
