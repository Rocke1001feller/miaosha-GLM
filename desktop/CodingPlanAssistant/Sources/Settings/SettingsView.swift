import SwiftUI
import ServiceManagement
import UsageCore
import UsageUI

/// 设置页：桥配对（令牌/端口/重新生成）、登录项（SMAppService.mainApp）、浮窗偏好。
/// 浮窗分区与浮窗右键菜单、浮层 footer 共用同一批 UserDefaults 键：
/// 本页写入 → WidgetController 的 defaults 观察器即时应用到面板；
/// 菜单/浮层写入 → onReceive 回读刷新本页显示（T8 同款双向同步模式）。
struct SettingsView: View {
  @ObservedObject var state: AppState
  let widget: WidgetController

  @State private var token: String
  @State private var alwaysOnTop = WidgetSettings.alwaysOnTop
  @State private var opacity = WidgetSettings.opacity
  @State private var clickThrough = WidgetSettings.clickThrough
  @State private var appearanceMode = WidgetSettings.appearanceMode
  /// 登录项状态快照（register/unregister 后刷新，驱动 requiresApproval 提示）
  @State private var loginItemStatus = SMAppService.mainApp.status
  @State private var loginItemError: String?

  init(state: AppState, widget: WidgetController) {
    self.state = state
    self.widget = widget
    _token = State(initialValue: BridgeToken.loadOrCreate())
  }

  var body: some View {
    Form {
      bridgeSection
      generalSection
      appearanceSection
      widgetSection
    }
    .formStyle(.grouped)
    .frame(width: 440)
    .onReceive(NotificationCenter.default.publisher(for: UserDefaults.didChangeNotification)
      .receive(on: DispatchQueue.main)) { _ in // KimiTokenCache 等后台写入也触发该通知，须跳主线程再写 @State
      // 右键菜单/浮层 footer 写同一批键：外部变更时回读，避免本页显示陈旧值
      alwaysOnTop = WidgetSettings.alwaysOnTop
      opacity = WidgetSettings.opacity
      clickThrough = WidgetSettings.clickThrough
      appearanceMode = WidgetSettings.appearanceMode
    }
  }

  // MARK: - 桥配对

  private var bridgeSection: some View {
    Section("桥配对") {
      LabeledContent("令牌") {
        HStack(spacing: 8) {
          Text(token)
            .font(.system(size: 11, design: .monospaced))
            .lineLimit(1)
            .truncationMode(.middle)
            .textSelection(.enabled)
          Button("复制") {
            NSPasteboard.general.clearContents()
            NSPasteboard.general.setString(token, forType: .string)
          }
        }
      }
      LabeledContent("端口", value: "\(state.bridge.boundPort)")
      Text("粘贴到扩展选项页 Coding Plan Assistant 桥配对")
        .font(.footnote)
        .foregroundStyle(.secondary)
      HStack(spacing: 8) {
        Button("重新生成") {
          token = state.regenerateBridgeToken()
        }
        Text("重新生成后扩展侧需更新令牌")
          .font(.footnote)
          .foregroundStyle(.secondary)
      }
    }
  }

  // MARK: - 通用

  /// get 读状态快照、set 执行注册/注销并以实际 status 回读——失败时开关自动回弹，不产生状态回写循环
  private var loginItemBinding: Binding<Bool> {
    Binding(
      get: { loginItemStatus == .enabled },
      set: { newValue in
        do {
          if newValue {
            try SMAppService.mainApp.register()
          } else {
            try SMAppService.mainApp.unregister()
          }
          loginItemError = nil
        } catch {
          loginItemError = error.localizedDescription
        }
        loginItemStatus = SMAppService.mainApp.status
      }
    )
  }

  private var generalSection: some View {
    Section("通用") {
      Toggle("登录时启动", isOn: loginItemBinding)
      if loginItemStatus == .requiresApproval {
        Text("需在 系统设置 → 通用 → 登录项与扩展 中允许 Coding Plan Assistant")
          .font(.footnote)
          .foregroundStyle(.secondary)
      }
      if let loginItemError {
        Text("登录项设置失败：\(loginItemError)")
          .font(.footnote)
          .foregroundStyle(.red)
      }
    }
  }

  // MARK: - 外观

  private var appearanceSection: some View {
    Section("外观") {
      Picker("配色", selection: $appearanceMode) {
        Text("新粗野").tag(AppearanceMode.neoBrutal)
        Text("瑞士排版").tag(AppearanceMode.swiss)
        Text("系统").tag(AppearanceMode.system)
      }
      .pickerStyle(.menu)
      .onChange(of: appearanceMode) { newValue in
        WidgetSettings.appearanceMode = newValue
      }
      Text("新粗野：平台撞色 + 粗黑边硬影；瑞士排版：白底黑字超大数字；系统：磨砂 + 用量三档色。菜单栏文本受 macOS 限制恒为单色。")
        .font(.footnote)
        .foregroundStyle(.secondary)
    }
  }

  // MARK: - 浮窗

  private var widgetSection: some View {
    Section("浮窗") {
      Toggle("置顶", isOn: $alwaysOnTop)
        .onChange(of: alwaysOnTop) { newValue in
          WidgetSettings.alwaysOnTop = newValue
        }
      LabeledContent("透明度") {
        HStack(spacing: 8) {
          Slider(value: $opacity, in: 0.5 ... 1.0, step: 0.05)
            .onChange(of: opacity) { newValue in
              WidgetSettings.opacity = newValue
            }
          Text("\(Int((opacity * 100).rounded()))%")
            .font(.system(size: 11, design: .monospaced))
            .frame(width: 36, alignment: .trailing)
        }
      }
      Toggle("点击穿透", isOn: $clickThrough)
        .onChange(of: clickThrough) { newValue in
          WidgetSettings.clickThrough = newValue
        }
      Text("透明度只作用磨砂背景层；点击穿透开启后浮窗不响应鼠标，可在此或菜单栏浮层 footer 关闭")
        .font(.footnote)
        .foregroundStyle(.secondary)
    }
  }
}
