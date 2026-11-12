# phase-04 浏览器独立运行 · 独立验收（ACCEPTANCE）

- 日期：2026-11-12
- 验收对象：phase-04 改动（验收时未提交；验收后代码提交 `553ceed`）
- 环境：Windows 10/11、Node v26.13.0
  - Edge 157.0.4341.46（headless + SwiftShader）
  - Chrome 157.0.8103.51（headless + SwiftShader）
  - Android / iOS 仅 Chromium 视口、UA、触控、安全区模拟；**无真机**
- 证据：`D:\ds\REA\_work\accept04-*`（结果 JSON、截图、测试脚本）
- 原始独立验收结论：**未满足完整的 phase-04 验收标准；不宣称阶段完成，不进入 phase-05。**
- **用户验收决定（2026-11-12）**：不补测真实 Android Chrome / iOS Safari；K-39 留到 phase-07 处理。
  在该明确豁免下，phase-04 验收通过；真实设备仍不得写成已测试，K-39 仍是已知问题。代码提交 `553ceed`。

## 1. 代码检查（静态）

| 检查项目 | 测试方式 | 结果 | 证据 |
|---|---|---|---|
| 完整 Git Diff | `git diff --stat`、`git diff --name-status`、逐文件 diff 审阅 | PASS | 30 个修改文件 + 6 个新文件；代码 diff 已审阅 |
| 新增文件 | `git ls-files --others` | PASS | `js/platform.js`、`favicon.svg`、4 个 phase-04 文档（含本报告） |
| 修改文件 | `git diff --name-status` | PASS | 20 个代码/资源文件 + docs/README |
| 删除文件 | `git diff --diff-filter=D` | PASS | 仅 `.gitkeep`；无源码/模块删除 |
| 页面脚本集 | 对比 `HEAD:index.html` 与工作区 | PASS | 85 → 86；新增 `platform.js`；无移除脚本 |
| 源码缺失 | 86 个 `script src` 逐项 `Test-Path` | PASS | 0 个缺失 |
| 语法 | 90 个 `js/*.js` 逐项 `node --check` | PASS | 90/90 |
| 空白/行尾 | `git diff --check`、逐文件 CRLF/BOM 扫描 | PASS | 无空白错误；改动文本 LF、无 BOM |
| 删除功能调用入口 | 全文搜索 `Account`/`Toy`/`CloudSave`/`Checkin`/登录界面符号 | PASS | 代码引用 0；仅注释；phase-03 删除项仍不在 |
| 共用模块 | 搜索 `GuestSession`、`Skins`、`Capes`、`Cosmetics`、`DB`、`Sound`、`Stage`、`Platform` | PASS | 均有定义/引用；无缺失模块 |
| 跨文件依赖 | 检查 `Platform` 首加载、`guest.js` 在 `net.js` 前、`main.js` 在 `touch.js` 前 | PASS | `index.html` 顺序正确；`platform.js` 第一个 |
| Monkey Patch | 统计 `Game.prototype.tick` 包装器数量、审阅 diff 中新增 prototype 赋值 | PASS | 13/13 与 HEAD 相同；diff 无新增包装器 |
| 函数包装顺序 | 检查 `bindInput`、`Game.capturePointer`、`UI.safe`/`Stage` 包装 | PASS | 加载顺序未变；touch 包装仍包住 main 的 `bindInput` |
| 全局变量/单例 | 搜索 `Platform`、`Stage`、`GuestSession`、`DB`、`Sound` 定义 | PASS | `Platform` 仅一处；`window.Platform` 同步；无重名 |
| 事件监听器 | 审阅 window/document/visualViewport 监听器 | PASS | 新增 Platform 2 个、Stage 视口监听；`Stage.init`/`bindInput` 单次保护 |
| 资源引用 | 86 脚本、`emoji.webp`、字体/图集、4849 个音效引用 | PASS | 脚本 0 缺失；音效事件 1931/文件 4849，0 缺失 |
| 第三方资源 | 启动/标题/单人网络请求 | PASS | 仅 `127.0.0.1:8080`；无 CDN/B 站/公告后台请求 |

## 2. 功能测试

