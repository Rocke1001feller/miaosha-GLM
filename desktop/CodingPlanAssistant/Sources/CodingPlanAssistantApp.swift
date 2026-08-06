import SwiftUI

@main
struct CodingPlanAssistantApp: App {
  @StateObject private var state: AppState
  @StateObject private var widget: WidgetController

  init() {
    let state = AppState()
    _state = StateObject(wrappedValue: state)
    let widget = WidgetController(state: state)
    _widget = StateObject(wrappedValue: widget)
    // 启动时按 "widgetVisible" 偏好恢复浮窗
    if UserDefaults.standard.bool(forKey: "widgetVisible") {
      widget.show()
    }
  }

  var body: some Scene {
    MenuBarExtra {
      PopoverRootView(state: state, widget: widget)
    } label: {
      MenuBarLabel(card: state.store.cards[state.store.selectedPlatform])
    }
    .menuBarExtraStyle(.window)

    Settings {
      SettingsView(state: state, widget: widget)
    }
  }
}
