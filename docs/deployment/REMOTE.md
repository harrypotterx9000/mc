# 外网访问（模式 B）：HTTPS + WSS

前置：先按 [`LAN.md`](LAN.md) 让局域网正常。外网访问只是把**同一台服务器**安全地暴露出去，
不是另开一个世界；所有玩家仍然进同一个房间/世界。

> 本阶段在真实公网路径上实测的是 **Cloudflare Tunnel（quick tunnel）**：
> HTTPS 页面、`wss://` WebSocket、建房/加入/方块/聊天、管理接口 403、静态边界 404 都通过。
> **Caddy + 公网 IPv4 的路径没有可用的公网 IPv4/域名，未实测**；它是备用模板，
> 不属于本阶段正式验收通过的部署路径；端口转发也没有在本阶段配置。

## 0. 验收范围（本阶段）

| 方案 | 本阶段定位 |
|---|---|
| **Cloudflare Tunnel** | **正式支持并作为本阶段公网部署验收路径**；HTTPS/WSS、房间同步、管理接口隔离、数据边界已实测 |
| **Caddy + 公网 IPv4 + 域名** | **备用部署模板**；保留配置和文档，但尚未完成实际运行验证，**不属于本阶段正式验收通过的部署路径**；不得宣称 Caddy 公网部署已通过 |
| 路由器端口转发 | 本阶段**未配置、未实测**；不把未经配置的转发写成已完成 |

Caddy 模板的价值是给有公网 IPv4/域名的用户一个起点；使用前必须自行完成
`caddy validate`、DNS、80/443 转发和实际入站测试。

## 1. 先理解家庭网络

| 概念 | 说明 |
|---|---|
| 私网 IP | `192.168.x.x`、`10.x.x.x`、`172.16–31.x.x`，只在局域网内有效 |
| NAT | 路由器把公网 IP 的端口转发到内网某台电脑；需要“端口转发/虚拟服务器” |
| 公网 IPv4 | 运营商直接给路由器一个公网地址；才能做端口转发 |
| CGNAT | 运营商级 NAT：你家路由器的 WAN 口是 `100.64.x.x` / 私网地址，公网 IP 在运营商那里。**端口转发无效** |
| 动态 IP | 公网 IPv4 会变；需要 DDNS，或改用隧道 |
| 公网 IPv6 | 部分运营商提供；需要路由器防火墙放行，且玩家网络也要 IPv6 |

检查公网地址：

```powershell
curl.exe https://api.ipify.org
```

再登录路由器看 WAN/互联网 IP：

- 两者相同 → 可能是公网 IPv4（还要确认运营商没封 80/443）。
- 路由器 WAN 是 `100.64.x.x`、`10.x`、`172.16–31.x`、`192.168.x` → **CGNAT/私网，端口转发没用**。
- 两者不同但都不是私网 → 可能有多层 NAT，需要逐层确认。

**注意**：本阶段没有修改你的路由器，也没有配置任何端口转发。
没有实际配置并验证的东西，不能写成“已完成”。

## 2. 方案选择

| 方案 | 需要 | 优点 | 限制 |
|---|---|---|---|
| **Cloudflare Tunnel（正式验收路径）** | Cloudflare 账号 + 域名（稳定）；quick tunnel 可先不注册 | 不需要公网 IP、不需要端口转发；自动 HTTPS/WSS；隐藏家庭 IP | 依赖 Cloudflare；quick tunnel 是临时 URL；部分地区/网络访问 Cloudflare 可能不稳 |
| Caddy + 公网 IPv4 + 域名（备用模板） | 公网 IPv4（非 CGNAT）、域名、路由器 80/443 转发 | 自己控制；Caddy 自动证书/续期 | 要端口转发；CGNAT 不可用；家庭 IP 暴露；本阶段**未实测，不属于正式验收路径** |
| Tailscale / ZeroTier 等 | 每个玩家安装客户端 | 私密、无需公网 | 不是“打开网页就能玩”，每人要装客户端；本阶段未做 |

