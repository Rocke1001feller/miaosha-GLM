# UsageBar macOS 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建 macOS 菜单栏 + 浮动桌面小组件，实时显示 MiniMax/Kimi/小米MiMo/火山引擎四平台 Coding Plan token 用量（spec：`docs/superpowers/specs/2026-07-21-usagebar-macos-design.md`）。

**Architecture:** Chrome 扩展（已有 M6 数据面）经 `127.0.0.1:17389` HTTP 桥推送 `UsageCache` 快照到原生 Swift app；app 侧 SwiftPM 分包 `UsageCore`（模型/解析/桥/存储/引擎）+ `UsageUI`（纯展示组件）+ app target（MenuBarExtra 浮层 + NSPanel 浮窗）。原生 Chrome cookie 解密直取作为兑底。

**Tech Stack:** Swift 5.9+ / Xcode 15+ / SwiftUI + AppKit（NSPanel）/ Network.framework / Swift Testing / XcodeGen / 扩展侧 TypeScript（vitest）

## Global Constraints

- 最低系统 **macOS 14**（不使用 Liquid Glass / macOS 26 API）
- xcodeproj 不入库，一律 `xcodegen generate` 生成；构建走 `scripts/dev-mac.sh`
- 百分比语义统一为**已用**（0...1 Double），健康度三档：已用 <50% 绿 / 50–90% 黄 / >90% 红
- 桥端口语义固定 `17389`；配对令牌存 app 侧 UserDefaults + 扩展 `local:bridgeConfig`
- 时间戳在桥 JSON 中为毫秒 epoch（与扩展 `Date.now()` 一致）
- 卡片五态：`ok / stale / unavailable / needs_login / loading`；stale 阈值 10 分钟
- v1 不签名不公证；`LSUIElement = true`（无 Dock 图标）
- 测试：Swift 侧 Swift Testing（`@Suite/@Test/#expect`），扩展侧 vitest；禁止提交红测试

---

### Task 1: XcodeGen 工程骨架 + 空壳菜单栏 app

**Files:**
- Create: `mac-os-only-fans/UsageBar/project.yml`
- Create: `mac-os-only-fans/UsageBar/Packages/UsageCore/Package.swift`
- Create: `mac-os-only-fans/UsageBar/Packages/UsageCore/Sources/UsageCore/Placeholder.swift`
- Create: `mac-os-only-fans/UsageBar/Packages/UsageUI/Package.swift`
- Create: `mac-os-only-fans/UsageBar/Packages/UsageUI/Sources/UsageUI/Placeholder.swift`
- Create: `mac-os-only-fans/UsageBar/UsageBar/Sources/UsageBarApp.swift`
- Create: `mac-os-only-fans/UsageBar/scripts/dev-mac.sh`
- Create: `mac-os-only-fans/UsageBar/.gitignore`

**Interfaces:**
- Produces: 可构建的 `UsageBar.app`，`UsageCore`/`UsageUI` 两个 SwiftPM 库 target 供后续任务填充

- [ ] **Step 1: 写 project.yml 与 Package.swift**

`mac-os-only-fans/UsageBar/project.yml`：

```yaml
name: UsageBar
options:
  bundleIdPrefix: app.usagebar
targets:
  UsageBar:
    type: application
    platform: macOS
    deploymentTarget: "14.0"
    sources:
      - path: UsageBar/Sources
    dependencies:
      - package: UsageCore
      - package: UsageUI
    info:
      path: UsageBar/Info.plist
      properties:
        LSUIElement: true
        CFBundleName: UsageBar
        CFBundleShortVersionString: "0.1.0"
        CFBundleVersion: "1"
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: app.usagebar.mac.dev
        SWIFT_VERSION: "5.9"
        CODE_SIGN_IDENTITY: "-"
packages:
  UsageCore:
    path: Packages/UsageCore
  UsageUI:
    path: Packages/UsageUI
```

`Packages/UsageCore/Package.swift`：

```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
  name: "UsageCore",
  platforms: [.macOS(.v14)],
  products: [.library(name: "UsageCore", targets: ["UsageCore"])],
  targets: [
    .target(name: "UsageCore"),
    .testTarget(name: "UsageCoreTests", dependencies: ["UsageCore"]),
  ]
)
```

`Packages/UsageUI/Package.swift`：

```swift
// swift-tools-version: 5.9
import PackageDescription

let package = Package(
  name: "UsageUI",
  platforms: [.macOS(.v14)],
  products: [.library(name: "UsageUI", targets: ["UsageUI"])],
  dependencies: [.package(path: "../UsageCore")],
  targets: [
    .target(name: "UsageUI", dependencies: ["UsageCore"]),
  ]
)
```

`Packages/*/Sources/*/Placeholder.swift` 各一行：`public enum _Placeholder {}`

`UsageBar/Sources/UsageBarApp.swift`：

```swift
import SwiftUI

@main
struct UsageBarApp: App {
  var body: some Scene {
    MenuBarExtra {
      Text("UsageBar 骨架 OK").padding()
    } label: {
      Image(systemName: "gauge.with.dots.needle.67percent")
    }
    .menuBarExtraStyle(.window)
  }
}
```

`scripts/dev-mac.sh`（`chmod +x`）：

```bash
#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
xcodegen generate
xcodebuild -scheme UsageBar -configuration Debug -derivedDataPath .build build
echo "built: .build/Build/Products/Debug/UsageBar.app"
if [[ "${1:-}" == "run" ]]; then open .build/Build/Products/Debug/UsageBar.app; fi
```

`.gitignore`：`.build/`、`*.xcodeproj/`、`xcuserdata/`、`DerivedData/`

- [ ] **Step 2: 构建验证（先决条件检查）**

Run: `which xcodegen || brew install xcodegen`
Run: `cd mac-os-only-fans/UsageBar && ./scripts/dev-mac.sh`
Expected: 末尾输出 `built: .build/Build/Products/Debug/UsageBar.app`

- [ ] **Step 3: 运行冒烟**

Run: `cd mac-os-only-fans/UsageBar && ./scripts/dev-mac.sh run`
Expected: 菜单栏出现仪表盘图标，点击弹出"UsageBar 骨架 OK"

- [ ] **Step 4: Commit**

```bash
git add mac-os-only-fans/UsageBar
git commit -m "feat(usagebar): xcodegen skeleton with menubar-only app"
```

---

### Task 2: UsageCore 数据模型 + 桥快照解码

**Files:**
- Create: `mac-os-only-fans/UsageBar/Packages/UsageCore/Sources/UsageCore/Models.swift`
- Create: `mac-os-only-fans/UsageBar/Packages/UsageCore/Sources/UsageCore/BridgeSnapshot.swift`
- Test: `mac-os-only-fans/UsageBar/Packages/UsageCore/Tests/UsageCoreTests/ModelsTests.swift`

**Interfaces:**
- Produces（后续所有任务依赖）:
  - `enum PlatformID: String, Codable, CaseIterable, Sendable { case minimax, kimi, mimo, volcengine }`
  - `struct UsageWindow: Codable, Equatable, Sendable { var label: String; var percent: Double; var usedText: String?; var resetAt: Date? }`
  - `enum CardStatus: String, Codable, Sendable { case ok, stale, unavailable, needsLogin = "needs_login", loading }`
  - `struct PlatformUsage: Equatable, Sendable { var platform: PlatformID; var displayName: String; var planName: String?; var status: CardStatus; var windows: [UsageWindow]; var note: String?; var errorMessage: String?; var fetchedAt: Date }`
  - `struct BridgeSnapshot { static func decode(_ data: Data) throws -> [PlatformID: PlatformUsage] }`

- [ ] **Step 1: 写失败测试**

`Tests/UsageCoreTests/ModelsTests.swift`：

