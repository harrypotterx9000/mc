# 项目状态（STATUS）

- 更新时间：2026-11-12
- 当前阶段：**phase-04 浏览器独立运行 — 实现、测试、独立验收与用户验收完成（带两项明确豁免）；代码已提交**
- 下一阶段：**phase-05 自建服务器**（未开始，需用户明确指令；未提前修改）
- 代码版本：phase-04 代码 `553ceed`；docs 收尾为当前 HEAD（见 `git log -1`）
- 当前分支：`develop`（跟踪 `origin/opusmc-integration`；未新建/切换/重置分支）

## Git

| 项 | 值 |
|---|---|
| 仓库 | `D:\ds\REA\opusmc` |
| 当前分支 | `develop`（跟踪 `origin/opusmc-integration`） |
| phase-04 代码 | `553ceed`（`feat(phase-04): run as an independent browser game`） |
| HEAD | docs 收尾为当前 HEAD（见 `git log -1`） |
| 工作区 | **干净**（phase-04 代码与 docs 已提交） |
| 远程 | **未推送**；未合并、未强推、未打标签 |
| 历史代码 | phase-03 `025cba8`；phase-02 `a9dc47b`；phase-01 `15154bd`；基线 `2798c08` |

> `D:\Projects\OpusMC` 仍是 phase-01 副本；如以那份为准，需要用户确认后单独同步，禁止直接覆盖。

## 整体状态

- **阶段**：phase-00/01/02 完成；phase-03 客户端改造完成、验收结束（端到端联机/重连 BLOCKED）；**phase-04 完成并验收（用户明确豁免真实 Android/iOS 补测；K-39 留 phase-07）**；phase-05 未开始。
- **运行方式**：`node scripts/serve.mjs` → 浏览器打开 `http://127.0.0.1:8080/`；不能双击 `index.html`（页面会明确提示）。
- **身份**：无账号；昵称 + 服务器临时 ID（phase-05）；phase-04 未改身份模型。
- **单人存档**：IndexedDB `mc-js-clone`；已验证创建/保存/刷新恢复。
- **外观**：`mcjs-look` 本设备保存；phase-04 未改外观内容。
- **多人**：旧房间服务仍是既有后端；单机后台自动公告轮询已关闭，真实服务器留 phase-05。
- **代码规模**：`index.html` **86** 个脚本；`js/` **90** 个 `.js` + `emoji.webp`（新增 `js/platform.js`）。
- **实现测试**：Edge 157 桌面 **37/37**；Chrome 157 桌面 **37/37**；Chrome 83 旧版 **9/9**；Android/iOS 模拟 **21/21**；降级 **7/7**；兼容性面板 **3/3**；90 JS `node --check`。
- **独立验收**：Edge 桌面 **44/44**；Chrome 桌面 **43/45**（2 项为 K-39 `chunk stall`，用户延期 phase-07）；移动模拟 **25/25**；兼容/降级 **7/7**；phase-03 回归 **33/33**。
- **验收结论**：phase-04 **通过**，但真实 Android/iOS 真机未测、K-39 未修；这两项已在用户验收中明确豁免/延期，不得宣传为真机通过或已修复。

## phase-04 已完成内容（验收通过）

### 任务 1：平台适配

- 新增 `js/platform.js`：能力探测、兼容性阻断/警告、`storage`（localStorage/sessionStorage 安全回退）、
  `audio`、`workers`、`files`、`display`（安全区/视口/全屏/方向）、`input`（Pointer Lock/振动）、
  `graphics`（Canvas2D/WebGL2/上下文丢失）、`resource()`、`compat` 报告与面板。
- 接入：`render.js`、`ui.js`、`game.js`、`main.js`、`audio.js`、`save.js`、`terrain2.js`、`screens.js`、
  `touch.js`、`mobile.js`、`guest.js`、`net.js`、`skins.js`、`social.js`、`extras.js`、`emoji.js`、`export.js`。
- 没有机械重命名所有浏览器 API；只把需要能力判断、回退或供应商差异的调用点接入平台层。

### 任务 2：独立资源加载

