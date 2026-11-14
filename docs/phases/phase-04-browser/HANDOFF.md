# phase-04 浏览器独立运行 · 交接（HANDOFF）

- 日期：2026-11-12
- 状态：**实现、测试、独立验收、用户验收完成；代码已提交 `553ceed`；docs 收尾为当前 HEAD**
- 仓库：`D:\ds\REA\opusmc`
- 分支：`develop`（跟踪 `origin/opusmc-integration`；未新建/切换/重置分支）
- 起点：`840b19c`（phase-03 docs 收尾）；代码基线 `025cba8`
- 工作区：**干净**（代码 + docs 已提交）
- 远程：**已推送 `origin/opusmc-integration`**；未合并、未强推、未打标签

## 1. 本阶段目标

通过普通浏览器网址直接运行 OpusMC：

1. 建立统一浏览器平台适配层，替换 Toy 时代的平台依赖（Toy 已在 phase-03 删除）。
2. 图片、字体、音频、游戏数据、Worker、动态资源路径全部独立，由自己的静态服务器提供，适当使用 HTTP 缓存。
3. 提供标准网页入口：网址 → 资源 → WebGL2 → 主菜单 → 本地世界 → 游戏 → 保存/恢复；不依赖 `file://`。
4. 电脑键盘/鼠标/全屏/指针锁定；手机摇杆/跳跃/攻击/交互/多点触控/方向/横屏/安全区/视口。
5. 兼容 Windows Chrome/Edge、Android Chrome、iOS Safari；缺失必要能力时给出清晰提示。

## 2. 实际完成情况

### 2.1 平台层

- 新增 `js/platform.js`（510 行）：能力探测、阻断/降级、兼容性面板、安全存储、Web Audio、Worker、
  文件 API、全屏/方向/键盘锁定、Pointer Lock、安全区/visualViewport、资源 URL、Canvas/WebGL2 获取与上下文丢失。
- 接入点：`render.js`、`ui.js`、`game.js`、`main.js`、`audio.js`、`save.js`、`terrain2.js`、`screens.js`、
  `touch.js`、`mobile.js`、`guest.js`、`net.js`、`skins.js`、`social.js`、`extras.js`、`emoji.js`、`export.js`。

### 2.2 资源与服务器

- `index.html` 85 → **86** 个脚本，`js/platform.js` 第一；启动进度、资源失败/90 s 超时、`file://` 提示、
  兼容性面板、`favicon.svg`。
- 图片/字体/数据仍由构建生成的 data URI/JSON 提供；音效为 `sounds/sfx/*.m4a`；Worker 为 `gen_worker.js`/`chunk_worker.js`；
  懒加载 `skins_data.js`/`vstates_data.js`/`sound_events.js`。
- `scripts/serve.mjs`：只服务 `index.html`、`js/*.{js,webp}`、`sounds/sfx/*`、`favicon.svg`；拒绝
  docs/scripts/server/.git/点文件/目录/穿越；ETag/304；HTML/JS `no-cache`；音效 30 天、图片 7 天；HEAD/MIME。
- 单机后台公告轮询关闭（`NET_CONFIG.announce=false`）；旧房间服务仅在用户主动打开多人功能时使用。

### 2.3 输入与移动端

- 桌面：键盘、鼠标、Pointer Lock 请求/释放、全屏；锁定失败自由鼠标降级并提示一次；F11 防双触发。
- 移动：摇杆、跳跃、攻击、使用、互动、潜行、疾跑、快捷栏、多点触控、振动；`visualViewport`、
  CSS 安全区（竖屏 90° 映射）、横屏、Android 全屏/方向锁定。
- iOS 无元素全屏/鼠标锁定时不阻断，走触控/CSS 横屏路径。

### 2.4 兼容性

- `file://`、Canvas2D、WebGL2 缺失 → 中文兼容性面板 + HTTP 启动命令。
- Worker、IndexedDB、localStorage/sessionStorage、Web Audio、Pointer Lock、全屏、文件 API 缺失 → 降级/警告。
- WebGL 上下文丢失 → 可读“重新加载”面板。

