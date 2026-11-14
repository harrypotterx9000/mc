# phase-08 网络部署 · 交接（HANDOFF）

- 日期：2026-11-13（2026-11-14 增补真实设备测试与提交）
- 状态：**验收结束（真实设备用户实测，2026-11-14）；代码 `ef8c540`；已推送 `origin/opusmc-integration`；未进入 phase-09**
- 仓库：`D:\ds\REA\opusmc`
- 分支：`develop`（未新建/切换/重置）
- 起点：HEAD `221d4ea`（phase-07 docs 推送记录）；phase-07 代码 `508fcc8`
- 工作区：代码/文档已提交；除 1 个无关未跟踪文件 `REAopusmc<U+F022>` 外干净（见 §6）

## 1. 本阶段目标

1. **模式 A（优先）**：电脑启动服务器；同一 Wi-Fi 的手机和电脑访问；所有客户端用同一个游戏地址；
   创建/加入多人房间；所有设备同步同一个世界；完整部署说明。
2. **模式 B**：HTTPS + WSS；合理的远程访问方案（反代或隧道）；不暴露数据库和管理接口；
   说明家庭网络/公网 IPv4/NAT 限制；未实际配置的端口转发不得标记完成；远程访问必须实际网络测试。

## 2. 实际完成情况

### 模式 A：LAN（已实测）

- 新增 `--lan` / `start-lan.bat`：绑定 `0.0.0.0`；**主地址优先有效私有 IPv4**，
  `127.0.0.1` 单独标为“仅本机访问”；默认 `start-server.bat` 仍只绑定回环。
- 所有设备（包括电脑自己）使用同一个 `游戏地址（局域网）`；客户端自动同源 `ws://`；
  邀请链接跟随页面地址；专项 8/8 覆盖多次建房、刷新/恢复、多邀请码。
- 新增 `deploy/windows/firewall-lan.ps1`（管理员、默认仅专用网络、`-Remove`、`-IncludePublic`）。
- 实测：LAN 启动输出/127 标注 PASS；邀请链接 8/8；LAN 协议 **22/22**；两个独立 Chrome profile
  **15/15**；建房/加入/同 seed/方块/聊天/玩家同步；LAN 管理接口 403、回环+令牌 200；静态边界 404。
- **真实手机 LAN（用户报告 2026-11-14）**：单人游戏、移动、转视角、放置、破坏、刷新重进 PASS；
  服务器日志显示 LAN 私有地址客户端加入 `E7UDCMQT`，2 名玩家。
- 文档：`docs/deployment/LAN.md`。

### 模式 B：外网（Cloudflare Tunnel 为正式验收路径；Caddy 为备用模板）

- Cloudflare quick tunnel → `https://...trycloudflare.com`：
  - 公网 HTTPS 页面/healthz 200；
  - **WSS** 协议 **22/22**；浏览器 E2E **15/15**（`ws.url = wss://...`，无 mixed-content；
    前两次 quick tunnel 资产流超时，第三次通过）；
  - 公网管理接口无令牌/带令牌均 **403**；`server/data`、`/docs`、`/scripts`、`/.git` 404；
  - check-host.net 修复后 5/6 节点 200（1 个超时）。
- **真实手机蜂窝公网（用户报告 2026-11-14）**：关闭 Wi-Fi 经 Cloudflare HTTPS 进入世界、渲染、移动、
  转视角、放置、破坏、刷新重进 PASS；日志显示蜂窝 IPv6 客户端加入 `XF6BT4YQ`，2 名玩家。
  用户说明“PIN 验证”是 Cloudflare 临时地址邮箱验证；属于外部流程，不是 OpusMC 功能（K-100）。
- 新增 `deploy/cloudflared/config.yml.example`（命名隧道模板）；**Cloudflare Tunnel 是本阶段正式支持/
  验收的公网路径**。
- `deploy/Caddyfile` 保留为**备用模板**：未运行验证，不属于正式验收路径，不得写成 Caddy 公网已通过。
  本机无公网 IPv4/域名，未配置路由器端口转发。
- 文档：`docs/deployment/REMOTE.md`。

