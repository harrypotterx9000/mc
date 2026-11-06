# OpusMC — 从这里开始（新会话入口）

> 这是给下一次 DeepSeek Harness 会话的**第一份必读文件**。读完本页即可接管项目。
> 最后更新：2026-11-06（phase-01 完成并验收通过）

## 1. 三十秒摘要

- 项目：把 B 站 Toy 版浏览器体素游戏 OpusMC 改造成**独立运行、无账号访客、自建服务器**的版本。
- 现状：**phase-00 完成；phase-01 完成并验收通过；phase-02 未开始。**
- 代码：`D:\Projects\OpusMC`；phase-01 代码提交 `15154bd`；当前 HEAD 为 phase-01 docs 收尾（哈希见 `git log -1`）；代码基线 `2798c08`。
- 工作区：干净；phase-01 代码与文档均已提交；未推送。
- 分支说明：按用户指令**未创建/切换 `phase/*` 分支**；phase-01 直接在 `develop` 提交。
- 远程：`https://github.com/harrypotterx9000/mc`；PR #1 仍打开，远程 `main` 未变。

## 2. 阅读顺序

1. `docs/START-HERE.md`（本文件）
2. `docs/PROJECT_SPEC.md` —— 长期总规范（§6 已加入首启两屏删除）
3. `docs/STATUS.md` —— 当前阶段、工作区、测试与待办
4. `docs/ARCHITECTURE.md` —— 分层、补丁矩阵、§10 phase-01 变更
5. `docs/DECISIONS.md` —— ADR-001…013
6. `docs/KNOWN_ISSUES.md` —— 已知问题、K-27…K-35、NOT TESTED
7. `docs/phases/phase-01-menu-cleanup/HANDOFF.md` —— 本阶段交接
8. `docs/phases/phase-01-menu-cleanup/TEST_REPORT.md` —— 测试结果

## 3. Git 现实（以实际仓库为准）

| 项 | 值 |
|---|---|
| 仓库 | `D:\Projects\OpusMC` |
| 当前分支 | `develop`（跟踪 `origin/opusmc-integration`，ahead 4） |
| HEAD | phase-01 docs 收尾提交（哈希见 `git log -1`；父提交 `15154bd`） |
| 代码基线 | `2798c08`（`v0.1.0-integration`） |
| 标签 | `v0.1.1-context`、`v0.1.0-integration`、`v0.1.0-preproject`、`v0.0.0-original` |
| 远程 | PR #1 未合并；`origin/main=6c476c0`；未推送 |
| 工作区 | 干净；无 stash、无未跟踪文件 |

> phase-01 已验收并提交；推送远程、合并到 `main` 仍须用户确认。

## 4. 运行方式

```powershell
cd D:\Projects\OpusMC
node scripts\serve.mjs      # 仅 127.0.0.1:8080，零依赖
# Edge 打开 http://127.0.0.1:8080/
```

- 直接双击 `index.html`（file://）不可用：浏览器禁止 Worker，地形会卡死。
- 端口占用：`$env:PORT=8081; node scripts\serve.mjs`。
- 仓库里没有 `启动游戏.bat`；`game.js:607` 的提示是旧文案，阶段 5/8 再补或改。

## 5. 当前边界（务必遵守）

- 不擅自开始 phase-02 或任何游戏功能改造；每个阶段必须等用户明确指令。
- **未验收的改动不保留**：phase-01 已验收并提交；后续阶段仍未验收。
- 不新增强制账号/登录；不引入永久账号体系。
- 合并、推送、历史重写都必须用户确认；禁止 force push。
- 没有实测的功能一律标 **NOT TESTED**；推断不得写成事实。

## 6. phase-01 已完成内容

1. 删除「欢迎来到 OpusMC」协议窗口与「你是哪种玩家？」选择界面。
2. 删除主菜单公告面板与 `js/news.js`。
3. 删除「解锁披风和联机」面板；`onlineGate()` 直接放行（1-A）。
4. 删除选项「遥测数据」「制作人员名单与致谢」「用户协议和隐私说明」，并整体移除遥测模块（`js/telemetry.js`）。
5. 删除标题登录/解锁/反馈入口与 B 站/Toy/非官方文案；删除启动页脚与 Toy 性能脚本。
6. 删除反馈面板、提交/截图逻辑与三处入口；举报保留。
7. 全量语法与无头浏览器回归通过；`game.errLog` 为空。

独立验收：**35 项 PASS，1 项 NOT TESTED，0 项 FAIL**；NOT TESTED 为末影龙通关实际触发结局。

## 7. 阶段 1 的关键技术点

- 首启链：标题世界就绪（最多 8 s）→ 画质设置 → 设备 → 登录 → “这个版本有什么不一样” → 标题。
- 新世界默认关教程（`meta.tutorial ?? -1`）；旧存档保留。
- 删除 `playerKind` 后，小地图/死亡点默认只在显式开启时显示。
- `Telemetry` 已整体移除；`GAME_BUILD` 移到 `js/game.js`。
- 未解锁非活动款披风/正版皮肤在 phase-02 前没有解锁路径。
- 删除 `news.js` 与 `telemetry.js` 后 `js/` 为 92 个 `.js`，`index.html` 加载 88 个脚本。

## 8. 目录与证据

```
D:\Projects\OpusMC\
  index.html        游戏页面（88 个脚本）
  js\               92 个 .js + emoji.webp
  sounds\sfx\       4,849 个原版音效（43.2 MB）
  scripts\serve.mjs 本地静态服务器
  docs\             项目文档与阶段记录
  server\           自建服务器（后续阶段）
```

- 原始源码备份：`D:\ds\REA\_backup\opusmc-original-2026-11-06.zip` + `.sha256.txt`
- 原始工作区：`D:\ds\REA\opusmc`（未改动）
- 阶段 1 截图/结果：`D:\ds\REA\_work\phase01-*.png`、`phase01-test-result.json`
- 历史分析报告：`D:\ds\REA\opusmc\OpusMC-功能全景-证据.md`、`OpusMC-深入验证-运行时.md`

## 9. 已知噪音（不是新 bug）

- 控制台会有 `missing tile i_waxed_*_copper_door` / `missing tile all` 警告（原版存在）。
- 房间服务 `xz.honghemc.cn:8443` 的请求可能 403/CORS（原作者服务；账号/签到仍在用）。
- `favicon.ico` 404。
- SwiftShader 下画质基准会有 `GPU stall due to ReadPixels` 性能警告。

## 10. 下一步

phase-01 已结束；**等待用户明确指令后才开始 phase-02**。

phase-02 的前置条件与检查清单见 `docs/phases/phase-01-menu-cleanup/HANDOFF.md` 第 7/8 节；不得提前修改皮肤/披风/装饰的开放逻辑。
