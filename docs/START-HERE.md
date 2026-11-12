# OpusMC — 从这里开始（新会话入口）

> 这是给下一次 DeepSeek Harness 会话的**第一份必读文件**。读完本页即可接管项目。
> 最后更新：2026-11-12（phase-03 客户端改造完成、验收结束；代码 `025cba8` 与 docs 已提交并推送）

## 1. 三十秒摘要

- 项目：把 B 站 Toy 版浏览器体素游戏 OpusMC 改造成**独立运行、无账号访客、自建服务器**的版本。
- 现状：**phase-00 完成；phase-01 完成并验收；phase-02 完成、验收并提交；phase-03 客户端改造完成、验收结束（代码 `025cba8` 与 docs 已提交并推送；端到端 BLOCKED）；phase-04 未开始。**
- 代码：会话工作区 `D:\ds\REA\opusmc`；phase-01 代码 `15154bd`；phase-02 代码 `a9dc47b`；phase-03 代码 `025cba8`；docs 收尾为当前 HEAD。
- 工作区：**干净**；phase-03 代码与文档均已提交并推送。
- 分支：按用户指令**未创建/切换/重置 `phase/*` 分支**；phase-01/02/03 都在 `develop`。
- 远程：`https://github.com/harrypotterx9000/mc`；PR #1 仍打开，未推送/未合并。

> **路径注意**：`D:\Projects\OpusMC` 是 phase-01 的同内容副本；phase-02/03 只在 `D:\ds\REA\opusmc`。
> 如以 `D:\Projects\OpusMC` 为准，需要用户确认后单独同步，禁止直接覆盖。

## 2. 阅读顺序

1. `docs/START-HERE.md`（本文件）
2. `docs/PROJECT_SPEC.md` —— 长期总规范（§3 访客身份；§11.8 phase-03 约束）
3. `docs/STATUS.md` —— 当前阶段、Git、测试与待办
4. `docs/ARCHITECTURE.md` —— 分层、补丁矩阵、§12 phase-03 变更
5. `docs/DECISIONS.md` —— ADR-001…015（ADR-015 为 phase-03）
6. `docs/KNOWN_ISSUES.md` —— K-01…K-50、NOT TESTED
7. `docs/phases/phase-03-guest-mode/HANDOFF.md` —— 本阶段交接
8. `docs/phases/phase-03-guest-mode/ACCEPTANCE.md` —— 独立验收报告（68 PASS / 1 BLOCKED / 1 非阻断 UI FAIL）
9. `docs/phases/phase-03-guest-mode/TEST_REPORT.md` —— 实现阶段测试结果
10. `docs/phases/phase-03-guest-mode/PLAN.md` —— 实施计划
11. `docs/phases/phase-02-unlock-removal/HANDOFF.md` —— 上一阶段历史

## 3. Git 现实（以实际仓库为准）

| 项 | 值 |
|---|---|
| 仓库 | `D:\ds\REA\opusmc`（会话工作区） |
| 当前分支 | `develop`（跟踪 `origin/opusmc-integration`；与远程同步） |
| HEAD | docs 收尾为当前 HEAD（见 `git log -1`） |
| 代码基线 | `2798c08`（`v0.1.0-integration`） |
| phase-01 代码 | `15154bd` |
| phase-02 代码 | `a9dc47b` |
| phase-03 代码 | `025cba8` |
| 标签 | `v0.1.1-context`、`v0.1.0-integration`、`v0.1.0-preproject`、`v0.0.0-original` |
| 远程 | phase-03 代码与 docs 已推送 `origin/opusmc-integration`；PR #1 未合并；未强推 |

## 4. 运行方式

```powershell
cd D:\ds\REA\opusmc
node scripts\serve.mjs      # 仅 127.0.0.1:8080，零依赖
# Edge 打开 http://127.0.0.1:8080/
```

- 直接双击 `index.html`（file://）不可用：浏览器禁止 Worker，地形会卡死。
- 端口占用：`$env:PORT=8081; node scripts\serve.mjs`。
- 仓库里没有 `启动游戏.bat`；`game.js` 的提示是旧文案，阶段 5/8 再补或改。
- 无头测试：Edge 157 + `--headless=new --use-angle=swiftshader --remote-debugging-port=9445`；测试脚本在仓库外 `D:\ds\REA\_work\phase03-*.mjs`。

## 5. 当前边界（务必遵守）

- 不擅自开始 phase-04 或任何游戏功能改造；每个阶段必须等用户明确指令。
- **已提交/已推送的改动仍不得改写历史**：phase-03 代码 `025cba8` 已提交并推送；docs 收尾随后提交/推送；不重写、不强推。
- 不新增强制账号/登录；不引入永久账号体系。
- 合并、推送、历史重写都必须用户确认；禁止 force push。
- 没有实测的功能一律标 **NOT TESTED**；推断不得写成事实。

## 6. phase-03 已完成内容（客户端核心）

