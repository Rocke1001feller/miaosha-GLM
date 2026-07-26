import SwiftUI

/// 4pt 高胶囊进度条：轨道 `Color.primary.opacity(0.12)` + 前景 tint，按 percent 截断（leading 对齐）。
public struct UsageMeterView: View {
  public let percent: Double // 0...1 已用
  public let tint: Color

  public init(percent: Double, tint: Color) {
    self.percent = percent
    self.tint = tint
  }

  public var body: some View {
    Capsule()
      .fill(Color.primary.opacity(0.12))
      .frame(height: 4)
      .overlay(alignment: .leading) {
        GeometryReader { geo in
          Capsule()
            .fill(tint)
            .frame(width: geo.size.width * min(max(percent, 0), 1))
        }
      }
      .accessibilityLabel(Formatting.pct(percent))
  }
}
