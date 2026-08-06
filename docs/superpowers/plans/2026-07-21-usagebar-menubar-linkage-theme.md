# UsageBar 菜单栏 5h 指标 + 联动 + 多彩配色 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 菜单栏改显 5h 细粒度用量并与浮窗联动同平台；新增多彩（默认）/系统双配色。

**Architecture:** 平台选择状态上移到 `UsageStore`（单一事实源，`@Published selectedPlatform` + 纯函数 `selectPrimary`），菜单栏 label 与浮窗共同订阅；多彩配色以 UsageUI 新资产（`AppearanceMode`/`PlatformPalette`/`AuroraBackground`）注入浮窗/浮层，系统模式保持现状磨砂。

**Tech Stack:** Swift 5.9+ / SwiftUI / Combine（macOS 14），Swift Testing（`@Suite/@Test/#expect`），XcodeGen + xcodebuild。

设计 spec：`docs/superpowers/specs/2026-07-21-usagebar-menubar-linkage-theme-design.md`（配色 hex 表以此文件与 plan 为准）。

## Global Constraints

- 仓库根：`/Users/separationofconcerns/Documents/ReachVideo/miaosha-GLM`；app 根：`mac-os-only-fans/UsageBar/`。
- 本机 xcode-select 指向 CLT：所有 xcodebuild/swift test 命令必须前置 `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`（`scripts/dev-mac.sh` 已自带该逻辑）。
- 部署目标 macOS 14.0：不可用 macOS 15+ API（如 `@Observable` 之于 App 层、`onChange(of:)` 双参闭包新形态——本仓库既有 5 处单参闭包 deprecation 警告属既定现状，新代码沿用单参闭包保持一致）。
- UsageCore/UsageUI 是独立 SwiftPM 包，测试命令分别在各自包目录跑 `swift test`。
- 注释风格：中文、说明"为什么"，与周边文件密度一致。
- 不改动扩展侧（entrypoints/lib/tests）任何文件。
- 回归基线：UsageCore 52 测试、UsageUI 9 测试全绿；每个 Task 结束时对应包测试全绿 + `scripts/dev-mac.sh` 构建绿。

---

### Task 1: UsageCore — selectPrimary 纯函数 + selectedPlatform 状态

**Files:**
- Modify: `mac-os-only-fans/UsageBar/Packages/UsageCore/Sources/UsageCore/Store/UsageStore.swift`
- Test: `mac-os-only-fans/UsageBar/Packages/UsageCore/Tests/UsageCoreTests/UsageStoreTests.swift`

**Interfaces:**
- Produces（Task 2/3 消费）:
  - `static func selectPrimary(_ cards: [PlatformID: PlatformUsage]) -> PlatformID?`
  - `@Published private(set) var selectedPlatform: PlatformID`（默认 `.kimi`）
  - `func selectManually(_ id: PlatformID)`
  - `apply(snapshot:from:)` 末尾自动重选（reselectPrimary）
- 保留：`highestUsed`（Task 2 才移除）、`maxUsedPercent`。

- [ ] **Step 1: 写失败测试**（追加到 UsageStoreTests.swift 的 `UsageStore` Suite 内）

```swift
  private func twoWindowCard(_ id: PlatformID, first: Double, second: Double,
                             status: CardStatus = .ok, fetchedAt: Date) -> PlatformUsage {
    PlatformUsage(platform: id, displayName: id.rawValue, status: status,
                  windows: [UsageWindow(label: "5h", percent: first),
                            UsageWindow(label: "周", percent: second)], fetchedAt: fetchedAt)
  }

  @MainActor @Test func selectPrimary取第一窗口最高者() {
    let now = Date()
    // kimi 第一窗口 0.24 < mimo 0.17？否：mimo 0.17 < kimi 0.24；kimi 第二窗口更高但不应被选中依据
    let cards: [PlatformID: PlatformUsage] = [
      .kimi: twoWindowCard(.kimi, first: 0.24, second: 0.315, fetchedAt: now),
      .mimo: twoWindowCard(.mimo, first: 0.17, second: 0.166, fetchedAt: now),
      .minimax: twoWindowCard(.minimax, first: 0.0, second: 0.04, fetchedAt: now),
    ]
    #expect(UsageStore.selectPrimary(cards) == .kimi)
    // 第一窗口决定：把 kimi 第一窗口调低后，即使第二窗口仍最高，也应让位 mimo
    let cards2: [PlatformID: PlatformUsage] = [
      .kimi: twoWindowCard(.kimi, first: 0.10, second: 0.99, fetchedAt: now),
      .mimo: twoWindowCard(.mimo, first: 0.17, second: 0.166, fetchedAt: now),
    ]
    #expect(UsageStore.selectPrimary(cards2) == .mimo)
  }

  @MainActor @Test func selectPrimary剔除非okstale与空窗() {
    let now = Date()
    let cards: [PlatformID: PlatformUsage] = [
      .kimi: twoWindowCard(.kimi, first: 0.99, second: 0.99, status: .needsLogin, fetchedAt: now),
      .mimo: PlatformUsage(platform: .mimo, displayName: "m", status: .ok, windows: [], fetchedAt: now),
      .minimax: twoWindowCard(.minimax, first: 0.04, second: 0.0, status: .stale, fetchedAt: now),
    ]
    #expect(UsageStore.selectPrimary(cards) == .minimax)
    #expect(UsageStore.selectPrimary([:]) == nil)
    let allLogin: [PlatformID: PlatformUsage] = [
      .kimi: twoWindowCard(.kimi, first: 0.5, second: 0.5, status: .needsLogin, fetchedAt: now),
    ]
    #expect(UsageStore.selectPrimary(allLogin) == nil)
  }

  @MainActor @Test func apply自动重选_手动选择_再次apply回弹() {
    let store = UsageStore()
    let now = Date()
    store.apply(snapshot: [.kimi: twoWindowCard(.kimi, first: 0.24, second: 0.31, fetchedAt: now),
                           .mimo: twoWindowCard(.mimo, first: 0.17, second: 0.16, fetchedAt: now)], from: .bridge)
    #expect(store.selectedPlatform == .kimi)
    store.selectManually(.mimo)
    #expect(store.selectedPlatform == .mimo)
    store.apply(snapshot: [.kimi: twoWindowCard(.kimi, first: 0.30, second: 0.31, fetchedAt: now)], from: .bridge)
    #expect(store.selectedPlatform == .kimi) // 自动选择重新生效
  }

  @MainActor @Test func selectPrimary为nil时保持现值() {
    let store = UsageStore()
    store.selectManually(.mimo)
    store.apply(snapshot: [.kimi: twoWindowCard(.kimi, first: 0.5, second: 0.5, status: .needsLogin,
                                                fetchedAt: Date())], from: .bridge)
    #expect(store.selectedPlatform == .mimo)
  }
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd mac-os-only-fans/UsageBar/Packages/UsageCore && DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer swift test --filter UsageStore 2>&1 | tail -5`
Expected: 编译失败（`selectPrimary`/`selectedPlatform`/`selectManually` 不存在）。

