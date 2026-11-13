# OpusMC 架构说明（ARCHITECTURE）

> 依据：`D:\ds\REA\opusmc` 当前源码（phase-06 后仍 87 个加载脚本、91 个 `.js`，构建 `47455601425408-v39426`）+ 静态扫描 + 运行时探针 + 本机服务器实测。
> 标注：**[事实]** 源码可复核；**[实测]** 运行时读到；**[推断]** 未运行验证。

## 1. 总体形态

单页 WebGL2 应用，无框架、无打包器：

- `index.html` 按固定顺序加载 **87** 个 `<script>`（phase-04：85 + `platform.js`；phase-05：+ `mp.js`），全部挂在全局作用域。
- 数据文件（方块/物品/配方/结构/模型/贴图/字体）是构建脚本从原版数据生成的单行 JSON。
- 功能模块通过**给共享原型打补丁**扩展（`Game`、`Renderer`、`Player`、`UI`、`World`、`Mob`…）。
- 世界生成在 Web Worker（`gen_worker.js`），装饰/网格化在另一个 Worker（`chunk_worker.js`，按需创建）。
- 联机：旧 `NetClient` 连「原版 Java 服务器代理」；`p2p.js` 提供 WebRTC 本地房间；phase-05 新增
  `js/mp.js` + `server/` 自建 WebSocket 房间。**服务器端代码现在在本仓库 `server/`。**

## 2. 分层与文件（[事实]）

```
加载顺序（87）
├─ 平台       platform
├─ 资源/数据  assets, font, emoji, texts, worldgen_data, blockdata, itemdata,
│             recipedata, structures_data, entitydata, etex, models, panorama_data, subtitles
├─ 内核       util → world → mesher → vmodels → render/render2 → shaders
├─ 内容       blocks → features → trees → structgen/structtypes → dims → mobs_* → items* → redstone
├─ 循环       game → terrain2 → perf
├─ 界面       ui → screens → commands → controls → touch → mobile → onboard
└─ 平台       netconfig → guest → net → beacon/cmdblock → capes/skins
              → social → companion → extras → cosmetics → p2p → mp → panorama
```

- **194 个顶层类声明**（phase-02 为 206；phase-03 删除 12 个账号/Toy/云/签到类）、**66 个 `*Screen` 类**（原 84；phase-01 −7、phase-03 −11）；按 `Game.prototype.* =` 赋值扫描沿用 phase-0 的 **40 个文件、257 处、174 个方法名**（含包装器）。
- 运行时懒加载（不在 87 个 `<script>` 中）：`js/chunk_worker.js`、`js/skins_data.js`、`js/vstates_data.js`、`js/sound_events.js`、`js/emoji.webp`；音效文件 `sounds/sfx/*`（4,849 个 m4a，已随项目提供）。
- phase-03 删除：`js/account.js`、`js/toy.js`、`js/cloudsave.js`、`js/checkin.js`；新增 `js/guest.js`。
- phase-04 新增：`js/platform.js`（浏览器平台层）；页面脚本 85 → 86，`js/` 89 → 90。
- phase-05 新增：`js/mp.js`（自建服务器客户端与界面）；页面脚本 86 → 87，`js/` 90 → 91；新增 `server/`
  （9 个 `.mjs`、配置、Windows 脚本与部署说明）。

## 3. 关键对象与状态归属（[事实]）

| 对象 | 拥有者 | 关键字段 | 主要读者 |
|---|---|---|---|
| `game` | `js/game.js` | `state, world, worldMeta, player, entities, ui, settings, genPool` | 几乎所有模块 |
| `world` | `js/world.js` | `chunks, minY, gen2, W/H` | 渲染、实体、红石、结构、刷怪、存档 |
| `player` | `js/entity.js` | `pos, inv, health, effects, mode` | UI、装备、网络、载具 |
| `ui` | `js/ui.js` | `screen, chat, input, debug` | 输入、tick、渲染 |
| `DB` | `js/save.js` | IndexedDB 封装 | 世界、云存档、P2P 主机 |
| `Account`（已删除） | — | phase-03 移除；无替代账号 | — |
| `GuestSession` | `js/guest.js` | `name, playerId, roomId, connection` | 多人界面、NetClient、P2P、外观前缀、聊天 |
| `RoomService` | `js/net.js` | 房间 API 封装 | 多人、P2P、公告、正版皮肤查询 |
| `NetClient` | `js/net.js` | WS 连接、玩家表 | 联机 UI、命令方块、皮肤、社交 |
| `MPClient` | `js/mp.js` | `code, worldId, meta, token, state, deltas, mirrors, playersData` | 自建房间 UI、世界同步、暂停菜单 |
| `RoomManager` / `Room` | `server/rooms.mjs` | 房间、邀请码、玩家、权限、方块覆盖层、方块实体、掉落物、世界时间 | WebSocket/HTTP、存档 |
| `RoomStore` | `server/storage.mjs` | `world.json`、备份、管理令牌、pid | 启动加载、自动保存、恢复 |
| `Sound` | `js/audio.js` | 音频上下文、监听者 | 全模块音效 |
| `FX` / `DynRes` / `PerfMon` | `js/shaders.js` / `js/perf.js` | 光影与性能状态 | 渲染、HUD |

## 4. 核心调用链（[事实]）

**启动**：`main.js: boot() → new Game() → init()`
→ `Renderer.init → Font.init → UI → Particles → initPresets → DB.open → bindInput → Sound.loadPack → startTitle → FramePacer.start`

**每帧**：`FramePacer → game.frame(dt)`（title/loading/play 分支）
→ `updateChunks(chunkBudget)`
→ 累加器 ≥50 ms 时 `game.tick()`（被 10 个文件包过一层）
→ `game.render(alpha)` → `Renderer.drawWorld/Entities` → `ui.draw()`

**tick 内部**（`js/game.js:632-710`）：时间/天气 → 玩家 → 交互 → 传送门 → 实体 → 乘客 → 粒子 →
计划刻（红石）→ 随机刻 → 熔炉 → 刷怪 → 教程/进度 → 环境音。多数调用包在 `guard()` 里（异常只记录不中断）。

**输入**：`keydown/mousedown → bindInput →（有屏幕则给屏幕）→ pressAction → 动作`

**世界加载**：`createWorld/loadWorld → DB.getWorld → initDims → genSetup → GenPool(worker)`
→ `genReceive → finishFromWorker → finishChunk → Mesher → Renderer`；卸载时 `saveWorld → DB.putChunks`

**联机（旧）**：`NetClient.connect → WS → hello{name,version,proto,room,key}（无账号 token）→ 服务端 login{eid} → GuestSession.connected(eid) → 服务端权威消息`

**联机（phase-05 自建）**：`MPServerScreen → MPClient.connect → WS /ws → hello{v:1,name,look} → create/join/resume
→ server welcome → blocks/blockEntities/items/ready → game.loadWorld('srv~<code>')（DB getWorld/chunkKeys 重定向）
→ finishChunk 应用方块覆盖层 → 10 Hz state + 10 s pstate → server E/b/be/env/chat 快照`

## 5. 跨文件补丁矩阵（[事实]，改动必查）

