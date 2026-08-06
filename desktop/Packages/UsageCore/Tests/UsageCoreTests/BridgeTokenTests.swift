import Testing
import Foundation
@testable import UsageCore

@Suite("BridgeToken")
struct BridgeTokenTests {
  private func freshDefaults() -> UserDefaults {
    // 独立 suite，避免污染 standard / 宿主机 UserDefaults
    UserDefaults(suiteName: "BridgeTokenTests.\(UUID().uuidString)")!
  }

  @Test func 首次生成UUID并复用() {
    let defaults = freshDefaults()
    let token = BridgeToken.loadOrCreate(defaults: defaults)
    #expect(UUID(uuidString: token) != nil)
    #expect(BridgeToken.loadOrCreate(defaults: defaults) == token)
    #expect(defaults.string(forKey: BridgeToken.defaultsKey) == token)
  }

  @Test func 已有值原样返回() {
    let defaults = freshDefaults()
    defaults.set("preset-token", forKey: BridgeToken.defaultsKey)
    #expect(BridgeToken.loadOrCreate(defaults: defaults) == "preset-token")
  }

  @Test func 重新生成写入新UUID() {
    let defaults = freshDefaults()
    let old = BridgeToken.loadOrCreate(defaults: defaults)
    let new = BridgeToken.regenerate(defaults: defaults)
    #expect(UUID(uuidString: new) != nil)
    #expect(new != old)
    #expect(BridgeToken.loadOrCreate(defaults: defaults) == new)
  }
}
