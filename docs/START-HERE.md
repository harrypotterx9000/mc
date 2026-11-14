# OpusMC — 从这里开始（新会话入口）

> 这是给下一次 DeepSeek Harness 会话的**第一份必读文件**。读完本页即可接管项目。
> 最后更新：2026-11-14（phase-08 验收结束；代码 `ef8c540`；已推送 `origin/opusmc-integration`；phase-08 内容 tip `597a15f`）

## 1. 三十秒摘要

- 项目：把 B 站 Toy 版浏览器体素游戏 OpusMC 改造成**独立运行、无账号访客、自建服务器**的版本。
- 现状：phase-00…07 完成并验收；**phase-08 网络部署验收结束（真实设备用户实测）；代码 `ef8c540`；已推送 `origin/opusmc-integration`**。
- 代码：会话工作区 `D:\ds\REA\opusmc`；phase-08 代码 `ef8c540`；docs `d8b237a`/`597a15f`；
  phase-07 代码 `508fcc8`、docs `a2bdb0e` 已推送。
- 工作区：phase-08 代码/文档已提交并推送；工作区干净（除 1 个与本阶段无关的未跟踪文件 `REAopusmc<U+F022>`，
  4,988 B，误重定向输出）；无 stash、无临时分支。
- 分支：按用户指令**未创建/切换/重置 `phase/*` 分支**；全部阶段在 `develop`。
- 远程：`https://github.com/harrypotterx9000/mc`；phase-05/07/08 已推送；phase-06 未推送；
  PR #1 未合并。

> **路径注意**：`D:\Projects\OpusMC` 是 phase-01 的同内容副本；
> phase-02/03/04/05/06/07/08 只在 `D:\ds\REA\opusmc`。
> 如以 `D:\Projects\OpusMC` 为准，需要用户确认后单独同步，禁止直接覆盖。

## 2. 阅读顺序

1. `docs/START-HERE.md`（本文件）
2. `docs/PROJECT_SPEC.md` —— 长期总规范（§11.12 phase-06、§11.13 phase-07、§11.14 phase-08）
3. `docs/STATUS.md` —— 当前阶段、Git、测试与待办
4. `docs/ARCHITECTURE.md` —— 分层、补丁矩阵、§15 phase-06、§16 phase-07、§17 phase-08
5. `docs/DECISIONS.md` —— ADR-001…022（ADR-021 phase-07，ADR-022 phase-08）
6. `docs/KNOWN_ISSUES.md` —— K-01…K-100、NOT TESTED
7. `docs/phases/phase-08-deployment/{TEST_REPORT,HANDOFF,PLAN}.md` —— 当前阶段
8. `docs/deployment/{LAN,REMOTE}.md` —— 用户部署说明
9. `docs/phases/phase-07-performance/{TEST_REPORT,HANDOFF,PLAN}.md` —— 上一阶段
10. `server/README.md` —— 服务器配置、存档、备份、安全、性能状态、部署入口

## 3. Git 现实（以实际仓库为准）

| 项 | 值 |
|---|---|
| 仓库 | `D:\ds\REA\opusmc`（会话工作区） |
| 当前分支 | `develop`（跟踪 `origin/opusmc-integration`） |
| HEAD | 推送记录为当前 HEAD；phase-08 内容 tip `597a15f`；代码 `ef8c540` |
| 代码基线 | `2798c08`（`v0.1.0-integration`） |
| phase-01/02/03/04 代码 | `15154bd` / `a9dc47b` / `025cba8` / `553ceed` |
| phase-05 | **已验收（2026-11-12），代码 `817bad3`** |
| phase-06 | **已验收（2026-11-12），代码 `b4833b8`；未推送** |
| phase-07 | **验收结束（2026-11-13）；代码 `508fcc8`；docs `a2bdb0e`；已推送** |
| phase-08 | **验收结束（真实设备用户实测）；代码 `ef8c540`；docs `d8b237a`/`597a15f`；已推送** |
| 远程 | phase-05/07/08 已推送 `origin/opusmc-integration`；phase-06 未推送；PR #1 未合并；未强推 |
| 标签 | `v0.1.1-context`、`v0.1.0-integration`、`v0.1.0-preproject`、`v0.0.0-original` |