## 3. 方案 A：Cloudflare Tunnel（推荐，已实测）

### 3.1 安装 cloudflared

从 Cloudflare 官方发布页下载 Windows 版：

<https://github.com/cloudflare/cloudflared/releases/latest>

文件名是 `cloudflared-windows-amd64.exe`。也可以：

```powershell
winget install --id Cloudflare.cloudflared
```

把 `cloudflared.exe` 放在任意目录（不需要放进项目仓库）。

### 3.2 先启动游戏服务器

推荐默认只监听本机（Tunnel 从本机连过去）：

```powershell
start-server.bat
# 或 node server\index.mjs
```

如果你同时还要局域网联机，可以用 `start-lan.bat`；Tunnel 仍然连
`http://127.0.0.1:8080`，不冲突。

### 3.3 快速隧道（临时，5 分钟）

```powershell
cloudflared.exe tunnel --url http://127.0.0.1:8080
```

日志里会出现：

```
https://random-words-here.trycloudflare.com
```

把这个 **HTTPS** 地址发给远程玩家即可：

- 页面是 HTTPS，客户端会自动使用同源 `wss://.../ws`，不需要改代码。
- 关闭 cloudflared（Ctrl+C）后地址立即失效。
- 每次启动 URL 都不同；没有可用性保证；Cloudflare 可能限速。
- 只适合测试/临时开黑，不是长期方案。

### 3.4 命名隧道（稳定，需要域名）

1. 域名已接入 Cloudflare（NS 指向 Cloudflare）。
2. 登录并创建隧道：

```powershell
cloudflared tunnel login
cloudflared tunnel create opusmc
cloudflared tunnel route dns opusmc mc.example.com
```

3. 把 [`deploy/cloudflared/config.yml.example`](../../deploy/cloudflared/config.yml.example)
   复制到 `%USERPROFILE%\.cloudflared\config.yml`，替换：
   - `REPLACE_WITH_TUNNEL_ID`
   - `credentials-file` 的实际用户名/ID
   - `mc.example.com` 为你的域名

4. 运行：

```powershell
cloudflared tunnel run opusmc
```

5. 玩家打开 `https://mc.example.com/`。

可选：

- 开机自启：管理员运行 `cloudflared service install`（服务器电脑必须开机且联网）。
- 只给朋友用：在 Cloudflare Access 里加登录策略（会改变“无账号访客”的体验，默认不加）。
- 查看隧道状态：Cloudflare Zero Trust 控制台 → Networks → Tunnels。

### 3.5 安全边界（Tunnel）

- 源站只被 cloudflared 从本机访问；不需要在路由器开放 8080。
- 管理接口：**即使源站 socket 显示 127.0.0.1，带远程转发头的请求也会被 403**。
  本阶段用“带正确管理令牌从公网访问”实测，仍返回 403。
- `server/data/`、`/docs/`、`/scripts/`、`/.git/` 经公网全部 404。
- 管理令牌文件只在本机；不要发给任何人，也不要截图。
- 游戏没有账号系统；**邀请码就是准入凭证**，只发给朋友。房间上限、人数上限、
  消息/方块/移动校验仍由服务器执行。
- 不要设置 `adminLocalhostOnly: false` 去“方便远程管理”；那会把管理接口暴露给公网。

## 4. 方案 B：Caddy + 公网 IPv4 + 域名（备用模板，未实测）

> 本节是**备用部署模板**，不是本阶段正式验收通过的路径。Caddy 未实际运行验证；
> 使用前必须完成 `caddy validate`、DNS、80/443 转发和实际入站测试，不能仅凭本模板宣称已通过。

适用：有公网 IPv4（非 CGNAT）、有域名、愿意在路由器做端口转发。

### 4.1 DNS

在域名服务商添加 A 记录：

```
mc.example.com  A  <你的公网 IPv4>
```

### 4.2 路由器端口转发（需要你自己配置）

把 **TCP 80 和 TCP 443** 转发到这台电脑的**局域网 IP**（例如 `192.168.1.18`）：

