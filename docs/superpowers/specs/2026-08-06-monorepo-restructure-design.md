# coding-plan-assistant Monorepo 重组设计

日期：2026-08-06
状态：已获用户确认（设计层面）

## 背景

- 当前仓库：`miaosha-GLM`（GitHub: `Rocke1001feller/miaosha-GLM`），WXT + Svelte 5 Chrome 扩展，当前版本 v2.0.0，已有一定数量 stars。
- 兄弟项目：`../CodingPlanAssistant`（GitHub: `Rocke1001feller/CodingPlanAssistant`），Swift/SwiftUI macOS 菜单栏应用，当前版本 v1.4.1，提供菜单栏 / 菜单栏浮层 / 桌面浮窗三个表面，通过 `docs/BRIDGE-PROTOCOL.md` 定义的本地桥与扩展对接（桥为可选增强通道）。
- 目标：一个仓库，多端。GitHub 仓库改名 `coding-plan-assistant`，删除旧 desktop 仓，插件进入 v3.0.0，新历史从 orphan 提交开始。

## 已确认的关键决策

| 决策点 | 结论 |
| --- | --- |
| Desktop 技术栈 | Swift 应用先原样迁入 `desktop/`；Tauri 2.0 重写作为后续独立项目 |
| Git 历史 | orphan 新历史 + `archive/v2`（扩展）与 `archive/desktop-v1`（桌面）存档分支 |
| 顶级目录 | `web/` + `desktop/` + `shared/`（全小写无空格），后续 `mobile/` |
| 旧 desktop 仓 | 直接删除（删除前必须有 archive 分支 + 本地 mirror 备份） |
| 清理时机 | 先搬后清；全部清理完毕后才做 orphan 提交，orphan 首次提交即干净状态 |
| Mobile 路线 | 两阶段：PWA 过渡 → Tauri 2.0 移动端；本次不 scaffold `mobile/` 目录 |

## 目标结构

```
coding-plan-assistant/                  # 仓库根（GitHub repo 改名后同名）
├── web/                                # WXT Chrome 扩展（当前项目整体迁入）
│   ├── entrypoints/  src/  lib/  public/  scripts/  tests/
│   ├── package.json                    # name: coding-plan-assistant-web, version: 3.0.0
│   ├── wxt.config.ts  vitest.config.ts  tsconfig.json
│   └── README.md
├── desktop/                            # Swift macOS 应用（从 ../CodingPlanAssistant 迁入）
│   ├── CodingPlanAssistant/  CodingPlanAssistant.xcodeproj/
│   ├── Packages/  scripts/  docs/
│   ├── project.yml
│   └── README.md
├── shared/
│   └── bridge/                         # BRIDGE-PROTOCOL 规范 + 契约测试夹具（两端共同消费）
├── docs/                               # 仓库级文档：总架构、多端用户指南
├── README.md                           # monorepo 总览（一个仓库，多端 + roadmap）
└── .gitignore                          # 合并 node + macOS/Xcode 两份
```

### 结构原则

- `shared/bridge/` 是两端唯一的契约耦合点。现有 `desktop/docs/BRIDGE-PROTOCOL.md` 升级为一等公民目录，web 与 desktop 各自引用；Tauri/mobile 落地后同样消费它。
- 根目录**不放** `pnpm-workspace.yaml` / 根 `package.json`。现阶段 node 项目只有一个；mobile/PWA（第二个 node 项目）落地时再加 workspace（YAGNI）。
- Chrome 商店的扩展显示名与扩展 ID 不受仓库改名影响，listing 不需要动。
- 不预抽共享 UI 组件。扩展的 Svelte 用量卡片等组件在 mobile/PWA 阶段一开工时再抽到 `shared/ui/`——届时两个真实使用方都在，接口才是对的。

## Mobile 两阶段设计（本次只写进文档，不建目录）

`mobile/` 两阶段在同一目录演进，避免"两个项目"式返工：

