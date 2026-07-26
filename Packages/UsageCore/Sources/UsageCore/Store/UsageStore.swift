import Foundation
import Combine

public enum SnapshotSource: Sendable {
  case bridge, nativeFallback
}

/// 单一数据面：聚合各平台用量卡 + 桥在线状态，供 UI（ObservableObject）订阅。
/// 选 ObservableObject/@Published 而非 @Observable：App 层以 @StateObject/@ObservedObject 消费，macOS 14 兼容最稳。
@MainActor
public final class UsageStore: ObservableObject {
  /// 距上次桥推送超过该间隔 → ok 卡转 stale、桥判离线
  public static let staleThreshold: TimeInterval = 600

  @Published public private(set) var cards: [PlatformID: PlatformUsage] = [:]
  /// 菜单栏/浮窗共同订阅的当前展示平台：apply 时自动重选（5h 最高），浮窗箭头可手动覆盖
  @Published public private(set) var selectedPlatform: PlatformID = .kimi
  @Published public private(set) var bridgeOnline: Bool = false
  /// 上次桥推送时间：取快照内最新 fetchedAt（数据时间≈推送墙钟；陈旧数据视同桥离线以触发兜底）
  private var lastBridgePushAt: Date?

  public init() {}

  /// 手动选择（浮窗箭头）；下次 apply 自动重选会覆盖回来
  public func selectManually(_ id: PlatformID) {
    selectedPlatform = id
  }

  /// 是否有可展示的卡（ok/stale 且带窗口）：冷启动无可用卡时引擎应立即拉兜底而非等宽限
  public var hasUsableCard: Bool {
    cards.values.contains { ($0.status == .ok || $0.status == .stale) && !$0.windows.isEmpty }
  }

  /// 自动重选：第一窗口（各平台最细粒度）已用最高的 ok/stale 平台；无候选保持现值
  public func reselectPrimary() {
    if let id = Self.selectPrimary(cards) { selectedPlatform = id }
  }

  /// 纯函数：候选 = ok/stale 且 windows 非空；键 = windows[0].percent；并列取 PlatformID.allCases 先者
  public static func selectPrimary(_ cards: [PlatformID: PlatformUsage]) -> PlatformID? {
    var best: PlatformID?
    var bestPct = -1.0
    for id in PlatformID.allCases {
      guard let card = cards[id], card.status == .ok || card.status == .stale,
            let first = card.windows.first else { continue }
      if first.percent > bestPct { bestPct = first.percent; best = id }
    }
    return best
  }

  /// bridge 来源快照覆盖同平台旧卡；bridgeOnline 仅 .bridge 来源时置 true 并记录时间。
  public func apply(snapshot: [PlatformID: PlatformUsage], from source: SnapshotSource) {
    for (id, card) in snapshot {
      cards[id] = card
    }
    if source == .bridge {
      lastBridgePushAt = snapshot.values.map(\.fetchedAt).max() ?? Date()
      bridgeOnline = true
    }
    reselectPrimary()
  }

  /// 任一 ok 卡 now - fetchedAt > 阈值 → stale（needsLogin/unavailable/loading 不覆盖）；
  /// bridgeOnline = 距上次桥推送 ≤ 阈值。
  public func evaluateStaleness(now: Date) {
    let staleIDs = cards.filter {
      $0.value.status == .ok && now.timeIntervalSince($0.value.fetchedAt) > Self.staleThreshold
    }.map(\.key)
    for id in staleIDs {
      cards[id]?.status = .stale
    }
    bridgeOnline = lastBridgePushAt.map { now.timeIntervalSince($0) <= Self.staleThreshold } ?? false
  }
}
