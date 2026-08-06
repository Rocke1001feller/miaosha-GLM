import Testing
import Foundation
@testable import UsageCore

@Suite("SnapshotDiskCache")
struct SnapshotDiskCacheTests {
  private func makeCache() throws -> (SnapshotDiskCache, URL) {
    let dir = FileManager.default.temporaryDirectory
      .appendingPathComponent("CodingPlanAssistantTests-\(UUID().uuidString)", isDirectory: true)
    return (SnapshotDiskCache(fileURL: dir.appendingPathComponent("snapshot.json")), dir)
  }

  @Test func 无文件时load返回nil() throws {
    let (cache, _) = try makeCache()
    #expect(cache.load() == nil)
  }

  @Test func 保存后可读回_覆盖写可替换_毫秒日期往返() throws {
    let (cache, dir) = try makeCache()
    defer { try? FileManager.default.removeItem(at: dir) }
    // 取整秒日期：毫秒 epoch 编码可精确往返（Equatable 断言成立）
    let cards: [PlatformID: PlatformUsage] = [
      .kimi: PlatformUsage(
        platform: .kimi, displayName: "Kimi Code", planName: "Vivace", status: .ok,
        windows: [UsageWindow(label: "5h", percent: 0.5, resetAt: Date(timeIntervalSince1970: 1_784_000_000))],
        fetchedAt: Date(timeIntervalSince1970: 1_783_999_000)),
      .minimax: PlatformUsage(
        platform: .minimax, displayName: "MiniMax", status: .needsLogin,
        errorMessage: "会话已过期", fetchedAt: Date(timeIntervalSince1970: 1_783_999_001)),
    ]
    cache.save(cards)
    #expect(cache.load() == cards)

    // 覆盖写：目标已存在时 tmp→moveItem 替换仍须成功
    let updated: [PlatformID: PlatformUsage] = [
      .mimo: PlatformUsage(platform: .mimo, displayName: "小米 MiMo", status: .stale,
                           fetchedAt: Date(timeIntervalSince1970: 1_783_999_002)),
    ]
    cache.save(updated)
    #expect(cache.load() == updated)
  }

  @Test func 损坏JSON返回nil() throws {
    let (cache, dir) = try makeCache()
    defer { try? FileManager.default.removeItem(at: dir) }
    try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
    try "{broken".data(using: .utf8)!.write(to: dir.appendingPathComponent("snapshot.json"))
    #expect(cache.load() == nil)
  }
}
