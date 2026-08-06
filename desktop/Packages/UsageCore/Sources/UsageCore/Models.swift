import Foundation

public enum PlatformID: String, Codable, CaseIterable, Sendable {
  case minimax, kimi, mimo, volcengine
}

public struct UsageWindow: Codable, Equatable, Sendable {
  public var label: String
  public var percent: Double // 0...1 已用
  public var usedText: String?
  public var resetAt: Date?
  public init(label: String, percent: Double, usedText: String? = nil, resetAt: Date? = nil) {
    self.label = label; self.percent = percent; self.usedText = usedText; self.resetAt = resetAt
  }
}

public enum CardStatus: String, Codable, Sendable {
  case ok, stale, unavailable, needsLogin = "needs_login", loading
}

public struct PlatformUsage: Equatable, Sendable {
  public var platform: PlatformID
  public var displayName: String
  public var planName: String?
  public var status: CardStatus
  public var windows: [UsageWindow]
  public var note: String?
  public var errorMessage: String?
  /// 平台控制台地址：needs_login 卡提供"打开控制台"跳转
  public var consoleUrl: String?
  public var fetchedAt: Date
  public init(platform: PlatformID, displayName: String, planName: String? = nil,
              status: CardStatus, windows: [UsageWindow] = [], note: String? = nil,
              errorMessage: String? = nil, consoleUrl: String? = nil, fetchedAt: Date) {
    self.platform = platform; self.displayName = displayName; self.planName = planName
    self.status = status; self.windows = windows; self.note = note
    self.errorMessage = errorMessage; self.consoleUrl = consoleUrl; self.fetchedAt = fetchedAt
  }
  /// 已用最高的窗口百分比（0...1）
  public var maxUsedPercent: Double { windows.map(\.percent).max() ?? 0 }
}

// 磁盘快照缓存用；合成 Codable（同文件扩展），date 编解码策略由调用方指定（毫秒 epoch）。
extension PlatformUsage: Codable {}
