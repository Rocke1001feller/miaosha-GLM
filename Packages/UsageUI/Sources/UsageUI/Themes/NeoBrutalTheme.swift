import SwiftUI
import UsageCore

/// 设计稿 04「新粗野主义 Neo-Brutalism」主题资产。
/// 一切像素值以 docs/design-explorations/04-neo-brutal.html 的 CSS 为准（:root 变量与
/// .p-card / .float-card / .bar / .orb 规则），不凭感觉取值。3px 粗黑边框 / 6px 硬偏移
/// 实色投影 / 高饱和平台撞色块面 / 900 粗黑文字；拒绝玻璃、模糊与柔缓渐变。
public enum NeoBrutalTheme {
  /// 全部边框与正文的粗黑（--ink #111111）
  public static let ink = Color(red: 0x11 / 255, green: 0x11 / 255, blue: 0x11 / 255)
  /// 海报米色纸底（--paper #f5efdd；稿中仅页面底，widget/popover 表面为平台色/白）
  public static let paper = Color(red: 0xf5 / 255, green: 0xef / 255, blue: 0xdd / 255)
  /// 撞色辅料海报黄（--yellow #ffd924；徽章/贴纸用）
  public static let yellow = Color(red: 0xff / 255, green: 0xd9 / 255, blue: 0x24 / 255)
  /// 撞色辅料贴纸粉（--pink #ff8fd1；稿规仅页级辅料，不与平台色混用）
  public static let pink = Color(red: 0xff / 255, green: 0x8f / 255, blue: 0xd1 / 255)

  /// 粗边框宽度（--bw 3px，卡片/orb/浮层行统一）
  public static let borderWidth: CGFloat = 3
  /// 小型构件边框（稿 .bar / .p-plan / .f-plan / .nb-btn 的 2px 边）
  public static let barBorderWidth: CGFloat = 2
  /// 硬投影偏移（--shadow 6px 6px 0 var(--ink)，无模糊实色块）
  public static let shadowOffset: CGFloat = 6
  /// 小构件硬投影偏移（--shadow-sm 4px 4px 0 var(--ink)，浮层行用）
  public static let shadowSmall: CGFloat = 4

  /// 平台撞色块面（04 稿 --kimi #5b6ee0 / --mimo #f07e1d / --minimax #189a74 / --volc #d94f3d，
  /// 与 PlatformPalette.progressColor 同值复用）；全部叠纯黑文字，稿测算对比度 ≥ 4.5
  public static func platformColor(_ platform: PlatformID) -> Color {
    PlatformPalette.progressColor(for: platform)
  }
}

/// 04 稿浮窗/orb 底：平台撞色实色块 + 3px 黑内描边（--bw strokeBorder）。
/// 硬投影（--shadow 6px 6px 0）由 WidgetRootView 在 clipShape 之后垫纯黑偏移块实现，
/// 此主题面板 hasShadow 关闭，避免系统软影与硬影叠加。
public struct NeoBrutalCardBackground: View {
  public let platform: PlatformID
  /// 容器圆角（卡 0 / 球 40，由 WidgetGeometry.cornerRadius 统一给出；稿全直角，orb 为正圆）
  public let cornerRadius: CGFloat

  public init(platform: PlatformID, cornerRadius: CGFloat = 0) {
    self.platform = platform
    self.cornerRadius = cornerRadius
  }

  public var body: some View {
    let shape = RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
    shape
      .fill(NeoBrutalTheme.platformColor(platform))
      .overlay { shape.strokeBorder(NeoBrutalTheme.ink, lineWidth: NeoBrutalTheme.borderWidth) }
  }
}

/// 黑色斜纹进度条（04 稿 .bar 移植）：白底轨道 + 2px 黑边，填充纯黑叠 -45° 白 .28 斜纹
/// （稿 repeating-linear-gradient(-45deg, rgba(255,255,255,.28) 0 4px, transparent 4px 8px)）。
public struct NeoBrutalBar: View {
  public let percent: Double // 0...1 已用
  /// 稿 .bar height 14px；浮层行多窗口并列时收敛 8pt（垂直预算）
  public let height: CGFloat

