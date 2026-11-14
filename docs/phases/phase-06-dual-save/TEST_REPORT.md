# phase-06 双存档系统 · 实现测试报告（TEST_REPORT）

- 日期：2026-11-12
- 阶段：phase-06 双存档系统
- 分支：`develop`（未新建/切换/重置）
- 起点：HEAD `41042c7`（phase-05 docs 收尾）；phase-05 代码 `817bad3`
- 状态：**已验收（2026-11-12）；代码 `b4833b8`；docs 收尾为当前 HEAD；未推送**
- 环境：Windows 10/11，Node.js v26.13.0，Chrome 157.0.8103.51（headless + SwiftShader）
- 测试代码：`D:\ds\REA\_work\phase06-*.mjs`（仓库外，不随项目提交）
- 证据：`D:\ds\REA\_work\phase06-*`、`phase06-server-result.json`、`phase06-browser-result.json`、
  `phase06-legacy-fixture.json`、`phase06-local-world.png`

## 1. 总结

| 套件 | 结果 | 说明 |
|---|---|---|
| phase-06 服务端双存档 | **22 PASS / 0 FAIL** | 同房名隔离、定时保存、断线存活、重启/恢复、备份、语法/结构损坏回退并写回、异常退出恢复 |
| phase-06 浏览器双存档 | **31 PASS / 0 FAIL** | 旧存档、创建/列表/删除/刷新、同名世界、服务器房间同名隔离、刷新恢复、断线/离开、`srv~` 不进 IndexedDB |
| phase-05 服务端集成回归 | **62 PASS / 0 FAIL** | 协议/权限/同步/存档/备份/关闭/限流 |
| phase-05 双浏览器 E2E 回归 | **18 PASS / 0 FAIL** | 创建/加入/互看/移动/方块/聊天/重连/踢人/关房 |
| phase-05 单人回归 | **6 PASS / 0 FAIL** | 87 脚本、创建世界、方块、IndexedDB 保存、刷新恢复 |
| 静态语法 | PASS | 91 个 `js/*.js` + 9 个 `server/*.mjs` `node --check` |
| 页面脚本 | 87 | `index.html` 脚本数未变 |
| Diff / 行尾 / BOM | PASS | `git diff --check`；本阶段文件 LF、无 BOM |

## 2. 服务端测试（22/22）

命令：

```powershell
node D:\ds\REA\_work\phase06-server-test.mjs
```

脚本自起临时服务器（临时 `dataDir`），不污染项目 `server/data`。

| # | 测试 | 结果 |
|---|---|---|
| 1 | 两个同名房间获得不同邀请码 | PASS |
| 2 | 房间 A 的方块经定时保存写入 A 的 `world.json` | PASS |
| 3 | 房间 B 的方块只写入 B，不出现在 A | PASS |
| 4 | 同名房间使用独立目录和记录（`dir`/`code`/`seed`） | PASS |
| 5 | 两房都生成周期备份 | PASS |
| 6 | 备份包含方块覆盖层 | PASS |
| 7 | 玩家断线后两房世界文件仍在 | PASS |
| 8 | 断线房间仍保留、在线数为 0 | PASS |
| 9 | 正常关闭退出 0、删除 pid | PASS |
| 10 | 重启恢复房间 A 且只含 A 方块 | PASS |
| 11 | 重启恢复房间 B 且只含 B 方块 | PASS |
| 12 | 会话令牌重启后仍可恢复同一临时 ID | PASS |
| 13 | `world.json` 语法损坏回退最新备份 | PASS |
| 14 | 恢复记录写回，日志含 `world_recovered_from_backup` / `world_recovered_written` | PASS |
| 15 | `world.json` 可解析但结构无效也回退备份 | PASS |
| 16 | 结构恢复写回并记录 `world_record_invalid` | PASS |
| 17 | 记录 `dir` 与目录名不符时拒绝加载（不跨房装载） | PASS |
| 18 | 异常退出前最后一次定时保存已落盘 | PASS |
| 19 | 进程被 `SIGKILL` 终止（非正常关闭） | PASS |
| 20 | 重启后恢复异常退出前的最近定时存档 | PASS |
| 21 | 最终正常关闭后所有房间文件仍在 | PASS |
| 22 | 数据目录只有 `room-<code>`，没有浏览器世界名 | PASS |

