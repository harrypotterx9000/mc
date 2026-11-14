# phase-09 完整验收 · 测试报告（TEST_REPORT）

- 日期：2026-11-14
- 仓库：`D:\ds\REA\opusmc`
- 分支：`develop`；HEAD `b4c66a1`；被验收代码 = phase-08 代码 `ef8c540`（`git diff ef8c540..HEAD` 只包含 docs）
- 环境：Windows 11（10.0.26200），Node.js v26.13.0，Chrome 157.0.8103.51，Edge 157.0.4341.46，
  GPU `ANGLE (AMD, AMD Radeon(TM) Graphics (0x00001638) Direct3D11 vs_5_0 ps_5_0, D3D11)`，16 线程
- 测试脚本与证据：`D:\ds\REA\phase09-work\`（仓库外，不提交）
- 结论：**自动化/本机验收 256/256 PASS；阶段回归 184/184 PASS**；真实手机、iOS Safari、
  两台不同物理设备在本阶段 **NOT TESTED**；用户 2026-11-14 决定接受 phase-08 真实设备证据作为参考，
  但仍不写成 phase-09 真机通过。

> 说明：本报告中的“移动端”除特别注明外都是 Chromium 的 UA/视口模拟，**不是真机**；
> `headless` 数据也不是用户显示器/真机数据。

## 1. 测试范围与方法

| 套件 | 脚本 | 内容 | 结果 |
|---|---|---|---|
| 静态审计 | `p09-static.mjs` | 脚本/资源/补丁/API/账号残留/存档前缀/node --check/git diff --check | **29/29 PASS** |
| 菜单与账号 UI | `p09-ui.mjs <kind>` | Chrome / Edge / Android UA / iOS UA 逐屏打开标题、选项、4 个子页、衣柜、帮助、多人、自建服务器、暂停菜单 | **各 29/29 PASS** |
| 会话协议 | `p09-session.mjs` | 昵称、临时 ID、邀请码、同名消歧、resume 窗口/过期、无账号字段、令牌不进日志 | **29/29 PASS** |
| 双客户端多人 | `p09-mp.mjs` | Chrome + Edge 两个独立浏览器进程；建房/加入/移动/双向方块/聊天/世界时间/离开重进/刷新恢复/服务器重启/双存档隔离 | **47/47 PASS** |
| 本地存档 | `p09-local.mjs` | 纯静态服务器（无 WebSocket）IndexedDB 创建/编辑/保存/刷新/重载/同名/删除/`srv~` 防线 | **17/17 PASS** |
| 代码质量 | `p09-quality.mjs` | 控制台/网络/资源/监听器/补丁存在性 + 3 分钟堆采样 | **18/18 PASS** |
| 阶段回归 | `phase05/06/08` 原套件 | 在验收提交上重跑 | **184/184 PASS** |
| 性能 | `perf-scenes` / `perf-mobile` / `phase07-server-perf` / `perf-long` / `p09-perf-browser` | 桌面固定场景、手机视口模拟、服务器机器人、5 分钟长跑、Chrome/Edge 同场景 | 见 §8 |

## 2. 静态审计（29/29）

- `index.html` **87** 个脚本，`js/` **91** 个 `.js`，`server/` **10** 个 `.mjs`；每个 `<script src>` 文件存在，
  无重复；加载顺序仍为 `platform` 第一、`guest` 在 `net` 前、`p2p` 在 `mp` 前。
- 懒加载资源 `chunk_worker.js` / `skins_data.js` / `vstates_data.js` / `sound_events.js` / `emoji.webp` 均存在。
- 已删除模块不存在：`account.js`、`toy.js`、`cloudsave.js`、`checkin.js`、`news.js`、`telemetry.js`；
  页面不引用它们。
- 删除后符号没有活引用：`Account` / `Toy` / `Telemetry` / `FeedbackScreen` / `UnlockScreen` /
  `NewsBoard` / `NewsScreen` / `AgreementScreen` / `PlayerKindScreen` / `CloudSave` / `Checkin`。
- 菜单/标题/提示文案没有禁词（公告/遥测/制作人员/用户协议/隐私/反馈/解锁/登录/注册/账号/B站/Toy/签到/云存档）；
  只有一处**休眠遗留**：`social.js` 的 `[公告]` 聊天前缀，`NET_CONFIG.announce=false` 时没有定时器/请求/入口（K-44）。
- 客户端无账号/云/登录 endpoint；服务端无账号/云/登录路由；服务端 `/api/cloud`、`/api/login`、
  `/api/register`、`/api/account`、`/api/profile`、`/api/auth` 均 404（见 §5）。
- 客户端唯一第三方地址是 `https://xz.honghemc.cn:8443`（旧房间服务，`netconfig.js`）；自建服务器路径不使用它（K-02/K-40/K-77）。
- 存储键：`mcjs-guest-name`、`mcjs-look`、`mcjs-settings`、`mcjs-mp-server`、`mcjs-mp-session` 等；
  没有 `mcjs-account` / `mcjs-cloud-*` / 签到键被读写。
