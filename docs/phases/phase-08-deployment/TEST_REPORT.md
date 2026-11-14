# phase-08 网络部署 · 测试报告（TEST_REPORT）

- 日期：2026-11-13（2026-11-14 增补真实设备测试）
- 阶段：phase-08 网络部署（模式 A LAN 优先；模式 B 外网）
- 分支：`develop`（未切换/未重置）
- 起点：HEAD `221d4ea`（phase-07 docs 推送记录）；phase-07 代码 `508fcc8`
- 结论：**验收结束（真实设备用户实测，2026-11-14）；代码 `ef8c540`；docs `d8b237a`/`597a15f`；
  已推送 `origin/opusmc-integration`。模式 A/B（Cloudflare Tunnel）核心回归通过；真实手机 LAN 与蜂窝公网测试通过；
  Caddy 为备用模板，未运行验证，不属于正式验收路径；Windows 防火墙脚本实际添加/删除、Caddy、
  公网长期/10 人仍未测。**

## 1. 环境

| 项 | 值 |
|---|---|
| 系统 | Windows（`Windows 10/11`） |
| Node.js | v26.13.0 |
| 浏览器 | Chrome 157.0.8103.51（headless，SwiftShader）；Edge 157.0.4341.46 可用 |
| 局域网 | WLAN `192.168.1.18/24`，网关 `192.168.1.1` |
| Windows 网络配置文件 | **Public（公用）**（影响防火墙放行，见 §8） |
| 公网 | 无可用公网 IPv4/域名；测试初始无第二台物理设备（2026-11-14 用户用真实手机补测）；未配置路由器端口转发 |
| 公网隧道 | Cloudflare quick tunnel，Cloudflare 边缘 `LAX`；临时地址（已失效） |
| 测试端口 | LAN/协议 18110；默认本机 8080；`start-lan.bat` 包装 18112；回归 18080 |

## 2. 本阶段改动

### 服务端

- 新增 `server/netutil.mjs`：`cleanIp` / `isLoopback` / `forwardedIp` / `clientIp`。
- `server/http.mjs`：管理接口同时检查直连回环与转发头；代理后的远程请求 403。
- `server/ws.mjs`：`conn.ip` 使用 `clientIp(req)`，代理后按真实客户端 IP 限流/记录日志。
- `server/index.mjs`：`VERSION=0.8.0`；LAN 主地址优先有效私有 IPv4，`127.0.0.1` 标为“仅本机访问”。
- `server/config.mjs`：新增 `--lan`（绑定 `0.0.0.0`）。
- `server/rooms.mjs`：`hello` / `/healthz` 的版本字符串改为 `phase-08`。

### 启动与部署资产

- 新增 `start-lan.bat`（ASCII/CRLF；`node server\index.mjs --lan`）。
- 新增 `deploy/windows/firewall-lan.ps1`（管理员；默认只放行专用网络；`-Remove`；`-IncludePublic` 显式选择）。
- 新增 `deploy/Caddyfile`（HTTPS/WSS 反代；管理/数据路径 404；覆盖转发头）。
- 新增 `deploy/cloudflared/config.yml.example`（命名隧道模板）。
- 新增 `deploy/README.md`。

### 文档

- 新增 `docs/deployment/LAN.md`、`docs/deployment/REMOTE.md`。
- 新增本目录 `PLAN.md`、`TEST_REPORT.md`、`HANDOFF.md`。
- 更新 `README.md`、`server/README.md`，以及项目级文档（见 HANDOFF）。

## 3. 模式 A：局域网部署

### 3.1 服务端与地址

> 初测使用 18090/18091；验收修复后复测使用 18110/18112，结果见 §12；两轮结论一致。

| 测试 | 命令/方法 | 结果 |
|---|---|---|
| `--lan` 生效 | `node server\index.mjs --config <lan> --lan` | 监听 `0.0.0.0:18090`；启动日志 `lanUrls:["http://192.168.1.18:18090/"]` |
| `start-lan.bat` 包装 | `cmd /c start-lan.bat`（`OPUSMC_PORT=18091`） | 启动成功；打印 `http://192.168.1.18:18091/`；`/healthz` 200；`stop.ps1` 正常关闭 exit 0 |
| LAN 地址 HTTP | `curl http://192.168.1.18:18090/` | 200，返回游戏首页 |
| LAN `/healthz` | `curl http://192.168.1.18:18090/healthz` | 200，`ok:true`，`version:phase-08`；不含 `stats`/`perf` |
| 正常关闭 | `server\stop.ps1 -Port 18090 -Config <lan>` | “服务器已正常关闭”，exit 0，pid 文件删除 |
| 状态脚本 | `server\status.ps1 -Port 18090 -Config <lan>` | 200；显示房间/玩家/性能；LAN 模式可用 |

