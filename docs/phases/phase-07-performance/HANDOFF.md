# phase-07 电脑与手机性能优化 · 交接（HANDOFF）

- 日期：2026-11-13
- 状态：**验收结束；phase-07 代码 `508fcc8` 已提交；docs 收尾；未推送**
- 起点：HEAD `ea88dba`（phase-06 docs 收尾）；phase-06 代码 `b4833b8`
- 仓库：`D:\ds\REA\opusmc`
- 分支：`develop`（跟踪 `origin/opusmc-integration`；未新建/切换/重置）
- 工作区：phase-07 代码已提交（8 个客户端 JS、4 个 server `.mjs` + `server/status.ps1` + `server/README.md`、
  项目文档、3 个阶段文档；删除 1 个 `.gitkeep`），docs 收尾中
- 当前代码版本：**phase-07 代码 `508fcc8`；docs 收尾为当前 HEAD**
- 验收：用户声明“修改和验收已经结束”；代码已提交，docs 待收尾，未推送

## 1. 本阶段目标

1. 建立可复现性能基线：主菜单、普通地形、大型建筑、大量实体、战斗、多人房间、长时间运行。
2. 桌面优先 60 FPS，保留渲染距离/画质/光影。
3. 手机优先 30 FPS、争取 60；动态分辨率/区块预算/阴影/SSR/TAA/体积云/粒子/实体/GPU buffer/内存。
4. 低/中/高/自定义画质，按实际帧率和渲染耗时推荐，允许玩家调整。
5. 服务器维持 20 TPS；多玩家/多复杂度/持续运行测试；达不到就报告。
6. 修复 K-39。

## 2. 实际完成情况

- 桌面固定场景首轮 8 项 60 FPS（普通/建筑/240 实体/战斗/光影 1–4，`maxFps=60`，headless + 真实
  ANGLE/D3D11 AMD 核显）。
- 手机 3120×1440 视口模拟 30 s 稳定 60 FPS（基线 44.8；动态分辨率 0.9→0.5；非真机）。
- 编辑压力 p99 25.0→20.8 ms，最慢 29.2→20.9 ms。
- K-39：SwiftShader + CPU 8× 基线 3 次/46 s → 0 次/约 9 s。
- 服务器本机机器人 2/5/10/30 连接均 19.97–20.00 TPS；tick 0.12–0.39 ms；CPU 0.4–2.7%。
- 8 分钟长跑平均 59.08 FPS，p5 53.4，无错误。
- phase-05/06 回归：62/62、18/18、6/6、22/22、31/31 PASS；phase-05 单人回归在验收修复后复跑 6/6。
- 独立验收发现并修复 3 个问题（详见 §3、§5）：动态分辨率目标、粒子满额异常、画质建议 `maxFps`。
- **未完成/未测**：真实手机/显示器、真实 LAN/公网/TLS、>1 小时连续运行；光影 3/4 固定分辨率重复轮次
  出现 59.8/57.1 FPS（K-93）。

## 3. 关键修改文件

### 客户端（8）

- `js/perf.js`
  - `FramePacer.budget()`：手机/平板区块主线程上限 8 ms，桌面 12 ms。
  - `DynRes`：1.5 s 窗口平均帧 + >1.15×目标帧比例；首次降 20%、后续 10%；手机下限 0.4、桌面 0.5。
    **验收修复**：`target()` 改为显式 `maxFps` 优先；VSync 跟随显示器用
    `max(显示器间隔, 1000/60)`；VSync 关闭用 `1000/60`。30 Hz→33.3 ms，90/144 Hz→16.67 ms。
  - `PerfMon.ts` 时间戳、`measure()`/`sampleStats()`、`recommend()`；**验收修复**：推荐 target 为
    `min(60/30 目标, pacer.limit)`，尊重玩家帧率上限。
- `js/game.js`
  - `flushMesh()` 按区块预算分批；`_meshCand` 复用。
  - `chunkWatchdog()`：有进展/存档读取/管线忙时等待（K-39）。
  - `applySettings()` 按档位设置 `entityDist`/`entityShadowDist`/`Particles.max`。
  - 解码后释放 encoded chunk（`loadChunkIn`/`finishFromWorkerIn`/`finaliseChunk`）。
  - **验收修复**：`ambientParticles()` 对 `Particles.spawn()` 返回值判空，避免满额 `.life` TypeError。