- `save.js` 仍保留 `srv~` 第二层防线与 `w` 前缀世界 ID；`mp.js` 仍使用 `srv~<code>`。
- 跨文件补丁：共识别 **20** 组跨文件 `X.prototype.Y` 覆盖（含 `Game.tick` 11 个文件、`Player.hurt` 5 个），
  所有“包装型”补丁在其加载顺序之前都有被包装的方法；20 个组与 ARCHITECTURE §5 的补丁矩阵一致（新增方法单独计数）。
- 资源字面量全部指向存在的文件；唯一例外 `js/sounds.js` 只在 `file://` 分支使用，而 `Platform.fatal()`
  在启动时已阻断 `file://`（K-52），该分支不可达。
- 全量 `node --check`：91 JS + 10 server mjs + `scripts/serve.mjs` 全部 PASS；`git diff --check` PASS。

## 3. 菜单与账号 UI（A/B/E；每个浏览器 29/29）

四个 profile 均为全新（首次运行）：

| 浏览器 | 首启屏幕序列 | 标题五项 | 选项 4 个子页 | 衣柜/帮助/多人/暂停 | 删除的全局符号 | 异常/资源错误 |
|---|---|---|---|---|---|---|
| Chrome 157 | `TitleScreen → QualityScreen` | 通过 | 全部打开 | 全部通过 | 全部 `undefined` | 0 / 0 |
| Edge 157 | `TitleScreen → QualityScreen` | 通过 | 全部打开 | 全部通过 | 全部 `undefined` | 0 / 0 |
| Android UA 视口 | `TitleScreen → QualityScreen` | 通过 | 全部打开 | 全部通过 | 全部 `undefined` | 0 / 0 |
| iOS UA 视口 | `TitleScreen → QualityScreen` | 通过 | 全部打开 | 全部通过 | 全部 `undefined` | 0 / 0 |

- 首次运行只有“画质基准 → 设备选择 → 这个版本有什么不一样”，**没有**协议/隐私窗口，**没有**“你是哪种玩家”。
- 标题：单人游戏、多人游戏、皮肤和装饰、帮助图标、选项…、退出游戏、全屏图标；没有登录/解锁/公告/反馈。
- 选项：视场角、难度/联机…、皮肤与装饰…、声音…、视频设置…、控制…、语言…、聊天设置…、资源包…、
  辅助功能设置…、游戏提示；**没有**遥测数据、制作人员名单与致谢、用户协议和隐私说明。
- 衣柜：皮肤/披风/帽子/宠物/前缀，全部直接可用；没有解锁/账号文字。
- 多人：昵称输入（`fields = [name, code]`；没有 password/email/account/login 字段），
  昵称写入 `mcjs-guest-name`；没有账号/登录入口。
- 自建服务器页：`/healthz` 连通（version `phase-08`），文案明确“房间世界保存在服务器；与单人世界同名也不会互相覆盖”。
- 暂停菜单：没有账号/解锁入口。
- 全部 4 个浏览器：未捕获异常 0；同源 4xx/5xx 0；同源脚本/资源加载失败 0；单资源 >3 s 0；
  `game.errLog` 为空；唯一外部请求是打开旧多人界面时对 `xz.honghemc.cn:8443/api/public` 的请求（旧服务返回
  “不允许从这个网页访问”，见 §7 残留项）。

## 4. 访客会话协议（C；29/29）

