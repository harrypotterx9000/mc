# phase-06 双存档系统 · 实施计划（PLAN）

- 日期：2026-11-12
- 阶段：phase-06 双存档系统（本地 IndexedDB 与服务器多人世界）
- 基线：`41042c7`（phase-05 docs 收尾）；phase-05 代码 `817bad3`
- 分支：`develop`（按用户约束不新建/切换/重置分支）
- 工作区：`D:\ds\REA\opusmc`
- 状态：**已验收（2026-11-12）；代码 `b4833b8`；docs 收尾为当前 HEAD；未推送**

## 1. 本阶段目标

把两种世界明确分开并各自可恢复：

1. **浏览器本地世界**：继续使用 `mc-js-clone` IndexedDB；创建、加载、保存、删除、列表、刷新恢复；
   不依赖服务器、账号或登录。
2. **服务器多人世界**：继续由 `server/` 持久化到 `server/data/worlds/room-<code>/world.json`；
   定时保存、正常关闭保存、异常退出后的最近存档、备份、损坏回退、每房隔离。
3. **避免覆盖**：本地世界与服务器世界使用不同的 ID/目录；同名不覆盖；断线/刷新不删除服务器世界；
   服务器世界不写入玩家浏览器；本地世界不写入服务器数据目录。
4. **旧存档保护**：不改动旧 IndexedDB 数据库名/对象仓库结构；保留读取旧 `gen=1`/`gen=2` 世界的能力；
   不删除旧云存档残留键；修改前建立真实的旧存档样本并在修改后复验。

## 2. 现状审计（2026-11-12）

### 2.1 本地存档

- `js/save.js`：`DB.NAME='mc-js-clone'`，`worlds`（keyPath `id`）与 `chunks` 两个仓库自原版未变；
  IndexedDB 失败时回退 localStorage/内存；有 `listWorlds/getWorld/putWorld/deleteWorld/loadChunks/
  chunkKeys/getChunk/putChunks`。
- `js/game.js`：`createWorld`（`w` + 时间戳）、`loadWorld`、`saveWorld`（元数据 + 脏区块）、
  `quitToTitle`；刷新恢复由启动时 `DB.listWorlds` + 区块加载完成。
- `js/screens.js`：`WorldListScreen` 世界列表、`CreateWorldScreen` 创建、`EditWorldScreen` 编辑、
  `ConfirmScreen` 删除；`js/anvil.js` 导入原版存档。
- 结论：本地功能存在，不需要重写；需要补唯一 ID、服务器 ID 防线和同名/删除测试。

### 2.2 服务器存档

- `server/storage.mjs`：每房一个目录、原子写、保存前按间隔备份、保留份数、启动读取失败时回退最新备份。
- `server/rooms.mjs`：`Room.toRecord()`、按房串行保存、`autosaveSeconds`、断线保存、关闭房间保存、
  `stop()` 逐房保存。
- `server/index.mjs`：SIGINT/SIGTERM/SIGBREAK、未捕获异常走 `shutdown()`，先停连接再保存。
- 结论：任务 2 的主体已在 phase-05 实现；phase-06 补强“world.json 结构损坏（能解析但字段无效）也回退备份”，
  并将恢复结果写回，避免每次启动重复回退。

### 2.3 冲突面

- `js/mp.js` 已把 `srv~<邀请码>` 的 `DB.getWorld/putWorld/putChunks/getChunk/chunkKeys` 拦截；
  服务器世界不写 IndexedDB；客户端 `saveWorld` 在房间内只发 `pstate`。
- 风险：拦截只在 `mp.js` 加载后生效；`saveWorld` 只看 `mpClient`，不看 `worldMeta.id`；
  本地世界 ID 仅按毫秒生成，同毫秒/多标签页可能撞 ID；`DB.listWorlds` 没有过滤 `srv~` 的防线。
- 结论：加“纵深防御”，不改变既有 `srv~` 协议与包装顺序。

### 2.4 旧存档

- 数据库名、仓库、keyPath 自原版未变；`meta.gen` 缺省按 1 处理，`gen=2` 才调用新生成器，
  旧超平坦/旧世界可直接读取。
- phase-03 删除云存档后，本地 `mcjs-cloud-dirty-*`、`cloud` 字段、`mcjs-account` 等成为死数据；
  当前代码不读取、不删除。
- 结论：本阶段不做数据格式迁移；先建立真实旧存档样本（当前代码创建的同名世界、旧云字段、旧键），
  改造后复验可读、可保存、不改写/删除旧键。

## 3. 实施内容

### 3.1 本地存档（`js/save.js`、`js/game.js`、`js/anvil.js`）

