# phase-05 自建服务器 · 交接（HANDOFF）

- 日期：2026-11-12
- 状态：**已验收（2026-11-12）；代码 `817bad3`；docs 收尾为当前 HEAD**
- 代码版本：phase-05 代码提交 `817bad3`（`server/index.mjs` 的 `VERSION=0.5.0`；基线 `3b8b2e0`）
- 仓库：`D:\ds\REA\opusmc`
- 分支：`develop`（跟踪 `origin/opusmc-integration`；未新建/切换/重置）
- 起点：`3b8b2e0`（phase-04 docs 收尾）；phase-04 代码 `553ceed`
- 工作区：phase-05 代码 `817bad3`；docs 收尾为当前 HEAD；35 个本阶段文件（13 修改 + 2 删除 + 20 新增）；24 个既有 JS 仅做 CRLF→LF 归一
- 远程：推送目标 `origin/opusmc-integration`；未合并、未强推、未打标签

## 1. 本阶段目标

在不依赖 Bilibili/Toy 或任何外部游戏平台的前提下，让多人世界运行在项目所有者自己的 Windows 电脑上：

- 网页静态资源、房间、WebSocket、临时玩家 ID、邀请码、多人世界、状态同步；
- 服务端存档、备份、状态监测、日志、一键启动与正常关闭；
- 客户端负责 WebGL2 渲染/摄像机/UI/输入/本地表现；不把 DOM/Canvas/Renderer 搬进服务器；
- 不新建账号/注册/登录/身份数据库；旧 `NetClient`/`RoomService`/`p2p` 保留为遗留路径。

## 2. 实际完成情况

### 2.1 服务端（`server/`，零 npm 依赖，9 个 `.mjs`）

| 文件 | 内容 |
|---|---|
| `server/index.mjs` | 入口：配置、HTTP、WS、`RoomManager`、20 TPS tick、信号/正常关闭、pid；关闭时先保存房间再清理 HTTP 连接 |
| `server/config.mjs` | `config.json` 读取/校验、相对路径解析、BOM 容忍、`OPUSMC_PORT`/`OPUSMC_HOST` 覆盖 |
| `server/log.mjs` | JSONL 日志、按日文件、保留天数、敏感键脱敏 |
| `server/storage.mjs` | 原子写、每房 `world.json`、备份/保留、损坏文件回退、管理令牌、pid |
| `server/ws.mjs` | 零依赖 RFC 6455：握手、掩码、分片、ping/pong、close、大小/连接/心跳限制 |
| `server/protocol.mjs` | 昵称/房间名/聊天清洗、位置/状态/方块/方块实体/掉落物/pstate 校验 |
| `server/blockids.mjs` | 从 `js/blockdata.js`/`js/blocks.js` 读取全部 **1257** 个合法方块 ID（含动态花朵/羊毛/玻璃/混凝土表）；未知 ID 拒绝 |
| `server/rooms.mjs` | 房间生命周期、邀请码、临时 ID、会话令牌、权限、限流、同步、快照、tick、存档 |
| `server/http.mjs` | 静态白名单、ETag/304、缓存、安全头、`/healthz`、`/api/status`、本机管理接口 |
| `server/config.json` | 默认配置（无密钥） |
| `server/README.md` | Windows 部署/配置/存档/备份/安全/排查 |
| `server/stop.ps1` / `server/status.ps1` | 正常停止 / 运行状态（支持 `-Config`） |
| 根目录 `start-server.bat` / `stop-server.bat` | 一键启动 / 正常关闭 |

能力：静态页面、房间/邀请码、WebSocket、临时身份、世界状态（seed + 方块覆盖层 + 方块实体）、
玩家/物品同步、世界时间、服务端存档/备份、`/healthz`/状态、JSONL 日志、启动/停止。

### 2.2 客户端（`js/mp.js` + 最小接入）

