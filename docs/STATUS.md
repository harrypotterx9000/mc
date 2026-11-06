# 项目状态（STATUS）

- 更新时间：2026-11-06
- 当前阶段：**phase-00 初始化与整体复核（完成；文档收尾）**
- 下一阶段：**phase-01 主菜单清理 —— 未开始**（等待用户明确发送“执行阶段 1”）
- 工作区：**干净**；阶段 0 收尾文档已提交（仅 `docs/`）；游戏源码无改动，无 stash

## Git

| 项 | 值 |
|---|---|
| 仓库 | `D:\Projects\OpusMC` |
| 当前分支 | `develop`（阶段 0 收尾 docs 提交；父提交 `e49a54c`，哈希见 `git log -1`） |
| 代码基线 | `2798c08`（`v0.1.0-integration`）；`e49a54c` 只改文档，游戏代码与 `2798c08` 相同 |
| 当前标签 | `v0.1.1-context` @ `e49a54c`；`v0.1.0-integration` @ `2798c08`；`v0.1.0-preproject` @ `3913860`；`v0.0.0-original` @ `6090828` |
| 远程 | `origin/main=6c476c0`；`origin/opusmc-integration=2798c08`；`origin/opusmc-init=e636804` |
| PR #1 | `main` ← `opusmc-integration`，**未合并**；head `2798c08`，merge ref `3f9e903`；本次未操作远程 |
| 工作区 | 干净；阶段 0 收尾文档已提交（仅 `docs/`），无代码改动、无 stash、无未跟踪文件 |

> 本地 `main` 仍是早期导入历史（`e636804`），与远程 `main` 无关；开发以 `develop` 为准。
> 本次阶段 0 复核确认：**不把 HEAD 回退到 `2798c08`，而是保留 `e49a54c` 作为阶段 0 的父提交**（仍是 `v0.1.1-context` 标签）；阶段 0 文档提交在其之上。两者代码内容相同。

## 整体状态

- **单机**：可运行。静态服务器 + 浏览器可启动到标题，创建/加载/保存世界正常（已实测）。
- **多人**：不可用。仓库无服务器端代码；`NetClient` 连接的是原作者的外部“原版 Java 服务器代理”。
- **账号/解锁**：仍完整存在，尚未移除；单人入口已是开放状态（`SINGLE_OPEN=true`），多人仍走账号/解锁门槛。
- **Toy**：普通浏览器中 Toy 调用降级为 `unsupported`，不阻塞单机；平台相关 UI/接口仍在源码中。
- **阶段 1 决策**：已锁定 10 项，并确定采用 **1-A**（删除 `UnlockScreen` 的同时让 `onlineGate()` 直接放行）。详见 `docs/phases/phase-00-initialization/HANDOFF.md` 与 `DECISIONS.md` ADR-011。

## 已完成

- 原始源码检查与备份（zip + 91 行 SHA-256 清单）
- 独立项目目录与独立 Git 仓库（字节级原始导入，`v0.0.0-original` 校验一致）
- 原版 Edge 试玩（用户确认：无问题）
- 源码复核、依赖分析、运行时分析（`docs/research/`）
- 项目文档体系与阶段目录
- 原版音效包（`js/sound_events.js` + `sounds/sfx/*`，4,849 个文件，43.2 MB）
- 首次远程推送与 PR #1（新分支 + PR，未改远程 `main`）
- 本地 `develop` 对齐 PR #1 整合提交
- **阶段 0 整体复核**：基线、平台依赖、账号依赖、网络结构、逻辑分离、无头运行验证
- **阶段 0 收尾文档**：STATUS / ARCHITECTURE / CHANGELOG / KNOWN_ISSUES / HANDOFF / START-HERE / DECISIONS

## 已验证（事实）

- `index.html` 加载 **90 个脚本**；`js/` 共 **94 个 `.js` + 1 个 `.webp`**；4 个懒加载脚本
- **213 个顶层类**、**84 个 `*Screen` 类**
- **40 个文件**直接给 `Game.prototype` 赋值（257 处，174 个方法名，含包装器）
- **10 个文件**包装 `Game.tick`；**4 个文件**包装 `Game.useEquipment`；**2 个文件**包装 `UI.open`
- `NetClient` 有 **53 种**入站消息、22 种出站消息；区块二进制使用原版 block state 调色板
- 仓库内**无服务器端代码**：`server/` 只有 `.gitkeep`，`scripts/serve.mjs` 只做静态 GET/HEAD
- 单人存档 IndexedDB 正常；云存档依赖账号，将被移除
- 无头实测：Edge 156 启动到标题，WebGL2 正常，创建世界 62 区块、保存到 IndexedDB、0 游戏错误
- 无头 Node 实测：核心数据/方块/World/世界生成可在 Node 加载，并生成 98,304 方块区块

## 未验证 / NOT TESTED

- 电脑端 60 FPS、手机端 30/60 FPS（未在真实 GPU/真机测量）
- 手机/平板真机触控、发热、内存、iOS Safari 兼容性
- 长时间运行（>1 小时）稳定性
- 多人（自建服务器）全部功能
- HTTPS/WSS、公网 NAT、反向代理
- 双存档切换、服务器备份恢复演练
- 阶段 1 的任何代码改动（尚未开始）

## 待办

1. 阶段 0 文档已提交（仅 `docs/`）；未推送远程，推送仍需单独确认
2. 阶段 1：先更新 `PROJECT_SPEC.md` §6（加入两个首启界面的删除），再从当前 `develop` 建 `phase/01-menu-cleanup`（包含阶段 0 文档提交）
3. 阶段 1 采用 **1-A**；按冻结清单实施，不提前做阶段 2/3 的功能
4. 后续阶段：phase-02 解锁移除、phase-03 访客模式、phase-04 浏览器、phase-05 服务器、phase-06 双存档、phase-07 性能、phase-08 部署、phase-09 验收
