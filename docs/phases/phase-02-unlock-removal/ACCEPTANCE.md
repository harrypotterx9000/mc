# phase-02 独立验收报告

- 日期：2026-11-12
- 范围：phase-02 已提交改动 `a9dc47b`（外观全开放、多人入口、相关保存/渲染/回归）
- 基线：`develop` @ `a66c0bf`（phase-01 docs 收尾）；工作区 `D:\ds\REA\opusmc`
- 结论：**外观与多人入口的 phase-02 验收项通过；真实联机/真实账号依赖 BLOCKED；K-41 为单独立项的既有问题，本阶段不修复。**
- 代码状态：**已提交 `a9dc47b`**；docs 收尾为当前 HEAD；未推送、未合并、未进入 phase-03

## 1. 代码检查

### 1.1 文件清单

- 修改（源码 5）：`js/skins.js`、`js/capes.js`、`js/cosmetics.js`、`js/account.js`、`js/onboard.js`
- 新增（文档 3）：`docs/phases/phase-02-unlock-removal/PLAN.md`、`TEST_REPORT.md`、`HANDOFF.md`
- 修改（文档 10）：`docs/STATUS.md`、`START-HERE.md`、`ARCHITECTURE.md`、`DECISIONS.md`、`KNOWN_ISSUES.md`、`CHANGELOG.md`、`PROJECT_SPEC.md`、`docs/testing/regression-checklist.md`、`docs/phases/phase-01-menu-cleanup/HANDOFF.md`、`TEST_REPORT.md`
- 删除：**无**（没有删除源码/脚本/资源；`index.html` 未改）

### 1.2 静态检查结果

| 检查 | 结果 | 证据 |
|---|---|---|
| 完整 Git Diff 审阅 | 通过 | 5 个源码文件 diff 已逐行审阅；文档 diff 已审阅；`git diff --check` 无空白错误 |
| 脚本/文件计数 | 通过 | `index.html` 实际 88 个 `<script src="js/...">`；`js/` 92 个 `.js` |
| 已删除 phase-01 入口静态扫描 | 通过 | 无 `Telemetry`/`FeedbackScreen`/`AgreementScreen`/`PlayerKindScreen`/`UnlockScreen`/`UnlockSparks`/`NewsBoard`/`allUnlocked`/`playerKind`/`legalV` 残留；`js/news.js`、`js/telemetry.js` 不存在 |
| 真正权限判断 | 通过 | `Capes.unlocked()`、`Capes.of()`、`Cosmetics.owned/has/lookOf()`、`Skins.lookOf()`、`WardrobeScreen.saveLook()` 均已改；无 `Account.has('skin')`、`Account.data.owned`、`data.super` 外观判定 |
| 跨文件依赖 | 通过 | `Capes ↔ Skins`、`Skins ↔ Account/Capes`、`Cosmetics ↔ Skins/Capes`、`WardrobeScreen ↔ Checkin` 均为运行时调用；加载顺序未变，无启动 ReferenceError |
| Monkey Patch 数量/顺序 | 通过（未变） | 与 HEAD 逐文件比较：`Game.tick` 13/13、`drawMob` 6/6、`drawWings` 2/2、`drawEntityList` 1/1、`Font.render` 1/1、`NetClient.onMessage` 12/12；`index.html` 顺序 0 行改动 |
| 全局变量/单例 | 通过 | `Skins`/`Capes`/`Cosmetics`/`Account` 各 1 个定义；新增状态仅为 localStorage `mcjs-look`；无新增 window 全局 |
| 事件监听器 | 通过 | 变更文件未新增监听器；`FollowGateScreen` 的既有监听未改（单人 gate 的 dead code） |
| 资源/脚本引用 | 通过 | `index.html` 未改；未新增/删除脚本、音效或图片请求 |
| 全量语法解析 | 通过 | 92 个 `.js` 用 `vm.Script` 解析 0 失败；`git diff --check` exit 0 |

### 1.3 残留代码（非本阶段失败，phase-03 清理）

