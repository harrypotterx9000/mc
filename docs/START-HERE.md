# OpusMC — 从这里开始（新会话入口）

> 这是给下一次 DeepSeek Harness 会话的**第一份必读文件**。读完本页即可接管项目。
> 最后更新：2026-11-12（phase-02 已完成、已验收、已提交；等待 phase-03 指令）

## 1. 三十秒摘要

- 项目：把 B 站 Toy 版浏览器体素游戏 OpusMC 改造成**独立运行、无账号访客、自建服务器**的版本。
- 现状：**phase-00 完成；phase-01 完成并验收；phase-02 完成、验收并提交；phase-03 未开始。**
- 代码：会话工作区 `D:\ds\REA\opusmc`；phase-01 代码 `15154bd`；phase-02 代码 `a9dc47b`；docs 收尾为当前 HEAD。
- 工作区：**干净**；代码与文档已提交；无 stash、无未跟踪文件。
- 分支：按用户指令**未创建/切换/重置 `phase/*` 分支**；phase-01/02 都在 `develop`。
- 远程：`https://github.com/harrypotterx9000/mc`；PR #1 仍打开，未推送/未合并。

> **路径注意**：phase-01 文档写的是 `D:\Projects\OpusMC`；phase-02 的提交只在 `D:\ds\REA\opusmc`。
> `D:\Projects\OpusMC` **没有** phase-02 改动；如以那份为准，需要用户确认后单独同步。

## 2. 阅读顺序

1. `docs/START-HERE.md`（本文件）
2. `docs/PROJECT_SPEC.md` —— 长期总规范（§6 全开放；§11.7 phase-02 约束）
3. `docs/STATUS.md` —— 当前阶段、Git、测试与待办
4. `docs/ARCHITECTURE.md` —— 分层、补丁矩阵、§11 phase-02 变更
5. `docs/DECISIONS.md` —— ADR-001…014（ADR-014 为 phase-02）
6. `docs/KNOWN_ISSUES.md` —— K-01…K-41、NOT TESTED
7. `docs/phases/phase-02-unlock-removal/HANDOFF.md` —— 本阶段交接
8. `docs/phases/phase-02-unlock-removal/TEST_REPORT.md` —— 测试结果
9. `docs/phases/phase-02-unlock-removal/ACCEPTANCE.md` —— 独立验收报告
10. `docs/phases/phase-01-menu-cleanup/HANDOFF.md` —— 上一阶段历史

## 3. Git 现实（以实际仓库为准）

| 项 | 值 |
|---|---|
| 仓库 | `D:\ds\REA\opusmc`（会话工作区） |
| 当前分支 | `develop`（跟踪 `origin/opusmc-integration`，ahead 9） |
| HEAD | phase-02 docs 收尾（见 `git log -1`；代码提交 `a9dc47b`） |
| 代码基线 | `2798c08`（`v0.1.0-integration`） |
| phase-01 代码 | `15154bd` |
| phase-02 | **已提交 `a9dc47b`**（docs 收尾为 HEAD） |
| 标签 | `v0.1.1-context`、`v0.1.0-integration`、`v0.1.0-preproject`、`v0.0.0-original` |
| 远程 | PR #1 未合并；`origin/main=6c476c0`；未推送 |

## 4. 运行方式

```powershell
cd D:\ds\REA\opusmc
node scripts\serve.mjs      # 仅 127.0.0.1:8080，零依赖
# Edge 打开 http://127.0.0.1:8080/
```

- 直接双击 `index.html`（file://）不可用：浏览器禁止 Worker，地形会卡死。
- 端口占用：`$env:PORT=8081; node scripts\serve.mjs`。
- 仓库里没有 `启动游戏.bat`；`game.js` 的提示是旧文案，阶段 5/8 再补或改。

## 5. 当前边界（务必遵守）

- 不擅自开始 phase-03 或任何游戏功能改造；每个阶段必须等用户明确指令。
- **未验收的改动不保留**：phase-02 已验收并提交 `a9dc47b`；后续未验收改动仍按 ADR-009/§11.3 丢弃。
- 不新增强制账号/登录；不引入永久账号体系。
- 合并、推送、历史重写都必须用户确认；禁止 force push。
- 没有实测的功能一律标 **NOT TESTED**；推断不得写成事实。

