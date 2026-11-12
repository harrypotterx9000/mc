# OpusMC 架构说明（ARCHITECTURE）

> 依据：`D:\Projects\OpusMC` 当前源码（phase-01 后 88 个加载脚本、92 个 `.js`，构建 `47455601425408-v39426`）+ 静态扫描 + 既有运行时探针。
> 标注：**[事实]** 源码可复核；**[实测]** 运行时读到；**[推断]** 未运行验证。

## 1. 总体形态

单页 WebGL2 应用，无框架、无打包器：

- `index.html` 按固定顺序加载 **89** 个 `<script>`（phase-01 删除 `news.js` 后；原为 90），全部挂在全局作用域。
- 数据文件（方块/物品/配方/结构/模型/贴图/字体）是构建脚本从原版数据生成的单行 JSON。
- 功能模块通过**给共享原型打补丁**扩展（`Game`、`Renderer`、`Player`、`UI`、`World`、`Mob`…）。
- 世界生成在 Web Worker（`gen_worker.js`），装饰/网格化在另一个 Worker（`chunk_worker.js`，按需创建）。
- 联机通过 WebSocket 连「原版 Java 服务器代理」；另有 WebRTC 本地房间。**服务器端代码不在本仓库。**

## 2. 分层与文件（[事实]）

```
加载顺序（88）
├─ 资源/数据  assets, font, emoji, texts, worldgen_data, blockdata, itemdata,
│             recipedata, structures_data, entitydata, etex, models, panorama_data, subtitles
├─ 内核       util → world → mesher → vmodels → render/render2 → shaders
├─ 内容       blocks → features → trees → structgen/structtypes → dims → mobs_* → items* → redstone
├─ 循环       game → terrain2 → perf
├─ 界面       ui → screens → commands → controls → touch → mobile → onboard
└─ 平台       netconfig → net → beacon/cmdblock → toy → account → capes/skins/cloudsave
              → social → companion → extras → cosmetics → checkin → p2p → panorama
```

- **206 个顶层类声明**（phase-0 为 213；phase-01 删除 7 个界面/面板类）、**77 个 `*Screen` 类**（原 84）；按 `Game.prototype.* =` 赋值扫描，**40 个文件、257 处、174 个方法名**（含包装器；旧口径“28 个加方法文件”不再作为准确计数）。扫描明细见 `research/dependency-analysis.md`。
- 运行时懒加载（不在 88 个 `<script>` 中）：`js/chunk_worker.js`、`js/skins_data.js`、`js/vstates_data.js`、`js/sound_events.js`、`js/emoji.webp`；音效文件 `sounds/sfx/*`（4,849 个 m4a，已随项目提供）。

## 3. 关键对象与状态归属（[事实]）

| 对象 | 拥有者 | 关键字段 | 主要读者 |
|---|---|---|---|
| `game` | `js/game.js` | `state, world, worldMeta, player, entities, ui, settings, genPool` | 几乎所有模块 |
| `world` | `js/world.js` | `chunks, minY, gen2, W/H` | 渲染、实体、红石、结构、刷怪、存档 |
| `player` | `js/entity.js` | `pos, inv, health, effects, mode` | UI、装备、网络、载具 |
| `ui` | `js/ui.js` | `screen, chat, input, debug` | 输入、tick、渲染 |
| `DB` | `js/save.js` | IndexedDB 封装 | 世界、云存档、P2P 主机 |
| `Account` | `js/account.js` | `data, loggedIn` | 房间、云、皮肤、签到、公告 |
| `RoomService` | `js/net.js` | 房间 API 封装 | 多人、P2P、云、签到、公告 |
| `NetClient` | `js/net.js` | WS 连接、玩家表 | 联机 UI、命令方块、皮肤、社交 |
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

**联机**：`NetClient.connect → WS → hello{name,version,proto,room,key,token} → 服务端权威消息（53 种 case）`

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
- 注释指向 `multiplayer/proxy` 与 `multiplayer/rooms`，但**仓库内没有任何创建服务器的代码**（扫描：0 个文件监听端口）。
- 现有房间服务地址 `https://xz.honghemc.cn:8443`（`js/netconfig.js`），属于原作者；本项目将替换为自建服务器。
- **推断**：自建服务器需要新增：权威世界模拟（或复用现有单机逻辑跑在 Node）、房间/身份、协议编解码、状态同步、服务器存档、规则校验。

## 7. 自建服务器设计草案（下一阶段细化，非本阶段实现）

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
2. 平台模块（Toy/Account/Net/Cloud/News/Checkin）与主循环耦合在标题界面与暂停界面，删除需同步改 UI。
3. `Game.tick` 的包装链让"删功能"比"加功能"更容易出错，阶段改造必须先列补丁清单。
4. 无构建系统，任何新模块都必须手工加入 `index.html` 且注意顺序。

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
- 仓库内没有服务器端代码：`server/` 只有 `.gitkeep`；`scripts/serve.mjs` 只提供静态 GET/HEAD。
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

> 本阶段不新增文件、不改 `index.html` 脚本顺序；脚本数仍 88，`js/` 仍 92 个 `.js`。

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
- 本地外观仅本设备；换设备需登录账号（phase-03 之后按访客模式另行设计）。
- 首启仍保留登录步骤（可离线游玩），属于 phase-03。
