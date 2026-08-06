import SwiftUI
import UsageCore
import UsageUI

/// 菜单栏标签：有数据显示"短名 + 最细窗口（5h）已用百分比"，无数据显示仪表盘图标。
struct MenuBarLabel: View {
  let card: PlatformUsage?

  var body: some View {
    if let card, let first = card.windows.first {
      Text("\(shortName(card.platform)) \(Formatting.pct(first.percent))")
        .monospacedDigit()
    } else {
      Image(systemName: "gauge.with.dots.needle.67percent")
    }
  }

  private func shortName(_ id: PlatformID) -> String {
    switch id {
    case .minimax: "MM"; case .kimi: "Kimi"; case .mimo: "MiMo"; case .volcengine: "火山"
    }
  }
}