- `MPServer`：地址（同源/`NET_CONFIG.server`/`mcjs-mp-server`）、`/healthz`、创建/加入/恢复、邀请链接。
- `MPClient`：WebSocket、临时 ID/会话令牌、`srv~<code>` 世界、增量应用、玩家/物品镜像、聊天、
  世界时间、自动重连、方块实体差异上报、离开/关闭、`pstate` 上报。
- `MPClient.onClose(ws)` 只处理当前 socket；旧 socket 的 open/message/error/close 忽略。
- `Game.dropItem` 4.5 格内交给服务器（服务器阈值 6，留位置延迟余量），更远保持本地。
- 界面：`MPServerScreen`、`MPCreateScreen`、`MPRoomScreen`；`MultiplayerScreen` 增加自建入口；
  `PauseScreen` 在房间内增加“房间…”；`netconfig.js` 增加 `server: ''`。
- `index.html` 87 个脚本；`js/` 91 个 `.js`；`js/mp.js` 必须排在 `js/p2p.js` 之后。
- 单人 IndexedDB、旧 `NetClient`、`p2p.js` 的 `LocalHost/LocalGuest` 保留；服务器世界使用 `srv~` 前缀，
  不写入单人存档。

### 2.3 服务端权威边界（准确表述）

服务器权威：

- 房间生命周期、邀请码、临时玩家 ID、会话令牌、房主/权限；
- 方块覆盖层（玩家动作窗口内的方块改动）、方块实体、玩家实体快照（校验后接受）、掉落物、世界时间、存档；
- 基本移动速度/距离/界内/频率检查；方块距离/频率/结构检查；聊天/名称/协议校验。

客户端本地（本阶段明确不做服务端模拟）：

- WebGL2 渲染、摄像机、UI、输入、动画；
- 地形确定性生成（服务器只存 seed + 改动）；
- 生物 AI/实体（**不同步**）；
- 玩家物理/背包/生命（服务器只保存 `pstate` 供恢复，不作为跨玩家权威）；
- 红石/流体/随机刻（本地；只有玩家 break/place/use 动作窗口内、靠近玩家的改动会同步）。

因此本阶段是“基本服务端权威 + 共享世界覆盖层”，不是完整无头 Minecraft 模拟。
详见 `docs/ARCHITECTURE.md` §14、`docs/DECISIONS.md` ADR-018/019、`docs/KNOWN_ISSUES.md` K-67…K-80。

## 3. 运行方式

```powershell
cd D:\ds\REA\opusmc
.\start-server.bat
# 或 node server\index.mjs
# 浏览器打开 http://127.0.0.1:8080/
```

- 单机静态服务器仍可用：`node scripts\serve.mjs`（8080）——没有 WebSocket/房间，不能自建多人。
- 停止：`.\stop-server.bat`（推荐）或服务器窗口 `Ctrl+C`。
- 状态：浏览器 `/healthz`，或 `server\status.ps1`。
- 局域网：`server/config.json` 的 `host` 改为 `0.0.0.0`，防火墙放行端口；本阶段不做公网/TLS。

## 4. 测试结果

详见 `TEST_REPORT.md` 与 `ACCEPTANCE.md`。

| 套件 | 结果 |
|---|---|
| 服务端集成 | **62 PASS / 0 FAIL** |
| 双浏览器多人 E2E | **18 PASS / 0 FAIL**（最近一轮无 `chunk stall`；此前轮次 B 曾一次已知 K-39） |
| 单人回归 | **6 PASS / 0 FAIL** |
| 修复 F-A…F-F | **F-A 1257/1257 + 19/19 + 3/3；F-B 7/7；F-C 18/18；F-D 35/35；F-E/F-F 6/6** |
| 晚加入/刷新恢复 | **7 PASS / 0 FAIL** |
| 活动玩家关闭 | **7 PASS / 0 FAIL** |
| 静态语法 | 91 JS + 9 server mjs 全部 `node --check`；87 页面脚本 |
| 启动/停止/状态/端口占用 | 实测通过（有脏房间 + 活动连接 3 轮停止均 0.7s 退出 0） |
| 旧 `scripts/serve.mjs` | 仍可提供页面与 `js/mp.js`，不暴露 `server/config.json` |

