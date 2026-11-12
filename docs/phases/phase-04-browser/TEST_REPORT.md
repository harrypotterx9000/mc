# phase-04 浏览器独立运行 · 测试报告（TEST_REPORT）

> **独立验收补充（2026-11-12）**：实现阶段报告中的 37/37 套件仍成立；独立验收另见
> `ACCEPTANCE.md`。独立验收发现：真实 Android/iOS **NOT TESTED**；Windows Chrome headless 有 2 项已知
> K-39 `chunk stall` FAIL；受信任 F11、文件选择/下载 **NOT TESTED**。
> **用户随后明确不补测真实 Android/iOS，K-39 留 phase-07；phase-04 据此带明确豁免验收通过，代码 `553ceed`。**

- 日期：2026-11-12
- 代码基线：`840b19c`（phase-03 docs 收尾）；phase-04 代码提交 `553ceed`
- 环境：Windows 10/11（本机）、Node v26.13.0、无头 Edge 157.0.4341.46、Chrome 157.0.8103.51、旧 Chrome 83.0.4103.106
- 渲染：`--use-angle=swiftshader`（CPU 光栅化，不代表真实 GPU 性能）
- 服务器：`scripts/serve.mjs`，`http://127.0.0.1:8080/`
- 测试脚本与截图：`D:\ds\REA\_work\phase04-*.mjs` / `phase04-*.json` / `phase04-*.png`（仓库外，不随项目提交）

## 1. 结论

- **Windows Edge 157**：桌面 **37/37 PASS**。
- **Windows Chrome 157**：桌面 **37/37 PASS**。
- **Windows Chrome 83（旧版）**：**9/9 PASS**（旧 headless 的 `chunk stall` 噪音单列）。
- **Android Chrome 模拟** + **iOS Safari 模拟**：**21/21 PASS**；真实设备 **NOT TESTED**（用户明确不补测）。
- **降级兼容**（禁用 Worker + localStorage）：**7/7 PASS**。
- **兼容性面板**：`file://`、无 WebGL2、WebGL 上下文丢失 **3/3** 显示正确。
- 全部套件 0 FAIL；桌面/移动测试 0 未捕获异常；正常运行时 `game.errLog` 为空。
- 静态检查：**90 个 `js/*.js` 全部 `node --check` 通过**；`index.html` **86** 个脚本；`git diff --check` 通过。
- 结论：**实现与自动化测试完成；用户验收通过（真实 Android/iOS 不补测、K-39 留 phase-07）。不宣称真实 Android/iOS 与真实 GPU 性能已通过。**

## 2. 静态与资源

| 检查 | 结果 |
|---|---|
| `js/*.js` 数量 | 90（原 89 + 新增 `platform.js`） |
| 全量 `node --check` | 90/90 PASS |
| `index.html` 脚本数 | 86（原 85 + `platform.js`） |
| `scripts/serve.mjs` 语法 | PASS |
| `git diff --check` | PASS（未发现空白错误） |
| 文件行尾 | 改动文件保持 LF；无行尾转换 |
| 页面脚本加载 | 86 个页面脚本 + 运行期 `sound_events.js`，0 加载失败 |
| 图片 | `assets.js` 图集、`js/emoji.webp`、`sounds` 无缺 |
| 字体 | `js/font.js` 字体图集加载，`FONT_MC.cell=16` |
| 音频 | `js/sound_events.js` 加载；`Sound.packReady=true`，`SOUNDS.events` 可用 |
| Worker | `gen_worker.js` 3 个实例；`chunk_worker.js` 启动并 ready |
| 动态资源 | `skins_data.js`、`vstates_data.js`、`emoji.webp` 均通过 `Platform.resource()` 解析 |
| 第三方资源 | 启动/标题/单人游戏请求均为 `http://127.0.0.1:8080/`；无 Bilibili/CDN/公告后台请求 |

## 3. Windows Edge 157 桌面（37/37 PASS）

脚本：`phase04-desktop.mjs`；结果：`phase04-desktop-result.json`