- [ ] **Step 3: 实现**（UsageStore.swift，改动如下）

在 `UsageStore` 类中、`cards` 声明之后加：

```swift
  /// 菜单栏/浮窗共同订阅的当前展示平台：apply 时自动重选（5h 最高），浮窗箭头可手动覆盖
  @Published public private(set) var selectedPlatform: PlatformID = .kimi

  /// 手动选择（浮窗箭头）；下次 apply 自动重选会覆盖回来
  public func selectManually(_ id: PlatformID) {
    selectedPlatform = id
  }

  /// 自动重选：第一窗口（各平台最细粒度）已用最高的 ok/stale 平台；无候选保持现值
  public func reselectPrimary() {
    if let id = Self.selectPrimary(cards) { selectedPlatform = id }
  }

  /// 纯函数：候选 = ok/stale 且 windows 非空；键 = windows[0].percent；并列取 PlatformID.allCases 先者
  public static func selectPrimary(_ cards: [PlatformID: PlatformUsage]) -> PlatformID? {
    var best: PlatformID?
    var bestPct = -1.0
    for id in PlatformID.allCases {
      guard let card = cards[id], card.status == .ok || card.status == .stale,
            let first = card.windows.first else { continue }
      if first.percent > bestPct { bestPct = first.percent; best = id }
    }
    return best
  }
```

并把 `apply(snapshot:from:)` 改为末尾调用 `reselectPrimary()`：

```swift
  public func apply(snapshot: [PlatformID: PlatformUsage], from source: SnapshotSource) {
    for (id, card) in snapshot {
      cards[id] = card
    }
    if source == .bridge {
      lastBridgePushAt = snapshot.values.map(\.fetchedAt).max() ?? Date()
      bridgeOnline = true
    }
    reselectPrimary()
  }
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd mac-os-only-fans/UsageBar/Packages/UsageCore && DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer swift test 2>&1 | tail -3`
Expected: `Test run with 56 tests ... passed`（52 + 新增 4）。

- [ ] **Step 5: Commit**

```bash
git add mac-os-only-fans/UsageBar/Packages/UsageCore
git commit -m "feat(usagecore): add selectPrimary + selectedPlatform shared selection state"
```

---

### Task 2: 菜单栏 5h 指标接线 + 移除 highestUsed

**Files:**
- Modify: `mac-os-only-fans/UsageBar/UsageBar/Sources/MenuBarLabel.swift`
- Modify: `mac-os-only-fans/UsageBar/UsageBar/Sources/UsageBarApp.swift`
- Modify: `mac-os-only-fans/UsageBar/Packages/UsageCore/Sources/UsageCore/Store/UsageStore.swift`（删 highestUsed）
- Test: `mac-os-only-fans/UsageBar/Packages/UsageCore/Tests/UsageCoreTests/UsageStoreTests.swift`

**Interfaces:**
- Consumes: Task 1 的 `selectedPlatform`。
- Produces: `MenuBarLabel(card: PlatformUsage?)`（UsageBarApp 唯一调用点）。

- [ ] **Step 1: 改写既有测试**（`apply合并与highestUsed` 整体替换为 `apply合并与自动选择`）

```swift
  @MainActor @Test func apply合并与自动选择() {
    let store = UsageStore()
    let now = Date()
    store.apply(snapshot: [.kimi: card(.kimi, 0.82, fetchedAt: now),
                           .mimo: card(.mimo, 0.17, fetchedAt: now)], from: .bridge)
    #expect(store.cards.count == 2)
    #expect(store.selectedPlatform == .kimi)
    #expect(store.bridgeOnline == true)
  }
```

