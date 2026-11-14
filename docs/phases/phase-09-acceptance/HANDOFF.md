# phase-09 完整验收 · 交接（HANDOFF）

- 日期：2026-11-14
- 状态：**带条件验收通过（用户 2026-11-14 确认）；phase-09 docs 已提交并推送
  `origin/opusmc-integration`（验收文档 `84f858d`）；代码仍为 phase-08 `ef8c540`；未合并；无下一阶段**
- 仓库：`D:\ds\REA\opusmc`
- 分支：`develop`（未新建/切换/重置）
- 起点：HEAD `b4c66a1`；被验收代码 = phase-08 `ef8c540`（`git diff ef8c540..HEAD` 只有 docs）
- 本阶段改动：**只新增 phase-09 文档与文档更新，没有修改 `js/`、`server/`、`index.html`、`deploy/`**

## 0. 用户验收决定（2026-11-14）

1. E/F 的真机项**接受 phase-08 真实设备证据**；phase-09 本阶段仍如实标 **NOT TESTED**，
   不写成本阶段真机通过。phase-08 未提供手机 OS/浏览器型号，不能断言“Android Chrome 与 iOS Safari 各自通过”。
2. 旧房间服务入口/选项占位保留，记录为已知遗留，不在本阶段删除。
3. 验收通过后只提交 docs；随后按用户 2026-11-14 指令推送 `origin/opusmc-integration`（`84f858d`）；
   未合并。

## 1. 本轮做了什么

1. 按 A–H 清单做本机完整验收：
   - 静态审计 29/29；四个浏览器（Chrome/Edge/Android UA/iOS UA）菜单与账号 UI 各 29/29；
   - 访客会话协议 29/29；Chrome+Edge 双客户端与双存档 47/47；本地 IndexedDB 17/17；代码质量与 3 分钟内存 18/18；
   - 合计 **256/256 PASS**。
2. 在验收提交上重跑阶段回归：phase-05 服务端 62/62 + 双浏览器 18/18 + 单人 6/6；
   phase-06 服务端 22/22 + 浏览器 31/31；phase-08 LAN 协议 22/22 + 双浏览器 15/15 + 邀请链接 8/8；
   合计 **184/184 PASS**。
3. 性能实测：桌面固定场景 8/8 60 FPS（GPU 5.58–15.31 ms）；Chrome/Edge 同场景 60 FPS；
   手机视口模拟 57.7/60.0 FPS；服务器 2/5/10/30 连接 19.97–20.01 TPS；5 分钟长跑 59.36 FPS、
   heap 151–480 MB 锯齿无单调增长。
4. 未发现需要修改代码的新缺陷；遗留的旧服务入口/占位/公告前缀已记录（K-02/K-34/K-44/K-63/K-77）。

## 2. Git

| 项 | 值 |
|---|---|
| 分支 | `develop`（跟踪 `origin/opusmc-integration`） |
| HEAD | phase-09 docs 推送后为当前 HEAD；验收文档提交 `84f858d`；被验收代码起点 `b4c66a1` |
| 被验收代码 | `ef8c540`（phase-08）；与 HEAD 无代码差异 |
| 工作区 | 代码未改；phase-09 docs 已提交并推送；另有 phase-08 遗留未跟踪文件 `REAopusmc<U+F022>`（与本阶段无关） |
| 提交 | **phase-09 验收文档 `84f858d`（只 docs）已提交并推送** |
| 远程 | 已推送 `origin/opusmc-integration`（`b4c66a1..84f858d`，fast-forward）；未合并、未强推；PR #1 未合并 |

## 3. 文档

新增：

- `docs/phases/phase-09-acceptance/PLAN.md`
- `docs/phases/phase-09-acceptance/TEST_REPORT.md`
- `docs/phases/phase-09-acceptance/ACCEPTANCE.md`
- `docs/phases/phase-09-acceptance/HANDOFF.md`（本文件）

更新（见 STATUS/CHANGELOG 等）：`docs/STATUS.md`、`docs/CHANGELOG.md`、`docs/PROJECT_SPEC.md`、
`docs/ARCHITECTURE.md`、`docs/DECISIONS.md`、`docs/KNOWN_ISSUES.md`、`docs/START-HERE.md`。

## 4. 证据

