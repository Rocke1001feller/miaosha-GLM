import Foundation

/// 移植自 lib/usage/parsers.ts 的 parseKimi。
public enum KimiParser {
  /// 非法 JSON / 非对象 → nil；ratelimit 字段缺失 → 空数组（与 TS 空 bars 一致）。
  public static func windows(from data: Data) -> [UsageWindow]? {
    guard let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
    var out: [UsageWindow] = []
    if let h = root["ratelimitCode5h"] as? [String: Any], let ratio = h["ratio"] as? Double {
      out.append(UsageWindow(label: "频限明细（5h）", percent: ratio,
                             resetAt: isoDate(h["resetTime"] as? String)))
    }
    if let w = root["ratelimitCode7d"] as? [String: Any], let ratio = w["ratio"] as? Double {
      out.append(UsageWindow(label: "本周用量", percent: ratio,
                             resetAt: isoDate(w["resetTime"] as? String)))
    }
    return out
  }

  /// ISO8601 → Date；兼容带任意位小数秒（真实响应为纳秒）与不带小数的两种形式，失败 → nil。
  private static func isoDate(_ s: String?) -> Date? {
    guard let s else { return nil }
    let f = ISO8601DateFormatter()
    f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let d = f.date(from: s) { return d }
    f.formatOptions = [.withInternetDateTime]
    return f.date(from: s)
  }
}