证据：`D:\ds\REA\_work\phase05-*`。真实局域网双设备、公网、TLS、长时间运行、压力、真实设备、创建/消息限流、
心跳/连接上限的专项测试**未测**。

## 5. 关键技术决策与理由

1. **零依赖 Node 服务端 + 自写 RFC 6455**：保持“解压即运行、无需 npm install”，适合 Windows 一键启动；
   不引入 `ws`（ADR-011 只是允许，不是必须）。
2. **不把 `Game`/DOM/Canvas 搬进服务器**：完整 `game.js` 依赖 DOM/渲染；服务器只跑房间/世界覆盖层/
   玩家与物品状态/存档，风险可控。
3. **服务器 seed + 方块覆盖层**，而不是传完整地形：节省内存/存档/带宽；客户端按相同 seed 生成。
4. **临时 ID + 哈希会话令牌**：无账号；断线/刷新 120 秒内恢复；服务端只存 SHA-256。
5. **邀请码只由服务器生成**（8 位、去易混字符、服务器唯一）；不公开房间列表；加入/创建按 IP 限流。
6. **房主规则**：短暂断线保留房主；主动离开/被移出/会话过期时转移；房主可关房。
7. **只同步玩家动作窗口内的方块改动**：避免把本地随机刻/流体/红石产生的全部改动上传。
8. **方块 ID 精确匹配客户端生成数据**：含动态颜色/花朵表（1257 个），未知 ID 拒绝；服务端与客户端必须同版本部署。
9. **方块实体差异上报**：客户端每 500 ms 最多发 2 条 `be`，排除 `open/lid/viewers`；晚加入/继续恢复快照。
10. **关闭顺序**：先停止接新连接并保存房间，再清空 HTTP/WS；8 秒强制退出仅作最后保护。
11. **管理接口本机回环 + 令牌**；数据目录不在静态白名单；日志不记录令牌。

## 6. 当前 Git 与验收

| 项 | 值 |
|---|---|
| 分支 | `develop` |
| HEAD | phase-05 代码 `817bad3`；docs 收尾为当前 HEAD |
| 本阶段 | **已验收（2026-11-12）；代码 `817bad3`；docs 收尾为当前 HEAD** |
| 工作区 | 35 个本阶段文件已提交；24 个行尾归一文件；无 stash、无临时分支、无 staged 变更 |
| 远程 | 推送目标 `origin/opusmc-integration`；未合并、未强推、未打标签 |

本阶段提交文件：

- 新增：`server/*`（9 个 mjs、`config.json`、`README.md`、`stop.ps1`、`status.ps1`）、`js/mp.js`、
  `start-server.bat`、`stop-server.bat`、`docs/phases/phase-05-server/{PLAN,TEST_REPORT,HANDOFF,ACCEPTANCE}.md`
- 修改：`index.html`、`js/net.js`、`js/netconfig.js`、`js/screens.js`、`.gitignore`、`README.md`、
  `docs/{STATUS,ARCHITECTURE,DECISIONS,KNOWN_ISSUES,PROJECT_SPEC,START-HERE,CHANGELOG}.md`
- 删除：`server/.gitkeep`、`docs/phases/phase-05-server/.gitkeep`
- 24 个既有 JS：仅 CRLF→LF（Git 内容无 diff），用于消除 `git add -A` 的无关行尾提交风险。

phase-05 代码已提交 `817bad3`；docs 收尾为当前 HEAD。不要改写已提交历史、不要强推。

## 7. 下一阶段前置条件（phase-06 双存档）

