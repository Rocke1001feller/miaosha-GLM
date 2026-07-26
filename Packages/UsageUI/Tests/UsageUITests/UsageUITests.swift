import Testing
import Foundation
import AppKit // NSColor（NeoBrutalTheme 平台色稿值断言）
import UsageCore
@testable import UsageUI

@Suite("Formatting")
struct FormattingTests {
  @Test func pct一位小数_上限截断100() {
    #expect(Formatting.pct(0.210) == "21.0%")
    #expect(Formatting.pct(0.04) == "4.0%")
    #expect(Formatting.pct(0) == "0.0%")
    #expect(Formatting.pct(1) == "100.0%")
    #expect(Formatting.pct(1.5) == "100.0%")
  }

  @Test func resetText分档() {
    let now = Date(timeIntervalSince1970: 1_000_000)
    #expect(Formatting.resetText(resetAt: now, now: now) == "即将重置")
    #expect(Formatting.resetText(resetAt: now.addingTimeInterval(-60), now: now) == "即将重置")
    #expect(Formatting.resetText(resetAt: now.addingTimeInterval(59), now: now) == "1 分钟后重置")
    #expect(Formatting.resetText(resetAt: now.addingTimeInterval(42 * 60), now: now) == "42 分钟后重置")
    #expect(Formatting.resetText(resetAt: now.addingTimeInterval(3 * 3600), now: now) == "3 小时后重置")
    #expect(Formatting.resetText(resetAt: now.addingTimeInterval(23 * 3600), now: now) == "23 小时后重置")
    #expect(Formatting.resetText(resetAt: now.addingTimeInterval(5 * 86400 + 20 * 3600), now: now) == "5 天 20 小时后重置")
  }
}

@Suite("StatusPalette")
struct StatusPaletteTests {
  @Test func 档位边界() {
    #expect(StatusPalette.tier(forUsedPercent: 0) == .normal)
    #expect(StatusPalette.tier(forUsedPercent: 0.49) == .normal)
    #expect(StatusPalette.tier(forUsedPercent: 0.5) == .warning)
    #expect(StatusPalette.tier(forUsedPercent: 0.89) == .warning)
    #expect(StatusPalette.tier(forUsedPercent: 0.9) == .critical)
    #expect(StatusPalette.tier(forUsedPercent: 1.0) == .critical)
  }
}

@Suite("Carousel")
struct CarouselTests {
  private let items = ["minimax", "kimi", "mimo", "volcengine"]

  @Test func next末尾回绕到首个() {
    #expect(Carousel.next("kimi", in: items) == "mimo")
    #expect(Carousel.next("volcengine", in: items) == "minimax")
  }

  @Test func previous首个回绕到末尾() {
    #expect(Carousel.previous("mimo", in: items) == "kimi")
    #expect(Carousel.previous("minimax", in: items) == "volcengine")
  }

  @Test func 未知元素与空列表回退() {
    #expect(Carousel.next("unknown", in: items) == "minimax")
    #expect(Carousel.previous("unknown", in: items) == "minimax")
    let empty: [String] = []
    #expect(Carousel.next("kimi", in: empty) == "kimi")
  }
}

@Suite("WidgetGeometry")
struct WidgetGeometryTests {
  private let cardSize = CGSize(width: 280, height: 170)
  private let orbSize = CGSize(width: 80, height: 80)

  @Test func 顶边锚定_收缩展开往返还原() {
    let frame = CGRect(x: 100, y: 500, width: 280, height: 170)
    let shrunk = WidgetGeometry.topAnchoredFrame(from: frame, to: orbSize)
    #expect(shrunk.maxY == frame.maxY)
    #expect(shrunk.origin.y == frame.maxY - 80)
    #expect(shrunk.size == orbSize)
    let expanded = WidgetGeometry.topAnchoredFrame(from: shrunk, to: cardSize)
    #expect(expanded == frame)
  }

  @Test func 位置写档守卫_仅卡片模式() {
    #expect(WidgetGeometry.shouldPersistOrigin(mode: .card))
    #expect(!WidgetGeometry.shouldPersistOrigin(mode: .orb))
  }

  /// 回归：orb 态 origin（顶边锚定下移 90）若写档，卡片按 280×170 重建后顶边 +90，
  /// 反复 hide/show 逐次叠加直至顶入菜单栏。守卫后存档恒定，顶边不漂移。
  @Test func hideShow循环_卡片顶边不漂移() {
    var savedOrigin = CGPoint(x: 100, y: 500) // 卡片态写档
    var mode = WidgetGeometry.Mode.card
    var tops: [CGFloat] = []
    for _ in 0..<5 {
      // show：按卡片尺寸从存档重建
      var frame = CGRect(origin: savedOrigin, size: cardSize)
      tops.append(frame.maxY)
      // 空闲收缩为 orb（顶边锚定），didMove 触发写档尝试
      mode = .orb
      frame = WidgetGeometry.topAnchoredFrame(from: frame, to: orbSize)
      if WidgetGeometry.shouldPersistOrigin(mode: mode) { savedOrigin = frame.origin }
      // hide（不展开直接关），进入下一轮
    }
    #expect(Set(tops).count == 1)
  }