全部在仓库外 `D:\ds\REA\phase09-work\`（不提交）：

- 静态：`p09-static-result.json`
- UI：`phase09-ui-{chrome,edge,android,ios}-result.json` + `p09-ui-*.png`
- 会话：`p09-session-result.json`
- 多人/双存档：`p09-mp-result.json`、`p09-mp-*.png`
- 本地存档：`p09-local-result.json`、`p09-local-world.png`
- 质量/内存：`p09-quality-result.json`、`p09-quality-world.png`
- 回归：`p05server.log`、`p06server.log`、`p09-reg-*.log`、`p09-regressions-summary.txt`
- 性能：`phase07-scenes/`、`phase07-mobile/`、`phase07-server/`、`phase07-long/`、`p09-perf-{chrome,edge}.json`、
  `p09-perf-*.log`
- 测试脚本：`p09-*.mjs`、`run-regressions.ps1`

## 5. 真机证据的接受与边界（用户已决定）

用户 2026-11-14 决定：**接受 phase-08 的真实设备证据**（LAN 手机 + 电脑、蜂窝手机 + 电脑；
phase-08 日志房间 E7UDCMQT / XF6BT4YQ），phase-09 本阶段仍标 **NOT TESTED**。
phase-08 没有提供手机 OS/浏览器型号，所以不能写成“Android Chrome 与 iOS Safari 各自通过”，
也不能把 phase-08 的数字写成 phase-09 真机性能。

下面 §5.1–§5.5 保留为**以后想补新真机实测时**的操作清单；不是 phase-09 的未完成阻塞项。

### 5.1 准备

1. 在服务器电脑启动局域网服务器：双击 `start-lan.bat`（或 `node server\index.mjs --lan`）。
2. 所有设备（包括电脑）打开打印的 **`游戏地址（局域网）`**（不要用 `127.0.0.1` 给手机）。
3. 手机与电脑同一 Wi-Fi；Windows 防火墙放行专用网络（见 `docs/deployment/LAN.md`）。
4. 如需公网，按 `docs/deployment/REMOTE.md` 用 Cloudflare Tunnel（quick tunnel 地址是临时的）。

### 5.2 Android Chrome（真机）

- 打开上面地址 → 首屏 → 单人游戏：创建/进入世界，移动、转视角、放置、破坏、刷新重进。
- 多人游戏 → 输入昵称 → 自建服务器房间 → 创建房间；记下邀请码。
- 刷新页面 → “继续上次的房间”能回到同一房间。

### 5.3 iOS Safari（真机）

- 同上：页面能打开、能进单人世界、触控摇杆/转视角/放置/破坏、刷新重进。
- 记录是否出现触摸/全屏/Pointer Lock 限制提示（iOS 无 Pointer Lock，应有降级说明）。

### 5.4 两台不同物理设备连同一服务器

- 电脑 Chrome/Edge + 手机 Chrome/Safari（或两台手机）加入**同一邀请码**。
- 互相看到对方昵称/移动；A 放方块 B 能看到；B 放方块 A 能看到；世界时间/天气一致。
- 一方退出房间再凭邀请码加入，方块仍在；另一方不受影响。
- 服务器窗口不要关闭；手机刷新后可以继续。

### 5.5 需要回报的结果

按项回复 PASS/FAIL 即可，并注明设备/浏览器（型号可只写“Android/iPhone + 浏览器名”）：

| 项 | PASS/FAIL | 备注 |
|---|---|---|
| Android Chrome：单人 创建/移动/视角/放置/破坏/刷新 | | |
| Android Chrome：多人群 建房/加入/同名区分 | | |
| iOS Safari：单人 创建/移动/视角/放置/破坏/刷新 | | |
| iOS Safari：多人 建房/加入 | | |
| 两台设备：互相看到移动 | | |
| 两台设备：双向方块修改 | | |
| 两台设备：退出/重新加入，方块保留 | | |
| 两台设备：刷新后继续 | | |

> 真实设备型号/OS/浏览器版本/截图不是必须；能提供更好。若某项无法完成，明确写 BLOCKED 及原因。

## 6. 已知边界 / 不写成通过

- Android Chrome / iOS Safari 的 **真机** 未测；本机只有 UA/视口模拟（iOS 模拟仍是 Chromium，不是 WebKit）。
- 两台不同物理设备未测；本机是两个浏览器进程。
- 真实显示器/有头浏览器、手机发热/电池、>1 小时长跑、真实公网本轮未重跑。
- 旧房间服务入口/选项占位/`[公告]` 前缀保留（K-02/K-34/K-44/K-63/K-77）；不在本阶段删除。
- `server/data` 未被本阶段测试写入；phase-08 的真实设备房间/日志仍保留。

## 7. 下一步

1. **phase-09 已完成（带条件验收通过，用户 2026-11-14）**：docs 已推送 `origin/opusmc-integration`
   （验收文档 `84f858d`）；功能代码保持 phase-08 `ef8c540`；未合并。
2. **没有下一阶段**；不自动进入任何新阶段。
3. 如需合并到 `main` 或创建/更新 PR：先由用户确认；不 force push。
4. 以后若要补真机：按 §5 清单实测，把 `ACCEPTANCE.md` 的 E/F 和 `STATUS.md` 一起更新；
   若发现缺陷，只做最小修复并重跑 phase-05/06/07/08 回归与 phase-09 的 256 项。
5. 已知遗留保持：旧房间服务入口/公开房间错误、选项占位、`[公告]` 前缀（K-02/K-34/K-44/K-63/K-77）。
6. 未测项保持 NOT TESTED，不得改写：真机 Android/iOS、两台物理设备（本阶段）、真实显示器/有头浏览器、
   手机发热/电池、>1 小时长跑、真实公网 Tunnel 本轮重跑。
