# 变更记录（CHANGELOG）

格式：`阶段 — 日期 — 提交 — 内容`。只记录进入仓库的变更。

## phase-04 浏览器独立运行 — 2026-11-12 — 提交 `553ceed`（代码）+ docs 收尾

> 起点 `840b19c`；代码提交 `553ceed`；docs 收尾为当前 HEAD。phase-04 已验收通过，**未推送**、未合并、未强推、未打标签。
> 用户明确豁免真实 Android/iOS 补测；K-39 留 phase-07。

- 新增文件：`js/platform.js`（浏览器平台适配层）、`favicon.svg`、`docs/phases/phase-04-browser/{PLAN,TEST_REPORT,HANDOFF,ACCEPTANCE}.md`
- 删除文件：`docs/phases/phase-04-browser/.gitkeep`（占位文件；目录已由阶段文档替代）
- 修改文件（21）：`index.html`、`README.md`、`scripts/serve.mjs`、`js/{main,mobile,touch,screens,ui,render,game,audio,save,guest,net,netconfig,skins,social,terrain2,extras,emoji,export}.js`
- 关键变化：
  - `js/platform.js`：能力探测/阻断与降级、兼容性面板、安全 localStorage/sessionStorage、Web Audio、Worker、
    文件 API、全屏/方向/键盘锁定、Pointer Lock、安全区/visualViewport、本地资源 URL、WebGL/Canvas 获取与上下文丢失。
  - `index.html`：85 → **86** 个脚本；`platform.js` 第一；启动进度、资源失败/90 s 超时、`file://` 提示、
    兼容性面板、favicon；移除启动时对本页的额外 fetch。
  - `scripts/serve.mjs`：只服务 `index.html`、`js/*.{js,webp}`、`sounds/sfx/*`、`favicon.svg`；拒绝
    docs/scripts/server/.git/点文件/目录/穿越；ETag + 304；HTML/JS no-cache；音效 30 天、图片 7 天；
    HEAD/MIME；可选 `HOST=0.0.0.0`。
  - 渲染/输入：WebGL2/Canvas2D、Pointer Lock、全屏走平台层；F11 防双触发；指针锁定失败自由鼠标降级并提示。
  - 移动：`visualViewport` 尺寸、CSS 安全区、竖屏 90° 安全区映射、事件按帧合并、Android 全屏/横屏锁定、
    iOS 无元素全屏/鼠标锁定时不阻断；摇杆/跳跃/攻击/使用/互动/多点触控保留。
  - 存储/资源：localStorage/sessionStorage、Worker、AudioContext、音效/emoji/懒加载数据 URL 统一走平台层；
    `chunk_worker.js` 绝对 URL 后 `importScripts` 仍按 `/js/` 解析。
  - 网络边界：`NET_CONFIG.announce=false`，单机后台不再每分钟请求旧房间服务公告；多人功能仍待 phase-05。
  - 关键函数/状态：`Platform`（caps/compat/storage/audio/workers/files/display/input/graphics/resource）；
    `Stage.update/size/measure/safe/toStage`、`UI.prototype.safe`；`toggleFullscreen`/`Game.capturePointer`
    统一走平台层；`WorldListScreen.pick`/`PhotoScreen.save` 用文件 API；`LS` 增加内存回退并在写失败时抛错。
    未改变 `Game.tick`/`placeAt`/`UI.open`/`bindInput` 的包装顺序。
- 验证：
  - 90 个 JS `node --check`；`index.html` 86 个脚本；`git diff --check` 通过；改动文件保持 LF。
  - Windows Edge 157 + SwiftShader：桌面 **37/37 PASS**；65 s 游玩无第三方请求；`game.errLog` 为空。
  - Windows Chrome 157 + SwiftShader：桌面 **37/37 PASS**。
  - Windows Chrome 83 旧版：**9/9 PASS**（旧 headless `chunk stall` 单列）。
  - Android Chrome / iOS Safari（Chromium 模拟）：**21/21 PASS**；真实设备 NOT TESTED（用户明确不补测）。
  - 降级（禁用 Worker + localStorage）：**7/7 PASS**。
  - 兼容性面板（`file://`、无 WebGL2、上下文丢失）：**3/3 PASS**。
  - 服务器白名单/缓存/304/HEAD/404：通过。
  - 0 未捕获异常；正常路径 `game.errLog` 为空。
  - 独立验收：Edge **44/44 PASS**；Chrome **43/45 PASS**（2 项 K-39 `chunk stall`）；移动模拟 **25/25 PASS**；
    兼容/降级 **7/7 PASS**；phase-03 回归 **33/33 PASS**；受信任 F11/文件操作 NOT TESTED。