- [ ] **Step 2: 移除 highestUsed 并确认 UsageCore 测试绿**

从 UsageStore.swift 删除：

```swift
  /// ok/stale 卡中已用百分比最高者（菜单栏/浮窗主展示）
  public var highestUsed: PlatformUsage? {
    cards.values
      .filter { $0.status == .ok || $0.status == .stale }
      .max(by: { $0.maxUsedPercent < $1.maxUsedPercent })
  }
```

Run: `cd mac-os-only-fans/UsageBar/Packages/UsageCore && DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer swift test 2>&1 | tail -3`
Expected: 56 tests passed（`PlatformUsage.maxUsedPercent` 保留不动）。

- [ ] **Step 3: 改 MenuBarLabel**（整文件替换 body 语义）

```swift
import SwiftUI
import UsageCore
import UsageUI

/// 菜单栏标签：有数据显示"短名 + 最细窗口（5h）已用百分比"，无数据显示仪表盘图标。
struct MenuBarLabel: View {
  let card: PlatformUsage?

  var body: some View {
    if let card, let first = card.windows.first {
      Text("\(shortName(card.platform)) \(Formatting.pct(first.percent))")
        .monospacedDigit()
    } else {
      Image(systemName: "gauge.with.dots.needle.67percent")
    }
  }

  private func shortName(_ id: PlatformID) -> String {
    switch id {
    case .minimax: "MM"; case .kimi: "Kimi"; case .mimo: "MiMo"; case .volcengine: "火山"
    }
  }
}
```

- [ ] **Step 4: 改 UsageBarApp 调用点**

`UsageBarApp.swift` 第 23 行 `MenuBarLabel(highest: state.store.highestUsed)` 改为：

```swift
      MenuBarLabel(card: state.store.cards[state.store.selectedPlatform])
```

- [ ] **Step 5: 构建 app 确认绿**

Run: `mac-os-only-fans/UsageBar/scripts/dev-mac.sh 2>&1 | tail -3`
Expected: `built: .build/Build/Products/Debug/UsageBar.app`（无编译错误）。

- [ ] **Step 6: Commit**

```bash
git add mac-os-only-fans/UsageBar
git commit -m "feat(menubar): show finest-granularity (5h) window percent via selectedPlatform"
```

---

### Task 3: 浮窗联动（去 12s 轮播 + selectedPlatform 代理）

**Files:**
- Modify: `mac-os-only-fans/UsageBar/UsageBar/Sources/Widget/WidgetController.swift`

**Interfaces:**
- Consumes: `UsageStore.selectedPlatform`、`UsageStore.selectManually(_:)`（Task 1）；`Carousel.next/previous`（UsageUI 既有）。
- Produces: `WidgetController.displayedPlatform: PlatformID`（计算属性，WidgetRootView 既有消费不变）。

说明：WidgetRootView 通过 `@ObservedObject var state: AppState` 已订阅 store 转发（AppState init 里 `store.objectWillChange.sink { self?.objectWillChange.send() }`），selectedPlatform 变更驱动视图刷新，无需 controller 再发。

- [ ] **Step 1: 改 WidgetController**

删除：`rotateTask` 属性、`rotateInterval` 常量、`startRotation()` 方法及其在 `show()` 中的调用、`hide()` 中的 `rotateTask?.cancel(); rotateTask = nil` 两行。

`@Published var displayedPlatform: PlatformID = .kimi` 改为计算属性：

```swift
  /// 当前展示平台：单一事实源在 UsageStore（菜单栏共享同一值，联动一致）
  var displayedPlatform: PlatformID { state.store.selectedPlatform }
```

`nextPlatform()/prevPlatform()` 改为：

```swift
  func nextPlatform() {
    state.store.selectManually(Carousel.next(displayedPlatform, in: PlatformID.allCases))
  }

  func prevPlatform() {
    state.store.selectManually(Carousel.previous(displayedPlatform, in: PlatformID.allCases))
  }
```

类 Doc 注释首行改为：`/// 浮窗控制器：卡片/悬浮球双模、平台选择与菜单栏联动（UsageStore.selectedPlatform）、2s 空闲收缩、位置/置顶/透明度/穿透偏好应用。`

注意：`show()` 中 `startRotation()` 调用删除后，其余（mode=.card、hosting、panel、orderFront、userInteracted）原样保留；`UsageUI` 的 `Carousel` 需要 import——文件顶部已有 `import UsageUI`，确认保留。

- [ ] **Step 2: 构建 + 全量测试**

Run: `mac-os-only-fans/UsageBar/scripts/dev-mac.sh 2>&1 | tail -3`
Expected: 构建绿。

Run: `cd mac-os-only-fans/UsageBar/Packages/UsageUI && DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer swift test 2>&1 | tail -3`
Expected: 9 tests passed（Carousel 测试不受影响）。

- [ ] **Step 3: Commit**

```bash
git add mac-os-only-fans/UsageBar/UsageBar/Sources/Widget/WidgetController.swift
git commit -m "feat(widget): link displayed platform with menu bar via shared selectedPlatform"
```

---

### Task 4: UsageUI 多彩资产（AppearanceMode / PlatformPalette / AuroraBackground / UsageBarView 渐变）

