import Foundation

/// 外观模式：neoBrutal（默认，设计稿 04 新粗野主义）/ swiss（设计稿 03 瑞士编辑排版）/
/// system（磨砂 + 三档色，v1 现状）。
/// rawValue 为持久化存储键（UserDefaults "appearanceMode"），既有值须保持稳定；
/// 已删除主题的旧存档值按未知 rawValue 回退默认（见 WidgetSettings.appearanceMode）。
public enum AppearanceMode: String, Sendable, CaseIterable {
  case system, swiss, neoBrutal
}