| # | 检查 | 结果 |
|---|---|---|
| 1 | 平台识别 Windows Edge | PASS |
| 2 | 无阻断项、无警告 | PASS |
| 3 | WebGL2/Canvas2D/Worker/IndexedDB/localStorage/sessionStorage/WebAudio/fetch/WebSocket | PASS |
| 4 | 86 个页面脚本加载、0 失败 | PASS |
| 5 | WebGL2 渲染器初始化（1254×627，最终复跑） | PASS |
| 6 | 字体图集 + 图像加载 | PASS |
| 7 | 音频包从自有服务器加载 | PASS |
| 8 | 3 个世界生成 Worker + 区块 Worker | PASS |
| 9 | IndexedDB 后端 | PASS |
| 10 | 平台存储可用 | PASS |
| 11 | 桌面使用完整 visualViewport，安全区 0 | PASS |
| 12 | 启动无 `game.errLog` | PASS |
| 13 | 启动请求仅同源 | PASS |
| 14 | `platform.js` / `emoji.webp` / `sound_events.js` 请求 | PASS |
| 15 | `gen_worker.js` / `chunk_worker.js` 请求 | PASS |
| 16 | 标题标准菜单项 | PASS |
| 17 | 「单人游戏」打开世界列表 | PASS |
| 18 | 创建世界并进入 `play`（168 区块） | PASS |
| 19 | 键盘 W 移动玩家 | PASS |
| 20 | 键盘释放清理状态 | PASS |
| 21 | 指针锁定请求/释放 | PASS |
| 22 | 全屏请求/退出 | PASS |
| 23 | 方块 + 设置保存 | PASS |
| 24 | 刷新后世界列表含存档 | PASS |
| 25 | 刷新后设置恢复（FOV=80） | PASS |
| 26 | 刷新后方块恢复 | PASS |
| 27 | 刷新后进入 `play`（293 区块） | PASS |
| 28 | 进入游戏后 65 秒无第三方请求 | PASS |
| 29 | 无 `/api/announce` / 旧房间服务请求 | PASS |
| 30 | `game.errLog` 为空 | PASS |
| 31 | 0 未捕获异常 | PASS |
| 32 | 0 严重控制台错误 | PASS |
| 33 | index：no-cache + ETag | PASS |
| 34 | JS：no-cache + ETag | PASS |
| 35 | 音效：`max-age=2592000` + `audio/mp4` | PASS |
| 36 | docs/scripts/.git/路径穿越 403 | PASS |
| 37 | ETag 条件请求 304 | PASS |

## 4. Windows Chrome 157 桌面（37/37 PASS）

脚本：`phase04-desktop.mjs`，`CDP=http://127.0.0.1:9449`，`EXPECT_BROWSER=Chrome`，`LONG_WAIT=10000`；
结果：`phase04-chrome157-result.json`。

- 与 Edge 同一套 37 项检查，全部 PASS。
- 创建世界 127 区块；键盘移动 3.84 格；指针锁定/全屏路径通过；存档方块与设置刷新恢复。
- 10 秒 play 期间无第三方请求；`game.errLog` 为空；0 未捕获异常。
- 渲染器画布 946×468（默认画质 0.75 分辨率缩放），UI/舞台 1262×624；这是现有画质设置，不是异常。

## 5. Windows Chrome 83（旧版，9/9 PASS）

脚本：`phase04-chrome83-full.mjs`；结果：`phase04-chrome83-result.json`。

- 识别为 Windows Chrome 83.0.4103.106；WebGL2、Worker、IndexedDB、localStorage、WebAudio 全部可用。
- 启动标题；86 页面脚本；仅自有资源；3 个生成 Worker + 区块 Worker。
- 创建/进入世界（97 区块）；DOM 键盘事件移动玩家；保存/刷新恢复方块（254 区块）。
- `game.errLog` 仅出现旧 headless SwiftShader 偶发 `chunk stall`，世界仍进入 `play`；按已知 K-39 噪音单列，不计为功能失败。
- 0 未捕获异常、0 严重控制台错误。
- 说明：Chrome 83 的旧 headless 不投递 CDP `Input.dispatchKeyEvent`，键盘测试改用真实 `KeyboardEvent` 处理器；Edge/Chrome 157 已用受信任 CDP 输入验证。

## 6. 移动端模拟（21/21 PASS）

脚本：`phase04-mobile.mjs`；结果：`phase04-mobile-result.json`。
环境：Edge 157 + CDP 设备模拟（Android Pixel 8 / iPhone 17.5 UA、390×844 与 844×390、DPR 2、5 点触控、
`Emulation.setSafeAreaInsetsOverride`）。**不是真机，不是 iOS WebKit。**

| # | 检查 | 结果 |
|---|---|---|
| 1 | Android 识别为手机、触控默认开启 | PASS |
| 2 | 竖屏 390×844 viewport | PASS |
| 3 | 竖屏舞台旋转为 844×390 | PASS |
| 4 | 竖屏安全区映射（上 47 / 下 34 → 舞台左/右） | PASS |
| 5 | Android 启动无错误 | PASS |
| 6 | 横屏 844×390 更新舞台/UI | PASS |
| 7 | 横屏左右安全区进入 UI | PASS |
| 8 | HUD 摇杆/跳跃/攻击/使用/暂停/快捷栏 | PASS |
| 9 | 对准实体出现「互动」按钮 | PASS |
| 10 | 两指分别识别为摇杆/视角 | PASS |
| 11 | 摇杆前推 → 前进 + 疾跑状态 | PASS |
| 12 | 第二指滑动 → 视角改变 | PASS |
| 13 | 多点释放清理两指状态 | PASS |
| 14 | 视口缩短（844×344）同步画布/舞台 | PASS |
| 15 | 移动世界无 `game.errLog` | PASS |
| 16 | 移动端无第三方平台请求 | PASS |
| 17 | iOS 模拟识别为手机/触控 | PASS |
| 18 | iOS 竖屏旋转 + 安全区 | PASS |
| 19 | iOS 启动无错误 | PASS |
| 20 | 模拟缺失 Pointer Lock + 全屏：仅警告，不阻断 | PASS |
| 21 | iOS 受限模式仍到标题 | PASS |