| 方法 | 覆盖文件数 | 说明 |
|---|---|---|
| `Game.tick` | 10 | 后加载者包住先加载者；顺序 = index.html 顺序 |
| `Game.placeAt` | 5 | 放置语义叠加（命令方块/装饰/敌对/特殊/载具） |
| `Game.useEquipment` | 4 | 物品使用链（装备/物品/使用/载具） |
| `Game.drawChests` | 4 | 容器渲染链 |
| `Game.tickFurnaces` | 3 | 熔炉/酿造/信标 |
| `Game.loadDimData` | 2 | 维度加载 + 刷怪初始化 |
| `Game.placeState` / `playerPose` / `netUse` | 各 2 | 方块状态 / 姿态 / 联机交互 |
| `UI.open` | 1 | 红石唤醒 |
| `ChestScreen.close` | 1（被包） | 关闭时唤醒比较器 |

## 6. 联机与服务器现状（[事实]+[推断]）

- 客户端只实现协议的一半：发 `hello/tick/交互/聊天/窗口`，收 53 类消息。
- **phase-03 起没有账号、token 或 Bilibili 身份**：`hello` 只带昵称/房间/浏览器房间 key；`login.eid` 作为房间会话的服务器临时 ID 交给 `GuestSession`（phase-05 自建服务器必须自己签发/校验）。
- 注释指向 `multiplayer/proxy` 与 `multiplayer/rooms`；phase-04 前仓库内没有服务器端代码。phase-05 新增
  `server/`（静态页面 + 自建房间 + WebSocket + 存档），旧代理/旧房间服务仍保留。
- 现有旧房间服务地址 `https://xz.honghemc.cn:8443`（`js/netconfig.js`）仍用于旧多人界面；自建服务器走同源 `/ws`。
- phase-05 的实现不是“完整无头 Minecraft 模拟”：服务器权威房间/身份/方块覆盖层/实体状态/时间/存档；
  地形由客户端按 seed 生成，生物/红石/流体/战斗仍为客户端本地。详见 §14。

## 7. 自建服务器设计草案（历史；已在 phase-05 实现，见 §14）

```
server/
  index.mjs         HTTP + WebSocket 入口，房间路由
  rooms.mjs         房间生命周期、邀请码、人数、临时玩家 ID
  world.mjs         世界实例（区块、方块、实体、时间）
  protocol.mjs      消息编解码（对齐现有 53 类 case 的子集）
  persistence.mjs   多人世界存档（磁盘）
  rules.mjs         服务端校验（移动/破坏/放置/战斗）
```

原则：客户端渲染与表现不变；服务器权威；单人仍走 IndexedDB，不需要服务器。

## 8. 已知架构风险

1. Monkey Patch 依赖加载顺序，删文件会静默改变行为（`guard()` 会吞异常，只留日志）。
2. 平台模块（Guest/Net/Game/外观）与主循环耦合在标题、多人、外观界面；删改需同步改 UI（phase-03 已完成账号/Toy/云/签到的删除）。
3. `Game.tick` 的包装链让"删功能"比"加功能"更容易出错，阶段改造必须先列补丁清单。
4. 无构建系统，任何新模块都必须手工加入 `index.html` 且注意顺序；`guest.js` 必须在 `net.js` 之前，
   `mp.js` 必须在 `p2p.js` 之后（它包装 `Game.tick`/`World.setBlock`/`DB`）。
5. `js/mp.js` 与 `js/p2p.js` 都包装 `Game.tick`/`World.setBlock`/`DB`/`quitToTitle`/`saveWorld`；顺序变化
   会改变哪条联机路径生效。改动前先跑单人回归与双浏览器 E2E。
6. 服务器存档是 seed + 方块覆盖层；世界生成版本/构建变化会使旧房间的基础地形不一致（K-73）。
7. 服务器不模拟生物/红石/流体/战斗；这些仍由各客户端本地计算，多人结果可能不一致（K-67…）。

## 9. 阶段 0 复核补充（2026-11-06，未改代码）

> 本节是复核结论，不是架构变更；游戏源码与 `2798c08` 相同，HEAD `e49a54c` 仅含文档。

### 9.1 复核计数

| 项 | 实测 |
|---|---|
| `index.html` 脚本 | 90（phase-0）；phase-01 后 **89** |
| `js/` | 94 个 `.js` + 1 `emoji.webp`（phase-0）；phase-01 后 **92** 个 `.js` + 1 `emoji.webp` |
| 顶层类 | 213（phase-0）；phase-01 后 **206** |
| `*Screen` 类 | 84（phase-0）；phase-01 后 **77** |
| 直接给 `Game.prototype` 赋值的文件 | 40 个 / 257 处 / 174 个方法名（含包装器） |
| `NetClient` 入站消息 | 53 种（去重后） |
| `NetClient` 出站消息 | 22 种 |

### 9.2 联机架构的准确表述

- `js/net.js` 的 `NetClient` 不是“OpusMC 房间协议客户端”，而是**WebSocket ↔ 原版 Java Minecraft 服务器代理**的客户端。它依赖原版 block state 调色板、窗口/背包/实体语义。
- 仓库内没有服务器端代码（phase-0 时点；phase-05 已新增 `server/`，见 §14）；`scripts/serve.mjs` 只提供静态 GET/HEAD。
- `js/p2p.js` 的 `LocalHost`/`LocalGuest` 是**最接近自建服务器**的现有实现：主机跑完整世界，客人确定性生成 + 差量同步；但它是 WebRTC、最多 4 人、主机信任客人，不是服务端权威。
- 阶段 5 决策（已确认）：**B/C 混合**——协议词汇与区块 RLE 编码复用 `p2p.js`，传输改 WebSocket；`NetClient` 保留为“直连原版代理”的遗留功能。

### 9.3 无头运行边界

- `world.js`、`worldgen.js`、`terrain2.js`、`blocks.js`、`mesher.js`、`entity.js`、`redstone.js`、`gen_worker.js`、`chunk_worker.js` 在加载期无 DOM/WebGL 依赖。
- Node v26.13.0 已实测：加载核心数据/方块/World/世界生成，仅需 `window/self/document/localStorage/navigator/atob/Blob/Response/DecompressionStream` 等垫片，即可生成 16×16×384 = 98,304 方块区块。
- `game.js` 仍有 14 处 DOM、`Renderer/UI/Sound/Particles/Font` 贯穿 `init/tick/render`；服务端不能直接 `node js/game.js`，需要无头 `Game` 垫片或抽取模拟层。
- `Game.tick()` 内部会检查 `this.ui.screen`、调用 `Sound`/`this.particles`；服务端复用前必须为这些提供空实现，不能把 DOM/Canvas/WebGL 搬进服务器。

### 9.4 删除/迁移依赖陷阱（phase-0 时点；phase-01 已处理 news/telemetry/feedback）

| 陷阱 | 位置 | 后果 |
|---|---|---|
| `GAME_BUILD` 定义在遥测模块 | `telemetry.js:20`，被 `onboard.js:372/388/428/429` 直接使用 | 先删 `telemetry.js` 会让首启/更新界面 `ReferenceError` |
| `social.js` 硬引用 `FeedbackScreen` | `social.js:31` | 先删反馈面板会让聊天/举报内容检查 `ReferenceError` |
| `Account` 包装了 `RoomService` | `account.js:177-190` | 删账号文件会恢复基础方法；其他模块不能再读 `Account.token/key` |
| `UI.open` 双层包装 | `redstone.js:1117` 先，`telemetry.js:165` 后 | 删遥测后红石包装仍在；不要误删红石 |
| `UnlockScreen` 被 `onlineGate` 调用 | `account.js:687-699` | 阶段 1 采用 1-A：删界面的同时让 `onlineGate()` 直接放行（计划，未实施） |
| `CreditsScreen` 只在结局使用 | `dims.js:367/528` | 主菜单“制作人员名单与致谢”实际打开 `HelpScreen`；删选项行不能删 `CreditsScreen` |
| `p2p` 包装 `DB/World/Game` | `p2p.js:435-477` | 删/改本地房间必须逐项恢复或替换 |
| `Game.tick` 加载顺序 | 10 个文件 | 后加载者包住先加载者；删文件会静默改变行为 |

