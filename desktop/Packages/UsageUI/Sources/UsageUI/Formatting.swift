import Foundation

/// 展示格式化：移植自扩展 entrypoints/popup/components/UsageView.svelte 的 pct/resetText/timeText。
public enum Formatting {
  /// `"21.0%"`：一位小数，上限截断到 100%（对应 TS `(Math.min(1, p) * 100).toFixed(1) + '%'`）。
  public static func pct(_ p: Double) -> String {
    String(format: "%.1f%%", min(1.0, p) * 100)
  }

  /// resetText 规则：≤0 → 即将重置；≥1天 → `d 天 h 小时后重置`；≥1时 → `h 小时后重置`；
  /// 否则 `m 分钟后重置`（分钟数下限 1，与 TS `Math.max(1, floor(ms/60000))` 一致）。
  public static func resetText(resetAt: Date, now: Date = Date()) -> String {
    let ms = resetAt.timeIntervalSince(now) * 1000
    if ms <= 0 { return "即将重置" }
    let h = Int(ms / 3_600_000)
    let d = h / 24
    if d >= 1 { return "\(d) 天 \(h % 24) 小时后重置" }
    if h >= 1 { return "\(h) 小时后重置" }
    return "\(max(1, Int(ms / 60_000))) 分钟后重置"
  }

  /// `"HH:mm:ss"` 本地墙钟（对应 TS timeText）。
  public static func timeText(_ date: Date) -> String {
    hmsFormatter.string(from: date)
  }

  private static let hmsFormatter: DateFormatter = {
    let f = DateFormatter()
    f.dateFormat = "HH:mm:ss"
    return f
  }()
}
