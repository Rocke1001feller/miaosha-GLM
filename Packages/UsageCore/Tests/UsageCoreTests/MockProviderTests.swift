import Testing
import Foundation
@testable import UsageCore

/// MockProvider 契约：返回值与共享夹具 docs/bridge-fixtures/snapshot-v1.json 一致
/// （状态映射预期复用 BridgeContractTests），且内嵌夹具与磁盘夹具逐字节不漂移。
@Suite("MockProvider")
struct MockProviderTests {
  /// 与 BridgeContractTests 相同：本文件上溯五级为仓库根。
  private static func fixtureData() throws -> Data {
    let repoRoot = URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent() // UsageCoreTests
      .deletingLastPathComponent() // Tests
      .deletingLastPathComponent() // UsageCore
      .deletingLastPathComponent() // Packages
      .deletingLastPathComponent() // repo root
    return try Data(contentsOf: repoRoot.appendingPathComponent("docs/bridge-fixtures/snapshot-v1.json"))
  }

  @Test func mock快照返回夹具四平台与状态() async throws {
    let cards = await MockProvider().fetchSnapshot()
    #expect(cards.count == 4)

    // 状态与 BridgeContractTests 的夹具预期一致
    let kimi = try #require(cards[.kimi])
    #expect(kimi.status == .ok)
    #expect(kimi.displayName == "Kimi Code")
    #expect(kimi.windows.count == 2)
    #expect(kimi.windows[0].percent == 0.263)

    let mimo = try #require(cards[.mimo])
    #expect(mimo.status == .ok)
    #expect(mimo.planName == "Pro")

    let minimax = try #require(cards[.minimax])
    #expect(minimax.status == .needsLogin)
    #expect(minimax.windows.isEmpty)

    let volc = try #require(cards[.volcengine])
    #expect(volc.status == .unavailable)
    #expect(volc.errorMessage == "NotLogin")
  }

  @Test func fetchedAt每次拉取重打为当前时刻() async {
    // 防 stale：重打后 ok 卡不会因夹具内定值时间戳被 evaluateStaleness 转 stale
    let before = Date()
    let cards = await MockProvider().fetchSnapshot()
    let after = Date()
    for (_, card) in cards {
      #expect(card.fetchedAt >= before && card.fetchedAt <= after)
    }
  }

  @Test func 内嵌夹具与共享夹具文件逐字节一致() throws {
    // 防漂移：改 docs/bridge-fixtures/snapshot-v1.json 后须重新生成 MockFixture.swift
    #expect(Data(MockFixture.snapshotV1JSON.utf8) == (try Self.fixtureData()))
  }
}
