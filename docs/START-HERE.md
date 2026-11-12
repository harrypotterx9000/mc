# OpusMC — 从这里开始（新会话入口）

> 这是给下一次 DeepSeek Harness 会话的**第一份必读文件**。读完本页即可接管项目。
> 最后更新：2026-11-12（phase-04 完成并验收通过，代码 `553ceed`；用户明确不补测真实 Android/iOS，K-39 留 phase-07；phase-05 未开始）

## 1. 三十秒摘要

- 项目：把 B 站 Toy 版浏览器体素游戏 OpusMC 改造成**独立运行、无账号访客、自建服务器**的版本。
- 现状：**phase-00 完成；phase-01/02/03 完成并验收（phase-03 端到端联机/重连 BLOCKED）；phase-04 完成并验收通过（带用户明确豁免）；phase-05 未开始。**
- 代码：会话工作区 `D:\ds\REA\opusmc`；phase-04 代码 `553ceed`；docs 收尾为当前 HEAD。
- 工作区：**干净**；未推送、未合并。
- 分支：按用户指令**未创建/切换/重置 `phase/*` 分支**；phase-01/02/03/04 都在 `develop`。
- 远程：`https://github.com/harrypotterx9000/mc`；PR #1 仍打开，未合并。

> **路径注意**：`D:\Projects\OpusMC` 是 phase-01 的同内容副本；phase-02/03/04 只在 `D:\ds\REA\opusmc`。
> 如以 `D:\Projects\OpusMC` 为准，需要用户确认后单独同步，禁止直接覆盖。

## 2. 阅读顺序

1. `docs/START-HERE.md`（本文件）
2. `docs/PROJECT_SPEC.md` —— 长期总规范（§11.9 phase-04 约束）
3. `docs/STATUS.md` —— 当前阶段、Git、测试与待办
4. `docs/ARCHITECTURE.md` —— 分层、补丁矩阵、§13 phase-04 变更
5. `docs/DECISIONS.md` —— ADR-001…017（ADR-016/017 为 phase-04）
6. `docs/KNOWN_ISSUES.md` —— K-01…K-66、NOT TESTED
7. `docs/phases/phase-04-browser/ACCEPTANCE.md` —— 独立验收报告（最终结论）
8. `docs/phases/phase-04-browser/HANDOFF.md` —— 本阶段交接
9. `docs/phases/phase-04-browser/TEST_REPORT.md` —— 实现测试结果
10. `docs/phases/phase-04-browser/PLAN.md` —— 实施计划
11. `docs/phases/phase-03-guest-mode/HANDOFF.md` —— 上一阶段历史
12. `docs/phases/phase-03-guest-mode/ACCEPTANCE.md` —— 上一阶段独立验收

## 3. Git 现实（以实际仓库为准）

| 项 | 值 |
|---|---|
| 仓库 | `D:\ds\REA\opusmc`（会话工作区） |
| 当前分支 | `develop`（跟踪 `origin/opusmc-integration`） |
| HEAD | docs 收尾为当前 HEAD（见 `git log -1`） |
| 代码基线 | `2798c08`（`v0.1.0-integration`） |
| phase-01 代码 | `15154bd` |
| phase-02 代码 | `a9dc47b` |
| phase-03 代码 | `025cba8` |
| phase-04 代码 | `553ceed`（已提交；docs 收尾为当前 HEAD） |
| 标签 | `v0.1.1-context`、`v0.1.0-integration`、`v0.1.0-preproject`、`v0.0.0-original` |
| 远程 | 未推送 phase-04；PR #1 未合并；未强推 |

## 4. 运行方式

```powershell
cd D:\ds\REA\opusmc
node scripts\serve.mjs      # 默认 127.0.0.1:8080
# Chrome / Edge 打开 http://127.0.0.1:8080/
```

- 直接双击 `index.html`（file://）**不可用**：页面会显示“请通过本地服务器打开”，并给出 `node scripts/serve.mjs`。
- 端口占用：`$env:PORT=8081; node scripts\serve.mjs`。
- 手机/局域网测试：`$env:HOST='0.0.0.0'; node scripts\serve.mjs`（仅测试；生产部署留 phase-08）。
- 无头测试：Edge 157 / Chrome 157 + `--headless=new --use-angle=swiftshader --remote-debugging-port=...`；测试脚本在仓库外 `D:\ds\REA\_work\phase04-*.mjs`。

## 5. 当前边界（务必遵守）

- phase-04 已验收、代码已提交；**未推送**。推送/合并/PR 需用户另行确认。
- 不擅自开始 phase-05 或任何游戏功能改造；每个阶段必须等用户明确指令。
- 已提交/已推送的历史不得改写；不 force push。
- 不新增强制账号/登录；不引入永久账号体系。
- 没有实测的功能一律标 **NOT TESTED**；推断不得写成事实。
- 真实 Android/iOS 真机、iOS WebKit、真实 GPU 性能未测；用户已明确不补测真机，但仍不能写成已通过。
- K-39 `chunk stall` 留 phase-07；phase-04 的 Chrome headless 2 项失败属此，不要写成已修复。

