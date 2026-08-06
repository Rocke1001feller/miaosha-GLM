import AppKit
import Combine
import SwiftUI
import UsageCore
import UsageUI

/// 浮窗控制器：卡片/悬浮球双模、平台选择与菜单栏联动（UsageStore.selectedPlatform）、2s 空闲收缩、位置/置顶/透明度/穿透偏好应用。
@MainActor
final class WidgetController: ObservableObject {
  /// 模式定义收敛到 UsageUI 的 WidgetGeometry（纯函数可测；panel 与控制器共用同一类型）
  typealias WidgetMode = WidgetGeometry.Mode

  static let cardSize = NSSize(width: 280, height: 170)
  static let orbSize = NSSize(width: 80, height: 80)
  private static let idleInterval: UInt64 = 2 * 1_000_000_000

  @Published var mode: WidgetMode = .card
  /// 当前展示平台：单一事实源在 UsageStore（菜单栏共享同一值，联动一致）
  var displayedPlatform: PlatformID { state.store.selectedPlatform }
  @Published private(set) var panel: FloatingPanel?

  private let state: AppState
  private var container: WidgetContainerView?
  private var idleTask: Task<Void, Never>?
  private var defaultsObserver: NSObjectProtocol?

  init(state: AppState) {
    self.state = state
    // 菜单栏浮层 footer、设置页浮窗分区与浮窗右键菜单写同一批 UserDefaults 键，这里统一应用到面板
    defaultsObserver = NotificationCenter.default.addObserver(
      forName: UserDefaults.didChangeNotification, object: nil, queue: .main
    ) { [weak self] _ in
      Task { @MainActor [weak self] in
        self?.applyWidgetSettings()
      }
    }
  }

  deinit {
    if let defaultsObserver {
      NotificationCenter.default.removeObserver(defaultsObserver)
    }
  }

  func show() {
    guard panel == nil else { return }
    mode = .card
    let hosting = MenuHostingView(rootView: WidgetRootView(controller: self, state: state))
    let container = WidgetContainerView(content: hosting)
    // 圆角/磨砂按主题（非 system 主题底色由 SwiftUI 层提供，磨砂层隐藏为 0）
    let appearance = WidgetSettings.appearanceMode
    container.cornerRadius = WidgetGeometry.containerCornerRadius(mode: .card, appearance: appearance)
    container.blur.alphaValue = CGFloat(
      WidgetGeometry.panelBlurAlpha(appearance: appearance, opacity: WidgetSettings.opacity))
    let panel = FloatingPanel(contentRect: NSRect(origin: .zero, size: Self.cardSize), content: container)
    panel.level = WidgetSettings.alwaysOnTop ? .floating : .normal
    // 系统软影按主题：neoBrutal 硬影由 SwiftUI 层垫块实现，关闭软影防叠加
    panel.hasShadow = WidgetGeometry.panelHasShadow(appearance: appearance)
    panel.ignoresMouseEvents = WidgetSettings.clickThrough
    panel.modeMenuTitle = { [weak self] in
      guard let self else { return "切换悬浮球" }
      return self.mode == .card ? "收缩为悬浮球" : "展开卡片"
    }
    panel.onToggleMode = { [weak self] in self?.toggleMode() }
    self.container = container
    self.panel = panel
    panel.orderFront(nil)
    userInteracted() // 启动 2s 空闲收缩计时
  }

  func hide() {
    idleTask?.cancel()
    idleTask = nil
    panel?.close()
    panel = nil
    container = nil
  }

  func toggle() {
    panel == nil ? show() : hide()
  }

  func nextPlatform() {
    state.store.selectManually(Carousel.next(displayedPlatform, in: PlatformID.allCases))
  }

  func prevPlatform() {
    state.store.selectManually(Carousel.previous(displayedPlatform, in: PlatformID.allCases))
  }

  /// 用户悬停/点按：重置 2s 空闲计时，到点收缩为 80×80 悬浮球（顶边锚定动画）
  func userInteracted() {
    idleTask?.cancel()
    idleTask = Task { [weak self] in
      try? await Task.sleep(nanoseconds: Self.idleInterval)
      guard !Task.isCancelled else { return }
      self?.setMode(.orb, animate: true)
    }
  }

  /// 点球展开回卡片，并重新计 2s 空闲
  func expand() {
    setMode(.card, animate: true)
    userInteracted()
  }

  // MARK: - 内部

  /// 把 WidgetSettings（置顶/透明度/点击穿透）即时应用到已存在的面板；面板未创建时无操作
  private func applyWidgetSettings() {
    guard let panel else { return }
    panel.level = WidgetSettings.alwaysOnTop ? .floating : .normal
    // 圆角/磨砂随主题：仅 system 透明度滑杆作用磨砂层，其余主题底色由 SwiftUI 层提供
    let appearance = WidgetSettings.appearanceMode
    container?.cornerRadius = WidgetGeometry.containerCornerRadius(mode: mode, appearance: appearance)
    container?.blur.alphaValue = CGFloat(
      WidgetGeometry.panelBlurAlpha(appearance: appearance, opacity: WidgetSettings.opacity))
    // 系统软影随主题切换（neoBrutal 关闭，硬影由 SwiftUI 层承担）
    panel.hasShadow = WidgetGeometry.panelHasShadow(appearance: appearance)
    panel.ignoresMouseEvents = WidgetSettings.clickThrough
  }

  private func toggleMode() {
    if mode == .card {
      setMode(.orb, animate: true)
    } else {
      expand()
    }
  }

  private func setMode(_ newMode: WidgetMode, animate: Bool) {
    guard let panel, mode != newMode else { return }
    mode = newMode
    // 先同步面板模式（windowMoved 写档守卫），再 resize——收缩动画的 didMove 不应落档
    panel.mode = newMode
    // 外层容器圆角随模式与主题（AppKit 裁剪档见 WidgetGeometry.containerCornerRadius；
    // neoBrutal 恒 0，正圆造型由 WidgetRootView 的 clipShape 承担，保硬影垫块不被裁）
    container?.cornerRadius = WidgetGeometry.containerCornerRadius(
      mode: newMode, appearance: WidgetSettings.appearanceMode)
    resizePanel(to: newMode == .card ? Self.cardSize : Self.orbSize, animate: animate)
  }

  /// 顶边锚定：resize 时视觉顶边不动（模板 float_widget.swift 664-673）
  private func resizePanel(to size: NSSize, animate: Bool) {
    guard let panel else { return }
    panel.setFrame(WidgetGeometry.topAnchoredFrame(from: panel.frame, to: size),
                   display: true, animate: animate)
  }
}