## 4. 运行方式

### 4.1 多人 + 页面（自建服务器，推荐）

```powershell
cd D:\ds\REA\opusmc
.\start-server.bat        # 只绑定 127.0.0.1（本机）
# 或 .\start-lan.bat      # 绑定 0.0.0.0，打印局域网地址
# 或 node server\index.mjs --lan
```

- 本机：Chrome / Edge 打开 `http://127.0.0.1:8080/`。
- 局域网：所有设备（包括电脑）打开打印的 **`游戏地址（局域网）`**；`127.0.0.1` 仅本机；
  手机/电脑同一 Wi-Fi；防火墙放行专用网络。完整说明 `docs/deployment/LAN.md`。
- 公网：**Cloudflare Tunnel 是本阶段正式支持/验收的公网路径**；`docs/deployment/REMOTE.md`。
  Caddy + 公网 IPv4/域名是备用模板，未运行验证，不属于正式验收路径；本阶段未配置端口转发。
- 页面 → 多人游戏 → 自建服务器房间 → 创建房间或输入邀请码。
- 正常关闭：`.\stop-server.bat` 或服务器窗口 `Ctrl+C`。
- 状态：`http://127.0.0.1:8080/healthz` 或 `server\status.ps1`。
- 电脑关机/休眠/注销时服务器停止；没有后台常驻。

### 4.2 单人静态页面

```powershell
node scripts\serve.mjs      # 默认 127.0.0.1:8080
```

- 只有静态页面，没有 WebSocket/房间；自建多人必须用 `server/index.mjs`。
- 直接双击 `index.html`（file://）**不可用**：页面会显示“请通过本地服务器打开”。

### 4.3 测试