**Files:**
- Create: `mac-os-only-fans/UsageBar/Packages/UsageUI/Sources/UsageUI/AppearanceMode.swift`
- Create: `mac-os-only-fans/UsageBar/Packages/UsageUI/Sources/UsageUI/PlatformPalette.swift`
- Create: `mac-os-only-fans/UsageBar/Packages/UsageUI/Sources/UsageUI/AuroraBackground.swift`
- Modify: `mac-os-only-fans/UsageBar/Packages/UsageUI/Sources/UsageUI/UsageBarView.swift`
- Test: `mac-os-only-fans/UsageBar/Packages/UsageUI/Tests/UsageUITests/UsageUITests.swift`

**Interfaces:**
- Produces（Task 5/6 消费）:
  - `enum AppearanceMode: String, Sendable, CaseIterable { case colorful, system }`
  - `struct AuroraSpec: Sendable, Equatable { cool, glow, warm, linearStart, linearMid, linearEnd, progressStart, progressEnd: Color; auroraOpacity: Double }`
  - `enum PlatformPalette { static func spec(for platform: PlatformID) -> AuroraSpec; static let primaryText: Color }`
  - `struct AuroraBackground: View { init(spec: AuroraSpec) }`
  - `UsageBarView(percent:tint:gradient:)`（gradient 默认 nil 向后兼容）

- [ ] **Step 1: 写失败测试**（追加到 UsageUITests.swift 新 Suite）

```swift
@Suite("PlatformPalette")
struct PlatformPaletteTests {
  @Test func 四平台均有spec且互异() {
    let specs = PlatformID.allCases.map { PlatformPalette.spec(for: $0) }
    #expect(specs.count == 4)
    #expect(Set(specs).count == 4) // AuroraSpec 需 Equatable+Hashable
  }

  @Test func auroraOpacity在合理档() {
    for id in PlatformID.allCases {
      let o = PlatformPalette.spec(for: id).auroraOpacity
      #expect(o >= 0.35 && o <= 0.65)
    }
  }
}
```

（文件顶部需 `import UsageCore`。）

- [ ] **Step 2: 跑测试确认失败**

Run: `cd mac-os-only-fans/UsageBar/Packages/UsageUI && DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer swift test --filter PlatformPalette 2>&1 | tail -5`
Expected: 编译失败（PlatformPalette 不存在）。

- [ ] **Step 3: 实现 AppearanceMode.swift**

```swift
import Foundation

/// 外观模式：colorful（默认，平台固定色极光渐变）/ system（磨砂 + 三档色，v1 现状）。
public enum AppearanceMode: String, Sendable, CaseIterable {
  case colorful, system
}
```

- [ ] **Step 4: 实现 PlatformPalette.swift**

