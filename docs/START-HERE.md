# OpusMC — 从这里开始（新会话入口）

> 这是给下一次 DeepSeek Harness 会话的**第一份必读文件**。读完本页即可接管项目。
> 最后更新：2026-11-12（phase-05 自建服务器已验收；代码 `817bad3`；docs 收尾为当前 HEAD）

## 1. 三十秒摘要

- 项目：把 B 站 Toy 版浏览器体素游戏 OpusMC 改造成**独立运行、无账号访客、自建服务器**的版本。
- 现状：phase-00/01/02/03/04 完成并验收；**phase-05 实现、测试与修复复核完成，已验收（2026-11-12）**；phase-06 起未开始。
- 代码：会话工作区 `D:\ds\REA\opusmc`；phase-05 代码 `817bad3`；docs 收尾为当前 HEAD（基线 `3b8b2e0`）。
- 工作区：**干净**；phase-05 代码已提交并推送；phase-04 代码 `553ceed` 已推送 `origin/opusmc-integration`，未合并。
- 分支：按用户指令**未创建/切换/重置 `phase/*` 分支**；全部阶段在 `develop`。
- 远程：`https://github.com/harrypotterx9000/mc`；phase-05 已推送 `origin/opusmc-integration`。

> **路径注意**：`D:\Projects\OpusMC` 是 phase-01 的同内容副本；phase-02/03/04/05 只在 `D:\ds\REA\opusmc`。
> 如以 `D:\Projects\OpusMC` 为准，需要用户确认后单独同步，禁止直接覆盖。

## 2. 阅读顺序

1. `docs/START-HERE.md`（本文件）
2. `docs/PROJECT_SPEC.md` —— 长期总规范（§11.11 phase-05 结果）
3. `docs/STATUS.md` —— 当前阶段、Git、测试与待办
4. `docs/ARCHITECTURE.md` —— 分层、补丁矩阵、§14 phase-05 服务端
5. `docs/DECISIONS.md` —— ADR-001…019（ADR-018/019 为 phase-05）
6. `docs/KNOWN_ISSUES.md` —— K-01…K-80、NOT TESTED
7. `docs/phases/phase-05-server/{TEST_REPORT,HANDOFF,PLAN}.md`
8. `docs/phases/phase-04-browser/ACCEPTANCE.md`/`HANDOFF.md` —— 上一阶段
9. `server/README.md` —— 服务器部署、配置、存档、备份、安全

## 3. Git 现实（以实际仓库为准）

| 项 | 值 |
|---|---|
| 仓库 | `D:\ds\REA\opusmc`（会话工作区） |
| 当前分支 | `develop`（跟踪 `origin/opusmc-integration`） |
| HEAD | phase-05 代码 `817bad3`；docs 收尾为当前 HEAD |
| 代码基线 | `2798c08`（`v0.1.0-integration`） |
| phase-01/02/03/04 代码 | `15154bd` / `a9dc47b` / `025cba8` / `553ceed` |
| phase-05 | **已验收（2026-11-12），代码 `817bad3`；docs 收尾为当前 HEAD** |
| 远程 | phase-05 已推送 `origin/opusmc-integration`；PR #1 未合并；未强推 |
| 标签 | `v0.1.1-context`、`v0.1.0-integration`、`v0.1.0-preproject`、`v0.0.0-original` |

## 4. 运行方式

### 4.1 多人 + 页面（自建服务器，推荐）

```powershell
cd D:\ds\REA\opusmc
.\start-server.bat
# 或 node server\index.mjs
# Chrome / Edge 打开 http://127.0.0.1:8080/
```

- 页面 → 多人游戏 → 自建服务器房间 → 创建房间或输入邀请码。
- 正常关闭：`.\stop-server.bat` 或服务器窗口 `Ctrl+C`。
- 状态：`http://127.0.0.1:8080/healthz` 或 `server\status.ps1`。
- 局域网：`server/config.json` 的 `host` 改 `0.0.0.0`，防火墙放行；本阶段不做公网/TLS。
- 电脑关机/休眠/注销时服务器停止；没有后台常驻。

### 4.2 单人静态页面

```powershell
node scripts\serve.mjs      # 默认 127.0.0.1:8080
```

- 只有静态页面，没有 WebSocket/房间；自建多人必须用 `server/index.mjs`。
- 直接双击 `index.html`（file://）**不可用**：页面会显示“请通过本地服务器打开”。

### 4.3 测试

