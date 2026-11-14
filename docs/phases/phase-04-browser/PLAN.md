# phase-04 浏览器独立运行 · 实施计划（PLAN）

- 日期：2026-11-12
- 阶段：phase-04 浏览器兼容 / 独立资源加载 / 设备输入
- 基线：`840b19c`（phase-03 docs 收尾）；代码基线 `025cba8`
- 分支：`develop`（按用户约束未新建/切换/重置分支）
- 工作区：`D:\ds\REA\opusmc`
- 状态：**实现、测试、独立验收、用户验收完成（带豁免）；代码提交 `553ceed`；未推送**

## 1. 本阶段目标

通过普通浏览器网址直接运行 OpusMC：不依赖 B 站 Toy 容器、不依赖 `file://`、不依赖第三方平台资源，
电脑与手机使用浏览器标准能力，并在缺少必要能力时给出清晰提示。

用户任务拆分：

1. 平台适配：Canvas / WebGL2 / Keyboard & Pointer / Touch / Web Audio / 文件 API / IndexedDB & localStorage / Web Worker / Fetch & WebSocket。
2. 独立资源加载：图片、字体、音频、游戏数据、Worker、动态资源路径、自有服务器、HTTP 缓存、无第三方平台资源。
3. 网页独立启动：网址加载 → 资源 → WebGL2 → 主菜单 → 本地世界 → 进入游戏 → 保存/恢复。
4. 设备输入：电脑键盘/鼠标/全屏/鼠标锁定；手机摇杆/跳跃/攻击/交互/多点触控/方向变化/横屏/安全区/视口。
5. 兼容性：Windows Chrome、Windows Edge、Android Chrome、iOS Safari；不支持必要能力时清晰提示。

## 2. 实际范围与边界

### 做

- 新增统一平台层 `js/platform.js`：能力探测、资源 URL、安全存储、Web Audio、Worker、文件、全屏、鼠标锁定、安全区/视口、兼容性报告。
- 将需要回退或浏览器差异的调用点接入平台层（渲染、输入、音频、存储、Worker、资源、文件）。
- 重写 `scripts/serve.mjs`：只服务游戏自有静态文件，拒绝文档/脚本/服务端/Git/点文件；ETag、304、静态资源缓存。
- `index.html`：标准入口、86 个脚本、启动进度、资源失败提示、兼容性面板、`file://` 提示、favicon。
- `js/mobile.js` / `js/touch.js`：安全区（CSS env）、`visualViewport`、横屏/竖屏旋转、全屏/方向锁定、指针锁定/自由鼠标降级。
- 关闭单机后台对旧房间服务的自动公告轮询（`NET_CONFIG.announce=false`），避免独立游戏在无人要求时访问第三方平台。
- 更新阶段文档与测试报告。

### 不做

- 不实现 phase-05 自建多人服务器；旧房间服务只保留为用户主动打开多人界面时的既有功能。
- 不改游戏内容、渲染算法、世界生成、红石、战斗、物品等无关模块。
- 不做 PWA 离线缓存/Service Worker；本阶段只做 HTTP 缓存。
- 不宣称真实 Android/iOS 真机、真实 GPU 性能已测试。
- 不进入 phase-05。

## 3. 关键实现

### 3.1 `js/platform.js`

- `Platform.caps`：WebGL2 / Canvas 2D / Worker / IndexedDB / localStorage / sessionStorage / Web Audio / Pointer Events / 键盘 / 指针锁定 / 全屏 / 振动 / 设备运动 / 方向 / visualViewport / fetch / WebSocket / 文件 API / 目录选择。
- `Platform.fatal()`：`file://`、Canvas 2D、WebGL2 为阻断项；其余为可降级警告。
- `Platform.warnings()`：Worker、IndexedDB、localStorage、sessionStorage、Web Audio、鼠标锁定、全屏、文件 API。
- `Platform.storage.local/session`：安全读写；不可用时使用本页内存影子，并保留 `available/backend` 供 UI/测试判断。
- `Platform.display`：安全区（CSS `env(safe-area-inset-*)` 探针）、`visualViewport`、全屏（含 webkit 前缀）、方向锁定、键盘锁定。
- `Platform.input`：指针锁定请求/释放（`unadjustedMovement` 失败回退普通模式）、振动。
- `Platform.audio`：AudioContext 创建/恢复。
- `Platform.workers`：按页面地址解析 Worker URL；不可用返回 `null`。
- `Platform.resource()`：以 `document.baseURI` 解析本地资源，路径不依赖 Toy/根路径。
- `Platform.files`：文件/目录选择、DataURL/Blob 下载。
- `Platform.graphics`：Canvas 2D / WebGL2 获取；WebGL 上下文丢失时显示可读的重载面板。
- `Platform.compat`：兼容性报告、阻断/警告列表、DOM 兼容性面板。

### 3.2 接入点

