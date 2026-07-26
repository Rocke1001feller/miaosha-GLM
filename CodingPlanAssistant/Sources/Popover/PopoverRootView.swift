import SwiftUI
import UsageCore
import UsageUI

/// 浮层根视图：四平台用量卡（缺卡占位）+ footer（更新时刻 / 刷新 / 显示浮窗 / 设置）。
struct PopoverRootView: View {
  @ObservedObject var state: AppState
  /// Task 8 浮窗控制器：开关在此接线（仅调用，不订阅其 @Published）
  let widget: WidgetController
  /// 打开设置窗口（macOS 14 优先；备用路径 NSApp sendAction showSettingsWindow: 未启用，部署目标 14.0 无需降级）
  @Environment(\.openSettings) private var openSettings
  /// Task 8 消费：浮窗开关即时写入 UserDefaults "widgetVisible"
  @State private var widgetVisible = UserDefaults.standard.bool(forKey: "widgetVisible")
  /// 浮窗点击穿透开关：与浮窗右键菜单共用 UserDefaults "widgetClickThrough"，穿透后在此恢复
  @State private var widgetClickThrough = UserDefaults.standard.bool(forKey: "widgetClickThrough")
  /// 外观模式：设置页切换后经 onReceive 回读刷新（T8 双向同步模式）
  @State private var appearance: AppearanceMode = WidgetSettings.appearanceMode
  @Environment(\.colorScheme) private var systemScheme

  /// 浅底主题（swiss 白底）行内文字强制浅色外观：
  /// 修复 swiss 在系统暗色下白纸行底上 .primary 解析为白字不可读；
  /// neoBrutal 行内文字约定纯黑（外观无关，无需强制），system 无底跟随系统
  private var rowScheme: ColorScheme {
    switch appearance {
    case .swiss: .light
    case .system, .neoBrutal: systemScheme
    }
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      rowsSection
      Divider()
      footer
    }
    .padding(12)
    .frame(width: 340)
    .onReceive(NotificationCenter.default.publisher(for: UserDefaults.didChangeNotification)
      .receive(on: DispatchQueue.main)) { _ in // KimiTokenCache 等后台写入也触发该通知，须跳主线程再写 @State
      appearance = WidgetSettings.appearanceMode
    }
  }

  /// 行区：swiss 时合并为整面（03 稿连续白面 + 细线分隔——行间距归零、容器铺 paper 底，
  /// 细线由 PopoverRowStyle swiss 分支的行底 1px 黑规则线提供）；其他主题保持 10pt 行距
  private var rowsSection: some View {
    VStack(alignment: .leading, spacing: appearance == .swiss ? 0 : 10) {
      ForEach(PlatformID.allCases, id: \.self) { id in
        if let card = state.store.cards[id] {
          UsageListRowView(card: card, appearance: appearance) // 行底样式见 PopoverRowStyle
        } else {
          placeholderRow(id)
        }
      }
    }
    .background(appearance == .swiss ? SwissTheme.paper : .clear)
    .environment(\.colorScheme, rowScheme)
  }

  private func placeholderRow(_ id: PlatformID) -> some View {
    HStack {
      Text(fallbackName(id))
        .font(.system(size: 12, weight: .semibold))
      Spacer()
      Text("等待数据…")
        .font(.system(size: 10))
        .foregroundStyle(.secondary)
    }
  }

  /// 缺卡占位用的静态名（真实 displayName 以数据为准）
  private func fallbackName(_ id: PlatformID) -> String {
    switch id {
    case .minimax: "MiniMax"; case .kimi: "Kimi Code"; case .mimo: "小米 MiMo"; case .volcengine: "火山引擎"
    }
  }

  private var footer: some View {
    VStack(alignment: .leading, spacing: 6) {
      HStack(spacing: 10) {
        if let latest = state.store.cards.values.map(\.fetchedAt).max() {
          Text("更新于 \(Formatting.timeText(latest))")
            .font(.system(size: 9))
            .foregroundStyle(.secondary)
        } else {
          Text("尚未更新")
            .font(.system(size: 9))
            .foregroundStyle(.secondary)
        }
        Spacer()
        Toggle("显示浮窗", isOn: $widgetVisible)
          .toggleStyle(.checkbox)
          .font(.system(size: 10))
          .onChange(of: widgetVisible) { newValue in
            UserDefaults.standard.set(newValue, forKey: "widgetVisible")
            newValue ? widget.show() : widget.hide()
          }
        Button("刷新") {
          Task { await state.engine.poke() }
        }
        .font(.system(size: 10))
        Button("设置…") {
          openSettings() // macOS 14 环境动作，打开 Settings scene
          NSApp.activate(ignoringOtherApps: true) // LSUIElement 无 Dock 图标，主动置前设置窗口
        }
        .font(.system(size: 10))
      }
      HStack(spacing: 8) {
        Toggle("浮窗点击穿透", isOn: $widgetClickThrough)
          .toggleStyle(.checkbox)
          .font(.system(size: 10))
          .onChange(of: widgetClickThrough) { newValue in
            UserDefaults.standard.set(newValue, forKey: "widgetClickThrough")
          }
          .onReceive(NotificationCenter.default.publisher(for: UserDefaults.didChangeNotification)
      .receive(on: DispatchQueue.main)) { _ in // KimiTokenCache 等后台写入也触发该通知，须跳主线程再写 @State
            // 浮窗右键菜单写同一键：外部变更时回读刷新，避免开关显示陈旧值
            widgetClickThrough = UserDefaults.standard.bool(forKey: "widgetClickThrough")
          }
        Text("开启后浮窗不响应鼠标，在此恢复")
          .font(.system(size: 9))
          .foregroundStyle(.secondary)
        Spacer()
      }
    }
  }
}
