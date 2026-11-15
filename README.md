# 空核工作台 · Konh Workbench

本项目是 [TongYun Planner](https://github.com/dangzhuotong/tongyun-planner) 的思源笔记插件移植版，项目来源、许可证和版本基线见 [`CHANGELOG.md`](CHANGELOG.md)。

## 来源与许可证

- 上游项目：[dangzhuotong/tongyun-planner](https://github.com/dangzhuotong/tongyun-planner)
- 上游当前基线：`1.2.6`（2026-11-14）
- 本项目当前版本：`1.0.0`（2026-11-15）
- 许可证：MIT，见 [`LICENSE`](LICENSE)。本项目保留上游 MIT 版权与许可声明。
- 本次参考的上游源码快照位于原开发环境的 `.upstream/`，不纳入发布仓库；新环境需要自行获取上游源码，后续更新按 [`CHANGELOG.md`](CHANGELOG.md) 的流程对照移植。

## 功能

| 模块 | 说明 |
|---|---|
| 首页 | 问候、日期、天气、今日待办、AI 寄语 |
| 待办 | 添加 / 就地编辑 / 勾选 / 删除 / 筛选 |
| 四象限 | 拖拽卡片在四个象限之间移动，支持完成及 AI 智能收集箱 |
| 日历 | 月视图，任务点与日记点标记，点日期看当天 |
| 日记 | 翻页式手帐，横格纸 + 书脊，自动保存 |
| 专注 | 番茄钟 + 环形进度 + 白噪音（雨声/白噪音/棕噪音/风扇）+ 统计 |
| 便签 | 彩色便签墙，点击编辑，自动配色 |
| 设置 | 番茄时长、休息、目标、城市、白噪音、AI 接口 |

## 环境要求

- 思源笔记 3.0.0 或更高
- Node.js 18+（仅构建时需要）

## 构建

macOS 上双击 `build.command` 即可。或者手动：

```bash
npm install
npm run build
```

产物在 `dist/`：

```
dist/
├── index.js
├── index.css
└── ...
```

## 安装

1. 构建后把 `dist/` 文件夹复制并改名为 `Konh-workbench`
2. 放到 `<思源工作空间>/data/plugins/`
3. 重启思源，在插件管理中启用「空核工作台」

## 开发

```bash
npm run dev
```

改代码后自动重新编译。但思源不会自动重载插件，需要手动在
「设置 → 集市 → 已下载」里关闭再启用，或重启思源。

## 数据

保存在 `data/storage/petal/Konh-workbench/`，随思源同步走。插件标识改名后旧版数据不会自动迁移：请在旧版设置中先导出 JSON 备份，再在新版设置中导入；或在思源完全退出并备份工作空间后，将旧的 `data/storage/petal/tongyun-workbench/` 数据复制到新的 `data/storage/petal/Konh-workbench/`。不要删除旧数据，确认迁移成功后再自行处理。

## 已知限制

- 天气依赖 wttr.in 公共服务，网络不通时不显示
- AI 寄语需要自备 OpenAI 兼容接口
- 资料转待办尚未实现（受 Electron CSP 限制，直接抓外部网页不可靠）