### 安全修正（远程部署必需）

反向代理/隧道会让源站看到 `127.0.0.1`，原实现会带来：

1. 管理接口的“仅本机”被绕过；
2. 所有远程玩家共用 `127.0.0.1` 的限流桶。

新增 `server/netutil.mjs`：

- 只有直连 socket 是回环时才信任 `X-Forwarded-For` / `CF-Connecting-IP`；
- 管理接口要求“直连回环 + 转发地址也回环”；
- WebSocket 的 `conn.ip` 使用真实客户端地址，限流/日志正确。

实测：回环 + 伪造远程 XFF + 令牌 → 403；LAN + 伪造回环 XFF → 403；回环 + 真实转发 → 按转发 IP 限流。

### 验收问题修复（2026-11-13）

- **LAN 主地址**：`server/index.mjs` 过滤回环/`0.0.0.0`/`169.254.*`、优先有效私有 IPv4；
  输出改为 `游戏地址（局域网）` + `仅本机访问（服务器电脑）`；默认本机模式行为不变。
- **邀请链接**：专项 8/8 覆盖 LAN 页面、两个邀请码、首次建房、刷新、继续房间、第二次建房；
  全部为 LAN 地址。
- **文档**：修正文件数量（14 个已修改 = 7 代码/说明 + 7 项目文档；11 个新增）、
  README 标题引用、START-HERE phase-08 路径。
- **公网验收范围**：Cloudflare Tunnel 为正式支持/验收路径；Caddy 保留为备用模板，
  未运行验证，不属于正式验收路径。

## 3. 关键修改文件

### 服务端

- 新增 `server/netutil.mjs`
- `server/http.mjs`、`server/ws.mjs`、`server/index.mjs`、`server/config.mjs`、`server/rooms.mjs`
- `server/index.mjs` 版本 `0.8.0`；`hello`/`/healthz` 版本 `phase-08`

### 部署资产

- 新增 `start-lan.bat`（ASCII/CRLF）
- 新增 `deploy/README.md`、`deploy/Caddyfile`、`deploy/cloudflared/config.yml.example`、
  `deploy/windows/firewall-lan.ps1`

### 文档

- 新增 `docs/deployment/LAN.md`、`docs/deployment/REMOTE.md`
- 新增 `docs/phases/phase-08-deployment/{PLAN,TEST_REPORT,HANDOFF}.md`
- 更新 `README.md`、`server/README.md`
- 更新 `docs/STATUS.md`、`docs/START-HERE.md`、`docs/PROJECT_SPEC.md`、`docs/ARCHITECTURE.md`、
  `docs/DECISIONS.md`、`docs/KNOWN_ISSUES.md`、`docs/CHANGELOG.md`

## 4. 关键技术决策

1. **安全默认不变**：`server/config.json` 的 `host` 仍是 `127.0.0.1`；LAN 必须显式
   `start-lan.bat` / `--lan` / 改配置。LAN 主地址优先有效私有 IPv4，`127.0.0.1` 仅本机。
2. **不把 TLS 写进 Node**：TLS 由 Cloudflare 边缘或备用 Caddy 终止；Node 继续零依赖、
   只做游戏/房间/存档。
3. **代理身份只信任本机回环代理**：`X-Forwarded-For` 仅在直连是本机时生效；LAN 客户端伪造无效；
   远程管理即使源站 socket 是 127.0.0.1 也 403。
4. **限流按真实客户端 IP**：解决隧道/反代后所有玩家共用 127.0.0.1 限流桶的问题；
   同一 NAT 后仍共享出口 IP（既有 K-78 行为）。
5. **管理接口双层保护**：Caddy 层 404 + 源站转发头校验 403；Tunnel 无 Caddy 时源站仍拒绝。
6. **Caddy 方案如实标注**：Caddy 是备用模板，未运行验证，不属于正式验收路径；
   无公网 IPv4/域名、未配置端口转发，不写成已完成。
7. **Quick Tunnel 只作为实测/临时方案**：临时 URL、无 SLA，大资产偶尔超时；长期用命名隧道 + 域名。

## 5. 测试结果