- 图片：`assets.js` 图集、`js/emoji.webp`；字体：`js/font.js` 图集；音频：`js/sound_events.js` + `sounds/sfx/*.m4a`；
  数据：各 `*_data.js`；Worker：`gen_worker.js`、`chunk_worker.js`；懒加载：`skins_data.js`、`vstates_data.js`。
- 所有资源路径经 `Platform.resource()` 按页面地址解析；不依赖 Toy/硬编码根路径。
- `scripts/serve.mjs` 重写：只服务游戏自有静态文件；拒绝 docs/scripts/server/.git/点文件/目录/穿越；
  ETag + 304；HTML/JS `no-cache`；音效 30 天、图片 7 天；显式 MIME；HEAD。
- 启动/标题/单人游戏 65 秒内无第三方平台请求；单机后台公告轮询关闭（`NET_CONFIG.announce=false`）。

### 任务 3：网页独立启动

- `index.html`：86 个脚本、启动进度、资源加载失败提示、90 s 启动超时、`file://` 提示、兼容性面板、favicon。
- 浏览器打开 → 资源加载 → WebGL2 初始化 → 主菜单 → 本地世界创建 → 进入游戏 → 保存/刷新恢复，均已验证。
- 不能依赖 `file://`：会显示“请通过本地服务器打开”及 `node scripts/serve.mjs` 命令。

### 任务 4：设备输入

- 电脑：键盘、鼠标、全屏、Pointer Lock 请求/释放；锁定失败时自由鼠标降级并提示一次；F11 防双触发。
- 手机：摇杆、跳跃、攻击、使用、互动、潜行、疾跑、快捷栏、多点触控；方向变化；CSS 横屏；
  `visualViewport` 视口；CSS `env(safe-area-inset-*)` 安全区（含竖屏旋转 90° 映射）；振动走平台层。
- Android 触摸首次进入世界可请求全屏并锁横屏；iOS 无元素全屏/鼠标锁定时不阻断。

### 任务 5：兼容性

- 阻断项：`file://`、Canvas2D、WebGL2 → 中文兼容性面板 + 启动命令/浏览器建议。
- 降级项：Worker、IndexedDB、localStorage、sessionStorage、Web Audio、Pointer Lock、全屏、文件 API。
- WebGL 上下文丢失 → 可读“重新加载”面板。
- 已验证 Windows Edge 157 / Windows Chrome 157；额外验证旧 Chrome 83；Android/iOS 仅 Chromium 模拟，真机未测（用户已豁免补测）。

## 已验证（phase-04）

| 测试 | 结果 |
|---|---|
| 90 个 `js/*.js` 全量 `node --check` | PASS |
| `index.html` 脚本数 | 86 |
| `git diff --check` | PASS |
| Edge 157 桌面（实现测试） | 37/37 PASS |
| Chrome 157 桌面（实现测试） | 37/37 PASS |
| Chrome 83 旧版 | 9/9 PASS（`chunk stall` 已知噪音单列） |
| Android/iOS 模拟（实现测试） | 21/21 PASS |
| 降级（无 Worker/localStorage） | 7/7 PASS |
| 兼容性面板（file://、无 WebGL2、上下文丢失） | 3/3 PASS |
| 服务器白名单/缓存/304/HEAD/404 | PASS |
| 正常启动/单人 `game.errLog` | 空 |
| 未捕获异常（桌面/移动正常路径） | 0 |

证据：`D:\ds\REA\_work\phase04-*`；详细：`docs/phases/phase-04-browser/TEST_REPORT.md`。

## 独立验收（2026-11-12，已由用户验收）

- 报告：`docs/phases/phase-04-browser/ACCEPTANCE.md`；证据：`D:\ds\REA\_work\accept04-*`。
- Edge 157 桌面：**44/44 PASS**。
- Windows Chrome 157 桌面：**43/45 PASS**；2 项失败均为已知 K-39 `chunk stall`（世界仍进入 play、方块恢复）。
- Android Chrome / iOS Safari：仅 Chromium 模拟 **25/25 PASS**；真实设备 **未测试**。
- 兼容性/降级：**7/7 PASS**；phase-03 回归：**33/33 PASS**。
- 静态：90/90 `node --check`、86 页面脚本、`git diff --check`、LF/no BOM。
- 受信任 F11、文件选择/照片下载：**NOT TESTED**（headless/原生对话框限制）。
- **用户验收决定**：不补测真实 Android/iOS；K-39 留 phase-07。phase-04 据此通过。