```swift
import Testing
import Foundation
@testable import UsageCore

@Suite("BridgeSnapshot 解码")
struct BridgeSnapshotTests {
  @Test func 解码扩展UsageCache形状() throws {
    // 与扩展 lib/usage/types.ts 的 UsageCache 一致：fetchedAt/resetAt 为毫秒 epoch
    let json = """
    {
      "kimi": {
        "platform": "kimi", "displayName": "Kimi Code",
        "consoleUrl": "https://www.kimi.com/code/console",
        "status": "ok", "planName": "Vivace",
        "bars": [
          {"label": "频限明细（5h）", "percent": 0.109, "resetAt": 1784000000000},
          {"label": "本周用量", "percent": 0.176, "usedText": null}
        ],
        "fetchedAt": 1783999000000
      },
      "volcengine": {
        "platform": "volcengine", "displayName": "火山引擎",
        "consoleUrl": "https://console.volcengine.com/",
        "status": "needs_login", "bars": [], "errorMessage": "会话已过期且自动登录失败，请打开控制台登录",
        "fetchedAt": 1783999000000
      }
    }
    """.data(using: .utf8)!
    let cards = try BridgeSnapshot.decode(json)
    let kimi = try #require(cards[.kimi])
    #expect(kimi.status == .ok)
    #expect(kimi.planName == "Vivace")
    #expect(kimi.windows.count == 2)
    #expect(kimi.windows[0].percent == 0.109)
    #expect(kimi.windows[0].resetAt == Date(timeIntervalSince1970: 1_784_000_000))
    #expect(kimi.windows[0].usedText == nil)
    #expect(cards[.volcengine]?.status == .needsLogin)
    #expect(cards[.volcengine]?.errorMessage?.contains("自动登录失败") == true)
  }

  @Test func 未知平台键被忽略_error映射为unavailable() throws {
    let json = """
    { "unknown-x": {"platform":"unknown-x","displayName":"X","status":"ok","bars":[],"fetchedAt":1},
      "mimo": {"platform":"mimo","displayName":"小米 MiMo","status":"error","bars":[],"errorMessage":"HTTP 500","fetchedAt":1783999000000} }
    """.data(using: .utf8)!
    let cards = try BridgeSnapshot.decode(json)
    #expect(cards.count == 1)
    #expect(cards[.mimo]?.status == .unavailable)
  }
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd mac-os-only-fans/UsageBar/Packages/UsageCore && swift test`
Expected: 编译错误（`BridgeSnapshot` 不存在）

- [ ] **Step 3: 实现 Models.swift + BridgeSnapshot.swift**

`Sources/UsageCore/Models.swift`：

```swift
import Foundation

public enum PlatformID: String, Codable, CaseIterable, Sendable {
  case minimax, kimi, mimo, volcengine
}

public struct UsageWindow: Codable, Equatable, Sendable {
  public var label: String
  public var percent: Double // 0...1 已用
  public var usedText: String?
  public var resetAt: Date?
  public init(label: String, percent: Double, usedText: String? = nil, resetAt: Date? = nil) {
    self.label = label; self.percent = percent; self.usedText = usedText; self.resetAt = resetAt
  }
}

public enum CardStatus: String, Codable, Sendable {
  case ok, stale, unavailable, needsLogin = "needs_login", loading
}

public struct PlatformUsage: Equatable, Sendable {
  public var platform: PlatformID
  public var displayName: String
  public var planName: String?
  public var status: CardStatus
  public var windows: [UsageWindow]
  public var note: String?
  public var errorMessage: String?
  public var fetchedAt: Date
  public init(platform: PlatformID, displayName: String, planName: String? = nil,
              status: CardStatus, windows: [UsageWindow] = [], note: String? = nil,
              errorMessage: String? = nil, fetchedAt: Date) {
    self.platform = platform; self.displayName = displayName; self.planName = planName
    self.status = status; self.windows = windows; self.note = note
    self.errorMessage = errorMessage; self.fetchedAt = fetchedAt
  }
  /// 已用最高的窗口百分比（0...1）
  public var maxUsedPercent: Double { windows.map(\.percent).max() ?? 0 }
}
```

`Sources/UsageCore/BridgeSnapshot.swift`：

```swift
import Foundation

/// 解码扩展 POST 的 UsageCache JSON（键为平台 id；fetchedAt/resetAt 为毫秒 epoch）。
public enum BridgeSnapshot {
  public enum DecodeError: Error { case notADictionary, entryNotObject }

  public static func decode(_ data: Data) throws -> [PlatformID: PlatformUsage] {
    guard let root = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
      throw DecodeError.notADictionary
    }
    var out: [PlatformID: PlatformUsage] = [:]
    for (key, value) in root {
      guard let id = PlatformID(rawValue: key) else { continue } // 未知平台忽略
      guard let obj = value as? [String: Any] else { throw DecodeError.entryNotObject }
      out[id] = try decodeCard(id: id, obj: obj)
    }
    return out
  }

  private static func decodeCard(id: PlatformID, obj: [String: Any]) throws -> PlatformUsage {
    let statusRaw = obj["status"] as? String ?? "error"
    let status: CardStatus = switch statusRaw {
    case "ok": .ok
    case "needs_login": .needsLogin
    case "stale": .stale
    default: .unavailable // "error" / "no_subscription" 等归并为 unavailable
    }
    let bars = (obj["bars"] as? [[String: Any]]) ?? []
    let windows = bars.map { b in
      UsageWindow(
        label: b["label"] as? String ?? "",
        percent: b["percent"] as? Double ?? 0,
        usedText: b["usedText"] as? String,
        resetAt: (b["resetAt"] as? Double).map { Date(timeIntervalSince1970: $0 / 1000) }
      )
    }
    let fetchedMs = (obj["fetchedAt"] as? Double) ?? 0
    return PlatformUsage(
      platform: id,
      displayName: obj["displayName"] as? String ?? id.rawValue,
      planName: obj["planName"] as? String,
      status: status,
      windows: windows,
      note: obj["note"] as? String,
      errorMessage: obj["errorMessage"] as? String,
      fetchedAt: Date(timeIntervalSince1970: fetchedMs / 1000)
    )
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd mac-os-only-fans/UsageBar/Packages/UsageCore && swift test`
Expected: 2 tests passed

- [ ] **Step 5: Commit**

```bash
git add mac-os-only-fans/UsageBar/Packages/UsageCore
git commit -m "feat(usagebar-core): models + bridge snapshot decoder"
```

---

### Task 3: 四平台解析器（兑底通道用）+ fixture 测试

**Files:**
- Create: `mac-os-only-fans/UsageBar/Packages/UsageCore/Sources/UsageCore/Parsers/MiniMaxParser.swift`
- Create: `mac-os-only-fans/UsageBar/Packages/UsageCore/Sources/UsageCore/Parsers/KimiParser.swift`
- Create: `mac-os-only-fans/UsageBar/Packages/UsageCore/Sources/UsageCore/Parsers/MimoParser.swift`
- Create: `mac-os-only-fans/UsageBar/Packages/UsageCore/Sources/UsageCore/Parsers/VolcParser.swift`
- Test: `mac-os-only-fans/UsageBar/Packages/UsageCore/Tests/UsageCoreTests/ParserTests.swift`

**Interfaces:**
- Consumes: `PlatformID`/`UsageWindow`（Task 2）
- Produces（Task 10 兑底 provider 依赖）:
  - `enum MiniMaxParser { static func windows(from data: Data) -> [UsageWindow]? }`（解析失败/无 general 模型 → nil）
  - `enum KimiParser { static func windows(from data: Data) -> [UsageWindow]? }`
  - `enum MimoParser { static func windows(usage: Data, detail: Data?) -> ([UsageWindow], planName: String?, note: String?) }`
  - `enum VolcParser { static func windows(afp: Data, coding: Data?) -> ([UsageWindow], planName: String, note: String?) }`

**关键事实（移植源）**：解析逻辑逐一对应 `lib/usage/parsers.ts`（`parseMinimax`/`parseKimi`/`parseMimo`/`parseVolc`，仓库根目录）。fixture 形状直接取自 `tests/unit/usage/providers.test.ts` 中的 `MIMO_USAGE_OK`/`KIMI_OK`/`VOLC_AFP_OK` 与该文件的 minimax 用例；实现前必须先读这两个文件。

- [ ] **Step 1: 写失败测试（fixture 为真实响应形状）**

`Tests/UsageCoreTests/ParserTests.swift`：

