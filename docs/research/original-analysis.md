# 原始源码复核（research/original-analysis）

- 复核对象：`D:\Projects\OpusMC`（内容等同 `D:\ds\REA\opusmc`，构建 `47455601425408-v39426`）
- 复核时间：2026-11-06
- 标记：**[已确认]** 与既有分析一致；**[已修正]** 数据有误；**[新增]** 本次新发现；**[已失效]** 旧结论不成立；**[尚未确认]** 仍需验证。

## 1. 源码与仓库

| 项 | 结论 | 标记 |
|---|---|---|
| 原始工作区 `D:\ds\REA\opusmc` 有 Git | **没有**；父目录也无 `.git` | [已失效]（"已有 Git 管理"的判断只适用于 Desktop 仓库） |
| `C:\Users\a\Desktop\git` 与源码关联 | 无关：只有 README，无 worktree/submodule | [新增] |
| 脚本数量 | `index.html` 引用 **90** 个脚本，与文件数一致 | [已确认] |
| 源码体积 | 字节数 **18,674,019**；此前的 18,583,312 是字符串长度（UTF-16 计数）不是字节 | [已修正] |
| 加载顺序 | 固定 90 个，顺序见 `index.html`；后加载的补丁包住先加载的 | [已确认] |
| 运行时懒加载 | `chunk_worker.js`、`skins_data.js`、`vstates_data.js`、`emoji.webp` 存在且已纳入项目 | [新增] |
| 音效包 | `sound_events.js` 存在（617 KB），`sounds/sfx/*` 未复制 | [新增] |

## 2. 模块与规模（复核数据）

| 指标 | 值 | 标记 |
|---|---|---|
| 类声明 | 213 | [已确认] |
| 给 `Game.prototype` 加方法的文件 | 28 | [已确认] |
| 跨文件补丁目标 | 19 | [已确认] |
| 无 DOM 引用（可脱离浏览器运行）的文件 | 36（含 `nbt`、`anvil`、`blockdata`、`blocks`、`world`、`entity`、`mesher`、`save`、`redstone`…） | [新增] |
| 数据表 | 方块 1,066 / 物品 1,536 / 配方 1,090 / 群系 66 / 结构 34（模板 1,212）/ 实体 158 / 字幕 1,862 | [已确认] |

## 3. 平台依赖

| 依赖 | 规模 | 标记 |
|---|---|---|
| `Toy.*` 调用 | 54 处（account 36、social 6、extras 5、mobile 4、screens 2、cloudsave 1） | [新增] |
| `Account.*` 调用 | 14 个文件、共 ~210 处 | [新增] |
| `NetClient` 引用 | 6 个文件（net 31、extras 6、telemetry 5、skins 3、social 2、cmdblock 2） | [新增] |
| 房间服务端点 | `/api/public`、`/api/capacity`、`/api/rooms`、`/api/rooms/:code/...` | [已确认] |
| 服务器端代码 | **不存在**：0 个文件创建 HTTP/WS 服务 | [已确认] |

## 4. 渲染与兼容

| 项 | 结论 | 标记 |
|---|---|---|
| 图形 API | `getContext('webgl2')`；扩展仅 `EXT_texture_filter_anisotropic` | [已确认] |
| 纹理/模型 | 图集 + `sampler2DArray`；3,105 个方块模型；814 张实体贴图 | [已确认] |
| 移动端 | 触控层 + 横屏 + 安全区 + 陀螺仪 + 布局编辑；真机未测 | [尚未确认] |
| file:// 限制 | Worker 不可用 → 地形卡顿；必须 http | [已确认]（代码注释 + 实测） |

## 5. 结论

项目源码完整、可独立运行；此前的功能与依赖分析与当前工作区一致，唯一需要修正的是"仓库/体积"两项事实。