- 未验证：真实 Android/iOS 真机、iOS WebKit、真实 GPU FPS、手机发热/长时间运行、HTTPS/WSS/公网。
  用户已明确不补测真实 Android/iOS；K-39 留 phase-07。
- 修改原因：用户 phase-04 指令；PROJECT_SPEC §11.9；ADR-016/ADR-017。
- 状态：**已实现、已测试、验收通过（带用户豁免：真实 Android/iOS 不补测，K-39 延期 phase-07）；代码提交 `553ceed`，未推送。** 详见 `docs/phases/phase-04-browser/ACCEPTANCE.md`。

## phase-03 彻底移除账号系统并建立访客模式 — 2026-11-12 — 提交 `025cba8`（代码）+ docs 收尾

> 代码提交 `025cba8`；docs 收尾为当前 HEAD。phase-03 代码与 docs 均已推送 `origin/opusmc-integration`；未合并、未强推、未打标签。客户端核心 10/10 PASS；独立验收 68 PASS / 0 FAIL / 1 BLOCKED + F-1 非阻断 UI FAIL。

- 新增文件：`js/guest.js`（`GuestSession`）；`docs/phases/phase-03-guest-mode/PLAN.md`、`TEST_REPORT.md`、`HANDOFF.md`、`ACCEPTANCE.md`
- 删除文件：`js/account.js`（510 行）、`js/toy.js`（335 行）、`js/cloudsave.js`（323 行）、`js/checkin.js`（566 行）
- 修改文件（15）：
  - `index.html`：删除 4 个脚本引用，新增 `js/guest.js`（`netconfig` 后、`net` 前）；脚本 88 → **85**；加载条总数 85
  - `js/ui.js`：新增 `drawCard`（原 `account.js` 的公共绘图函数）
  - `js/skins.js`：删除账号外观接管/`Account.update`/签到锁定分支；保留 `mcjs-look` 与保存/刷新恢复；前缀预览用 `GuestSession.displayName`
  - `js/capes.js`：删除 `Account.data.skin` 回退
  - `js/cosmetics.js`：名字前缀识别用 `GuestSession.name`
  - `js/net.js`：`hello` 无 token；昵称输入始终显示；`login.eid → GuestSession.connected`；`leaveServer(keepGuest)`；删除账号特权/`sup` 判断
  - `js/p2p.js`：host/join 无 token；昵称统一 `GuestSession`；本地房间连接状态迁移；删除 `onlineGate`
  - `js/screens.js`：单人/多人直接放行；删除标题账号按钮与 Toy 退出分支
  - `js/onboard.js`：首启画质 → 设备 → 差异说明；删除登录步骤与账号选项；文案改访客/本地存档
  - `js/social.js`：删除 Toy 内容检查/二维码/分享/页面关闭桥；保留邀请卡复制与管理员公告；`pagehide` 离房
  - `js/mobile.js`：删除 Toy 容器/安全区桥；保留 CSS 横屏与触控
  - `js/extras.js`：照片条删除账号名/B站文案/二维码；保留保存图片
  - `js/audio.js`、`js/perf.js`、`js/touch.js`：清理旧平台注释
- 关键函数/状态变化：
  - 删除 `Account`、`Toy`/`ToyError`、`CloudSave`、`Checkin`、`LoginScreen`、`CodeShowScreen`、`CodeLoginScreen`、`AccountScreen`、`FrozenScreen`、`AdminScreen`、`ToyDiagScreen`、`FollowGateScreen`、`CloudScreen`、`CloudConflictScreen`、`CheckinScreen`、`singleGate`、`onlineGate`、`g_netName`、`ACCOUNT_SETTINGS`。
  - 新增 `GuestSession`：`name`、`playerId`、`roomId`、`connection`、`resumeInfo()`、`beginConnect()`、`connected(id)`、`disconnected()`、`leaveRoom()`；localStorage `mcjs-guest-name`、sessionStorage `mcjs-guest-resume`。
  - `Game.joinRoom`/`joinServer` 建会话；`NetClient` 在 `login` 时接收服务器临时 ID；异常断开保留 5 分钟提示，主动离开清除。