### 3.2 协议（`phase08-net-test.mjs`，LAN 地址）

> 初测 18090；修复后 18110 复测 22/22，见 §12。结果：**22/22 PASS**（`_work/phase08-accept-net-lan.json`）。

覆盖：

- WebSocket `ws://192.168.1.18:18090/ws` 打开、hello、服务端版本 `phase-08`；
- 创建房间得到 8 位邀请码；世界 seed 与请求一致；
- 第二客户端用邀请码加入；两客户端收到**同一 room code / 同一 seed**；
- 房间人数 2；
- 方块编辑双向广播（`[2,80,0,1,0,0]` 与 `[3,80,1,2,0,0]`）；
- LAN 地址访问 `/api/admin/status`：无令牌 403、**带正确令牌 403**；
- 本机回环 + 令牌：200；
- `/docs`、`/server`、`/.git`、`/scripts` 经 LAN 全部 404/400；
- 无客户端 WebSocket 错误。

### 3.3 浏览器 E2E（LAN）

`PHASE08_BASE=http://192.168.1.18:18090/ node phase08-browser-test.mjs lan`

结果：**15/15 PASS**（`_work/phase08-browser-lan-result.json`）。

- 两个独立 Chrome profile 从 `http://192.168.1.18:18090/` 加载；
- `MPServer.base()` / `location.origin` = 同一 LAN 地址；
- 邀请链接 = `http://192.168.1.18:18090/?room=...&server=1`；
- A 创建（seed 1234567）、B 加入；双方 `srv~<code>`、同 seed、players=2、mirrors=1；
- 玩家位置同步（`[2.5,123,0.5]`）；
- 方块同步（A 放 `[4,123,0]`，B 读到 1）；
- 聊天 `<Alice> hello from Alice` 到达 B；
- 房间界面显示邀请码、2/4 人、复制邀请链接/离开/关闭；
- 无未捕获异常、无 mixed-content；
- 截图：`_work/phase08-lan-room.png`。

## 4. 模式 B：外网访问（HTTPS + WSS）

### 4.1 公网入口

- Cloudflare quick tunnel → `http://127.0.0.1:18090`；
- 公网 URL：`https://traditions-lectures-generators-margaret.trycloudflare.com`
  （**临时地址，测试后已停止，不能长期使用**）；
- 公网 HTTPS `/`、`/healthz`、`/js/mp.js` 均 200。

### 4.2 协议（`phase08-net-test.mjs`，公网 HTTPS）

结果：**22/22 PASS**（`_work/phase08-net-public-result.json`）。

覆盖与 LAN 相同的 22 项，其中：

- `wss://.../ws` 握手成功；
- 创建/加入同一房间、同一 seed、方块双向同步；
- 公网访问 `/api/admin/status`：无令牌 **403**、**带正确令牌仍 403**；
- 本机回环 + 令牌 200；
- `/server/config.json`、`/server/data/admin-token.txt`、`/docs/STATUS.md`、`/.git/config`、
  `/scripts/serve.mjs` 全部 404；
- 无 WebSocket 错误。

### 4.3 浏览器 E2E（公网 HTTPS）

`PHASE08_BASE=https://...trycloudflare.com/ node phase08-browser-test.mjs public`

结果：**15/15 PASS**（`_work/phase08-browser-public-result.json`）。

- 页面 `location.protocol = https:`；
- `game.mpClient.ws.url = wss://.../ws`；
- 邀请链接 = `https://.../?room=...&server=1`；
- 两客户端同 seed、players=2、位置/方块/聊天同步；
- 无 mixed-content、无未捕获异常；
- 截图：`_work/phase08-public-room.png`。

### 4.4 独立外部节点

check-host.net 的 HTTP 检查（多国节点）：

| 路径 | 结果 |
|---|---|
| `/` | 德国、以色列、伊朗、摩尔多瓦：**4/4 200** |
| `/healthz` | 波兰、俄罗斯、瑞典：**3/3 200**；乌克兰 1 节点连接超时 |
| `/js/mp.js` | 德国、哈萨克斯坦、波兰：**3/3 200**；西班牙 1 节点连接超时 |

合计 **10 个外部节点 200**，2 个节点超时（公网正常波动）。修复后复测 `/` 与 `/healthz` 共 6 节点，
**5/6 200**（中国 1 节点超时），见 `_work/phase08-fix-external.json`。
证据：`_work/phase08-external-check.json`（修复前）、`_work/phase08-fix-external.json`（修复后）。

## 5. 安全测试（重点）