- phase-06 服务端双存档：`node D:\ds\REA\_work\phase06-server-test.mjs`（自起临时服务器）。
- phase-06 浏览器双存档：`node D:\ds\REA\_work\phase06-browser-test.mjs`（使用 18085 临时服务器与旧存档 profile）。
- phase-07 固定场景：`node D:\ds\REA\_work\perf-scenes.mjs <baseline|after> <root>`（固定 profile/世界）。
- phase-07 手机视口模拟：`node D:\ds\REA\_work\perf-mobile.mjs <baseline|after> <root>`（不是真机）。
- phase-07 编辑卡顿：`node D:\ds\REA\_work\perf-edit.mjs <baseline|after> <root>`。
- phase-07 K-39：`node D:\ds\REA\_work\k39-check.mjs <baseline|after> <root>`（SwiftShader + CPU 8×）。
- phase-07 服务器负载：`node D:\ds\REA\_work\phase07-server-perf.mjs`（自起临时服务器）。
- phase-07 长跑：`node D:\ds\REA\_work\perf-long.mjs 8`（固定 profile）。
- phase-08 LAN/公网协议：`node D:\ds\REA\_work\phase08-net-test.mjs <base-url> [admin-token] [loopback-url]`。
- phase-08 浏览器：`$env:PHASE08_BASE='<base-url>/'; node D:\ds\REA\_work\phase08-browser-test.mjs <lan|public>`。
- phase-08 邀请链接一致性：`$env:PHASE08_BASE='<lan-url>/'; node D:\ds\REA\_work\phase08-fix-invite-test.mjs`。
- phase-08 公网隧道：`_work\bin\cloudflared.exe tunnel --url http://127.0.0.1:8080`（临时地址）。
- phase-05 服务端回归：`node D:\ds\REA\_work\phase05-server-test.mjs`。
- phase-05 双浏览器 E2E：先启动一个 18080 测试服务器，再 `node D:\ds\REA\_work\phase05-browser-test.mjs`。
- phase-05 单人回归：先起 18080 静态服务器，再 `node D:\ds\REA\_work\phase05-sp-regression.mjs`。
- 测试脚本在仓库外 `D:\ds\REA\_work\`，不随项目提交；详见 phase-05/06/07/08 的 `TEST_REPORT.md`。

## 5. 当前边界（务必遵守）

- phase-05 **已验收、代码已提交并推送 `817bad3`**；phase-06 **已验收（2026-11-12）、代码 `b4833b8`、未推送**；
  phase-07 **验收结束（2026-11-13）；代码 `508fcc8`、docs `a2bdb0e`、已推送**；
  phase-08 **验收结束（真实设备用户实测）；代码 `ef8c540`；docs `d8b237a`/`597a15f`；已推送**。
- 不自动进入 phase-09；已提交/已推送的历史不得改写；不 force push。
- 不新增强制账号/登录；不引入永久账号体系。
- 没有实测的功能一律标 **NOT TESTED**；推断不得写成事实。
- 服务器不同步生物/红石/流体/战斗；世界存档是 `seed + 方块覆盖层`；真实 10 人客户端、长时间运行未测。
  不得写成“完整服务端模拟/完整反作弊/公网长期可用”。
- **phase-08 部署边界**：LAN 已实测（主地址为 LAN、127 仅本机、邀请链接一致性 8/8、双 Chrome profile），
  **真实手机 LAN 已由用户实测通过**（单人/移动/视角/放置/破坏/刷新；服务器日志有 LAN 客户端加入）；
  Cloudflare Tunnel HTTPS/WSS 已实测，**真实手机蜂窝公网已由用户实测通过**（HTTPS/进入世界/渲染/移动/
  视角/放置/破坏/刷新；日志有蜂窝 IPv6 客户端加入）；**Caddy + 公网 IPv4/域名/端口转发未配置、未测；
  Caddy 仅备用模板，不属于正式验收路径**；quick tunnel 是临时地址；Windows 防火墙脚本实际添加/删除未测。
  用户未提供手机型号/OS/浏览器/截图/录屏，不得写成性能或所有设备已验证；不得写成“Caddy 公网已通过”。
- 用户澄清“PIN 验证”是 Cloudflare quick tunnel 临时地址的**邮箱验证**（Cloudflare/外部流程），
  OpusMC 没有 PIN/邮箱验证功能（K-100）。
- 双存档：单人 `mc-js-clone`、服务器 `srv~`；不要互相写入；旧云存档只保留不迁移、不删除。
- K-39 已在 phase-07 修复（验收结束）；真实 Android/iOS 真机按 phase-04 用户决定未补测。
- 性能数字必须带环境：headless 真实 GPU、SwiftShader、手机视口模拟不能混写为真机达标。

## 6. phase-05 / phase-06 / phase-07 / phase-08 已实现内容

### phase-08（验收结束；代码 `ef8c540`；已推送）

1. **LAN**：`--lan` / `start-lan.bat` 绑定 `0.0.0.0`；主地址优先选择有效私有 IPv4，
   `127.0.0.1` 单独标为“仅本机访问”；邀请链接专项 8/8（多次建房、刷新/恢复、多邀请码）；
   防火墙脚本 `deploy/windows/firewall-lan.ps1`（默认仅专用网络）。
2. **代理感知身份**：`server/netutil.mjs`；只有直连回环才信转发头；管理接口“直连+转发都回环”；
   WS 限流/日志按真实客户端 IP；LAN 伪造 XFF 无效。
3. **HTTPS/WSS**：**Cloudflare Tunnel 是本阶段正式支持/验收的公网路径**（quick/命名已实测）；
   `deploy/Caddyfile` 是备用模板，未运行验证，不属于正式验收路径；
   `docs/deployment/REMOTE.md` 说明验收范围、NAT/CGNAT、端口转发、安全、排查。
4. **边界**：公网管理接口（含正确令牌）403；`server/data`/`docs`/`scripts`/`.git` 404；
   本阶段未配置路由器端口转发；Caddy 公网入站未运行验证。
5. **真实设备（用户报告 2026-11-14）**：手机 LAN 单人/移动/视角/放置/破坏/刷新通过；
   手机蜂窝关闭 Wi-Fi 经 Cloudflare HTTPS 进入世界/渲染/移动/视角/放置/破坏/刷新通过；
   服务器日志分别有 LAN 私有地址客户端与蜂窝 IPv6 客户端加入。用户未提供型号/OS/浏览器/截图；
   “PIN/邮箱验证”是 Cloudflare 临时地址外部流程，不是应用功能（K-100）。

### phase-07（验收结束；代码 `508fcc8`；docs `a2bdb0e`；已推送）

1. **测试基线**：固定 profile/世界/相机；桌面 headless Chrome 157 + 真实 ANGLE/AMD 核显；场景覆盖主菜单、
   普通地形、大型建筑、240 实体、战斗、光影 1–4、SwiftShader 限速 K-39、手机视口模拟、服务器机器人、长跑。
2. **电脑**：首轮固定场景 60 FPS（maxFps=60；重复测试光影 3/4 为 59.8/57.1，K-93）；编辑 `flushMesh` 分帧；
   视频设置“测试性能并推荐画质…”；每世界一次实测建议（不自动改）。
3. **手机**：区块预算 8 ms、动态分辨率下限 0.4/首次降 20%、实体/阴影/粒子预算、4 MB 顶点页；
   3120×1440 模拟 30 s 稳定 60 FPS（基线 44.8）。
4. **画质**：低/中/高/极高/自定义；低档关光影；推荐依据实测帧时间/GPU 完成时间，并尊重玩家 `maxFps`。
5. **服务器**：修复 Windows 定时器导致的 16.1 TPS；2/5/10/30 连接 19.97–20.00 TPS；管理 `perf` 指标；
   广播一次编码多连接复用。
6. **K-39**：watchdog 有进展/存档读取/管线忙时等待；SwiftShader + 8× CPU 限速 0 次/约 9 s。
7. **验收修复**：动态分辨率 90/30 Hz 与无限制目标、粒子满额判空、画质建议 `maxFps`；详见
   `docs/phases/phase-07-performance/TEST_REPORT.md` §12。

### phase-05（已验收）

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

### phase-06（已验收；代码 `b4833b8`；docs 收尾为当前 HEAD）

1. **本地存档**：`mc-js-clone` 结构不变；`DB.newWorldId` 唯一 ID；创建/加载/保存/删除/列表/刷新恢复；
   同名世界不覆盖；旧 `gen=1/2` 世界可读可保存。
2. **服务器存档**：每房 `world.json`；定时/关闭/异常保存；备份；`world.json` 语法或结构损坏回退备份并写回；
   `dir` 与目录名不一致拒绝跨房；`SIGKILL` 后恢复最近定时存档。
3. **冲突隔离**：`srv~` 不进 IndexedDB（`mp.js` + `save.js` 双层）；服务器世界不进单人列表；
   断线/刷新/离开不删除服务器世界；同名不覆盖。
4. **旧存档保护**：修改前真实样本（两个同名世界、旧 cloud 字段、旧键）在修改后复验；旧云存档残留
   不迁移、不删除。
5. **测试**：服务端双存档 22/22、浏览器双存档 31/31、旧存档样本复验、phase-05 回归 62/62 + 18/18 + 6/6。

## 7. 测试结果

### phase-08

- LAN 启动输出：主地址 `http://192.168.1.18:18110/`，`127.0.0.1` 单独标为“仅本机访问”；
  默认本机模式仍只显示 `127.0.0.1`。
