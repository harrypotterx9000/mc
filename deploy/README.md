# 部署资产（phase-08）

这里只放部署用配置，不是游戏运行所必需的 Node 依赖。

| 路径 | 用途 | 说明 |
|---|---|---|
| `windows\firewall-lan.ps1` | 局域网防火墙 | 管理员运行；只放行 TCP 端口的**专用网络**入站；`-Remove` 撤销 |
| `cloudflared\config.yml.example` | Cloudflare 命名隧道 | 本阶段**正式验收的公网路径**；不需要公网 IPv4/端口转发 |
| `Caddyfile` | 公网 HTTPS/WSS 反向代理 | **备用模板**；需要公网 IPv4 + 域名；自动 ACME 证书；**未实际运行验证，不属于本阶段正式验收通过的部署路径** |

Cloudflare Tunnel 与 Caddy 的验收范围见 `docs\deployment\REMOTE.md` §0。Caddy 模板不得被写成“公网部署已通过”。

完整步骤：

- 局域网：`docs\deployment\LAN.md`
- 外网：`docs\deployment\REMOTE.md`
- 服务器配置与存档：`server\README.md`

快速开始（局域网）：

```powershell
# 1. 启动（自动绑定 0.0.0.0 并打印局域网地址）
start-lan.bat

# 2. 首次如被防火墙拦截，用管理员 PowerShell 放行专用网络
powershell -ExecutionPolicy Bypass -File deploy\windows\firewall-lan.ps1 -Port 8080
```

所有设备（包括这台电脑）都打开启动时打印的 **`游戏地址（局域网）`**；
`127.0.0.1` 只用于服务器电脑本机，不要用它生成/分享邀请链接。