| 场景 | 期望 | 实测 |
|---|---|---|
| LAN 地址访问管理接口（无令牌） | 403 | 403 |
| LAN 地址访问管理接口（**带令牌**） | 403 | 403 |
| 本机回环 + 令牌 | 200 | 200 |
| 本机回环 + 伪造 `X-Forwarded-For: 203.0.113.7` + 令牌 | 403（源站不能把代理请求当本机） | 403 |
| 本机回环 + `X-Forwarded-For: 127.0.0.1` + 令牌（本地代理管理） | 200 | 200 |
| LAN 地址 + 伪造 `X-Forwarded-For: 127.0.0.1` + 令牌 | 403（LAN 客户端不能伪造） | 403 |
| 回环代理连接携带 `X-Forwarded-For: 203.0.113.7` | WS 日志 `ws_open ip=203.0.113.7` | 是（限流按真实 IP） |
| 公网管理接口（无/有令牌） | 403 | 403 |
| 公网静态/数据/文档/脚本/版本库 | 404 | 404 |

`server/netutil.mjs` 单元检查 **9/9 PASS**：IPv4-mapped、`[::1]:port`、`IPv4:port`、长 IPv6、
非法输入、XFF 取最后一项、CF-Connecting-IP、回环代理信任、LAN 伪造无效。

## 6. 回归

| 套件 | 结果 |
|---|---|
| phase-05 服务端集成 | **62/62 PASS** |
| phase-05 双浏览器 E2E | **18/18 PASS** |
| phase-05 单人回归 | **6/6 PASS** |
| phase-06 服务端双存档 | **22/22 PASS** |
| phase-06 浏览器双存档 | **31/31 PASS** |
| 页面脚本数 | 87（未变） |
| `js/*.js` / `server/*.mjs` / `scripts/*.mjs` `node --check` | 91 + 10 + 1，全部 PASS |

## 7. 静态与编码

- `js/` 91 个 `.js`；`server/` 10 个 `.mjs`（新增 `netutil.mjs`）；`scripts/` 1 个 `.mjs`。
- `start-lan.bat`：ASCII、CRLF、无 BOM（667 字节）。
- `server/status.ps1`：UTF-8 BOM + LF（未改动）。
- `git diff --check`：PASS（已跟踪文件）。
- 新增文本文件无行尾空白；`deploy/Caddyfile` 花括号 10/10 配平。
- `server/config.json` 仍是有效 JSON（Node `JSON.parse` 通过）。

## 8. 防火墙脚本

- 非管理员运行：输出“must run as Administrator”，exit 1（符合预期，未修改系统）。
- 本机 Windows 网络配置文件是 **Public**：脚本默认只放行 Private，会警告；
  可信家庭 Wi-Fi 需要把网络改为专用，或显式 `-IncludePublic`。
- 因当前会话非管理员且不应改系统防火墙，**没有实际添加/删除规则**；
  但**真实手机 LAN 已由用户实测通过**，说明当前系统已有的 `node.exe` Public 入站规则可用。
  脚本的实际规则添加/删除仍标 **NOT TESTED**。

## 9. 未测 / NOT TESTED

- **Windows 防火墙脚本实际添加/删除**（当前非管理员；网络为 Public；真实 LAN 已有 node.exe 规则可用）；
- **Caddy + 公网 IPv4 + 域名**：无公网 IPv4/域名，路由器端口转发未配置；Caddy 二进制下载被网络重置，
  未运行，`deploy/Caddyfile` 仅经人工检查，**NOT TESTED / BLOCKED**；Caddy 是备用模板，
  不属于本阶段正式验收路径；
- 公网长期稳定性、带宽、抖动、Cloudflare 在中国大陆的实际可达性；
- 10 人公网并发、DDoS/滥用防护、ACME 证书续期；
- 真实手机型号/OS/浏览器版本/GPU/发热/帧率/截图录屏（用户明确不提交）；
- `deploy/windows/firewall-lan.ps1 -IncludePublic` 与 `-Remove` 的实际防火墙效果。

## 10. 证据

| 内容 | 路径 |
|---|---|
| LAN 协议 22/22（修复后） | `_work/phase08-fix-net-lan.json` |
| 公网协议 22/22（修复后） | `_work/phase08-fix-net-public.json` |
| LAN 浏览器 15/15（修复后） | `_work/phase08-fix-browser-lan.json` |
| 公网浏览器 15/15（修复后第三次） | `_work/phase08-fix-browser-public.json` |
| 邀请链接一致性 8/8 | `_work/phase08-fix-invite-result.json` |
| 外部节点（修复后） | `_work/phase08-fix-external.json` |
| LAN 启动输出 | `_work/phase08-fix-startlan.txt` |
| 默认本机输出 | `_work/phase08-fix-local.txt` |
| LAN 房间截图 | `_work/phase08-lan-room.png` |
| 公网房间截图 | `_work/phase08-public-room.png` |
| 修复测试脚本 | `_work/phase08-fix-invite-test.mjs`；`_work/phase08-net-test.mjs`、`_work/phase08-browser-test.mjs` |
| 临时隧道日志 | `_work/bin/cf-fix.log`（临时地址已失效） |
| **真实手机 LAN/蜂窝** | `_work/phase08-real-device-evidence.txt`；服务器日志房间 `E7UDCMQT`（LAN 客户端）/`XF6BT4YQ`（蜂窝 IPv6 客户端）；`server/data/logs/`；用户未提供截图/录屏/型号/网络 |