### 9.5 菜单/平台入口的准确归属（phase-0 时点）

> 以下行号为 phase-0 源码；phase-01 已删除首启两屏、公告面板、解锁面板、反馈面板与部分入口，见 §10。

- 首启两屏在 `onboard.js`：`AgreementScreen`（标题“欢迎来到 OpusMC”）与 `PlayerKindScreen`（“你是哪种玩家？”）。
- 公告在 `news.js`，通过 `TitleScreen.prototype.layout/drawExtra/mouseDown` 注入；与 `checkin.js` 的 `signRect`、`skins.js` 的礼物判断共享。
- 标题账号/解锁入口在 `screens.js:107-109`；账号界面在 `account.js`。
- 反馈入口在 `screens.js:100/482`、`telemetry.js:273`；`FeedbackScreen`/`postFeedback` 在 `telemetry.js`。
- 选项三项：`screens.js:387`（遥测）、`screens.js:388`（制作人员名单）、`onboard.js:480`（用户协议/隐私）。
- Toy 性能上报脚本在 `index.html:3-219`；启动页脚“仅在 B站 Toy 平台发布”在 `index.html:245`。

## 10. 阶段 1 变更（2026-11-06，已完成；代码提交 `15154bd`）

> phase-01 已验收并提交（`15154bd`）；文件计数、入口与调用链以此节为准。§9 是 phase-0 复核时点。

### 10.1 文件与脚本

- `index.html`：脚本 **90 → 88**；删除 `js/news.js`/`js/telemetry.js` 引用、head 内 Toy 性能上报内联脚本、启动页脚与 `#bootnote`。
- `js/`：**94 → 92 个 `.js`**（删除 `news.js` 与 `telemetry.js`）+ `emoji.webp`；懒加载仍为 `chunk_worker.js`、`skins_data.js`、`vstates_data.js`、`sound_events.js`、`emoji.webp`。
- 删除文件：`js/news.js`、`js/telemetry.js`。
- 修改文件：`index.html`、`onboard.js`、`game.js`、`extras.js`、`screens.js`、`cloudsave.js`、`social.js`、`account.js`、`net.js`、`skins.js`、`checkin.js`、`capes.js`、`ui.js`、`p2p.js`、`render.js`、`save.js`、`touch.js`、`toy.js`。
- K-27 后续：删除 `js/telemetry.js`；移除全部 `Telemetry` 调用/包装、`render.js` 的遥测纹理自检、`save.js` 的遥测 DB 记录、`social.js` 的页面关闭 flush。

### 10.2 首启链

```
startTitle()
  → 标题世界 setupWorld + TitleScreen
  → 等 titleWorldReady()（最多 8 s）
  → QualityScreen（画质/光影）→ DeviceScreen → LoginScreen（仍存在）
  → Onboarding.afterLogin → DifferencesScreen → TitleScreen
```

- `AgreementScreen`、`LEGAL`、`legalV`、`PlayerKindScreen`、`PLAYER_KINDS`、`playerKind` 已删除。
- 新世界 `tutorial = meta.tutorial ?? -1`；旧存档值保留。
- 小地图/死亡点不再由 `playerKind` 决定；仅显式设置为开时显示。

### 10.3 标题与菜单

- `TitleScreen`：删除登录按钮、解锁按钮、反馈按钮；皮肤和装饰按钮改为整行宽；底部只保留 `OpusMC` 标识。
- `OptionsScreen`：删除「遥测数据…」「制作人员名单与致谢…」；`onboard.js` 覆盖不再添加「用户协议和隐私说明」。
- `PauseScreen`：删除「反馈问题」。
- `FeedbackScreen`/`postFeedback`/`feedbackShot`/`FEEDBACK_KINDS`/`TelemetryScreen` 删除；`social.js` 只包裹 `ReportScreen`。
- K-27 后续：`js/telemetry.js` 与全部 `Telemetry` 调用/包装删除；`GAME_BUILD` 移到 `js/game.js`；无 `/api/telemetry` 请求。

### 10.4 公告、签到与衣柜

- 公告：`NewsBoard`/`NewsScreen`/`NewsEditScreen` 随 `js/news.js` 删除；公告礼物领取与标题自动弹出消失。
- 签到：`Checkin.titleRect` 不再读公告吊牌位置，使用标题右上角固定回退位置；暂停菜单入口保留。
- 衣柜：删除「三连解锁」按钮、公告礼物跳转、锁定披风的 `UnlockScreen` 点击；锁定项显示「暂未解锁」且不可点。
- 聊天里的管理员全服公告（`social.js`）保留，与已删除的公告板无关。

### 10.5 联机门槛

- `onlineGate()` 被替换为 `function onlineGate(g, then) { return then(); }`（1-A）。
- 标题「多人游戏」、`p2p.js` 的本地房间入口均不再要求账号/关注/三连；`net.js` 的 gate 错误回退已删除。
- `Account.checkUnlocks` 仍会后台更新披风/皮肤解锁状态，但不再弹解锁庆祝；`Account.allUnlocked`/`has('online')`/`UnlockSparks` 已删除。

### 10.6 已知风险

- 未解锁的非活动款披风/正版皮肤在 phase-02 前不可获得（K-28）。
- 遥测模块已整体移除（K-27 已解决）。
- 公告/反馈删除后，旧的 localStorage 键与云端接口数据成为死数据；不自动清理（K-31）。
- 首启等待标题世界就绪，低端设备会先看到标题数秒（K-35）。

## 11. 阶段 2 变更（2026-11-12，已实现/已测试/已验收；代码提交 `a9dc47b`）

> 本节记录 phase-02 完成时点；其中“账号仍保留”“保存同步账号”“hello 发送 token”等描述已被
> phase-03 取代，当前实现以 §12 为准。本阶段不新增文件、不改 `index.html` 脚本顺序；脚本数仍 88，`js/` 仍 92 个 `.js`。

### 11.1 外观权限模型

phase-01 只删除了解锁界面；phase-02 修改真正的权限判断：

| 位置 | phase-01 后 | phase-02 |
|---|---|---|
| `Capes.unlocked(id)` | 事件款看 `Account.data.owned`，管理员款看 `Account.data.super`，普通款看 `Account.has('anim'/'static')` | 只判断 id 是否为已知披风，全部 true |
| `Capes.of(g, e)` | 本地玩家选中的披风未解锁时置空 | 不再置空；读取 `Skins.look()` |
| `Cosmetics.owned()` / `has()` | 来自 `Account.data.owned` | 返回全部 8 个装饰 id；已知 id 全部 true |
| `Cosmetics.lookOf()` | 按账号拥有列表过滤 hat/pet/pre | 不过滤 |
| `Skins` 预设列表 | `this.list.filter(p => p.own)` | 全部 18 款 |
| 正版皮肤 | `Account.has('skin')` 才显示输入框；`lookOf` 也拦截 `m:` | 输入框一直显示；`lookOf` 不拦截 |
| 衣柜保存 | 未登录 → `LoginScreen` | 先写本地 `mcjs-look`；有账号再同步账号 |