- `js/render.js`：`visScratch` 复用；`entityDist`/`entityShadowDist` 默认值；手机 VertexArena 4 MB 页。
- `js/entity.js`：`Particles.max=3000` 默认；`spawn()` 满额返回 `undefined`。
- `js/mp.js`：`netStats`、5 s ping/pong RTT、流量；F3/报告显示。
- `js/onboard.js` / `js/screens.js`：视频设置“测试性能并推荐画质…”；Esc 取消并恢复；预设轮换含自定义。
- `js/terrain2.js`：`lastGenAt`/`lastResult` 进度；解码后释放 record。

### 服务器（4 + `status.ps1` + README）

- `server/rooms.mjs`：10 ms 唤醒 + 50 ms 补 tick（最多 3）；`perf`/`perfStatus()`；
  `broadcast`/`broadcastToRoom` 一次 JSON 编码多连接复用。
- `server/ws.mjs`：`sendText()`。
- `server/http.mjs`：公开 `/healthz`、`/api/status` 删除 `stats`/`perf`；admin 保留。
- `server/index.mjs`：`VERSION=0.7.0`。
- `server/status.ps1`：输出 TPS/tick/迟到/CPU/RSS；保持 UTF-8 BOM + LF。
- `server/README.md`：调度与性能字段说明。

### 文档/文件

- 新增：`docs/phases/phase-07-performance/{PLAN,TEST_REPORT,HANDOFF}.md`
- 更新：`README.md`、`docs/{STATUS,ARCHITECTURE,DECISIONS,KNOWN_ISSUES,PROJECT_SPEC,START-HERE,CHANGELOG}.md`、
  `docs/testing/performance-baseline.md`
- 删除：`docs/phases/phase-07-performance/.gitkeep`

## 4. 关键技术决策

1. **帧预算按设备分档**：手机/平板区块工作 8 ms、桌面 12 ms；不可拆分任务用预算限制单次卡顿。
2. **动态分辨率以 60 为质量目标**：显式 `maxFps` 优先；高刷显示器不追逐 90/144 Hz，避免无谓降分辨率；
   VSync 关闭/无限制仍以 60 为目标。
3. **画质建议尊重玩家设置**：`maxFps=30` 是玩家选择，不是设备慢；仍只在每世界 12 s 后提示一次，
   不自动覆盖设置。
4. **低/中档预算不删除内容**：只限制远距离实体/地面阴影/粒子数；高/极高保留全集，玩家可切换。
5. **服务器 20 TPS 是调度问题**：Windows `setInterval(50)` 实际约 62.5 ms；用 10 ms 唤醒 + 50 ms 补 tick，
   并限制一次最多补 3 tick，避免长停顿后爆发。
6. **K-39 只在真正无归属且管线空闲时重请求**：有生成/装饰/完成/网格/存档读取进展时等待，避免误删 pending。
7. **不新增页面脚本/不换渲染体系**：保留 WebGL2、87 个页面脚本、91 个 `js/*.js`；不删除内容换帧率。

## 5. 测试结果

| 套件 | 结果 |
|---|---|
| 桌面固定场景（普通/建筑/240 实体/战斗/光影 1–4） | 首轮 8/8 60 FPS；重复轮次光影 3/4 **59.8/57.1 FPS**（K-93） |
| 手机 3120×1440 视口模拟 30 s | 60.0 FPS（基线 44.8；scale 0.6–0.7；非真机） |
| 编辑压力（70 次） | p99 25.0→20.8 ms；最慢 29.2→20.9 ms |
| K-39（SwiftShader + CPU 8×） | 基线 3 次/46 s → 0 次/约 9 s |
| 服务器 2/5/10/30 连接 | 19.97–20.00 TPS；tick 0.12–0.39 ms；CPU 0.4–2.7% |
| 长跑 8 分钟 | 平均 59.08 FPS，p5 53.4；480 s；无错误 |
| phase-05/06 回归 | 62/62、18/18、6/6、22/22、31/31 PASS；验收修复后 phase-05 单人 6/6 |
| 验收三项修复 | 90/30 Hz/无限制目标正确；low 满额粒子无异常；`maxFps=30` 不再误降画质 |
| 静态 | 91 JS + 9 mjs `node --check`；87 脚本；`git diff --check`；LF/BOM 检查 PASS |