## 6. phase-02 已完成内容（已验收并提交）

1. 全部 18 款预设皮肤、正版玩家皮肤输入、23 款披风、3 顶帽子、1 个宠物、1 个名字前缀直接可用。
2. 披风包括 7 款普通 + 13 款管理员（`adm*` / 王冠）+ 3 款活动（企鹅/摇摆企鹅/金苹果）；**不再有解锁判定**。
3. `Capes.unlocked()`、`Cosmetics.owned()/has()`、`Skins.lookOf()`、衣柜保存等真实权限判断已改；不是只隐藏锁定图标。
4. 无账号也可保存外观（`mcjs-look`），刷新恢复；登录后接管一次账号外观并继续同步账号。
5. 多人入口未登录直接打开；不要求登录/关注/三连/识别码；邀请码控制保留。
6. 账号模块保留到 phase-03；`Account.checkUnlocks()` 不再被调用，账号界面不再显示三连/关注状态。

## 7. 测试结果（phase-02）

- 92 个 `js/*.js` 全量 `node --check` 通过；`index.html` 仍 88 个脚本；`git diff --check` 通过。
- 无头 Edge 157 + SwiftShader：自动回归 **27/27 PASS**，独立验收 **35 项运行时检查 PASS**；`game.errLog` 结束为空；无 JS 异常。
- 18 皮肤 / 23 披风 / 3 帽子 / 1 宠物 / 1 前缀全部可点、可预览；全部披风纹理构建并逐一应用到玩家。
- 游客保存 → 刷新恢复；模拟账号接管；正版皮肤无账号读取（mock `/api/skin`）。
- 未登录多人界面直接打开；空邀请码拒绝、有效邀请码才 `joinRoom`。
- 末影龙通关结局补测 **8/8 PASS**：进入末地 → 击杀 → 返回传送门 → `CreditsScreen`（4510 行）→ Esc 回主世界。发现 `renderDist=4` 下返回传送门不生成（K-41，未修复）。
- 独立验收：35 项运行时检查 PASS；真实联机/真实账号依赖 BLOCKED；详细见 `docs/phases/phase-02-unlock-removal/ACCEPTANCE.md`。
- 截图/结果：`D:\ds\REA\_work\phase02-*`；详细：`docs/phases/phase-02-unlock-removal/TEST_REPORT.md`。

## 8. 目录与证据

```
D:\ds\REA\opusmc\
  index.html        游戏页面（88 个脚本）
  js\               92 个 .js + emoji.webp
  sounds\sfx\       4,849 个原版音效（43.2 MB）
  scripts\serve.mjs 本地静态服务器
  docs\             项目文档与阶段记录
  server\           自建服务器（仅 .gitkeep，phase-05）
```

- 原始源码备份：`D:\ds\REA\_backup\opusmc-original-2026-11-06.zip`（如仍存在）
- phase-02 截图/结果：`D:\ds\REA\_work\phase02-*.png`、`phase02-test-result.json`
- 测试脚本：`D:\ds\REA\_work\phase02-test.mjs`（在仓库外，不随项目提交）
- 历史分析报告：`docs/research/*.md`

## 9. 已知噪音（不是新 bug）

- 控制台会有 `missing tile i_waxed_*_copper_door` / `missing tile all` 警告（原版存在）。
- 房间服务 `xz.honghemc.cn:8443` 在本机返回 403/CORS；多人界面公开房间列表显示红色“不允许从这个网页访问”（原服务；phase-05 自建）。
- `favicon.ico` 404。
- SwiftShader 下画质基准会报 `GPU stall due to ReadPixels`。
- 无头 SwiftShader 世界加载偶发 `chunk stall`（watchdog 重新请求）；世界最终会进入 `play`。

## 10. 下一步

phase-02 已结束实现、测试、验收并提交 `a9dc47b`。下一步：

1. 等待用户明确发送“执行阶段 3”，不得提前修改账号/登录/签到/Toy。
2. 如用户要求，另行确认并同步 `D:\Projects\OpusMC`（不要覆盖未确认的副本）。
3. 合并/推送/PR 操作仍需用户确认；禁止强推。
