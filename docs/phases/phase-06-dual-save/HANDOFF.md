# phase-06 双存档系统 · 交接（HANDOFF）

- 日期：2026-11-12
- 状态：**已验收（2026-11-12）；代码 `b4833b8`；docs 收尾为当前 HEAD；未推送**
- 起点：HEAD `41042c7`（phase-05 docs 收尾）；phase-05 代码 `817bad3`
- 仓库：`D:\ds\REA\opusmc`
- 分支：`develop`（跟踪 `origin/opusmc-integration`；未新建/切换/重置）
- 工作区：docs 收尾提交后干净；代码提交 `b4833b8`，docs 提交含 8 个项目文档 + 1 个删除 + 3 个新增阶段文档
- 测试：服务端 22/22；浏览器 31/31；phase-05 回归 62/62 + 18/18 + 6/6

## 1. 本阶段目标

把两种世界明确分开，并各自可恢复：

1. 浏览器本地世界继续用 `mc-js-clone` IndexedDB：创建、加载、保存、删除、列表、刷新恢复；
   不依赖服务器/账号/登录。
2. 服务器多人世界继续由 `server/` 持久化：定时保存、正常关闭保存、异常退出后恢复最近定时存档、
   备份、损坏回退、每房隔离。
3. 本地与服务器互不覆盖：不同 ID/目录；同名不覆盖；断线/刷新不删除服务器世界；
   服务器世界不写进浏览器；本地世界不写进服务器数据目录。
4. 旧存档保护：不改数据库/仓库/keyPath；旧 `gen=1/2` 世界可读可保存；旧云存档残留键不删除。

## 2. 实际实现

### 2.1 本地存档（`js/save.js`、`js/game.js`、`js/anvil.js`）

- `DB.SERVER_PREFIX` 判断函数 `DB.isServerWorld(id)`（`srv~` 前缀）。
- `DB.newWorldId()`：`w` + 时间戳 + 随机后缀 + 存在性检查；`Game.createWorld` 与
  `VanillaImport.run` 共用，避免同毫秒/同名世界撞 ID。
- 本地存储 API 对 `srv~` 的纵深防御：
  - `getWorld/loadChunks/chunkKeys/getChunk` 返回空结果；
  - `putWorld/putChunks/deleteWorld` 空操作；
  - `listWorlds` 过滤但不删除泄漏记录。
- `Game.saveWorld`、`Game.quitToTitle`、`Game.captureIcon` 对 `srv~` 世界显式跳过本地保存。
- 数据库名、`worlds`（keyPath `id`）、`chunks` 完全未改；旧本地世界无需迁移。

### 2.2 服务器存档（`server/storage.mjs`、`server/README.md`）

- `loadAll`：
  - `world.json` 解析失败 → 尝试最新可读备份；
  - 能解析但 `_validRecord` 失败 → 也尝试最新备份；
  - 恢复成功 → 原子写回 `world.json`（损坏文件不会成为自己的新备份），日志
    `world_recovered_from_backup` + `world_recovered_written`；
  - 记录的 `dir` 必须与目录名一致，否则 `world_dir_mismatch` 并跳过（不跨房装载）。
- 保留原有：保存串行化、原子写、定时保存、关闭保存、备份轮换、备份保留、SIGINT/SIGTERM/SIGBREAK、
  未捕获异常走 `shutdown()`。

### 2.3 客户端服务器世界（`js/mp.js`）

- `MPClient.buildMeta()` 增加 `server:true`（仅内存元数据，不落本地存档）。
- `MPClient.cleanup()` 在会话结束时清除对应 `g.worldMeta`，避免残留的 `srv~` 元数据。
- `MPServerScreen` 增加“房间世界保存在服务器；与单人世界同名也不会互相覆盖”。

### 2.4 界面区分（`js/screens.js`）

- 标题画面：单人/多人入口的提示分别说明浏览器本地与服务器存档。
- 单人世界列表标题：`选择世界（仅保存在此浏览器）`。
- 创建世界按钮提示：只写本浏览器 IndexedDB。
- 暂停菜单“离开房间”提示：房间世界仍保存在服务器，可凭邀请码再次加入。

### 2.5 关键技术决策

1. **两套存储、两套 ID**：单人继续 `mc-js-clone`；服务器世界 `srv~<邀请码>` 只存
   `server/data/worlds/room-<code>/world.json`；数据库名/仓库/keyPath/区块编码不变。
2. **唯一世界 ID**：`DB.newWorldId()` 用时间戳 + 随机后缀 + 存在性检查；创建与导入共用。
3. **纵深防御**：`save.js` 自身拒绝 `srv~` 的读/写/删/列表，不依赖 `mp.js` 的包装顺序；
   泄漏记录只隐藏不删除。
4. **服务器恢复**：语法损坏**和**结构无效都回退最新可读备份，恢复后写回；`dir` 必须与目录名一致。
5. **旧存档保护**：不做自动迁移；旧 `gen=1/2` 世界直接读取；旧云存档残留不删除。
6. **界面区分**：用标题/提示明确“浏览器本地”和“服务器房间”，不新增统一世界列表。
7. 详见 `docs/DECISIONS.md` ADR-020。

## 3. 测试结果