证据：`D:\ds\REA\_work\phase07-*`、`phase07-acceptance-probe.json`、`fix1/2/3-probe` 输出；
详细：`docs/phases/phase-07-performance/TEST_REPORT.md`、`docs/testing/performance-baseline.md`。

## 6. 当前 Git

| 项 | 值 |
|---|---|
| 分支 | `develop` |
| HEAD | docs 收尾为当前 HEAD；phase-07 代码 `508fcc8` |
| phase-07 | **代码 `508fcc8` 已提交；docs 收尾** |
| 远程 | phase-05 `817bad3` 已推送；phase-06/07 未推送；未合并；未打标签 |
| 验收 | **验收结束（2026-11-13，用户声明）** |
| 提交/推送 | 代码已提交；docs 收尾；**推送待执行**；不自动进入 phase-08 |

## 7. 下一阶段前置条件

- 下一阶段是 **phase-08 部署**（先 LAN；HTTPS/WSS、公网、NAT 后续）。本阶段未修改任何 phase-08 功能。
- 先确认 phase-07 工作区是否提交/推送；不要在未确认时 reset/clean/覆盖工作区。
- 保持 `mc-js-clone` 结构、`srv~` 拦截、服务器 `seed + 覆盖层` 存档模型。
- 保持 87 个页面脚本、91 个 `js/*.js`；不引入构建系统/框架。
- 服务器与客户端必须同版本部署；升级 `js/blocks.js`/世界生成前重新验证 `blockids` 与旧房间。
- `server/status.ps1` 保持 UTF-8 BOM + LF；`.bat` 保持 ASCII/CRLF；`server/data` 不提交。
- 真实手机/显示器、真实 LAN/公网/TLS、>1 小时长跑仍未测；发布前重新评估，不得把模拟数据写成真机达标。
- 不要宣称“所有轮次稳定 60”或“真实网络 20 TPS”；K-93/K-92 保留。
- 旧房间服务/`/api/skin`/管理员公告/旧 `mcjs-room-key` 是遗留（K-36/K-44/K-45/K-63/K-77），不要误删。

## 8. 下一阶段需要特别检查的文件/依赖

| 文件/依赖 | 检查点 |
|---|---|
| `js/perf.js` | `DynRes.target` 的 60/90/30/unlimited 目标、`recommend` 的 `maxFps`、`PerfMon.measure` |
| `js/game.js` | `ambientParticles` 判空、`flushMesh` 预算、`chunkWatchdog`、`applySettings` 预算、`drawEntityList`/`drawMob` |
| `js/entity.js` | `Particles.max` 与 `spawn()` 满额返回 `undefined`；所有调用方判空 |
| `js/render.js` | `visScratch`、arena 页大小、`entityDist` 默认值 |
| `js/mp.js` | `netStats`/ping 5 s/pong `t0`；不要破坏 `srv~` 拦截/包装顺序 |
| `js/onboard.js` / `js/screens.js` | `QualityScreen` 取消恢复、视频设置按钮 |
| `server/rooms.mjs` | 10 ms 调度器、补 tick 上限、`perf`、广播一次编码 |
| `server/http.mjs` | 公开接口删除 `stats`/`perf`，admin 保留 |
| `server/status.ps1` | UTF-8 BOM + LF；PS 5.1 可解析；只读 admin，不写数据 |
| `server/README.md` | 调度/性能字段与实际一致；Node 20+ |
| `docs/testing/performance-baseline.md` | 数字/环境/未测边界与 TEST_REPORT 一致 |

## 9. 已知遗留 / 风险

- K-93：光影 3/4 固定分辨率重复轮次 59.8/57.1 FPS；真实显示器/独立 GPU 未测。
- K-87/K-88：桌面 headless/AMD 核显、手机视口模拟，不是真实设备。
- K-89：Windows 定时器粒度；平均 20 TPS，单次 tick 间隔可能 46–62 ms。
- K-92：30 连接是本机 Node 机器人回环，不是真实 LAN/公网。
- K-94：`netStats` 流量按字符串长度近似，不是 UTF-8 字节；中文/emoji 偏低，不影响同步/RTT。
- K-39 已在本机 SwiftShader + CPU 限速修复；真实设备未复测。
- 动态分辨率/低中档裁剪会牺牲部分画面；玩家可切高/极高或关闭动态分辨率。
