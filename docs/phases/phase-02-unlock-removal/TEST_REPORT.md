# phase-02 测试报告

- 日期：2026-11-12
- 结论：**本地静态检查与无头浏览器回归通过；真实服务器/真机未测**
- 自动检查：**27 项 PASS，0 项 FAIL**；独立验收另计 **35 项运行时检查 PASS**（见 `ACCEPTANCE.md`）
- 代码状态：**已提交 `a9dc47b`**（代码）；docs 收尾为当前 HEAD；未推送/未合并
- 基线：`develop` @ `a66c0bf`；代码基线 `15154bd`

## 1. 环境

| 项 | 值 |
|---|---|
| 工作区 | `D:\ds\REA\opusmc` |
| 服务 | `node scripts/serve.mjs`，`127.0.0.1:8080` |
| 浏览器 | Edge 157.0.4341.46 无头 + SwiftShader（独立临时 profile） |
| Node | v26.13.0 |
| 视口 | 1280×720（截图 1254×593） |
| 状态 | 清空 `localStorage`，跳过首启引导（`onboarded=true`） |

## 2. 静态检查

| 检查 | 结果 |
|---|---|
| 92 个 `js/*.js` 全量 `node --check` | 通过 |
| `index.html` 脚本数 | 88（未变） |
| `js/` 文件数 | 92 个 `.js` + `emoji.webp`（未变） |
| `git diff --check` | 通过 |
| 已删判定扫描 | 运行时无 `Account.has('skin')` / `Capes.evOwned` / `Account.data.owned` 外观判定调用 |
| 行尾 | 源码保持 LF（`cosmetics.js` 的一次 CRLF 写入已归一） |

## 3. 自动回归（27 项）

测试脚本：`D:\ds\REA\_work\phase02-test.mjs`；结果：`D:\ds\REA\_work\phase02-test-result.json`。

| # | 检查 | 结果 |
|---|---|---|
| 1 | 披风总数 | 23 |
| 2 | 全部披风 `unlocked` | 全 true |
| 3 | 管理员披风存在且开放 | 13 款（8 王冠 + 5 管理员）全开放 |
| 4 | 活动披风开放 | 3 款（企鹅、摇摆企鹅、金苹果） |
| 5 | 装饰总数 | 8 个 id 全部 `has()` true |
| 6 | 皮肤预设 | 18 个 |
| 7 | 游客初始外观 | null（无旧账号/旧外观） |
| 8 | 18 个预设皮肤加载 | 全部 64×64 |
| 9 | 23 款披风纹理构建 | 全部成功 |
| 10 | 皮肤页 | 默认 + 18 款，0 锁定 |
| 11 | 披风页 | 23 款全部显示，0 锁定 |
| 12 | 帽子页 | 3 顶全部显示，0 锁定 |
| 13 | 宠物页 | 小雪人显示，0 锁定 |
| 14 | 前缀页 | 土豆前缀显示，0 锁定 |
| 15 | 逐项点击 | 18 皮肤 + 23 披风 + 3 帽子 + 1 宠物 + 1 前缀全部可点，无登录/签到跳转 |
| 16 | 游客保存外观 | 无 `LoginScreen`；写入 `mcjs-look`；按钮变「已保存」 |
| 17 | 全部外观预览 | 18 皮肤、23 披风、3 帽子、宠物、前缀均渲染出预览，0 错误 |
| 18 | 刷新恢复 | `Skins.look()`、`Capes.of()`、`Cosmetics.worn()` 全部恢复 |
| 19 | 恢复后渲染 | 皮肤纹理、管理员披风、帽子、宠物、前缀均生效 |
| 20 | 登录账号外观接管 | 模拟账号的 `skin` 被接管（皮肤/披风/帽子） |
| 21 | 多人入口 | 未登录点击「多人游戏」直接进入 `MultiplayerScreen`；不是 `LoginScreen`/`FollowGateScreen` |
| 22 | 邀请码控制 | 空码停留并提示；输入 `ABC123` 后调用 `joinRoom`（房间加入未被取消） |
| 23 | `onlineGate` | 无账号直接放行 |
| 24 | 创建世界 | `play`，67 区块，外观仍为已保存值 |
| 25 | 世界内渲染 | 0 错误（清除加载期 watchdog 记录后） |
| 26 | 23 款披风逐一应用到玩家 | 全部返回正确 id，0 错误 |
| 27 | 结束时 `game.errLog` | 空 |

补充专项（同一会话，单独执行）：

- 正版皮肤：未登录（`Account.has('skin')` 为 false）时用模拟 `/api/skin` 返回 PNG，`Skins.load('m:Phase02Test')` 得到 64×64 细手臂皮肤，`texOf` / `modelOf` / 预览均正常。
- 有账号保存：stub `Account.update` 后 `WardrobeScreen.saveLook()` 发送完整 `skin` 字段、返回「已保存」、`dirty=false`。
- **最终复测**：完成行尾归一、删除未用变量、移除账号界面的 `Account.loadGate()` 调用后，再次执行 smoke（`D:\ds\REA\_work\smoke.mjs`）：18 预设 / 23 披风 / 0 锁定、页签 19/23/3/1/1、游客保存与刷新恢复、多人无登录门槛且邀请码控制保留、`game.errLog` 0。结果 **SMOKE PASS**。