  public init(percent: Double, height: CGFloat = 14) {
    self.percent = percent
    self.height = height
  }

  public var body: some View {
    GeometryReader { geo in
      ZStack(alignment: .leading) {
        Rectangle().fill(.white) // 稿轨道白底
        Rectangle()
          .fill(NeoBrutalTheme.ink)
          .overlay { stripes }
          .frame(width: geo.size.width * min(max(percent, 0), 1)) // 稿 width:0% 即空槽，不留底条
      }
    }
    .frame(height: height)
    .overlay { Rectangle().strokeBorder(NeoBrutalTheme.ink, lineWidth: NeoBrutalTheme.barBorderWidth) }
    .accessibilityLabel(Formatting.pct(percent))
  }

  /// -45° 斜纹：垂直于纹带方向量周期 8px（4px 白 .28 纹 + 4px 透明间隔），与稿
  /// repeating-linear-gradient(-45deg, … 0 4px, transparent 4px 8px) 沿渐变轴的度量一致；
  /// Canvas 按水平位移取点，水平跑距需 ×√2（纹宽 4√2 ≈ 5.66，节距 8√2 ≈ 11.31），强化印刷感
  private var stripes: some View {
    Canvas { ctx, size in
      let period: CGFloat = 8 * sqrt(2), stripe: CGFloat = 4 * sqrt(2)
      var x = -size.height
      while x < size.width + size.height {
        var p = Path()
        p.move(to: CGPoint(x: x, y: size.height))
        p.addLine(to: CGPoint(x: x + size.height, y: 0))
        p.addLine(to: CGPoint(x: x + size.height + stripe, y: 0))
        p.addLine(to: CGPoint(x: x + stripe, y: size.height))
        p.closeSubpath()
        ctx.fill(p, with: .color(.white.opacity(0.28)))
        x += period
      }
    }
    .clipped()
  }
}

/// 套餐徽章（04 稿 .p-plan/.f-plan）：白底 2px 黑边 900 小字，-3° 微旋转拼贴感
public struct NeoBrutalPlanBadge: View {
  public let text: String

  public init(_ text: String) {
    self.text = text
  }

  public var body: some View {
    Text(text)
      .font(.system(size: 9, weight: .black)) // 稿 9~10px 900
      .foregroundStyle(NeoBrutalTheme.ink)
      .padding(.horizontal, 5)
      .padding(.vertical, 1)
      .background(Color.white)
      .overlay { Rectangle().strokeBorder(NeoBrutalTheme.ink, lineWidth: NeoBrutalTheme.barBorderWidth) }
      .rotationEffect(.degrees(-3)) // 稿 transform rotate(-3deg)
      .fixedSize()
  }
}

/// 反色便签（04 稿 .p-note）：黑底白字 900，-1° 微旋转；承载「有效期」「未订阅」类状态条
public struct NeoBrutalNoteSticker: View {
  public let text: String

  public init(_ text: String) {
    self.text = text
  }

  public var body: some View {
    Text(text)
      .font(.system(size: 9, weight: .black)) // 稿 10px 900，卡面/行内收敛 9pt
      .foregroundStyle(.white)
      .padding(.horizontal, 6)
      .padding(.vertical, 2)
      .background(NeoBrutalTheme.ink)
      .rotationEffect(.degrees(-1)) // 稿 transform rotate(-1deg)
      .fixedSize()
      .lineLimit(1)
  }
}

/// 04 稿浮窗卡（表面 2 .float-card 骨架）：头部（900 大写平台名 + 套餐徽章 + 导航）+
/// 52pt 900 大百分比 + 粗黑指标名 + 斜纹黑条（margin-top auto 压底）+ 重置行；
/// note 以反色便签呈现。卡面底色/边框/硬影由 WidgetRootView 背景层提供，本卡透明。
public struct NeoBrutalCardContent: View {
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
      header
      switch card.status {
      case .ok:
        if let featured = card.windows.first {
          featuredContent(featured)
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
      if let note = card.note, !note.isEmpty {
        NeoBrutalNoteSticker(note).padding(.top, 4) // 稿 p-note：有效期/未订阅状态条
      }
      Spacer(minLength: 0)
    }
    .padding(.horizontal, 14) // 稿 .float-card padding 12px 14px
    .padding(.vertical, 12)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .foregroundStyle(NeoBrutalTheme.ink) // 04 稿：撞色块面之上一切皆墨
  }

