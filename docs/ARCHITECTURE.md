# OpusMC 架构说明（ARCHITECTURE）

> 依据：`D:\Projects\OpusMC` 当前源码（90 个脚本，构建 `47455601425408-v39426`）+ 静态扫描 + 既有运行时探针。
> 标注：**[事实]** 源码可复核；**[实测]** 运行时读到；**[推断]** 未运行验证。

## 1. 总体形态

单页 WebGL2 应用，无框架、无打包器：

- `index.html` 按固定顺序加载 90 个 `<script>`，全部挂在全局作用域。
- 数据文件（方块/物品/配方/结构/模型/贴图/字体）是构建脚本从原版数据生成的单行 JSON。
- 功能模块通过**给共享原型打补丁**扩展（`Game`、`Renderer`、`Player`、`UI`、`World`、`Mob`…）。
- 世界生成在 Web Worker（`gen_worker.js`），装饰/网格化在另一个 Worker（`chunk_worker.js`，按需创建）。
- 联机通过 WebSocket 连「原版 Java 服务器代理」；另有 WebRTC 本地房间。**服务器端代码不在本仓库。**

## 2. 分层与文件（[事实]）

```
加载顺序（90）
├─ 资源/数据  assets, font, emoji, texts, worldgen_data, blockdata, itemdata,
│             recipedata, structures_data, entitydata, etex, models, panorama_data, subtitles
├─ 内核       util → world → mesher → vmodels → render/render2 → shaders
├─ 内容       blocks → features → trees → structgen/structtypes → dims → mobs_* → items* → redstone
├─ 循环       game → terrain2 → perf
├─ 界面       ui → screens → commands → controls → touch → mobile → onboard
└─ 平台       netconfig → net → beacon/cmdblock → telemetry → toy → account → capes/skins/cloudsave
              → social → companion → extras → cosmetics → news → checkin → p2p → panorama
```

- 213 个类声明；**28 个文件**给 `Game.prototype` 加方法；19 个原型被跨文件补丁。扫描明细见 `research/dependency-analysis.md`。
- 运行时懒加载（不在 90 个 `<script>` 中）：`js/chunk_worker.js`、`js/skins_data.js`、`js/vstates_data.js`、`js/emoji.webp`；音效包 `js/sound_events.js` + `sounds/sfx/*`（4,849 个 m4a，已随项目提供）。

## 3. 关键对象与状态归属（[事实]）

| 对象 | 拥有者 | 关键字段 | 主要读者 |
|---|---|---|---|
| `game` | `js/game.js` | `state, world, worldMeta, player, entities, ui, settings, genPool` | 几乎所有模块 |
| `world` | `js/world.js` | `chunks, minY, gen2, W/H` | 渲染、实体、红石、结构、刷怪、存档 |
| `player` | `js/entity.js` | `pos, inv, health, effects, mode` | UI、装备、网络、载具 |
| `ui` | `js/ui.js` | `screen, chat, input, debug` | 输入、tick、渲染、遥测 |
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
| `UI.open` | 2 | 红石唤醒 + 遥测计数 |
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
