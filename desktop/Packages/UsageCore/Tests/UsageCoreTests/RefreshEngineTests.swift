import Testing
import Foundation
@testable import UsageCore

struct FakeProvider: UsageProvider {
  let id = "fake"
  let snapshot: [PlatformID: PlatformUsage]
  func fetchSnapshot() async -> [PlatformID: PlatformUsage] { snapshot }
}

/// 计数 provider：统计 fetchSnapshot 实际被调次数（宽限测试断言拉取时机用）。
final class CountingProvider: UsageProvider, @unchecked Sendable {
  let id = "counting"
  private let lock = NSLock()
  private var _calls = 0
  var calls: Int { lock.lock(); defer { lock.unlock() }; return _calls }
  private let snapshot: [PlatformID: PlatformUsage]
  init(snapshot: [PlatformID: PlatformUsage]) { self.snapshot = snapshot }
  func fetchSnapshot() async -> [PlatformID: PlatformUsage] {
    lock.lock(); _calls += 1; lock.unlock()
    return snapshot
  }
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

  @MainActor @Test func 桥推送入库后落盘缓存() async throws {
    let store = UsageStore()
    let bridge = BridgeServer(port: 0, token: "T")
    let tmp = FileManager.default.temporaryDirectory
      .appendingPathComponent(UUID().uuidString, isDirectory: true)
      .appendingPathComponent("snapshot.json")
    let cache = SnapshotDiskCache(fileURL: tmp)
    let engine = RefreshEngine(store: store, bridge: bridge, fallback: nil, diskCache: cache)
    _ = engine // 保活至测试结束
    // 直接触发引擎已接管的 onSnapshot 槽，模拟桥推送（省去真实 HTTP 往返）
    bridge.onSnapshot?([.kimi: PlatformUsage(
      platform: .kimi, displayName: "Kimi Code", status: .ok, fetchedAt: Date())])
    // onSnapshot 经 Task 跳 MainActor，轮询等待落盘（最多 2s）
    var loaded: [PlatformID: PlatformUsage]?
    for _ in 0 ..< 20 {
      try await Task.sleep(for: .milliseconds(100))
      if let hit = cache.load() { loaded = hit; break }
    }
    #expect(loaded?[.kimi]?.displayName == "Kimi Code")
    #expect(store.cards[.kimi]?.status == .ok)
  }

  private static let miniSnapshot: [PlatformID: PlatformUsage] = [.minimax: PlatformUsage(
    platform: .minimax, displayName: "MiniMax", status: .ok,
    windows: [UsageWindow(label: "5h 限额", percent: 0.2)], fetchedAt: Date())]

  @MainActor @Test func start后宽限期内tick不拉fallback() async {
    let store = UsageStore()
    // 预置可用卡（nativeFallback 来源不置 bridgeOnline）：隔离冷启动立即拉，专注测宽限门控
    store.apply(snapshot: [.kimi: PlatformUsage(
      platform: .kimi, displayName: "Kimi Code", status: .ok,
      windows: [UsageWindow(label: "5h 限额", percent: 0.5)], fetchedAt: Date())], from: .nativeFallback)
    let bridge = BridgeServer(port: 0, token: "T")
    let counting = CountingProvider(snapshot: Self.miniSnapshot)
    // 默认宽限 90s：start 后即刻 tick 仍在宽限内
    let engine = RefreshEngine(store: store, bridge: bridge, fallback: counting)
    engine.start()
    defer { engine.stop() }
    await engine.poke()
    #expect(counting.calls == 0)
    #expect(store.cards[.minimax] == nil)
  }

  @MainActor @Test func 冷启动无可用卡时start立即拉fallback() async throws {
    let store = UsageStore()
    // 仅有一张 unavailable 错误卡（如上次桥推送的 "Failed to fetch"）→ 视为无可用卡
    store.apply(snapshot: [.kimi: PlatformUsage(
      platform: .kimi, displayName: "Kimi Code", status: .unavailable,
      windows: [UsageWindow(label: "5h 限额", percent: 0.9)], fetchedAt: Date())], from: .bridge)
    let bridge = BridgeServer(port: 0, token: "T")
    let counting = CountingProvider(snapshot: Self.miniSnapshot)
    // 注入超长宽限：若非冷启动立即拉，宽限内绝不该出现 fallback 数据
    let engine = RefreshEngine(store: store, bridge: bridge, fallback: counting,
                               fallbackGracePeriod: 999)
    engine.start()
    defer { engine.stop() }
    // 立即拉取是异步 Task：轮询最多 1s（远在 999s 宽限之内）
    for _ in 0 ..< 10 {
      if store.cards[.minimax] != nil { break }
      try await Task.sleep(for: .milliseconds(100))
    }
    #expect(counting.calls == 1)
    #expect(store.cards[.minimax]?.status == .ok)
  }

  @MainActor @Test func 冷启动有可用卡时start仍守宽限() async throws {
    let store = UsageStore()
    // 已有 ok 卡带窗口 → 冷启动宽限照常生效（等桥推送，不白触发 Keychain）
    store.apply(snapshot: [.kimi: PlatformUsage(
      platform: .kimi, displayName: "Kimi Code", status: .ok,
      windows: [UsageWindow(label: "5h 限额", percent: 0.5)], fetchedAt: Date())], from: .bridge)
    let bridge = BridgeServer(port: 0, token: "T")
    let counting = CountingProvider(snapshot: Self.miniSnapshot)
    let engine = RefreshEngine(store: store, bridge: bridge, fallback: counting,
                               fallbackGracePeriod: 999)
    engine.start()
    defer { engine.stop() }
    try await Task.sleep(for: .milliseconds(300)) // 宽限内：不该拉 fallback
    #expect(counting.calls == 0)
    #expect(store.cards[.minimax] == nil)
  }

  @MainActor @Test func 宽限过后桥仍离线才拉fallback() async throws {
    let store = UsageStore()
    // 预置可用卡（nativeFallback 来源不置 bridgeOnline）：隔离冷启动立即拉，专注测宽限门控
    store.apply(snapshot: [.kimi: PlatformUsage(
      platform: .kimi, displayName: "Kimi Code", status: .ok,
      windows: [UsageWindow(label: "5h 限额", percent: 0.5)], fetchedAt: Date())], from: .nativeFallback)
    let bridge = BridgeServer(port: 0, token: "T")
    let counting = CountingProvider(snapshot: Self.miniSnapshot)
    let engine = RefreshEngine(store: store, bridge: bridge, fallback: counting,
                               fallbackGracePeriod: 0.05)
    engine.start()
    defer { engine.stop() }
    try await Task.sleep(for: .milliseconds(120)) // 越过宽限
    await engine.poke()
    #expect(counting.calls == 1)
    #expect(store.cards[.minimax]?.status == .ok)
  }
}
