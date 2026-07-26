import Foundation

/// 移植自 lib/usage/parsers.ts 的 parseMinimax。
/// 顶层 `model_remains` 数组中取 `model_name == "general"` 的条目；
/// percent 字段是「已用」百分比（0-1 数字或 "4%" 字符串），经 toRatio 后直接作为已用比例。
public enum MiniMaxParser {
  /// 解析失败（非法 JSON / 非对象）或无 general 模型 → nil。
  public static func windows(from data: Data) -> [UsageWindow]? {
    guard let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
    let list = root["model_remains"] as? [[String: Any]] ?? []
    guard let general = list.first(where: { $0["model_name"] as? String == "general" }) else { return nil }
    var out: [UsageWindow] = []
    if let p = toRatio(general["current_interval_used_percent"]) {
      out.append(UsageWindow(label: "5h 限额", percent: p, resetAt: msEpochDate(general["end_time"])))
    }
    if let p = toRatio(general["current_weekly_used_percent"]) {
      out.append(UsageWindow(label: "周限额", percent: p, resetAt: msEpochDate(general["weekly_end_time"])))
    }
    return out
  }

  /// TS `!= null` 才产出 bar；值经 toRatio 归一为 0-1：
  /// 有限数字原样返回，"4%" 风格字符串 → /100，其他 → 0。
  private static func toRatio(_ v: Any?) -> Double? {
    guard let v, !(v is NSNull) else { return nil }
    if let n = v as? Double { return n.isFinite ? n : 0 }
    if let s = v as? String {
      let range = NSRange(s.startIndex..., in: s)
      guard let m = Self.percentRegex.firstMatch(in: s, range: range),
            let r = Range(m.range(at: 1), in: s) else { return 0 }
      return (Double(s[r]) ?? 0) / 100
    }
    return 0
  }

  private static let percentRegex = try! NSRegularExpression(pattern: #"([\d.]+)\s*%"#)

  /// 毫秒 epoch（>0 才有效）→ Date。
  private static func msEpochDate(_ v: Any?) -> Date? {
    guard let ms = v as? Double, ms > 0 else { return nil }
    return Date(timeIntervalSince1970: ms / 1000)
  }
}
