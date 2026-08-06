import Foundation

/// 原生兜底用量提供方（桥离线时由 RefreshEngine 拉取）。
/// 失败以返回空字典表达，引擎静默保留现有卡。
public protocol UsageProvider: Sendable {
  var id: String { get }
  func fetchSnapshot() async -> [PlatformID: PlatformUsage]
}
