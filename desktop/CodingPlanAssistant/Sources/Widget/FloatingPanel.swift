import AppKit
import SwiftUI
import UsageUI

/// 浮窗偏好（UserDefaults）。"widgetVisible"/"widgetClickThrough" 与菜单栏浮层开关共用同一键。
enum WidgetSettings {
  static let visibleKey = "widgetVisible"
  static let originXKey = "widgetOrigin.x"
  static let originYKey = "widgetOrigin.y"
  static let alwaysOnTopKey = "widgetAlwaysOnTop"
  static let opacityKey = "widgetOpacity"
  static let clickThroughKey = "widgetClickThrough"
  static let appearanceKey = "appearanceMode"

  /// 默认置顶（首次写入前视为 true）
  static var alwaysOnTop: Bool {
    get {
      if UserDefaults.standard.object(forKey: alwaysOnTopKey) == nil { return true }
      return UserDefaults.standard.bool(forKey: alwaysOnTopKey)
    }
    set { UserDefaults.standard.set(newValue, forKey: alwaysOnTopKey) }
  }

  /// 磨砂层透明度，默认 1.0（只作用磨砂背景层，文字/进度条保持全不透明）
  static var opacity: Double {
    get {
      let v = UserDefaults.standard.double(forKey: opacityKey)
      return v > 0 ? v : 1.0
    }
    set { UserDefaults.standard.set(newValue, forKey: opacityKey) }
  }

  /// 点击穿透：开启后浮窗不响应鼠标，解锁入口在菜单栏浮层 footer
  static var clickThrough: Bool {
    get { UserDefaults.standard.bool(forKey: clickThroughKey) }
    set { UserDefaults.standard.set(newValue, forKey: clickThroughKey) }
  }

  /// 外观模式：默认新粗野（首次写入前视为 .neoBrutal；存档为已删除主题等未知 rawValue 时同样回退 .neoBrutal）
  static var appearanceMode: AppearanceMode {
    get {
      guard let raw = UserDefaults.standard.string(forKey: appearanceKey),
            let mode = AppearanceMode(rawValue: raw) else { return .neoBrutal }
      return mode
    }
    set { UserDefaults.standard.set(newValue.rawValue, forKey: appearanceKey) }
  }

  /// 拖动记忆位置（widgetOrigin.x/y 双键）；无记录时首启定位屏幕右上角
  static var savedOrigin: NSPoint? {
    get {
      guard UserDefaults.standard.object(forKey: originXKey) != nil else { return nil }
      return NSPoint(x: UserDefaults.standard.double(forKey: originXKey),
                     y: UserDefaults.standard.double(forKey: originYKey))
    }
    set {
      guard let p = newValue else { return }
      UserDefaults.standard.set(p.x, forKey: originXKey)
      UserDefaults.standard.set(p.y, forKey: originYKey)
    }
  }
}

/// 圆角磨砂容器：blur 仅作背景层（透明度只作用于此层），内容层叠在其上保持全不透明。
final class WidgetContainerView: NSView {
  let blur = NSVisualEffectView()

  /// 外层裁剪圆角（随模式与主题切换，档位由 WidgetGeometry.cornerRadius 统一给出）
  var cornerRadius: CGFloat {
    get { layer?.cornerRadius ?? 0 }
    set { layer?.cornerRadius = newValue }
  }

  init(content: NSView) {
    super.init(frame: .zero)
    wantsLayer = true
    layer?.cornerRadius = 14
    layer?.masksToBounds = true

    blur.material = .popover
    blur.blendingMode = .behindWindow
    blur.state = .active
    blur.frame = bounds
    blur.autoresizingMask = [.width, .height]
    addSubview(blur)

    content.frame = bounds
    content.autoresizingMask = [.width, .height]
    addSubview(content)
  }

  @available(*, unavailable)
  required init?(coder: NSCoder) { fatalError() }
}

/// 承载 SwiftUI 内容并把右键事件路由给所属 FloatingPanel 的上下文菜单
/// （hosting 视图覆盖整个面板，面板自身的 rightMouseDown 收不到事件）。
final class MenuHostingView<Content: View>: NSHostingView<Content> {
  override func rightMouseDown(with event: NSEvent) {
    if let panel = window as? FloatingPanel {
      panel.presentContextMenu(with: event, for: self)
    } else {
      super.rightMouseDown(with: event)
    }
  }
}