- 关键行为变化：
  - 不再有注册/登录/密码/邮箱/手机号/识别码/账号资料/账号绑定/B站登录/Toy 身份/关注/三连/解锁判断/账号云存档/签到。
  - 玩家用昵称进入多人；临时玩家 ID 由服务器按房间会话分配；单人无需任何身份。
  - 全部外观仍免费；外观只保存在本设备；活动款装饰保留。
  - 单人继续 IndexedDB；多人存档留给 phase-05 服务器。
- 修改原因：用户 phase-03 指令；PROJECT_SPEC §2/§3/§6/§11；ADR-003/ADR-015。
- 验证：
  - 89 个 `.js` 全量 `node --check` 通过；`git diff --check` 通过；`index.html` 85 个脚本
  - 无头 Edge 157 + SwiftShader：核心运行时 **33/33 PASS**；首启 **1/1 PASS**；0 FAIL；`game.errLog` 为空；0 未捕获异常
  - `Account`/`Toy`/`CloudSave`/`Checkin`/`LoginScreen`/`AccountScreen` 均为 `undefined`
  - 无 `/api/account`、`/api/cloud`、`/api/event`、`/api/gate`、`/api/checkin`、`/api/news` 或 Bilibili 请求
  - 昵称可中文并本地保存；加入参数正确；`GuestSession` 服务器 ID/重连/离房状态正确
  - 18 皮肤 + 23 披风 + 3 帽子 + 1 宠物 + 1 前缀全部可用、0 锁定；活动款与 8 装饰保留
  - 游客外观保存 → 刷新恢复；单人世界创建/保存 → 刷新恢复
  - 独立验收：主验收 47 PASS / 1 BLOCKED；手机 9 PASS；真实连接/P2P 主机 8 PASS；照片/关闭 3 PASS；TTL 1 PASS；合计 **68 PASS / 0 FAIL / 1 BLOCKED**
  - 独立验收额外发现 1 个非阻断 UI FAIL（F-1：同名昵称时满员房间被误判为「我的房间」）；客户端核心 10/10 通过，端到端未宣称完成
  - 截图/结果：`D:\ds\REA\_work\phase03-*`；详细：`docs/phases/phase-03-guest-mode/{TEST_REPORT,ACCEPTANCE}.md`
- 未验证：真实房间加入/P2P 客人互连（原服务 403）、实际断线重连握手、phase-05 服务器签发临时 ID、两名玩家互看昵称/外观、真实 GPU/真机、`/api/skin`、管理员公告轮询、旧 `mcjs-room-key`、手机安全区（K-48）。
- 状态：**已实现、已测试、验收结束；代码已提交 `025cba8` 并推送；docs 收尾为当前 HEAD；F-1 与 BLOCKED 项留 phase-05。**

## phase-02 取消皮肤、装饰和多人游戏解锁机制 — 2026-11-12 — 提交 `a9dc47b`（代码）+ docs 收尾

> 代码提交 `a9dc47b`；docs 收尾为当前 HEAD（见 `git log -1`）。工作区已干净；未推送/未合并。