- 服务端：`node D:\ds\REA\_work\phase05-server-test.mjs`（自起临时服务器）。
- 双浏览器 E2E：先启动一个 18080 测试服务器，再 `node D:\ds\REA\_work\phase05-browser-test.mjs`。
- 单人回归：`node D:\ds\REA\_work\phase05-sp-regression.mjs`。
- 测试脚本在仓库外 `D:\ds\REA\_work\`，不随项目提交；详见 `TEST_REPORT.md`。

## 5. 当前边界（务必遵守）

- phase-05 **已验收、代码已提交并推送 `817bad3`**；docs 收尾为当前 HEAD；合并/PR 仍需用户确认。
- 不擅自开始 phase-06 或任何游戏功能改造；每个阶段必须等用户明确指令。
- 已提交/已推送的历史不得改写；不 force push。
- 不新增强制账号/登录；不引入永久账号体系。
- 没有实测的功能一律标 **NOT TESTED**；推断不得写成事实。
- 服务器不同步生物/红石/流体/战斗；世界存档是 `seed + 方块覆盖层`；无 TLS/公网；真实 LAN 双设备、
  10 人压力、长时间运行未测。不得写成“完整服务端模拟/完整反作弊/公网可用”。
- K-39 `chunk stall` 留 phase-07；真实 Android/iOS 真机按 phase-04 用户决定未补测。

## 6. phase-05 已实现内容

1. `server/`：零依赖 Node 服务端；HTTP 静态白名单、`/ws`、房间/邀请码/临时 ID/令牌、20 TPS 世界时钟、
   方块覆盖层、方块实体、玩家/掉落物同步、服务端存档、备份、`/healthz`、管理接口、JSONL 日志、pid、
   正常关闭。
2. `js/mp.js`：`MPServer`/`MPClient` + 自建服务器界面（创建/加入/继续/房间）；`srv~` 世界；
   增量应用、玩家/物品镜像、聊天、时间、10 Hz state/10 s pstate、自动重连。
3. 接入：`index.html` 87 脚本；多人入口；暂停菜单“房间…”；`netconfig.js` `server:''`。
4. 启动/停止/状态：`start-server.bat`、`stop-server.bat`、`server/stop.ps1`、`server/status.ps1`、
   `server/config.json`、`server/README.md`。
5. 测试：服务端 62/62、双浏览器 18/18、单人 6/6；修复复核 F-A 1257/1257 + 19/19 + 3/3、F-B 7/7、
   F-C 18/18、F-D 35/35、F-E/F-F 6/6；91 JS + 9 server mjs `node --check`；
   启动/停止/状态/端口占用实测。

## 7. 测试结果（phase-05）

- 服务端集成：**62 PASS / 0 FAIL**（静态/安全、房间/身份、同步、权威、权限、断线恢复、协议异常、
  持久化/备份、管理/关闭、限流）。
- 双浏览器 E2E：**18 PASS / 0 FAIL**（Chrome 157 headless；创建/加入/互看/移动/方块/聊天/房间界面/
  重连/踢人/关房；无未捕获异常；B 一次已知 `chunk stall`）。
- 单人回归：**6 PASS / 0 FAIL**（87 脚本、世界创建、方块、IndexedDB 保存、刷新恢复、无错误）。
- 旧 `scripts/serve.mjs`：index/mp.js 200，`server/config.json` 403。
- 证据：`D:\ds\REA\_work\phase05-*`；详细：`docs/phases/phase-05-server/TEST_REPORT.md`。

## 8. 目录与证据

```
D:\ds\REA\opusmc\
  index.html        游戏页面（87 个脚本）
  js\               91 个 .js + emoji.webp（新增 mp.js）
  sounds\sfx\       4,849 个原版音效（43.2 MB）
  scripts\serve.mjs 单机静态服务器（无 WS）
  server\           自建服务器（9 个 .mjs + config.json + README.md + 2 个 ps1）
  start-server.bat  一键启动
  stop-server.bat   正常关闭
  docs\             项目文档与阶段记录
```

- phase-05 证据：`D:\ds\REA\_work\phase05-server-test.mjs`、`phase05-browser-test.mjs`、
  `phase05-sp-regression.mjs`、`phase05-*-result.json`、`phase05-*.png`、`phase05-test-*`。
- 原始源码备份：`D:\ds\REA\_backup\opusmc-original-2026-11-06.zip`（如仍存在）。
- 历史分析报告：`docs/research/*.md`。

## 9. 已知噪音（不是新 bug）

- 控制台会有 `missing tile i_waxed_*_copper_door` / `missing tile all` 警告（原版存在）。
- 旧房间服务 `xz.honghemc.cn:8443` 在本机返回 403/CORS；多人界面公开房间列表显示红色错误（旧遗留，
  K-02/K-40/K-77）；自建服务器入口不依赖它。
- 无头 SwiftShader 世界加载偶发 `chunk stall`（K-39/K-53）；世界最终进入 `play`。
- 无头 Chrome 不能锁定鼠标，会提示自由鼠标模式（既有行为）。
- `favicon.ico` 已由自有 `favicon.svg` 替代，不再 404。

## 10. 下一步

1. **phase-05 已提交并推送**：代码 `817bad3`；docs 收尾为当前 HEAD；远程 `origin/opusmc-integration`。
   F-A…F-F 修复记录在 `docs/phases/phase-05-server/ACCEPTANCE.md`。
2. 不自动进入 phase-06；下一阶段需用户明确指令。
3. phase-06 前置：单人 IndexedDB 与服务器 `srv~` 世界分开管理；不要把服务器世界写进单人存档。
4. 遗留：旧房间服务/`/api/skin`/管理员公告/旧 `mcjs-room-key`（K-36/K-44/K-45/K-63/K-77）；
   `NET_CONFIG.announce=false`。
5. K-39 留 phase-07；真实 LAN/公网/TLS 属 phase-08；真实设备发布前重新评估。
6. `D:\Projects\OpusMC` 未同步；如以那份为准，需要用户确认后单独同步。