截图：`phase04-android-title.png`、`phase04-android-landscape.png`、`phase04-android-world.png`、
`phase04-ios-title.png`、`phase04-ios-limited.png`。

## 7. 兼容性与降级（3/3 + 7/7 PASS）

### 7.1 面板

脚本：`phase04-compat.mjs`；结果截图：`phase04-compat-contextlost.png`、`phase04-compat-nowebgl2.png`、`phase04-compat-file.png`。

| 场景 | 结果 |
|---|---|
| `file://` 打开 | 标题「请通过本地服务器打开 OpusMC」；列出启动命令；不进入游戏 |
| 无 WebGL2 | 标题「无法启动 OpusMC」；列出 WebGL2 缺失与浏览器建议 |
| WebGL 上下文丢失 | 标题「图形上下文已丢失」；提供重新加载；游戏停止渲染 |

### 7.2 降级

脚本：`phase04-fallback.mjs`；结果：`phase04-fallback-result.json`；截图：`phase04-fallback-world.png`。

| 检查 | 结果 |
|---|---|
| 禁用 `Worker` + localStorage 后仍可启动 | PASS |
| localStorage 不可用 → 内存影子（`available=false`, `backend=memory`） | PASS |
| Worker 缺失 → 兼容性警告 | PASS |
| 仍到标题、无错误 | PASS |
| 世界生成内联降级（`GenPool.inline=true`），区块 Worker 标记失败 | PASS |
| 内联生成世界进入 `play`（140 区块） | PASS |
| 无 `game.errLog` / 未捕获异常 | PASS |

## 8. 服务器与缓存

脚本：并入 `phase04-desktop.mjs`；HEAD/目录测试为手工命令。

| 请求 | 结果 |
|---|---|
| `GET /` | 200，`Cache-Control: no-cache`，`ETag` |
| `GET /js/platform.js` | 200，`text/javascript`，no-cache + ETag |
| `GET /sounds/sfx/dig/stone1.m4a` | 200，`audio/mp4`，`max-age=2592000` |
| `GET /favicon.svg` | 200，`image/svg+xml`，7 天 |
| `GET /docs/STATUS.md` | 403 |
| `GET /scripts/serve.mjs` | 403 |
| `GET /.git/HEAD` | 403 |
| `GET /js/../docs/STATUS.md` | 403 |
| `HEAD /js/platform.js` | 200，Content-Length 正确 |
| `HEAD /js/` / `HEAD /sounds/sfx/dig/` / `HEAD /server/` | 403 |
| `HEAD /js/missing.js` | 404 |
| `If-None-Match` 条件请求 | 304 |

## 9. 未测试 / BLOCKED / NOT TESTED

- **真实 Android Chrome 真机**：NOT TESTED（本机无 Android 设备/模拟器；仅 Edge Chromium 模拟；用户明确不补测）。
- **真实 iOS Safari / WebKit**：NOT TESTED（本机无 macOS/iOS；仅 Chromium 模拟 UA/视口/触控；用户明确不补测）。
- 真实手机触控手感、软键盘、音频解锁、横屏锁定、安全区、发热、内存、长时间运行：NOT TESTED。
- 真实 GPU（NVIDIA/AMD/Intel）FPS、光影编译、动态分辨率：NOT TESTED（SwiftShader 不代表性能）。
- 真实 Windows Chrome/Edge 有头窗口、浏览器扩展、企业策略：仅无头验证。
- 真实 `file://` 用户操作：通过无头 `file://` 页面验证正确阻断，不宣称可玩。
- 多人房间/P2P/公告：仍依赖旧房间服务或 phase-05；本阶段不把旧服务 403 当作本阶段回归失败。
- 生产部署（HTTPS/WSS、反向代理、鉴权、限流）：phase-08。

## 10. 测试证据索引

- `phase04-desktop-result.json` — Edge 157，37 PASS / 0 FAIL
- `phase04-chrome157-result.json` — Chrome 157，37 PASS / 0 FAIL
- `phase04-chrome83-result.json` — Chrome 83，9 PASS / 0 FAIL
- `phase04-mobile-result.json` — Android/iOS 模拟，21 PASS / 0 FAIL
- `phase04-fallback-result.json` — 降级，7 PASS / 0 FAIL
- `phase04-boot.json` — 早期启动快照（阶段实现时）
- `phase04-desktop-title.png`、`phase04-desktop-world.png`、`phase04-android-*.png`、`phase04-ios-*.png`、`phase04-compat-*.png`、`phase04-chrome83*.png`