- 新增文件：`docs/phases/phase-02-unlock-removal/PLAN.md`、`TEST_REPORT.md`、`HANDOFF.md`
- 删除文件：无
- 修改文件（5）：
  - `js/capes.js`：`Capes.unlocked()` 只校验 id，全部披风（普通/管理员/活动）开放；删除 `evOwned` 与 `Account.data.super` / `Account.has('anim'|'static')` 判定；`Capes.of()` 不再置空未解锁披风，改读 `Skins.look()`；注释更新。
  - `js/cosmetics.js`：`owned()` 返回全部 8 个装饰 id、`has()` 对已知 id 为 true；`lookOf()` 不再按账号拥有列表过滤帽子/宠物/前缀。
  - `js/skins.js`：预设皮肤取消 `own` 过滤（18 款全显示）；正版皮肤取消 `Account.has('skin')`；新增 `mcjs-look` 本地外观存储（`Skins.look()` / `Skins.saveLook()`）；无账号可保存，登录时接管一次账号外观，登录状态保存仍同步 `Account.update({skin})`；衣柜 `dirty` 改为保存快照比较；移除 `Account.loadGate()` 调用。
  - `js/account.js`：删除登录/每次访问的 `checkUnlocks()` 调用；账号界面删除“三连/关注”状态行；账号界面不再加载 gate；账号模块保留到 phase-03。
  - `js/onboard.js`：更新“这个版本有什么不一样”和更新内容里“三连/关注解锁”的旧文案。
- 未改：`index.html`（脚本仍 88）、`js/net.js`、`js/p2p.js`、`js/checkin.js`、`js/save.js`、`js/ui.js`、服务器/协议/资源。
- 文档：
  - 修改：`docs/ARCHITECTURE.md`、`CHANGELOG.md`、`DECISIONS.md`、`KNOWN_ISSUES.md`、`PROJECT_SPEC.md`、`START-HERE.md`、`STATUS.md`、`docs/testing/regression-checklist.md`
  - 新增：`docs/phases/phase-02-unlock-removal/PLAN.md`、`TEST_REPORT.md`、`HANDOFF.md`、`ACCEPTANCE.md`
  - 历史注记：`docs/phases/phase-01-menu-cleanup/HANDOFF.md` 顶部注明管理员款口径已被 ADR-014 取代；`TEST_REPORT.md` 注明末影龙结局已由 phase-02 补测通过
- 关键函数/状态变化：`Capes.unlocked`、`Capes.of`、`Cosmetics.owned/has/lookOf`、`Skins.lookOf/look/saveLook`、`WardrobeScreen.saveLook`；新增 localStorage 键 `mcjs-look`；`Account.unlocks` 不再参与外观判断。
- 关键行为变化：全部外观（含 `adm*` 与活动款）无需账号/关注/三连/识别码；游客可保存/恢复外观；多人入口保持 1-A 直接放行，邀请码/房间服务校验不变。
- 修改原因：用户 phase-02 指令；PROJECT_SPEC §6 第 9/10 项；ADR-014 取代 ADR-011 第 3 项“管理员款隐藏”。
- 验证：
  - 92 个 `.js` 全量 `node --check` 通过；`git diff --check` 通过；脚本数 88 不变
  - 无头 Edge 157 + SwiftShader：**27/27 PASS**；18 皮肤、23 披风、3 帽子、1 宠物、1 前缀全部可选/预览/渲染
  - 游客保存外观 → 刷新恢复；模拟账号外观接管；登录保存 stub 验证
  - 未登录多人界面直接打开；空邀请码拒绝、有效邀请码才 `joinRoom`
  - 末影龙通关结局补测 **8/8 PASS**（真实流程到 `CreditsScreen` 并返回主世界）；发现 `renderDist=4` 时返回传送门不生成的边界问题 K-41（未修复）
  - `game.errLog` 结束为空；无 JS 异常；控制台仅外部服务 403（K-02/K-40）
  - 截图/结果：`D:\ds\REA\_work\phase02-*`
- 未验证：真实 GPU/真机、真实登录/Mojang 查询、真实房间加入（原服务 403）、管理员披风服务端校验、签到活动领取。
- 新发现：K-41（低渲染距离下末地返回传送门不生成，未修复，超出本阶段范围）。
- 状态：**已实现、已测试、验收结束、已提交 `a9dc47b`；docs 收尾为当前 HEAD**。

## phase-01 主菜单清理 — 2026-11-06 — 提交 `15154bd`（代码）+ docs 收尾

> phase-01 已验收；代码提交 `15154bd`，文档收尾为当前 HEAD（哈希见 `git log -1`）。