## 未验证 / BLOCKED / NOT TESTED（已记录，不阻塞 phase-04）

- **真实 Android Chrome 真机**：未测试（用户明确不补测；仅 Chromium 模拟）。
- **真实 iOS Safari / WebKit**：未测试（用户明确不补测；仅 Chromium UA/视口/触控模拟）。
- 真机触控手感、软键盘、音频解锁、方向锁定、安全区、发热、内存、长时间运行：NOT TESTED。
- 真实 GPU（NVIDIA/AMD/Intel）FPS、光影编译、动态分辨率：NOT TESTED（SwiftShader 不代表性能；phase-07）。
- 真实 Windows 有头窗口/浏览器扩展/企业策略：仅无头验证。
- 受信任 F11、文件选择/照片下载：NOT TESTED。
- 真实多人房间/P2P/公告/`/api/skin`/`mcjs-room-key`：仍依赖旧服务，留 phase-05。
- HTTPS/WSS、公网、反向代理、鉴权、限流、Range：phase-08。
- phase-03 的端到端联机/真实重连仍 BLOCKED；F-1 仍在 phase-05 处理。
- K-39 `chunk stall`：phase-07 处理（用户决定）。

## 阶段进度（未完成阶段为 phase-05 起）

| 阶段 | 状态 | 内容 |
|---|---|---|
| phase-04 浏览器 | **完成并验收（带豁免）；代码 `553ceed`** | 平台层、自有资源、静态服务器、网页入口、设备输入、兼容性；真实移动端未测、K-39 延期 |
| phase-05 服务器 | 未开始 | 自建服务器、房间/邀请码、临时玩家 ID、真实重连、服务端权威、多人存档、F-1 |
| phase-06 双存档 | 未开始 | 单人 IndexedDB 与多人服务器存档独立管理 |
| phase-07 性能 | 未开始 | 区块/Worker/GPU/内存/网络优化，真实设备测量；含 K-39 |
| phase-08 部署 | 未开始 | 先 LAN；HTTPS/WSS、公网、NAT 后续 |
| phase-09 验收 | 未开始 | 全阶段回归、真机与发布验收 |

## 待办（phase-04 结束后）

1. phase-04 代码与 docs 已提交；**未推送**。推送/合并/PR 需用户另行确认，禁止强推。
2. 不进入 phase-05，等待用户明确指令。
3. phase-05 前置：自建服务器、临时玩家 ID 签发/校验、真实重连、房间所有权 F-1、`/api/skin`、管理员公告、
   旧 `mcjs-room-key`、服务端权威存档；决定是否恢复 `NET_CONFIG.announce`。
4. K-39 `chunk stall` 留 phase-07；真实 Android/iOS 真机测试按用户决定不再补测。
5. `D:\Projects\OpusMC` 未同步；如以那份为准，需要用户确认后单独同步。

## phase-03 历史（客户端完成、验收结束；代码 `025cba8`）

- 删除 `account.js`、`toy.js`、`cloudsave.js`、`checkin.js`；新增 `guest.js`（`GuestSession`）；`index.html` 85 个脚本。
- 全部外观开放并保存在本设备 `mcjs-look`；单人 IndexedDB；无账号/B站/Toy/云存档/签到。
- 实现测试 33/33 + 首启 1/1；独立验收 68 PASS / 0 FAIL / 1 BLOCKED + F-1 非阻断 UI FAIL。
- 真实联机/重连/服务端 ID、F-1 留 phase-05；详见 `docs/phases/phase-03-guest-mode/`。

## phase-02 历史（已完成并验收，代码 `a9dc47b`）

- 全部皮肤/披风/装饰（含 `adm*` 与活动款）开放；多人入口无门槛；邀请码保留。
- `mcjs-look` 本设备外观保存为 phase-03 访客模式保留路径；独立验收 35 项 PASS；末影龙结局 8/8 PASS。

## phase-01 历史（已完成并验收，代码 `15154bd`）

- 删除首启两屏、公告面板、解锁面板、反馈面板、遥测、制作人员/协议入口；脚本 90 → 88；`js/` 94 → 92。
