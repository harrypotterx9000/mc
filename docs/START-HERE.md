# OpusMC — 从这里开始（新会话入口）

> 这是给下一次 DeepSeek Harness 会话的**第一份必读文件**。读完本页即可接管项目，不需要重读历史报告。
> 最后更新：2026-11-06（phase-00 复核收尾）

## 1. 三十秒摘要

- 项目：把 B 站 Toy 版浏览器体素游戏 OpusMC 改造成**独立运行、无账号访客、自建服务器**的版本。
- 现状：**phase-00 初始化与整体复核已完成**；**phase-01 尚未开始**（等待用户明确发送“执行阶段 1”）。
- 代码：`D:\Projects\OpusMC`；`develop` HEAD 为**阶段 0 收尾 docs 提交**（父提交 **`e49a54c`**），代码内容与 **`2798c08`**（`v0.1.0-integration`）相同。
- 原始源码：`D:\ds\REA\opusmc`（完整备份在 `D:\ds\REA\_backup\`）。
- 远程：`https://github.com/harrypotterx9000/mc`；PR #1 仍打开，远程 `main` 未变。
- 阶段 0 收尾文档**已提交**（仅 `docs/`）；游戏源码无改动。

## 2. 阅读顺序

1. `docs/START-HERE.md`（本文件）
2. `docs/PROJECT_SPEC.md` —— 长期总规范（注意：§6 尚未加入两个首启界面的删除，phase-01 第一步要补）
3. `docs/STATUS.md` —— 当前分支/标签/远程/待办
4. `docs/ARCHITECTURE.md` —— 分层、状态归属、补丁矩阵、**§9 阶段 0 复核补充**
5. `docs/DECISIONS.md` —— ADR-001…011（ADR-011 为阶段 1 边界与 10 项决策）
6. `docs/KNOWN_ISSUES.md` —— 已知问题、NOT TESTED、服务端/环境依赖
7. `docs/phases/phase-00-initialization/HANDOFF.md` —— 阶段 0 交接

## 3. Git 现实（以实际仓库为准）

| 项 | 值 |
|---|---|
| 仓库 | `D:\Projects\OpusMC` |
| 当前分支 | `develop`（跟踪 `origin/opusmc-integration`） |
| HEAD | 阶段 0 收尾 docs 提交（父 `e49a54c`；哈希见 `git log -1`） |
| 代码基线 | `2798c08`（`v0.1.0-integration`） |
| 标签 | `v0.1.1-context=e49a54c`、`v0.1.0-integration=2798c08`、`v0.1.0-preproject=3913860`、`v0.0.0-original=6090828` |
| 远程分支 | `main=6c476c0`、`opusmc-init=e636804`、`opusmc-integration=2798c08` |
| PR | #1：`main` ← `opusmc-integration`，**未合并**；head `2798c08`，merge `3f9e903` |
| 工作区 | 干净；阶段 0 收尾文档已提交（仅 `docs/`）；无代码改动、无 stash、无未跟踪文件 |

> `e49a54c` 只改 `docs/`，不是代码版本；阶段 0 文档提交在其之上。阶段分支从当前 `develop` 创建即可；代码基线仍按 `2798c08` 对照。

## 4. 运行方式

```powershell
cd D:\Projects\OpusMC
node scripts\serve.mjs      # 仅 127.0.0.1:8080，零依赖
# Edge 打开 http://127.0.0.1:8080/
```

- 直接双击 `index.html`（file://）不可用：浏览器禁止 Worker，地形会卡死。
- 端口占用：`$env:PORT=8081; node scripts\serve.mjs`。
- 服务器可能没有在跑：先执行上面的命令再开页面。
- 仓库里**没有** `启动游戏.bat`；`game.js:607` 的提示是旧文案，阶段 5/8 再补启动脚本或先改文案。

## 5. 当前边界（务必遵守）

- **不要擅自开始 phase-01 或任何游戏功能改造**；每个阶段必须等用户明确指令。
- **未验收的改动不保留**：未通过用户验收的代码/文档改动直接丢弃（不提交、不留 stash）。
- 不新增强制账号/登录；不引入永久账号体系（见 PROJECT_SPEC §2/§3）。
- 合并到 `develop`、`develop` 合并到 `main`、任何远程推送，都必须用户确认。
- 禁止 `push --force`、禁止未经确认的历史重写。
- 没有实测的功能一律标 **NOT TESTED**；推断不得写成事实。