```swift
import Testing
import Foundation
@testable import UsageCore

@Suite("平台解析器")
struct ParserTests {
  @Test func kimi_频限双窗口() throws {
    // 形状同 tests/unit/usage/providers.test.ts 的 KIMI_OK
    let json = """
    {"code":0,
     "ratelimitCode5h":{"ratio":0.3,"resetTime":"2026-07-21T05:00:00Z"},
     "ratelimitCode7d":{"ratio":0.15,"resetTime":"2026-07-28T00:00:00Z"}}
    """.data(using: .utf8)!
    let w = try #require(KimiParser.windows(from: json))
    #expect(w.count == 2)
    #expect(w[0].label == "频限明细（5h）")
    #expect(w[0].percent == 0.3)
    #expect(w[0].resetAt != nil)
    #expect(w[1].label == "本周用量")
    #expect(w[1].percent == 0.15)
  }

  @Test func mimo_套餐与月用量() throws {
    // 形状同 providers.test.ts 的 MIMO_USAGE_OK / MIMO_DETAIL_OK
    let usage = """
    {"code":0,"data":{
      "usage":{"items":[{"name":"plan_total_token","percent":0.5,"used":100,"limit":200}]},
      "monthUsage":{"items":[{"percent":0.25,"used":50,"limit":200}]}}}
    """.data(using: .utf8)!
    let detail = """{"code":0,"data":{"planName":"Lite","currentPeriodEnd":"2027-05-28"}}""".data(using: .utf8)!
    let (w, plan, note) = MimoParser.windows(usage: usage, detail: detail)
    #expect(w.count == 2)
    #expect(w[0].label == "套餐用量" && w[0].percent == 0.5)
    #expect(w[0].usedText == "100 / 200")
    #expect(w[1].label == "月用量" && w[1].percent == 0.25)
    #expect(plan == "Lite")
    #expect(note == "Lite 套餐 · 有效期至 2027-05-28")
  }

  @Test func volc_AFP三窗口与套餐名() throws {
    // 形状同 providers.test.ts 的 VOLC_AFP_OK / VOLC_CODING_OK
    let afp = """
    {"Result":{"PlanType":"small",
      "AFPFiveHour":{"Quota":2000,"Used":100,"ResetTime":0},
      "AFPWeekly":{"Quota":7000,"Used":0,"ResetTime":0},
      "AFPMonthly":{"Quota":20000,"Used":900,"ResetTime":0}}}
    """.data(using: .utf8)!
    let coding = """{"Result":{"Status":"Reclaimed"}}""".data(using: .utf8)!
    let (w, plan, note) = VolcParser.windows(afp: afp, coding: coding)
    #expect(w.count == 3)
    #expect(w[0].label == "近5小时" && abs(w[0].percent - 0.05) < 1e-9)
    #expect(w[0].usedText == "100 / 2,000")
    #expect(w[2].label == "近一月" && abs(w[2].percent - 0.045) < 1e-9)
    #expect(plan == "Agent Plan Small")
    #expect(note == "Coding Plan 未订阅（已回收）")
  }

  @Test func minimax_取general模型() throws {
    // 先读 lib/usage/parsers.ts 的 parseMinimax 确认字段路径再定 fixture
    let json = """
    {"base_resp":{"status_code":0},
     "data":{"token_plan_remains":[
       {"model_name":"general","five_hour_remains_percent":79,"weekly_remains_percent":96,
        "five_hour_reset_time":1784000000000,"weekly_reset_time":1784500000000}]}}
    """.data(using: .utf8)!
    let w = try #require(MiniMaxParser.windows(from: json))
    #expect(w.count == 2)
    #expect(w[0].label == "5h 限额" && abs(w[0].percent - 0.21) < 1e-9) // 已用 = 1 - 剩余
    #expect(w[1].label == "周限额" && abs(w[1].percent - 0.04) < 1e-9)
  }
}
```

**注意**：minimax fixture 字段名以 `lib/usage/parsers.ts` 实际为准——若真实字段不是 `token_plan_remains`/`five_hour_remains_percent` 等，按真实源码修正 fixture 与断言；语义是"接口返回剩余百分比，UI 显示已用 = 1 − 剩余"。

- [ ] **Step 2: 跑测试确认失败**

Run: `cd mac-os-only-fans/UsageBar/Packages/UsageCore && swift test`
Expected: 编译错误（四个 Parser 不存在）

- [ ] **Step 3: 移植四个解析器**

先读 `lib/usage/parsers.ts` 全文，逐函数移植（JSONSerialization 手写取值，风格参照 Task 2 的 BridgeSnapshot）。公开表面严格等于 Interfaces 声明。`fmtInt`/`fmtAfp` 的千分位格式（`8,162,846,607` / `2,000` / `2万`）也一并移植为 `Support/Format.swift` 的 `public func fmtInt(_ v: Double) -> String`、`public func fmtAfp(_ v: Double) -> String`（Volc usedText 用 fmtAfp；`fmtAfp(20000)="2万"`、`fmtAfp(2000)="2,000"`、`fmtAfp(900.855)="900.9"`）。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd mac-os-only-fans/UsageBar/Packages/UsageCore && swift test`
Expected: 全部通过（含 fmtInt/fmtAfp 的边界断言，若步骤 3 发现格式不一致须补测试）

- [ ] **Step 5: Commit**

```bash
git add mac-os-only-fans/UsageBar/Packages/UsageCore
git commit -m "feat(usagebar-core): port four platform parsers with fixtures"
```

---

### Task 4: BridgeServer（127.0.0.1 HTTP 接收）

**Files:**
- Create: `mac-os-only-fans/UsageBar/Packages/UsageCore/Sources/UsageCore/Bridge/BridgeServer.swift`
- Test: `mac-os-only-fans/UsageBar/Packages/UsageCore/Tests/UsageCoreTests/BridgeServerTests.swift`

**Interfaces:**
- Consumes: `BridgeSnapshot.decode`（Task 2）
- Produces（Task 5/7 依赖）:
  - `final class BridgeServer: @unchecked Sendable`
  - `init(port: UInt16 = 17389, token: String)`
  - `func start() throws` / `func stop()`
  - `var onSnapshot: (@Sendable ([PlatformID: PlatformUsage]) -> Void)?`
  - `private(set) var lastReceivedAt: Date?`

**实现要点**：Network.framework `NWListener`（`NWParameters.tcp`，`requiredInterfaceType = .loopback`）。手工解析最小 HTTP：读 `\r\n\r\n` 分隔的头部，取 `Content-Length` 与 `Authorization: Bearer <token>`，校验失败回 `401`，非 `/v1/usage` 回 `404`，body 解码成功回 `200 {"ok":true}` 并回调 `onSnapshot`，解码失败回 `400`。每个连接独立 `NWConnection`，收到完整 body 后回响应并关闭。

- [ ] **Step 1: 写失败测试**

`Tests/UsageCoreTests/BridgeServerTests.swift`：

```swift
import Testing
import Foundation
@testable import UsageCore

@Suite("BridgeServer")
struct BridgeServerTests {
  private func post(port: UInt16, path: String, token: String?, body: String) async throws -> (Int, String) {
    var req = URLRequest(url: URL(string: "http://127.0.0.1:\(port)\(path)")!)
    req.httpMethod = "POST"
    if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
    req.httpBody = body.data(using: .utf8)
    let (data, res) = try await URLSession.shared.data(for: req)
    return ((res as! HTTPURLResponse).statusCode, String(data: data, encoding: .utf8) ?? "")
  }

  @Test func 正常推送触发onSnapshot_错误令牌401_错误路径404() async throws {
    let server = BridgeServer(port: 0, token: "T1") // port 0 = 系统分配
    try server.start()
    let port = server.boundPort
    let received = Mutex<[PlatformID: PlatformUsage]?>(nil)
    server.onSnapshot = { cards in received.withLock { $0 = cards } }

    let body = """
    {"minimax":{"platform":"minimax","displayName":"MiniMax","status":"ok",
      "bars":[{"label":"5h 限额","percent":0.21}],"fetchedAt":1783999000000}}
    """
    let (code, _) = try await post(port: port, path: "/v1/usage", token: "T1", body: body)
    #expect(code == 200)
    try await Task.sleep(for: .milliseconds(100))
    #expect(received.withLock { $0?[.minimax]?.windows.first?.percent } == 0.21)
    #expect(server.lastReceivedAt != nil)

    let (code401, _) = try await post(port: port, path: "/v1/usage", token: "WRONG", body: body)
    #expect(code401 == 401)
    let (code404, _) = try await post(port: port, path: "/nope", token: "T1", body: body)
    #expect(code404 == 404)
    let (code400, _) = try await post(port: port, path: "/v1/usage", token: "T1", body: "{broken")
    #expect(code400 == 400)
    server.stop()
  }
}
```

`Mutex` 测试辅助（若无系统可用 Mutex 则定义 final class + NSLock 于测试文件头部）。

- [ ] **Step 2: 跑测试确认失败**

Run: `cd mac-os-only-fans/UsageBar/Packages/UsageCore && swift test`
Expected: 编译错误（`BridgeServer` 不存在）

- [ ] **Step 3: 实现 BridgeServer**

关键骨架（实现者补全连接读取循环）：

```swift
import Foundation
import Network

