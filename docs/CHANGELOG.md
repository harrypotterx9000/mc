# 变更记录（CHANGELOG）

格式：`阶段 — 日期 — 提交 — 内容`。只记录进入仓库的变更。

## phase-00 复核与交接 — 2026-11-06 — docs 提交（仅文档）

> 代码未变：`js/`、`index.html`、`scripts/`、`sounds/` 均未修改。
> 本节记录的是阶段 0 收尾文档；已随本次 docs 提交进入仓库，提交信息：`docs: close phase-00 review and record phase-01 decisions`。哈希见 `git log -1`。

- 新增文件：**无**
- 删除文件：**无**
- 修改文件：
  - `docs/STATUS.md`：更新当前阶段、HEAD `e49a54c`、代码基线 `2798c08`、未完成阶段与整体状态
  - `docs/ARCHITECTURE.md`：更正 `Game.prototype` 统计口径；新增 §9 阶段 0 复核补充（联机本质、无头边界、依赖陷阱、菜单归属）
  - `docs/KNOWN_ISSUES.md`：新增阶段 0 发现的待解决项、未测试项、服务端/环境依赖与兼容性风险
  - `docs/phases/phase-00-initialization/HANDOFF.md`：重写为当前交接（目标、完成情况、决策、测试、下一阶段前置）
  - `docs/START-HERE.md`：同步基线、阶段状态、阶段 1 决策与入口
  - `docs/DECISIONS.md`：新增 ADR-011（阶段 0 复核结论与阶段 1 边界）
  - `docs/CHANGELOG.md`：本节
- 关键函数/状态变化：**无**（没有改任何游戏源码）
- 修改原因：阶段 0 结束，为下一次会话建立可靠上下文；记录已确认的 10 项决策与 1-A 边界
- 验证：
  - `GET /` 200，16,469 B；`GET /js/game.js` 200，186,140 B
  - 无头 Edge 156 + SwiftShader：`game.state='title'`，WebGL2，0 游戏错误
  - 无头创建世界：`play`，62 区块，4,783 ms，IndexedDB，`probe-world`，0 错误
  - Node v26.13.0：核心世界生成加载成功，生成 98,304 方块区块（183 ms）
- 未验证：真实 GPU/真机性能、手机/iOS、多人服务器、HTTPS/WSS、备份恢复

## phase-00 初始化 — 2026-11-06

- `6090828` 导入原始 OpusMC 源码（构建 `47455601425408-v39426`）
  - `index.html` + 90 个 `js/*.js`，按字节导入；标签 `v0.0.0-original`
- `6f4472c` 独立运行准备
  - 删除 `index.html` 中唯一一行 B 站 Toy 重定向脚本
  - 新增 `scripts/serve.mjs`（零依赖、仅 127.0.0.1）、`README.md`、`.gitignore`
- `ee74cc2` 按字节保存
  - 新增 `.gitattributes`（`* -text`），`core.autocrlf=false`
- 文档基线（本提交）
  - `docs/PROJECT_SPEC.md`、`ARCHITECTURE.md`、`DECISIONS.md`、`STATUS.md`、`CHANGELOG.md`、`KNOWN_ISSUES.md`
  - `docs/research/*`、`docs/testing/*`、`docs/phases/phase-00-initialization/*`
  - 标签 `v0.1.0-preproject`

### phase-00 补充（同日）

- `feat(assets)` 补入原版音效包：`js/sound_events.js`（617,453 B）+ `sounds/sfx/**/*.m4a`
  （4,849 个文件，43,169,776 B），下载 0 失败；KNOWN_ISSUES K-01 关闭
- `docs` 同步更新 STATUS / KNOWN_ISSUES / ARCHITECTURE / README
- `docs: record sound pack commit, tags and remote state`（`791d16b`）
- **首次远程推送**：`main → origin/opusmc-init`（`791d16b`），远程 `main` 未变（仍为 `6c476c0`）
  - PR 入口：<https://github.com/harrypotterx9000/mc/pull/new/opusmc-init>

> 说明：本阶段没有修改任何游戏逻辑；唯一源码改动是上述 1 行重定向删除。


### 文档上下文交接（2026-11-06）

- 新增 `docs/START-HERE.md`：下一次会话的入口与规则
- 更新 `docs/STATUS.md`、`docs/PROJECT_SPEC.md`（v1.1，新增 §12 基线与上下文交接）、
  `docs/DECISIONS.md`（ADR-009/010）、`docs/phases/phase-00-initialization/HANDOFF.md`
- 标签 `v0.1.0-integration` 指向 `2798c08`（PR #1 内容基线）
- **丢弃**未验收的 phase-01 改动（3 个文件，+3/−37 行）、stash、补丁、阶段分支与临时文档
- 无任何游戏代码改动；工作区干净
