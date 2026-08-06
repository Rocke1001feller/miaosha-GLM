import Testing
import Foundation
@testable import UsageCore

@Suite("UsageStore")
struct UsageStoreTests {
  private func card(_ id: PlatformID, _ pct: Double, status: CardStatus = .ok, fetchedAt: Date) -> PlatformUsage {
    PlatformUsage(platform: id, displayName: id.rawValue, status: status,
                  windows: [UsageWindow(label: "5h", percent: pct)], fetchedAt: fetchedAt)
  }

  private func twoWindowCard(_ id: PlatformID, first: Double, second: Double,
                             status: CardStatus = .ok, fetchedAt: Date) -> PlatformUsage {
    PlatformUsage(platform: id, displayName: id.rawValue, status: status,
                  windows: [UsageWindow(label: "5h", percent: first),
                            UsageWindow(label: "周", percent: second)], fetchedAt: fetchedAt)
  }

  @MainActor @Test func apply合并与自动选择() {
    let store = UsageStore()
    let now = Date()
    store.apply(snapshot: [.kimi: card(.kimi, 0.82, fetchedAt: now),
                           .mimo: card(.mimo, 0.17, fetchedAt: now)], from: .bridge)
    #expect(store.cards.count == 2)
    #expect(store.selectedPlatform == .kimi)
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
}