| 检查 | 结果 |
|---|---|
| hello 只需要昵称，不需要账号令牌 | PASS |
| 临时 ID 格式 `p_` + 16 hex | PASS（示例 `p_1afe3b32f1c3bf25`） |
| 会话令牌随机、只回本人 | PASS（43 字符） |
| 邀请码 8 位、服务器生成 | PASS（示例 `PW82K3AU`） |
| `welcome.you` 无 account/email/password/profile 字段 | PASS（字段只有 `pid,name,token,owner,state`） |
| 第二个客户端凭邀请码加入同一房间/同一 seed | PASS |
| 两个不同临时 ID | PASS |
| 同名昵称消歧：`SameName` / `SameName2` | PASS |
| 玩家列表名字不同；权限看服务器 ID，不看昵称 | PASS（creator owner=true，joiner false） |
| 玩家列表无 account/token/profile 字段 | PASS（`pid,name,owner,mode,look`） |
| 昵称清洗（控制字符/尖括号/引号） | PASS（`"  <b>A\0  "` → `bA`） |
| 断线后窗口内 resume 同一临时 ID | PASS（`resumed:true`，pid 不变） |
| resume 恢复 pstate（health/pos） | PASS（health 15，pos `[1,80,1]`） |
| 错误令牌不能接管会话 | PASS（error：恢复信息已过期） |
| 超过 `resumeSeconds` 后 resume 被拒 | PASS |
| 过期后重新加入生成新会话/新临时 ID | PASS（旧 `p_1afe…` → 新 `p_4bbd…`） |
| 房间与世界在会话过期后仍存在 | PASS（同一 code、seed 777） |
| 服务端日志不含会话令牌/账号字段 | PASS（7876 B 日志，token 未出现） |
| 六个账号/云 endpoint 均 404 | PASS |

## 5. 双客户端多人 + 双存档（C/D/F；47/47）

拓扑：本机同一服务器（`127.0.0.1:18150`），**Chrome 157** + **Edge 157** 两个独立浏览器进程/独立 profile。

| 检查 | 结果 |
|---|---|
| 两个浏览器从同一服务器加载页面 | PASS（UA 分别为 Chrome/Edge） |
| 创建者获得邀请码/临时 ID、成为房主 | PASS（`HSK6VHX7`，`p_3389…`，owner=true） |
| 创建者世界 `srv~<code>`、seed 424242 | PASS |
| WS 为同源 `ws://127.0.0.1:18150/ws` | PASS |
| 邀请链接 `http://127.0.0.1:18150/?room=<code>&server=1` | PASS |
| 访客会话由服务器分配（`GuestSession.serverAssigned`） | PASS |
| 第二客户端凭邀请码加入同一房间/同一 seed | PASS |
| 两个不同临时 ID | PASS |
| 同名昵称消歧为 `同名牌` / `同名牌2` | PASS |
| 两个客户端都看到 2 名玩家且名字不同 | PASS |
| 仅创建者是房主 | PASS |
| 玩家移动（+3 格）同步到另一客户端 | PASS（mirror netPos 3.5） |
| 创建者改方块 → 加入者看到 | PASS（stone=1） |
| 加入者改方块 → 创建者看到 | PASS（dirt=2） |
| 世界时间/天气一致 | PASS（time 7120/7120） |
| 聊天同步 | PASS |
| 玩家离开后房间保留（1 人在线） | PASS |
| 凭邀请码重新加入，新临时会话 | PASS（新 pid，同昵称 `同名牌2`） |
| 重新加入后服务器世界仍有方块 | PASS |
| 浏览器刷新保留 sessionStorage 恢复提示 | PASS |
| 刷新后“继续上次的房间”恢复同一临时 ID | PASS（pid 不变） |
| 刷新后服务器世界仍有方块 | PASS |
| 服务器写 `world.json`（`closed:false`） | PASS |
| 方块进入磁盘 `world.json` | PASS |
| 服务器正常关闭（exit 0） | PASS |
| 重启后加载持久化房间（`rooms:1`，日志 `room_loaded`） | PASS |
| 重启后世界文件仍有方块 | PASS |
| 两个客户端重启后重新进入同一房间 | PASS |
| 重启后方块仍在 | PASS |
| 本地世界 ID `w…`、名字与房间同名 | PASS（`wmwg2uqwl1xa6`） |
| 单人列表不含 `srv~` | PASS |
| `DB.getWorld('srv~code')` 为空 | PASS |
| `DB.chunkKeys('srv~code')` 为空（Set.size 0） | PASS |
| 本地世界有自己的区块 | PASS（1 个） |
| 服务器数据目录只有 `room-<code>` | PASS（`room-TMXS6E26`） |
| 本地世界名没有在服务器数据中生成文件 | PASS |
| 保存同名本地世界没有覆盖服务器世界 | PASS |
| 两个客户端未捕获异常 0，`game.errLog` 空 | PASS |
| 没有创建账号键 | PASS（`mcjs-guest-name`/`mcjs-mp-server`/`mcjs-settings`） |

