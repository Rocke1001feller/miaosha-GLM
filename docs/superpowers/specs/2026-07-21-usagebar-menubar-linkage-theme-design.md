# UsageBar 菜单栏 5h 指标 + 联动 + 多彩配色 设计

日期：2026-07-21 · 分支：only-fans · 状态：已获用户批准（3 轮澄清）

## 背景

UsageBar v1（11 tasks + 终审）已交付：菜单栏 label（highestUsed 跨窗口 max）、浮窗卡片/悬浮球（12s 轮播 + 2s 空闲收缩）、菜单栏浮层、设置页。用户反馈三项微调：

1. 菜单栏改显**最细粒度窗口**（5h）用量，不再跨窗口取 max（如 Kimi 应显 24% 而非 31.5%）。
2. 菜单栏与浮窗显示**同一平台**，保持一致。
3. 新增**多彩/系统双配色**：默认多彩（quota-float 极光渐变风、按平台固定色），设置中可切回当前系统磨砂风。

参考：`mac-os-only-fans/references/quota-float`（Tauri，极光渐变实为其「用量档位」语义，用户已确认改用**平台固定色**语义）。

## 澄清结论（用户三问三答）

- 配色语义：**按平台固定配色**（非 quota-float 的按用量档位变色）。
- 菜单栏指标：**只显 5h 细粒度**，原跨窗口 max 废弃。
- 联动方式：**自动选「5h 用量最高」平台，菜单栏与浮窗同步**；浮窗手动箭头可临时切换（菜单栏跟着切），下次数据推送时自动选择重新生效。

## 一、菜单栏 5h 指标

`UsageCore/Store/UsageStore.swift`：

- 新增纯函数 `selectPrimary(cards: [PlatformID: PlatformUsage]) -> PlatformID?`：
  - 候选：status 为 ok 或 stale 且 `windows` 非空的卡；
  - 键：`windows[0].percent`（各平台第一窗口即最细粒度：MiniMax 5h、Kimi 5h、MiMo 套餐用量、火山近5小时）；
  - 返回第一窗口 percent 最高的平台；无候选返回 nil。
- `UsageStore` 弃用 `highestUsed`（删除；其唯一消费方 MenuBarLabel 改走新选择器）。
- `MenuBarLabel` 改为：`selectedPlatform` 对应卡的 `windows[0].percent` → `短名 + Formatting.pct(...)`；无卡/无窗口显示仪表盘 SF Symbol（现状兜底不变）。

## 二、菜单栏 ↔ 浮窗联动

平台选择状态上移到共享层，单一事实源：

- `UsageStore` 新增 `@Published private(set) var selectedPlatform: PlatformID = .kimi`，及：
  - `reselectPrimary()`：`selectPrimary(cards)` 非空时写入 `selectedPlatform`；`apply(snapshot:from:)` 末尾调用（每次桥推送/兑底落库自动重选）。
  - `selectManually(_ id: PlatformID)`：浮窗箭头调用，直接写 `selectedPlatform`（菜单栏随之切）；下次 `apply` 时 `reselectPrimary` 自动回到最高平台。
- `WidgetController`：
  - 删除 12s 自动轮播（`rotateTask`/`startRotation`/`rotateInterval`），与联动冲突；
  - `displayedPlatform` 从 `@Published` 自有状态改为计算属性代理 `state.store.selectedPlatform`；`nextPlatform()/prevPlatform()` 改调 `Carousel` 后写 `selectManually`；
  - 保留 2s 空闲收缩 orb、点球展开。
- `UsageStore` 已被 `@MainActor` 隔离且经 Combine 转发至 App 层，菜单栏 label 与浮窗订阅同一值 → 天然一致。
- `Carousel`（UsageUI）保留不动；`highestUsed` 相关测试改写为 `selectPrimary`/`selectedPlatform` 语义。

## 三、多彩/系统双配色

### 设置模型

- `WidgetSettings`（FloatingPanel.swift）新增 `appearanceKey = "appearanceMode"`：`"colorful"`（**默认**，键缺失时视为 colorful）/ `"system"`。
- 设置页新增「外观」分区（置于「通用」与「浮窗」之间）：`Picker(.segmented)` 多彩/系统，写 UserDefaults；`onReceive(UserDefaults.didChangeNotification)` 回读（沿用 T8/T9 双向同步模式）。

### 多彩模式

UsageUI 新增 `PlatformPalette.swift`：每平台一组极光参数（仿 quota-float styles.css 四层结构）：

