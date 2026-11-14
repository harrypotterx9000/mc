# 变更记录（CHANGELOG）

格式：`阶段 — 日期 — 提交 — 内容`。只记录进入仓库的变更；待验收阶段变更明确标注“工作区变更，未提交”。

## phase-09 完整验收 — 2026-11-14 — docs 已推送 `origin/opusmc-integration`（`84f858d`）；代码未改（仍 `ef8c540`）

> 起点 HEAD `b4c66a1`（phase-08 docs 推送记录）；被验收代码 = phase-08 `ef8c540`
> （`git diff ef8c540..HEAD` 只有 docs）。
> **本阶段没有修改 `js/`、`server/`、`index.html`、`deploy/`，只新增/更新文档。**
> 本机/自动化验收 **256/256 PASS**；阶段回归 **184/184 PASS**；
> 真机 Android Chrome / iOS Safari / 两台物理设备本阶段 **NOT TESTED**；
> **用户 2026-11-14 决定接受 phase-08 真机证据作为参考**。
> **带条件验收通过；docs 已提交并推送 `origin/opusmc-integration`（验收文档 `84f858d`）；未合并。**

- 修改原因：按用户 A–H 清单做阶段 9 完整验收；确认菜单/账号/访客/存档/浏览器/多人/性能/代码质量，
  并在验收提交上重跑 phase-05/06/08 回归，不能用历史结果代替。
- 新增文件（4）：`docs/phases/phase-09-acceptance/{PLAN,TEST_REPORT,ACCEPTANCE,HANDOFF}.md`。
- 修改文件（7）：`docs/STATUS.md`、`docs/CHANGELOG.md`、`docs/PROJECT_SPEC.md`、
  `docs/ARCHITECTURE.md`、`docs/DECISIONS.md`、`docs/KNOWN_ISSUES.md`、`docs/START-HERE.md`。
- 删除文件：无。
- 关键变化（验证，不是功能）：
  - 菜单：指定删除项全部不存在；首启无协议/玩家类型；标题只保留单人/多人/皮肤/帮助/选项/退出。
  - 账号：无 B 站/Toy/账号/登录/注册/资料/绑定/账号云存档；客户端与服务端账号 endpoint 均 404。
  - 访客：昵称 + `p_`+16 hex；同名消歧 `同名牌`/`同名牌2`；120 s 窗口内 resume 同 ID，
    过期新 join 新 ID；错误 token 拒绝；日志无 token。
  - 存档：IndexedDB 本地 17/17；服务器 `srv~`/`world.json`/重启恢复/刷新不丢；两类互不覆盖。
  - 多人：Chrome+Edge 双进程 47/47（移动/双向方块/聊天/世界时间/离开重进/刷新 resume/服务器重启）。
  - 质量：4 浏览器 + 双客户端 0 未捕获异常、`game.errLog` 空、同源资源失败 0、监听器/补丁完整；
    3 分钟 heap 242→109 MB 后稳定；5 分钟长跑 heap 151–480 MB 锯齿无单调增长。
  - 性能：桌面固定场景 8/8 60 FPS（GPU 5.58–15.31 ms）；Chrome/Edge 60 FPS；手机视口模拟
    57.7/60.0 FPS（非真机）；服务器 2/5/10/30 连接 19.97–20.01 TPS。
- 回归：phase-05 服务端 62/62 + 双浏览器 18/18 + 单人 6/6；phase-06 服务端 22/22 + 浏览器 31/31；
  phase-08 LAN 协议 22/22 + 双浏览器 15/15 + 邀请链接 8/8；91 JS + 10 server mjs `node --check`。
- 遗留（不在本阶段删除）：旧房间服务入口/公开房间错误（K-02/K-40/K-47/K-63/K-77）、
  选项禁用占位（K-34）、休眠 `[公告]` 前缀（K-44）、不可达 `js/sounds.js`（K-52）。
- 未验证：Android Chrome/iOS Safari 真机、两台不同物理设备、真实显示器/有头浏览器、手机发热/电池、
  >1 小时长跑、真实公网 Tunnel 本轮重跑；不得写成已通过。