public final class BridgeServer: @unchecked Sendable {
  public private(set) var boundPort: UInt16 = 0
  public private(set) var lastReceivedAt: Date?
  public var onSnapshot: (@Sendable ([PlatformID: PlatformUsage]) -> Void)?
  private let token: String
  private var listener: NWListener?
  private let queue = DispatchQueue(label: "bridge-server")

  public init(port: UInt16 = 17389, token: String) {
    self.boundPort = port
    self.token = token
  }

  public func start() throws {
    let params = NWParameters.tcp
    params.requiredInterfaceType = .loopback
    let listener = try NWListener(using: params, on: NWEndpoint.Port(rawValue: boundPort) ?? 17389)
    listener.newConnectionHandler = { [weak self] conn in self?.handle(conn) }
    listener.stateUpdateHandler = { [weak self] state in
      if case .ready = state { self?.boundPort = listener.port?.rawValue ?? 0 }
    }
    listener.start(queue: queue)
    self.listener = listener
  }

  public func stop() { listener?.cancel(); listener = nil }

  private func handle(_ conn: NWConnection) {
    // 读满 \r\n\r\n → 解析 Content-Length/Authorization → 读 body →
    // 校验 token/path → BridgeSnapshot.decode → 回写状态码 → onSnapshot(cards) → cancel
  }
}
```

注意 `NWListener(using:on:)` 传 0 由系统分配端口；`stateUpdateHandler` 里回填 `boundPort`。

- [ ] **Step 4: 跑测试确认通过**

Run: `cd mac-os-only-fans/UsageBar/Packages/UsageCore && swift test`
Expected: 通过

- [ ] **Step 5: Commit**

```bash
git add mac-os-only-fans/UsageBar/Packages/UsageCore
git commit -m "feat(usagebar-core): loopback bridge server with bearer auth"
```

---

### Task 5: UsageStore + RefreshEngine（stale 状态机 + 节奏）

**Files:**
- Create: `mac-os-only-fans/UsageBar/Packages/UsageCore/Sources/UsageCore/Store/UsageStore.swift`
- Create: `mac-os-only-fans/UsageBar/Packages/UsageCore/Sources/UsageCore/Store/RefreshEngine.swift`
- Create: `mac-os-only-fans/UsageBar/Packages/UsageCore/Sources/UsageCore/Store/SnapshotDiskCache.swift`
- Test: `mac-os-only-fans/UsageBar/Packages/UsageCore/Tests/UsageCoreTests/UsageStoreTests.swift`
- Test: `mac-os-only-fans/UsageBar/Packages/UsageCore/Tests/UsageCoreTests/RefreshEngineTests.swift`

**Interfaces:**
- Consumes: `PlatformUsage`/`CardStatus`（Task 2）、`BridgeServer`（Task 4）
- Produces（Task 7/8/10 依赖）:
  - `@MainActor final class UsageStore: ObservableObject`（macOS 14 用 `@Observable final class UsageStore`，下文同）：
    - `private(set) var cards: [PlatformID: PlatformUsage]`
    - `private(set) var bridgeOnline: Bool`
    - `func apply(snapshot: [PlatformID: PlatformUsage], from source: SnapshotSource)`（`enum SnapshotSource { case bridge, nativeFallback }`）
    - `func evaluateStaleness(now: Date)`（任一 ok 卡 `now - fetchedAt > 10min` → 改 `stale`；`bridgeOnline = 距上次桥推送 ≤ 10min`）
    - `var highestUsed: PlatformUsage?`（ok/stale 卡中 maxUsedPercent 最大者）
  - `@MainActor final class RefreshEngine`：
    - `init(store: UsageStore, bridge: BridgeServer, fallback: (any UsageProvider)?)`
    - `func start()`（30s tick：evaluateStaleness + 桥离线且有 fallback 时拉一次兑底）
    - `func poke()`（立即 evaluateStaleness + 触发 fallback 拉取）
  - `final class SnapshotDiskCache`：`func save(_ cards: [PlatformID: PlatformUsage])`、`func load() -> [PlatformID: PlatformUsage]?`（JSON 写 `~/Library/Application Support/UsageBar/snapshot.json`，tmp→rename 两阶段）

**UsageProvider 协议**（放 `Providers/UsageProvider.swift`，本任务一并建）：

```swift
public protocol UsageProvider: Sendable {
  var id: String { get }
  func fetchSnapshot() async -> [PlatformID: PlatformUsage]
}
```

- [ ] **Step 1: 写失败测试**

`UsageStoreTests.swift`：

```swift
import Testing
import Foundation
@testable import UsageCore

@Suite("UsageStore")
struct UsageStoreTests {
  private func card(_ id: PlatformID, _ pct: Double, status: CardStatus = .ok, fetchedAt: Date) -> PlatformUsage {
    PlatformUsage(platform: id, displayName: id.rawValue, status: status,
                  windows: [UsageWindow(label: "5h", percent: pct)], fetchedAt: fetchedAt)
  }

  @MainActor @Test func apply合并与highestUsed() {
    let store = UsageStore()
    let now = Date()
    store.apply(snapshot: [.kimi: card(.kimi, 0.82, fetchedAt: now),
                           .mimo: card(.mimo, 0.17, fetchedAt: now)], from: .bridge)
    #expect(store.cards.count == 2)
    #expect(store.highestUsed?.platform == .kimi)
    #expect(store.bridgeOnline == true)
  }

  @MainActor @Test func 超10分钟未更新转stale_桥离线() {
    let store = UsageStore()
    let old = Date(timeIntervalSinceNow: -601)
    store.apply(snapshot: [.kimi: card(.kimi, 0.5, fetchedAt: old)], from: .bridge)
    store.evaluateStaleness(now: Date())
    #expect(store.cards[.kimi]?.status == .stale)
    #expect(store.bridgeOnline == false)
    // needs_login / unavailable 卡不被 stale 覆盖
    let store2 = UsageStore()
    store2.apply(snapshot: [.kimi: card(.kimi, 0, status: .needsLogin, fetchedAt: old)], from: .bridge)
    store2.evaluateStaleness(now: Date())
    #expect(store2.cards[.kimi]?.status == .needsLogin)
  }
}
```

`RefreshEngineTests.swift`：

```swift
import Testing
import Foundation
@testable import UsageCore

struct FakeProvider: UsageProvider {
  let id = "fake"
  let snapshot: [PlatformID: PlatformUsage]
  func fetchSnapshot() async -> [PlatformID: PlatformUsage] { snapshot }
}