### 2.5 用户验收决定（2026-11-12）

- 用户明确：**不用真实 Android Chrome / iOS Safari 补测**。
- **K-39 在 phase-07 处理**。
- 因此 phase-04 验收通过；真实移动端未测、K-39 未修仍为记录在案的遗留，不得宣传为已完成/已修复。

## 3. 关键修改文件

### 新增

| 文件 | 内容 |
|---|---|
| `js/platform.js` | 浏览器平台适配层（约 510 行） |
| `favicon.svg` | 自有 favicon |
| `docs/phases/phase-04-browser/PLAN.md` | 本阶段计划 |
| `docs/phases/phase-04-browser/TEST_REPORT.md` | 实现测试报告 |
| `docs/phases/phase-04-browser/ACCEPTANCE.md` | 独立验收 + 用户豁免结论 |
| `docs/phases/phase-04-browser/HANDOFF.md` | 本文件 |

### 修改（phase-04 代码提交 `553ceed` 内 23 个文件）

`README.md`、`index.html`、`scripts/serve.mjs`、
`js/{main,mobile,touch,screens,ui,render,game,audio,save,guest,net,netconfig,skins,social,terrain2,extras,emoji,export}.js`。

关键点：

- `index.html`：86 脚本、平台层首加载、启动/错误/兼容面板、favicon。
- `scripts/serve.mjs`：白名单 + ETag/304 + 缓存 + HEAD + 路径安全。
- `js/mobile.js`：`visualViewport`、安全区、90° 旋转映射、事件按帧合并。
- `js/touch.js`：全屏/方向/振动走平台层。
- `js/main.js`：启动前能力检查、错误面板、F11 防双触发、指针锁定失败提示。
- `js/render.js`/`ui.js`：WebGL2/Canvas2D 走平台层。
- `js/save.js`/`game.js`/`guest.js`/`net.js`/`skins.js`/`social.js`/`extras.js`：存储走平台层。
- `js/terrain2.js`：Worker 走平台层绝对 URL。
- `js/audio.js`：AudioContext/资源 URL 走平台层。
- `js/social.js` + `js/netconfig.js`：后台公告轮询默认关闭。

## 4. 关键技术决策

1. **平台层只处理浏览器差异**，不做机械命名替换；游戏逻辑/渲染算法/内容不改。
2. **阻断/降级分级**：`file://`、Canvas2D、WebGL2 阻断；其余可降级并提示。
3. **资源全部自有**：`Platform.resource()` 以 `document.baseURI` 解析，不依赖 Toy/硬编码根路径。
4. **静态服务器边界**：白名单、ETag、缓存、HEAD、路径穿越防护；不是生产部署。
5. **安全区/视口**：CSS `env()` + `visualViewport`；竖屏 CSS 旋转按 90° 映射；事件按帧合并。
6. **独立运行**：关闭单机后台公告轮询；旧房间服务只用于用户主动多人功能（phase-05 替换）。
7. **验收豁免**：真实 Android/iOS 不补测；K-39 延期 phase-07；已记录，不视为通过。

## 5. 测试结果

详见同目录 `TEST_REPORT.md` 与 `ACCEPTANCE.md`。

| 套件 | 结果 |
|---|---|
| Windows Edge 157 实现测试 | 37 PASS / 0 FAIL |
| Windows Chrome 157 实现测试 | 37 PASS / 0 FAIL |
| Windows Chrome 83 旧版 | 9 PASS / 0 FAIL（`chunk stall` 已知噪音单列） |
| Android/iOS 模拟（实现） | 21 PASS / 0 FAIL |
| 降级（无 Worker/localStorage） | 7 PASS / 0 FAIL |
| 兼容性面板 | 3/3 |
| 服务器白名单/缓存/304/HEAD/404 | PASS |
| 静态 | 90 JS `node --check`；86 脚本；`git diff --check` |
| **独立验收 Edge** | **44/44 PASS** |
| **独立验收 Chrome** | **43/45 PASS**；2 项 K-39 `chunk stall`（已延期 phase-07） |
| **独立验收移动模拟** | **25/25 PASS** |
| **独立验收兼容/降级** | **7/7 PASS** |
| **phase-03 回归** | **33/33 PASS** |

