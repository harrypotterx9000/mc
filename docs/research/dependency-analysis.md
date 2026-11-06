# 依赖分析（research/dependency-analysis）

> 依据：跨文件补丁扫描（`structure-scan.json`）、全局引用计数、既有代码阅读。
> 结论全部为静态事实；"删除影响"是**推断**，未做破坏性实验。

## 1. 跨文件补丁（改动必查）

| 方法 | 文件数 | 文件 |
|---|---|---|
| `Game.tick` | 10 | capes, cmdrun, enchant, extras, items3, mobs_animals, onboard, p2p, raids, redstone |
| `Game.placeAt` | 5 | cmdblock, decor, mobs_hostile, specials, vehicles |
| `Game.useEquipment` | 4 | equip, items3, itemuse, vehicles |
| `Game.drawChests` | 4 | beacon, blockents, decor, specials |
| `Game.tickFurnaces` | 3 | beacon, specials（2 处）, workstations |
| `Game.loadDimData` | 2 | dims, spawning |
| `Game.placeState` | 2 | redstone, vehicles |
| `Game.playerPose` | 2 | equip, vehicles |
| `Game.netUse` | 2 | net, cmdblock |
| `UI.open` | 2 | redstone, telemetry |
| `ChestScreen.close` | 1（被包） | redstone |

**顺序语义**：每个包装器在加载时捕获前一个函数，后加载的在外层；`tick` 执行顺序 = 最后加载 → … → `game.js` 原体。

## 2. 共享状态

| 状态 | 拥有者 | 主要读者 | 失效影响 |
|---|---|---|---|
| `game.world.chunks` | `World` | 渲染/实体/红石/结构/刷怪/存档 | 全盘失效 |
| `game.worldMeta` | `Game`/`DB` | 维度/进度/云/P2P | 世界无法恢复 |
| `game.player.inv` | `Player` | UI/装备/合成/网络/载具 | 背包与合成全断 |
| `game.ui.screen` | `UI` | 输入/tick 暂停/渲染/遥测 | 输入错乱 |
| `game.settings` | `Game` | 渲染/音频/触屏/引导/遥测 | 画质与操作异常 |
| `Account.data` | `Account` | 房间/云/皮肤/签到/公告 | 在线与外观功能失效 |
| `RoomService` | `net.js` | 多人/P2P/云/签到/公告 | 所有在线功能失效 |
| `DB` | `save.js` | 世界/云/P2P 主机 | 存档不可用 |
| `Sound.listener` | `Game.tick` | 音频空间化 | 声音定位错误 |

## 3. 删除影响（推断）

| 删除 | 直接影响 | 连锁 |
|---|---|---|
| `dims.js` | 无维度/传送门/龙 | `tickPortals` 等被 `guard()` 吞错；每 tick 多条日志 |
| `terrain2.js` | 无 gen2 世界 | 新建世界卡 loading / `createWorld` 抛错 |
| `redstone.js` | 无红石 | 断掉 `Game.tick`/`World.setMeta`/`UI.open` 四层包装之一 |
| `equip.js` | 无副手/盾/载具姿态 | `useEquipment` 链断（4 文件共用） |
| `net.js` | 无联机 UI | 云/签到/公告入口消失（模块仍在） |
| `account.js` | 无登录/解锁 | 皮肤披风按钮引用缺失 → 报错 |
| `save.js` | 无持久化 | 刷新即丢 |
| `extras.js` | 辅助功能消失 | 主循环不受影响 |
| `telemetry.js` | 无统计 | 仅少一层 `UI.open` 包装 |

## 4. 修改同步

| 改动 | 需同步 |
|---|---|
| 背包槽位 | `ui.js`、`equip.js`、`net.js`、`items3.js`、`vehicles.js`、`save.js` |
| 新方块 | `blockdata.js`、`blocks.js`、`mesher`、`redstone`（可充能时）、`features`（自然生成时） |
| 新维度 | `dims.js`、`worldgen`、`spawning`、`render`（天空/雾）、`net.js`（维度映射） |
| 新界面 | `ui.js` 基类、`controls.js` 入口、`commands.js`（如 /help）、`telemetry` |
| 战斗公式 | `game.js`、`enchant.js`、`equip.js`、`net.js` |
| 渲染管线 | `render.js`、`mesher.js`、`shaders.js`、`vmodels.js`、`blockents.js`、`emodel.js` |

## 5. 对 phase-01/02/03 的直接影响

- 主菜单删公告/解锁/反馈：集中在 `screens.js`（TitleScreen）、`news.js`、`skins.js`、`checkin.js`、`social.js`、`account.js` 的入口注入。
- 删除账号：`account.js`（账号/登录/解锁/诊断）、`toy.js`（桥）、`cloudsave.js`（云）、`news.js`/`checkin.js`（服务端内容）、`p2p.js`/`net.js`（联机门槛）、`onboard.js`（登录步骤）。
- 开放皮肤披风：`skins.js` 的解锁判定、`capes.js` 的 `locked` 逻辑、`cosmetics.js` 的 `owned` 判定。
