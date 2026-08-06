import SwiftUI
import UsageCore
import UsageUI

/// 浮窗根视图：卡片模式（PlatformCardView 单卡手动切换、与菜单栏联动）⇄ 悬浮球模式（80×80 大百分比，点击展开）。
struct WidgetRootView: View {
  @ObservedObject var controller: WidgetController
  @ObservedObject var state: AppState
  /// 外观模式：设置页/右键菜单写 UserDefaults 后经 onReceive 回读刷新（沿用 T8 双向同步模式）
  @State private var appearance: AppearanceMode = WidgetSettings.appearanceMode
  @Environment(\.colorScheme) private var systemScheme

  var body: some View {
    Group {
      switch controller.mode {
      case .card: cardBody
      case .orb: orbBody
      }
    }
    // neoBrutal 内容内缩硬影偏移量，给右下 6px 实色投影留位（其余主题 inset 0，尺寸不变）
    .frame(width: baseSize.width - shadowInset, height: baseSize.height - shadowInset)
    .background {
      switch appearance {
      case .neoBrutal: // 04 稿：平台撞色实色块 + 3px 黑内描边（硬影在 clipShape 后垫层）
        NeoBrutalCardBackground(
          platform: controller.displayedPlatform,
          cornerRadius: WidgetGeometry.cornerRadius(mode: controller.mode, appearance: appearance))
      case .swiss: // 03 稿：纯白平涂，零渐变零玻璃
        SwissTheme.paper
      case .system:
        EmptyView()
      }
    }
    // SwiftUI 层自裁剪圆角（连续曲线，圆角档见 WidgetGeometry.cornerRadius）：不依赖 AppKit 容器层裁剪，
    // 杜绝背景/磨砂边缘在部分光栅化路径下出现单侧直角的窗口级视觉 bug
    .clipShape(RoundedRectangle(
      cornerRadius: WidgetGeometry.cornerRadius(mode: controller.mode, appearance: appearance),
      style: .continuous))
    .background {
      // 04 稿硬投影（--shadow 6px 6px 0 var(--ink)）：clipShape 之后垫纯黑块向右下偏移，
      // 不被裁剪；此主题面板 hasShadow 已关（WidgetGeometry.panelHasShadow），无软影叠加
      if appearance == .neoBrutal {
        RoundedRectangle(
          cornerRadius: WidgetGeometry.cornerRadius(mode: controller.mode, appearance: appearance),
          style: .continuous)
          .fill(NeoBrutalTheme.ink)
          .offset(x: NeoBrutalTheme.shadowOffset, y: NeoBrutalTheme.shadowOffset)
      }
    }
    .frame(width: baseSize.width, height: baseSize.height, alignment: .topLeading)
    .onReceive(NotificationCenter.default.publisher(for: UserDefaults.didChangeNotification)
      .receive(on: DispatchQueue.main)) { _ in // KimiTokenCache 等后台写入也触发该通知，须跳主线程再写 @State
      appearance = WidgetSettings.appearanceMode
    }
    // 浅底主题（swiss 白纸 / neoBrutal 撞色块面）强制浅色外观：.primary/.secondary 解析为深色文字；
    // system 跟随系统外观
    .environment(\.colorScheme, appearance == .system ? systemScheme : .light)
  }

  /// 面板尺寸（卡片 280×170 / 球 80×80）
  private var baseSize: CGSize {
    controller.mode == .card ? WidgetController.cardSize : WidgetController.orbSize
  }

  /// 04 稿硬影偏移量作为内容内缩（--shadow 6px）；其余主题 0
  private var shadowInset: CGFloat {
    appearance == .neoBrutal ? NeoBrutalTheme.shadowOffset : 0
  }

  private var cardBody: some View {
    // 30s 本地 tick：重置倒计时文案随墙钟刷新（模板 countdownTimer 622-626）
    TimelineView(.periodic(from: .now, by: 30)) { _ in
      PlatformCardView(
        card: currentCard, platform: controller.displayedPlatform,
        appearance: appearance,
        onPrev: { controller.prevPlatform(); controller.userInteracted() },
        onNext: { controller.nextPlatform(); controller.userInteracted() })
    }
    .onHover { if $0 { controller.userInteracted() } }
  }

  @ViewBuilder
  private var orbBody: some View {
    let card = state.store.cards[controller.displayedPlatform]
    let percent = (card?.status == .ok || card?.status == .stale) ? card?.windows.first?.percent : nil
    if appearance == .swiss {
      // 03 稿 orb：白底黑字 + 1px 黑圈正圆（圆角档 40 由 WidgetGeometry 给出）
      SwissOrbView(
        label: card?.displayName ?? fallbackName(controller.displayedPlatform),
        percent: percent, platform: controller.displayedPlatform)
        .contentShape(Rectangle())
        .onTapGesture { controller.expand() }
    } else if appearance == .neoBrutal {
      // 04 稿 orb：正圆贴纸徽章，900 黑字；平台色底/3px 黑圈/硬影由背景层提供
      NeoBrutalOrbView(
        label: card?.displayName ?? fallbackName(controller.displayedPlatform),
        percent: percent)
        .contentShape(Rectangle())
        .onTapGesture { controller.expand() }
    } else {
      OrbView(percent: percent, tint: orbTint(percent: percent))
        .contentShape(Rectangle())
        .onTapGesture { controller.expand() }
    }
  }

  /// orb 大数字配色：系统模式走三档变色；swiss/neoBrutal orb 已由专用视图接管（穷举兜底）
  private func orbTint(percent: Double?) -> Color {
    switch appearance {
    case .neoBrutal:
      NeoBrutalTheme.ink // 不可达（orbBody 已接管），穷举兜底
    case .swiss:
      SwissTheme.ink // 不可达（orbBody 已接管），穷举兜底
    case .system:
      percent.map { StatusPalette.color(forUsedPercent: $0) } ?? Color.secondary
    }
  }

  /// 缺卡时用 loading 占位卡，箭头手动切换不受影响
  private var currentCard: PlatformUsage {
    let platform = controller.displayedPlatform
    return state.store.cards[platform]
      ?? PlatformUsage(platform: platform, displayName: fallbackName(platform),
                       status: .loading, fetchedAt: Date())
  }

  /// 缺卡占位用的静态名（与菜单栏浮层一致，真实 displayName 以数据为准）
  private func fallbackName(_ id: PlatformID) -> String {
    switch id {
    case .minimax: "MiniMax"; case .kimi: "Kimi Code"; case .mimo: "小米 MiMo"; case .volcengine: "火山引擎"
    }
  }
}

/// 80×80 悬浮球：背景由面板磨砂层提供，仅显大百分比。
private struct OrbView: View {
  let percent: Double?
  let tint: Color

  var body: some View {
    Text(percent.map { String(format: "%.0f%%", min(max($0, 0), 1) * 100) } ?? "—")
      .font(.system(size: 26, weight: .bold))
      .monospacedDigit()
      .foregroundStyle(tint)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
  }
}
