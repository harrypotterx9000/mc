# phase-08 网络部署 · 计划（PLAN）

- 日期：2026-11-13
- 阶段：**phase-08 网络部署**（模式 A 局域网优先；模式 B 外网访问在其后）
- 仓库：`D:\ds\REA\opusmc`
- 分支：`develop`（不新建/不切换/不重置；不 force push）
- 起点：HEAD `221d4ea`（phase-07 docs 推送记录）；phase-07 代码 `508fcc8`
- 前置：phase-00…07 均已验收；phase-07 验收结束（2026-11-13）
- 约束：只做本阶段部署功能；不重写无关模块；不覆盖用户修改；不自动进入 phase-09

## 1. 任务与验收口径

### 模式 A：局域网部署（优先）

1. 用户电脑启动一个服务器进程。
2. 同一 Wi-Fi 下的手机/电脑都能打开页面。
3. **所有客户端访问同一个游戏地址**（包括电脑自己，不用 `127.0.0.1`）。
4. 能创建/加入多人房间。
5. 所有设备同步同一个世界（同一 `seed` + 服务器方块覆盖层/方块实体/玩家）。
6. 提供完整部署说明（启动、地址、防火墙、验证、排查、关闭）。

### 模式 B：外网访问（LAN 正常之后）

1. HTTPS（浏览器地址栏为 `https://`）。
2. WSS（页面内 WebSocket 为 `wss://`，由 HTTPS 页面同源推导）。
3. 合理的远程访问方案：反向代理（Caddy，需公网 IPv4 + 域名）或安全隧道
   （Cloudflare Tunnel，无需公网 IPv4 / 不做端口转发）。
4. 不暴露数据库与管理接口：`server/data/`、`/api/admin/*` 经公网不可达；
   反向代理使源站看到 `127.0.0.1` 时也不能绕过本机管理限制。
5. 说明家庭网络、公网 IPv4、NAT/CGNAT、端口转发的限制。
6. **未实际配置的端口转发不得标记为完成**。
7. 远程访问必须经过实际网络测试（公网 DNS + TLS + 公网入口到的真实往返）。

## 2. 明确不做（本阶段边界）

- 不做账号/注册/登录/身份数据库；不引入永久账号体系。
- 不改 WebGL2/渲染/地形/存档模型；不改 `mc-js-clone` 与 `srv~` 的边界。
- 不做公开房间列表、房间发现、服务器浏览器。
- 不配置/修改用户路由器，不做 UPnP、不做端口转发；不申请域名、不购买证书。
- 不把 Node 进程改造成通用 TLS/ACME 服务器；TLS 交由成熟反向代理/隧道终止。
- 不实现生产级 WAF/抗 DDoS/多机集群；不承诺公网长期可用。
- 不做 phase-09 全阶段验收，不自动进入下一阶段。

## 3. 设计

### 3.1 模式 A：LAN

- 服务器默认仍绑定 `127.0.0.1`（安全默认，不改变既有行为）。
- 新增 `node server\index.mjs --lan` 与根目录 `start-lan.bat`：绑定 `0.0.0.0`。
- 启动时枚举本机非回环 IPv4，打印**所有**可用的
  `http://<LAN-IP>:<port>/`，用户把同一个地址发给手机和电脑。
- 新增 `deploy\windows\firewall-lan.ps1`：管理员一次性放行 TCP 端口的
  **专用网络**入站；支持 `-Remove` 撤销；不自动改防火墙。
- 客户端 `MPServer` 以页面同源为默认服务器地址（现有行为），
  因此用 LAN 地址打开页面时 `ws://<LAN-IP>:<port>/ws` 自动正确。
- 邀请链接以页面/服务器地址生成（现有行为）；四台设备都从同一个 LAN 地址
  进入后，邀请码与链接一致。

### 3.2 代理感知的客户端身份（LAN + 公网都受影响）

反向代理/隧道会让源站看到 `127.0.0.1`，带来两个问题：

