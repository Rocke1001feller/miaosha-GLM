# UsageBar — macOS 菜单栏 + 浮动小组件：AI 平台 Token 用量实时监控

日期：2026-07-21
状态：设计已获用户批准（2026-07-21）
位置：`mac-os-only-fans/UsageBar/`（monorepo 内，与 `references/` 同级）

## 1. 目标与形态

在 macOS 上提供一款常驻工具，实时显示四个 AI 平台 Coding Plan 的 token 用量（5 小时窗/周窗百分比、重置倒计时）：

- **MiniMax**（Token Plan）
- **Kimi Code**（会员频限）
- **小米 MiMo**（Token Plan）
- **火山引擎**（Agent Plan / Coding Plan）

三个展示表面：

1. **菜单栏 label**：当前已用量最高平台的缩写 + 百分比（等宽数字）；无数据仅显示图标
2. **菜单栏浮层**（MenuBarExtra .window，340pt）：Pulse 式四平台列表（平台名+套餐徽章 | 双进度条 5h/周 | 百分比+重置倒计时），底部含更新时间、刷新、浮窗开关、设置入口
3. **浮动桌面小组件**（NSPanel）：quota-float 式单卡（平台头+三档变色大数字+进度条+重置倒计时+周窗行），箭头/12s 自动轮播切换平台，无操作 2s 收缩为 80×80 悬浮球；右键菜单（置顶/透明度/紧凑/点击穿透/退出）、拖动位置记忆、跨 Space 可见

数据来源：本仓库 Chrome 扩展已有的 M6 拦截体系（`lib/usage/`，含 MiMo/火山/Kimi 标签页会话自愈），经本地桥推送；原生 cookie 直取作为兑底。

## 2. 关键决策（已与用户确认）

| 决策点 | 结论 |
|---|---|
| 技术栈 | 原生 Swift/SwiftUI（MenuBarExtra + NSPanel），不采用 Tauri 或 Python 混合 |
| 数据通道 | 扩展推送桥为主 + 原生 cookie 直取兑底 |
| 浮窗形态 | 单卡轮播（quota-float 式）+ 菜单栏下拉列表（Pulse 式） |
| 菜单栏内容 | 最高用量平台 + 百分比 |
| 刷新频率 | 60s + 任一平台重置窗口（±15min）自动加速到 20s |
| 分发 | v1 不签名（个人使用，`xattr -dr com.apple.quarantine`），签名/公证/Sparkle 留 hook |
| 项目位置 | 本仓库 `mac-os-only-fans/UsageBar/` |
| 最低系统 | macOS 14（不使用 Liquid Glass API） |

## 3. 架构

```
Chrome 扩展（数据面，已有）                macOS App（展示面，新建）
┌─────────────────────┐  HTTP POST   ┌──────────────────────────┐
│ lib/usage/providers │─────────────▶│ BridgeServer (127.0.0.1) │
│ + bridge-push.ts    │  60s/加速档   │ UsageStore（单一数据面）  │
│ (chrome.alarms)     │◀─────────────│ RefreshEngine（轮询/兑底）│
└─────────────────────┘  状态/控制    └─────┬───────────┬────────┘
                                            │           │
   UsageCore (SwiftPM 包：模型/Provider/引擎/桥/缓存)    │
                                            │           │
                              MenuBarExtra 浮层   NSPanel 浮动小组件
                              (四平台列表)        (单卡轮播/悬浮球)
```

模块划分（映射 Pulse 五件套）：

- **UsageCore**（SwiftPM 包，纯 Swift 无 UI）：
  - `Models.swift`：`PlatformUsage` / `UsageWindow` / `CardStatus`（形状对齐扩展 `UsageCardData`）
  - `Providers/`：`UsageProvider` 协议；`ExtensionBridgeProvider`（主）；`NativeCookieProvider`（兑底，含 MiniMax/MiMo/Volc 三个适配）
  - `RefreshEngine`：per-provider 节奏、熔断、stale 兜底、桥离线检测
  - `UsageStore`：单一数据面（内存 + 本地快照文件，启动即显上次值）
  - `BridgeServer`：127.0.0.1 微型 HTTP 服务
  - `Support/`：`ChromeCookieReader`（解密链）、`KeychainHelper`、HTTPClient
- **UsageUI**（SwiftPM 包）：平台卡片、列表行、进度条、状态配色、格式化（纯展示，可快照测试）
- **UsageBar app target**：MenuBarExtra(.window) 浮层、NSPanel 浮动小组件、设置页、`SMAppService` 登录项