1. phase-05 已提交（代码 `817bad3` + docs 收尾）；推送目标 `origin/opusmc-integration`；不要改写历史。
2. phase-06 要区分单人 IndexedDB `mc-js-clone` 与服务器 `srv~` 世界管理；**不要**把服务器世界写进单人 IndexedDB。
3. 保留 `js/mp.js` 对 `DB.getWorld/putWorld/getChunk/putChunks/chunkKeys` 的 `srv~` 拦截；不要在 phase-06 破坏
   `js/mp.js` 与 `js/p2p.js` 的包装顺序。
4. 服务器世界是 `seed + 覆盖层`；世界生成版本升级会使旧房间地形基础不一致（K-73），phase-06 不做跨版本迁移。
5. 旧 `mcjs-room-key`、`/api/skin`、管理员公告、旧房间服务仍是遗留（K-36/K-40/K-44/K-45/K-63/K-77）；
   phase-05 没有替换它们。
6. K-39 `chunk stall` 仍属 phase-07；真实 LAN/公网/TLS 属 phase-08。
7. 不自动进入 phase-06；等待用户明确指令，且不得提前修改 phase-06 功能。

## 8. 下一阶段需要特别检查的文件/依赖

| 文件/依赖 | 检查点 |
|---|---|
| `js/mp.js` | `Game.tick`/`World.setBlock`/`DB` 包装在 `p2p.js` 之后；`srv~` 与单人存档隔离；`onClose(ws)` 身份校验 |
| `js/p2p.js` | 未修改；`LocalHost/LocalGuest` 仍工作；`p2pMirror` 标记被 MP 复用（只用于不存档） |
| `js/net.js` | `MultiplayerScreen` 只加入口；`rows()` 减少 1 行；旧房间服务逻辑未改 |
| `js/screens.js` | `PauseScreen` 在自建房间时增加“房间…”并调整退出按钮；旧 `g.net` 路径不变 |
| `index.html` | 87 个脚本；`js/mp.js` 在 `p2p.js` 之后；启动总数 87 |
| `js/netconfig.js` | `server: ''` 同源；`rooms` 仍指旧服务；`announce=false` |
| `server/blockids.mjs` | 依赖同版本 `js/blockdata.js`/`js/blocks.js`；升级客户端后重跑 1257 对照 |
| `server/rooms.mjs` | 权限/房主/限流/存档链（`_saveChain`）是核心；改动需跑 62 项集成测试 |
| `server/ws.mjs` | 自写帧协议；不要放宽掩码/大小检查 |
| `server/index.mjs` | 关闭顺序：保存房间优先；管理员 shutdown 响应 `Connection: close` |
| `server/data/` | 不提交、不静态公开；运行数据，备份/恢复前停服务器 |
| `scripts/serve.mjs` | 仍是无 WebSocket 单机静态服务器；不要把 `server/data` 放进去 |
| Windows 脚本 | `.ps1` UTF-8 **带 BOM**；`.bat` ASCII/CRLF；不要交叉改行尾 |

## 9. 已知遗留 / 风险

- 服务端不同步生物、不模拟红石/流体/战斗；多人对局里这些仍是各客户端本地结果（K-67、K-69）。
- 服务器世界存档是 seed + 覆盖层；世界生成版本变化会导致旧房间地形基础不一致（K-73）。
- 客户端 `pstate`（背包/生命）由客户端自报，只用于自己恢复，不用于跨玩家校验（K-74）。
- 掉落物不模拟地形碰撞，基本停在掉落点（K-72）。
- 无 TLS；局域网 HTTP 明文，邀请码/令牌可能被同网段嗅探；不要公网暴露（K-70）。
- 浏览器 E2E 使用创意模式避免本地生物导致测试角色死亡；真实生存多人长时间对局未测。
- 旧房间服务仍被旧多人界面调用；自建入口不依赖它（K-63、K-77）。
- 无真实局域网双设备、无 10 人压力、无长时间运行、无真实 GPU/移动端（K-71）。
- 创建/消息限流、心跳/连接上限、房间界面按钮实际点击、邀请链接自动打开仍未专项测试（F-G）。