> 本次是两个**浏览器进程**（Chrome/Edge）连接同一服务器，不是两台物理设备。
> 不同物理设备的实测见 §9（本阶段 NOT TESTED；用户 2026-11-14 接受 phase-08 真实设备证据作为参考）。

## 6. 本地存档（D；17/17，纯静态服务器）

| 检查 | 结果 |
|---|---|
| 静态服务器（`scripts/serve.mjs`，无 WebSocket）可加载页面 | PASS |
| 页面没有建立任何 WebSocket | PASS（`wsUrls=[]`） |
| 存档后端是 IndexedDB（`mc-js-clone`），不是内存/localStorage 回退 | PASS |
| 新世界 `w` 前缀唯一 ID | PASS |
| 保存写入 meta + chunks | PASS（chunks=1） |
| 浏览器刷新后世界仍在列表 | PASS |
| 刷新 + 重载后方块恢复 | PASS（block 5） |
| 放置方块后立刻刷新，方块仍在 | PASS（block 7） |
| 同名第二个世界 ID 不同、两个都列出 | PASS |
| 删除一个同名世界，另一个与区块不受影响 | PASS |
| `putWorld/getWorld/chunkKeys` 忽略 `srv~` | PASS |
| 无账号/云键；无异常；`game.errLog` 空 | PASS |

## 7. 代码质量（H；18/18）

| 检查 | 结果 |
|---|---|
| 完整流程（标题→选项→衣柜→帮助→多人→建房→40 次方块编辑→暂停→F3→保存→退出→刷新→重载）无未捕获异常 | PASS |
| `game.errLog` 空 | PASS |
| 同源 4xx/5xx 0；同源资源加载失败 0 | PASS |
| 唯一外部请求是旧房间列表（旧服务拒绝，见残留项） | PASS |
| 无账号/云 API 调用 | PASS |
| 88 个脚本资源全部加载；单资源 < 3 s | PASS |
| 事件监听器：window 27、document 13、canvas 3；没有绑定到已删除屏幕/账号模块 | PASS |
| 15 个补丁目标/类在运行时都是 function | PASS |
| 3 分钟堆采样（9 点，160 s） | PASS：242.2 MB → 108.9 MB（GC 后）；末段 4 点波动 6.7 MB；chunk 数据 4.7 MB、mesh 3.6 MB |
| 3 分钟持续移动/流式加载无异常/无 `errLog` | PASS |

未定义函数/无效全局/失效监听/失效脚本引用/断裂 Monkey Patch 的静态检查见 §2；
运行时没有出现 `ReferenceError`/`TypeError`（4 个浏览器 + 两客户端 + 静态页 + 质量流程）。

## 8. 性能（G）

### 8.1 桌面固定场景（headless Chrome 157 + 真实 ANGLE/D3D11 AMD 核显；maxFps=60）

| 场景 | FPS | 平均 | p95 | GPU ms | draw calls | 实体 | JS heap MB |
|---|---|---|---|---|---|---|---|
| 01 普通地形 | **60.0** | 16.67 | 16.8 | 5.58 | 208 | 0 | 147 |
| 02 大型建筑 | **60.0** | 16.67 | 16.8 | 7.14 | 187 | 4 | 127 |
| 03 240 实体 | **60.0** | 16.67 | 16.8 | 7.60 | 2086 | 245 | 133 |
| 04 战斗 | **60.0** | 16.67 | 16.8 | 7.68 | 2081 | 245 | 151 |
| 05 光影 1 | **60.0** | 16.67 | 16.8 | 11.91 | 2315 | 245 | 152 |
| 05 光影 2 | **60.0** | 16.67 | 16.8 | 13.06 | 2444 | 252 | 139 |
| 05 光影 3 | **60.0** | 16.67 | 16.8 | 14.64 | 2473 | 252 | 149 |
| 05 光影 4 | **60.0** | 16.67 | 16.8 | 15.31 | 2505 | 260 | 136 |
| 动态分辨率（dyn3） | **60.0** | — | 16.7 | — | — | — | — |

