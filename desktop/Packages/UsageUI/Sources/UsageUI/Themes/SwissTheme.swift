import SwiftUI
import UsageCore

/// 设计稿 03「瑞士国际主义编辑排版 Swiss Editorial」主题资产。
/// 一切像素值以 docs/design-explorations/03-swiss-editorial.html 的 CSS 为准（:root 变量与
/// .cap / .p-card / .fc-* / .orb 规则），不凭感觉取值。纯白场 + 1px 黑规则线 + Helvetica Neue
/// Ultralight 大数字；零渐变、零阴影、零圆角（orb 为全稿唯一正圆）。
public enum SwissTheme {
  /// 全部正文与规则线的黑（--ink #111111）
  public static let ink = Color(red: 0x11 / 255, green: 0x11 / 255, blue: 0x11 / 255)
  /// 纯白场（--paper #ffffff）
  public static let paper = Color.white
  /// 次级文字灰（--dim #666666，对白纸对比度 5.7:1）
  public static let dim = Color(red: 0x66 / 255, green: 0x66 / 255, blue: 0x66 / 255)
  /// 次要行分隔细线（.p-rows .row 的 1px #d9d9d9）
  public static let rowSeparator = Color(red: 0xd9 / 255, green: 0xd9 / 255, blue: 0xd9 / 255)

  /// 平台色（03 稿 --kimi/--mimo/--minimax/--volc，与 PlatformPalette.progressColor 同值）：
  /// 仅以 8px 色块与 2px 色条出现（稿规面积 <2%），不作文字色
  public static func platformColor(_ platform: PlatformID) -> Color {
    PlatformPalette.progressColor(for: platform)
  }

  /// 稿 .cap 大写小标签字体：Helvetica Neue Medium（500）；.cap.b 600 取 Bold 以拉开编辑层级
  static func capsFont(size: CGFloat = 10, bold: Bool = false) -> Font {
    .custom(bold ? "HelveticaNeue-Bold" : "HelveticaNeue-Medium", size: size)
  }

  /// 稿 .cap 字距 letter-spacing .16em（SwiftUI tracking 以点计）
  static func capsTracking(_ size: CGFloat) -> CGFloat { size * 0.16 }

  /// 大数字（稿 100 字重 Helvetica Neue Ultralight；稿 104px@280 卡，实卡含次要行垂直预算
  /// 不足，收敛为 44pt —— 层级靠字重对比维持，仍为卡面最大元素）
  static let bignumFont = Font.custom("HelveticaNeue-UltraLight", size: 44)
  /// 百分号（稿 .pct：.3em / 200 字重 → 13pt Thin）
  static let pctFont = Font.custom("HelveticaNeue-Thin", size: 13)
}

/// 8×8 平台色块（03 稿 .chip/.sq：header 左侧唯一色点，直角无圆角）
public struct SwissChip: View {
  public let platform: PlatformID

  public init(platform: PlatformID) {
    self.platform = platform
  }

  public var body: some View {
    Rectangle()
      .fill(SwissTheme.platformColor(platform))
      .frame(width: 8, height: 8)
  }
}

/// 2px 平台色进度条（03 稿 .p-bar：轨道即纸面不可见，填充纯平台色不渐变；
/// 稿中 0% 仍留 0.5% 细条，避免空槽视觉断裂）
public struct SwissProgressStrip: View {
  public let percent: Double // 0...1 已用
  public let platform: PlatformID

  public init(percent: Double, platform: PlatformID) {
    self.percent = percent
    self.platform = platform
  }

  public var body: some View {
    GeometryReader { geo in
      Rectangle()
        .fill(SwissTheme.platformColor(platform))
        .frame(width: geo.size.width * max(min(max(percent, 0), 1), 0.005), alignment: .leading)
    }
    .frame(height: 2)
    .accessibilityLabel(Formatting.pct(percent))
  }
}

