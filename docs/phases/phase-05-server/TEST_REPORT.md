# phase-05 自建服务器 · 实现测试报告（TEST_REPORT）

- 日期：2026-11-12
- 阶段：phase-05 自建服务器
- 分支：`develop`（未新建/切换/重置）
- 起点：`3b8b2e0`（phase-04 docs 收尾）；代码基线 `553ceed`
- 状态：**实现、测试与修复复核完成；已验收（2026-11-12）；代码 `817bad3`；docs 收尾为当前 HEAD**
- 环境：Windows，Node.js v26.13.0，Chrome 157.0.8103.51（headless + SwiftShader）
- 测试代码位置：`D:\ds\REA\_work\phase05-*.mjs`（仓库外，不随项目提交）
- 证据：`D:\ds\REA\_work\phase05-test-*`、`phase05-browser-result.json`、`phase05-sp-result.json`、
  `phase05-a-world.png`、`phase05-b-world.png`、`phase05-room-screen.png`、`phase05-sp-world.png`

## 1. 总结果

| 套件 | 结果 | 说明 |
|---|---|---|
| 服务端集成（协议/安全/权限/同步/存档/备份/关闭/限流） | **62 PASS / 0 FAIL** | 自起多个服务器进程 + 临时数据目录；含一次重启与损坏恢复 |
| 双浏览器多人 E2E | **18 PASS / 0 FAIL** | 两个独立 Chrome profile，真实页面/UI/WebGL2 |
| 单人回归 | **6 PASS / 0 FAIL** | 新增 `mp.js` 后单人世界创建/编辑/保存/刷新恢复 |
| 静态语法 | 91 个 `js/*.js` + 9 个 `server/*.mjs` `node --check` 全部通过 | 页面脚本 87 |
| `scripts/serve.mjs` 回归 | `index 200`、`js/mp.js 200`、`server/config.json 403` | 旧静态服务器仍可用 |
| 正常停止脚本 | `stop.ps1 -Config …` 退出 0，pid 文件删除，健康检查不可达 | 修复复核有脏房间 + 活动连接 3 轮 18/18 PASS |
| 状态脚本 | `status.ps1 -Config …` 退出 0，输出名称/版本/房间/在线数 | 实测 |
| 端口占用启动 | 退出 1，输出“端口已被占用”，未留下 pid | 实测 |
| 修复复核 F-A 方块 ID | 全量 **1257/1257**；动态 19/19；羊毛存档恢复 3/3 | PASS |
| 修复复核 F-B 方块实体 | 初始/增量/继续恢复双客户端 **7/7** | PASS |
| 修复复核 F-C 正常关闭 | 有脏房间 + 活动连接 **18/18**（3 轮） | PASS |
| 修复复核 F-D 完整 Diff | **35/35**；raw = normalized，无 CRLF-only | PASS |
| 修复复核 F-E/F-F | 掉落 7m 不发送、1m 发送；旧 socket close 不覆盖新 socket **6/6** | PASS |

> 真实局域网两台物理设备、公网、TLS/WSS、长时间运行、10 人压力、真实 GPU 性能**未测试**；
> 不得写成已通过。浏览器 E2E 的 `chunk stall` 属 K-39/K-53 已知无头噪音（最近一轮无；此前轮次 B 一次，见 §6）。

## 2. 服务端集成测试（62/62）

命令：

```powershell
node D:\ds\REA\_work\phase05-server-test.mjs
```

脚本为每组测试启动独立的 `server/index.mjs`（临时 `dataDir`），不污染项目 `server/data`。

### 2.1 静态与安全

- `GET /` 200，包含 `js/mp.js`、`js/platform.js`；`GET /js/mp.js` 200。
- JS `Cache-Control: no-cache`、`X-Content-Type-Options: nosniff`、`HEAD` 长度正确。
- `ETag` + `If-None-Match` → 304；`favicon.svg` 200。
- `/docs/STATUS.md`、`/server/config.json`、`/server/data/admin-token.txt` 均为 404。
- `/healthz`、`/api/status` 正常；公开状态不包含内部 `stats`。

### 2.2 房间、身份、邀请码

- `hello` 版本/限额；创建返回 8 位服务器邀请码、`p_` + 16 hex 临时 ID、会话令牌。
- 创建者为房主；`welcome` 带种子/出生点/时间/玩家列表。
- 第二名玩家凭邀请码加入；第三名同名玩家被服务器消歧为 `Alice2`。
- 满员拒绝（“房间已满”）；关闭后的邀请码不可再加入。
- 昵称/临时 ID 由服务器维护；客户端未传权限标识。

