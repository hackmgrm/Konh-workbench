# 更新日志

本项目是将 [TongYun Planner](https://github.com/dangzhuotong/tongyun-planner) 移植为思源笔记插件的独立维护版本。

版本号遵循本项目 `plugin.json`；上游版本单独记录，便于后续对照更新。

## [1.0.0] - 2026-11-15

### 项目与品牌

- 插件显示名改为「空核工作台」。
- 插件标识与安装目录改为 `Konh-workbench`。
- 保留旧版 `tongyun-workbench` 数据目录和 JSON 备份兼容说明，不自动删除旧数据。

### 本次移植功能

- 任务、重复任务、提醒、日历、甘特图、归档和完成逻辑。
- 四象限看板：分组导航、搜索、今晚筛选、快速新建、拖拽换象限、详情、置顶、收藏、完成和专注。
- AI 智能收集箱：调用 OpenAI 兼容接口提取任务，支持编辑、勾选和确认后写入。
- 思源内悬浮挂件：卡片、列表、番茄钟、便签和快速新增任务。
- 日记、便签、心流、统计、设置和 JSON 备份导入导出。
- 构建时自动复制思源插件清单和中文语言文件。

### 验证

- `npm run check`：0 errors；保留 5 条既有 CSS 警告。
- `npm test`：12 项测试通过。
- `npm run build`：通过。

## 上游基线

- 上游项目：`https://github.com/dangzhuotong/tongyun-planner`
- 上游版本：`1.2.6`
- 对照源码快照：本地 `.upstream/`（不纳入仓库）；该快照没有 Git 历史，具体 commit SHA 未知，不能断言与上游版本标签完全一致。
- 上游 `1.2.6` 更新日志日期：2026-11-14
- 上游许可证：MIT，完整文本见 [`LICENSE`](LICENSE)

## 后续跟进上游

1. 获取上游仓库的目标 commit（可用 `git clone` 或在已有克隆中 `git fetch`），记录其 SHA、版本和日期；本次快照无 Git 历史，不能直接在其中执行 `git fetch`。
2. 对照上游 `CHANGELOG.md`、`src/` 和数据模型，标记可直接移植、需要改写和不适用于思源的改动。
3. 先在本项目的 `src/` 中移植功能，再运行 `npm run check && npm test && npm run build`。
4. 检查插件标识 `Konh-workbench` 不被上游名称覆盖，避免破坏思源数据目录。
5. 更新本文件的“上游基线”和版本条目后再发布安装包。