## 11. 结论

- 模式 A：LAN 主地址为私有 IPv4、127 仅本机；邀请链接一致性 8/8；建房/加入、同世界、
  方块/聊天/玩家同步、管理接口边界均通过；**真实手机 LAN 用户实测通过**；
- 模式 B：Cloudflare Tunnel 的 HTTPS + WSS + 公网建房/加入/同步实测通过（浏览器前两次 quick tunnel
  资产流超时、第三次通过），管理接口/数据不可达；**真实手机蜂窝公网用户实测通过**；
- Caddy/端口转发：Caddy 仅备用模板，未运行验证，不属于正式验收路径；端口转发未配置、未实测；
- Windows 防火墙脚本实际添加/删除、Caddy、公网长期/10 人、手机型号/性能/截图仍未测；
- 用户未提供手机型号/网络/截图/录屏；真实设备结论为用户报告 + 服务器日志；
- 代码 `ef8c540`、docs `d8b237a`/`597a15f` 已推送 `origin/opusmc-integration`；未进入 phase-09。

## 12. 验收问题修复（2026-11-13）

修复上一轮独立验收发现的问题：

1. **LAN 主地址/邀请链接**：`server/index.mjs` 的 LAN 地址选择改为过滤回环/`0.0.0.0`/`169.254.*`，
   优先有效私有 IPv4；主输出改为 `游戏地址（局域网）`，`127.0.0.1` 标为“仅本机访问”。
   不再把回环地址作为 LAN 首要地址；未硬编码测试环境 IP。
2. **邀请链接一致性**：专项 8/8 覆盖 LAN 页面、两个不同邀请码、第一次建房、页面刷新、
   继续上次房间、第二次建房；所有邀请链接均为 LAN 地址。
3. **文档**：STATUS/START-HERE 文件数量修正为 14 个已修改（7 代码/说明 + 7 项目文档）+ 11 个新增；
   README 的“部署”标题引用改为“局域网/外网”两节；START-HERE 补充 phase-08 路径。
4. **公网验收范围**：Cloudflare Tunnel 明确为正式支持/验收路径；Caddy 保留为备用模板，
   未运行验证，不属于正式验收路径；文档不再宣称 Caddy 公网已通过。
5. **回归**：邀请链接 8/8、LAN 协议 22/22、LAN 浏览器 15/15、公网协议 22/22、公网浏览器 15/15
   （第三次）、phase-05 62/62 + 18/18 + 6/6、phase-06 22/22 + 31/31、静态检查全部通过。

**仍未解决/未测**：Windows 防火墙脚本实际添加/删除、Caddy/端口转发、公网长期稳定性/10 人、
手机型号/性能/截图；这些不改写为 PASS。

## 13. 真实设备测试（2026-11-14，用户报告）

用户报告两类真实手机测试均通过；用户明确不提交手机型号、OS/浏览器版本和网络信息。

| 测试 | 步骤 | 结果 | 服务器侧证据 |
|---|---|---|---|
| 手机 LAN | 同一 Wi-Fi；单人游戏、移动、转视角、放置、破坏、刷新重进 | **PASS（用户报告）** | 电脑侧 `192.168.1.18` 创建 `E7UDCMQT`；手机 LAN 私有地址 `192.168.1.9` 加入，2 名玩家 |
| 手机公网蜂窝 | 关闭 Wi-Fi，Cloudflare HTTPS；进入世界、渲染、移动、转视角、放置、破坏、刷新重进 | **PASS（用户报告）** | 电脑侧公网出口客户端创建 `XF6BT4YQ`；蜂窝 IPv6 客户端加入，2 名玩家 |

补充：

- 用户说明“PIN 验证”指 **Cloudflare quick tunnel 临时地址的邮箱验证**；这是 Cloudflare/外部流程，
  OpusMC 没有 PIN/邮箱验证功能（K-100），不写成应用功能。
- 未提供手机型号/OS/浏览器、截图/录屏、运营商；真实手机性能/GPU/发热/帧率未测。
- 服务器日志在 `server/data/logs/`；测试房间数据保留，不删除。
- 这两项把此前 BLOCKED 的“第二台物理设备/手机蜂窝”补测完成；不能外推为所有手机/所有网络都通过。