1. 管理接口的本机限制被绕过（源站以为是本机）。
2. 所有远程玩家共用一个限流桶（加入/创建/连接），多人同时进房会被误限流。

新增 `server/netutil.mjs`：

- `forwardedIp(req)`：按“最近代理最后追加”的规则取 `X-Forwarded-For` 最后一项；
  没有则取 `CF-Connecting-IP` / `X-Real-IP`；只接受合法 IP。
- `clientIp(req)`：**只有直连地址是本机回环时**才信任转发头；否则一律用 socket 地址。
  这样 LAN 客户端无法伪造 `X-Forwarded-For` 绕过限流/管理限制。
- 管理接口判定：直连必须回环，且（若有转发头）转发地址也必须是回环；
  否则 403。Cloudflare / Caddy 的远程请求即使源站 socket 是 `127.0.0.1` 也被拒绝。
- WebSocket 的 `conn.ip` 改用 `clientIp(req)`，限流/日志按真实玩家 IP。

### 3.3 模式 B：HTTPS/WSS

> 验收范围（2026-11-13 修复后）：**Cloudflare Tunnel 为正式支持/验收的公网路径**；
> **Caddy 为备用模板**，保留配置与文档，但未完成实际运行验证，**不属于正式验收通过的部署路径**。

两条路径，均不在 Node 内做 TLS：

1. **Cloudflare Tunnel（推荐，无需公网 IPv4、无需端口转发）**
   - `cloudflared tunnel --url http://127.0.0.1:8080` 快速隧道：`https://<随机>.trycloudflare.com`，
     TLS/WSS 由 Cloudflare 边缘提供；仅适合测试/临时使用。
   - 命名隧道 + 自有域名：`deploy\cloudflared\config.yml.example`；稳定、可配 Cloudflare Access。
2. **Caddy 反向代理（有公网 IPv4 + 域名时）**
   - `deploy\Caddyfile`：自动 HTTPS（ACME），`reverse_proxy 127.0.0.1:8080`，
     自动转发 WebSocket；`/api/admin/*`、`/server/*`、`/docs/*`、`/scripts/*`、`/.git/*` 直接 404；
     覆盖 `X-Forwarded-For`/`CF-Connecting-IP` 防止伪造。
   - 需要 DNS A/AAAA + 路由器端口转发 80/443 + Windows 防火墙；**端口转发不在本阶段配置**。

安全边界：

- `server/data`（世界/备份/日志/管理令牌）不在静态白名单，代理层再加一层 404。
- 管理接口：代理层 404 + 源站转发头校验 403（双层）。
- 管理令牌只在本机文件；不写日志；不通过页面下发。
- 公网玩家仍受房间密码（邀请码）、人数上限、消息/方块/移动校验约束。
- HTTPS 页面自动推导 `wss://`（`MPServer.ws()` 现有 `http→ws` 替换逻辑）。

## 4. 计划改动文件

### 服务端

- 新增 `server/netutil.mjs`（客户端 IP / 回环判断）。
- `server/http.mjs`：管理接口代理感知；转发头不改变静态白名单。
- `server/ws.mjs`：`conn.ip` 使用 `clientIp`。
- `server/index.mjs`：版本 `0.8.0`；启动打印 LAN 地址；`--lan` 说明。
- `server/config.mjs`：`--lan` 参数与帮助。
- `server/README.md`：LAN/远程部署入口、配置/边界更新。

### 启动与部署资产

- 新增 `start-lan.bat`（ASCII/CRLF）。
- 新增 `deploy/Caddyfile`。
- 新增 `deploy/cloudflared/config.yml.example`。
- 新增 `deploy/windows/firewall-lan.ps1`。
- 新增 `deploy/README.md`（短索引）。

### 文档