/// 03 稿浮窗卡（表面 2 fc 骨架 + 表面 1 p-card 的次要行语言）：报头 8px 色块 + 全大写小标签 +
/// 直角导航按钮 + 1px 黑规则线；Ultralight 大数字 + dim 副题 + 2px 平台色条；
/// 次要窗口为 #d9d9d9 细线分隔行。卡面 note 按稿 fc 不呈现（浮层 p-note 仍展示）。
public struct SwissCardContent: View {
  public let card: PlatformUsage
  public let onPrev: () -> Void
  public let onNext: () -> Void

  public init(card: PlatformUsage, onPrev: @escaping () -> Void, onNext: @escaping () -> Void) {
    self.card = card
    self.onPrev = onPrev
    self.onNext = onNext
  }

  public var body: some View {
    VStack(alignment: .leading, spacing: 0) {
      header.padding(.bottom, 6)
      hairline
      switch card.status {
      case .ok:
        if let featured = card.windows.first {
          featuredContent(featured, rest: Array(card.windows.dropFirst()))
        } else {
          statusLine("暂无用量数据")
        }
      case .needsLogin:
        statusLine(card.errorMessage ?? "需要登录")
      case .stale:
        statusLine(card.errorMessage ?? "数据已过期")
      case .unavailable:
        statusLine(card.errorMessage ?? "不可用")
      case .loading:
        statusLine("加载中…")
      }
      Spacer(minLength: 0)
    }
    .padding(10) // 稿 fc 内边距 16px，实卡垂直预算收敛为 10（8pt 网格倍数）
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(SwissTheme.paper)
    .foregroundStyle(SwissTheme.ink) // 03 稿：纸面之上一切皆墨
  }

  // MARK: - 子视图

  /// 稿 fc-top / p-top：8px 色块 + 全大写平台名 + dim plan + ‹ › 直角导航
  private var header: some View {
    HStack(spacing: 8) {
      SwissChip(platform: card.platform)
      Text(card.displayName.uppercased())
        .font(SwissTheme.capsFont(bold: true))
        .tracking(SwissTheme.capsTracking(10))
        .lineLimit(1)
      if let plan = card.planName, !plan.isEmpty {
        Text(plan)
          .font(SwissTheme.capsFont(size: 8))
          .tracking(SwissTheme.capsTracking(8))
          .foregroundStyle(SwissTheme.dim)
          .lineLimit(1)
      }
      Spacer(minLength: 4)
      navButton("chevron.left", action: onPrev)
      navButton("chevron.right", action: onNext)
    }
  }