详见 `TEST_REPORT.md`。

| 套件 | 结果 |
|---|---|
| phase-06 服务端双存档 | **22/22 PASS** |
| phase-06 浏览器双存档 | **31/31 PASS** |
| phase-05 服务端集成回归 | **62/62 PASS** |
| phase-05 双浏览器 E2E 回归 | **18/18 PASS** |
| phase-05 单人回归 | **6/6 PASS** |
| 静态 | 91 JS + 9 mjs `node --check`；87 脚本；`git diff --check`；LF/无 BOM |

旧存档样本：`_work/phase06-legacy-profile`（改造前创建），改造后复验可读、可继续保存，
旧 `cloud` 字段与 `mcjs-cloud-dirty-*`/`mcjs-account` 键未变。

## 4. Git 与验收

| 项 | 值 |
|---|---|
| 分支 | `develop` |
| HEAD | phase-06 代码 `b4833b8`；docs 收尾为当前 HEAD |
| 工作区 | docs 收尾提交后干净；无 staged、无 stash |
| 远程 | 未推送；未合并；未打标签 |
| 验收 | **已验收（2026-11-12）；代码 `b4833b8`；docs 收尾为当前 HEAD** |

本阶段文件：

- 代码提交（7）：`js/anvil.js`、`js/game.js`、`js/mp.js`、`js/save.js`、`js/screens.js`、
  `server/storage.mjs`、`server/README.md`
- 新增（3）：`docs/phases/phase-06-dual-save/{PLAN,TEST_REPORT,HANDOFF}.md`
- 删除（1）：`docs/phases/phase-06-dual-save/.gitkeep`（占位文件）
- 文档更新（8）：`docs/{STATUS,ARCHITECTURE,DECISIONS,KNOWN_ISSUES,PROJECT_SPEC,START-HERE,CHANGELOG}.md`、
  `README.md`

> 已按项目惯例只提交本阶段文件；未 `git add -A`、未 force push、未改写历史。

## 5. 下一阶段前置条件（phase-07 性能）

1. phase-06 已验收并提交：代码 `b4833b8`；docs 收尾为当前 HEAD；未推送。不要改写已提交历史。
2. 保持 `mc-js-clone` 数据库/仓库/keyPath 不变；如未来必须改结构，先导出/备份旧世界并做迁移验证。
3. 保持 `js/mp.js` 对 `srv~` 的拦截和 `js/save.js` 的纵深防御；`mp.js` 必须继续排在 `p2p.js` 之后。
4. 服务器存档仍是 `seed + 覆盖层`；跨版本地形不保证（K-73）。
5. 旧云存档残留（`cloud`、`mcjs-cloud-dirty-*`、`mcjs-account`）不得擅自删除；如要做清理，需用户明确决定。
6. 真实 LAN/公网/TLS/压力/长时间运行仍未测；K-39 留 phase-07。
7. phase-07 建议先读 `docs/testing/performance-baseline.md`，以真实设备测量为准；不得用 headless/SwiftShader
   数据冒充真实 GPU/手机性能；不要为性能删内容或绕过服务端权威。
8. 建议 phase-07 前先确认：K-39 的复现条件、区块/Worker/GPU/内存的真实基线、现有性能开关和
   `docs/testing/regression-checklist.md`。

## 6. 需要特别检查的文件/依赖

| 文件/依赖 | 检查点 |
|---|---|
| `js/save.js` | `isServerWorld`/`newWorldId`；所有本地 API 的 `srv~` 防线；不要改数据库结构 |
| `js/game.js` | `createWorld` 使用 `DB.newWorldId`；`saveWorld/quitToTitle/captureIcon` 的 `srv~` 分支 |
| `js/mp.js` | `server:true`；`cleanup` 清除 `g.worldMeta`；`DB` 包装顺序仍在 `p2p.js` 之后 |
| `js/screens.js` | 标题/列表/创建/暂停菜单的文案；按钮位置未变 |
| `server/storage.mjs` | `loadAll` 的备份回退、写回、`dir` 一致性；`save` 的原子写/备份轮换 |
| `server/README.md` | 恢复步骤与日志事件必须与实现一致 |
| `docs/phases/phase-06-dual-save/` | 本阶段 PLAN/TEST_REPORT/HANDOFF |

## 7. 已知遗留 / 风险

- 旧云存档无法安全迁移：旧房间服务不可用，没有账号数据；只保留本地残留，不删除（K-20/K-46/K-82）。
- 服务器世界不在单人列表：设计如此；多人世界只能通过邀请码/继续上次房间进入（K-83）。
- 异常退出最多丢失 `autosaveSeconds` 内的改动；不承诺零丢失（K-84）。
- 在线恢复备份没有 UI：需停服务器手动复制，或依赖启动时自动回退（K-85）。
- 服务器世界仍是 `seed + 覆盖层`，跨游戏版本不保证（K-73）。
- 真实 LAN/公网/TLS/压力/长时间运行未测（K-70/K-71）。
- 测试环境出现一次快速连续复用 Chrome profile 的 IndexedDB 打开超时，重跑 31/31 通过；
  未在干净 profile 复现，记录为测试噪音，不改核心 DB 打开逻辑（超出 phase-06 范围）。