```swift
import SwiftUI
import UsageCore

/// 平台极光参数：仿 quota-float styles.css 四层结构（3 radial + 1 linear 基底 + 进度条渐变）。
public struct AuroraSpec: Sendable, Equatable, Hashable {
  public var cool: Color        // 顶部冷色光斑（52% 12% 位）
  public var glow: Color        // 主光斑（28% 68% 位）
  public var warm: Color        // 暖光斑（82% 82% 位）
  public var linearStart: Color // 145° 基底起点
  public var linearMid: Color
  public var linearEnd: Color
  public var progressStart: Color
  public var progressEnd: Color
  public var auroraOpacity: Double

  public init(cool: Color, glow: Color, warm: Color,
              linearStart: Color, linearMid: Color, linearEnd: Color,
              progressStart: Color, progressEnd: Color, auroraOpacity: Double) {
    self.cool = cool; self.glow = glow; self.warm = warm
    self.linearStart = linearStart; self.linearMid = linearMid; self.linearEnd = linearEnd
    self.progressStart = progressStart; self.progressEnd = progressEnd
    self.auroraOpacity = auroraOpacity
  }
}

/// 四平台固定配色（设计 spec 2026-07-21-usagebar-menubar-linkage-theme-design.md 第三节）。
public enum PlatformPalette {
  /// 多彩模式卡面主文字色（quota-float #17191f）
  public static let primaryText = Color(red: 0x17 / 255, green: 0x19 / 255, blue: 0x1f / 255)

  public static func spec(for platform: PlatformID) -> AuroraSpec {
    switch platform {
    case .kimi: // 靛蓝紫
      return AuroraSpec(
        cool: Color(red: 0xb9 / 255, green: 0xc5 / 255, blue: 0xee / 255),
        glow: Color(red: 0xe0 / 255, green: 0xd9 / 255, blue: 0xf7 / 255),
        warm: Color(red: 0xc7 / 255, green: 0xc0 / 255, blue: 0xf2 / 255),
        linearStart: Color(red: 0xb9 / 255, green: 0xc5 / 255, blue: 0xee / 255),
        linearMid: Color(red: 0xc7 / 255, green: 0xc9 / 255, blue: 0xd1 / 255),
        linearEnd: Color(red: 0xc3 / 255, green: 0xa7 / 255, blue: 0xec / 255),
        progressStart: Color(red: 0x5b / 255, green: 0x6e / 255, blue: 0xe0 / 255),
        progressEnd: Color(red: 0x9a / 255, green: 0xa7 / 255, blue: 0xf0 / 255),
        auroraOpacity: 0.5)
    case .mimo: // 橙（小米品牌橙）
      return AuroraSpec(
        cool: Color(red: 0xf2 / 255, green: 0xd8 / 255, blue: 0xb9 / 255),
        glow: Color(red: 0xfd / 255, green: 0xee / 255, blue: 0xd0 / 255),
        warm: Color(red: 0xf7 / 255, green: 0xc4 / 255, blue: 0x89 / 255),
        linearStart: Color(red: 0xf2 / 255, green: 0xd8 / 255, blue: 0xb9 / 255),
        linearMid: Color(red: 0xd1 / 255, green: 0xcb / 255, blue: 0xc7 / 255),
        linearEnd: Color(red: 0xff / 255, green: 0xb0 / 255, blue: 0x6e / 255),
        progressStart: Color(red: 0xf0 / 255, green: 0x7e / 255, blue: 0x1d / 255),
        progressEnd: Color(red: 0xf7 / 255, green: 0xb2 / 255, blue: 0x67 / 255),
        auroraOpacity: 0.5)
    case .minimax: // 青绿
      return AuroraSpec(
        cool: Color(red: 0xb9 / 255, green: 0xe0 / 255, blue: 0xd4 / 255),
        glow: Color(red: 0xdc / 255, green: 0xf4 / 255, blue: 0xe5 / 255),
        warm: Color(red: 0xa8 / 255, green: 0xdc / 255, blue: 0xc8 / 255),
        linearStart: Color(red: 0xb9 / 255, green: 0xe0 / 255, blue: 0xd4 / 255),
        linearMid: Color(red: 0xc7 / 255, green: 0xd1 / 255, blue: 0xcd / 255),
        linearEnd: Color(red: 0x7f / 255, green: 0xd0 / 255, blue: 0xb4 / 255),
        progressStart: Color(red: 0x18 / 255, green: 0x9a / 255, blue: 0x74 / 255),
        progressEnd: Color(red: 0x6f / 255, green: 0xcb / 255, blue: 0xa8 / 255),
        auroraOpacity: 0.5)
    case .volcengine: // 红（火山红）
      return AuroraSpec(
        cool: Color(red: 0xee / 255, green: 0xc4 / 255, blue: 0xbd / 255),
        glow: Color(red: 0xfb / 255, green: 0xe0 / 255, blue: 0xd8 / 255),
        warm: Color(red: 0xf2 / 255, green: 0xa9 / 255, blue: 0x9b / 255),
        linearStart: Color(red: 0xee / 255, green: 0xc4 / 255, blue: 0xbd / 255),
        linearMid: Color(red: 0xd1 / 255, green: 0xc9 / 255, blue: 0xc7 / 255),
        linearEnd: Color(red: 0xef / 255, green: 0x85 / 255, blue: 0x77 / 255),
        progressStart: Color(red: 0xd9 / 255, green: 0x4f / 255, blue: 0x3d / 255),
        progressEnd: Color(red: 0xf0 / 255, green: 0x93 / 255, blue: 0x7e / 255),
        auroraOpacity: 0.56)
    }
  }
}
```

- [ ] **Step 5: 实现 AuroraBackground.swift**

```swift
import SwiftUI

/// 极光渐变背景：3 个 radial 光斑 + 145° linear 基底，18s 往返缓慢漂移；
/// Reduce Motion 开启时静止（quota-float styles.css 四层结构移植）。
public struct AuroraBackground: View {
  public let spec: AuroraSpec
  @Environment(\.accessibilityReduceMotion) private var reduceMotion
  @State private var drift = false

  public init(spec: AuroraSpec) {
    self.spec = spec
  }

  public var body: some View {
    GeometryReader { geo in
      ZStack {
        LinearGradient(colors: [spec.linearStart, spec.linearMid, spec.linearEnd],
                       startPoint: .topLeading, endPoint: .bottomTrailing)
        RadialGradient(colors: [spec.cool.opacity(0.9), spec.cool.opacity(0)],
                       center: UnitPoint(x: 0.52, y: 0.12), startRadius: 0,
                       endRadius: geo.size.width * 0.75)
        RadialGradient(colors: [spec.glow.opacity(0.78), spec.glow.opacity(0)],
                       center: UnitPoint(x: 0.28, y: 0.68), startRadius: 0,
                       endRadius: geo.size.width * 0.7)
        RadialGradient(colors: [spec.warm.opacity(0.64), spec.warm.opacity(0)],
                       center: UnitPoint(x: 0.82, y: 0.82), startRadius: 0,
                       endRadius: geo.size.width * 0.6)
      }
      .opacity(spec.auroraOpacity)
      .offset(x: drift ? 0.05 * geo.size.width : -0.02 * geo.size.width,
              y: drift ? 0.04 * geo.size.height : -0.02 * geo.size.height)
      .scaleEffect(drift ? 1.16 : 1.1)
      .frame(width: geo.size.width, height: geo.size.height)
      .clipped()
      .onAppear {
        guard !reduceMotion else { return }
        withAnimation(.easeInOut(duration: 18).repeatForever(autoreverses: true)) {
          drift = true
        }
      }
    }
    .allowsHitTesting(false)
  }
}
```

- [ ] **Step 6: UsageBarView 加渐变支持**

`UsageBarView.swift` 整文件替换为：