## 6. 阶段 0 复核的关键结论

- `index.html` 加载 **90 个脚本**；`js/` 共 **94 个 `.js` + 1 个 `.webp`**；4 个懒加载脚本。
- 有 **213 个顶层类**、**84 个 `*Screen`**；**40 个文件**直接给 `Game.prototype` 赋值（257 处，174 个方法名）。
- `Game.tick` 由 **10 个文件**包装；`Game.useEquipment` 4 个；`UI.open` 2 个（红石先、遥测后）。
- **仓库内没有服务器端代码**；`NetClient` 是“WebSocket ↔ 原版 Java 服务器代理”的客户端，不是房间协议。
- **`p2p.js` 的 `LocalHost` 是最接近自建服务器的现有实现**：主机跑世界、客人差量同步；阶段 5 采用 B/C 混合，协议词汇/区块编码复用它，传输换 WebSocket。
- 无头实测：Edge 156 启动到标题、WebGL2、创建世界 62 区块、保存 IndexedDB、0 游戏错误；Node v26.13 可加载核心模块并生成区块。
- 无头/真机性能、手机兼容、多人服务器、HTTPS/WSS 均 **NOT TESTED**。

## 7. 阶段 1 的已确认边界（未执行）

- 阶段 1 第一步：更新 `PROJECT_SPEC.md` §6，加入“欢迎来到 OpusMC（用户协议窗口）”和“你是哪种玩家？”两个界面的删除。
- 分支：从当前 `develop`（含阶段 0 文档提交）创建 `phase/01-menu-cleanup`。
- 采用 **1-A**：删除 `UnlockScreen` 的同时让 `onlineGate()` 直接放行，避免活引用；这会提前完成阶段 2 的多人门槛部分。
- 阶段 1 只删“选项入口 + 反馈面板”；保留 `Telemetry` 核心与 `GAME_BUILD`。
- 删除反馈面板时必须同步改 `social.js:31` 对 `FeedbackScreen` 的引用。
- 删除签到/活动前，活动款装饰暂按阶段 2/3 的时序处理；管理员披风始终隐藏。
- 新世界默认关教程；旧存档 `meta.tutorial` 保留。

## 8. 目录与证据

```
D:\Projects\OpusMC\
  index.html        游戏页面（已去掉 B 站跳转）
  js\               94 个 .js + emoji.webp；页面加载 90 个
  sounds\sfx\       4,849 个原版音效（43.2 MB）
  scripts\serve.mjs 本地静态服务器
  docs\             项目文档与阶段记录
  server\           自建服务器（后续阶段，当前只有 .gitkeep）
```

- 原始源码备份：`D:\ds\REA\_backup\opusmc-original-2026-11-06.zip`（11.9 MB）+ `.sha256.txt`（91 行）
- 原始工作区：`D:\ds\REA\opusmc`（未改动，91 个文件哈希已复核一致）
- 历史分析报告：`D:\ds\REA\opusmc\OpusMC-功能全景-证据.md`、`OpusMC-深入验证-运行时.md`
- 阶段 0 实测：无头 Edge 156 + SwiftShader；Node v26.13.0；临时浏览器配置目录，未写入正式数据

## 9. 已知噪音（不是 bug）

- 控制台会有 `missing tile i_waxed_*_copper_door` / `missing tile all` 警告（原版就存在）。
- 房间服务 `xz.honghemc.cn:8443` 的请求可能 403/CORS（原作者服务；阶段 1 删公告后会减少，阶段 3/5 彻底移除）。
- `favicon.ico` 404。
- `docs/phases/phase-00-initialization/TEST_REPORT.md` 中“sound_events.js 404”已过时；音效包现已就位。

## 10. 下一步

等待用户明确发送：

> **执行阶段 1**

收到后按 `docs/phases/phase-00-initialization/HANDOFF.md` 第 7/8 节执行；不得提前做阶段 2–9 的功能。