  // MARK: - 子视图

  /// 稿 .f-top：900 大写平台名 + 旋转套餐徽章 + 导航按钮（稿箭头在卡外 44×44，
  /// 实卡收进卡头 18×18 白底黑框——黄为页级辅料，稿规不与平台色混用）
  private var header: some View {
    HStack(spacing: 6) {
      Text(card.displayName.uppercased())
        .font(.system(size: 14, weight: .black)) // 稿 .f-name 14px 900 uppercase
        .lineLimit(1)
      if let plan = card.planName, !plan.isEmpty {
        NeoBrutalPlanBadge(plan)
      }
      Spacer(minLength: 4)
      navButton("chevron.left", action: onPrev)
      navButton("chevron.right", action: onNext)
    }
  }

  private func navButton(_ systemName: String, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      Image(systemName: systemName)
        .font(.system(size: 8, weight: .black))
        .foregroundStyle(NeoBrutalTheme.ink)
        .frame(width: 18, height: 18)
        .background(Color.white)
        .overlay { Rectangle().strokeBorder(NeoBrutalTheme.ink, lineWidth: NeoBrutalTheme.barBorderWidth) }
        .contentShape(Rectangle())
    }
    .buttonStyle(.borderless)
  }

  /// 特色窗口：52pt 900 大数字（稿 .f-pct -.04em 字距）+ 800 指标名 + 斜纹条压底 + 700 重置行
  private func featuredContent(_ w: UsageWindow) -> some View {
    VStack(alignment: .leading, spacing: 0) {
      Text(Formatting.pct(w.percent))
        .font(.system(size: 52, weight: .black)) // 稿 .f-pct 52px 900
        .tracking(-2.08) // 稿 letter-spacing -.04em
        .padding(.top, 2)
      Text(w.label)
        .font(.system(size: 11, weight: .heavy)) // 稿 .f-metric 11px 800
        .padding(.top, 2)
      Spacer(minLength: 0) // 稿 .bar margin-top:auto 压底
      NeoBrutalBar(percent: w.percent)
      if let resetLine = w.resetAt.map({ Formatting.resetText(resetAt: $0) }) ?? w.usedText {
        Text(resetLine)
          .font(.system(size: 10, weight: .bold)) // 稿 .f-reset 10px 700
          .padding(.top, 6)
          .lineLimit(1)
      }
    }
  }

  /// 非 ok 态：900 粗黑状态文案（稿无错误态，沿用主题字重）
  private func statusLine(_ text: String) -> some View {
    HStack {
      Spacer()
      Text(text)
        .font(.system(size: 14, weight: .black))
      Spacer()
    }
    .padding(.vertical, 18)
  }
}

/// 04 稿表面 3 悬浮球 orb 内容（正圆贴纸徽章）：900 大百分比 + 900 大写小平台名。
/// 平台色底 + 3px 黑圈 + 硬投影由 WidgetRootView 背景层提供（与卡片同语言）。
public struct NeoBrutalOrbView: View {
  public let label: String
  public let percent: Double?

  public init(label: String, percent: Double?) {
    self.label = label
    self.percent = percent
  }

  public var body: some View {
    VStack(spacing: 0) {
      Text(percent.map { String(format: "%.0f%%", min(max($0, 0), 1) * 100) } ?? "—")
        .font(.system(size: 22, weight: .black)) // 稿 .o-pct 22px 900
        .tracking(-0.6) // 稿 letter-spacing -.03em
        .monospacedDigit()
      Text(label.uppercased())
        .font(.system(size: 9, weight: .black)) // 稿 .o-name 9px 900 uppercase
        .lineLimit(1)
        .minimumScaleFactor(0.7)
        .padding(.top, 2)
    }
    .foregroundStyle(NeoBrutalTheme.ink)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}