### 2.3 同步

- 玩家位置进 `E` 快照；方块改动广播并回显给发送者；方块实体广播；聊天到达他人且不回显给发送者。
- 方块实体里的 `__proto__`/`constructor`/`prototype` 键被拒绝，不会广播给其他玩家（原型污染防护）。
- 掉落物由服务器创建为实体；`pickup` 经距离/延迟验证后 `give`，并对所有人生成 `itemRemove`。

### 2.4 服务端权威

- 瞬移式移动被 `correct` 回最后接受位置，且错误位置没有广播。
- 超距方块改动被 `reject`，其他人收不到。
- 未知方块 ID（如 5000）被 `reject`，不广播（服务器启动时从 `js/blockdata.js`/`js/blocks.js` 读取合法 ID 集）。
- 非房主 `kick`/`close` 被拒绝；房主 `kick` 成功，被踢者从房间消失。
- 被踢者的会话令牌不能恢复。

### 2.5 断线恢复 / 房主

- 断线后 `resume` 保持同一临时 ID。
- 房主短暂断线保留房主；房主**主动离开**时房主转移给最早加入的在线玩家。
- 房主关闭房间后所有连接收到 `closed`，邀请码失效。
- 重启服务器后，令牌仍可恢复（保存的是 SHA-256 哈希），玩家 `pstate`（生命/背包等）恢复。

### 2.6 协议/连接异常

- 无效 JSON → `error`；二进制帧 → 1003 关闭；超过 64 KB 文本 → 1009 关闭。

### 2.7 持久化、备份、管理接口与关闭

- 运行时有 pid 文件；管理状态无令牌/错令牌 401，正确令牌 200，且列出房间。
- 管理关闭返回 200，进程退出码 0，pid 文件删除。
- `world.json` 保存方块改动与玩家 `pstate`。
- 日志含 `room_created` 等生命周期事件，**不含**会话令牌或管理令牌。
- 重启后房间恢复、方块改动重放；会话恢复。
- 停止后把 `world.json` 写成非法 JSON，重启自动回退最新备份，日志含 `world_recovered_from_backup`。
- 第二次正常关闭退出码 0。

### 2.8 限流

- 独立低限额服务器：第一次无效邀请码返回“邀请码无效”，第二次同一 IP 返回“尝试加入太频繁”。
- 低限额服务器正常关闭退出码 0。

## 3. 双浏览器多人 E2E（18/18）

命令：

```powershell
node D:\ds\REA\_work\phase05-browser-test.mjs
```

两个独立 Chrome profile（9455/9456）访问同一个自建服务器，走真实 UI：

1. 两端加载标题画面。
2. A：多人游戏 → 自建服务器房间 → 创建房间（房间名/种子 12345/创造模式）→ 世界加载 → `join`。
3. 检查 `worldMeta.id = srv~<code>`、种子、玩家列表、区块加载。
4. B：多人游戏 → 自建服务器房间 → 输入邀请码 → 加入 → 世界加载。
5. 双方 `mirrors` 中看到对方（Alice/Bob）。
6. A 移动 2 格，B 的 `MPPlayer` 位置同步（水平误差 0）。
7. A 在脚下附近放石头，B 的 `world.getBlock` 变为 1。
8. A 聊天“hello from Alice”，B 的聊天栏收到 `<Alice> …`。
9. A 暂停 → 房间…：界面含“复制邀请链接 / 返回游戏 / 离开房间 / 关闭房间 / 移出”。
10. A 主动关闭 WebSocket，客户端自动 `resume` 回同一临时 ID；B 仍能看到 A。
11. A 移出 B，B 回到标题并显示“离开了房间”；A 关闭房间，A 也回到标题。
12. 两端无未捕获异常；最近一轮 `game.errLog` 为空；此前轮次 B 曾一次已知 `chunk stall`（K-39/K-53）。

截图：

- `D:\ds\REA\_work\phase05-a-world.png`
- `D:\ds\REA\_work\phase05-b-world.png`
- `D:\ds\REA\_work\phase05-room-screen.png`

## 4. 单人回归（6/6）

命令：

```powershell
node D:\ds\REA\_work\phase05-sp-regression.mjs
```