- 证据：`D:\ds\REA\phase09-work\`（仓库外，不提交）。
- 推送：验收文档提交 `84f858d`（`docs(phase-09): record full acceptance and conditional sign-off`）
  已推送 `origin/opusmc-integration`（`b4c66a1..84f858d`，fast-forward）；未合并、未强推。
- 状态：**带条件验收通过（用户 2026-11-14）；docs 已推送 `origin/opusmc-integration`；代码保持
  phase-08 `ef8c540`；未合并。**
  - 真机 E/F 接受 phase-08 真实设备证据，本阶段仍标 NOT TESTED；phase-08 未提供手机 OS/浏览器型号，
    不能断言“Android Chrome 与 iOS Safari 各自通过”。
  - 旧入口/占位保留为已知遗留（K-02/K-34/K-44/K-63/K-77）。

## phase-08 网络部署 — 2026-11-14 — 验收结束；代码 `ef8c540`；已推送

> 起点 HEAD `221d4ea`（phase-07 docs 推送记录）；phase-07 代码 `508fcc8`；phase-08 代码 `ef8c540`；
> docs `d8b237a`/`597a15f`。
> LAN 主地址/127 标注 PASS、邀请链接一致性 8/8、LAN 协议 22/22 + 双浏览器 15/15；
> Cloudflare Tunnel 公网 HTTPS/WSS 协议 22/22 + 浏览器 15/15（前两次 quick tunnel 资产流超时，第三次通过）；
> 外部节点 5/6 200；公网管理接口（含正确令牌）403。
> **真实手机 LAN（单人/移动/视角/放置/破坏/刷新）与手机蜂窝公网（HTTPS/进入/渲染/移动/视角/放置/破坏/刷新）
> 用户报告 PASS（2026-11-14）**；服务器日志分别有 LAN 客户端（E7UDCMQT）与蜂窝 IPv6 客户端（XF6BT4YQ）加入。
> Caddy 为备用模板、不属于正式验收路径；用户未提供手机型号/网络/截图。
> **已推送 `origin/opusmc-integration`（phase-08 内容 tip `597a15f`；远程 HEAD 为推送记录/当前 HEAD）。**

- 修改原因：阶段 8 要求先让同一 Wi-Fi 的手机/电脑访问同一台服务器，再提供外网 HTTPS/WSS；
  原服务器默认只绑定 `127.0.0.1`，且反向代理/隧道会让源站把所有请求看成 `127.0.0.1`，
  导致管理接口本机限制被绕过、所有远程玩家共用限流桶。验收又发现 LAN 模式把回环地址作为
  主游戏地址，可能生成 loopback 邀请链接。
- 新增文件（11）：`server/netutil.mjs`、`start-lan.bat`、`deploy/README.md`、`deploy/Caddyfile`、
  `deploy/cloudflared/config.yml.example`、`deploy/windows/firewall-lan.ps1`、
  `docs/deployment/{LAN,REMOTE}.md`、`docs/phases/phase-08-deployment/{PLAN,TEST_REPORT,HANDOFF}.md`。
- 修改文件（14）：7 个代码/说明（`README.md`、`server/README.md`、`server/config.mjs`、
  `server/http.mjs`、`server/index.mjs`、`server/rooms.mjs`、`server/ws.mjs`）+
  7 个项目文档（`docs/{STATUS,START-HERE,PROJECT_SPEC,ARCHITECTURE,DECISIONS,KNOWN_ISSUES,CHANGELOG}.md`）。
- 提交拆分：代码/部署资产 `ef8c540`（12 个文件）；项目/阶段文档 `d8b237a`（13 个文件）+
  `597a15f`（HANDOFF 细节）；推送记录为当前 HEAD。
- 推送：`origin/opusmc-integration`，phase-08 内容 tip `597a15f`；远程 HEAD 为推送记录/当前 HEAD；未合并、未强推。
- 关键变化：
  - LAN：`--lan`/`start-lan.bat` 绑定 `0.0.0.0`；**主地址优先有效私有 IPv4**，`127.0.0.1` 标为
    “仅本机访问”；邀请链接专项 8/8 覆盖多次建房/刷新/恢复；防火墙脚本默认只放行专用网络。
  - 安全：`server/netutil.mjs` 的 `clientIp`/`forwardedIp`；转发头只在本机回环代理时可信；
    管理接口“直连 + 转发都回环”；WS 限流/日志按真实客户端 IP。
  - 外网：**Cloudflare Tunnel 为正式支持/验收路径**；Caddy 为备用模板（未运行验证，不属于正式验收）；
    Node 不终止 TLS；`server/data`/`/api/admin/*` 经公网不可达；未配置路由器端口转发。
  - 版本：`server/index.mjs` `0.8.0`；`hello`/`/healthz` 版本 `phase-08`；`server/` 10 个 `.mjs`。
- 关键函数/状态：`server/index.mjs` 的 `isPrivateIPv4`/`lanInfo`/启动输出；`server/netutil.mjs` 的
  `cleanIp`/`isLoopback`/`forwardedIp`/`clientIp`；`server/http.mjs` 管理接口代理感知；
  `server/ws.mjs` `WSConnection.ip`。
- 回归（修复后复跑）：phase-05 62/62 + 18/18 + 6/6；phase-06 22/22 + 31/31；
  91 JS + 10 server mjs `node --check`。
- **真实设备（用户报告 2026-11-14）**：手机 LAN 单人/移动/视角/放置/破坏/刷新 PASS；手机蜂窝
  关闭 Wi-Fi 经 Cloudflare HTTPS 进入/渲染/移动/视角/放置/破坏/刷新 PASS；服务器日志有 LAN 与蜂窝客户端。
  用户未提供型号/网络/截图；“PIN/邮箱验证”是 Cloudflare 临时地址外部流程，不是应用功能。
- 未验证：Windows 防火墙脚本实际添加/删除、Caddy 公网入站/端口转发、公网长期稳定性/带宽/10 人并发、
  手机型号/性能/截图；quick tunnel 为临时地址。K-95…K-100。
- 删除文件：无。
- 状态：**验收结束（真实设备用户实测）；代码 `ef8c540`；已推送 `origin/opusmc-integration`；
  不自动进入 phase-09。**

## phase-07 电脑与手机性能优化 — 2026-11-13 — 代码 `508fcc8`、docs `a2bdb0e`；已推送

> 起点 HEAD `ea88dba`；phase-06 代码 `b4833b8`。本阶段只改性能相关代码/文档，未新增页面脚本。
> 桌面固定场景首轮 8 项 60 FPS（headless + 真实 ANGLE/AMD 核显；重复测试光影 3/4 为 59.8/57.1）；
> 手机 3120×1440 视口模拟 30 s 60 FPS（基线 44.8，非真机）；K-39 基线 3 次/46 s → 0 次/约 9 s；
> 服务器 2/5/10/30 连接 19.97–20.00 TPS。**代码 `508fcc8`、docs `a2bdb0e` 已推送；K-93/K-94 为已知边界。**

- 修改原因：减少主线程区块/网格卡顿、动态分辨率稳定 60/30 目标、控制实体/粒子/显存、避免 K-39 误报
  重请求、修正 Windows 服务器 16.1 TPS 的调度根因，并提供可观测/可回归的性能数据。
- 修改文件（工作区）：
  - 客户端（8）：`js/entity.js`、`js/game.js`、`js/mp.js`、`js/onboard.js`、`js/perf.js`、`js/render.js`、
    `js/screens.js`、`js/terrain2.js`
  - 服务器/说明（6）：`server/http.mjs`、`server/index.mjs`、`server/rooms.mjs`、`server/ws.mjs`、
    `server/status.ps1`、`server/README.md`
- 新增文档：`docs/phases/phase-07-performance/{PLAN,TEST_REPORT,HANDOFF}.md`；更新
  `docs/{STATUS,ARCHITECTURE,DECISIONS,KNOWN_ISSUES,PROJECT_SPEC,START-HERE,CHANGELOG}.md`、
  `docs/testing/performance-baseline.md`、`README.md`。
- 删除文件：`docs/phases/phase-07-performance/.gitkeep`（占位文件；目录已有阶段文档）。
- 关键变化：
  - 帧预算：手机 8 ms/桌面 12 ms 区块主线程；编辑 `flushMesh` 按预算分批；复用可见列表/候选数组。
  - 动态分辨率：平均帧 + 迟到比例判定；手机下限 0.4/桌面 0.5；首次降 20%；默认 60 目标（显式 maxFps 优先）。
  - 画质：低/中/高/极高/自定义；视频设置“测试性能并推荐画质…”；每世界一次实测建议（不自动改）。
  - 实体/粒子/内存：低/中档实体距离/阴影/粒子上限；手机顶点页 4 MB；解码后释放 encoded chunk。
  - 网络：`MPClient` ping/RTT/流量；F3/报告显示；服务器广播一次编码多连接复用。
  - 服务器：10 ms 唤醒 + 50 ms 补 tick（修复 Windows 16.1 TPS）；管理 `perf` 指标；公开接口隐藏诊断。
  - K-39：watchdog 有进展/存档读取/管线忙时等待，不再过早删除 pending 重请求。
- 独立验收修复（2026-11-13）：`DynRes.target()` 修正 90 Hz/无限制/30 Hz 目标；`ambientParticles()` 粒子满额
  判空；`PerfMon.recommend()` 纳入玩家 `maxFps` 上限。复测光影 3/4 在重复轮次为 59.8/57.1 FPS（边际波动）。
- 未验证：真实手机/显示器、发热/电池、真实 LAN/公网/TLS、>1 小时连续运行；模拟数据不得写成真机达标。
- 状态：**代码 `508fcc8`、docs `a2bdb0e` 已提交并推送 `origin/opusmc-integration`。**

## phase-06 双存档系统 — 2026-11-12 — 已验收；代码 `b4833b8` + docs 收尾

> 起点 HEAD `41042c7`；phase-05 代码 `817bad3`。代码提交 `b4833b8`，docs 收尾为当前 HEAD。
> 本阶段 15 个修改文件（7 个代码/服务器说明 + 8 个项目文档）+ 1 个删除 + 3 个新增阶段文档。
> 服务端双存档 22/22、浏览器双存档 31/31、旧存档样本复验、phase-05 回归 62/62 + 18/18 + 6/6。
> 旧云存档只保留不迁移；服务器世界仍为 `seed + 覆盖层`。**未推送。**

- 修改文件：
  - 代码/服务器说明（7）：`js/anvil.js`、`js/game.js`、`js/mp.js`、`js/save.js`、`js/screens.js`、
    `server/storage.mjs`、`server/README.md`
  - 项目文档（8）：`README.md`、`docs/{STATUS,ARCHITECTURE,DECISIONS,KNOWN_ISSUES,PROJECT_SPEC,START-HERE,CHANGELOG}.md`
- 删除文件：`docs/phases/phase-06-dual-save/.gitkeep`（占位文件；目录已有阶段文档）
- 新增文件：`docs/phases/phase-06-dual-save/{PLAN,TEST_REPORT,HANDOFF}.md`
- 关键变化：
  - `js/save.js`：新增 `DB.isServerWorld`（`srv~`）、`DB.newWorldId`（时间戳 + 随机后缀 + 唯一性检查）；
    `listWorlds` 过滤 `srv~`；`getWorld/loadChunks/chunkKeys/getChunk` 对 `srv~` 返回空；
    `putWorld/putChunks/deleteWorld` 对 `srv~` 空操作。数据库名/仓库/keyPath/编码未变。
  - `js/game.js`：`createWorld` 用 `DB.newWorldId`；`saveWorld/quitToTitle/captureIcon` 对 `srv~` 世界跳过本地保存。
  - `js/anvil.js`：原版存档导入使用同一唯一 ID 分配器。
  - `js/mp.js`：服务器世界元数据 `server:true`；`cleanup()` 清除 `srv~` 元数据；界面说明服务器/单人存档分开。
  - `js/screens.js`：单人列表“仅保存在此浏览器”；单人/多人/创建/离开房间的存档提示。
  - `server/storage.mjs`：`world.json` 解析失败**或结构无效**都回退最新可读备份；恢复后原子写回
    （`world_recovered_from_backup` + `world_recovered_written`）；`dir` 与目录名不一致拒绝加载
    （`world_dir_mismatch`）。
  - `server/README.md`：双存档隔离、损坏恢复/写回、日志事件说明。
- 修改原因：phase-06 要求本地/服务器双存档明确隔离、同名不覆盖、断线/刷新不丢服务器世界、旧存档保护；
  phase-05 已有服务器存储，但客户端防线只在 `mp.js`、`world.json` 结构无效时不回退备份，恢复后也不写回。
- 验证：
  - 服务端双存档 **22/22 PASS**（同房名隔离/定时保存/断线存活/重启恢复/备份/语法+结构损坏回退写回/
    异常退出）。
  - 浏览器双存档 **31/31 PASS**（旧存档/本地 CRUD/刷新/同名/服务器同名隔离/`srv~` 防线/房间刷新恢复/
    离开/断线）。
  - phase-05 回归：服务端 **62/62**、双浏览器 **18/18**、单人 **6/6**；91 JS + 9 mjs `node --check`；
    `index.html` 87 脚本；`git diff --check`；LF/无 BOM。
  - 旧存档：改造前创建的两个同名世界（`gen=1/2`、旧 `cloud` 字段、旧键）在改造后可读、可继续保存。
- 未验证：旧云存档恢复/迁移、服务器世界下载/统一列表、在线备份回滚 UI、跨版本存档、真实 LAN/公网/TLS/
  压力/长时间运行；异常退出最多丢失 `autosaveSeconds`。
- 状态：**已验收（2026-11-12）；代码 `b4833b8`；docs 收尾为当前 HEAD；未推送。** 详见 `docs/phases/phase-06-dual-save/`、ADR-020。

## phase-05 自建服务器 — 2026-11-12 — 已验收；代码 `817bad3` + docs 收尾

> 起点 `3b8b2e0`；phase-05 代码提交 `817bad3`，docs 收尾为当前 HEAD；本阶段 35 个文件。服务端集成 62/62、双浏览器 E2E 18/18、
> 单人回归 6/6；独立验收 F-A…F-F 已修复并复验。真实 LAN 双设备、公网/TLS、长时间/压力未测。
> 服务器不同步生物/红石/流体/战斗；存档为 seed + 方块覆盖层。

- 新增文件：
  - `server/index.mjs`、`config.mjs`、`log.mjs`、`storage.mjs`、`blockids.mjs`、`ws.mjs`、`protocol.mjs`、`rooms.mjs`、`http.mjs`
  - `server/config.json`、`server/README.md`、`server/stop.ps1`、`server/status.ps1`
  - `js/mp.js`；根目录 `start-server.bat`、`stop-server.bat`
  - `docs/phases/phase-05-server/{PLAN,TEST_REPORT,HANDOFF,ACCEPTANCE}.md`
- 删除文件：`server/.gitkeep`、`docs/phases/phase-05-server/.gitkeep`（占位文件；目录已有实现）
- 文件总计：**35 个**（13 修改 + 2 删除 + 20 新增）；24 个既有 JS 另做 CRLF→LF 行尾归一（Git 内容无 diff）。
- 修改文件：`index.html`、`js/net.js`、`js/netconfig.js`、`js/screens.js`、`.gitignore`、`README.md`、
  `docs/{STATUS,ARCHITECTURE,DECISIONS,KNOWN_ISSUES,PROJECT_SPEC,START-HERE,CHANGELOG}.md`
- 关键变化：
  - 服务端：零 npm 依赖；自写 RFC 6455；静态白名单 + ETag/304 + 缓存 + 安全头；`/healthz`；
    本机管理接口；房间/邀请码（8 位、去易混字符、服务器唯一）；临时玩家 ID `p_`+16 hex；SHA-256 会话令牌；
    120 秒恢复；房主/权限；按 IP 加入/创建限流；20 TPS 世界时钟；方块覆盖层；方块实体；玩家/掉落物同步；
    移动/方块/协议校验；每房 `world.json`、原子写、串行保存、备份/损坏回退；JSONL 日志；pid；正常关闭。
  - 客户端：`MPServer`/`MPClient`；`srv~<code>` 世界；`DB` 对 `srv~` 重定向/空操作；`finishChunk` 应用覆盖层；
    `Game.breakBlock/placeAt/useOnBlockItem` 动作窗口 + `World.setBlock` 筛选上报；`Game.tick` 10 Hz state/
    10 s pstate/方块批次/时间/拾取；`dropItem` 近处共享；`quitToTitle/saveWorld/respawn/changeDimension`
    适配；自动 `resume` 重连；`MPServerScreen/MPCreateScreen/MPRoomScreen`。
  - `index.html` 86 → **87** 脚本；`js/` 90 → **91** `.js`；启动总数 87。
  - `MultiplayerScreen` 增加“自建服务器房间…”入口；`PauseScreen` 增加“房间…”并调整退出按钮；
    `netconfig.js` 增加 `server: ''`（同源）。
  - 旧 `NetClient`/`RoomService`/`p2p`/单人 IndexedDB 保留，未覆盖；`NET_CONFIG.announce` 仍 false。
  - 独立验收修复：方块 ID 白名单展开动态表（1257/1257）；`MPClient` 方块实体差异上报；
    关闭顺序改为先保存再清 HTTP 连接；24 个既有 CRLF-only JS 归一为 LF（完整 Diff 35/35，raw=normalized）；
    掉落发送阈值收紧到 4.5（服务器 6），旧 socket 的 open/message/error/close 不覆盖新连接。
  - 关键函数/状态：`RoomManager`/`Room`、`WSConnection`/`WSServer`、`RoomStore`、`blockids` 动态 ID 表、
    `MPClient`/`MPPlayer`、`MPClient.syncBlockEntities`、`MPClient.onClose(ws)`、`shutdown()` 保存顺序；
    `Game.tick`/`World.setBlock`/`DB`/`quitToTitle`/`saveWorld`/`respawn`/`changeDimension` 的包装顺序
    在 `p2p.js` 之后。
- 修改原因：建立独立于 Bilibili/旧房间服务的 Windows 自建多人服务器；保持单人 IndexedDB、旧
  `NetClient`/`RoomService`/`p2p` 不变；服务器权威房间/身份/权限/方块覆盖层/方块实体/玩家与物品快照/时间/存档。
- 验证：
  - 服务端集成 **62/62 PASS**（静态/安全、房间/身份、同步、权威、权限、断线恢复、协议异常、持久化/备份、
    管理/关闭、限流）。
  - 双浏览器 E2E **18/18 PASS**（Chrome 157 headless SwiftShader；创建/加入/互看/移动/方块/聊天/房间界面/
    重连/踢人/关房；0 未捕获异常；最近一轮无 `chunk stall`，此前轮次 B 曾一次已知 K-39）。
  - 单人回归 **6/6 PASS**；91 JS + 9 server mjs `node --check`；`git diff --check`。
  - 修复复核：F-A 1257/1257 + 19/19 + 存档 3/3；F-B 7/7；F-C 18/18（3 轮）；F-D 35/35；F-E/F-F 6/6；晚加入/刷新恢复 7/7。
  - `scripts/serve.mjs` 回归：index/mp.js 200，`server/config.json` 403。
  - `stop.ps1`/`status.ps1`/端口占用启动：实测。
  - 证据：`D:\ds\REA\_work\phase05-*`；详见 `docs/phases/phase-05-server/TEST_REPORT.md`。
- 未验证：真实 LAN 双设备、10 人/长时间/压力、公网/TLS/NAT、真实 GPU/移动端、服务端生物/红石/战斗、
  跨版本存档；管理接口已测本机 LAN IP 403，双机拒绝仍未测。见 `KNOWN_ISSUES.md` K-67…K-80。
- 状态：**已验收（2026-11-12）；代码提交 `817bad3`；docs 收尾为当前 HEAD；已推送 `origin/opusmc-integration`。**

## phase-04 浏览器独立运行 — 2026-11-12 — 提交 `553ceed`（代码）+ docs 收尾

> 起点 `840b19c`；代码提交 `553ceed`；docs 收尾为当前 HEAD。phase-04 已验收通过，并已推送 `origin/opusmc-integration`；未合并、未强推、未打标签。
> 用户明确豁免真实 Android/iOS 补测；K-39 留 phase-07。

- 新增文件：`js/platform.js`（浏览器平台适配层）、`favicon.svg`、`docs/phases/phase-04-browser/{PLAN,TEST_REPORT,HANDOFF,ACCEPTANCE}.md`
- 删除文件：`docs/phases/phase-04-browser/.gitkeep`（占位文件；目录已由阶段文档替代）
- 修改文件（21）：`index.html`、`README.md`、`scripts/serve.mjs`、`js/{main,mobile,touch,screens,ui,render,game,audio,save,guest,net,netconfig,skins,social,terrain2,extras,emoji,export}.js`
- 关键变化：
  - `js/platform.js`：能力探测/阻断与降级、兼容性面板、安全 localStorage/sessionStorage、Web Audio、Worker、
    文件 API、全屏/方向/键盘锁定、Pointer Lock、安全区/visualViewport、本地资源 URL、WebGL/Canvas 获取与上下文丢失。
  - `index.html`：85 → **86** 个脚本；`platform.js` 第一；启动进度、资源失败/90 s 超时、`file://` 提示、
    兼容性面板、favicon；移除启动时对本页的额外 fetch。
  - `scripts/serve.mjs`：只服务 `index.html`、`js/*.{js,webp}`、`sounds/sfx/*`、`favicon.svg`；拒绝
    docs/scripts/server/.git/点文件/目录/穿越；ETag + 304；HTML/JS no-cache；音效 30 天、图片 7 天；
    HEAD/MIME；可选 `HOST=0.0.0.0`。
  - 渲染/输入：WebGL2/Canvas2D、Pointer Lock、全屏走平台层；F11 防双触发；指针锁定失败自由鼠标降级并提示。
  - 移动：`visualViewport` 尺寸、CSS 安全区、竖屏 90° 安全区映射、事件按帧合并、Android 全屏/横屏锁定、
    iOS 无元素全屏/鼠标锁定时不阻断；摇杆/跳跃/攻击/使用/互动/多点触控保留。
  - 存储/资源：localStorage/sessionStorage、Worker、AudioContext、音效/emoji/懒加载数据 URL 统一走平台层；
    `chunk_worker.js` 绝对 URL 后 `importScripts` 仍按 `/js/` 解析。
  - 网络边界：`NET_CONFIG.announce=false`，单机后台不再每分钟请求旧房间服务公告；多人功能仍待 phase-05。
  - 关键函数/状态：`Platform`（caps/compat/storage/audio/workers/files/display/input/graphics/resource）；
    `Stage.update/size/measure/safe/toStage`、`UI.prototype.safe`；`toggleFullscreen`/`Game.capturePointer`
    统一走平台层；`WorldListScreen.pick`/`PhotoScreen.save` 用文件 API；`LS` 增加内存回退并在写失败时抛错。
    未改变 `Game.tick`/`placeAt`/`UI.open`/`bindInput` 的包装顺序。
- 验证：
  - 90 个 JS `node --check`；`index.html` 86 个脚本；`git diff --check` 通过；改动文件保持 LF。
  - Windows Edge 157 + SwiftShader：桌面 **37/37 PASS**；65 s 游玩无第三方请求；`game.errLog` 为空。
  - Windows Chrome 157 + SwiftShader：桌面 **37/37 PASS**。
  - Windows Chrome 83 旧版：**9/9 PASS**（旧 headless `chunk stall` 单列）。
  - Android Chrome / iOS Safari（Chromium 模拟）：**21/21 PASS**；真实设备 NOT TESTED（用户明确不补测）。
  - 降级（禁用 Worker + localStorage）：**7/7 PASS**。
  - 兼容性面板（`file://`、无 WebGL2、上下文丢失）：**3/3 PASS**。
  - 服务器白名单/缓存/304/HEAD/404：通过。
  - 0 未捕获异常；正常路径 `game.errLog` 为空。
  - 独立验收：Edge **44/44 PASS**；Chrome **43/45 PASS**（2 项 K-39 `chunk stall`）；移动模拟 **25/25 PASS**；
    兼容/降级 **7/7 PASS**；phase-03 回归 **33/33 PASS**；受信任 F11/文件操作 NOT TESTED。
- 未验证：真实 Android/iOS 真机、iOS WebKit、真实 GPU FPS、手机发热/长时间运行、HTTPS/WSS/公网。
  用户已明确不补测真实 Android/iOS；K-39 留 phase-07。
- 修改原因：用户 phase-04 指令；PROJECT_SPEC §11.9；ADR-016/ADR-017。
- 状态：**已实现、已测试、验收通过（带用户豁免：真实 Android/iOS 不补测，K-39 延期 phase-07）；代码提交 `553ceed`，已推送 `origin/opusmc-integration`；未合并。** 详见 `docs/phases/phase-04-browser/ACCEPTANCE.md`。

## phase-03 彻底移除账号系统并建立访客模式 — 2026-11-12 — 提交 `025cba8`（代码）+ docs 收尾

> 代码提交 `025cba8`；docs 收尾为当前 HEAD。phase-03 代码与 docs 均已推送 `origin/opusmc-integration`；未合并、未强推、未打标签。客户端核心 10/10 PASS；独立验收 68 PASS / 0 FAIL / 1 BLOCKED + F-1 非阻断 UI FAIL。

- 新增文件：`js/guest.js`（`GuestSession`）；`docs/phases/phase-03-guest-mode/PLAN.md`、`TEST_REPORT.md`、`HANDOFF.md`、`ACCEPTANCE.md`
- 删除文件：`js/account.js`（510 行）、`js/toy.js`（335 行）、`js/cloudsave.js`（323 行）、`js/checkin.js`（566 行）
- 修改文件（15）：
  - `index.html`：删除 4 个脚本引用，新增 `js/guest.js`（`netconfig` 后、`net` 前）；脚本 88 → **85**；加载条总数 85
  - `js/ui.js`：新增 `drawCard`（原 `account.js` 的公共绘图函数）
  - `js/skins.js`：删除账号外观接管/`Account.update`/签到锁定分支；保留 `mcjs-look` 与保存/刷新恢复；前缀预览用 `GuestSession.displayName`
  - `js/capes.js`：删除 `Account.data.skin` 回退
  - `js/cosmetics.js`：名字前缀识别用 `GuestSession.name`
  - `js/net.js`：`hello` 无 token；昵称输入始终显示；`login.eid → GuestSession.connected`；`leaveServer(keepGuest)`；删除账号特权/`sup` 判断
  - `js/p2p.js`：host/join 无 token；昵称统一 `GuestSession`；本地房间连接状态迁移；删除 `onlineGate`
  - `js/screens.js`：单人/多人直接放行；删除标题账号按钮与 Toy 退出分支
  - `js/onboard.js`：首启画质 → 设备 → 差异说明；删除登录步骤与账号选项；文案改访客/本地存档
  - `js/social.js`：删除 Toy 内容检查/二维码/分享/页面关闭桥；保留邀请卡复制与管理员公告；`pagehide` 离房
  - `js/mobile.js`：删除 Toy 容器/安全区桥；保留 CSS 横屏与触控
  - `js/extras.js`：照片条删除账号名/B站文案/二维码；保留保存图片
  - `js/audio.js`、`js/perf.js`、`js/touch.js`：清理旧平台注释
- 关键函数/状态变化：
  - 删除 `Account`、`Toy`/`ToyError`、`CloudSave`、`Checkin`、`LoginScreen`、`CodeShowScreen`、`CodeLoginScreen`、`AccountScreen`、`FrozenScreen`、`AdminScreen`、`ToyDiagScreen`、`FollowGateScreen`、`CloudScreen`、`CloudConflictScreen`、`CheckinScreen`、`singleGate`、`onlineGate`、`g_netName`、`ACCOUNT_SETTINGS`。
  - 新增 `GuestSession`：`name`、`playerId`、`roomId`、`connection`、`resumeInfo()`、`beginConnect()`、`connected(id)`、`disconnected()`、`leaveRoom()`；localStorage `mcjs-guest-name`、sessionStorage `mcjs-guest-resume`。
  - `Game.joinRoom`/`joinServer` 建会话；`NetClient` 在 `login` 时接收服务器临时 ID；异常断开保留 5 分钟提示，主动离开清除。
- 关键行为变化：
  - 不再有注册/登录/密码/邮箱/手机号/识别码/账号资料/账号绑定/B站登录/Toy 身份/关注/三连/解锁判断/账号云存档/签到。
  - 玩家用昵称进入多人；临时玩家 ID 由服务器按房间会话分配；单人无需任何身份。
  - 全部外观仍免费；外观只保存在本设备；活动款装饰保留。
  - 单人继续 IndexedDB；多人存档留给 phase-05 服务器。
- 修改原因：用户 phase-03 指令；PROJECT_SPEC §2/§3/§6/§11；ADR-003/ADR-015。
- 验证：
  - 89 个 `.js` 全量 `node --check` 通过；`git diff --check` 通过；`index.html` 85 个脚本
  - 无头 Edge 157 + SwiftShader：核心运行时 **33/33 PASS**；首启 **1/1 PASS**；0 FAIL；`game.errLog` 为空；0 未捕获异常
  - `Account`/`Toy`/`CloudSave`/`Checkin`/`LoginScreen`/`AccountScreen` 均为 `undefined`
  - 无 `/api/account`、`/api/cloud`、`/api/event`、`/api/gate`、`/api/checkin`、`/api/news` 或 Bilibili 请求
  - 昵称可中文并本地保存；加入参数正确；`GuestSession` 服务器 ID/重连/离房状态正确
  - 18 皮肤 + 23 披风 + 3 帽子 + 1 宠物 + 1 前缀全部可用、0 锁定；活动款与 8 装饰保留
  - 游客外观保存 → 刷新恢复；单人世界创建/保存 → 刷新恢复
  - 独立验收：主验收 47 PASS / 1 BLOCKED；手机 9 PASS；真实连接/P2P 主机 8 PASS；照片/关闭 3 PASS；TTL 1 PASS；合计 **68 PASS / 0 FAIL / 1 BLOCKED**
  - 独立验收额外发现 1 个非阻断 UI FAIL（F-1：同名昵称时满员房间被误判为「我的房间」）；客户端核心 10/10 通过，端到端未宣称完成
  - 截图/结果：`D:\ds\REA\_work\phase03-*`；详细：`docs/phases/phase-03-guest-mode/{TEST_REPORT,ACCEPTANCE}.md`
- 未验证：真实房间加入/P2P 客人互连（原服务 403）、实际断线重连握手、phase-05 服务器签发临时 ID、两名玩家互看昵称/外观、真实 GPU/真机、`/api/skin`、管理员公告轮询、旧 `mcjs-room-key`、手机安全区（K-48）。
- 状态：**已实现、已测试、验收结束；代码已提交 `025cba8` 并推送；docs 收尾为当前 HEAD；F-1 与 BLOCKED 项留 phase-05。**

## phase-02 取消皮肤、装饰和多人游戏解锁机制 — 2026-11-12 — 提交 `a9dc47b`（代码）+ docs 收尾

> 代码提交 `a9dc47b`；docs 收尾为当前 HEAD（见 `git log -1`）。工作区已干净；未推送/未合并。

- 新增文件：`docs/phases/phase-02-unlock-removal/PLAN.md`、`TEST_REPORT.md`、`HANDOFF.md`
- 删除文件：无
- 修改文件（5）：
  - `js/capes.js`：`Capes.unlocked()` 只校验 id，全部披风（普通/管理员/活动）开放；删除 `evOwned` 与 `Account.data.super` / `Account.has('anim'|'static')` 判定；`Capes.of()` 不再置空未解锁披风，改读 `Skins.look()`；注释更新。
  - `js/cosmetics.js`：`owned()` 返回全部 8 个装饰 id、`has()` 对已知 id 为 true；`lookOf()` 不再按账号拥有列表过滤帽子/宠物/前缀。
  - `js/skins.js`：预设皮肤取消 `own` 过滤（18 款全显示）；正版皮肤取消 `Account.has('skin')`；新增 `mcjs-look` 本地外观存储（`Skins.look()` / `Skins.saveLook()`）；无账号可保存，登录时接管一次账号外观，登录状态保存仍同步 `Account.update({skin})`；衣柜 `dirty` 改为保存快照比较；移除 `Account.loadGate()` 调用。
  - `js/account.js`：删除登录/每次访问的 `checkUnlocks()` 调用；账号界面删除“三连/关注”状态行；账号界面不再加载 gate；账号模块保留到 phase-03。
  - `js/onboard.js`：更新“这个版本有什么不一样”和更新内容里“三连/关注解锁”的旧文案。
- 未改：`index.html`（脚本仍 88）、`js/net.js`、`js/p2p.js`、`js/checkin.js`、`js/save.js`、`js/ui.js`、服务器/协议/资源。
- 文档：
  - 修改：`docs/ARCHITECTURE.md`、`CHANGELOG.md`、`DECISIONS.md`、`KNOWN_ISSUES.md`、`PROJECT_SPEC.md`、`START-HERE.md`、`STATUS.md`、`docs/testing/regression-checklist.md`
  - 新增：`docs/phases/phase-02-unlock-removal/PLAN.md`、`TEST_REPORT.md`、`HANDOFF.md`、`ACCEPTANCE.md`
  - 历史注记：`docs/phases/phase-01-menu-cleanup/HANDOFF.md` 顶部注明管理员款口径已被 ADR-014 取代；`TEST_REPORT.md` 注明末影龙结局已由 phase-02 补测通过
- 关键函数/状态变化：`Capes.unlocked`、`Capes.of`、`Cosmetics.owned/has/lookOf`、`Skins.lookOf/look/saveLook`、`WardrobeScreen.saveLook`；新增 localStorage 键 `mcjs-look`；`Account.unlocks` 不再参与外观判断。
- 关键行为变化：全部外观（含 `adm*` 与活动款）无需账号/关注/三连/识别码；游客可保存/恢复外观；多人入口保持 1-A 直接放行，邀请码/房间服务校验不变。
- 修改原因：用户 phase-02 指令；PROJECT_SPEC §6 第 9/10 项；ADR-014 取代 ADR-011 第 3 项“管理员款隐藏”。
- 验证：
  - 92 个 `.js` 全量 `node --check` 通过；`git diff --check` 通过；脚本数 88 不变
  - 无头 Edge 157 + SwiftShader：**27/27 PASS**；18 皮肤、23 披风、3 帽子、1 宠物、1 前缀全部可选/预览/渲染
  - 游客保存外观 → 刷新恢复；模拟账号外观接管；登录保存 stub 验证
  - 未登录多人界面直接打开；空邀请码拒绝、有效邀请码才 `joinRoom`
  - 末影龙通关结局补测 **8/8 PASS**（真实流程到 `CreditsScreen` 并返回主世界）；发现 `renderDist=4` 时返回传送门不生成的边界问题 K-41（未修复）
  - `game.errLog` 结束为空；无 JS 异常；控制台仅外部服务 403（K-02/K-40）
  - 截图/结果：`D:\ds\REA\_work\phase02-*`
- 未验证：真实 GPU/真机、真实登录/Mojang 查询、真实房间加入（原服务 403）、管理员披风服务端校验、签到活动领取。
- 新发现：K-41（低渲染距离下末地返回传送门不生成，未修复，超出本阶段范围）。
- 状态：**已实现、已测试、验收结束、已提交 `a9dc47b`；docs 收尾为当前 HEAD**。

## phase-01 主菜单清理 — 2026-11-06 — 提交 `15154bd`（代码）+ docs 收尾

> phase-01 已验收；代码提交 `15154bd`，文档收尾为当前 HEAD（哈希见 `git log -1`）。

- 新增文件：`docs/phases/phase-01-menu-cleanup/PLAN.md`、`TEST_REPORT.md`、`HANDOFF.md`
- 删除文件：`js/news.js`、`js/telemetry.js`
- 修改文件（18）：
  - `index.html`：删除 head 内 Toy 性能上报脚本、启动页脚、`js/news.js`/`js/telemetry.js` 引用、`#bootnote` CSS；脚本数 90 → 88
  - `js/onboard.js`：删除 `AgreementScreen`/`LEGAL` 与 `PlayerKindScreen`/`PLAYER_KINDS`；首启从画质设置开始，等标题世界就绪后再打开
  - `js/game.js`：新世界默认关教程（`meta.tutorial ?? -1`）；`GAME_BUILD` 从删除的 telemetry.js 移到这里
  - `js/extras.js`：小地图/死亡点不再依赖 `playerKind`
  - `js/screens.js`：删除标题登录/反馈/解锁入口与底部 B 站文案；删除选项遥测/制作人员入口；删除暂停反馈入口
  - `js/cloudsave.js`：删除标题底部「登录后可以联机…」提示
  - `js/social.js`：内容检查只包裹 `ReportScreen`
  - `js/account.js`：删除 `UnlockScreen`、解锁入口/特效、`allUnlocked`、`online` 解锁状态；`onlineGate()` 直接放行（1-A）
  - `js/net.js`：删除 gate 错误里的 `UnlockScreen` 回退
  - `js/skins.js`：删除解锁按钮与公告礼物跳转；锁定披风不再打开解锁界面
  - `js/checkin.js`：签到入口不再依赖公告吊牌位置
  - `js/capes.js`：更新解锁/公告相关注释
  - `js/ui.js`：删除 `UnlockSparks` 绘制
  - `js/p2p.js`、`js/render.js`、`js/save.js`、`js/touch.js`、`js/toy.js`：移除遥测计数、纹理自检、DB 记录与导航/全屏计数
- K-27 后续：删除 `js/telemetry.js` 与全部 `Telemetry` 调用/包装；`GAME_BUILD` 移到 `js/game.js`；`js` 92 个、`index` 88 个脚本
- 文档：
  - 修改：`docs/ARCHITECTURE.md`、`CHANGELOG.md`、`DECISIONS.md`、`KNOWN_ISSUES.md`、`PROJECT_SPEC.md`、`START-HERE.md`、`STATUS.md`
  - 新增：`docs/phases/phase-01-menu-cleanup/PLAN.md`、`TEST_REPORT.md`、`HANDOFF.md`
  - 删除：`docs/phases/phase-01-menu-cleanup/.gitkeep`
- 关键函数/状态变化：删除 `AgreementScreen`/`PlayerKindScreen`/`UnlockScreen`/`FeedbackScreen`/`TelemetryScreen`；`onlineGate()` 直接放行；新世界 `tutorial=-1`；`playerKind`/`legalV`/`Telemetry` 移除；`GAME_BUILD` 移到 `js/game.js`；`ReportScreen` 内容检查保留。
- 关键行为变化：首启两屏消失；公告/反馈/遥测/制作人员/协议入口消失；标题无登录与 B 站文案；多人不再要求账号/解锁；新世界默认无教程。
- 修改原因：按用户 phase-01 冻结清单删除主菜单旧平台/解锁/公告/反馈/遥测入口；K-27 独立验收要求整体移除遥测；不进入 phase-02。
- 验证：
  - 92 个 JS 全量 `node --check` 通过
  - 无头 Edge 156 + SwiftShader：首启 `QualityScreen`，标题 `TitleScreen`，0 个 `game.errLog` 错误
  - 创建世界 `play`、61 区块、`tutorial=-1`；暂停菜单无反馈；多人入口直接进入 `MultiplayerScreen`；衣柜打开正常
  - 静态服务器 88 个脚本全部 200，`js/news.js`/`js/telemetry.js` 404 且不再请求；无 `/api/telemetry`
- 未验证：真实 GPU/真机、登录后的账号界面、签到、结局 `CreditsScreen` 实机触发、多人服务器

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