| 套件 | 结果 |
|---|---|
| LAN 启动输出/127 标注 | PASS |
| 邀请链接一致性（多次建房/刷新恢复/多邀请码） | **8/8 PASS** |
| LAN 协议（`phase08-net-test.mjs`，修复后） | **22/22 PASS** |
| 公网协议（HTTPS/WSS，修复后） | **22/22 PASS** |
| LAN 浏览器 E2E（两个独立 Chrome profile） | **15/15 PASS** |
| 公网浏览器 E2E（HTTPS/WSS） | **15/15 PASS**（前两次 quick tunnel 资产流超时，第三次通过） |
| 外部节点（check-host.net） | 修复后 5/6 节点 200（1 个超时） |
| 管理接口安全（LAN/公网/伪造 XFF） | 全部符合预期 |
| `netutil` 单元 | 9/9 PASS |
| phase-05 服务端 / 双浏览器 / 单人 | 62/62、18/18、6/6 PASS（修复后复跑） |
| phase-06 服务端 / 浏览器 | 22/22、31/31 PASS（修复后复跑） |
| 静态 | 91 JS + 10 server mjs + 1 scripts mjs `node --check`；87 页面脚本；`git diff --check` PASS |
| `start-lan.bat` / `stop.ps1` / `status.ps1` | 包装启动、正常关闭、状态查询均 PASS |
| **真实手机 LAN（用户报告）** | **PASS**：单人/移动/视角/放置/破坏/刷新；日志 `E7UDCMQT` 有 LAN 客户端 |
| **真实手机蜂窝公网（用户报告）** | **PASS**：HTTPS/进入/渲染/移动/视角/放置/破坏/刷新；日志 `XF6BT4YQ` 有蜂窝 IPv6 客户端 |
| 第二台物理设备 | **PASS（用户报告 + 服务器日志）**；未提供型号/OS/浏览器/截图 |
| Windows 防火墙脚本实际添加/删除 | **NOT TESTED / BLOCKED**（非管理员；真实 LAN 已有 node.exe Public 规则可用） |
| Caddy + 公网 IPv4/域名 | **BLOCKED / NOT TESTED**；备用模板，不属于正式验收路径 |
| 公网长期/10 人并发 | **NOT TESTED** |

证据：`_work/phase08-fix-*`、`_work/phase08-real-device-evidence.txt`、`server/data/logs/`；
详细见 `docs/phases/phase-08-deployment/TEST_REPORT.md`。

## 6. 当前 Git

| 项 | 值 |
|---|---|
| 分支 | `develop`（未切换/未重置） |
| HEAD | 推送记录为当前 HEAD；phase-08 内容 tip `597a15f`；代码 `ef8c540` |
| 工作区 | phase-08 代码/文档已提交并推送；除 1 个与本阶段无关的未跟踪文件 `REAopusmc<U+F022>` 外干净 |
| 远程 | **已推送 `origin/opusmc-integration`（phase-08 内容 tip `597a15f`；远程 HEAD 为推送记录/当前 HEAD）**；未合并；未 force push |
| 验收 | **验收结束（真实设备用户实测）**；代码 `ef8c540`；docs `d8b237a`/`597a15f` |

## 7. 下一阶段前置条件（phase-09，只检查不实现）

- 下一阶段是 **phase-09 验收/发布准备**；本阶段不自动进入，不提前修改 phase-09 功能。
- phase-08 代码 `ef8c540`、docs `d8b237a`/`597a15f`；已推送 `origin/opusmc-integration`；不要 reset/clean 丢弃历史。
- **推送/合并决定**：phase-08 已推送；未合并；PR #1 仍未合并；禁止 force push。
- **工作区**：除 1 个与本阶段无关的未跟踪文件 `REAopusmc<U+F022>` 外应干净；提交/发布前先确认该文件是否删除。
- **全量回归**：在确切提交上重跑 phase-05/06/07/08 测试、`node --check`、`git diff --check`，不能只用历史结果。
- 保持：87 个页面脚本、91 个 `js/*.js`、服务器零 npm 依赖、`mc-js-clone`/`srv~` 存档边界。
- 服务器与客户端必须同版本部署；`server/netutil.mjs` 是新增模块，部署时不能只复制旧 `server/`。
- `start-lan.bat` 保持 ASCII/CRLF；`server/status.ps1` 保持 UTF-8 BOM + LF；`server/data` 不提交。
- 不要把未测项写成已完成：Caddy 公网入站、端口转发、Windows 防火墙脚本实际添加/删除、
  长期公网稳定性、10 人并发、手机型号/性能/截图。真实手机 LAN/蜂窝功能已由用户报告通过。
