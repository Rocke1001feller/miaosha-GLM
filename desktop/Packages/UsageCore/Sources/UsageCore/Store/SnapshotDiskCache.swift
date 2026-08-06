import Foundation

/// 用量快照磁盘缓存：JSON 落 ~/Library/Application Support/CodingPlanAssistant/snapshot.json，
/// tmp→moveItem 两阶段替换（tmp 完整落盘后再改名，避免半截文件）。
public final class SnapshotDiskCache: Sendable {
  private let fileURL: URL

  public init() {
    let dir = FileManager.default
      .urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
      .appendingPathComponent("CodingPlanAssistant", isDirectory: true)
    self.fileURL = dir.appendingPathComponent("snapshot.json")
  }

  /// 测试用：自定义落盘位置。
  init(fileURL: URL) {
    self.fileURL = fileURL
  }

  /// 写失败静默：仅影响下次冷启动体验。
  public func save(_ cards: [PlatformID: PlatformUsage]) {
    let fm = FileManager.default
    let dir = fileURL.deletingLastPathComponent()
    let tmp = dir.appendingPathComponent(".\(UUID().uuidString).tmp")
    do {
      let encoder = JSONEncoder()
      encoder.dateEncodingStrategy = .millisecondsSince1970
      let data = try encoder.encode(cards)
      try fm.createDirectory(at: dir, withIntermediateDirectories: true)
      try data.write(to: tmp, options: .withoutOverwriting)
      defer { try? fm.removeItem(at: tmp) } // 成功时 tmp 已被 move 走，remove 静默失败
      if fm.fileExists(atPath: fileURL.path) {
        try fm.removeItem(at: fileURL) // moveItem 不覆盖已存在目标，先删再改名
      }
      try fm.moveItem(at: tmp, to: fileURL)
    } catch {
      try? fm.removeItem(at: tmp)
    }
  }

  /// 文件缺失或损坏返回 nil。
  public func load() -> [PlatformID: PlatformUsage]? {
    guard let data = FileManager.default.contents(atPath: fileURL.path) else { return nil }
    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .millisecondsSince1970
    return try? decoder.decode([PlatformID: PlatformUsage].self, from: data)
  }
}
