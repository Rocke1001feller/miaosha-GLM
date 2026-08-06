import Foundation

/// 独立开发 mock provider：返回内嵌夹具快照（snapshot-v1.json 的编译期副本），
/// 不读网络、不读 Chrome 凭证。仅由 App 层在 CODINGPLANASSISTANT_MOCK=1 时作为引擎 fallback 装配。
/// fetchedAt 每次拉取重打为当前时刻——夹具内的时间戳是定值，
/// 不重打的话拉取后 10 分钟（staleThreshold）ok 卡即转 stale，独立开发时无法常看 ok 态。
public final class MockProvider: UsageProvider {
  public let id = "mock-fixture"

  public init() {}

  public func fetchSnapshot() async -> [PlatformID: PlatformUsage] {
    guard var cards = try? BridgeSnapshot.decode(MockFixture.snapshotV1Data) else { return [:] }
    let now = Date()
    for id in cards.keys { cards[id]?.fetchedAt = now }
    return cards
  }
}