| 测试项目 | 测试方式 | 结果 | 证据 |
|---|---|---|---|
| 普通 URL 启动 | Edge/Chrome 打开 `http://127.0.0.1:8080/`，等标题 | PASS | `accept04-desktop.mjs`；标题/`TitleScreen`；`accept04-title.png` |
| 86 页面脚本/资源 | `__BOOT_TOTAL__`、脚本标签、Network | PASS | 86 个页面脚本；0 失败；`loaded` 87 因运行期 `sound_events.js` |
| WebGL2 初始化 | 检查 `WebGL2RenderingContext` | PASS | Edge/Chrome；renderer canvas 正常 |
| 字体/图集/emoji | 检查字体图集、strip、grass、EMOJI | PASS | 字体图集 `cell=16`；图片可用 |
| 音频事件包与真实音效 | lazy `sound_events.js` + 解码 `dig/stone1` + `Sound.ev` | PASS | `Sound.ctx=running`、`decoded=true`、`playable=true` |
| 世界生成 Worker | `gen_worker.js` 实例、`chunk_worker.js` ready | PASS | 3 个生成 Worker；chunk worker 正常 |
| IndexedDB/平台存储 | `DB.backend=idb`、localStorage 探测 | PASS | Edge/Chrome；正常 profile |
| 主菜单 | 实际点击「单人游戏」「选项…」「多人游戏」「皮肤和装饰」 | PASS | Options/Multiplayer/Wardrobe/WorldList 打开 |
| 通过 UI 创建世界 | 实际点击创建按钮、输入名称、进入 play | PASS | `accept04-desktop`；67–69 区块；`accept04-world.png` |
| 键盘输入 | 受信任 CDP `KeyW`，检查按键状态和位移 | PASS | 位移 >0.2（Edge 2.7–4 格；Chrome 3.8 格） |
| 鼠标视角 | 指针锁定后 CDP `mouseMoved`，检查 yaw | PASS | 单独探针 yaw 从 -0.5544 到 -0.9144 |
| 指针锁定/释放 | 实际点击画布、`Platform.input.exit` | PASS | `locked=true`；释放后暂停菜单出现 |
| 全屏 | F11 绑定（DOM 事件 + 原生 API） | PASS（绑定/API）；真实 F11 NOT TESTED | `full=true`，退出后 `false`；受信任 F11 在 headless 不投递 |
| 通过暂停菜单保存/退出 | 实际点击「保存并退回到标题屏幕」 | PASS | 世界列表出现 `accept04-world` |
| 刷新/世界列表加载 | 实际点击行 + 「进入选中的世界」 | PASS | 方块标记恢复；`accept04-restored.png` |
| 单人无第三方请求 | 进入 play 后 65 s Network 监控 | PASS | 仅本地请求；无 `/api/announce` |
| Android 触控（模拟） | CDP 真实 `Input.dispatchTouchEvent` | PASS | 摇杆/视角两指、前进、跳跃、攻击按钮 |
| 横屏/方向变化（模拟） | `setDeviceMetricsOverride` + 安全区 | PASS | 横屏 844×390；安全区左右 32；画布重算 |
| 安全区/视口（模拟） | 竖屏 47/34、横屏 47/47、URL 栏缩短 | PASS | 竖屏安全区映射到舞台左/右；`visualViewport` 缩短 |
| iOS UA 模拟 | Chromium 模拟 iPhone UA/触控/安全区 | PASS（模拟） | 竖屏旋转、安全区、无错误 |
| 真实 Android Chrome | 需要真实设备 | **NOT TESTED** | 本机无 Android 设备/模拟器；用户明确不补测 |
| 真实 iOS Safari/WebKit | 需要 macOS/iOS | **NOT TESTED** | 仅 Chromium UA 模拟，不是 WebKit；用户明确不补测 |
| 文件选择/下载 | 实际文件选择、保存照片 | **NOT TESTED** | 仅验证 `Platform.files` API 存在；无头环境不能完成原生文件对话框 |
| 兼容性提示 | `file://`、无 WebGL2、上下文丢失 | PASS | 3 个面板正确显示；`accept04-*.png` |
| 降级（无 Worker/localStorage） | 禁用后启动、创建世界 | PASS | 7/7；`GenPool.inline=true`、世界进入 play |
| 服务器白名单/缓存 | Node `fetch`、HEAD、ETag | PASS | 403 docs/scripts/.git/穿越；304；音效缓存 |
| phase-03 回归 | 原 phase-03 运行时回归套件 | PASS | **33 PASS / 0 FAIL**；账号/Toy/云/签到仍不存在 |
| 真实多人房间/P2P | 旧房间服务/真实双端 | **BLOCKED** | 旧服务 403/CORS；phase-05 |
| 真实 GPU/手机 FPS/发热 | 真实设备 + 性能测量 | **NOT TESTED** | SwiftShader 不代表性能；phase-07 |
| PWA/离线 | Service Worker/断网 | **NOT TESTED** | 本阶段不做 |
| Chrome headless 世界重载 | 同 Edge 流程 | **FAIL（已知 K-39）** | 进入 play 并恢复方块，但 `game.errLog` 有 `chunk stall`；watchdog 重新请求 |
| Windows Chrome 完整套件 | 独立验收 | **43 PASS / 2 FAIL** | 2 FAIL 均为 `chunk stall`；其余 43 项通过 |

## 3. 逐项结果汇总