  /// 稿 fc-nav button：直角 1px 黑框（稿 24×24，实卡垂直预算收敛为 18×18）
  private func navButton(_ systemName: String, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      Image(systemName: systemName)
        .font(.system(size: 8))
        .foregroundStyle(SwissTheme.ink)
        .frame(width: 18, height: 18)
        .overlay { Rectangle().strokeBorder(SwissTheme.ink, lineWidth: 1) }
        .contentShape(Rectangle())
    }
    .buttonStyle(.borderless)
  }

  /// 1px 黑规则线（稿 --hairline，报头/次要行区隔的唯一分隔手段）
  private var hairline: some View {
    Rectangle().fill(SwissTheme.ink).frame(height: 1)
  }

  /// 特色窗口：Ultralight 大数字 + dim 副题 + 2px 平台色条 + 细线分隔的次要行
  private func featuredContent(_ w: UsageWindow, rest: [UsageWindow]) -> some View {
    VStack(alignment: .leading, spacing: 0) {
      bignum(w.percent).padding(.top, 6)
      subline(w).padding(.top, 2)
      SwissProgressStrip(percent: w.percent, platform: card.platform).padding(.top, 6)
      if !rest.isEmpty {
        hairline.padding(.top, 6)
        ForEach(Array(rest.enumerated()), id: \.offset) { index, win in
          secondaryRow(win).padding(.vertical, 2)
          if index < rest.count - 1 { rowSeparator }
        }
      }
    }
  }

  /// 稿 p-bignum/fc-num：100 字重大数字 + .3em 200 字重百分号，tabular-nums
  private func bignum(_ percent: Double) -> some View {
    HStack(alignment: .firstTextBaseline, spacing: 2) {
      Text(String(Formatting.pct(percent).dropLast())) // 复用 pct 的 0~100 截断与一位小数
        .font(SwissTheme.bignumFont)
        .tracking(-0.9) // 稿 letter-spacing -.02em
      Text("%")
        .font(SwissTheme.pctFont)
    }
    .monospacedDigit()
  }

  /// 稿 p-sub：窗口标签 · 重置倒计时（dim 大写小标签）
  private func subline(_ w: UsageWindow) -> some View {
    let text = [w.label, w.resetAt.map { Formatting.resetText(resetAt: $0) }]
      .compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
    return Text(text.uppercased())
      .font(SwissTheme.capsFont(size: 9))
      .tracking(SwissTheme.capsTracking(9))
      .foregroundStyle(SwissTheme.dim)
      .lineLimit(1)
  }

  /// 稿 p-rows .row：大写标签居左，等宽数值与 dim 重置居右，行间 #d9d9d9 细线
  private func secondaryRow(_ w: UsageWindow) -> some View {
    HStack(alignment: .firstTextBaseline, spacing: 8) {
      Text(w.label.uppercased())
        .font(SwissTheme.capsFont(size: 9))
        .tracking(SwissTheme.capsTracking(9))
        .lineLimit(1)
      Spacer(minLength: 4)
      Text(Formatting.pct(w.percent))
        .font(SwissTheme.capsFont(size: 10)) // 稿 .v 12px/500，卡面收敛 10pt
        .monospacedDigit()
      if let resetAt = w.resetAt {
        Text(Formatting.resetText(resetAt: resetAt))
          .font(SwissTheme.capsFont(size: 8))
          .tracking(SwissTheme.capsTracking(8))
          .foregroundStyle(SwissTheme.dim)
          .lineLimit(1)
      }
    }
  }

  /// 稿 p-rows 行间分隔（1px #d9d9d9，比报头黑线弱一档）
  private var rowSeparator: some View {
    Rectangle().fill(SwissTheme.rowSeparator).frame(height: 1)
  }

  /// 非 ok 态：dim 大写小标签居中（稿无错误态，沿用彩色版布局改 monochrome）
  private func statusLine(_ text: String) -> some View {
    HStack {
      Spacer()
      Text(text.uppercased())
        .font(SwissTheme.capsFont())
        .tracking(SwissTheme.capsTracking(10))
        .foregroundStyle(SwissTheme.dim)
      Spacer()
    }
    .padding(.vertical, 18)
  }
}

/// 03 稿表面 3 悬浮球 orb（全稿唯一正圆）：白底 + 1px 黑圈 + 7px 大写标签 +
/// 22px Thin 数字（.55em 百分号）+ 24×2 平台色条。
public struct SwissOrbView: View {
  public let label: String
  public let percent: Double?
  public let platform: PlatformID

  public init(label: String, percent: Double?, platform: PlatformID) {
    self.label = label
    self.percent = percent
    self.platform = platform
  }

  public var body: some View {
    VStack(spacing: 0) {
      Text(label.uppercased())
        .font(SwissTheme.capsFont(size: 7, bold: true)) // 稿 .ob-label 7px/600
        .tracking(7 * 0.22) // 稿 letter-spacing .22em
        .lineLimit(1)
        .minimumScaleFactor(0.8)
      HStack(alignment: .firstTextBaseline, spacing: 1) {
        Text(percent.map { String(Formatting.pct($0).dropLast()) } ?? "—")
          .font(.custom("HelveticaNeue-Thin", size: 22)) // 稿 .ob-num 22px/200
          .tracking(-0.2) // 稿 letter-spacing -.01em
        if percent != nil {
          Text("%")
            .font(.custom("HelveticaNeue", size: 12)) // 稿 .pct .55em/400
        }
      }
      .monospacedDigit()
      Rectangle()
        .fill(SwissTheme.platformColor(platform))
        .frame(width: 24, height: 2) // 稿 .ob-bar 24×2
        .padding(.top, 4)
    }
    .foregroundStyle(SwissTheme.ink)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .overlay { Circle().strokeBorder(SwissTheme.ink, lineWidth: 1) } // 稿 1px 黑圈
  }
}