- 新增文件：`docs/phases/phase-01-menu-cleanup/PLAN.md`、`TEST_REPORT.md`、`HANDOFF.md`
- 删除文件：`js/news.js`、`js/telemetry.js`
- 修改文件（18）：
  - `index.html`：删除 head 内 Toy 性能上报脚本、启动页脚、`js/news.js`/`js/telemetry.js` 引用、`#bootnote` CSS；脚本数 90 → 88
  - `js/onboard.js`：删除 `AgreementScreen`/`LEGAL` 与 `PlayerKindScreen`/`PLAYER_KINDS`；首启从画质设置开始，等标题世界就绪后再打开
  - `js/game.js`：新世界默认关教程（`meta.tutorial ?? -1`）；`GAME_BUILD` 从删除的 telemetry.js 移到这里
  - `js/extras.js`：小地图/死亡点不再依赖 `playerKind`
  - `js/screens.js`：删除标题登录/反馈/解锁入口与底部 B 站文案；删除选项遥测/制作人员入口；删除暂停反馈入口
  - `js/cloudsave.js`：删除标题底部「登录后可以联机…」提示
  - `js/social.js`：内容检查只包裹 `ReportScreen`
  - `js/account.js`：删除 `UnlockScreen`、解锁入口/特效、`allUnlocked`、`online` 解锁状态；`onlineGate()` 直接放行（1-A）
  - `js/net.js`：删除 gate 错误里的 `UnlockScreen` 回退
  - `js/skins.js`：删除解锁按钮与公告礼物跳转；锁定披风不再打开解锁界面
  - `js/checkin.js`：签到入口不再依赖公告吊牌位置
  - `js/capes.js`：更新解锁/公告相关注释
  - `js/ui.js`：删除 `UnlockSparks` 绘制
  - `js/p2p.js`、`js/render.js`、`js/save.js`、`js/touch.js`、`js/toy.js`：移除遥测计数、纹理自检、DB 记录与导航/全屏计数
- K-27 后续：删除 `js/telemetry.js` 与全部 `Telemetry` 调用/包装；`GAME_BUILD` 移到 `js/game.js`；`js` 92 个、`index` 88 个脚本
- 文档：
  - 修改：`docs/ARCHITECTURE.md`、`CHANGELOG.md`、`DECISIONS.md`、`KNOWN_ISSUES.md`、`PROJECT_SPEC.md`、`START-HERE.md`、`STATUS.md`
  - 新增：`docs/phases/phase-01-menu-cleanup/PLAN.md`、`TEST_REPORT.md`、`HANDOFF.md`
  - 删除：`docs/phases/phase-01-menu-cleanup/.gitkeep`
- 关键函数/状态变化：删除 `AgreementScreen`/`PlayerKindScreen`/`UnlockScreen`/`FeedbackScreen`/`TelemetryScreen`；`onlineGate()` 直接放行；新世界 `tutorial=-1`；`playerKind`/`legalV`/`Telemetry` 移除；`GAME_BUILD` 移到 `js/game.js`；`ReportScreen` 内容检查保留。
- 关键行为变化：首启两屏消失；公告/反馈/遥测/制作人员/协议入口消失；标题无登录与 B 站文案；多人不再要求账号/解锁；新世界默认无教程。
- 修改原因：按用户 phase-01 冻结清单删除主菜单旧平台/解锁/公告/反馈/遥测入口；K-27 独立验收要求整体移除遥测；不进入 phase-02。
- 验证：
  - 92 个 JS 全量 `node --check` 通过
  - 无头 Edge 156 + SwiftShader：首启 `QualityScreen`，标题 `TitleScreen`，0 个 `game.errLog` 错误
  - 创建世界 `play`、61 区块、`tutorial=-1`；暂停菜单无反馈；多人入口直接进入 `MultiplayerScreen`；衣柜打开正常
  - 静态服务器 88 个脚本全部 200，`js/news.js`/`js/telemetry.js` 404 且不再请求；无 `/api/telemetry`
- 未验证：真实 GPU/真机、登录后的账号界面、签到、结局 `CreditsScreen` 实机触发、多人服务器

## phase-00 复核与交接 — 2026-11-06 — docs 提交（仅文档）

> 代码未变：`js/`、`index.html`、`scripts/`、`sounds/` 均未修改。
> 本节记录的是阶段 0 收尾文档；已随本次 docs 提交进入仓库，提交信息：`docs: close phase-00 review and record phase-01 decisions`。哈希见 `git log -1`。