管理员披风（`admin`, `admblack`, `admred`, `admblue`, `admgreen`, `admivory`, `admsilver`, `admnavy`, `admender`, `admaurora`, `admriver`, `admgold`, `admvoid`）与活动披风（`penguin`, `penguinwalk`, `goldapple`）全部可显示、可选择、可渲染。

### 11.2 外观保存与恢复

- 新 localStorage 键：`mcjs-look`，结构 `{skin, slim, cape, hat, pet, pre}`（只保留字符串/布尔值）。
- `Skins.look()`：衣柜预览优先；否则读取本地；登录后首次读取把账号 `data.skin` 接管一次（每个账号 id 一次）。
- `Skins.saveLook(l)`：写本地；`WardrobeScreen.saveLook()` 在有账号时再调用 `Account.update({skin})`。
- 保存失败（外部服务不可用）不回滚本地；界面提示“已保存在这台设备上；账号同步失败”。
- `WardrobeScreen.dirty` 与保存快照比较，不再依赖 `Account.data.skin`。
- 渲染链：`game.js drawMob → Capes.draw → Capes.of → Skins.look`；`Cosmetics.drawOn → worn → lookOf → Skins.look`；衣柜/背包预览走 `Skins.preview()`。

### 11.3 账号

- `Account` 仍保留到 phase-03（登录、识别码、云存档、签到、Toy）。
- 删除 `loginBili` 与每次访问时的 `Account.checkUnlocks()` 调用；方法保留但不再被调用。
- 账号界面不再显示三连/关注状态，也不再加载 `/api/gate`。
- `Account.has()` 不再被外观模块调用；phase-03 删除账号时一并清理。

### 11.4 多人

- `onlineGate(g, then)` 仍为 phase-01 的 `return then()`；未登录可直接打开 `MultiplayerScreen`。
- `MultiplayerScreen` 仍要求昵称；`submit()` 要求 6–12 位邀请码（本地房间可 12 位）；`joinRoom` / `RoomService` / 房间服务校验未改。
- `NetClient.hello` 仍只在有账号时发送 token；不要求 token。

### 11.5 风险与边界

- 原房间服务 `xz.honghemc.cn:8443` 在本机 403：公开房间列表不可用；真实加入未测（phase-05 自建服务器）。
- 原房间服务可能仍按 `adm*` 校验披风；客户端已开放，服务端未改（不在本仓库）。
- 正版皮肤查询仍调用 `/api/skin`（Mojang 代理）；权限已开放，数据源仍依赖外部服务。
- 本地外观仅本设备；换设备不再有账号同步（访客模式定位）。

## 12. 阶段 3 变更（2026-11-12，已实现/已测试/验收结束；代码提交 `025cba8`；docs 收尾为当前 HEAD）

> 本阶段删除 4 个模块、新增 1 个模块；`index.html` 脚本 88 → 85，`js/` 92 → 89 个 `.js`。

### 12.1 账号系统整体移除

- 删除 `js/account.js`（510 行）：`Account` 单例、`LoginScreen`、`CodeShowScreen`、`CodeLoginScreen`、`AccountScreen`、`FrozenScreen`、`AdminScreen`、`ToyDiagScreen`、`FollowGateScreen`、`singleGate`、`onlineGate`、`g_netName`、`ACCOUNT_SETTINGS`、`drawCard`/`drawIcon`、`xhr`、`Account` 对 `RoomService`/`Game.saveSettings` 的包装。
- 删除 `js/toy.js`（335 行）：B站 Toy SDK、`ToyError`、mock 面板、资料/关注/三连、内容检查、分享、二维码、容器模式、页面关闭事件。
- 删除 `js/cloudsave.js`（323 行）：账号云存档、云端存档界面、云冲突、云状态/过期提示、`DB.putChunks` 脏块记录、`Game.quitToTitle`/`loadWorld`/`startTitle`/`WorldListScreen`/`TitleScreen` 包装。
- 删除 `js/checkin.js`（566 行）：签到状态、签到界面、`/api/account/checkin`、`/api/event`、奖励/穿戴入口、标题/暂停签到补丁。
- `drawCard` 移到 `js/ui.js`；标题账号按钮、选项「账号…」、首启登录步骤删除。

### 12.2 访客身份 `GuestSession`

- `js/guest.js` 在 `netconfig.js` 后、`net.js` 前加载。
- `name`：1–16 字符，去控制字符/引号；本地 `mcjs-guest-name`，镜像 `settings.netName`；首次加载可从旧 `settings.netName` 接管一次。
- `playerId`：只有 `connected(id)`/`beginConnect` 后的网络层调用会写入；未连接时 `local_...` 且 `serverAssigned=false`。
- `roomId`：`beginConnect(code)` → 规范化房间码；`leaveRoom()` 清空。
- `connection`：`idle` / `connecting` / `connected` / `disconnected`。
- `mcjs-guest-resume`（sessionStorage，5 分钟）：房间、昵称、服务器 ID、时间；`resumeInfo()` 只给提示，不自动认证；主动离开清除。

### 12.3 外观与多人迁移

- `Skins`：删除账号外观接管/`Account.update`；保留 `mcjs-look` 六项与保存/恢复；衣柜锁定/签到分支删除；保存提示「已保存在这台设备上」。
- `Capes.of`：只读 `Skins.look()`；`Cosmetics.preName` 用 `g.net.name` / `GuestSession.name`。
- `NetClient`：`hello` 无 token；`login.eid → GuestSession.connected`；`fail` 保留短期重连信息；`leaveServer(keepGuest)` 区分主动/异常断开。
- `MultiplayerScreen`：昵称输入始终显示；`okName()` 写 `GuestSession`；删除 `sup`/`mine` 账号判断；房间满员只允许房主本人进入。
- `p2p`：`host`/`join` 无 token；昵称统一 `GuestSession`；本地房间 `beginConnect/connected/disconnected/leaveRoom`。
- `social`：邀请卡只保留复制链接/邀请码；Toy 内容检查删除；`pagehide` 离开房间并保留重连提示；管理员聊天公告轮询保留。
- `mobile`：Toy 容器/安全区桥删除；保留 CSS 横屏、触控和 `UI.safe()`（默认 0）。
- `extras`：照片条去掉账号名/B站文案/二维码，保留保存图片。

### 12.4 风险与边界

- 现有 `login.eid` 是旧房间服务分配的实体 ID；phase-05 自建服务器必须改为自己的房间会话 ID，并校验客户端不得自称。
- 本地 P2P 主机没有服务端 ID，`GuestSession` 只给 provisional `local_...`；不能当认证身份。
- **房间所有权不能用昵称推断**：`MultiplayerScreen` 的 `mine` 在同名昵称时会误判满员房间（F-1/K-47）；phase-05 必须用服务端身份/所有权。
- 实际断线重连握手未实现；`mcjs-guest-resume` 只是 5 分钟提示（K-50）。
- 真实房间/P2P 加入未测（原服务 403/CORS）；真实 P2P 客人连接 BLOCKED。
- 旧 `mcjs-room-key` 仍是浏览器本地房间管理凭据（不是玩家账号），phase-05 替换；旧 `mcjs-account`/`cloud` 元数据为死数据，不自动清理。
- 正版皮肤仍走 `/api/skin`（不属于账号 API，K-36）；管理员公告轮询仍走旧房间服务。
- 移除 Toy 容器后手机安全区为 0（K-48）；Toy 内容检查移除后内容治理归 phase-05（K-49）。