- 80：Let's Encrypt/ACME 证书签发与续期。
- 443：HTTPS/WSS。
- **不要转发 8080**；游戏服务器只让本机 Caddy 访问。
- 如果运营商封 80/443，Caddy 方案不可用；改用 Tunnel。

本阶段**没有**在你的路由器上做这个配置，也没有验证你的公网入站；
所以 Caddy 公网路径在本阶段记为 **NOT TESTED / NOT CONFIGURED**，且**不属于正式验收路径**；
本阶段正式验收的公网路径是 Cloudflare Tunnel。

### 4.3 Windows 防火墙

Caddy 需要监听 80/443；首次运行如弹窗，只允许**专用网络**。
游戏服务器保持默认 `127.0.0.1:8080`，不需要对公网放行 8080。

### 4.4 运行 Caddy

安装 Caddy 2（<https://caddyserver.com/download>），在项目目录：

```powershell
$env:OPUSMC_DOMAIN = 'mc.example.com'
$env:OPUSMC_ACME_EMAIL = 'you@example.com'
caddy run --config deploy\Caddyfile
```

Caddy 会自动申请/续期证书，并把 HTTPS/WSS 反代到 `127.0.0.1:8080`。

[`deploy/Caddyfile`](../../deploy/Caddyfile) 已经做了：

- `/api/admin/*`、`/server/*`、`/docs/*`、`/scripts/*`、`/.git/*` → 404；
- 覆盖客户端自带的 `X-Forwarded-For` / `CF-Connecting-IP`，防止伪造本机地址；
- HSTS 等安全头；
- WebSocket 由 `reverse_proxy` 自动升级（WSS）。

验证：

```powershell
curl.exe -I https://mc.example.com/
curl.exe https://mc.example.com/healthz
```

浏览器打开 `https://mc.example.com/`，地址栏应有锁；页面里的 WebSocket 应为 `wss://`。

## 5. 为什么不会暴露数据库和管理接口

多层边界：

1. 游戏服务器的静态白名单只有 `index.html`、`js/*`、`sounds/sfx/*`、`favicon.svg`；
   `server/data/`（世界、备份、日志、管理令牌）**从不**通过 HTTP 提供。
2. 反向代理再挡一层：Caddyfile 对 `/server/*`、`/docs/*`、`/scripts/*`、`/.git/*` 返回 404。
3. 管理接口 `/api/admin/*`：
   - Caddy 层直接 404；
   - 游戏服务器还会检查“直连必须回环 + 转发头必须是回环”，
     所以经 Tunnel/Caddy 的远程请求即使源站 socket 是 `127.0.0.1` 也会 403。
4. 转发头只在直连地址是回环时可信；LAN 客户端自己伪造 `X-Forwarded-For` 无效。
5. 管理令牌由服务器生成在 `server/data/admin-token.txt`，不写日志、不下发页面。

## 6. 实测记录（2026-11-13；2026-11-14 增补真实手机）

环境：Windows、Node 26.13、Chrome 157（headless，SwiftShader）、
Cloudflare quick tunnel。修复后复测入口
`https://inline-titled-sons-ruled.trycloudflare.com`（**临时地址，已失效**）；
此前一次实测入口为 `https://traditions-lectures-generators-margaret.trycloudflare.com`（同样已失效）。

