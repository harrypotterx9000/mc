# 回归检查清单（testing/regression-checklist）

> 每个阶段结束前逐项执行；未执行的项标 **NOT TESTED**，不得默认通过。

## A. 启动与加载

- [ ] `node scripts/serve.mjs` 启动无报错，`http://127.0.0.1:8080/` 返回 200
- [ ] 页面通过 http(s) 打开；`file://` 显示“请通过本地服务器打开”
- [ ] 86 个页面脚本全部 200；`js/platform.js` 第一个加载
- [ ] 90 个 `js/*.js` 全部 `node --check` 通过
- [ ] `js/sound_events.js`、`js/emoji.webp`、抽检 `sounds/sfx/*.m4a` 返回 200
- [ ] 字体图集、贴图、游戏数据加载；标题界面出现，背景世界渲染正常
- [ ] 控制台无新增红色错误；`game.errLog` 为空
- [ ] `Platform.fatal()` 为空（正常浏览器）
- [ ] Worker：`gen_worker.js` 有实例、`chunk_worker.js` ready
- [ ] WebGL 上下文丢失时出现可读的重新加载面板

## B. 单人核心

- [ ] 创建世界（gen2）并进入
- [ ] 移动 / 跳跃 / 视角 / 冲刺
- [ ] 破坏方块、放置方块
- [ ] 背包打开、拿取、移动、丢弃
- [ ] 2×2 与工作台合成
- [ ] 熔炉/箱子可用
- [ ] 保存退出 → 刷新 → 世界仍在
- [ ] 设置（FOV 等）刷新恢复

## C. 阶段相关（phase-04）

- [ ] 标题「单人游戏」→ 世界列表 → 创建 → 进入 `play`
- [ ] 键盘/鼠标输入；Pointer Lock 请求/释放；全屏请求/退出
- [ ] 指针锁定被浏览器拒绝时，自由鼠标降级 + 一次提示，不反复弹暂停
- [ ] `Platform.resource()` 解析的 Worker/音效/emoji/懒加载路径全部 200
- [ ] 启动/标题/单人游玩无第三方平台请求；无后台 `/api/announce`
- [ ] 服务器只服务 `index.html`、`js/*`、`sounds/sfx/*`、`favicon.svg`；docs/scripts/server/.git/穿越 403
- [ ] HTML/JS 返回 ETag，条件请求 304；音效 `max-age=2592000`
- [ ] 移动模拟：竖屏 CSS 旋转、横屏、安全区、`visualViewport` 变化
- [ ] 移动模拟：摇杆/跳跃/攻击/使用/互动/多点触控
- [ ] 禁用 Worker/localStorage 仍能启动并创建世界（降级）
- [ ] 无 WebGL2 / `file://` 有清晰兼容性提示
- [ ] Android Chrome / iOS Safari 真机：**NOT TESTED**；phase-04 用户已明确不补测，不得写成通过
- [ ] 真实 GPU FPS / 手机发热：**NOT TESTED**（phase-07）

## D. 联机（有服务器后）

- [ ] 创建房间 → 邀请码加入
- [ ] 两名玩家看到彼此、方块同步
- [ ] 玩家退出/重进
- [ ] 服务器重启后世界恢复

## E. 性能（真实设备）

- [ ] 电脑 1080p 目标 60 FPS（记录 F3 的 p50/p95）
- [ ] 手机目标 30 FPS（记录机型、画质档）
- [ ] 光影 0/2/4 档对比记录
