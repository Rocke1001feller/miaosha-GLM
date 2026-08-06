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
    #expect(kimi.consoleUrl == "https://www.kimi.com/code/console")
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