@Suite("RefreshEngine")
struct RefreshEngineTests {
  @MainActor @Test func 桥离线时poke调用fallback并入库() async {
    let store = UsageStore()
    let bridge = BridgeServer(port: 0, token: "T")
    let fake = FakeProvider(snapshot: [.minimax: PlatformUsage(
      platform: .minimax, displayName: "MiniMax", status: .ok,
      windows: [UsageWindow(label: "5h 限额", percent: 0.2)], fetchedAt: Date())])
    let engine = RefreshEngine(store: store, bridge: bridge, fallback: fake)
    await engine.poke()
    #expect(store.cards[.minimax]?.status == .ok)
    #expect(store.cards[.minimax]?.windows.first?.percent == 0.2)
  }
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd mac-os-only-fans/UsageBar/Packages/UsageCore && swift test`
Expected: 编译错误

- [ ] **Step 3: 实现 UsageStore / RefreshEngine / SnapshotDiskCache / UsageProvider**

要点：
- `UsageStore.apply` 中 bridge 来源快照覆盖同平台旧卡；`bridgeOnline` 仅在 `.bridge` 来源时置 true 并记录时间（stale 判定在 evaluateStaleness）
- `RefreshEngine.start()` 用 `Task { while !Task.isCancelled { try? await Task.sleep(for: .seconds(30)); evaluateStaleness(); if !store.bridgeOnline { await pullFallback() } } }`；`poke()` 立即执行一次同逻辑；fallback 拉取失败静默（保留现有卡）
- `SnapshotDiskCache`：JSONEncoder（`dateEncodingStrategy = .millisecondsSince1970`）写到 tmp 再 `FileManager.moveItem` 原子替换；`PlatformUsage` 需补 `Codable`（在 Models.swift 加扩展，保持 Task 2 测试不破坏）

- [ ] **Step 4: 跑测试确认通过**

Run: `cd mac-os-only-fans/UsageBar/Packages/UsageCore && swift test`
Expected: 通过

- [ ] **Step 5: Commit**

```bash
git add mac-os-only-fans/UsageBar/Packages/UsageCore
git commit -m "feat(usagebar-core): usage store, refresh engine, disk snapshot cache"
```

---

### Task 6: 扩展侧 bridge-push 推送模块

**Files:**
- Create: `lib/usage/bridge-push.ts`
- Modify: `entrypoints/background.ts`（onAlarm 注册处附近加分支；~line 228/401 区域）
- Modify: `entrypoints/options/GeneralPage.svelte`（加配对令牌输入区）
- Test: `tests/unit/usage/bridge-push.test.ts`

**Interfaces:**
- Consumes: `refreshUsageCache()`（`lib/usage/providers.ts`）、`usageCacheStore`（`lib/usage/store.ts`）
- Produces:
  - `interface BridgeConfig { enabled: boolean; port: number; token: string }`（存 `local:bridgeConfig`）
  - `bridgeConfigStore: { get(): Promise<BridgeConfig>; set(cfg: BridgeConfig): Promise<void> }`（默认 `{enabled:false, port:17389, token:''}`）
  - `computePushIntervalMs(cache: UsageCache, now?: number): number`（任一 ok 卡 resetAt ∈ now±15min → 30_000；否则 60_000。注意 chrome.alarms 最小周期 30s，spec 的 20s 修正为 30s）
  - `pushUsageToBridge(cfg: BridgeConfig, cache: UsageCache): Promise<boolean>`（fetch POST `http://127.0.0.1:{port}/v1/usage`，Bearer 头，2s 超时，失败 resolve false 静默）
  - `runBridgePushTick(): Promise<void>`（refreshUsageCache → 若 enabled 则 push）
  - background alarm 名：`usage-bridge-push`

- [ ] **Step 1: 写失败测试**

`tests/unit/usage/bridge-push.test.ts`：

```ts
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { storage } from '#imports';
import {
  bridgeConfigStore,
  computePushIntervalMs,
  pushUsageToBridge,
  runBridgePushTick,
} from '../../../lib/usage/bridge-push';
import type { UsageCache } from '../../../lib/usage/types';

const OK_CACHE: UsageCache = {
  kimi: {
    platform: 'kimi', displayName: 'Kimi Code', consoleUrl: '', status: 'ok',
    bars: [{ label: '5h', percent: 0.5, resetAt: Date.now() + 3600_000 }],
    fetchedAt: Date.now(),
  },
};

describe('bridge-push', () => {
  beforeEach(async () => {
    await storage.removeItem('local:bridgeConfig');
  });

  it('默认配置 disabled；读写往返', async () => {
    expect((await bridgeConfigStore.get()).enabled).toBe(false);
    await bridgeConfigStore.set({ enabled: true, port: 17389, token: 'T1' });
    expect((await bridgeConfigStore.get()).token).toBe('T1');
  });

  it('远离重置窗口 60s；±15min 内 30s', () => {
    const far = computePushIntervalMs(OK_CACHE);
    expect(far).toBe(60_000);
    const near: UsageCache = {
      kimi: { ...OK_CACHE.kimi!, bars: [{ label: '5h', percent: 0.9, resetAt: Date.now() + 10 * 60_000 }] },
    };
    expect(computePushIntervalMs(near)).toBe(30_000);
  });

  it('push 带 Bearer 头与 UsageCache body；失败静默 resolve false', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }) as any);
    vi.stubGlobal('fetch', fetchMock);
    const ok = await pushUsageToBridge({ enabled: true, port: 17389, token: 'T1' }, OK_CACHE);
    expect(ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('http://127.0.0.1:17389/v1/usage');
    expect((init?.headers as any).Authorization).toBe('Bearer T1');
    expect(JSON.parse(init?.body as string).kimi.platform).toBe('kimi');

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
    expect(await pushUsageToBridge({ enabled: true, port: 17389, token: 'T1' }, OK_CACHE)).toBe(false);
  });

  it('runBridgePushTick：disabled 时不发请求', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => '{}' }) as any);
    vi.stubGlobal('fetch', fetchMock);
    // 让四个 provider 全部快速失败也不影响 tick
    await runBridgePushTick();
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('127.0.0.1'))).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `/Users/separationofconcerns/Library/pnpm/pnpm vitest run tests/unit/usage/bridge-push.test.ts`
Expected: 模块不存在报错

- [ ] **Step 3: 实现 bridge-push.ts**

```ts
/**
 * UsageBar macOS 桥推送：把 refreshUsageCache 的结果 POST 到本机 127.0.0.1 的
 * macOS 菜单栏 app。推送失败一律静默（app 未运行属常态）。
 */
import { storage } from '#imports';
import { refreshUsageCache } from './providers';
import type { UsageCache } from './types';

export interface BridgeConfig { enabled: boolean; port: number; token: string }
const KEY = 'local:bridgeConfig';
const DEFAULT_CFG: BridgeConfig = { enabled: false, port: 17389, token: '' };

export const bridgeConfigStore = {
  async get(): Promise<BridgeConfig> {
    return { ...DEFAULT_CFG, ...(await storage.getItem<Partial<BridgeConfig>>(KEY)) };
  },
  async set(cfg: BridgeConfig): Promise<void> {
    await storage.setItem(KEY, cfg);
  },
};

export function computePushIntervalMs(cache: UsageCache, now = Date.now()): number {
  const WINDOW = 15 * 60_000;
  for (const c of Object.values(cache)) {
    if (c?.status !== 'ok') continue;
    for (const b of c.bars) {
      if (b.resetAt && Math.abs(b.resetAt - now) <= WINDOW) return 30_000;
    }
  }
  return 60_000;
}

export async function pushUsageToBridge(cfg: BridgeConfig, cache: UsageCache): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${cfg.port}/v1/usage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify(cache),
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function runBridgePushTick(): Promise<void> {
  const cache = await refreshUsageCache();
  const cfg = await bridgeConfigStore.get();
  if (cfg.enabled && cfg.token) await pushUsageToBridge(cfg, cache);
}
```

- [ ] **Step 4: 接入 background alarms**

在 `entrypoints/background.ts` 顶层（其他 alarms.create 附近，~line 176 区域）加：

```ts
chrome.alarms.create('usage-bridge-push', { periodInMinutes: 0.5 });
```

在 `onAlarm` 监听（line 228 起）的 alarm 分发中加：

```ts
if (alarm.name === 'usage-bridge-push') {
  const { runBridgePushTick } = await import('../lib/usage/bridge-push');
  await runBridgePushTick();
  return;
}
```

注意：`pnpm build` 后确认 `usage-bridge-push` 出现在构建产物 background.js（grep 计数 ≥1）。

- [ ] **Step 5: options 配对 UI**

在 `entrypoints/options/GeneralPage.svelte` 末尾追加"UsageBar 桥配对"卡片：enabled 开关、port 数字输入（默认 17389）、token 文本输入、保存按钮（写 `bridgeConfigStore`）。样式跟随该页现有卡片风格（读该文件顶部现有 section 复用 class）。

- [ ] **Step 6: 跑测试 + 全量回归**

Run: `/Users/separationofconcerns/Library/pnpm/pnpm vitest run tests/unit/usage/bridge-push.test.ts`
Expected: 4 tests pass
Run: `/Users/separationofconcerns/Library/pnpm/pnpm vitest run`
Expected: 全部通过

- [ ] **Step 7: Commit**

```bash
git add lib/usage/bridge-push.ts tests/unit/usage/bridge-push.test.ts entrypoints/background.ts entrypoints/options/GeneralPage.svelte
git commit -m "feat(usage): add UsageBar bridge push (alarms + bearer + accel window)"
```

---

### Task 7: AppState 组装 + 菜单栏 label + 浮层四平台列表

**Files:**
- Create: `mac-os-only-fans/UsageBar/UsageBar/Sources/AppState.swift`
- Create: `mac-os-only-fans/UsageBar/UsageBar/Sources/MenuBarLabel.swift`
- Create: `mac-os-only-fans/UsageBar/UsageBar/Sources/Popover/PopoverRootView.swift`
- Create: `mac-os-only-fans/UsageBar/Packages/UsageUI/Sources/UsageUI/UsageBarView.swift`
- Create: `mac-os-only-fans/UsageBar/Packages/UsageUI/Sources/UsageUI/UsageListRowView.swift`
- Create: `mac-os-only-fans/UsageBar/Packages/UsageUI/Sources/UsageUI/StatusPalette.swift`
- Create: `mac-os-only-fans/UsageBar/Packages/UsageUI/Sources/UsageUI/Formatting.swift`
- Modify: `mac-os-only-fans/UsageBar/UsageBar/Sources/UsageBarApp.swift`

**Interfaces:**
- Consumes: `UsageStore`/`RefreshEngine`/`BridgeServer`（Task 5/4）、`PlatformUsage`（Task 2）
- Produces（Task 8/9 依赖）:
  - `@MainActor final class AppState`：`store: UsageStore`、`engine: RefreshEngine`、`bridge: BridgeServer`、`init()`（装配+load SnapshotDiskCache+start）；
  - `UsageUI` 组件：`UsageBarView(percent:tint:)`（胶囊进度条）、`UsageListRowView(card:)`、`StatusPalette.color(forUsedPercent:)`、`Formatting.pct(_:)`（`"21.0%"`）、`Formatting.resetText(resetAt:now:)`（`"3 小时后重置"`，移植自 `entrypoints/popup/components/UsageView.svelte` 的 `resetText` 逻辑）

- [ ] **Step 1: StatusPalette + Formatting + UsageBarView（UsageUI）**

```swift
// StatusPalette.swift
import SwiftUI
public enum StatusPalette {
  /// 已用 <50% 绿 / 50–90% 黄 / >90% 红
  public static func color(forUsedPercent p: Double) -> Color {
    if p >= 0.9 { return .red }
    if p >= 0.5 { return .orange }
    return .green
  }
}
```

`Formatting.swift`：`pct(0.210)=="21.0%"`；`resetText` 规则：`≤0`→`即将重置`；`≥1天`→`d 天 h 小时后重置`；`≥1时`→`h 小时后重置`；否则 `m 分钟后重置`。

`UsageBarView`：4pt 高胶囊，`Capsule()` 轨道 `Color.primary.opacity(0.12)` + 前景 `tint`，按 percent 截断（`mask` 对齐 leading）。

- [ ] **Step 2: UsageListRowView（UsageUI）**

布局（360pt 宽内）：

```
[平台名 + planName 徽章]        [HH:MM:SS]
[5h 限额  ████░░░░  21.0%]
[3 小时后重置]
[周限额  ██░░░░░░  4.0%]
[5 天 20 小时后重置]
note（灰字小字，可选）
```

每个 window 一行：label(11pt semibold) + UsageBarView + 右侧等宽百分比 + 下行 resetText(9pt secondary)。`needs_login/unavailable/stale` 卡：显示 errorMessage（needs_login 黄字）+ stale 灰化。

- [ ] **Step 3: AppState + MenuBarLabel + PopoverRootView + 接线**

`AppState.swift`：

```swift
import Foundation
import UsageCore

@MainActor
final class AppState: ObservableObject {
  let store: UsageStore
  let engine: RefreshEngine
  let bridge: BridgeServer
  private let diskCache = SnapshotDiskCache()