## 4. 截图

- `D:\ds\REA\_work\phase02-wardrobe-skin.png`（18 款皮肤 + 正版皮肤输入框）
- `D:\ds\REA\_work\phase02-wardrobe-cape.png`（23 款披风，含管理员与活动款）
- `D:\ds\REA\_work\phase02-wardrobe-hat.png`
- `D:\ds\REA\_work\phase02-multiplayer.png`（未登录多人界面）
- `D:\ds\REA\_work\phase02-ingame.png`（第三人称：管理员披风 + 皇冠 + 小雪人 + 名字前缀）

## 5. 已知噪音 / 非本阶段问题

- `xz.honghemc.cn:8443` 的原房间服务在本机返回 **403**：多人界面的公开房间列表显示红色「不允许从这个网页访问」；未改动该外部服务。房间服务可用性属于 phase-05。
- 一次世界加载中出现 `chunk stall`（`chunkWatchdog` 重新请求区块），随后进入 `play`；清理该条记录后外观渲染 0 错误。这是无头/SwiftShader 下的加载时延，不是本阶段外观改动引入。
- `favicon.ico` 404 为原有噪音。
- 控制台另有 `/api/event`、`/api/announce` 的 403，来自保留下来的账号/签到/公告模块（phase-03 处理）。

## 6. NOT TESTED

- 真实 GPU 60 FPS、手机/平板真机、长时间运行。
- 真实 B 站登录、真实 Mojang 皮肤查询（本阶段只用 mock 验证了权限路径；`/api/skin` 仍依赖外部房间服务）。
- 真实房间服务/WSS 加入、两名玩家互看外观（原服务 403；自建服务器在 phase-05）。
- 管理员披风的服务器端校验（客户端已开放；原房间服务可能仍按 `adm*` 校验，phase-05 统一替换）。
- 签到活动本身的领取（phase-03 时序未动）。

## 7. 末影龙通关结局实测（2026-11-12 补充）

补测 phase-01 唯一 NOT TESTED 项：**末影龙通关实际触发结局界面**。使用真实游戏流程（末日传送门进入末地 → 击杀末影龙 → 死亡动画 → 返回传送门 → `CreditsScreen`），不是直接 new 界面。

环境：Edge 157 无头 + SwiftShader；世界 `phase02-world`（gen2）；默认 `renderDist=8`；测试脚本 `D:\ds\REA\_work\endtest.mjs`，结果 `D:\ds\REA\_work\phase02-enderdragon-result.json`。

| # | 检查 | 实测 |
|---|---|---|
| 1 | 进入末地、龙战开始 | `dim=end`、龙 200 HP、10 个末地水晶、10 根柱子、中心区块已加载 |
| 2 | 击杀判定 | `hurtPart({head:true},999)` → 生命 0、`deathTime=1` |
| 3 | 200 tick 死亡动画后 | `end.dragonKilled=true`；返回传送门方块 175、龙蛋 176 已生成；经验球生成 |
| 4 | 进入传送门前 | `end.credits=false`，屏幕仍不是 `CreditsScreen` |
| 5 | 站到返回传送门 | `tickPortals` → `enterEndPortal` → `leaveEnd`；`CreditsScreen` 打开，`end.credits=true` |
| 6 | 结局界面内容 | 4510 行（终末之诗 + credits），首行 “I see the player you mean.”，`pauses=true` |
| 7 | 结束结局（Esc） | 回到主世界 `overworld`、`state=play`、`credits` 保持 true |
| 8 | 错误 | `game.errLog` 0，无 JS 异常 |

结果：**8/8 PASS**。截图：

- `D:\ds\REA\_work\phase02-end-fight.png`（末地龙战、进度“结束了？”）
- `D:\ds\REA\_work\phase02-credits.png`（终末之诗/结局界面）
- `D:\ds\REA\_work\phase02-after-credits.png`（回到主世界）

### 观察到的边界问题（未修复，记录为 K-41）

同一流程在 `renderDist=4` 下测试时：玩家在入口平台（约距中心 100 格）击杀末影龙，`onDragonKilled()` 对中心 `(0,0)` 区块调用 `World.setBlock`，但该区块未加载，`setBlock` 返回 false，导致**返回传送门与龙蛋不生成**；`dragonKilled` 仍为 true、经验球照常生成。默认 `renderDist=8` 时中心区块已加载，正常。

该问题与外观/解锁无关，属于既有世界逻辑；本阶段只记录，未修改，留给后续阶段确认是否修复（建议：`onDragonKilled` 先确保中心区块加载，或把待放置方块排队到区块加载后）。
