import CoreGraphics

/// 浮窗几何与位置持久化策略（纯函数，供 FloatingPanel/WidgetController 使用，便于单测）。
public enum WidgetGeometry {
  /// 浮窗显示模式（卡片 / 悬浮球）
  public enum Mode {
    case card, orb
  }

  /// 顶边锚定 resize：返回视觉顶边（maxY）不变、尺寸为 size 的新 frame
  /// （模板 float_widget.swift 664-673；收缩为球时 origin.y 会下移 卡片高-球高）
  public static func topAnchoredFrame(from frame: CGRect, to size: CGSize) -> CGRect {
    CGRect(x: frame.minX, y: frame.maxY - size.height,
           width: size.width, height: size.height)
  }

  /// 位置持久化守卫：仅卡片模式允许把 frame.origin 写入存档。
  /// orb 态 origin.y 相对卡片顶边下移（卡片高-球高），若此时写档，面板按卡片尺寸重建后
  /// 顶边上移，反复 hide/show 会逐次叠加漂移直至顶入菜单栏。
  public static func shouldPersistOrigin(mode: Mode) -> Bool {
    mode == .card
  }

  /// 每主题造型圆角（WidgetRootView clipShape 用；AppKit 容器裁剪档见 containerCornerRadius）：
  /// system 保持 v1 卡 14/球 24；
  /// swiss 卡 0/球 40（03 稿全直角，唯一例外是正圆 orb——80×80 下 radius 40 即正圆语义）；
  /// neoBrutal 卡 0/球 40（04 稿 .float-card 无 border-radius 全直角，.orb border-radius 50% 正圆）。
  public static func cornerRadius(mode: Mode, appearance: AppearanceMode) -> CGFloat {
    switch appearance {
    case .swiss, .neoBrutal: return mode == .card ? 0 : 40
    case .system: return mode == .card ? 14 : 24
    }
  }

  /// 面板磨砂层 alpha：仅 system 走透明度滑杆；其余主题底色由 SwiftUI 层（纸面/撞色块）
  /// 提供，磨砂层隐藏为 0，避免双层材质叠加发灰。
  public static func panelBlurAlpha(appearance: AppearanceMode, opacity: Double) -> Double {
    appearance == .system ? opacity : 0
  }

  /// 面板系统软影：仅 neoBrutal 关闭——04 稿投影为 6px 实色硬块（SwiftUI 层垫纯黑偏移块
  /// 实现），系统软影会与硬影叠加；其余主题保持 hasShadow。
  public static func panelHasShadow(appearance: AppearanceMode) -> Bool {
    appearance != .neoBrutal
  }

  /// AppKit 容器层（WidgetContainerView masksToBounds）裁剪圆角：与 cornerRadius 同档，
  /// 唯 neoBrutal 恒 0——硬影垫块在 SwiftUI 层向右下偏移 6px，容器若按 orb 正圆（半径 40）
  /// 裁剪会把伸出圆外的影块裁掉；该主题的正圆/直角造型由 SwiftUI clipShape 承担。
  public static func containerCornerRadius(mode: Mode, appearance: AppearanceMode) -> CGFloat {
    appearance == .neoBrutal ? 0 : cornerRadius(mode: mode, appearance: appearance)
  }
}