## 13. 阶段 4 变更（2026-11-12，已实现/已测试/已验收；代码 `553ceed`）

> `index.html` 85 → **86** 个脚本；`js/` 89 → **90** 个 `.js`；加载顺序以新增的 `js/platform.js` 开头。
> 本节以 phase-04 提交 `553ceed` 为准；用户明确不补测真实 Android/iOS，K-39 留 phase-07（ADR-017）。

### 13.1 浏览器平台层 `js/platform.js`

新增全局 `Platform`（无构建器，按页面脚本顺序加载）：

| 区域 | 能力 |
|---|---|
| `caps` / `fatal()` / `warnings()` | WebGL2、Canvas2D、Worker、IndexedDB、localStorage/sessionStorage、Web Audio、Pointer Events、键盘、Pointer Lock、全屏、振动、设备运动、方向、visualViewport、fetch、WebSocket、文件 API、目录选择 |
| `storage.local/session` | 安全 get/set/getJSON/setJSON/remove/keys；不可用时本页内存影子，`available/backend` 可查 |
| `display` | `safeArea()`（CSS `env(safe-area-inset-*)` 探针）、`viewport()`（visualViewport）、全屏（含 webkit 前缀）、方向锁定、键盘锁定 |
| `input` | Pointer Lock 请求/释放（`unadjustedMovement` 失败回退）、振动 |
| `audio` | AudioContext 创建/恢复 |
| `workers` | 按 `document.baseURI` 解析 Worker URL；不可用返回 null |
| `files` | 文件/目录选择、DataURL/Blob 下载 |
| `graphics` | Canvas2D/WebGL2 获取；WebGL 上下文丢失面板 |
| `resource()` | 本地资源绝对 URL；Worker/音效/emoji/懒加载数据统一走这里 |
| `compat` | 阻断/警告列表、文本报告、DOM 兼容性面板 |

### 13.2 启动与入口

- `index.html`：`js/platform.js` 为第一个脚本；总脚本 86；启动条不再额外 fetch 本页；新增资源加载失败、90 s 启动超时、`file://` 明确提示、兼容性面板、`favicon.svg`。
- `main.js` 启动前调用 `Platform.fatal()`：`file://`、Canvas2D、WebGL2 缺失时显示面板并停止初始化；其余能力降级。
- 失败路径：`Platform.compat.show()` 输出能力报告、UA、视口、安全区、启动错误；`#err` 仅作面板缺失时的后备。
- WebGL 上下文丢失：`Platform.graphics.watchContext` 阻止默认行为并显示“重新加载”，不在黑画布上继续运行。

### 13.3 资源与服务器

- 页面资源（phase-04 时点）：86 个 `<script src>`（全部 `js/`）、`js/emoji.webp`、`js/sound_events.js`（运行期）、`sounds/sfx/*.m4a`（运行期）、`favicon.svg`；phase-05 为 87 个脚本（新增 `js/mp.js`）。
- 字体/贴图/数据仍由构建生成的 `js/font.js`、`js/assets.js`、`js/*_data.js` 提供（data URI/JSON），不依赖 CDN。
- `scripts/serve.mjs`：静态白名单仅 `index.html`、`js/*.{js,webp}`、`sounds/sfx/*`、`favicon.svg`；拒绝 docs/scripts/server/.git/点文件/目录/路径穿越。
- 缓存：HTML/JS `no-cache` + `ETag`（条件请求 304）；音效 `public, max-age=2592000`；图片/favicon `max-age=604800`；MIME 显式；支持 HEAD。
- `HOST=0.0.0.0` 仅用于局域网设备验证；TLS/公网/反代留 phase-08。

### 13.4 输入、全屏与移动端

- 桌面：键盘 `KeyboardEvent.code`；鼠标事件；Pointer Lock（失败时自由鼠标降级 + 一次提示）；全屏（F11 由游戏绑定统一处理，避免浏览器与游戏双触发）。
- 移动：`TouchDevice` 仍按 UA/触控点识别；摇杆、跳跃、攻击/使用、互动、潜行、疾跑、快捷栏、多点触控保留。
- `Stage` 使用 `visualViewport` 实际宽高；`visualViewport` resize/scroll、window resize、orientationchange 按帧合并；尺寸/DPR/安全区不变时跳过重排，避免清空 UI 画布。
- 安全区：CSS `env()` 探针；竖屏 CSS 旋转 90° 时按“上→左、右→上、下→右、左→下”映射到舞台坐标；HUD/聊天/触控按钮按 `UI.safe()` 避让。
- 全屏/方向：触摸第一次进入世界时空闲触发；Android 可请求全屏并锁横屏；iOS/不支持元素全屏时跳过，不阻断 CSS 横屏路径。

### 13.5 第三方网络边界

- `NET_CONFIG.announce = false`；`social.js` 不再在单人游戏后台每分钟请求旧房间服务的 `/api/announce`。
- 旧房间服务仍由用户主动打开多人界面时使用（房间列表/加入/皮肤查询），phase-05 替换。
- 启动、标题、单人创建/保存/65 s 游玩均无第三方平台请求（见 TEST_REPORT）。

### 13.6 风险与未覆盖

- 真实 Android Chrome / iOS Safari / iOS WebKit 未测；移动端结论均来自 Chromium 视口/UA/触控/安全区模拟。
- 真实 GPU 性能、手机发热、长时间运行未测。
- 静态服务器无 TLS/鉴权/限流/Range；不是生产部署。
- 旧房间服务、`/api/skin`、管理员公告仍属 phase-05；本阶段只关闭后台自动轮询。
- Chrome 83 旧 headless 偶发 `chunk stall`（K-39）；世界仍进入 `play`。

## 14. 阶段 5 变更（2026-11-12，已验收；代码 `817bad3`；docs 收尾为当前 HEAD；已推送）

> 页面脚本 86 → **87**；`js/` 90 → **91**；新增 `server/`。本节是 phase-05 的实现事实；
> 旧的 `NetClient`/`RoomService`/`p2p` 仍保留，自建服务器是第三条联机路径。

### 14.1 进程与模块

```
浏览器（MPClient） ── HTTP ──> server/http.mjs（静态白名单 / healthz / 管理接口）
        │
        └── WebSocket /ws ──> server/ws.mjs ──> server/rooms.mjs（RoomManager + Room）
                                                    │
                                                    └── server/storage.mjs（world.json / backups / logs）
```

| 模块 | 职责 |
|---|---|
| `server/index.mjs` | 配置、HTTP/WS 启动、20 TPS tick、pid、信号/正常关闭 |
| `server/ws.mjs` | 零依赖 RFC 6455：握手、掩码、分片、ping/pong、close、消息/连接/心跳限额 |
| `server/http.mjs` | 静态白名单（`index.html`、`js/*`、`sounds/sfx/*`、`favicon.svg`）、ETag/304、缓存、安全头、`/healthz`、`/api/status`、本机管理接口 |
| `server/protocol.mjs` | 名称/聊天清洗、位置/状态/方块/方块实体/掉落物/pstate 校验、协议限额 |
| `server/blockids.mjs` | 读取游戏 `blockdata.js`/`blocks.js` 的完整 ID 集（含动态花朵/羊毛/玻璃/混凝土表），当前 1257 个；未知 ID 拒绝 |
| `server/rooms.mjs` | 房间/邀请码/临时 ID/令牌/权限/限流/同步/快照/房主转移/关闭/保存 |
| `server/storage.mjs` | 原子写、每房存档、备份保留、损坏回退、管理令牌、pid |
| `server/config.mjs` / `config.json` | 配置校验（host/port/dataDir/上限/限流/备份/恢复窗口） |
| `server/log.mjs` | JSONL 日志、按日、保留、敏感键脱敏 |