```swift
import SwiftUI

/// 4pt 高胶囊进度条：轨道 `Color.primary.opacity(0.12)` + 前景 tint（或多彩模式渐变），按 percent 截断（leading 对齐）。
public struct UsageBarView: View {
  public let percent: Double // 0...1 已用
  public let tint: Color
  /// 多彩模式：平台色渐变填充；nil 时单色 tint（系统模式现状）
  public let gradient: LinearGradient?

  public init(percent: Double, tint: Color, gradient: LinearGradient? = nil) {
    self.percent = percent
    self.tint = tint
    self.gradient = gradient
  }

  public var body: some View {
    Capsule()
      .fill(Color.primary.opacity(0.12))
      .frame(height: 4)
      .overlay(alignment: .leading) {
        GeometryReader { geo in
          Capsule()
            .fill(gradient ?? LinearGradient(colors: [tint], startPoint: .leading, endPoint: .trailing))
            .frame(width: geo.size.width * min(max(percent, 0), 1))
        }
      }
      .accessibilityLabel(Formatting.pct(percent))
  }
}
```

- [ ] **Step 7: 跑测试确认通过**

Run: `cd mac-os-only-fans/UsageBar/Packages/UsageUI && DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer swift test 2>&1 | tail -3`
Expected: `Test run with 11 tests ... passed`（9 + 新增 2）。

- [ ] **Step 8: Commit**

```bash
git add mac-os-only-fans/UsageBar/Packages/UsageUI
git commit -m "feat(usageui): add AppearanceMode, PlatformPalette, AuroraBackground, gradient UsageBarView"
```

---

### Task 5: 浮窗多彩接线（WidgetSettings 外观键 + 极光注入 + 文字/进度条配色）

**Files:**
- Modify: `mac-os-only-fans/UsageBar/UsageBar/Sources/Widget/FloatingPanel.swift`（WidgetSettings 加 appearanceMode）
- Modify: `mac-os-only-fans/UsageBar/UsageBar/Sources/Widget/WidgetRootView.swift`
- Modify: `mac-os-only-fans/UsageBar/Packages/UsageUI/Sources/UsageUI/PlatformCardView.swift`

**Interfaces:**
- Consumes: Task 4 全部产物；Task 1 `selectedPlatform`。
- Produces: `WidgetSettings.appearanceMode: AppearanceMode`（get/set，UserDefaults `"appearanceMode"`，缺省 `.colorful`）；`PlatformCardView(card:platform:appearance:onPrev:onNext:)`。

- [ ] **Step 1: WidgetSettings 加外观键**（FloatingPanel.swift 的 WidgetSettings enum 内）

```swift
  static let appearanceKey = "appearanceMode"

  /// 外观模式：默认多彩（首次写入前视为 .colorful）
  static var appearanceMode: AppearanceMode {
    get {
      guard let raw = UserDefaults.standard.string(forKey: appearanceKey),
            let mode = AppearanceMode(rawValue: raw) else { return .colorful }
      return mode
    }
    set { UserDefaults.standard.set(newValue.rawValue, forKey: appearanceKey) }
  }
```

（FloatingPanel.swift 需 `import UsageCore` 之外已有 `import UsageUI`——AppearanceMode 在 UsageUI，确认 import 保留。）

- [ ] **Step 2: PlatformCardView 支持多彩文字/进度条**

`PlatformCardView` 加属性与 init 参数（默认值向后兼容）：

```swift
  public let appearance: AppearanceMode

  public init(card: PlatformUsage, platform: PlatformID,
              appearance: AppearanceMode = .system,
              onPrev: @escaping () -> Void, onNext: @escaping () -> Void) {
    self.card = card
    self.platform = platform
    self.appearance = appearance
    self.onPrev = onPrev
    self.onNext = onNext
  }

  /// 多彩模式主文字近黑（浅极光底可读性）；系统模式沿用 primary 自适应
  private var primaryText: Color {
    appearance == .colorful ? PlatformPalette.primaryText : .primary
  }

  /// 多彩模式：平台色进度条渐变；系统模式 nil（UsageBarView 单色 tint）
  private var progressGradient: LinearGradient? {
    guard appearance == .colorful else { return nil }
    let spec = PlatformPalette.spec(for: card.platform)
    return LinearGradient(colors: [spec.progressStart, spec.progressEnd],
                          startPoint: .leading, endPoint: .trailing)
  }
```

改动 4 处：
1. header 的 `Text(card.displayName)` 加 `.foregroundStyle(primaryText)`。
2. featuredRow 的大百分比 `Text(String(format: ...))` 的 `.foregroundStyle(tint)` 改为 `.foregroundStyle(appearance == .colorful ? primaryText : tint)`；`UsageBarView(percent: w.percent, tint: tint)` 改为 `UsageBarView(percent: w.percent, tint: tint, gradient: progressGradient)`。
3. compactRow 的 `Text(w.label)` 加 `.foregroundStyle(primaryText)`；`UsageBarView(percent: w.percent, tint: StatusPalette.color(forUsedPercent: w.percent))` 加参数 `, gradient: progressGradient`。
4. 状态文案（statusLine）、note、reset 文案保持现状（secondary/yellow 在极光底上仍可读）。

- [ ] **Step 3: WidgetRootView 注入极光 + 外观订阅**

`WidgetRootView` 增加：

```swift
  /// 外观模式：设置页/右键菜单写 UserDefaults 后经 onReceive 回读刷新（沿用 T8 双向同步模式）
  @State private var appearance: AppearanceMode = WidgetSettings.appearanceMode
```

body 的 `Group` 加背景与订阅：

