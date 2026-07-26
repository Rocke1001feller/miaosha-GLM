import SwiftUI
import UsageCore

/// 环形轮播索引：供浮窗卡片箭头 next/prev 手动切换使用。
public enum Carousel {
  /// offset 正数向后、负数向前，越界回绕；元素不在列表（或列表为空）时返回首个元素。
  public static func advance<T: Equatable>(_ current: T, in items: [T], by offset: Int) -> T {
    guard !items.isEmpty, let index = items.firstIndex(of: current) else {
      return items.first ?? current
    }
    let count = items.count
    return items[(index + offset % count + count) % count]
  }

  public static func next<T: Equatable>(_ current: T, in items: [T]) -> T {
    advance(current, in: items, by: 1)
  }

  public static func previous<T: Equatable>(_ current: T, in items: [T]) -> T {
    advance(current, in: items, by: -1)
  }
}

/// 浮窗单卡（280pt 宽）：头部（平台名 · plan + 左右箭头）+ 首窗口特色行（28pt 大数字三档变色）
/// + 其余窗口紧凑行 + 状态文案/备注。磨砂背景由面板层提供，本卡背景透明。
public struct PlatformCardView: View {
  public let card: PlatformUsage
  /// 当前展示的平台标识（保留给无障碍与调试标识；数据以 card 为准）
  public let platform: PlatformID
  public let appearance: AppearanceMode
  public let onPrev: () -> Void
  public let onNext: () -> Void

  public init(card: PlatformUsage, platform: PlatformID,
              appearance: AppearanceMode = .system,
              onPrev: @escaping () -> Void, onNext: @escaping () -> Void) {
    self.card = card
    self.platform = platform
    self.appearance = appearance
    self.onPrev = onPrev
    self.onNext = onNext
  }

  /// 主题主文字：swiss/neoBrutal 卡面分别由 SwissCardContent/NeoBrutalCardContent 整体接管
  /// （此值仅兜底）；系统模式沿用 primary 自适应
  private var primaryText: Color {
    switch appearance {
    case .neoBrutal: NeoBrutalTheme.ink
    case .swiss: SwissTheme.ink
    case .system: .primary
    }
  }

  /// 进度条：4pt 胶囊条（三档变色）
  private func progressBar(_ w: UsageWindow) -> some View {
    UsageMeterView(percent: w.percent, tint: StatusPalette.color(forUsedPercent: w.percent))
  }

  public var body: some View {
    // 03 稿 swiss / 04 稿 neoBrutal 卡面结构独立（同 SwissCardContent 模式），整体接管
    if appearance == .swiss {
      SwissCardContent(card: card, onPrev: onPrev, onNext: onNext)
        .accessibilityLabel(platform.rawValue)
    } else if appearance == .neoBrutal {
      NeoBrutalCardContent(card: card, onPrev: onPrev, onNext: onNext)
        .accessibilityLabel(platform.rawValue)
    } else {
      legacyBody
    }
  }

  /// 系统模式卡面（v1 结构）
  private var legacyBody: some View {
    VStack(alignment: .leading, spacing: 6) {
      header
      switch card.status {
      case .ok:
        windowsContent
      case .needsLogin:
        statusLine(card.errorMessage ?? "需要登录", tint: .yellow)
      case .stale:
        statusLine(card.errorMessage ?? "数据已过期", tint: .secondary)
      case .unavailable:
        statusLine(card.errorMessage ?? "不可用", tint: .secondary)
      case .loading:
        statusLine("加载中…", tint: .secondary)
      }
      if let note = card.note, !note.isEmpty {
        Text(note)
          .font(.system(size: 9))
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }
      Spacer(minLength: 0)
    }
    .padding(12)
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .background(Color(nsColor: .controlBackgroundColor).opacity(0)) // 磨砂由面板层提供
    .accessibilityLabel(platform.rawValue)
  }

  // MARK: - 子视图

  private var header: some View {
    HStack(spacing: 6) {
      Text(card.displayName)
        .font(.system(size: 12, weight: .semibold))
        .foregroundStyle(primaryText)
        .lineLimit(1)
      if let plan = card.planName, !plan.isEmpty {
        Text("· \(plan)")
          .font(.system(size: 9))
          .foregroundStyle(.secondary)
          .lineLimit(1)
      }
      Spacer()
      arrowButton(systemName: "chevron.left", action: onPrev)
      arrowButton(systemName: "chevron.right", action: onNext)
    }
  }

  private func arrowButton(systemName: String, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      Image(systemName: systemName)
        .font(.system(size: 10, weight: .semibold))
        .foregroundStyle(.secondary)
        .frame(width: 18, height: 18)
        .contentShape(Rectangle())
    }
    .buttonStyle(.borderless)
  }

  @ViewBuilder
  private var windowsContent: some View {
    if card.windows.isEmpty {
      Text("暂无用量数据")
        .font(.system(size: 10))
        .foregroundStyle(.secondary)
    } else {
      featuredRow(card.windows[0])
      ForEach(Array(card.windows.dropFirst().enumerated()), id: \.offset) { _, w in
        compactRow(w)
      }
    }
  }

  /// 首窗口特色行：label + 28pt 大百分比（三档变色）+ 进度条 + 重置倒计时
  private func featuredRow(_ w: UsageWindow) -> some View {
    let tint = StatusPalette.color(forUsedPercent: w.percent)
    return VStack(alignment: .leading, spacing: 3) {
      HStack(alignment: .firstTextBaseline) {
        Text(w.label)
          .font(.system(size: 11, weight: .semibold))
          .foregroundStyle(.primary)
          .lineLimit(1)
        Spacer()
        Text(String(format: "%.0f%%", min(max(w.percent, 0), 1) * 100))
          .font(.system(size: 28, weight: .bold))
          .monospacedDigit()
          .foregroundStyle(tint) // 系统模式大数字三档变色
      }
      progressBar(w)
      if let resetAt = w.resetAt {
        Text(Formatting.resetText(resetAt: resetAt))
          .font(.system(size: 9))
          .foregroundStyle(.secondary)
      }
    }
  }

  /// 次要窗口紧凑行：[label] [pct] [bar] [reset]
  private func compactRow(_ w: UsageWindow) -> some View {
    HStack(spacing: 8) {
      Text(w.label)
        .font(.system(size: 10, weight: .semibold))
        .foregroundStyle(primaryText)
        .fixedSize()
      Text(Formatting.pct(w.percent))
        .font(.system(size: 10))
        .monospacedDigit()
        .fixedSize()
      progressBar(w)
      if let resetAt = w.resetAt {
        Text(Formatting.resetText(resetAt: resetAt))
          .font(.system(size: 9))
          .foregroundStyle(.secondary)
          .fixedSize()
      }
    }
  }

  /// 非 ok 态：大数字位显示状态文案（needs_login 黄字），箭头保持可用
  private func statusLine(_ text: String, tint: Color) -> some View {
    HStack {
      Spacer()
      Text(text)
        .font(.system(size: 16, weight: .semibold))
        .foregroundStyle(tint)
      Spacer()
    }
    .padding(.vertical, 18)
  }
}