## 6. phase-04 已完成内容

1. 新增 `js/platform.js`：能力探测、阻断/降级、兼容性面板、安全存储、Web Audio、Worker、文件 API、
   全屏/方向/键盘锁定、Pointer Lock、安全区/visualViewport、本地资源 URL、WebGL/Canvas 获取与上下文丢失。
2. `index.html`：85 → 86 个脚本；启动进度、资源失败/超时、`file://` 提示、兼容性面板、favicon。
3. `scripts/serve.mjs`：自有静态白名单；拒绝 docs/scripts/server/.git/点文件/目录/穿越；ETag/304；缓存。
4. 桌面：键盘、鼠标、指针锁定/释放、全屏；指针锁定失败自由鼠标降级并提示；F11 防双触发。
5. 移动：摇杆、跳跃、攻击、使用、互动、多点触控、振动；`visualViewport`、安全区、横屏、竖屏旋转 90° 映射。
6. 兼容性：`file://`、无 WebGL2、上下文丢失有中文提示；缺 Worker/localStorage 可降级。
7. 网络边界：`NET_CONFIG.announce=false`，单机后台不再轮询旧房间服务；多人功能留 phase-05。
8. 测试：Edge 157 37/37、Chrome 157 37/37、Chrome 83 9/9、Android/iOS 模拟 21/21、降级 7/7、
   兼容性 3/3；90 JS `node --check`；0 未捕获异常；正常 `game.errLog` 为空。

## 7. 测试结果（phase-04）

- 桌面 Edge 157：**37 PASS / 0 FAIL**；65 s 游玩无第三方请求。
- 桌面 Chrome 157：**37 PASS / 0 FAIL**。
- 旧 Chrome 83：**9 PASS / 0 FAIL**（旧 headless `chunk stall` 已知噪音）。
- Android/iOS 模拟：**21 PASS / 0 FAIL**；真实设备 **NOT TESTED**（用户明确不补测）。
- 降级（无 Worker/localStorage）：**7 PASS / 0 FAIL**。
- 兼容性面板：**3/3**。
- 独立验收：Edge **44/44**；Chrome **43/45**（2 项 K-39 `chunk stall`，延期 phase-07）；移动模拟 **25/25**；兼容/降级 **7/7**；phase-03 回归 **33/33**。
- **用户验收通过（带豁免）**：真实 Android/iOS 不补测；K-39 留 phase-07；受信任 F11、文件选择/下载 NOT TESTED。
- 截图/结果：`D:\ds\REA\_work\phase04-*`、`D:\ds\REA\_work\accept04-*`；详细：`docs/phases/phase-04-browser/{ACCEPTANCE,TEST_REPORT}.md`。

## 8. 目录与证据

```
D:\ds\REA\opusmc\
  index.html        游戏页面（86 个脚本）
  js\               90 个 .js + emoji.webp（新增 platform.js）
  sounds\sfx\       4,849 个原版音效（43.2 MB）
  scripts\serve.mjs 自有静态服务器（白名单/缓存/ETag）
  docs\             项目文档与阶段记录
  server\           自建服务器（仅 .gitkeep，phase-05）
```

- 原始源码备份：`D:\ds\REA\_backup\opusmc-original-2026-11-06.zip`（如仍存在）
- phase-04 截图/结果：`D:\ds\REA\_work\phase04-*.png`、`phase04-*-result.json`
- 测试脚本：`D:\ds\REA\_work\phase04-*.mjs`（在仓库外，不随项目提交）
- 历史分析报告：`docs/research/*.md`

## 9. 已知噪音（不是新 bug）

- 控制台会有 `missing tile i_waxed_*_copper_door` / `missing tile all` 警告（原版存在）。
- 房间服务 `xz.honghemc.cn:8443` 在本机返回 403/CORS；多人界面公开房间列表显示红色错误（phase-05 自建）。
- 无头 SwiftShader 世界加载偶发 `chunk stall`（watchdog 重新请求区块）；世界最终进入 `play`。
- SwiftShader 下画质基准会报 `GPU stall due to ReadPixels`。
- `favicon.ico` 已由自有 `favicon.svg` 替代，不再 404。

## 10. 下一步

1. phase-04 代码 `553ceed` 与 docs 已提交；**未推送**。推送/合并/PR 需用户另行确认，禁止强推。
2. phase-05 自建服务器必须处理：临时玩家 ID 签发/校验、真实短时重连、房间所有权（F-1）、`/api/skin`、
   管理员公告、旧 `mcjs-room-key`、服务端权威存档；届时决定是否恢复 `NET_CONFIG.announce`。
3. 用户已明确不补测真实 Android/iOS；后续发布验收前仍应重新评估，不要把模拟写成真机通过。
4. K-39 留 phase-07；phase-05 不改它。
5. 不提前开始 phase-05；等待用户明确指令。