证据：`D:\ds\REA\_work\phase04-*`（实现）、`D:\ds\REA\_work\accept04-*`（独立验收）。

未测/遗留：真实 Android/iOS 真机（用户明确不补测）、受信任 F11、文件选择/照片下载、真实 GPU/FPS/发热、
真实多人/P2P、生产部署。**不得写成已通过。**

## 6. 当前 Git

| 项 | 值 |
|---|---|
| 分支 | `develop` |
| 起点 HEAD | `840b19c` |
| 本阶段代码 | `553ceed`（`feat(phase-04): run as an independent browser game`） |
| HEAD | docs 收尾为当前 HEAD（见 `git log -1`） |
| 工作区 | 干净 |
| 远程 | 已推送 `origin/opusmc-integration`；未合并、未强推、未打标签 |

## 7. 下一阶段前置条件（phase-05）

1. 用户明确发送“执行阶段 5”；不得提前修改 phase-05 功能。
2. phase-04 代码 `553ceed` 与 docs 已提交；推送/合并/PR 需用户另行确认，禁止强推。
3. phase-05 自建服务器必须处理：临时玩家 ID 签发/校验、真实短时重连、房间所有权 F-1、`/api/skin`、
   管理员公告、旧 `mcjs-room-key`、服务端权威外观/移动/存档。
4. `GuestSession` 的昵称/连接状态可继续作为 UI 数据源；不要恢复 `Account`。
5. 旧 `NET_CONFIG.rooms` 仍是原房间服务；phase-05 替换后决定是否恢复 `announce`。
6. F-1 与本地 P2P 主机 provisional ID 属 phase-05 服务端身份问题；K-39 属 phase-07。
7. 真实 Android/iOS 真机测试按用户决定不再补测；后续如需发布验收，仍应重新评估。

## 8. 下一阶段需要特别检查的文件和依赖

| 文件/依赖 | 检查点 |
|---|---|
| `js/platform.js` | 平台能力/兼容面板/存储/Worker/安全区；phase-05 不破坏 |
| `js/guest.js` | 唯一身份入口；不要把 `playerId` 发回服务器或当认证；phase-05 签发/校验 |
| `js/net.js` / `js/p2p.js` | `hello`/`host`/`join` 无 token；`login.eid` 仍来自旧服务；房间 key 旧凭据 |
| `js/netconfig.js` | `rooms` 仍指旧服务；`announce=false`；phase-05 替换 |
| `scripts/serve.mjs` | 白名单/缓存；不要把服务器存档放进静态根；LAN/HTTPS 后续 |
| `js/social.js` | 公告轮询默认关闭；phase-05 重新启用需接自建服务 |
| `index.html` | 86 脚本；`platform.js` 首；`guest.js` 在 `net.js` 前；不要重新加 toy/account/cloudsave/checkin |
| `js/save.js` / `js/game.js` | 单人 IndexedDB 保持；phase-05 不覆盖单人存档 |
| `docs/PROJECT_SPEC.md` | §3 访客身份、§11.9 phase-04 结果、§11.10 phase-05 约束 |
| `server/` | phase-05 才实现；现在仍为空 |
| `docs/KNOWN_ISSUES.md` | K-39（phase-07）、K-42/K-47/K-50（phase-05）、K-51/K-64/K-65（真机/操作未测） |

## 9. 已知遗留 / 风险

- 真实 Android/iOS 真机未测（用户明确不补测）；只使用 Chromium 模拟，不能宣称真机通过。
- K-39 `chunk stall` 未修，留 phase-07；Chrome headless 验收 2 项失败均属此。
- 真实 GPU FPS、手机发热、长时间运行未测。
- 受信任 F11、文件选择/照片下载未测。
- 旧房间服务仍存在；多人/重连/P2P 留 phase-05。
- 静态服务器无 TLS/鉴权/限流/Range；不是生产部署。
- `Platform` 能力在页面加载时探测一次；扩展注入脚本被启动计数排除。
