import SwiftUI
import UsageCore

/// 四平台固定品牌主色：新粗野主题的平台撞色块面（04 稿 --kimi/--mimo/--minimax/--volc）
/// 与瑞士主题的 8px 色块/2px 色条（03 稿同名变量）同源取色。
public enum PlatformPalette {
  /// 平台主色（#5b6ee0 / #f07e1d / #189a74 / #d94f3d）
  public static func progressColor(for platform: PlatformID) -> Color {
    switch platform {
    case .kimi:
      Color(red: 0x5b / 255, green: 0x6e / 255, blue: 0xe0 / 255)
    case .mimo: // 小米品牌橙
      Color(red: 0xf0 / 255, green: 0x7e / 255, blue: 0x1d / 255)
    case .minimax:
      Color(red: 0x18 / 255, green: 0x9a / 255, blue: 0x74 / 255)
    case .volcengine: // 火山红
      Color(red: 0xd9 / 255, green: 0x4f / 255, blue: 0x3d / 255)
    }
  }
}