1. `DB.isServerWorld(id)`：统一判断 `srv~` 前缀。
2. `DB.newWorldId()`：`w` + 时间戳 + 随机后缀，并检查已存在；`createWorld` 与 `anvil` 导入共用，
   避免同名/同毫秒生成相同 ID 覆盖。
3. `DB` 的写/删/读接口对 `srv~` 做本地空操作/空结果（`listWorlds` 过滤但不删除）；
   即使 `mp.js` 未加载或包装顺序被破坏，服务器世界也不会进入本地 IndexedDB。
4. `Game.saveWorld/quitToTitle/captureIcon` 对 `srv~` 世界做显式保护；`mp.js` 仍保留原有拦截。
5. 不改数据库名、对象仓库、keyPath、编码格式；旧世界无需迁移即可读取。

### 3.2 服务器存档（`server/storage.mjs`、`server/README.md`）

1. `loadAll`：`world.json` 解析失败或记录结构无效时都尝试最新备份；恢复成功后在内存中使用，
   并原子写回 `world.json`（不再以损坏文件为当前存档），日志记录恢复与写回。
2. 校验 `record.dir` 与目录名一致，避免把 A 房记录装进 B 房（每房隔离的防御）。
3. 保留现有定时保存、关闭保存、信号/异常保存、备份轮换、备份保留、原子写与逐房串行。
4. README 补充：结构损坏也会回退备份、恢复后写回、手动恢复步骤、本地/服务器世界边界。

### 3.3 冲突防线与界面说明（`js/mp.js`、`js/screens.js`）

1. 服务器世界元数据加 `server: true`（仅客户端内存标记，不进入本地存档）。
2. 单人入口/世界列表/创建按钮补充“只保存在此浏览器”的提示；服务器入口补充
   “房间世界保存在服务器，与单人世界同名也不覆盖”。
3. 暂停菜单“离开房间”提示世界仍在服务器；不改变按钮位置与流程。

### 3.4 旧存档保护

1. 修改代码前用**当前代码**在独立 Chrome 配置中创建：
   - 两个同名本地世界（一个 `gen=2`，一个 `gen=1` 超平坦）；
   - 一个带旧 `cloud` 元数据的世界；
   - 旧 `mcjs-cloud-dirty-*` 与 `mcjs-account` 键。
2. 修改后用同一配置复验：两个世界仍在列表、方块仍恢复、旧键/旧字段仍在、没有 `srv~` 记录。
3. 不删除、不迁移任何旧云存档残留；无法安全迁移的旧云存档保持原样。

## 4. 测试计划

1. 静态：全部 `js/*.js`、`server/*.mjs` `node --check`；`index.html` 脚本数；`git diff --check`；
   LF/BOM 检查。
2. 本地浏览器：创建/进入/放方块/保存/退出/列表/刷新恢复/删除；同名世界两条独立记录；
   旧存档样本复验；旧键不被删除；`srv~` 不进入 IndexedDB。
3. 服务器：同房名两房隔离；断线不删世界；刷新/重启后仍在；正常关闭保存；定时保存；
   备份生成/保留；`world.json` 语法损坏与结构损坏都回退备份并写回；房间目录/代码隔离。
4. 冲突：本地世界与服务器房间同名，双方方块/元数据互不影响；离开/刷新后本地世界仍可读；
   服务器世界不出现在单人列表；本地世界不出现在服务器数据目录。
5. 回归：phase-05 服务端 62 项、双浏览器 E2E、单人回归（至少服务端集成 + 单人回归；时间允许再跑双浏览器）。
6. 证据：`D:\ds\REA\_work\phase06-*`（脚本、JSON、截图、服务器临时数据）。

## 5. 明确不做

- 不新增账号、登录、云存档或跨设备同步。
- 不改 `mc-js-clone` 的数据库名/仓库/keyPath，不做本地世界格式迁移。
- 不把服务器世界做成浏览器可下载副本；不新增公开房间列表。
- 不实现旧云存档从已失效旧服务的下载/恢复（服务已不可用，且无权恢复账号数据）。
- 不修改 `p2p.js`、`net.js` 的旧多人路径；不重写渲染/世界生成/玩法。
- 不做 phase-07 性能、phase-08 部署、跨版本地形迁移（K-73）。

## 6. 实际结果（2026-11-12）

- 服务端双存档 **22/22 PASS**；浏览器双存档 **31/31 PASS**；旧存档样本复验通过。
- phase-05 回归：服务端 **62/62**、双浏览器 **18/18**、单人 **6/6**；91 JS + 9 mjs `node --check`；
  `index.html` 87 脚本；`git diff --check`；LF/无 BOM。
- 文件：7 个代码/服务器说明 + 1 个删除 + 8 个项目文档 + 3 个新增阶段文档；代码提交 `b4833b8`，docs 收尾为当前 HEAD。
- 详细：`TEST_REPORT.md`、`HANDOFF.md`。