```swift
    Group {
      switch controller.mode {
      case .card: cardBody
      case .orb: orbBody
      }
    }
    .frame(
      width: controller.mode == .card ? WidgetController.cardSize.width : WidgetController.orbSize.width,
      height: controller.mode == .card ? WidgetController.cardSize.height : WidgetController.orbSize.height
    )
    .background {
      if appearance == .colorful {
        AuroraBackground(spec: PlatformPalette.spec(for: controller.displayedPlatform))
      }
    }
    .onReceive(NotificationCenter.default.publisher(for: UserDefaults.didChangeNotification)) { _ in
      appearance = WidgetSettings.appearanceMode
    }
```

`cardBody` 的 `PlatformCardView(...)` 调用加参数 `appearance: appearance,`。

`orbBody` 改为：

```swift
  private var orbBody: some View {
    let card = state.store.cards[controller.displayedPlatform]
    let percent = (card?.status == .ok || card?.status == .stale) ? card?.windows.first?.percent : nil
    return OrbView(percent: percent,
                   tint: appearance == .colorful
                     ? PlatformPalette.primaryText
                     : percent.map { StatusPalette.color(forUsedPercent: $0) } ?? Color.secondary)
      .contentShape(Rectangle())
      .onTapGesture { controller.expand() }
  }
```

`OrbView` 改为接收 tint：

```swift
/// 80×80 悬浮球：背景由面板/极光层提供，仅显大百分比。
private struct OrbView: View {
  let percent: Double?
  let tint: Color

  var body: some View {
    Text(percent.map { String(format: "%.0f%%", min(max($0, 0), 1) * 100) } ?? "—")
      .font(.system(size: 26, weight: .bold))
      .monospacedDigit()
      .foregroundStyle(tint)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}
```

- [ ] **Step 4: 多彩模式去磨砂**（FloatingPanel/WidgetController）

WidgetController 的 `applyWidgetSettings()` 改为：

```swift
  private func applyWidgetSettings() {
    guard let panel else { return }
    panel.level = WidgetSettings.alwaysOnTop ? .floating : .normal
    // 多彩模式：磨砂层隐藏（极光背景接管）；系统模式：透明度滑杆作用磨砂层
    container?.blur.alphaValue = WidgetSettings.appearanceMode == .colorful
      ? 0 : CGFloat(WidgetSettings.opacity)
    panel.ignoresMouseEvents = WidgetSettings.clickThrough
  }
```

`show()` 中 `container.blur.alphaValue = CGFloat(WidgetSettings.opacity)` 改为：

```swift
    container.blur.alphaValue = WidgetSettings.appearanceMode == .colorful
      ? 0 : CGFloat(WidgetSettings.opacity)
```

- [ ] **Step 5: 构建 + 测试**

Run: `mac-os-only-fans/UsageBar/scripts/dev-mac.sh 2>&1 | tail -3`
Expected: 构建绿。

Run: `cd mac-os-only-fans/UsageBar/Packages/UsageUI && DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer swift test 2>&1 | tail -3`
Expected: 11 tests passed。

- [ ] **Step 6: Commit**

```bash
git add mac-os-only-fans/UsageBar
git commit -m "feat(widget): colorful aurora theme with per-platform palette (default), system theme preserved"
```

---

### Task 6: 浮层淡彩底 + 设置页「外观」分区

**Files:**
- Modify: `mac-os-only-fans/UsageBar/Packages/UsageUI/Sources/UsageUI/UsageListRowView.swift`
- Modify: `mac-os-only-fans/UsageBar/UsageBar/Sources/Popover/PopoverRootView.swift`
- Modify: `mac-os-only-fans/UsageBar/UsageBar/Sources/Settings/SettingsView.swift`

**Interfaces:**
- Consumes: `WidgetSettings.appearanceMode`（Task 5）、`PlatformPalette.spec(for:)`（Task 4）。
- Produces: `UsageListRowView(card:tintBackground:)`（tintBackground 默认 nil 向后兼容）。

- [ ] **Step 1: UsageListRowView 加淡彩底**

加属性与 init：

```swift
  /// 多彩模式：平台色淡底（nil = 无底，系统模式现状）
  public let tintBackground: Color?

  public init(card: PlatformUsage, tintBackground: Color? = nil) {
    self.card = card
    self.tintBackground = tintBackground
  }
```

body 末尾（`.opacity(...)` 之后）加：

```swift
    .padding(.vertical, tintBackground == nil ? 0 : 6)
    .padding(.horizontal, tintBackground == nil ? 0 : 8)
    .background {
      if let tintBackground {
        RoundedRectangle(cornerRadius: 8).fill(tintBackground)
      }
    }
```

- [ ] **Step 2: PopoverRootView 传入淡彩**

加状态：

```swift
  /// 外观模式：设置页切换后经 onReceive 回读刷新（T8 双向同步模式）
  @State private var appearance: AppearanceMode = WidgetSettings.appearanceMode
```

卡列表循环改为：

```swift
      ForEach(PlatformID.allCases, id: \.self) { id in
        if let card = state.store.cards[id] {
          UsageListRowView(card: card,
                           tintBackground: appearance == .colorful
                             ? PlatformPalette.spec(for: id).glow.opacity(0.35) : nil)
        } else {
          placeholderRow(id)
        }
      }
```

body 根部（`.frame(width: 340)` 之后）加：