1. 删除 `js/account.js`、`js/toy.js`、`js/cloudsave.js`、`js/checkin.js`：账号、B站登录、识别码、关注/三连、账号资料/API/绑定、Toy 身份、账号云存档、签到、云端存档界面全部移除。
2. 新增 `js/guest.js` 的 `GuestSession`：昵称（`mcjs-guest-name`）、服务器临时 ID、房间 ID、连接状态、5 分钟 `sessionStorage` 重连提示；没有注册/登录/密码/邮箱/手机号/永久账号。
3. 服务器临时 ID 来自现有协议 `login.eid`；未连接时只暴露 `local_...` 占位并标记 `serverAssigned=false`；phase-05 自建服务器必须签发/校验自己的 ID。
4. 多人界面始终显示昵称输入；加入时传昵称 + 邀请码；`hello`/`host`/`join` 不再发送账号 token。
5. 外观继续全部开放（18 皮肤 / 23 披风 / 3 帽子 / 1 宠物 / 1 前缀）；只保存在本设备 `mcjs-look`；活动款披风与 8 个装饰保留。
6. 首启：画质 → 设备 → 差异说明 → 标题，不再出现登录；标题/选项/暂停无账号/登录/签到入口。
7. 单人继续 IndexedDB；多人存档留给 phase-05 服务器。

## 7. 测试结果（phase-03）

- 89 个 `js/*.js` 全量 `node --check` 通过；`index.html` 85 个脚本；`git diff --check` 通过。
- 无头 Edge 157 + SwiftShader：核心运行时 **33/33 PASS**；首启 **1/1 PASS**；0 FAIL；`game.errLog` 为空；0 未捕获异常。
- 无 `/api/account`、`/api/cloud`、`/api/event`、`/api/gate`、`/api/checkin`、`/api/news` 请求；无 Bilibili/bilitoy 请求。
- `Account`/`Toy`/`CloudSave`/`Checkin`/`LoginScreen`/`AccountScreen` 均 `undefined`。
- 昵称可中文并本地保存；加入参数正确；`GuestSession` 服务器 ID/短期重连信息/离房状态正确。
- 游客保存外观 → 刷新恢复；单人世界创建/保存 → 刷新恢复；活动款保留。
- 截图/结果：`D:\ds\REA\_work\phase03-*`；详细：`docs/phases/phase-03-guest-mode/TEST_REPORT.md`。
- 独立验收：**68 PASS / 0 FAIL / 1 BLOCKED**（旧房间服务 403、真实 P2P 客人、实际重连）；另 1 个非阻断 UI FAIL（F-1，同名昵称房间所有权）。详见 `docs/phases/phase-03-guest-mode/ACCEPTANCE.md`；**客户端核心 10/10 通过，端到端 phase-03 未宣称完成**。

## 8. 目录与证据

```
D:\ds\REA\opusmc\
  index.html        游戏页面（85 个脚本）
  js\               89 个 .js + emoji.webp
  sounds\sfx\       4,849 个原版音效（43.2 MB）
  scripts\serve.mjs 本地静态服务器
  docs\             项目文档与阶段记录
  server\           自建服务器（仅 .gitkeep，phase-05）
```

- 原始源码备份：`D:\ds\REA\_backup\opusmc-original-2026-11-06.zip`（如仍存在）
- phase-03 截图/结果：`D:\ds\REA\_work\phase03-*.png`、`phase03-test-result.json`、`phase03-onboard-result.json`
- 测试脚本：`D:\ds\REA\_work\phase03-test.mjs`、`phase03-onboard.mjs`（在仓库外，不随项目提交）
- 历史分析报告：`docs/research/*.md`

## 9. 已知噪音（不是新 bug）

- 控制台会有 `missing tile i_waxed_*_copper_door` / `missing tile all` 警告（原版存在）。
- 房间服务 `xz.honghemc.cn:8443` 在本机返回 403/CORS；多人界面公开房间列表显示红色“不允许从这个网页访问”（原服务；phase-05 自建）。
- `favicon.ico` 404。
- SwiftShader 下画质基准会报 `GPU stall due to ReadPixels`。
- 无头 SwiftShader 世界加载偶发 `chunk stall`（watchdog 重新请求）；世界最终会进入 `play`。

## 10. 下一步

1. **已完成**：phase-03 代码 `025cba8` 与 docs 均已提交并推送；工作区干净；不要重写历史。
2. 合并/PR 操作需用户另行确认；不要强推。
3. 如用户要求，另行确认并同步 `D:\Projects\OpusMC`（不要覆盖未确认的副本）。
4. phase-05 自建服务器必须处理：临时玩家 ID 签发/校验、真实短时重连、房间所有权（F-1）、`/api/skin`、管理员公告、旧 `mcjs-room-key`、服务端权威外观/移动/存档。
5. 合并/推送/PR 操作仍需用户确认；禁止强推。
6. 不提前开始 phase-04；等待用户明确指令。