- 新增文件：**无**
- 删除文件：**无**
- 修改文件：
  - `docs/STATUS.md`：更新当前阶段、HEAD `e49a54c`、代码基线 `2798c08`、未完成阶段与整体状态
  - `docs/ARCHITECTURE.md`：更正 `Game.prototype` 统计口径；新增 §9 阶段 0 复核补充（联机本质、无头边界、依赖陷阱、菜单归属）
  - `docs/KNOWN_ISSUES.md`：新增阶段 0 发现的待解决项、未测试项、服务端/环境依赖与兼容性风险
  - `docs/phases/phase-00-initialization/HANDOFF.md`：重写为当前交接（目标、完成情况、决策、测试、下一阶段前置）
  - `docs/START-HERE.md`：同步基线、阶段状态、阶段 1 决策与入口
  - `docs/DECISIONS.md`：新增 ADR-011（阶段 0 复核结论与阶段 1 边界）
  - `docs/CHANGELOG.md`：本节
- 关键函数/状态变化：**无**（没有改任何游戏源码）
- 修改原因：阶段 0 结束，为下一次会话建立可靠上下文；记录已确认的 10 项决策与 1-A 边界
- 验证：
  - `GET /` 200，16,469 B；`GET /js/game.js` 200，186,140 B
  - 无头 Edge 156 + SwiftShader：`game.state='title'`，WebGL2，0 游戏错误
  - 无头创建世界：`play`，62 区块，4,783 ms，IndexedDB，`probe-world`，0 错误
  - Node v26.13.0：核心世界生成加载成功，生成 98,304 方块区块（183 ms）
- 未验证：真实 GPU/真机性能、手机/iOS、多人服务器、HTTPS/WSS、备份恢复

## phase-00 初始化 — 2026-11-06

- `6090828` 导入原始 OpusMC 源码（构建 `47455601425408-v39426`）
  - `index.html` + 90 个 `js/*.js`，按字节导入；标签 `v0.0.0-original`
- `6f4472c` 独立运行准备
  - 删除 `index.html` 中唯一一行 B 站 Toy 重定向脚本
  - 新增 `scripts/serve.mjs`（零依赖、仅 127.0.0.1）、`README.md`、`.gitignore`
- `ee74cc2` 按字节保存
  - 新增 `.gitattributes`（`* -text`），`core.autocrlf=false`
- 文档基线（本提交）
  - `docs/PROJECT_SPEC.md`、`ARCHITECTURE.md`、`DECISIONS.md`、`STATUS.md`、`CHANGELOG.md`、`KNOWN_ISSUES.md`
  - `docs/research/*`、`docs/testing/*`、`docs/phases/phase-00-initialization/*`
  - 标签 `v0.1.0-preproject`

### phase-00 补充（同日）

- `feat(assets)` 补入原版音效包：`js/sound_events.js`（617,453 B）+ `sounds/sfx/**/*.m4a`
  （4,849 个文件，43,169,776 B），下载 0 失败；KNOWN_ISSUES K-01 关闭
- `docs` 同步更新 STATUS / KNOWN_ISSUES / ARCHITECTURE / README
- `docs: record sound pack commit, tags and remote state`（`791d16b`）
- **首次远程推送**：`main → origin/opusmc-init`（`791d16b`），远程 `main` 未变（仍为 `6c476c0`）
  - PR 入口：<https://github.com/harrypotterx9000/mc/pull/new/opusmc-init>

> 说明：本阶段没有修改任何游戏逻辑；唯一源码改动是上述 1 行重定向删除。


### 文档上下文交接（2026-11-06）

- 新增 `docs/START-HERE.md`：下一次会话的入口与规则
- 更新 `docs/STATUS.md`、`docs/PROJECT_SPEC.md`（v1.1，新增 §12 基线与上下文交接）、
  `docs/DECISIONS.md`（ADR-009/010）、`docs/phases/phase-00-initialization/HANDOFF.md`
- 标签 `v0.1.0-integration` 指向 `2798c08`（PR #1 内容基线）
- **丢弃**未验收的 phase-01 改动（3 个文件，+3/−37 行）、stash、补丁、阶段分支与临时文档
- 无任何游戏代码改动；工作区干净