关键日志：`world_recovered_from_backup`、`world_recovered_written`、`world_record_invalid`、
`world_dir_mismatch`、`world_saved`、`shutdown_done`。

## 3. 浏览器测试（31/31）

命令：

```powershell
node D:\ds\REA\_work\phase06-browser-test.mjs
```

使用改造前生成的 `phase06-legacy-profile`（同一 `http://127.0.0.1:18085` 源），
服务器使用临时 `dataDir`。测试结束后不修改仓库运行数据。

### 3.1 旧存档

| 测试 | 结果 |
|---|---|
| 改造前创建的两个同名世界仍在列表（`gen=2` 与 `gen=1` 超平坦） | PASS |
| 旧世界保留 `gen`、`flat` 与旧 `cloud` 元数据字段 | PASS |
| 旧 `gen=2` 世界载入并恢复方块 | PASS |
| 旧 `gen=1` 超平坦世界载入并恢复方块 | PASS |
| 旧 `mcjs-cloud-dirty-*` 与 `mcjs-account` 键仍在 | PASS |
| 新版本再次保存旧世界后，旧方块、新方块、`cloud` 字段都保留 | PASS |

### 3.2 本地存档

| 测试 | 结果 |
|---|---|
| 单人列表标题标注“仅保存在此浏览器” | PASS |
| 同一毫秒内两次 `DB.newWorldId()` 返回不同 ID | PASS |
| 两个同名本地世界获得不同 ID | PASS |
| 列表同时显示两个同名世界 | PASS |
| 删除一个同名世界后另一个仍可载入，被删世界区块清空 | PASS |
| 刷新页面后本地世界仍在 | PASS |
| 刷新后本地世界方块恢复 | PASS |
| 本地列表中没有 `srv~` / `server` 标记 | PASS |

### 3.3 本地与服务器隔离

| 测试 | 结果 |
|---|---|
| 服务器房间使用 `srv~<邀请码>`，房间名可与本地世界同名 | PASS |
| 服务器房间方块写入 `server/data/worlds/room-<code>/world.json` | PASS |
| 服务器世界不进入浏览器 IndexedDB | PASS |
| 服务器房间不出现在单人世界列表 | PASS |
| 人为泄漏的 `srv~` 记录被列表隐藏、本地删除拒绝 | PASS |
| 刷新页面后会话仍在 `sessionStorage` | PASS |
| 刷新 + resume 恢复服务器世界与方块 | PASS |
| 离开房间后服务器世界文件仍在 | PASS |
| 同名本地世界不受服务器房间影响 | PASS |
| 强制客户端断线不删除服务器世界 | PASS |
| 服务器数据目录只有 `room-<code>` 记录 | PASS |
| 全流程结束后 IndexedDB 仍无 `srv~` 记录 | PASS |
| 本地世界在房间/刷新/离开/断线后仍可载入 | PASS |
| 旧云/账号键逐字节未变 | PASS |
| 无游戏错误、无未捕获异常 | PASS |

## 4. 旧存档保护

1. **修改前样本**：在 `phase06-legacy-profile` 中用改造前代码创建两个同名世界（一个 `gen=2`、
   一个 `gen=1` 超平坦），设置旧 `cloud` 元数据、`mcjs-cloud-dirty-*`、`mcjs-account`，并把样本
   写入 `phase06-legacy-fixture.json`。
2. **修改后复验**：同一 Chrome profile、同一 origin 载入；两个世界可读、方块可恢复、可继续保存；
   旧 `cloud` 字段和旧 localStorage 键未被删除或改写。
3. **数据库结构未改**：`DB.NAME='mc-js-clone'`、`worlds`（keyPath `id`）、`chunks` 均保持原样，
   因此旧本地世界不需要数据迁移。
4. **旧云存档**：旧服务已不可用，无法安全拉取/迁移；本项目**没有**删除 `mcjs-cloud-dirty-*`、
   `cloud` 字段或 `mcjs-account`，也没有新增“清理死数据”逻辑。

## 5. 回归