- LAN 邀请链接一致性 8/8：多次建房、刷新/恢复、多个邀请码均为 LAN 地址。
- LAN 协议 22/22：LAN 地址 HTTP/WS、建房/加入、同 seed、方块双向广播、管理接口 403、静态边界 404。
- LAN 浏览器 15/15：两个独立 Chrome profile 从 LAN 地址进入同一房间；同 seed、玩家/位置/方块/聊天同步。
- 公网 Cloudflare Tunnel：HTTPS/WSS 协议 22/22、浏览器 15/15（`wss://`、无 mixed-content；
  前两次 quick tunnel 资产流超时，第三次通过）；公网管理接口无令牌/带令牌均 403；`server/data` 等 404。
- check-host.net：修复后 5/6 外部节点 200（1 个超时）。
- **真实手机 LAN（用户报告 2026-11-14）**：单人、移动、转视角、放置、破坏、刷新重进 PASS；
  服务器日志显示 LAN 私有地址客户端加入房间 E7UDCMQT。
- **真实手机蜂窝公网（用户报告 2026-11-14）**：关闭 Wi-Fi 经 Cloudflare HTTPS 进入世界、渲染、移动、
  转视角、放置、破坏、刷新重进 PASS；日志显示蜂窝 IPv6 客户端加入房间 XF6BT4YQ。
  “PIN/邮箱验证”是 Cloudflare 临时地址外部流程，不是 OpusMC 功能（K-100）。
