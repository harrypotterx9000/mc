# phase-00 初始化 · 交接（HANDOFF）

## 当前状态

- 阶段：phase-00 完成
- 仓库：`D:\Projects\OpusMC`
- 分支：`main` = `develop` = 基线提交
- 标签：`v0.0.0-original`（原始）、`v0.1.0-preproject`（基线）
- 工作区：干净

## 下一阶段（phase-01 主菜单清理）

开始前必须：

1. 读 `PROJECT_SPEC.md` §6 的删除清单，冻结"主菜单指定文字"的具体条目。
2. 从 `develop` 创建 `phase/01-menu-cleanup`。
3. 先列出涉及文件：`screens.js`（TitleScreen）、`news.js`、`skins.js`、`checkin.js`、`social.js`、`account.js` 的入口注入点。
4. 每次删除后按 `testing/regression-checklist.md` 回归。

## 未决问题

- GitHub 首次推送策略：远程只有 1 个 README 提交，与本地历史无关；需用户决定（合并无关历史 / 新分支 / 其他），且认证未完成。
- 音效包是否补入（`sounds/sfx`）。
- 手机性能与兼容性尚未测量。

## 交接方式

新会话以本文件 + `STATUS.md` + 实际 `git log` 为准；不要重复输出完整功能分析。
