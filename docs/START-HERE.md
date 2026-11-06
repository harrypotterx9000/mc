# OpusMC — 从这里开始（新会话入口）

> 这是给下一次 DeepSeek Harness 会话的**第一份必读文件**。读完本页即可接管项目，不需要重读历史报告。
> 最后更新：2026-11-06

## 1. 三十秒摘要

- 项目：把 B 站 Toy 版浏览器体素游戏 OpusMC 改造成**独立运行、无账号访客、自建服务器**的版本。
- 现状：**初始化完成，游戏功能改造尚未开始**（phase-01 被用户明确暂缓）。
- 代码：`D:\Projects\OpusMC`，`develop` 分支停在 **`2798c08`**（PR #1 的整合提交），工作区干净。
- 原始源码：`D:\ds\REA\opusmc`（完整备份在 `D:\ds\REA\_backup\`）。
- 远程：`https://github.com/harrypotterx9000/mc`，**PR #1 处于打开状态**（base `main` ← compare `opusmc-integration`）。

## 2. 阅读顺序

1. `docs/START-HERE.md`（本文件）
2. `docs/PROJECT_SPEC.md` —— 唯一长期总规范（目标、边界、阶段、验收）
3. `docs/STATUS.md` —— 当前分支/标签/远程/待办
4. `docs/ARCHITECTURE.md` —— 90 个脚本的分层、状态归属、补丁矩阵、调用链
5. `docs/DECISIONS.md` —— 已确认的技术决策（ADR-001…010）
6. `docs/KNOWN_ISSUES.md` —— 已知问题与 NOT TESTED
7. `docs/phases/phase-00-initialization/HANDOFF.md` —— 初始化交接

## 3. Git 现实（以实际仓库为准）

| 项 | 值 |
|---|---|
| 仓库 | `D:\Projects\OpusMC` |
| 当前分支 | `develop`（跟踪 `origin/opusmc-integration`） |
| HEAD | `2798c08 chore: integrate OpusMC project` |
| 标签 | `v0.0.0-original`（`6090828`）、`v0.1.0-preproject`（`3913860`）、`v0.1.0-integration`（`2798c08`） |
| 远程分支 | `main`=`6c476c0`（仅 README）、`opusmc-init`=`e636804`、`opusmc-integration`=`2798c08` |
| PR | #1：`main` ← `opusmc-integration`，**未合并**（merge ref `3f9e903`） |
| 工作区 | 干净；**没有 stash、没有未验收改动** |

> 本地 `main` 仍是早期导入历史（`e636804`），与远程 `main` 无关；**开发以 `develop`（=PR #1 内容）为准**。
> PR 合并后：`git fetch origin && git branch -u origin/main main`，再把 `develop` 对齐 `origin/main`。

## 4. 运行方式

```powershell
cd D:\Projects\OpusMC
node scripts\serve.mjs      # 仅 127.0.0.1:8080，零依赖
# Edge 打开 http://127.0.0.1:8080/
```

- 直接双击 `index.html`（file://）不可用：浏览器禁止 Worker，地形会卡死。
- 端口占用：`$env:PORT=8081; node scripts\serve.mjs`。
- 服务器可能没有在跑：先执行上面的命令再开页面。

## 5. 当前边界（务必遵守）

- **不要擅自开始 phase-01 或任何游戏功能改造**；每个阶段必须等用户明确指令。
- **未验收的改动不保留**：未通过用户验收的代码/文档改动直接丢弃（不提交、不留 stash）。本次已按此规则丢弃 phase-01 WIP。
- 不新增强制账号/登录；不引入永久账号体系（见 PROJECT_SPEC §2/§3）。
- 合并到 `develop`、`develop` 合并到 `main`、任何远程推送，都必须用户确认。
- 禁止 `push --force`、禁止未经确认的历史重写。
- 没有实测的功能一律标 **NOT TESTED**；推断不得写成事实。

## 6. 下一步（等用户指令）

用户确认后，才从 `develop` 创建 `phase/01-menu-cleanup`，按 PROJECT_SPEC §6 的删除清单实施；
具体拆分建议见 `docs/STATUS.md` 的"待办"。

## 7. 目录与证据

```
D:\Projects\OpusMC\
  index.html        游戏页面（已去掉 B 站跳转）
  js\               94 个文件（90 脚本 + chunk_worker/skins_data/vstates_data/emoji.webp + sound_events.js）
  sounds\sfx\       4,849 个原版音效（43.2 MB）
  scripts\serve.mjs 本地静态服务器
  docs\             项目文档与阶段记录
  server\           自建服务器（后续阶段，当前为空）
```

- 原始源码备份：`D:\ds\REA\_backup\opusmc-original-2026-11-06.zip`（11.9 MB）+ `.sha256.txt`（91 行）
- 原始工作区：`D:\ds\REA\opusmc`（**未改动**，91 个文件哈希已复核一致）
- 历史分析报告：`D:\ds\REA\opusmc\OpusMC-功能全景-证据.md`、`OpusMC-深入验证-运行时.md`

## 8. 已知噪音（不是 bug）

- 控制台会有 `missing tile i_waxed_*_copper_door` / `missing tile all` 警告（原版就存在）。
- 房间服务 `xz.honghemc.cn:8443` 的请求可能 403/CORS（原作者服务，phase-03 前移除）。
- `favicon.ico` 404。