- 回归（修复后）：phase-05 62/62 + 18/18 + 6/6；phase-06 22/22 + 31/31；91 JS + 10 server mjs `node --check`。
- **未测**：Caddy + 公网 IPv4/域名/端口转发、Windows 防火墙脚本实际添加/删除、公网长期稳定性/带宽/
  10 人并发、手机型号/OS/GPU/发热/帧率（用户不提供设备信息）。Caddy 是备用模板，不属于正式验收路径。
  详见 `docs/phases/phase-08-deployment/TEST_REPORT.md`。

### phase-07

- 桌面固定场景（headless + 真实 ANGLE/AMD 核显，maxFps=60）：首轮普通/建筑/240 实体/战斗/光影 1–4 全部 60 FPS；
  重复测试光影 3/4 为 59.8/57.1 FPS（边际波动）；
  主菜单 60.0、多人房间 59.9 FPS（RTT 1.3 ms、8 s 接收 26.5 KB）。
- 手机 3120×1440 视口模拟：30 s 稳定 60 FPS（基线 44.8）；动态分辨率 0.9→0.5；**不是真机**。
- 编辑压力：p99 25.0→20.8 ms，最慢 29.2→20.9 ms。
- K-39（SwiftShader + CPU 8×）：基线 3 次/46 s → 修复 0 次/约 9 s。
- 服务器机器人 2/5/10/30 连接：19.97–20.00 TPS；tick 0.12–0.39 ms；CPU 0.4–2.7%。
- 回归：phase-05 62/62 + 18/18 + 6/6；phase-06 22/22 + 31/31；91 JS + 9 mjs `node --check`；87 页面脚本。
- 详细与未测项：`docs/testing/performance-baseline.md`、`docs/phases/phase-07-performance/TEST_REPORT.md`。

### phase-06

- 服务端双存档：**22 PASS / 0 FAIL**（同房名隔离/定时保存/断线存活/重启恢复/备份/语法+结构损坏回退写回/
  异常退出）。
- 浏览器双存档：**31 PASS / 0 FAIL**（旧存档/本地 CRUD/刷新/同名/服务器同名隔离/`srv~` 防线/
  房间刷新恢复/离开/断线）。
- 旧存档样本：改造前创建，改造后可读、可继续保存，旧 cloud 字段/旧键未变。
- 证据：`D:\ds\REA\_work\phase06-*`；详细：`docs/phases/phase-06-dual-save/TEST_REPORT.md`。

### phase-05 回归

- 服务端集成 62/62；双浏览器 E2E 18/18；单人回归 6/6；91 JS + 9 mjs `node --check`。
- 证据：`D:\ds\REA\_work\phase05-*`；详细：`docs/phases/phase-05-server/TEST_REPORT.md`。

## 8. 目录与证据

```
D:\ds\REA\opusmc\
  index.html        游戏页面（87 个脚本）
  js\               91 个 .js + emoji.webp（新增 mp.js）
  sounds\sfx\       4,849 个原版音效（43.2 MB）
  scripts\serve.mjs 单机静态服务器（无 WS）
  server\           自建服务器（10 个 .mjs + config.json + README.md + 2 个 ps1）
  deploy\           Caddyfile（备用模板）、Cloudflare Tunnel 模板、Windows 防火墙脚本
  start-server.bat  一键启动（仅本机）
  start-lan.bat     局域网启动（0.0.0.0，打印局域网主地址；127 仅本机）
  stop-server.bat   正常关闭
  docs\             项目文档与阶段记录（deployment\ 部署说明、phases\phase-08-deployment\ 阶段文档）
```