```swift
    .onReceive(NotificationCenter.default.publisher(for: UserDefaults.didChangeNotification)) { _ in
      appearance = WidgetSettings.appearanceMode
    }
```

（PopoverRootView.swift 需能见 WidgetSettings——它在 FloatingPanel.swift 同 target，无需 import；AppearanceMode/PlatformPalette 在 UsageUI，文件已有 `import UsageUI`。）

- [ ] **Step 3: SettingsView 加「外观」分区**

加状态（类顶部 @State 区）：

```swift
  @State private var appearanceMode = WidgetSettings.appearanceMode
```

`generalSection` 与 `widgetSection` 之间插入：

```swift
  // MARK: - 外观

  private var appearanceSection: some View {
    Section("外观") {
      Picker("配色", selection: $appearanceMode) {
        Text("多彩").tag(AppearanceMode.colorful)
        Text("系统").tag(AppearanceMode.system)
      }
      .pickerStyle(.segmented)
      .onChange(of: appearanceMode) { newValue in
        WidgetSettings.appearanceMode = newValue
      }
      Text("多彩：各平台固定色极光渐变（浮窗/浮层即时生效）；系统：磨砂 + 用量三档色。菜单栏文本受 macOS 限制恒为单色。")
        .font(.footnote)
        .foregroundStyle(.secondary)
    }
  }
```

`body` 的 Form 改为：

```swift
    Form {
      bridgeSection
      generalSection
      appearanceSection
      widgetSection
    }
```

`onReceive(UserDefaults.didChangeNotification)` 闭包内追加一行回读：

```swift
      appearanceMode = WidgetSettings.appearanceMode
```

（SettingsView.swift 需 `import UsageUI`——检查文件顶部 import 区，若无则加。）

- [ ] **Step 4: 构建 + 测试**

Run: `mac-os-only-fans/UsageBar/scripts/dev-mac.sh 2>&1 | tail -3`
Expected: 构建绿。

Run: `cd mac-os-only-fans/UsageBar/Packages/UsageCore && DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer swift test 2>&1 | tail -3 && cd ../UsageUI && DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer swift test 2>&1 | tail -3`
Expected: UsageCore 56、UsageUI 11 全绿。

- [ ] **Step 5: Commit**

```bash
git add mac-os-only-fans/UsageBar
git commit -m "feat(settings): appearance section (colorful/system) + popover per-platform tint"
```

---

### Task 7: README 同步 + 全量回归

**Files:**
- Modify: `mac-os-only-fans/UsageBar/README.md`

**Interfaces:**
- Consumes: Task 1–6 全部。

- [ ] **Step 1: README 三处更新**

1. 第 13 行 `- **菜单栏**：常驻显示用量最高的平台（图标 + 百分比），点击展开浮层。` 改为：
   `- **菜单栏**：常驻显示 5h 细粒度用量最高的平台（短名 + 该平台最细窗口百分比），点击展开浮层；与桌面浮窗显示同一平台（联动）。`
2. 第 15 行浮窗描述中 `12s 自动轮播四平台，` 删除，改为 `显示与菜单栏联动的当前平台（卡片箭头可手动切换，下次数据刷新自动回到 5h 最高平台），`。
3. 「功能」列表追加一行：
   `- **外观**：多彩（默认，各平台固定色极光渐变）/ 系统（磨砂 + 三档色）双配色，设置页「外观」分区切换，浮窗/浮层即时生效；菜单栏文本受 macOS 限制恒为单色。`
4. 验收清单（第 110-112 行附近）第 2 条 `浮窗拖动 / 12s 轮播 / 2s 收缩球` 改为 `浮窗拖动 / 菜单栏联动（手动切换同步、刷新回弹）/ 2s 收缩球`。

- [ ] **Step 2: 全量回归**

Run: `/Users/separationofconcerns/Library/pnpm/pnpm vitest run 2>&1 | tail -4`（扩展未动，确认基线 245 绿）
Run: `cd mac-os-only-fans/UsageBar/Packages/UsageCore && DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer swift test 2>&1 | tail -2`（56 绿）
Run: `cd mac-os-only-fans/UsageBar/Packages/UsageUI && DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer swift test 2>&1 | tail -2`（11 绿）
Run: `mac-os-only-fans/UsageBar/scripts/dev-mac.sh 2>&1 | tail -2`（构建绿）

- [ ] **Step 3: Commit**

```bash
git add mac-os-only-fans/UsageBar/README.md
git commit -m "docs: sync README with menubar 5h metric, linkage, appearance modes"
```

---

## 真机验收（控制器执行，全部通过后收尾）

1. 重装 app 到 /Applications 并启动：菜单栏显示「Kimi 24%」式（短名 + 5h %），非 31.5%。
2. 浮窗卡片/orb 平台与菜单栏一致；手动箭头切换 → 菜单栏同步切；等 ≤70s 推送后自动回到 5h 最高平台。
3. 默认多彩：浮窗四平台极光配色互异（Kimi 靛蓝紫/MiMo 橙/MiniMax 青绿/火山红），文字可读；orb 同款极光。
4. 设置页「外观」切系统：浮窗回磨砂 + 三档色，与 v1 视觉一致；切回多彩即时恢复。
5. 浮层卡片多彩淡底；菜单栏文本两模式均单色。
6. `screencapture` 留证（菜单栏条 + 浮窗卡片 + 设置页）。