- 新增 `docs/deployment/LAN.md`（完整局域网部署说明）。
- 新增 `docs/deployment/REMOTE.md`（HTTPS/WSS、隧道/反代、NAT、限制）。
- 新增 `docs/phases/phase-08-deployment/{PLAN,TEST_REPORT,HANDOFF}.md`。
- 更新 `docs/STATUS.md`、`START-HERE.md`、`PROJECT_SPEC.md` §11.14、
  `ARCHITECTURE.md` §17、`DECISIONS.md` ADR-022、`KNOWN_ISSUES.md`（新增 K 项）、
  `CHANGELOG.md`、根 `README.md`（如涉及运行方式）。

## 5. 测试计划

| # | 测试 | 判定 |
|---|---|---|
| A1 | `--lan` 启动 | 监听 `0.0.0.0`；输出至少一个 `http://<LAN-IP>:<port>/` |
| A2 | LAN 地址 HTTP | 首页/`/healthz` 经 `192.168.1.18` 返回 200（不只 `127.0.0.1`） |
| A3 | LAN WebSocket | `ws://192.168.1.18:<port>/ws` 完成 hello/create/join |
| A4 | 同世界 | 两客户端 `welcome` 的 seed/spawn 相同；方块改动广播到另一客户端 |
| A5 | 管理接口（LAN） | 经 LAN IP 无令牌/有令牌均 403；本机回环 + 令牌 200 |
| A6 | 静态边界（LAN） | `/server/data/*`、`/docs/*`、`/scripts/*`、`/.git/*` 不可访问 |
| A7 | 浏览器 E2E（LAN） | 两个独立 Chrome profile 从 LAN 地址建房/加入/互相可见/方块同步 |
| B1 | 公网 HTTPS | `https://<tunnel>/` 200，页面标题/脚本正常 |
| B2 | 公网 WSS | `wss://<tunnel>/ws` hello/create/join/方块同步 |
| B3 | 公网管理接口 | `/api/admin/status` 无令牌与带令牌均 403（代理感知） |
| B4 | 公网静态边界 | `/server/data/admin-token.txt` 等 404 |
| B5 | 独立网络验证 | check-host.net 至少 3 个境外节点返回 200 |
| B6 | 浏览器 E2E（公网 HTTPS） | 两个独立 Chrome profile 经公网 URL 建房/加入/同步，无 mixed-content 错误 |
| C1 | 回归 | phase-05 服务端 62/62、双浏览器 18/18、单人 6/6；phase-06 22/22 + 31/31 |
| C2 | 静态 | 全部 `js/*.js`、`server/*.mjs` `node --check`；`git diff --check`；LF/BOM |

## 6. 风险与未测

- 本机没有第二台物理手机/电脑：LAN 只能从本机经 LAN 地址验证 + 浏览器 E2E；
  **第二台真实设备/手机**仍可能因 AP 隔离、访客 Wi-Fi、防火墙而不同，必须标注。
- 本机没有公网 IPv4/域名：Caddy 公网路径只能校验配置并标注 **NOT TESTED**；
  Cloudflare Tunnel 可做公网实际往返，但“第二张蜂窝网络/异地设备”未测。
- Quick Tunnel 无可用性保证、URL 每次变化；不能写成生产方案。
- 同一 NAT 后的公网玩家共用一个出口 IP，仍共享限流桶；可调配置。
- 隧道/反代会增加延迟与抖动；不承诺 20 TPS 在公网达到。
- 代理的 `X-Forwarded-For` 语义依赖代理正确覆盖；文档要求使用提供的 Caddyfile
  或 Cloudflare Tunnel，不建议自建不规范代理。
- 公网长期运行、DDoS、证书续期、动态 DNS 未验证。

## 7. 验收标准

1. 模式 A 的启动、同地址、建房/加入、同世界、管理接口边界均有可复现证据。
2. 模式 B 至少一条路径（Cloudflare Tunnel）完成公网 HTTPS + WSS + 管理接口不可达的实测。
3. Caddy/端口转发路径如实标注“未配置/未测试”，不写成已完成。
4. 文档包含完整步骤、限制与排查；所有未测项标 **NOT TESTED**。
5. 回归通过；不改无关模块；工作区只包含本阶段改动；等待用户验收，不自动提交。
