# 项目状态（STATUS）

- 更新时间：2026-11-06
- 当前阶段：**phase-00 初始化（完成）**
- 下一阶段：**phase-01 主菜单清理 —— 未开始**（用户明确要求暂缓）
- 工作区：干净；无 stash、无未验收改动

## Git

| 项 | 值 |
|---|---|
| 仓库 | `D:\Projects\OpusMC` |
| 当前分支 | `develop` @ `2798c08`（跟踪 `origin/opusmc-integration`） |
| `main`（本地） | `e636804`（早期导入历史，与远程 main 无关） |
| 基线标签 | `v0.1.0-integration` @ `2798c08`；`v0.1.0-preproject` @ `3913860`；`v0.0.0-original` @ `6090828` |
| 远程 `main` | `6c476c0`（仅 README，未被改动） |
| 远程分支 | `opusmc-init` @ `e636804`、`opusmc-integration` @ `2798c08` |
| PR #1 | `main` ← `opusmc-integration`，**打开中**；merge ref `3f9e903` |

> 开发基线以 `2798c08` 为准（PR #1 的内容）。PR 合并后执行：
> `git fetch origin && git branch -u origin/main main`，再按需把 `develop` 对齐 `origin/main`。

## 已完成

- 原始源码检查与备份（zip + 91 行 SHA-256 清单，复核 0 处差异）
- 独立项目目录与独立 Git 仓库（字节级原始导入，`v0.0.0-original` 校验一致）
- 原版 Edge 试玩（用户确认：无问题）
- 源码复核、依赖分析、运行时分析（`docs/research/`）
- 项目文档体系与阶段目录
- 原版音效包（`js/sound_events.js` + `sounds/sfx/*`，4,849 个文件，43.2 MB）
- 首次远程推送与 PR #1（新分支 + PR，未改远程 `main`）
- 本地 `develop` 对齐 PR #1 整合提交；`README` 恢复为项目版本

## 已丢弃（按"未验收改动不保留"）

- phase-01 主菜单清理的未验收改动（3 个文件，+3/−37 行）、对应 stash、补丁与阶段分支
- 相关临时文档与截图

## 已验证（事实）

- 90 个脚本、固定加载顺序、213 个类、28 个文件补丁 `Game.prototype`
- 无服务器端代码；联机仅客户端
- 单人存档 IndexedDB；云存档依赖账号，将被移除

## 未验证 / NOT TESTED

- 电脑端 60 FPS、手机端 30/60 FPS（未在真实设备测量）
- 自建服务器（未实现）
- 手机/平板真机兼容性（仅代码层分析）
- 原版音效：文件已就位，未逐条试听

## 待办

1. 等用户确认后启动 phase-01（从 `develop` 建 `phase/01-menu-cleanup`）
2. PR #1 合并 → 按上面的命令对齐 `main` / `develop`
3. 后续阶段：phase-02 解锁移除、phase-03 访客模式、phase-04 浏览器、phase-05 服务器、phase-06 双存档、phase-07 性能