- 8/8 固定场景 60 FPS；光影 4 GPU 15.31 ms（目标 16.67 ms），没有超过。
- 与 phase-07 的差异：本轮没有出现光影 3/4 的 59.8/57.1 边际波动；单轮数据，不外推所有轮次。

### 8.2 Chrome 与 Edge 同场景（headless=new，真实 GPU，10 s 采样）

| 浏览器 | 场景 | 帧数 | FPS | p95 | max | 主线程 CPU | 区块 | 渲染 | canvas |
|---|---|---|---|---|---|---|---|---|---|
| Chrome 157 | 新普通世界 seed 424242，renderDist 8，光影 0 | 600 | **60.0** | 16.8 | 20.9 | 2.18 ms | 0.22 | 1.31 | 1262×624 |
| Edge 157 | 同一世界/设置 | 601 | **60.0** | 16.8 | 16.8 | 2.19 ms | 0.20 | 1.32 | 1254×593 |

- 两个浏览器 GPU 均为 `ANGLE (AMD, AMD Radeon(TM) Graphics … D3D11)`；`PerfMon.measure` 未拿到 GPU timer（`gpuAvg=null`），
  固定场景的 GPU 数据来自 `perf-scenes` 的查询。

### 8.3 手机视口模拟（3120×1440，Android UA；**不是真机**，GPU 仍是桌面 AMD）

| 场景 | FPS | p95 | GPU ms | draw | 分辨率/缩放 | 实体 |
|---|---|---|---|---|---|---|
| 240 实体，静态 | **57.7** | 25.0 | 14.66 | 2283 | 2496×1152 / 0.8 | 240 |
| 动态分辨率稳定后 | **60.0** | 16.8 | 14.39 | 2439 | 2184×1007 / 0.7 | 260 |
| 低画质 + maxFps=30 | **29.0** | 49.0 | 10.31 | 1987 | 2340×1080 / 1.0 | 259 |

### 8.4 服务器（本机机器人，真实 Node 进程）

| 玩家/房间 | 连接 | TPS 平均/最低 | tick 平均/最大 | CPU 平均/最大 | RSS 最大 | RTT p95 | 接收 |
|---|---|---|---|---|---|---|---|
| 2 / 1 | 2 | **19.97 / 19.91** | 0.14 / 0.57 ms | 1.0 / 4.6 % | 64.6 MB | 1.27 ms | 87 KB |
| 5 / 1 | 5 | **20.01 / 19.96** | 0.18 / 0.64 ms | 1.2 / 4.5 % | 61.9 MB | 0.81 ms | 487 KB |
| 10 / 1（40 编辑/人） | 10 | **20.01 / 19.96** | 0.28 / 1.05 ms | 1.5 / 6.2 % | 61.5 MB | 1.11 ms | 2.6 MB |
| 10×3（40 编辑/人） | 30 | **19.99 / 19.98** | 0.71 / 1.73 ms | 3.8 / 14 % | 64.5 MB | 1.57 ms | 7.8 MB |

### 8.5 5 分钟长跑（headless Chrome，普通地形，持续飞行/流式加载）

- 平均 **59.36 FPS**，p5 **56.1**，p50 60，最低 45，最高 64.7。
- JS heap：起始 179 MB，结束 254 MB，区间 151–480 MB；末 120 s 从 348 MB 降到 254 MB，**没有单调增长**（GC 锯齿）。
- mesh/arena：16.5 MB → 109 MB（结束），峰值 260 MB，结束时 arena 128 MB（22→16 页后回落到 16 页）。
- 已加载区块 314–341，sections 最高 4409；动态分辨率最低 0.6，结束回到 1.0。
- **>1 小时、真实手机会热/电池、真实显示器仍未测**。

## 9. 阶段回归（验收提交上重跑）

| 套件 | 结果 | 证据 |
|---|---|---|
| phase-05 服务端集成 | **62/62 PASS** | `p05server.log`、`phase05-test-*/` |
| phase-05 双浏览器 E2E | **18/18 PASS** | `p09-reg-phase05-browser.log` |
| phase-05 单人回归 | **6/6 PASS** | `p09-reg-phase05-sp.log` |
| phase-06 服务端双存档 | **22/22 PASS** | `p06server.log` |
| phase-06 浏览器双存档 | **31/31 PASS** | `p09-reg-phase06-browser.log` |
| phase-08 LAN 协议（同源 22 项） | **22/22 PASS** | `p09-reg-phase08-net.log` |
| phase-08 LAN 双浏览器 | **15/15 PASS** | `p09-reg-phase08-browser.log` |
| phase-08 邀请链接一致性 | **8/8 PASS** | `p09-reg-phase08-invite.log` |
| 合计 | **184/184 PASS** | `p09-regressions-summary.txt` |