| 项目 | 结果 |
|---|---|
| 公网 HTTPS 页面 | `200`，页面正常加载 87 个脚本 |
| 公网 `/healthz` | `200`，公开字段不含 CPU/内存/tick |
| 公网 WSS | `wss://.../ws` 握手成功；修复后协议测试 22/22 |
| 建房/加入/同世界 | 两客户端同一 invite code、同一 seed；方块双向广播 |
| 公网浏览器 E2E | 两个独立 Chrome profile **15/15 PASS**；无 mixed-content、无未捕获异常。修复后前两次尝试在 quick tunnel 的 `worldgen_data.js` 资产流上超时，第三次通过；这是隧道波动，不是应用错误 |
| 公网管理接口（无令牌） | `403` |
| 公网管理接口（**带正确令牌**） | `403`（代理感知生效） |
| 本机回环管理接口 + 令牌 | `200`（本机管理不受影响） |
| 公网 `/server/config.json`、`/server/data/admin-token.txt`、`/docs/STATUS.md`、`/.git/config`、`/scripts/serve.mjs` | 全部 `404` |
| 独立外部节点（check-host.net） | 修复后复测 5/6 节点 `200`（德国/西班牙/波兰/德国/伊朗；中国 1 节点超时）；此前 6/6 节点 `200` |
| **真实手机蜂窝（用户报告 2026-11-14）** | **PASS**：关闭 Wi-Fi 后经 Cloudflare HTTPS 进入世界、渲染、移动、转视角、放置、破坏、刷新重进；服务器日志显示蜂窝 IPv6 客户端加入房间 XF6BT4YQ |
| Caddy + 公网 IPv4 + 域名 | **BLOCKED / NOT TESTED**；无公网 IPv4/域名，未配置端口转发，Caddy 未运行；不属于正式验收路径 |

用户说明“PIN 验证”指 **Cloudflare quick tunnel 临时地址的邮箱验证**。这是 Cloudflare/外部访问流程，
不是 OpusMC 的 PIN、账号或房间权限；OpusMC 代码没有 PIN/邮箱验证功能（K-100）。

**NOT TESTED**：

- Caddy + 公网 IPv4 + 域名的真实入站（本机没有公网 IPv4/域名，端口转发未配置）；
- 长时间稳定性、带宽、丢包、Cloudflare 在中国大陆的实际可达性；
- 10 人公网并发、DDoS/滥用防护、证书续期；
- 手机型号/OS/浏览器版本/截图/录屏（用户明确不提交）；真实手机 GPU/发热/帧率未测。

不得把上述未测项写成“已完成”或“公网可用”。

## 7. 排查

**Tunnel 打不开（Cloudflare 1033/502）**

- cloudflared 是否还在运行？游戏服务器是否还在运行？
- 重新执行 quick tunnel；URL 每次都变。
- 命名隧道看 Cloudflare 控制台和 `cloudflared tunnel info opusmc`。

**页面能打开但资源/建房卡住**

- quick tunnel 在大文件（如 `worldgen_data.js`）上偶尔会取消流；刷新页面、重试，
  或重启 quick tunnel。服务器日志里房间已创建/加入时，这通常是隧道资产波动，不是服务器错误。
- 浏览器 Console 若显示 `net::ERR_...` 下载失败，先重试；持续失败再检查网络。

**页面能开但进不了房间 / WebSocket 失败**

- 代理必须转发 WebSocket Upgrade；用本仓库 Caddyfile，或 Cloudflare Tunnel。
- 不要用只支持静态文件的托管/对象存储。
- 浏览器 Console 看是否有 `wss://` 失败；确认页面是 `https://` 打开的。

**Caddy 证书失败**

- 域名 A/AAAA 是否指向正确公网 IP；80/443 是否真的从公网可达；
- 运营商是否封 80/443；CGNAT 下无法用 Caddy，改用 Tunnel。

**管理接口 403**

- 这是**正确行为**。远程不能管理；在服务器本机运行 `server\status.ps1`。

**房间/限流**

- 同一 NAT/同一出口 IP 的玩家共享限流桶；可调大 `joinPerMinute` / `joinBurst`。
- 默认单房 10 人、8 房；公网上限受家庭上传带宽影响。

**服务器/隧道进程**

- 电脑休眠/关机/注销后全部不可用；Tunnel 和游戏服务器都要保持运行。
- 公网 IPv4 是动态的 → Caddy 方案需要 DDNS；Tunnel 不受影响。

## 8. 回滚

1. 停止 cloudflared / Caddy。
2. 删除 Cloudflare 隧道/DNS 记录（命名隧道）；quick tunnel 直接失效。
3. 删除路由器端口转发（如果配置过）；恢复 Windows 防火墙规则。
4. 游戏服务器回到默认 `127.0.0.1`，只保留局域网或本机使用。