| 文件 | 接入 |
|---|---|
| `js/render.js` | WebGL2 通过 `Platform.graphics.webgl2`；上下文丢失监听 |
| `js/ui.js` | Canvas 2D 通过 `Platform.graphics.canvas2d`；指针锁定状态走 `Platform.input` |
| `js/game.js` | 指针锁定/释放、设置存储走平台层 |
| `js/main.js` | 启动前兼容性检查、错误面板、F11 防双触发、指针锁定失败提示 |
| `js/audio.js` | AudioContext、声音脚本、音效 URL |
| `js/terrain2.js` | 世界生成/区块 Worker |
| `js/save.js` | localStorage 封装、IndexedDB 能力检查 |
| `js/screens.js` | 全屏、文件选择 |
| `js/extras.js` | 截图下载、标题场景缩略图存储 |
| `js/guest.js` / `js/net.js` / `js/skins.js` / `js/social.js` | 会话存储、房间 key、外观/皮肤缓存、公告已读 |
| `js/emoji.js` / `js/export.js` | 本地资源 URL |
| `js/mobile.js` | 安全区、visualViewport、横屏旋转映射、振动 |
| `js/touch.js` | 全屏/方向锁定、振动 |
| `scripts/serve.mjs` | 自有资源白名单、ETag/304、缓存策略 |

### 3.3 资源与服务器

- 页面只加载 `js/`（86 个 `<script src>`）、`js/emoji.webp`、`sounds/sfx/*.m4a`、`favicon.svg`。
- 字体/贴图/游戏数据仍由构建生成的 JS data URI/JSON 提供，不依赖外部 CDN。
- `serve.mjs` 默认 `127.0.0.1:8080`；可用 `HOST=0.0.0.0` 做局域网设备测试（phase-08 再正式部署）。
- HTML/JS 使用 `ETag` + `Cache-Control: no-cache`（304 重新验证）；音效 `max-age=2592000`；图片/图标 `max-age=604800`。
- 文档、`scripts/`、`server/`、`.git`、点文件、路径穿越一律 403。

### 3.4 移动端

- `viewport-fit=cover`；`Platform.display.safeArea()` 读取 CSS 安全区。
- `Stage` 使用 `visualViewport` 的实际宽高，浏览器地址栏/工具栏变化时跟随；事件按帧合并。
- 竖屏 CSS 旋转时，安全区按 90° 映射到舞台坐标（上→左、右→上、下→右、左→下）。
- 触屏保留摇杆、跳跃、攻击、使用、互动、潜行、疾跑、背包、快捷栏、多点触控、横屏布局。
- iOS 无元素全屏/鼠标锁定：不阻断启动，保留 CSS 横屏 + 触控 + 自由鼠标降级，并在兼容性报告中说明。

### 3.5 启动与兼容性

- 启动前检查 `file://`、Canvas 2D、WebGL2；不满足时显示中文兼容性面板，列出缺失能力、HTTP 启动命令和浏览器建议。
- 资源 `<script>` 加载失败、启动超时显示可读错误，不再停在 99% 加载条。
- WebGL 上下文丢失显示“重新加载”面板。
- `Platform.warnings()` 中的可降级项在标题后提示一次，并写入控制台报告。

## 4. 测试方案

| 套件 | 环境 | 目标 |
|---|---|---|
| 静态 | Node 26 | 90 个 JS `node --check`；86 个页面脚本；`git diff --check`；LF |
| 桌面 | Windows Edge 157 headless + SwiftShader | 启动/资源/Worker/WebGL2/菜单/世界/输入/全屏/指针锁定/存档/65 s 无第三方请求 |
| 桌面 | Windows Chrome 157 headless + SwiftShader | 同上（不含 65 s 长等） |
| 旧浏览器 | Windows Chrome 83 headless | 启动/资源/Worker/世界/键盘/存档；旧 headless 已知噪音单独标注 |
| 移动 | Edge 157 + Android UA/视口/触控/安全区模拟 | 竖屏旋转、横屏、摇杆/按钮、多点触控、视口变化、无第三方请求 |
| iOS | Edge 157 + iPhone UA/视口/触控/安全区模拟 | 触控布局、安全区；模拟缺失 Pointer Lock / 全屏时的警告与继续启动 |
| 兼容性 | Edge 157 | `file://`、无 WebGL2、WebGL 上下文丢失三个面板 |
| 降级 | Edge 157 | 禁用 Worker + localStorage，仍能标题/创建世界 |
| 服务器 | Node fetch / HTTP | 白名单、403、404、HEAD、ETag 304、缓存头、MIME |

> 说明：Android / iOS 是 **Chromium 的视口、UA、触控和安全区模拟**，不是真机，也不是 iOS Safari 的 WebKit。
> 真机测试在本阶段标 **NOT TESTED / BLOCKED**，不得写成通过。

## 5. 验收标准

- 普通 http URL 打开，无 `file://` 依赖；加载条正常，主菜单出现。
- 资源全部来自自己的静态服务器；启动/单人游戏 65 秒内无第三方平台请求。
- 创建、保存、刷新恢复本地世界；设置和外观恢复。
- 桌面键盘/鼠标/指针锁定/全屏可用（无头环境验证 API 路径，真实设备仍需用户试玩）。
- 手机模拟：摇杆、跳跃、攻击、使用、互动、多点触控、方向变化、安全区/视口可用。
- 缺少 WebGL2 / `file://` 时有清晰中文提示；缺 Worker/localStorage 时降级可用。
- 90 个 JS 语法检查通过；无未捕获异常；`game.errLog` 为空（旧 Chrome 83 headless 的 chunk stall 单列）。

## 6. 风险与未覆盖

- 真实 Android/iOS 设备的音频解锁、触控手感、安全区、横屏、发热未测。
- 真实 GPU 性能与 FPS 未测（phase-07）。
- 旧房间服务仍是多人功能的既有后端（phase-05 替换）；本阶段只关闭后台自动公告轮询。
- 静态服务器不是生产级部署（TLS、反向代理、鉴权、限流留 phase-08）。