- 页面 87 个静态脚本（`__BOOT_TOTAL__=87`；DOM 中另有懒加载 `sound_events.js`，所以可见 88）。
- `mp.js` 定义存在；单机时 `game.mpClient` 为空。
- 新建单机世界 → `play`（61 区块）→ 放置方块 → IndexedDB 保存 → 刷新 → 读档 → 方块仍在。
- `game.errLog` 空；无未捕获异常。
- `scripts/serve.mjs` 单独启动仍能提供 `index.html` 和 `js/mp.js`，并拒绝 `server/config.json`。

## 5. 静态检查

- 91 个 `js/*.js`：`node --check` 全部通过。
- 9 个 `server/*.mjs`：`node --check` 全部通过。
- `index.html`：87 个 `<script src>`。
- `git diff --check`：通过。
- 新增/修改的 JS、mjs、md 为 UTF-8；PowerShell 脚本为 UTF-8 **带 BOM**（Windows PowerShell 5.1 读取中文所需），
  `.bat` 使用 `chcp 65001`。

## 6. 已知噪音与不计入失败

- 无头 Chrome + SwiftShader 的 `chunk stall`（K-39/K-53）：B 端出现一次，世界仍进入 play；
  这是 phase-04 已记录的环境噪音，phase-07 处理。
- 打开旧“多人游戏”界面时仍会请求旧房间服务 `/api/public`，本机 403（K-02/K-40）。
  自建服务器入口不依赖它；这是既有遗留，本阶段未删除旧服务客户端。
- 无头 Chrome 无法锁定鼠标，会显示“自由鼠标模式”提示（既有行为）。

## 7. 未测试 / NOT TESTED

- 真实局域网两台物理设备（不同电脑）加入同一房间。
- HTTPS/WSS、公网、NAT、反向代理、域名。
- 服务器连续运行 > 1 小时、10 人压力、20 TPS 实际负载、100k 方块上限、5000 方块实体上限。
- 突然断电/强杀进程时正在写入的存档（已测“停止后损坏文件 → 备份恢复”，未测写入中强杀）。
- 管理接口非回环拒绝：已用本机 LAN IP `192.168.1.18:18084` 实测 403；回环 200（K-80 更新）。
- 真实 Android/iOS 真机、真实 GPU/手机 FPS、发热、内存。
- 真实玩家生存模式长时间对局、生物 AI 一致性、红石/流体一致性。
- 服务端生物 AI、服务端红石/战斗/物品语义权威（本阶段明确不做，见 KNOWN_ISSUES K-67…）。
- 内容过滤、举报、封禁、管理员公告（旧服务领域；本阶段不做）。

## 8. 修复复核（2026-11-12）

独立验收发现 F-A…F-F 后修复，复验结果：

| 修复项 | 复验 | 证据 |
|---|---|---|
| F-A 方块 ID 白名单漏 43 个 | **PASS**：游戏 `BLOCKS` 1257 = 服务器 1257，缺 0；19 个动态 ID 协议全接受；羊毛 129 存档重启后仍在 | `_work/phase05-blockids-compare.json`、`phase05-fix-a-test.mjs`、`phase05-fix-a-restore.mjs` |
| F-B 客户端方块实体不上报 | **PASS**：浏览器差异上报，晚加入收到初始箱子，修改后收到增量，继续恢复快照 | `_work/phase05-fix-b-test.mjs` 7/7 |
| F-C `stop.ps1` 有房间时强制退出 | **PASS**：有脏房间 + 活动连接，3 轮 `stop.ps1` 均 0.7s 退出 0，保存方块，pid 删除，无 `shutdown_forced` | `_work/phase05-fix-c-test.mjs` 18/18 |
| F-D CRLF-only 文件提交风险 | **PASS**：24 个文件归一为 LF；完整 Diff raw=normalized=35，无 CRLF-only | `_work/phase05-final-full.diff` |
| F-E 掉落距离 8/6 不一致 | **PASS**：客户端发送阈值 4.5、服务器 6；7m 掉落不发送、1m 发送 | `_work/phase05-fix-ef-test.mjs` 6/6 |
| F-F 旧 socket close 身份 | **PASS**：旧 socket 的 open/message/error/close 忽略；旧 close 不清空新 socket | `_work/phase05-fix-ef-test.mjs` 6/6 |

修复后回归：服务端 **62/62**、双浏览器 **18/18**、单人 **6/6**、晚加入/刷新恢复 **7/7**、
活动玩家关闭 **7/7**、91 JS + 9 server mjs `node --check`、`git diff --check` 全通过。
创建/消息限流、心跳/连接上限、真实 LAN/10 人/长跑/TLS/移动端仍为**未测试**，不随本次修复宣称通过。
