# coding-plan-assistant

智能 Coding Plan 助手：一个仓库，多端。

| 目录 | 平台 | 技术栈 | 状态 |
| --- | --- | --- | --- |
| `web/` | Chrome 扩展 | WXT + Svelte 5 + TypeScript | v3.0.0 |
| `desktop/` | macOS 菜单栏应用 | Swift / SwiftUI（Tauri 2.0 重写规划中） | v1.4.1 |
| `shared/bridge/` | 跨端桥契约 | Markdown 规范 + JSON 夹具 | 现行 |
| `mobile/` | iOS / Android | PWA 过渡 → Tauri 2.0 | 未开工 |

## 子项目

- **浏览器扩展**：多平台套餐秒杀（智谱 / 火山引擎 / 阿里百炼 / 百度千帆）+ 买家秀 + AI 新闻 + Token 用量监控。见 [`web/README.md`](web/README.md)。
- **macOS 应用**：菜单栏 / 浮层 / 桌面浮窗三表面用量监控，可独立运行（Chrome cookie / LevelDB 直取），扩展为可选增强通道。见 [`desktop/README.md`](desktop/README.md)。
- **桥契约**：扩展与桌面端共享的本地桥协议，见 [`shared/bridge/BRIDGE-PROTOCOL.md`](shared/bridge/BRIDGE-PROTOCOL.md)。

## Roadmap

1. `web` v3.0.0：monorepo 重组完成（当前）
2. `desktop`：Swift 版持续维护；Tauri 2.0 跨平台重写（macOS / Windows / Linux）
3. `mobile`：PWA 先行过渡（上架周期长），随后 Tauri 2.0 接管为真正移动端，前端代码零改动复用

## 历史

本仓 `main` 自 v3.0.0 起为全新历史。旧历史：`archive/v2`（扩展 v2.x 及以前）、`archive/desktop-v1`（macOS 应用独立仓时期）。