  /// 每主题圆角档：system 保持 v1 现状 卡 14/球 24；swiss 卡 0/球 40（03 稿全直角，orb 为正圆）；
  /// neoBrutal 卡 0/球 40（04 稿 .float-card 无 border-radius 全直角，.orb border-radius 50% 正圆）。
  @Test func 每主题圆角档() {
    #expect(WidgetGeometry.cornerRadius(mode: .card, appearance: .system) == 14)
    #expect(WidgetGeometry.cornerRadius(mode: .orb, appearance: .system) == 24)
    #expect(WidgetGeometry.cornerRadius(mode: .card, appearance: .swiss) == 0)
    #expect(WidgetGeometry.cornerRadius(mode: .orb, appearance: .swiss) == 40)
    #expect(WidgetGeometry.cornerRadius(mode: .card, appearance: .neoBrutal) == 0)
    #expect(WidgetGeometry.cornerRadius(mode: .orb, appearance: .neoBrutal) == 40)
  }

  /// 面板磨砂 alpha：仅 system 走透明度滑杆，其余主题（纸面/撞色块自带底色）一律 0
  @Test func 面板磨砂alpha_仅system走滑杆() {
    #expect(WidgetGeometry.panelBlurAlpha(appearance: .system, opacity: 0.65) == 0.65)
    #expect(WidgetGeometry.panelBlurAlpha(appearance: .swiss, opacity: 0.65) == 0)
    #expect(WidgetGeometry.panelBlurAlpha(appearance: .neoBrutal, opacity: 0.65) == 0)
  }

  /// 面板系统软影：仅 neoBrutal 关闭（04 稿投影为 6px 实色硬块，SwiftUI 层垫黑色块实现，
  /// 系统软影会与硬影叠加）；其余主题保持 hasShadow
  @Test func 面板软影_仅neoBrutal关闭() {
    #expect(WidgetGeometry.panelHasShadow(appearance: .system))
    #expect(WidgetGeometry.panelHasShadow(appearance: .swiss))
    #expect(!WidgetGeometry.panelHasShadow(appearance: .neoBrutal))
  }

  /// AppKit 容器裁剪：neoBrutal 恒 0（orb 正圆若裁剪容器会把右下 6px 硬影垫块裁掉，
  /// 造型交给 SwiftUI clipShape）；其余主题与 cornerRadius 同档
  @Test func 容器裁剪_neoBrutal恒0() {
    #expect(WidgetGeometry.containerCornerRadius(mode: .orb, appearance: .neoBrutal) == 0)
    #expect(WidgetGeometry.containerCornerRadius(mode: .card, appearance: .neoBrutal) == 0)
    #expect(WidgetGeometry.containerCornerRadius(mode: .orb, appearance: .swiss) == 40)
    #expect(WidgetGeometry.containerCornerRadius(mode: .card, appearance: .system) == 14)
    #expect(WidgetGeometry.containerCornerRadius(mode: .orb, appearance: .system) == 24)
  }
}

@Suite("PlatformPalette")
struct PlatformPaletteTests {
  /// 四平台主色互异（新粗野撞色块面与瑞士色块/色条同源取色）
  @Test func 四平台主色互异() {
    let colors = PlatformID.allCases.map { PlatformPalette.progressColor(for: $0) }
    #expect(colors.count == 4)
    #expect(Set(colors).count == 4) // Color 需 Hashable
  }
}

@Suite("NeoBrutalTheme")
struct NeoBrutalThemeTests {
  /// 04 稿 :root 常量：--bw 3px 粗边框、--shadow 6px 6px 0 硬投影、--shadow-sm 4px 4px 0
  @Test func 边框与硬投影常量同稿() {
    #expect(NeoBrutalTheme.borderWidth == 3)
    #expect(NeoBrutalTheme.barBorderWidth == 2) // 稿 .bar border 2px
    #expect(NeoBrutalTheme.shadowOffset == 6)
    #expect(NeoBrutalTheme.shadowSmall == 4)
  }

  /// 04 稿平台撞色（--kimi #5b6ee0 / --mimo #f07e1d / --minimax #189a74 / --volc #d94f3d）：
  /// 与 PlatformPalette.progressColor 同值复用
  @Test func 平台色同稿值() {
    let expected: [PlatformID: (Double, Double, Double)] = [
      .kimi: (0x5b, 0x6e, 0xe0), .mimo: (0xf0, 0x7e, 0x1d),
      .minimax: (0x18, 0x9a, 0x74), .volcengine: (0xd9, 0x4f, 0x3d),
    ]
    for (id, rgb) in expected {
      let ns = NSColor(NeoBrutalTheme.platformColor(id)).usingColorSpace(.sRGB)
      #expect(ns != nil)
      if let ns {
        #expect(abs(ns.redComponent * 255 - rgb.0) < 1)
        #expect(abs(ns.greenComponent * 255 - rgb.1) < 1)
        #expect(abs(ns.blueComponent * 255 - rgb.2) < 1)
      }
    }
  }
}
