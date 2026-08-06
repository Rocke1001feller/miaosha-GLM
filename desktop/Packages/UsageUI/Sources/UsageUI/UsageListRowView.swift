import SwiftUI
import AppKit // NSWorkspace.open（打开控制台）
import UsageCore

/// 浮层行背景统一入口（主题决策 7）：system 无底；
/// swiss 白底直角 + 底部 1px 黑规则线（03 稿 p-card 的规则线语言，行内文字由上层强制浅色）；
/// neoBrutal 平台撞色实色块 + 3px 黑内描边 + 4px 硬偏移实色投影（04 稿 .p-card：border --bw /
/// box-shadow --shadow-sm，稿无 border-radius 直角；行内文字移植稿前景约定纯黑）。
public enum PopoverRowStyle {
  /// 行是否有底（决定行内边距；无底的 system 行与列表同宽贴合）
  public static func hasBackground(mode: AppearanceMode) -> Bool {
    mode != .system
  }

  @ViewBuilder
  public static func background(mode: AppearanceMode, platform: PlatformID) -> some View {
    switch mode {
    case .system:
      EmptyView()
    case .neoBrutal:
      Rectangle() // 04 稿 .p-card：直角实色块 + 3px 黑边 + 4px 4px 0 硬影
        .fill(NeoBrutalTheme.platformColor(platform))
        .overlay { Rectangle().strokeBorder(NeoBrutalTheme.ink, lineWidth: NeoBrutalTheme.borderWidth) }
        .shadow(color: NeoBrutalTheme.ink, radius: 0,
                x: NeoBrutalTheme.shadowSmall, y: NeoBrutalTheme.shadowSmall)
    case .swiss:
      Rectangle()
        .fill(SwissTheme.paper)
        .overlay(alignment: .bottom) {
          Rectangle().fill(SwissTheme.ink).frame(height: 1) // 稿 p-card border-bottom 1px 黑
        }
    }
  }
}

/// 单平台用量卡：头部（平台名 + plan 徽章 + 抓取时刻）+ 各窗口进度行 + 状态/备注行。
public struct UsageListRowView: View {
  public let card: PlatformUsage
  /// 外观模式：决定行底样式（见 PopoverRowStyle）
  public let appearance: AppearanceMode

  public init(card: PlatformUsage, appearance: AppearanceMode = .system) {
    self.card = card
    self.appearance = appearance
  }

  public var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      header
      switch card.status {
      case .ok, .stale:
        windowsContent
      case .needsLogin:
        errorLine(card.errorMessage ?? "需要登录", tint: .yellow)
        consoleLink
      case .unavailable:
        errorLine(card.errorMessage ?? "不可用", tint: .secondary)
        consoleLink
      case .loading:
        errorLine("加载中…", tint: .secondary)
      }
      if let note = card.note, !note.isEmpty {
        if isBrutal {
          NeoBrutalNoteSticker(note) // 04 稿 .p-note：黑底白字反色便签（有效期/未订阅）
        } else {
          Text(note)
            .font(.system(size: 9))
            .foregroundStyle(.secondary)
        }
      }
    }
    .opacity(card.status == .stale ? 0.55 : 1) // stale 灰化
    .padding(.vertical, PopoverRowStyle.hasBackground(mode: appearance) ? (isBrutal ? 8 : 6) : 0)
    .padding(.horizontal, PopoverRowStyle.hasBackground(mode: appearance) ? (isBrutal ? 10 : 8) : 0)
    .background { PopoverRowStyle.background(mode: appearance, platform: card.platform) }
    // 04 稿前景约定：撞色块面之上纯黑文字（稿测算对比度 ≥4.5），不依赖 .light 强制
    .foregroundStyle(isBrutal ? NeoBrutalTheme.ink : .primary)
  }

  /// 04 稿 neoBrutal 分支开关
  private var isBrutal: Bool { appearance == .neoBrutal }

  // MARK: - 子视图

  private var header: some View {
    HStack(spacing: 6) {
      if appearance == .swiss {
        SwissChip(platform: card.platform) // 03 稿 p-top：平台名左侧 8px 色块
      }
      Text(isBrutal ? card.displayName.uppercased() : card.displayName) // 04 稿 .p-name uppercase
        .font(.system(size: 12, weight: isBrutal ? .black : .semibold)) // 稿 15px 900，行内收敛 12pt
      if let plan = card.planName, !plan.isEmpty {
        if appearance == .swiss {
          // 03 稿 .p-top .metric：灰色全大写 caps + 字距，不渲染 accentColor 胶囊
          Text(plan.uppercased())
            .font(SwissTheme.capsFont(size: 8))
            .tracking(SwissTheme.capsTracking(8))
            .foregroundStyle(SwissTheme.dim)
            .lineLimit(1)
        } else if isBrutal {
          NeoBrutalPlanBadge(plan) // 04 稿 .p-plan：白底 2px 黑边 -3° 旋转
        } else {
          Text(plan)
            .font(.system(size: 9))
            .padding(.horizontal, 5)
            .padding(.vertical, 1.5)
            .background(Color.accentColor.opacity(0.15), in: Capsule())
        }
      }
      Spacer()
      Text(Formatting.timeText(card.fetchedAt))
        .font(.system(size: 10, weight: isBrutal ? .bold : .regular)) // 稿 .p-updated 10px 700
        .monospacedDigit()
        .foregroundStyle(isBrutal ? NeoBrutalTheme.ink : .secondary)
    }
  }

  @ViewBuilder
  private var windowsContent: some View {
    if card.windows.isEmpty {
      Text("暂无用量数据")
        .font(.system(size: 10))
        .foregroundStyle(isBrutal ? NeoBrutalTheme.ink : .secondary)
    } else {
      ForEach(Array(card.windows.enumerated()), id: \.offset) { _, w in
        VStack(alignment: .leading, spacing: 2) {
          HStack(spacing: 8) {
            Text(w.label)
              .font(.system(size: 11, weight: isBrutal ? .heavy : .semibold)) // 稿 .p-metric 11px 800
              .fixedSize()
            if appearance == .swiss {
              SwissProgressStrip(percent: w.percent, platform: card.platform) // 03 稿 2px 纯平台色条
            } else if isBrutal {
              NeoBrutalBar(percent: w.percent, height: 8) // 04 稿黑色斜纹条（多窗口并列收敛 8pt）
            } else {
              UsageMeterView(percent: w.percent, tint: StatusPalette.color(forUsedPercent: w.percent))
            }
            Text(Formatting.pct(w.percent))
              .font(.system(size: 11, weight: isBrutal ? .bold : .regular))
              .monospacedDigit()
              .fixedSize()
          }
          let sub = [w.usedText, w.resetAt.map { Formatting.resetText(resetAt: $0) }]
            .compactMap { $0 }.filter { !$0.isEmpty }.joined(separator: " · ")
          if !sub.isEmpty {
            Text(sub)
              .font(.system(size: 9, weight: isBrutal ? .bold : .regular)) // 稿 .p-nums 10px 700
              .foregroundStyle(isBrutal ? NeoBrutalTheme.ink : .secondary)
          }
        }
      }
    }
  }

  private func errorLine(_ text: String, tint: Color) -> some View {
    Text(text)
      .font(.system(size: 11))
      .foregroundStyle(tint)
  }

  @ViewBuilder
  private var consoleLink: some View {
    if let raw = card.consoleUrl, let url = URL(string: raw) {
      Button("打开控制台 →") {
        NSWorkspace.shared.open(url)
      }
      .buttonStyle(.link)
      .font(.system(size: 11))
    }
  }
}