- Quick Tunnel URL 已失效；测试报告保留的是历史证据，不能当长期地址。
- **验收范围**：Cloudflare Tunnel 是正式路径；Caddy 是备用模板，不纳入正式验收；不要因发布准备而改写为已通过。

## 8. 下一阶段需要特别检查的文件/依赖

| 文件/依赖 | 检查点 |
|---|---|
| `server/netutil.mjs` | 转发头只信本机；IPv6/mapped/port 规范化；`clientIp` 不被 LAN 伪造 |
| `server/http.mjs` | 管理接口双层判断；静态白名单未放宽 |
| `server/ws.mjs` | `conn.ip = clientIp(req)`；不改 WS 协议/帧处理 |
| `server/index.mjs` | `--lan` 主地址选私有 IPv4、127 仅本机；版本 `0.8.0`；默认仍 127.0.0.1 |
| `server/config.mjs` | `--lan` 与 `--host` 优先级；默认值不变 |
| `start-lan.bat` | ASCII/CRLF；与 `start-server.bat` 一致的中文控制台 |
| `deploy/Caddyfile` | **备用模板**，未运行验证，不属于正式验收路径；若用户有公网 IPv4/域名需先 `caddy validate` 再实际入站测试 |
| `deploy/cloudflared/config.yml.example` | 占位符/路径/域名必须替换；不要提交真实 credentials |
| `deploy/windows/firewall-lan.ps1` | 需管理员；默认 Private；`-IncludePublic` 仅可信网络 |
| `docs/deployment/LAN.md` / `REMOTE.md` | 与实测/未测状态一致 |
| `docs/STATUS.md` / `START-HERE.md` | 当前阶段、Git、未测项一致 |
| `docs/KNOWN_ISSUES.md` | K-95…K-100 的真实设备/邮箱验证/Caddy/防火墙边界 |
| `server/data/` | 测试房间 E7UDCMQT / XF6BT4YQ 与日志保留；不提交、不随发布打包 |

## 9. 已知遗留 / 风险

- **真实设备已由用户实测（功能 PASS）**：未提供手机型号/OS/浏览器/截图/录屏；不能外推为所有手机/
  所有 Wi-Fi/所有运营商都通过，也不代表性能/发热达标。
- 本机 Windows 网络为 **Public**；手机 LAN 实测通过说明系统已有 `node.exe` Public 入站规则可用；
  防火墙脚本的实际添加/删除仍未验证。
- **Caddy 未实测**：备用模板，无公网 IPv4/域名、端口转发未配置；Caddyfile 只做了人工语法检查，
  不属于正式验收路径。
- Quick Tunnel 临时、无 SLA；中国大陆访问 Cloudflare 的稳定性未验证；用户遇到临时地址邮箱验证，
  属于 Cloudflare 外部流程，不是应用 PIN。
- 同一 NAT/同一出口 IP 的玩家共享限流桶（K-78）；隧道后按真实公网 IP 计。
- 公网长期运行、带宽、抖动、10 人并发、DDoS、证书续期未测。
- 手机真实功能已测，但型号/OS/GPU/帧率/发热/电池未提供，不写成性能达标。
- **Git 推送环境**：全局 `http.proxy`/`https.proxy` 指向 `http://127.0.0.1:7892`，该端口可能无监听；
  本次用单次 `-c http.proxy= -c https.proxy= -c http.https://github.com.proxy=` 直连推送成功。
  未改全局配置；后续推送失败先检查代理，不要 force push、不要改历史。
- `server/data` 保留真实设备测试房间/日志（E7UDCMQT、XF6BT4YQ），不提交；不要删除。
