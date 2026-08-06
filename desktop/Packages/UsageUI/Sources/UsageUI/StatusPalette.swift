import SwiftUI

public enum StatusPalette {
  /// 用量档位（internal 以便单测；Color 不可比，档位可比）
  enum Tier: Equatable {
    case normal, warning, critical
  }

  /// 已用 <50% 绿 / 50–90% 黄 / ≥90% 红
  static func tier(forUsedPercent p: Double) -> Tier {
    if p >= 0.9 { return .critical }
    if p >= 0.5 { return .warning }
    return .normal
  }

  public static func color(forUsedPercent p: Double) -> Color {
    switch tier(forUsedPercent: p) {
    case .critical: return .red
    case .warning: return .orange
    case .normal: return .green
    }
  }
}
