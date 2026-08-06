import Testing
import Foundation
@testable import UsageCore

/// 桥协议契约测试：消费共享夹具 docs/bridge-fixtures/snapshot-v1.json，
/// 验证 BridgeSnapshot.decode 的行为与 docs/BRIDGE-PROTOCOL.md 一致。
@Suite("BridgeContract")
struct BridgeContractTests {
  /// 夹具路径：本文件位于 Packages/UsageCore/Tests/UsageCoreTests/，上溯四级为仓库根。
  private static func fixtureData() throws -> Data {
    let repoRoot = URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent() // UsageCoreTests
      .deletingLastPathComponent() // Tests
      .deletingLastPathComponent() // UsageCore
      .deletingLastPathComponent() // Packages
      .deletingLastPathComponent() // repo root
    let url = repoRoot.appendingPathComponent("docs/bridge-fixtures/snapshot-v1.json")
    return try Data(contentsOf: url)
  }

  @Test func 共享夹具解码_四平台与文档映射一致() throws {
    let cards = try BridgeSnapshot.decode(Self.fixtureData())
    #expect(cards.count == 4)

    // kimi：ok，两条 bar（5h 带 resetAt，本周用量不带）
    let kimi = try #require(cards[.kimi])
    #expect(kimi.status == .ok)
    #expect(kimi.displayName == "Kimi Code")
    #expect(kimi.windows.count == 2)
    #expect(kimi.windows[0].label == "频限明细（5h）")
    #expect(kimi.windows[0].percent == 0.263)
    #expect(kimi.windows[0].resetAt == Date(timeIntervalSince1970: 1_785_076_200))
    #expect(kimi.windows[1].percent == 0.318)
    #expect(kimi.windows[1].resetAt == nil)

    // mimo：ok，planName / usedText / note 全部保留
    let mimo = try #require(cards[.mimo])
    #expect(mimo.status == .ok)
    #expect(mimo.planName == "Pro")
    #expect(mimo.windows[0].usedText == "8,162,846,607 / 49,200,000,000")
    #expect(mimo.windows[0].percent == 0.17)
    #expect(mimo.windows[1].percent == 0.166)
    #expect(mimo.note == "数据来自 MiMo 控制台套餐页")

    // minimax：needs_login → .needsLogin，空 bars，errorMessage 保留
    let minimax = try #require(cards[.minimax])
    #expect(minimax.status == .needsLogin)
    #expect(minimax.windows.isEmpty)
    #expect(minimax.errorMessage?.contains("自动登录失败") == true)
    #expect(minimax.consoleUrl == "https://platform.minimaxi.com/console/usage")

    // volcengine：error → .unavailable（协议文档的归并规则）
    let volc = try #require(cards[.volcengine])
    #expect(volc.status == .unavailable)
    #expect(volc.errorMessage == "NotLogin")

    // fetchedAt：毫秒 epoch 正确解析为 Date
    #expect(kimi.fetchedAt == Date(timeIntervalSince1970: 1_785_067_200))
  }

  @Test func 未知status字符串按协议兜底为unavailable() throws {
    // 协议演进规则：消费者遇到未知 status 一律按 unavailable 处理，不抛错
    let json = """
    { "kimi": {"platform":"kimi","displayName":"Kimi Code","consoleUrl":"https://www.kimi.com/code/console",
        "status":"some_future_status","bars":[],"fetchedAt":1785067200000} }
    """.data(using: .utf8)!
    let cards = try BridgeSnapshot.decode(json)
    #expect(cards[.kimi]?.status == .unavailable)
  }
}
