import Testing
import Foundation
@testable import UsageCore

/// 线程安全计数器（缓存测试统计真实读取次数用）。
final class CallCounter: @unchecked Sendable {
  private let lock = NSLock()
  private var _value = 0
  var value: Int { lock.lock(); defer { lock.unlock() }; return _value }
  func increment() { lock.lock(); _value += 1; lock.unlock() }
}

// .serialized：两个用例共享进程级 cache，并行会互相重置 provider（调起真 security 子进程）
@Suite("KeychainHelper 口令缓存", .serialized)
struct KeychainHelperTests {
  @Test func 首读调provider一次_二读命中缓存不再调用() throws {
    KeychainHelper.resetCacheForTesting()
    defer { KeychainHelper.resetCacheForTesting() }
    let counter = CallCounter()
    KeychainHelper.cache.reset {
      counter.increment()
      return "pw-test"
    }
    #expect(try KeychainHelper.chromeSafeStoragePassword() == "pw-test")
    #expect(try KeychainHelper.chromeSafeStoragePassword() == "pw-test")
    #expect(counter.value == 1)
  }

  @Test func 读取失败不缓存_下次重试成功() throws {
    KeychainHelper.resetCacheForTesting()
    defer { KeychainHelper.resetCacheForTesting() }
    let counter = CallCounter()
    KeychainHelper.cache.reset {
      counter.increment()
      if counter.value == 1 { throw KeychainHelper.Failure.emptyPassword }
      return "pw-retry"
    }
    #expect(throws: KeychainHelper.Failure.emptyPassword) {
      try KeychainHelper.chromeSafeStoragePassword()
    }
    #expect(try KeychainHelper.chromeSafeStoragePassword() == "pw-retry")
    #expect(counter.value == 2)
  }
}