- `Account.checkUnlocks()`、`Account.has()`、`Account.tripleOk()`、`Account.unlocks` 方法仍在，但**无外观调用点**；`checkUnlocks` 无调用点。
- `ToyDiagScreen` 仍会读取 `/api/gate` 并显示“联机门槛”，只是账号诊断信息，不是权限判断。
- `singleGate()` 保留了 `FollowGateScreen` fallback；`SINGLE_OPEN=true` 会直接放行，属于 phase-01 遗留。
- `WardrobeScreen` 仍有 `locked`/`evHow`/`toCheckin` 死分支；所有已知项 `Capes.unlocked()`/`Cosmetics.has()` 均为 true，实测 0 锁定。
- 上述均不影响 phase-02 验收；账号/签到/Toy 的最终清理属于 phase-03。

## 2. 功能与回归测试

测试环境：Edge 157.0.4341.46 无头 + SwiftShader；Node v26.13.0；视口 1280×720；`node scripts/serve.mjs`，`127.0.0.1:8080`；全新浏览器 profile；清空 localStorage 后跳过首启引导。

| 测试项目 | 测试方式 | 结果 | 证据 |
|---|---|---|---|
| 18 款预设皮肤全部加载 | `Skins.load()` 逐一 await | PASS | 18/18 均为 64×64 |
| 23 款披风纹理全部构建 | `Capes.texKey()` 逐一 | PASS | 23/23 非空 |
| 管理员/活动披风开放 | `Capes.unlocked()` 全量 | PASS | 13 管理员 + 3 活动，0 锁定 |
| 8 个装饰开放 | `Cosmetics.has()` 全量 | PASS | 8/8 true，0 锁定 |
| 衣柜页签计数 | `WardrobeScreen.layout()` | PASS | 皮肤 19（默认+18）、披风 23、帽子 3、宠物 1、前缀 1；locked 0 |
| 全部外观可点击 | 逐项 `widget.onClick()` | PASS | 18/23/3/1/1 全部成功，无登录/签到跳转 |
| 全部皮肤/披风/装饰预览 | `Renderer.playerPreview()` 逐一 | PASS | 无异常，`game.errLog` 0 |
| 游客保存外观 | `WardrobeScreen.saveLook()` | PASS | 无 LoginScreen；写入 `mcjs-look`；提示“已保存在这台设备上”；dirty=false |
| 刷新恢复外观 | 重新加载页面 | PASS | 皮肤/披风/帽子/宠物/前缀/纹理均恢复，errLog 0 |
| 第一人称手臂/纹理 | `Skins.armOf()/texOf()` | PASS | `arm_slim`、`arm_left_slim`、`skin_p:alex_slim` |
| 名字前缀/字体包装 | `Cosmetics.tagName()` + `Font.render` | PASS | 前缀字符出现在名字前，无异常 |
| 远程玩家 look（管理员款） | `NetClient.prototype.onMessage` + `Capes.of` | PASS | `admender`/`crown`/`snowman`/`potato` 被接受并渲染 |
| 背包/第三人称预览 | `playerPreview(opts.inv)` + 实际渲染 | PASS | 23 款披风逐一 + 鞘翅翅膀，0 错误 |
| 登录状态保存路径 | mock `Account.update` | PASS | 完整 skin 字段发送，按钮变“已保存”，dirty=false |
| 未登录账号界面 | `new AccountScreen` | PASS | 登录/完成按钮正常；无 gate 请求；0 错误 |
| 未登录正版皮肤 | stub `/api/skin` + `Skins.load('m:...')` | PASS | `Account.has('skin')=false` 仍可加载/预览 64×64 细手臂 |
| 多人入口 | 标题按钮点击 | PASS | 直接 `MultiplayerScreen`；无 `LoginScreen`/`FollowGateScreen` |
| 邀请码控制 | 空码 + 有效码 + stub `RoomService.api` | PASS | 空码停留提示；`ABC123` 才调用 `joinRoom` |
| 创建世界/进入 play | `createWorld('acceptance-world', ..., true)` | PASS | play，170 区块，外观保持 |
| 世界内披风/帽子/宠物 | 第三人称实际渲染 1.8s | PASS | `admvoid`/`crown`/`snowman`，errLog 0 |
| 世界内存档恢复 | `saveWorld(true)` + `loadWorld(id)` | PASS | play，外观/帽子保持，errLog 0 |
| 破坏/放置方块 | `breakBlock` + `placeAt` | PASS | 方块 2→0，放置 dirt=3，errLog 0 |
| 键盘移动 | 按住 `KeyW` 700ms | PASS | 位移 2.76 格，errLog 0 |
| 创造背包界面 | `new CreativeScreen` | PASS | 55 slots、369 items，0 错误 |
| 暂停/选项/帮助 | `new PauseScreen/OptionsScreen/HelpScreen` | PASS | 各界面打开，暂停菜单含“开房间”，0 错误 |
| 菜单删除项回归 | 标签扫描 | PASS | 标题无登录/解锁/反馈；选项无遥测/制作人员/协议；暂停无反馈；账号无解锁 |
| 签到奖励图标共享路径 | `Checkin.drawReward()` 8 个装饰 | PASS | 8/8 无异常，errLog 0 |
| **末影龙通关结局（默认 renderDist=8）** | 进入末地 → 击杀 → 200 tick → 返回传送门 → Credits → Esc | PASS | 龙 200 HP/10 水晶；传送门 175、龙蛋 176；CreditsScreen 4510 行，首行 “I see the player you mean.”；Esc 回主世界；errLog 0 |
| 控制台/JS 异常 | `Log.entryAdded` / `Runtime.exceptionThrown` | PASS | 无 JS 异常；控制台仅原服务 403（K-02/K-40） |
| **实际房间加入/WSS** | 原房间服务 `xz.honghemc.cn:8443` | BLOCKED | 本机 403；仓库无服务器，phase-05 才交付 |
| 真实 B 站登录/签到/Mojang 查询 | 原服务/账号 | BLOCKED | 外部依赖 403/无凭据；本阶段只用 mock 验证权限路径 |
| **K-41 低 renderDist 结局边界** | `renderDist=4` + 入口平台击杀 | FAIL（单独立项，本阶段不修复） | 中心区块未加载时返回传送门/龙蛋不生成；默认 renderDist=8 正常 |