依赖补充：`blockids.mjs` 启动时读取客户端生成数据 `js/blockdata.js` 与 `js/blocks.js`（含动态表），
因此服务器必须与同一版本的 `js/` 一起部署；`js/mp.js` 依赖 `net.js` 的 `NetPlayer`/`netEntityTick`、
`p2p.js` 的包装顺序、`platform.js`/`screens.js`/`GuestSession`，必须排在 `p2p.js` 之后加载。

### 14.2 协议（文本 JSON + WebSocket）

客户端 → 服务器：

| 消息 | 作用 |
|---|---|
| `hello{v:1,name,look?}` | 协议/昵称/外观；服务器回 `hello{ok,v,server,limits}` |
| `create{room{name,maxPlayers,gamemode,difficulty},world{seed,spawn,name}}` | 创建房间；服务器生成邀请码 |
| `join{code}` | 凭邀请码加入 |
| `resume{code,pid,token}` | 断线/刷新恢复同一临时 ID |
| `state{pos,yaw,pitch,armor,mode,held,sneak,swing,swim,dead,flying,health,look}` | 10 Hz 玩家状态 |
| `pstate{data{pos,health,food,sat,xp,inv,sel,mode,look}}` | 10 秒一次，供服务器存档/恢复 |
| `b{list[[x,y,z,id,meta,wl]]}` | 玩家动作窗口内的方块改动 |
| `be{k,data}` | 方块实体（箱子/告示牌等，≤4 KB） |
| `chat{text}` | 聊天（≤256 字符，1 条/秒突发 3） |
| `drop{stack,pos}` / `pickup{id}` | 掉落/拾取（服务器实体） |
| `kick{pid}` / `transfer{pid}` / `close` | 房主权限 |
| `leave` / `ping` / `respawn{pos}` | 离开/心跳/重生锚点 |

服务器 → 客户端：

| 消息 | 作用 |
|---|---|
| `welcome{you,room,world,players,limits}` | 身份/令牌/房间/世界元数据/玩家列表 |
| `blocks{list,more}` / `blockEntities{list}` / `items{list}` / `ready` | 加入时的完整增量（分批） |
| `E{players,items}` | 10 Hz 玩家/物品快照 |
| `b` / `be` / `itemAdd` / `itemRemove` / `give` | 方块/实体/掉落物增量 |
| `players` / `join` / `leave` / `chat` | 成员/聊天 |
| `env{time,weather,rain,difficulty}` | 世界时间/环境 |
| `correct{pos}` / `reject{list,reason}` | 移动校正 / 方块拒绝 |
| `kicked` / `closed` / `left` / `error` / `pong` | 生命周期/错误 |

### 14.3 权威边界（本阶段的准确表述）

| 数据 | 权威 | 说明 |
|---|---|---|
| 房间/邀请码/成员/房主/权限 | 服务器 | 客户端传的 owner/admin 字段被忽略 |
| 临时玩家 ID/会话令牌 | 服务器 | 令牌只回给本人；服务端存 SHA-256 |
| 方块覆盖层 | 服务器 | 接受后广播并计入存档；客户端本地动作窗口筛选 + 服务器距离/频率校验 |
| 方块实体 | 服务器 | 最后写入胜出，大小/深度/数量限制；客户端对已加载实体做差异上报（`open/lid/viewers` 等表现字段不上报） |
| 玩家实体位置/朝向/外观/生命 | 服务器（校验后） | 超速拒绝并 `correct`；生命/背包的自报只用于自己恢复 |
| 掉落物 | 服务器 | 位置/堆栈/拾取距离/延迟/上限 |
| 世界时间 | 服务器 | 20 TPS 递增；空房暂停 |
| 地形 | 客户端 | 相同 seed 确定性生成；服务器只存 seed + 覆盖层 |
| 生物/红石/流体/战斗 | 客户端本地 | **不同步**；多人结果可能不一致（phase-05 边界） |
| 渲染/摄像机/UI/输入/动画 | 客户端 | 服务器不渲染画面 |

### 14.4 客户端接入点（`js/mp.js`）

- `MPServer`：地址（`NET_CONFIG.server`/同源/`mcjs-mp-server`）、`/healthz`、创建/加入/恢复、邀请链接。
- `MPClient`：
  - `srv~<code>` 世界：`DB.getWorld/chunkKeys/getChunk/putWorld/putChunks` 对 `srv~` 重定向/空操作；
  - `finishChunk` 后应用该区块的服务器覆盖层；
  - `syncBlockEntities` 每 500 ms 对已加载方块实体做差异比较，最多发 2 条 `be`；不发送 `open/lid/viewers`；
  - `World.setBlock/setMeta/setWaterlogged` 只在 `actionUntil` 窗口内、玩家附近时排队上报；
  - `Game.breakBlock/placeAt/useOnBlockItem` 设置动作窗口；避免本地随机刻/流体/红石全部上传；
  - `Game.tick` 包装调用 `MPClient.tick()`（10 Hz state、pstate、方块批次、时间/环境、拾取）；
  - `Game.dropItem` 4.5 格内交给服务器（服务器阈值为 6，留位置延迟余量），更远仍本地（不共享）；
  - `Game.quitToTitle/saveWorld/respawn/changeDimension` 对服务器房间做特殊处理；
  - `runCommand` 在服务器房间只发聊天，不允许命令；
  - 旧 `NetClient`/`RoomService`/`LocalHost/LocalGuest` 未改。
- 界面：`MPServerScreen`、`MPCreateScreen`、`MPRoomScreen`；入口在 `MultiplayerScreen`，暂停菜单入口在
  `PauseScreen`。
- 断线：`MPClient.onClose(ws)` 只处理当前 socket，旧 socket 的 open/message/error/close 全部忽略；
  三次退避 `resume`；成功则保留本地世界，只补玩家/方块/物品增量。

### 14.5 存档与恢复

`server/data/worlds/room-<code>/world.json`：

```json
{
  "v": 1, "code": "...", "dir": "room-...", "name": "...", "maxPlayers": 4,
  "gamemode": "survival", "difficulty": 2, "createdAt": 0, "ownerPid": "p_...",
  "closed": false, "world": { "seed": 12345, "gen": 2, "spawn": [x,y,z], "time": 6000 },
  "blocks": [[x,y,z,id,meta,wl]],
  "blockEntities": [["x,y,z", { }]],
  "players": [{ "pid": "p_...", "name": "...", "tokenHash": "...", "state": { } }]
}
```

- 原子写：临时文件 + 重命名；同一房间的保存串行化（避免 Windows 并发 rename EPERM）。
- 备份：保存前按间隔复制到 `backups/room-<code>/<timestamp>.json`，保留 `backupKeep` 份。
- 损坏：启动读取失败时尝试最新备份；日志 `world_recovered_from_backup`。
- 房间关闭：`closed=true` 保存并从内存移除；邀请码不复用（`usedCodes`）。
- 服务器重启：加载所有未关闭房间；玩家离线但保留令牌哈希与 `pstate`，在恢复窗口内可 `resume`。