| 命令 | 结果 |
|---|---|
| `node D:\ds\REA\_work\phase05-server-test.mjs` | 62 PASS / 0 FAIL |
| `node D:\ds\REA\_work\phase05-browser-test.mjs`（先起 18080 测试服务器） | 18 PASS / 0 FAIL |
| `node D:\ds\REA\_work\phase05-sp-regression.mjs`（先起 18080 静态服务器） | 6 PASS / 0 FAIL |
| 91 JS + 9 mjs `node --check` | PASS |
| `index.html` 脚本数 | 87 |
| `git diff --check` | PASS |
| 本阶段文件 LF / 无 BOM | PASS |

## 6. 本阶段文件

修改（7 个代码/服务器说明 + 8 个项目文档，共 15 个）：

- `js/save.js`：`DB.isServerWorld`、`DB.newWorldId`、本地读写/删除对 `srv~` 的防线、列表过滤。
- `js/game.js`：创建世界使用唯一 ID；`saveWorld/quitToTitle/captureIcon` 对服务器世界显式保护。
- `js/anvil.js`：导入原版存档使用同一唯一 ID 分配器。
- `js/mp.js`：服务器世界元数据 `server:true`；清理时丢弃 `srv~` 元数据；界面说明服务器/单机存档分开。
- `js/screens.js`：单人/多人入口、世界列表、创建、离开房间的存档说明。
- `server/storage.mjs`：结构无效也回退备份；恢复后写回；`dir` 与目录名的一致性检查。
- `server/README.md`：存档隔离、损坏恢复、写回、日志事件说明。

项目文档更新：`README.md`、`docs/{STATUS,ARCHITECTURE,DECISIONS,KNOWN_ISSUES,PROJECT_SPEC,START-HERE,CHANGELOG}.md`。

新增：

- `docs/phases/phase-06-dual-save/PLAN.md`
- `docs/phases/phase-06-dual-save/TEST_REPORT.md`（本文件）
- `docs/phases/phase-06-dual-save/HANDOFF.md`

删除：

- `docs/phases/phase-06-dual-save/.gitkeep`（占位文件；目录已有阶段文档）

## 7. 未测 / 边界 / 测试环境噪音

- **真实局域网双设备、公网、TLS、10 人压力、长时间运行**：未测（phase-05 边界，见 K-71/K-70）。
- **跨游戏版本地形/存档迁移**：不做（K-73）；服务器世界仍是 `seed + 覆盖层`。
- **旧云存档从旧服务恢复**：不做；旧服务不可用，且没有账号数据（K-20/K-46/K-82）。
- **服务器世界在线“下载到本地”**：不做；服务器世界不在单人列表（设计）。
- **异常退出零丢失**：不承诺；最多可能丢失 `autosaveSeconds` 间隔内的改动（默认 60 秒），
  本测试用 1 秒配置验证了“最近一次定时保存可恢复”。
- **测试环境噪音**：在快速连续复用同一 Chrome profile 的一轮中，刷新后 `DB.listWorlds()` 返回空、
  世界未进入 play；同一脚本立即重跑 **31/31 PASS**。未在干净 profile 复现；
  已记录为 headless/profile 复用的测试环境观察，不作为产品结论。刷新恢复的稳定证据来自 31/31
  轮与 phase-05 单人回归 6/6。

## 8. 证据

| 文件 | 内容 |
|---|---|
| `_work/phase06-server-test.mjs` | 服务端 22 项测试 |
| `_work/phase06-server-result.json` | 服务端结果 |
| `_work/phase06-server-2026-11-12T13-46-40-091Z/` | 临时数据、备份、日志 |
| `_work/phase06-browser-test.mjs` | 浏览器 31 项测试 |
| `_work/phase06-browser-result.json` | 浏览器结果 |
| `_work/phase06-local-world.png` | 最终画面 |
| `_work/phase06-legacy-fixture.mjs` / `.json` | 改造前旧存档样本与元数据 |
| `_work/phase06-legacy-profile/` | 旧存档 Chrome profile |
| `_work/phase05-server-test-2026-11-12T13-32-58-435Z/result.json` | phase-05 服务端回归 62/62 |
| `_work/phase05-browser-result.json` | phase-05 双浏览器回归 18/18 |
| `_work/phase05-sp-result.json` | phase-05 单人回归 6/6 |