- **Windows Edge 157 桌面**：44 PASS / 0 FAIL / 0 BLOCKED。
- **Windows Chrome 157 桌面**：43 PASS / 2 FAIL / 0 BLOCKED；2 项为已知 K-39 `chunk stall`（世界仍进入 play、方块仍恢复）。
- **Android Chrome + iOS Safari 模拟（合计）**：25 PASS / 0 FAIL（不是真机；iOS 部分只是 Chromium UA 模拟）。
- **真实 Android Chrome / iOS Safari**：**NOT TESTED**（用户明确不补测）。
- **兼容性/降级**：7 PASS / 0 FAIL。
- **phase-03 回归**：33 PASS / 0 FAIL。
- **静态**：90/90 语法；86 页面脚本；`git diff --check` PASS；LF/no BOM。
- **服务器**：白名单/缓存/304/HEAD 全部 PASS。

## 4. 发现的问题

1. **真实 Android Chrome / iOS Safari 未测试（NOT TESTED）**
   - 当前只有 Chromium 的 UA/视口/触控/安全区模拟；没有 Android 设备，也没有 iOS WebKit。
   - 移动端真机触控手感、软键盘、音频解锁、方向锁定、安全区、发热、内存均未确认。
2. **Windows Chrome headless 出现已知 `chunk stall`（FAIL，K-39）**
   - Chrome 世界创建/重载后进入 play，方块恢复；`game.errLog` 记录 `chunk stall`，watchdog 重载区块。
   - Edge 同流程无该错误；属于已知 SwiftShader/无头环境噪音，不是 phase-04 新引入的正常路径逻辑错误，但当前验收不能把它写成“Chrome 完全无错误”。
3. **受信任 F11 未在 headless 中投递（NOT TESTED）**
   - F11 的 DOM 绑定和 `Platform.display` 全屏 API 均通过；但 headless Edge/Chrome 不把受信任 F11 送到页面，真实键盘 F11 未验证。
4. **文件选择/照片下载未做真实用户操作（NOT TESTED）**
   - `Platform.files` API 存在；原生文件对话框无法在无头环境完成。
5. **旧房间服务 403（已知，phase-05）**
   - 实际打开多人界面时 `https://xz.honghemc.cn:8443/api/public` 返回 403；这是既有服务，不是本阶段资源加载失败。单机后台轮询已关闭。
6. **没有发现 phase-04 新引入的代码级关键缺陷**
   - 静态审阅、90 JS 语法、Edge/Chrome 核心流程、触控坐标、回归均通过。
   - 独立验收过程中曾发现测试脚本的触控坐标换算错误（UI→页面使用了错误方向），已修正测试；**产品代码 `turn` + `P.gui` 的最终实现正确**，未保留错误修改。

## 5. 必须修复 / 可推迟 / 结论

### 必须修复

- 无新的 phase-04 代码缺陷被确认。
- 真实 Android Chrome / iOS Safari 是用户任务 5 的必需验收项；**用户已于 2026-11-12 明确书面豁免补测**，因此不再作为 phase-04 阻塞，但结果仍是 NOT TESTED。
- K-39 `chunk stall` 已由用户决定**留到 phase-07**；它不是本阶段新增功能，也不是已修复项。

### 可以推迟

- K-39 `chunk stall`（phase-07/真实 GPU 环境处理）。
- 旧房间服务、`/api/skin`、管理员公告、真实多人/P2P（phase-05）。
- 真实 F11、文件选择、照片下载真机验证（真机/有头浏览器验收）。
- 性能、发热、长时间运行（phase-07）。
- PWA/离线（未列入本阶段目标）。

### 是否满足阶段验收标准

**原独立验收结论（用户豁免前）：不满足完整的 phase-04 验收标准。** 桌面核心、资源加载、独立启动、平台层、桌面输入、移动模拟、兼容性提示和回归均通过；但必需的 Android Chrome / iOS Safari 真机测试未进行，Windows Chrome headless 仍有已知 `chunk stall` **FAIL**。因此当时：

- 原始独立验收不宣称 phase-04 完成；不提交、不推送、不进入 phase-05。

### 用户验收决定与修订结论（2026-11-12）

- 用户明确：**不用真实 Android Chrome / iOS Safari 补测**；**K-39 在 phase-07 处理**。
- 因此 phase-04 验收通过，但带两项记录在案的豁免/遗留：
  1. 真实 Android Chrome / iOS Safari 未测试，只使用 Chromium 模拟；不得宣传为真机通过。
  2. K-39 `chunk stall` 保留到 phase-07；Chrome headless 的 2 项 FAIL 不阻断本阶段。
- 代码提交 `553ceed`；docs 收尾为后续 docs 提交后的当前 HEAD。
- 不进入 phase-05；下一步由用户单独启动。