/// 无边框浮动面板：borderless + nonactivating + 全 Space/全屏可见 + 透明磨砂 + 拖动记忆 + 右键菜单。
/// 工程细节照 references/claude-desktop-usage/float_widget.swift（357-383 窗口标志、409-418 圆角磨砂、
/// 373-380 默认右上角定位、499-540 右键菜单、622-639 位置持久化）。
final class FloatingPanel: NSPanel {
  /// 模式菜单项由 WidgetController 注入（标题随当前模式变化、动作需跳 MainActor）
  var modeMenuTitle: (@MainActor () -> String)?
  var onToggleMode: (@MainActor () -> Void)?
  /// 当前显示模式，由 WidgetController.setMode 同步；windowMoved 仅卡片模式写档（防球位污染存档）
  var mode: WidgetGeometry.Mode = .card

  init(contentRect: NSRect, content: NSView) {
    super.init(contentRect: contentRect,
               styleMask: [.borderless, .nonactivatingPanel],
               backing: .buffered, defer: false)
    level = .floating
    collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
    isOpaque = false
    backgroundColor = .clear
    hasShadow = true
    isMovableByWindowBackground = true
    contentView = content

    if let origin = WidgetSettings.savedOrigin {
      setFrameOrigin(origin)
    } else if let visible = NSScreen.main?.visibleFrame {
      setFrameOrigin(NSPoint(x: visible.maxX - contentRect.width - 16,
                             y: visible.maxY - contentRect.height - 16))
    }
    NotificationCenter.default.addObserver(self, selector: #selector(windowMoved(_:)),
                                           name: NSWindow.didMoveNotification, object: self)
  }

  override var canBecomeKey: Bool { true }

  override func rightMouseDown(with event: NSEvent) {
    if let contentView {
      presentContextMenu(with: event, for: contentView)
    } else {
      super.rightMouseDown(with: event)
    }
  }

  @objc private func windowMoved(_ note: Notification) {
    // orb 态 origin.y 相对卡片顶边下移，写档会让卡片重建后顶边逐次漂移——仅卡片模式写档
    guard WidgetGeometry.shouldPersistOrigin(mode: mode) else { return }
    WidgetSettings.savedOrigin = frame.origin
  }

  // MARK: - 右键菜单

  func presentContextMenu(with event: NSEvent, for view: NSView) {
    let menu = NSMenu()

    let pin = NSMenuItem(title: "置顶", action: #selector(toggleAlwaysOnTop(_:)), keyEquivalent: "")
    pin.target = self
    pin.state = WidgetSettings.alwaysOnTop ? .on : .off
    menu.addItem(pin)

    menu.addItem(opacitySubmenu())

    let click = NSMenuItem(title: "点击穿透", action: #selector(toggleClickThrough(_:)), keyEquivalent: "")
    click.target = self
    click.state = WidgetSettings.clickThrough ? .on : .off
    click.toolTip = "开启后浮窗不响应鼠标，在菜单栏浮层 footer 关闭"
    menu.addItem(click)

    let modeTitle = MainActor.assumeIsolated { modeMenuTitle?() } ?? "切换悬浮球"
    let modeItem = NSMenuItem(title: modeTitle, action: #selector(toggleMode(_:)), keyEquivalent: "")
    modeItem.target = self
    menu.addItem(modeItem)

    menu.addItem(.separator())
    menu.addItem(NSMenuItem(title: "退出", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q"))

    NSMenu.popUpContextMenu(menu, with: event, for: view)
  }

  private func opacitySubmenu() -> NSMenuItem {
    let parent = NSMenuItem(title: "透明度", action: nil, keyEquivalent: "")
    let sub = NSMenu()
    for (label, value) in [("50%", 0.5), ("65%", 0.65), ("80%", 0.8), ("100%", 1.0)] as [(String, Double)] {
      let item = NSMenuItem(title: label, action: #selector(pickOpacity(_:)), keyEquivalent: "")
      item.target = self
      item.representedObject = value
      item.state = abs(WidgetSettings.opacity - value) < 0.01 ? .on : .off
      sub.addItem(item)
    }
    parent.submenu = sub
    return parent
  }

  @objc private func toggleAlwaysOnTop(_ sender: NSMenuItem) {
    let on = !WidgetSettings.alwaysOnTop
    WidgetSettings.alwaysOnTop = on
    level = on ? .floating : .normal
  }

  @objc private func pickOpacity(_ sender: NSMenuItem) {
    guard let value = sender.representedObject as? Double else { return }
    WidgetSettings.opacity = value
    // 只作用磨砂层 alpha，文字/进度条保持全不透明（模板 applyOpacity）
    (contentView as? WidgetContainerView)?.blur.alphaValue = CGFloat(value)
  }

  @objc private func toggleClickThrough(_ sender: NSMenuItem) {
    let on = !WidgetSettings.clickThrough
    WidgetSettings.clickThrough = on
    ignoresMouseEvents = on
  }

  @objc private func toggleMode(_ sender: NSMenuItem) {
    MainActor.assumeIsolated { onToggleMode?() }
  }
}
