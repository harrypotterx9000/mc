# OpusMC

独立运行的浏览器体素游戏（WebGL2，无引擎、无构建步骤）。本仓库是原 OpusMC 构建
`47455601425408-v39426` 的独立项目副本，用于去 B 站化、访客模式与自建服务器改造。

## 快速开始

```powershell
node scripts/serve.mjs
# Edge 打开 http://127.0.0.1:8080/
```

零依赖；服务器只绑定 `127.0.0.1`。

## 目录

```
index.html        游戏页面
js/               游戏源码（原始文件名与加载顺序）
sounds/sfx/       原版音效（4,849 个 m4a）
scripts/          本地开发脚本（静态服务器）
docs/             项目文档
server/           自建多人服务器（后续阶段）
```

## 文档

- [项目总规范](docs/PROJECT_SPEC.md)
- [架构说明](docs/ARCHITECTURE.md)
- [技术决策](docs/DECISIONS.md)
- [当前状态](docs/STATUS.md)
- [已知问题](docs/KNOWN_ISSUES.md)
- [变更记录](docs/CHANGELOG.md)
- [初始化阶段](docs/phases/phase-00-initialization/HANDOFF.md)

## 版本

- `v0.0.0-original`：原始源码（未改动）
- `v0.1.0-preproject`：初始化基线

## 说明

原版素材版权归原作者；本项目仅用于个人改造与学习。未开始任何游戏功能改造。