### 14.6 安全控制

- 静态白名单 + 路径穿越/点文件/目录拒绝；`server/data` 永不静态公开。
- 管理接口：本机回环 + `X-Admin-Token`；普通玩家不可达；令牌不写日志。
- WS：来源检查、连接上限、消息大小、分片/掩码校验、连续协议错误关闭、心跳超时终止。
- 房间：邀请码 8 位（去易混字符）、服务器唯一；按 IP 的加入/创建限流；人数上限；昵称消歧。
- 消息：未知类型/类型错误/范围错误拒绝；方块距离/频率；方块 ID 精确白名单（启动时从
  `js/blockdata.js`/`js/blocks.js` 读取全部 1257 个，含动态表；未知 ID 拒绝）；移动速度/界内；聊天/名称清洗。
- 关闭：先停止接新连接并保存房间，再清空 HTTP 连接；8 秒强制退出仅作为最后保护。
- 客户端不能自报 owner/admin；权限只看服务器会话。

### 14.7 测试与限制

- 详见 `docs/phases/phase-05-server/TEST_REPORT.md`：服务端 62/62、双浏览器 18/18、单人回归 6/6；
  修复复核 F-A 1257/1257、F-B 7/7、F-C 18/18、F-D 35/35、F-E/F-F 6/6。
- 未测：真实 LAN 双设备、公网/TLS、长时间/压力、真实 GPU/移动端、服务端生物/红石/战斗。
- 已知边界：K-67…K-80（`docs/KNOWN_ISSUES.md`）。

## 15. 阶段 6 变更（2026-11-12，已验收；代码 `b4833b8`；docs 收尾为当前 HEAD）

> 本节是 phase-06 的实现事实。数据库结构、页面脚本数（87）和服务器模块数均未变；
> 改动集中在存档边界、恢复路径和界面说明。

### 15.1 存储矩阵

| 世界 | 标识 | 位置 | 权威 | 不进入 |
|---|---|---|---|---|
| 单人世界 | `w` + 时间戳 + 随机后缀 | 浏览器 IndexedDB `mc-js-clone`（`worlds` / `chunks`） | 本浏览器 | `server/data/` |
| 服务器房间世界 | `srv~<邀请码>` | `server/data/worlds/room-<code>/world.json` | 服务器 | 浏览器 IndexedDB |
| 旧云存档残留 | 无（旧账号字段） | 本地 `cloud` 字段 / `mcjs-cloud-dirty-*` / `mcjs-account` | 无（只保留） | 不迁移、不删除 |

两种世界即使名称相同也使用不同 ID/目录；删除、保存、刷新都只作用于各自的存储。

### 15.2 本地存档（`js/save.js`）

- `DB.isServerWorld(id)`：`srv~` 前缀判断。
- `DB.newWorldId()`：唯一 ID（时间戳 + 随机后缀 + 存在性检查）；`Game.createWorld` 与
  `VanillaImport.run` 共用。
- `listWorlds` 过滤 `srv~`；`getWorld/loadChunks/chunkKeys/getChunk` 对 `srv~` 返回空；
  `putWorld/putChunks/deleteWorld` 对 `srv~` 空操作。这是 `mp.js` 之外的**第二层**防线，
  防止加载顺序/包装错误把服务器世界写进单人库。
- 泄漏的 `srv~` 记录只从列表隐藏，不在本地删除（服务器数据不在浏览器里被“清理”）。
- 数据库名、`worlds`（keyPath `id`）、`chunks`、区块编码未变；旧世界无需迁移。

### 15.3 客户端保存路径（`js/game.js`、`js/mp.js`）

- `Game.saveWorld` / `quitToTitle` / `captureIcon` 遇到 `srv~` 世界不写本地；`mp.js` 仍在
  房间内把 `saveWorld` 改为 `pstate`、`quitToTitle` 改为离开房间。
- `MPClient.buildMeta()` 加 `server:true`（仅内存）；`cleanup()` 清除对应 `g.worldMeta`，
  避免断线/失败后残留 `srv~` 元数据。
- `Game.createWorld` 与导入不再用毫秒时间戳直接作 ID。

### 15.4 服务器存档（`server/storage.mjs`）

- `loadAll` 对 `world.json`：
  - 解析失败 → 最新可读备份；
  - 解析成功但 `_validRecord` 失败 → 最新可读备份；
  - 恢复成功 → 原子写回 `world.json`（日志 `world_recovered_from_backup` +
    `world_recovered_written`），损坏文件不会成为新备份；
  - `record.dir !== 目录名` → `world_dir_mismatch`，拒绝加载（不跨房）。
- 保留 phase-05 的原子写、按房串行、60 秒定时保存、关闭保存、备份轮换/保留、信号/异常关闭流程。
- 异常退出最多丢失 `autosaveSeconds` 内改动；本阶段用 1 秒配置验证“最近定时保存可恢复”。

### 15.5 界面区分（`js/screens.js`、`js/mp.js`）

- 标题入口提示：单人世界只在本浏览器；服务器房间世界在服务器，和单人存档分开。
- 单人世界列表标题：`选择世界（仅保存在此浏览器）`；创建按钮提示写 IndexedDB。
- 自建服务器界面：`房间世界保存在服务器；与单人世界同名也不会互相覆盖`。
- 暂停菜单“离开房间”提示：房间世界仍在服务器，可凭邀请码再次加入。

### 15.6 测试与边界

- 服务端双存档 22/22；浏览器双存档 31/31；旧存档样本复验；phase-05 回归 62/62 + 18/18 + 6/6；
  91 JS + 9 mjs `node --check`；87 页面脚本；`git diff --check`。
- 旧云存档不迁移/不删除；服务器世界不提供浏览器下载或统一列表；在线恢复备份无 UI；
  真实 LAN/公网/TLS/压力/长时间运行未测；K-73 跨版本仍未做。
- 已知新增边界：K-81…K-86（`docs/KNOWN_ISSUES.md`）。

## 16. 阶段 7 变更（2026-11-13，验收结束；代码 `508fcc8`；docs 收尾为当前 HEAD）

> 本节是 phase-07 的实现事实。页面脚本仍 **87** 个、`js/` **91** 个 `.js`、服务端 **9** 个 `.mjs`；
> 未改 WebGL2 渲染体系、数据库结构、服务器存档模型。所有性能数字见 `docs/testing/performance-baseline.md`。

### 16.1 客户端帧预算

- `FramePacer.budget()`：手机/平板主线程区块工作上限 **8 ms**，桌面 **12 ms**；仍按显示刷新、帧上限、
  实测“其它主线程工作”和回退系数计算。区块任务不可拆分，因此这同时约束单次卡顿。
- `Game.flushMesh()`：方块编辑不再一次同步重网格 5×5 个区块；按当前区块预算先做最近的，余下保持 dirty，
  下一帧由 `updateChunks()` 的异步/同步队列继续。`_meshCand` 复用数组，减少每帧分配。
- `PerfMon.ts` 保存每帧时间戳；`Game.longRun()` 按时间戳取“这一秒内”的帧，避免计时器延迟时环形缓冲重复
  旧帧、把长跑 FPS 算高。
- `PerfMon.measure(ms)` / `sampleStats()`：结构化帧时间、p50/p95/p99、CPU/区块/渲染、GPU timer；供测试与
  画质建议复用。（`PerfMon.report()` 仍输出原来的文本报告。）