- phase-08 证据：`_work/phase08-fix-*`（修复回归）、`_work/phase08-real-device-evidence.txt`、
  `server/data/logs/`（真实设备房间 E7UDCMQT / XF6BT4YQ）；脚本 `phase08-net-test.mjs`、
  `phase08-browser-test.mjs`、`phase08-fix-invite-test.mjs`；
  真实设备型号/网络/截图未提供（用户明确不提交）。
- phase-07 证据：`_work/phase07-baseline/`、`phase07-compare/`、`phase07-scenes/`、`phase07-mobile/`、
  `phase07-k39/`、`phase07-server/`、`phase07-edit/`、`phase07-long/`；脚本 `perf-scenes.mjs`、
  `perf-mobile.mjs`、`perf-edit.mjs`、`k39-check.mjs`、`phase07-server-perf.mjs`、`perf-long.mjs`。
- phase-06 证据：`phase06-server-test.mjs`、`phase06-browser-test.mjs`、`phase06-legacy-fixture.mjs/.json`、
  `phase06-legacy-profile/`、`phase06-*-result.json`、`phase06-local-world.png`、`phase06-server-*`。
- phase-05 证据：`phase05-server-test.mjs`、`phase05-browser-test.mjs`、`phase05-sp-regression.mjs` 等。
- 原始源码备份：`D:\ds\REA\_backup\opusmc-original-2026-11-06.zip`（如仍存在）。
- 历史分析报告：`docs/research/*.md`。

## 9. 已知噪音（不是新 bug）

- 控制台会有 `missing tile i_waxed_*_copper_door` / `missing tile all` 警告（原版存在）。
- 旧房间服务 `xz.honghemc.cn:8443` 在本机返回 403/CORS；多人界面公开房间列表显示红色错误（旧遗留，
  K-02/K-40/K-77）；自建服务器入口不依赖它。
- 无头 Chrome 不能锁定鼠标，会提示自由鼠标模式（既有行为）。
- `favicon.ico` 已由自有 `favicon.svg` 替代，不再 404。
- phase-06 测试中一次快速连续复用同一 Chrome profile 后刷新，`DB.listWorlds()` 返回空；同一脚本重跑
  31/31 通过。未在干净 profile 复现，记录为 headless/profile 复用噪音，不改核心 DB 打开逻辑。
- phase-07 的 headless 固定场景有 Chrome 合成器波动（个别 p95 20.8 ms）；以中位数/多轮结果为准，不据此
  宣称真实显示器完全无抖动。

## 10. 下一步

1. **phase-08 验收结束（真实设备用户实测）**：代码 `ef8c540`；docs `d8b237a`/`597a15f`；
   已推送 `origin/opusmc-integration`；不自动进入 phase-09。
2. 未测：Caddy + 公网 IPv4/域名/端口转发、Windows 防火墙脚本实际添加/删除、公网长期稳定性/带宽/
   10 人并发、手机型号/OS/GPU/发热/帧率（用户不提供设备信息）；发布前重新评估（K-95…K-100）。
   Caddy 是备用模板，不属于正式验收路径。
3. 保持 `mc-js-clone` 结构、`srv~` 拦截、服务器 `seed + 覆盖层`；跨版本迁移未做；
   服务端新增 `netutil.mjs`，部署时不能只复制旧 `server/`。
4. 遗留：旧房间服务/`/api/skin`/管理员公告/旧 `mcjs-room-key`（K-36/K-44/K-45/K-63/K-77）；
   `NET_CONFIG.announce=false`；旧云存档残留不删除。
5. K-39 已修复（验收结束）；LAN/HTTPS/WSS 已在 phase-08 实测（含真实手机）；
   Caddy/端口转发未配置，Caddy 不得写成已通过。
6. `D:\Projects\OpusMC` 未同步；如以那份为准，需要用户确认后单独同步。