## 4. 数据通道

### 4.1 扩展推送桥（主通道）

- App 启动在 `127.0.0.1:17389` 监听 `POST /v1/usage`；首次启动生成配对令牌，显示在设置页，用户粘贴到扩展 options 页一次；请求头 `Authorization: Bearer <token>`
- 扩展侧新增 `lib/usage/bridge-push.ts`：
  - `chrome.alarms` 每 60s：先 `refreshUsageCache()`，再把结果 POST 到桥
  - 任一平台 `resetAt` 进入 ±15min 窗口 → 加速到 20s
  - 推送失败静默（App 未运行）
  - 复用现有自愈逻辑（MiMo 401 / 火山 NotLogin / Kimi token 捕获全部沿用）
- 桥断开（Chrome 未运行/推送超时 >10min）→ 卡片进入 stale 并标"桥离线"

### 4.2 原生 cookie 兑底（次通道）

- `ChromeCookieReader` 复刻 claude-desktop-usage 解密链：Keychain `Chrome Safe Storage` → PBKDF2 → AES-128-CBC v10 → Cookies SQLite 拷副本读取（含 CHIPS 分区条目）
- 覆盖平台：MiniMax（持久 cookie 直连）、MiMo（api-platform_* cookie）、火山（digest + 合成 csrf 双提交）
- 解析器从 `lib/usage/parsers.ts` 移植为 Swift（fixture 用 `.tmp/bailian` 真实抓包）
- 限制（明示）：Kimi token 存 localStorage(LevelDB) 原生不可读 → 兑底时显示"需打开浏览器"；SSO 重铸原生做不到 → 凭证失效显示 stale + 提示，不编造数据

### 4.3 数据模型与状态机

卡片五态（照搬 quota-float）：

- `ok` / `stale`（>10min 未更新或桥离线，保留上次成功值+时间标）/ `unavailable` / `needs_login` / `loading`

健康度三档（驱动整套配色；与扩展用量 Tab 一致，展示**已用**百分比）：

- 已用 <50% 绿 / 50–90% 黄 / >90% 红

菜单栏 label 的"最高用量平台"即已用百分比最高的平台（如 `Kimi 82%` 表示已用 82%）。

## 5. 工程

- **位置**：`mac-os-only-fans/UsageBar/`；XcodeGen `project.yml` 生成工程，xcodeproj 不入库
- **结构**：`Packages/UsageCore`、`Packages/UsageUI`、`UsageBar/`（app target）、`scripts/`
- **脚本**：
  - `scripts/dev-mac.sh`：xcodegen → xcodebuild Debug → run
  - `scripts/release-mac.sh`：archive → zip（签名/公证/notarize 留 hook，v1 不启用）
- **扩展侧改动**：`lib/usage/bridge-push.ts`（新增）+ `entrypoints/background.ts`（注册 alarms 与消息）+ options 页配对令牌输入

## 6. 测试

- **UsageCore**（Swift Testing，`swift test`）：
  - 四平台解析器 fixture 测试（真实响应快照从 `.tmp/bailian` 移植）
  - Chrome cookie 解密链单测（已知测试向量）
  - RefreshEngine：熔断/节奏/stale 状态机
  - BridgeServer：令牌校验、 malformed payload、并发推送
- **UsageUI**：关键卡片快照测试（从简）
- **扩展侧**（vitest）：bridge-push 节流、失败静默、令牌头、加速档触发
- 实机验收清单：构建运行 → 扩展配对 → 菜单栏/浮层/浮窗三表面数据一致 → Chrome 退出进入 stale → 重开恢复

## 7. 参考资产（本仓库 `mac-os-only-fans/references/`）

| 项目 | 借鉴内容 |
|---|---|
| claude-desktop-usage | NSPanel 浮窗全套工程（nonactivatingPanel、canJoinAllSpaces、拖动记忆、右键菜单、透明度只作用 blur 层、顶边锚定缩放、30s 本地倒计时 tick）；Chrome cookie 解密链 |
| Pulse | Provider/Descriptor/RefreshEngine/CompositeProvider/Store 架构；MenuBarExtra(.window) 浮层；列表行布局；dev/release 脚本；Swift Testing 模式 |
| quota-float | 单卡五态状态机、三档变色、悬浮球收起、自动轮播；stale 合并逻辑；`?designer` 设计工作台思路 |