### 16.2 动态分辨率（`DynRes`）

- 目标：显式 `maxFps` 优先；否则 60 FPS（不再追求 90/144 Hz 面板刷新率，避免为不需要的帧降分辨率）。
  实现为：显式限制用 `1000/limit`；VSync 跟随显示器用 `max(显示器间隔, 1000/60)`；VSync 关闭用
  `1000/60`。因此 30 Hz 显示器目标 33.3 ms、90/144 Hz 目标 16.67 ms，不再退化为 11.1/4.17 ms。
- 判定：1.5 s 窗口的**平均帧时间** + 迟到帧比例（>1.15×目标帧超过 5%），主线程平均低于 0.7×目标才归因 GPU；
  只有 GPU 慢时才降分辨率。两个窗口连续慢：第一次降 20%，之后每次 10%。
- 下限：手机/平板 0.4，桌面 0.5；恢复仍为两次按时窗口 +10%，带 30 s 防抖。
- 手机/平板地形顶点 arena 页 **4 MB**（桌面 8 MB）；arena 仍按 used/total 压缩空闲页。

### 16.3 画质与预算

- 预设仍为低/中/高/极高 + 自定义；视频设置的轮换包含“自定义”。
- `Game.applySettings()` 按画质档设置：
  - `renderer.entityDist`：低 64、中 96、高 128、极高 160 格（并受实际渲染距离限制）；
  - `renderer.entityShadowDist`：32/48/64/80 格；
  - `Particles.max`：1200/2000/3200/4000。
  这些是**瞬态/远距预算**，不删除生物、粒子类型或模型；高档仍保留全部。
- 视频设置新增“测试性能并推荐画质…”：打开 `QualityScreen`，在实时画面上读回 GPU 完成时间，按实测推荐并应用；
  Esc 可取消并恢复原设置。首次进入仍走原有 `QualityScreen`。
- `Game.qualityAdvice()`：每个世界载入 12 s 后，用最近 240 帧的 FPS/p95 给一次提示，**不自动改**玩家画质；
  与 `QualityScreen` 的实际测量互补。
- `PerfMon.recommend()` 的 target 为 `min(60/30 目标, pacer.limit)`：玩家主动 `maxFps=30` 不会被误判为
  设备性能不足；`maxFps=60` 且实测 30 FPS 时仍会建议降档。
- 低/中档的实体距离/阴影/粒子上限是预算；`Particles.spawn()` 满额返回 `undefined`，调用方必须判空。

### 16.4 实体/粒子/内存

- `drawEntityList` 使用 `renderer.entityDist` 做水平距离裁剪；`drawMob` 只给 `entityShadowDist` 内的实体画地面阴影。
- `Particles.spawn` 使用可调 `max`（默认 3000；按档位降低），不改变粒子类型/生命周期。
- 已解码的存档区块记录（`World.savedChunks`）在 `decodeChunk` 后立即删除；记录只在“等待解码/未卸载的修改”时
  保留。之前每条已加载柱都同时持有 encoded + decoded 两份数据。
- `Renderer.visScratch` 复用可见区段数组；`VertexArena` 支持按设备选择页大小。

### 16.5 网络诊断

- `MPClient.netStats`：发送/接收字符数（近似字节；中文/emoji 会偏低，K-94）、消息数、5 s 一次 `ping` 的
  RTT（服务器回 `pong{t0}`）。
- F3 性能屏/性能报告显示延迟、上下行累计和接收速率；不影响原有同步频率（10 Hz state / 10 s pstate）。
- 服务器广播（`Room.broadcast` / `broadcastToRoom`）只 `JSON.stringify` 一次，所有连接复用同一文本帧。

### 16.6 服务器 20 TPS 与指标

- 发现：Windows Node 的 50 ms `setInterval` 实际约 62.5 ms（16.1 TPS）；逻辑 tick 仅 0.14–0.60 ms。
  修复后本机 2/5/10/30 连接 19.97–20.00 TPS，tick 0.12–0.39 ms，CPU 0.4–2.7%。
- `RoomManager.start()`：10 ms 唤醒，`tickScheduler()` 按 50 ms 到期补 tick（一次最多 3 个），
  目标 20 TPS；`stop()` 清定时器。
- `RoomManager.perf`：5 s 滚动 TPS、tick 平均/最大、>100 ms 迟到 tick、CPU%；`perfStatus()` 另取 RSS/heap。
  管理接口返回，公开 `/healthz`、`/api/status` 删除 `perf`（与 `stats` 一样仅管理可见）。
- `server/index.mjs` `VERSION=0.7.0`。

### 16.7 K-39

- `Game.chunkWatchdog()` 不再只看“同一 7×7 缺失 8 s”：
  - 缺失项仍有 `genPending` / `protoKeys` / `proto` 归属，且 12 s 内有进展 → 等；
  - 有 saved-chunk 读取（`savedFetch`）→ 等（数据库层自己重试）；
  - 生成/装饰/完成/网格队列仍忙，或 30 s 内任何区块/生成/worker 结果有进展 → 等；
  - 只有“7×7 缺失 + 管线空闲 + 8 s 无任何进展”才报告并清理重请求。
- 在 SwiftShader + CPU 8× 限速下：基线刷新 46.6/46.9 s + 3 次 `chunk stall`；优化后 8.8/8.7 s + 0 次。
  phase-07 验收结束；真实设备仍未复测。

### 16.8 测试与未测

- 桌面固定场景首轮 8 项 60 FPS；重复轮次光影 3/4 为 59.8/57.1 FPS（K-93）；手机视口模拟 60 FPS；编辑、
  K-39、服务器 2/5/10/30 连接、回归见 `phase-07/TEST_REPORT.md`。
- 真实手机（Android/iOS）GPU/发热/触控、真实 LAN、公网/TLS、>1 小时连续运行仍 **NOT TESTED**；
  模拟数据不得写成真机达标。phase-07 验收结束；代码 `508fcc8`；docs 收尾；未推送。

### 16.9 依赖与调用关系（phase-07 后）

- 客户端加载顺序：`screens.js` → `touch.js` → `perf.js` → `onboard.js`；`p2p.js` 仍在 `mp.js` 前。
  `Game.init()` 在 `load` 事件后运行，因此 `Game.applySettings()` 使用 `perf.js` 的 `PRESETS`、`DynRes`，
  以及 `touch.js` 的 `TouchDevice` 时这些符号已定义。
- `Game` → `FramePacer`/`PerfMon`/`DynRes`（`js/perf.js`）；`Game.applySettings()` → `PRESETS`；
  `Game.frame()` → `Game.qualityAdvice()` → `PerfMon.recommend()`；`Renderer.makeSectionVao()` → `TouchDevice`。
- `OptionsListScreen`（`js/screens.js`）→ `QualityScreen`（`js/onboard.js`）→ `PerfMon`/`DynRes`；
  `QualityScreen` 可包装 `Game.render`，仅用于测试，退出/取消必须 `unhook`。
- 服务器：`RoomManager`（`rooms.mjs`）→ `tickScheduler()`/`perfStatus()`；`Room.broadcast()` →
  `WSConnection.sendText()`（`ws.mjs`）；`http.mjs` 的公开状态过滤 `stats`/`perf`；`status.ps1` 读 admin。
- 无新页面脚本/资源文件；仍是 87 个 `<script src>`、91 个 `js/*.js`、9 个 `server/*.mjs`。
