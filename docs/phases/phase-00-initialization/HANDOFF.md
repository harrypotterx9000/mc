# phase-00 初始化 · 交接（HANDOFF）

- 状态：**phase-00 完成**；phase-01 未开始（用户要求暂缓）
- 基线：`develop` = `2798c08`（PR #1 整合提交），工作区干净
- 远程：PR #1 打开中（`main` ← `opusmc-integration`），远程 `main` 仍为 `6c476c0`

## 已完成

1. 原始源码检查、备份（zip + SHA-256）与字节级导入（`v0.0.0-original`）
2. 独立项目 `D:\Projects\OpusMC` 与独立 Git
3. 原版 Edge 试玩（用户确认无问题）
4. 源码复核 / 依赖分析 / 运行时分析（`docs/research/`）
5. 文档体系与阶段目录
6. 音效包补齐
7. 首次推送与 PR #1
8. 本地基线对齐到 PR #1 的整合提交

## 按规则丢弃

- phase-01 的未验收改动（3 个文件）、stash、补丁、阶段分支与临时文档：**全部丢弃**。
- 当前没有任何未验收的工作残留。

## 下一阶段启动条件

- 必须由用户明确发出"开始 phase-01"指令。
- 启动时：读 `docs/START-HERE.md` 与 `docs/PROJECT_SPEC.md` §6；从 `develop` 建 `phase/01-menu-cleanup`；先写 PLAN 再改代码。
- 验收后提交；合并到 `develop` 需用户确认。

## PR #1 合并后的动作

```powershell
cd D:\Projects\OpusMC
git fetch origin
git branch -u origin/main main
# 视合并结果对齐 develop（快进或合并），再继续 phase 分支
```

## 交接方式

新会话以 `docs/START-HERE.md` + `docs/STATUS.md` + 实际 `git log`/`git status` 为准；
不要重新导入源码、不要重建 PR、不要凭记忆推断仓库状态。