```swift
public struct AuroraSpec: Sendable, Equatable {
  public var cool: Color      // 顶部冷色 radial（52% 12% 位）
  public var glow: Color      // 主光斑 radial（28% 68% 位）
  public var warm: Color      // 暖光斑 radial（82% 82% 位）
  public var linearStart: Color, linearMid: Color, linearEnd: Color // 145° 基底
  public var progressStart: Color, progressEnd: Color // 进度条渐变
  public var auroraOpacity: Double // 极光层整体不透明度（≈0.42–0.58）
}
```

四平台固定配色（hex 为基准，实现时按 quota-float 同明度/饱和度档微调至视觉和谐）：

| 平台 | 色系 | cool | glow | warm | linearEnd | progress |
|---|---|---|---|---|---|---|
| Kimi Code | 靛蓝紫 | `#b9c5ee` | `#e0d9f7` | `#c7c0f2` | `#c3a7ec` | `#5b6ee0 → #9aa7f0` |
| 小米 MiMo | 橙 | `#f2d8b9` | `#fdeed0` | `#f7c489` | `#ffb06e` | `#f07e1d → #f7b267` |
| MiniMax | 青绿 | `#b9e0d4` | `#dcf4e5` | `#a8dcc8` | `#7fd0b4` | `#189a74 → #6fcba8` |
| 火山引擎 | 红 | `#eec4bd` | `#fbe0d8` | `#f2a99b` | `#ef8577` | `#d94f3d → #f0937e` |

- 新增 `AuroraBackground` SwiftUI 视图：3 个 RadialGradient + 1 个 LinearGradient 叠层、`opacity(auroraOpacity)`、18s alternate 漂移动画（`.onAppear` 驱动 `withAnimation(.easeInOut(duration: 18).repeatForever(autoreverses: true))`，offset/scale 小幅漂移）；`@Environment(\.accessibilityReduceMotion)` 为 true 时跳过动画。
- 作用面：
  - **浮窗卡片/悬浮球**：`WidgetContainerView` 在多彩模式下去磨砂（blur alpha=0），改由 SwiftUI 层在内容背后放 `AuroraBackground(platform)`；系统模式保持现状磨砂。orb 同款极光。
  - **菜单栏浮层卡片**（`UsageListRowView`）：多彩模式加平台色淡底（`platform.glow.opacity(0.35)` 圆角底），系统模式不变。
  - **进度条**（`UsageBarView`）：多彩模式用 `progressStart→progressEnd` 线性渐变填充；系统模式保持 `StatusPalette` 三档单色。
- 文字：多彩模式卡面文字统一近黑 `#17191f`（quota-float 同值），保证浅渐变底上可读。

### 系统模式

完全保持现状（磨砂 + StatusPalette 绿/黄/红三档），零视觉变化。

### 平台限制（已告知用户）

macOS 菜单栏文本一律模板单色渲染，多彩不可作用于菜单栏 label；两模式菜单栏样式一致（仅数字口径随需求一变化）。

## 四、错误与边界

- 空卡/全 needs_login：`selectPrimary` 返回 nil → `selectedPlatform` 保持现值，菜单栏显示仪表盘图标。
- 多彩模式 + needs_login/stale 卡：卡面仍按平台色渲染，状态文案沿用现有 tint（黄/灰）。
- `appearanceMode` 切换即时生效：浮窗经 WidgetController 的 defaults 观察器（已有）触发重建背景；浮层/设置页经各自 onReceive 回读。
- `highestUsed` 删除是 UsageCore 公共 API 破坏式变更：仅 MenuBarLabel 一个消费方，同步改；无其他下游。

## 五、测试

- UsageCore：`selectPrimary` 纯函数测试（最高第一窗口、并列取先、剔除 needs_login/unavailable/loading、空窗剔除、空图 nil）；`reselectPrimary`/`selectManually` 状态迁移（apply 自动重选、手动选择、再次 apply 回弹）。
- UsageUI：`AuroraSpec` 四平台参数快照（存在且互异）；`WidgetGeometry` 等既有测试不动。
- App 层：无法单测部分列入真机验收清单。
- 回归基线：扩展 vitest 245、UsageCore 52、UsageUI 9 全绿后方可合入。

## 六、真机验收清单

1. 菜单栏显示「5h 最高平台 + 其 5h %」（如 Kimi 24%），数据推送后随最高平台切换。
2. 浮窗卡片/orb 与菜单栏同平台；手动箭头切换两者同步；下次推送回弹最高平台。
3. 设置页「外观」多彩/系统切换即时生效；默认多彩；四平台卡面配色互异且文字可读。
4. orb 极光与卡片一致；Reduce Motion 开启时无动画。
5. 系统模式与切换前视觉完全一致。