## 3. 最终结论

1. **已完成事项**：全部皮肤/披风/装饰（含 13 款管理员、3 款活动）真实开放；皮肤/披风/帽子/宠物/前缀预览、切换、世界渲染、背包/第一人称/远程 look、游客保存/恢复、登录同步路径、多人入口、邀请码控制、末影龙结局均实测。
2. **未完成事项**：真实联机（无服务器/原服务 403）、真实 B 站登录/签到/Mojang 查询；这些依赖 phase-03/05。
3. **发现的问题**：K-41（`renderDist=4` 时中心区块未加载，末地返回传送门/龙蛋不生成）已单独记录；另有 `Account.checkUnlocks`/`ToyDiag`/`singleGate`/衣柜 locked 死分支等账号/UI 残留，留 phase-03 清理。
4. **必须修复的问题**：**无**（在本阶段验收范围内）。K-41 按用户指令单独立项，未修复。
5. **可以推迟的问题**：K-41；账号/登录/签到/Toy 的清理；真实联机与外部服务；`WardrobeScreen` 死分支。
6. **是否满足阶段验收标准**：**客户端外观/多人入口/保存恢复/渲染/回归验收满足**；真实联机与真实账号依赖为 BLOCKED，不能宣称“全部联机可用”；K-41 不计入本阶段完成，单独跟踪。

## 4. 试玩

服务器已启动：

```text
http://127.0.0.1:8080/
```

当前工作区即试玩版本；若服务器停止，重新运行：

```powershell
cd D:\ds\REA\opusmc
node scripts\serve.mjs
```