  init() {
    let store = UsageStore()
    if let cached = diskCache.load() { store.apply(snapshot: cached, from: .nativeFallback) }
    let token = BridgeToken.loadOrCreate() // UserDefaults 存取，首启 UUID 生成，供设置页展示
    let bridge = BridgeServer(token: token)
    try? bridge.start()
    bridge.onSnapshot = { [weak store] cards in
      Task { @MainActor in
        store?.apply(snapshot: cards, from: .bridge)
        self?.diskCache.save(cards)
      }
    }
    let engine = RefreshEngine(store: store, bridge: bridge, fallback: nil)
    engine.start()
    self.store = store; self.bridge = bridge; self.engine = engine
  }
}
```

`BridgeToken`（`Support/BridgeToken.swift` 放 UsageCore）：`static func loadOrCreate() -> String`（UserDefaults key `bridgeToken`，无则 `UUID().uuidString` 写入）。

`MenuBarLabel.swift`：

```swift
import SwiftUI
import UsageCore

struct MenuBarLabel: View {
  let highest: PlatformUsage?
  var body: some View {
    if let highest {
      Text("\(shortName(highest.platform)) \(Formatting.pct(highest.maxUsedPercent))")
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

`PopoverRootView.swift`：宽 340pt；`VStack`：四平台 `UsageListRowView`（按 `PlatformID.allCases` 顺序，缺卡显示"等待数据…"占位行）；分隔线；footer 行：`更新于 HH:mm:ss`（最新 fetchedAt）、`刷新`按钮（`Task { await state.engine.poke() }`）、`显示浮窗`开关（写 UserDefaults `widgetVisible`，Task 8 消费）、`设置…`按钮（Task 9 接线）。全部数据经 `@ObservedObject var state: AppState` → `state.store.cards`。

`UsageBarApp.swift` 改为：

```swift
import SwiftUI

@main
struct UsageBarApp: App {
  @StateObject private var state = AppState()
  var body: some Scene {
    MenuBarExtra {
      PopoverRootView(state: state)
    } label: {
      MenuBarLabel(highest: state.store.highestUsed)
    }
    .menuBarExtraStyle(.window)
  }
}
```

- [ ] **Step 4: 构建运行，手动验收**

Run: `cd mac-os-only-fans/UsageBar && ./scripts/dev-mac.sh run`
Expected: 菜单栏显示图标；打开浮层见四平台占位行；用 curl 推一条假数据后菜单栏变 `MM 21.0%`、列表出现对应卡：

```bash
TOKEN=$(defaults read app.usagebar.mac.dev bridgeToken)
curl -s -X POST http://127.0.0.1:17389/v1/usage -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"minimax":{"platform":"minimax","displayName":"MiniMax","status":"ok","bars":[{"label":"5h 限额","percent":0.21,"resetAt":'$(( $(date +%s) * 1000 + 3600000 ))'}],"fetchedAt":'$(date +%s)'000}}'
```

- [ ] **Step 5: Commit**

```bash
git add mac-os-only-fans/UsageBar
git commit -m "feat(usagebar): app state + menubar label + popover platform list"
```

---

### Task 8: NSPanel 浮动小组件（单卡轮播 + 悬浮球）

**Files:**
- Create: `mac-os-only-fans/UsageBar/UsageBar/Sources/Widget/FloatingPanel.swift`
- Create: `mac-os-only-fans/UsageBar/UsageBar/Sources/Widget/WidgetController.swift`
- Create: `mac-os-only-fans/UsageBar/UsageBar/Sources/Widget/WidgetRootView.swift`
- Create: `mac-os-only-fans/UsageBar/Packages/UsageUI/Sources/UsageUI/PlatformCardView.swift`
- Modify: `mac-os-only-fans/UsageBar/UsageBar/Sources/UsageBarApp.swift`（启动时按 `widgetVisible` 偏好恢复浮窗）
- Modify: `mac-os-only-fans/UsageBar/UsageBar/Sources/Popover/PopoverRootView.swift`（"显示浮窗"开关接线到 WidgetController）

**Interfaces:**
- Consumes: `AppState`（Task 7）、`UsageUI.Formatting/StatusPalette/UsageBarView`（Task 7）
- Produces:
  - `final class FloatingPanel: NSPanel`（borderless + nonactivatingPanel + canJoinAllSpaces/fullScreenAuxiliary + 透明 + 磨砂 + 拖动记忆 + 右键菜单）
  - `@MainActor final class WidgetController: ObservableObject`：`show()`/`hide()`/`toggle()`、`mode: WidgetMode`（`.card`/`.orb`）、`displayedPlatform: PlatformID`（箭头与 12s 轮播驱动）
  - `PlatformCardView(card:platform:onPrev:onNext:)`（UsageUI）

**实现模板（必读）**：`mac-os-only-fans/references/claude-desktop-usage/float_widget.swift`——357-383 行（窗口标志）、409-418 行（圆角+磨砂）、373-380 行（默认右上角定位）、499-540 行（右键菜单）、622-639 行（位置持久化+本地倒计时 tick）、664-673 行（顶边锚定尺寸动画）。照抄这些工程细节，数据层换成 `AppState.store`。

- [ ] **Step 1: FloatingPanel**

核心骨架（照模板补齐）：

```swift
import AppKit

final class FloatingPanel: NSPanel {
  init(contentRect: NSRect, content: NSView) {
    super.init(contentRect: contentRect,
               styleMask: [.borderless, .nonactivatingPanel],
               backing: .buffered, defer: false)
    level = .floating
    collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
    isOpaque = false
    backgroundColor = .clear
    hasShadow = true
    isMovableByWindowBackground = true
    contentView = content
  }
}
```

圆角磨砂：content 用 `NSVisualEffectView`（`.popover` / `.behindWindow` / `.active`），`layer.cornerRadius = 14`、`masksToBounds = true`。位置持久化：`NSWindow.didMoveNotification` → UserDefaults `widgetOrigin.x/y`；首启定位屏幕右上角内缩 16pt。

- [ ] **Step 2: PlatformCardView（UsageUI）**

布局（280pt 宽卡片）：

```
[displayName · planName]      [‹] [›]
[5h 行 label]        [大数字 74%]（28pt bold，三档变色）
[UsageBarView]
[resets in 1h 18m]（9pt secondary）
[周行 label]  [17%]  [UsageBarView]  [resets …]
note（可选，灰字）
```

三档变色用 `StatusPalette.color(forUsedPercent: card.windows.first?.percent ?? 0)`，整卡背景 `Color(nsColor:.controlBackgroundColor).opacity(0)`（磨砂由面板层提供）。`needs_login/stale/unavailable` 态：大数字位显示状态文案（needs_login 黄字），按钮保持可用。

- [ ] **Step 3: WidgetController + WidgetRootView**

```swift
@MainActor
final class WidgetController: ObservableObject {
  enum WidgetMode { case card, orb }
  @Published var mode: WidgetMode = .card
  @Published var displayedPlatform: PlatformID = .kimi
  @Published private(set) var panel: FloatingPanel?

  private let state: AppState
  private var rotateTask: Task<Void, Never>?
  private var idleTask: Task<Void, Never>?

  init(state: AppState) { self.state = state }

  func show() { /* 建 panel + NSHostingView(WidgetRootView)，orderFront，启动 12s 轮播与 2s 空闲收缩 */ }
  func hide() { panel?.close(); panel = nil; rotateTask?.cancel(); idleTask?.cancel() }
  func toggle() { panel == nil ? show() : hide() }

  func nextPlatform() { displayedPlatform = PlatformID.allCases.after(displayedPlatform) }
  func prevPlatform() { displayedPlatform = PlatformID.allCases.before(displayedPlatform) }
  func userInteracted() { /* 重置 2s 空闲计时：到点 mode=.orb 且面板缩到 80×80（顶边锚定动画） */ }
  func expand() { mode = .card /* 恢复 280×~170 */ }
}
```

`WidgetRootView`：`mode == .card ? PlatformCardView(...) : OrbView(percent:)`；orb 为 80×80 圆角方块只显大百分比，点击 `expand()`。卡片 `onHover { if $0 { controller.userInteracted() } }`、箭头按钮调 next/prev 并 `userInteracted()`。

右键菜单（FloatingPanel 重写 `rightMouseDown` + `NSMenu.popUpContextMenu`）：置顶开关（level .floating⇄.normal）、透明度（0.5/0.65/0.8/1.0 只作用磨砂层 alpha）、点击穿透开关（`ignoresMouseEvents`，解锁入口移到菜单栏浮层 footer）、紧凑/卡片、退出（`NSApp.terminate`）。

- [ ] **Step 4: 接线 + 手动验收**

`UsageBarApp` 加 `let widget = WidgetController(state: state)`，启动时 `if UserDefaults.widgetVisible { widget.show() }`；PopoverRootView 的"显示浮窗"`Toggle(isOn:)` 绑定：开 → `widget.show()` 并写偏好，关 → `widget.hide()`。

Run: `cd mac-os-only-fans/UsageBar && ./scripts/dev-mac.sh run`
手动验收：浮窗出现可拖动、换 Space 仍可见；箭头切换平台；12s 自动轮播；2s 无操作收缩为球，点球展开；右键各项生效；curl 推数据后卡片实时更新（复用 Task 7 的 curl）。

- [ ] **Step 5: Commit**

```bash
git add mac-os-only-fans/UsageBar
git commit -m "feat(usagebar): floating widget panel with card carousel + orb mode"
```

---

### Task 9: 设置页（配对令牌 + 登录项 + 浮窗偏好）

**Files:**
- Create: `mac-os-only-fans/UsageBar/UsageBar/Sources/Settings/SettingsView.swift`
- Modify: `mac-os-only-fans/UsageBar/UsageBar/Sources/Popover/PopoverRootView.swift`（"设置…"按钮接线）
- Modify: `mac-os-only-fans/UsageBar/UsageBar/Sources/UsageBarApp.swift`（加 `Settings` scene）

**Interfaces:**
- Consumes: `BridgeToken.loadOrCreate()`（Task 7）、`WidgetController`（Task 8）
- Produces: `SettingsView(state:widget:)`；`SMAppService` 登录项开关（macOS 14 API `SMAppService.mainApp`）

- [ ] **Step 1: SettingsView**

三个分区（`Form`）：
1. **桥配对**：显示令牌（`BridgeToken.loadOrCreate()`，只读 + `复制`按钮）+ 端口（只读 17389）+ 说明文字"粘贴到扩展选项页 UsageBar 桥配对"；`重新生成`按钮（写新 UUID → 重建 BridgeServer：stop→init→start）
2. **通用**：`SMAppService.mainApp` 登录项 Toggle（`register()/unregister()`，状态读 `status`）
3. **浮窗**：置顶、透明度 slider（0.5–1.0）、点击穿透开关——全部写 UserDefaults 并通知 WidgetController 即时生效

- [ ] **Step 2: 接线**

`UsageBarApp` body 加：

```swift
Settings {
  SettingsView(state: state, widget: widget)
}
```

PopoverRootView "设置…"按钮：`NSApp.sendAction(Selector(("showSettingsWindow:")), to: nil, from: nil)`（macOS 14 可用 `openSettings` 环境动作则优先：`@Environment(\.openSettings)`）。

- [ ] **Step 3: 构建验收**

Run: `cd mac-os-only-fans/UsageBar && ./scripts/dev-mac.sh run`
手动验收：设置窗口三区展示/操作正常；复制令牌 → 扩展 options 粘贴 → 扩展推送真实数据到 app（端到端配对成功）；登录项开关后 `log show --predicate 'process=="launchd"' --last 1m | grep UsageBar` 或系统设置→登录项中可见。

- [ ] **Step 4: Commit**

```bash
git add mac-os-only-fans/UsageBar
git commit -m "feat(usagebar): settings pane (bridge pairing, login item, widget prefs)"
```

---

### Task 10: ChromeCookieReader + NativeCookieProvider（原生兑底）

**Files:**
- Create: `mac-os-only-fans/UsageBar/Packages/UsageCore/Sources/UsageCore/Support/ChromeCookieReader.swift`
- Create: `mac-os-only-fans/UsageBar/Packages/UsageCore/Sources/UsageCore/Support/KeychainHelper.swift`
- Create: `mac-os-only-fans/UsageBar/Packages/UsageCore/Sources/UsageCore/Providers/NativeCookieProvider.swift`
- Test: `mac-os-only-fans/UsageBar/Packages/UsageCore/Tests/UsageCoreTests/ChromeCookieReaderTests.swift`
- Test: `mac-os-only-fans/UsageBar/Packages/UsageCore/Tests/UsageCoreTests/NativeCookieProviderTests.swift`

**Interfaces:**
- Consumes: `UsageProvider`（Task 5）、四个 Parser（Task 3）
- Produces:
  - `enum ChromeCookieReader { static func cookies(forDomains domains: [String]) throws -> [String: String] }`（返回 name→value，含 CHIPS 分区条目）
  - `final class NativeCookieProvider: UsageProvider`：`init(cookieReader: ..., http: ...)`，按 MiniMax→MiMo→Volc 顺序尽力取数；Kimi 恒 `needsLogin("需打开浏览器（token 存于页面 localStorage）")`

**实现模板（必读）**：`mac-os-only-fans/references/claude-desktop-usage/claude_usage.py` 的 123-186 行——Keychain `Chrome Safe Storage`（`security find-generic-password -s ... -w` 经 `Process`）→ PBKDF2-HMAC-SHA1(salt=`saltysalt`, iter=1003, len=16)（CommonCrypto `CCKeyDerivationPBKDF`）→ Cookies SQLite **先拷 tmp 再读**（`sqlite3` C API 或 `Process` 调系统 sqlite3，选 C API：`SQLite3` 系统库直接可用）→ `v10` 前缀 AES-128-CBC（IV=16 空格，`CCCrypt`）→ Chromium ≥130 跳过前 32 字节 host-binding 前缀。

- [ ] **Step 1: 写失败测试（自洽测试向量，不依赖真实 Keychain）**

```swift
import Testing
import Foundation
@testable import UsageCore

@Suite("ChromeCookieReader 解密链")
struct ChromeCookieReaderTests {
  @Test func pbkdf2与AES解密往返() throws {
    // 已知向量：password="test-password" 派生 key，加密 "session-value" 后按 v10 格式解回
    let key = ChromeCookieReader.deriveKey(password: "test-password")
    #expect(key.count == 16)
    let plaintext = Data("session-value".utf8)
    let encrypted = try ChromeCookieReader.testEncrypt(plaintext, key: key) // 测试专用辅助
    let decrypted = try ChromeCookieReader.decryptV10(encrypted, key: key)
    #expect(decrypted == plaintext)
  }
}
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd mac-os-only-fans/UsageBar/Packages/UsageCore && swift test`
Expected: 编译错误

- [ ] **Step 3: 实现 ChromeCookieReader + KeychainHelper + NativeCookieProvider**

NativeCookieProvider.fetchSnapshot 流程：
- MiniMax：`cookies(forDomains: [".minimaxi.com"])` → Cookie 头 GET `https://www.minimaxi.com/backend/account/token_plan/remains_percent`（`HTTPClient`，ephemeral，10s 超时）→ `MiniMaxParser.windows`
- MiMo：同上取 `.xiaomimimo.com` → 并行 `tokenPlan/usage`+`detail` → `MimoParser.windows`；401 → `needsLogin("会话已过期，请打开浏览器控制台")`
- Volc：取 `.volcengine.com`（含分区 digest）→ 无 `csrfToken` 时合成 32hex 并同时注入 Cookie 与 `x-csrf-token`（双提交，与扩展 `lib/usage/providers.ts` 的 fetchVolc 完全同构）→ POST 两个 ark 接口 → `VolcParser.windows`；NotLogin → needsLogin
- Kimi：直接 `needsLogin("需打开浏览器（token 存于页面 localStorage）")`
- 单平台失败不影响其他平台；任何 cookie 读取异常 → 该平台 needsLogin

- [ ] **Step 4: 把 fallback 接入 AppState 并验收**

`AppState.init` 中 `RefreshEngine(..., fallback: NativeCookieProvider())`。
验收：临时把扩展桥配对令牌改错（桥离线）→ 等 30s tick → MiniMax 卡仍更新（原生通道），Kimi 显示"需打开浏览器"。

- [ ] **Step 5: 跑测试 + Commit**

Run: `cd mac-os-only-fans/UsageBar/Packages/UsageCore && swift test`
Expected: 全绿

```bash
git add mac-os-only-fans/UsageBar/Packages/UsageCore mac-os-only-fans/UsageBar/UsageBar
git commit -m "feat(usagebar-core): chrome cookie reader + native fallback provider"
```

---

### Task 11: release 脚本 + README + 整体验收

**Files:**
- Create: `mac-os-only-fans/UsageBar/scripts/release-mac.sh`
- Create: `mac-os-only-fans/UsageBar/README.md`
- Modify: `mac-os-only-fans/UsageBar/project.yml`（Release 用正式 bundle id `app.usagebar.mac`）

- [ ] **Step 1: release-mac.sh（`chmod +x`）**

```bash
#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
VERSION="${1:-0.1.0}"
xcodegen generate
xcodebuild -scheme UsageBar -configuration Release -derivedDataPath .build \
  MARKETING_VERSION="$VERSION" clean build
APP=.build/Build/Products/Release/UsageBar.app
# v1 不签名：ad-hoc
codesign --force --deep --sign - "$APP" 2>/dev/null || true
ditto -c -k --sequesterRsrc --keepParent "$APP" ".build/UsageBar-$VERSION.zip"
echo "zip: .build/UsageBar-$VERSION.zip"
echo "安装后执行: xattr -dr com.apple.quarantine /Applications/UsageBar.app"
# 签名/公证 hook：DEVELOPER_ID 存在时走 codesign+notarytool（v1 不实现）
```

- [ ] **Step 2: README.md**

内容：截图占位、功能三表面、安装（zip 解压拖 /Applications + xattr 命令）、配对步骤（app 设置页复制令牌 → 扩展 options 粘贴）、刷新机制（60s/重置窗口 30s/桥离线兑底）、卸载、隐私（数据只走 127.0.0.1，不外传）、开发（`./scripts/dev-mac.sh`、`swift test`）。

- [ ] **Step 3: 整体验收清单（逐项打勾）**

1. `./scripts/dev-mac.sh run` 启动，菜单栏显示最高用量平台
2. 扩展 options 粘贴令牌后 ≤90s 内 app 三表面（菜单栏/浮层/浮窗）出现真实四平台数据且与扩展 popup 一致
3. 浮窗拖动/轮播/收缩球/右键菜单全部可用
4. 退出 Chrome → ≤10min 后卡片转 stale 标"桥离线"；原生兑底通道仍刷新 MiniMax
5. 重开 Chrome → 桥恢复，卡片回 ok
6. `swift test`（UsageCore）与 `pnpm vitest run`（扩展）全绿
7. `./scripts/release-mac.sh 0.1.0` 出 zip

- [ ] **Step 4: Commit**

```bash
git add mac-os-only-fans/UsageBar
git commit -m "feat(usagebar): release script + readme + acceptance checklist"
```

---

## Self-Review 记录（2026-07-21）

- **Spec 覆盖**：三表面（T7/T8）、桥（T4/T6/T9）、兑底（T3/T10）、状态机（T5）、刷新节奏（T5/T6）、设置/登录项（T9）、分发与验收（T11）——全覆盖；spec 的 20s 加速因 chrome.alarms 下限修正为 30s（T6 已注明）。
- **占位符扫描**：T3 minimax fixture 字段名标注了"以 `lib/usage/parsers.ts` 实际为准"（真实源码在库，执行时读取）；T4 连接读取循环为骨架+要点注释（NWListener 标准模式，实现者可完成）——两处均为有意引用真实源码而非占位。
- **类型一致性**：`PlatformUsage/UsageWindow/CardStatus/UsageStore/RefreshEngine/BridgeServer/UsageProvider` 签名在 T2–T10 间一致；`mimoHealConfig` 不在本计划范围；`Formatting.pct/resetText` 与 UsageView 语义一致。