- LAN 回归使用 `0.0.0.0:18110` + `http://192.168.1.18:18110/`；公网 Cloudflare Tunnel 未在本轮重跑
  （phase-08 已验收；quick tunnel 地址已失效，不属于固定环境）。
- 回归期间临时服务器/数据目录均在 `phase09-work/`，没有写入仓库 `server/data`。

## 10. 证据与限制

- 证据目录：`D:\ds\REA\phase09-work\`；主要文件：
  - `p09-static-result.json`、`p09-session-result.json`、`p09-mp-result.json`、`p09-local-result.json`、
    `p09-quality-result.json`；
  - `phase09-ui-{chrome,edge,android,ios}-result.json` + 截图；
  - `p05server.log`、`p06server.log`、`p09-reg-*.log`、`p09-regressions-summary.txt`；
  - `phase07-scenes/`、`phase07-mobile/`、`phase07-server/`、`phase07-long/`、`p09-perf-{chrome,edge}.json`。
- 环境限制：
  - 桌面数据来自 headless Chrome/Edge，不是用户显示器/有头窗口。
  - 手机数据来自 Chromium UA/视口模拟 + 桌面 GPU；**Android Chrome / iOS Safari 真机未测**。
  - 双客户端测试是同一台 Windows 上的两个浏览器进程；**两台不同物理设备未测**。
  - 服务器为临时本机实例；公网 Tunnel 未在本轮重跑。
  - 5 分钟长跑，不是 >1 小时；未测发热/电池。
- 会话令牌在证据中已脱敏（只保留 `hasToken`/长度）；服务端日志本身不记录令牌。

## 11. 本轮发现的问题

本轮**没有发现需要修改代码的新缺陷**。确认存在的遗留/边界：

1. **旧多人界面残留入口**：`MultiplayerScreen` 仍显示公开房间/创建房间/我的房间/刷新/直接连接；
   本机点击公开房间区域会看到旧服务错误“不允许从这个网页访问”。自建服务器路径不受影响。
   属 K-02/K-40/K-63/K-77，phase-09 未删除（不属“指定删除项”，删除需要改 `net.js` 大段旧路径）。
2. **选项里的禁用占位**：`联机…` 不可点击；`皮肤与装饰…`、`语言…`、`聊天设置…`、`资源包…` 显示
   “本复刻版暂不支持”。属 K-34/既有占位，不是账号/解锁入口。
3. **休眠公告前缀**：`social.js` 的 `[公告]`；`NET_CONFIG.announce=false`，无入口/定时器/请求（K-44）。
4. **`js/sounds.js`**：只在 `file://` 分支引用，`file://` 启动即被阻断，不可达（K-52）。
5. **headless 双浏览器 + SwiftShader 加载慢**：Edge 客户端在本轮一次运行中加载服务器世界约 7 分钟
   （2.8 FPS 的软件渲染 + 两个浏览器竞争 CPU）；同一测试最终 47/47 通过，A 侧 93 区块、B 侧最终进入 `play`。
   属测试环境性能，不是应用错误；真实 GPU/真机不适用该数据。

未测项见 `ACCEPTANCE.md` 与 `docs/KNOWN_ISSUES.md`。

## 12. 用户验收决定（2026-11-14）

1. **E/F 真机项**：接受 phase-08 真实设备证据（LAN 手机 + 电脑、蜂窝手机 + 电脑；房间
   E7UDCMQT/XF6BT4YQ）。phase-09 本阶段仍标 **NOT TESTED**；phase-08 未提供手机 OS/浏览器型号，
   不能断言“Android Chrome 与 iOS Safari 各自通过”，也不能把 phase-08 数字写成 phase-09 真机性能。
2. **旧入口**：保留旧房间服务入口/选项占位，记录为已知遗留，不在本阶段删除。
3. **提交/推送**：验收通过后只提交 docs；随后按用户 2026-11-14 指令推送
   `origin/opusmc-integration`（验收文档 `84f858d`，fast-forward）；未合并、未强推。

因此 phase-09 的结论是**带条件验收通过**：本机/自动化 256/256 + 回归 184/184；真机项按上述引用处理。**