- **阶段一（PWA 过渡）**：纯 Vite + Svelte PWA（`index.html` + `manifest.webmanifest` + Service Worker），因移动端上架周期长而先行。数据获取必须走可替换的数据源层（PWA 期为桥/本地服务端，Tauri 期换原生 channel），该抽象属于 `shared/`。
- **阶段二（Tauri 2.0 接管）**：同一前端零改动成为 Tauri 的 `frontendDist`，`tauri init` 后在同目录加入 `src-tauri/`（android/ ios/ 目标在其中生成）。
- 阶段一时抽离共享 UI 组件至 `shared/ui/`；同步在根引入 `pnpm-workspace.yaml`（web、mobile 两包）。

## 迁移执行顺序

1. **预备**：确认两仓工作区干净、本地与远端同步；当前仓打本地 tag 快照（如 `v2.0.0-final`）。
2. **GitHub 改名**：`miaosha-GLM` → `coding-plan-assistant`（stars/forks/issues/PR 保留，旧 URL 301 重定向）；本地 `git remote set-url` 更新。
3. **本地重组**：`git mv` 当前项目进 `web/`；`../CodingPlanAssistant` 内容迁入 `desktop/`；抽出 `shared/bridge/`；合并 `.gitignore`；写新根 `README.md`；Xcode 工程用 XcodeGen 重新生成并验证相对路径。
4. **清理**（orphan 之前完成）：提案 HTML 目录（`align-who-is-better/`、`bilingual-proposals/`、`bilingual-ux-proposals/`、`news-access-proposals/`、`carousel-app-switcher/`）、`output/` 构建产物、`.tmp/`、过期脚本——逐个判定"删除 / 进 archive 留档"。
5. **版本与命名**：`web/package.json` → name `coding-plan-assistant-web`、version `3.0.0`；检查 manifest；重写各级 README。
6. **本地验证**：`web/` 下 `pnpm install && pnpm test && pnpm build` 全绿；`desktop/` 下 `swift test`（UsageCore）全绿；desktop mock 模式可启动。
7. **存档分支**：当前扩展仓历史推为 `archive/v2`；旧 desktop 仓历史推为 `archive/desktop-v1`。两条 archive 分支都推到改名后的仓库。
8. **orphan 提交**：`git checkout --orphan` 新分支，以清理完毕的干净状态作为唯一一次提交（如 `v3.0.0: one repo, multi-platform`），force-push 覆盖 `main`，打 `v3.0.0` tag；GitHub 默认分支指向新历史。
9. **删除旧仓**：确认 `archive/desktop-v1` 已推送 + 本地 `git clone --mirror` 冷备份存在后，删除 `Rocke1001feller/CodingPlanAssistant`。
10. **收尾**：删除本地 `../CodingPlanAssistant/`（内容已在 `desktop/`）；在外部渠道（推广帖等）能更新仓库链接的尽量更新。

## 风险与代价

- **GitHub 统计重置**：force-push orphan 后 contributors 图表与 commit 计数归零；stars 不受影响。旧 issue/PR 中引用的 commit hash 将无法跳转（archive 分支可手动找回）——orphan 路线的固有代价，已确认接受。
- **删旧仓不可逆**：兜底为第 7 步 `archive/desktop-v1` 分支 + 本地 mirror 冷备份，两者齐备前不执行删除。
- **Xcode 相对路径**：迁入 `desktop/` 后 `project.yml` / xcodeproj 引用需检查，以 XcodeGen 重新生成 + 构建 + `swift test` 验证。
- **外部链接**：GitHub 重定向长期有效，但旧 README 在外部渠道的引用建议手动更新。

## 验收标准

- 重组后 `web/`、`desktop/` 两端测试与构建全部通过（见第 6 步）。
- orphan 提交内容不含第 4 步判定为删除的任何文件。
- GitHub 上只剩 `coding-plan-assistant` 一个仓库，`main` 为 orphan 新历史，`archive/v2` 与 `archive/desktop-v1` 可正常 checkout。
- `v3.0.0` tag 指向 orphan 提交。
