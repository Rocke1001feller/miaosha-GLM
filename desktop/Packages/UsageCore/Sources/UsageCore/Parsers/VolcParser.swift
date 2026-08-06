import Foundation

/// 移植自 lib/usage/parsers.ts 的 parseVolc。
public enum VolcParser {
  /// afp 为 GetAgentPlanAFPUsage 响应；coding 为 Coding Plan 状态响应（可缺省，缺省视同未订阅）。
  public static func windows(afp: Data, coding: Data?)
    -> (windows: [UsageWindow], planName: String, note: String?)
  {
    let root = try? JSONSerialization.jsonObject(with: afp) as? [String: Any]
    let result = root?["Result"] as? [String: Any]

    // TS: `Agent Plan ${首字母大写(planType)}`，无 PlanType → "Agent Plan"
    let planType = result?["PlanType"] as? String ?? ""
    let planName = planType.isEmpty
      ? "Agent Plan"
      : "Agent Plan \(planType.prefix(1).uppercased())\(planType.dropFirst())"

    var out: [UsageWindow] = []
    let sections: [(String, Any?)] = [
      ("近5小时", result?["AFPFiveHour"] as Any),
      ("近一周", result?["AFPWeekly"] as Any),
      ("近一月", result?["AFPMonthly"] as Any),
    ]
    for (label, raw) in sections {
      guard let s = raw as? [String: Any],
            let quota = s["Quota"] as? Double, quota > 0 else { continue }
      let used = s["Used"] as? Double ?? 0
      out.append(UsageWindow(
        label: label,
        percent: used / quota,
        usedText: "\(fmtAfp(used)) / \(fmtAfp(quota))",
        resetAt: msEpochDate(s["ResetTime"])
      ))
    }

    // TS: codingStatus == null | 'Reclaimed' | 'Released' → 已回收；其余状态原样透出
    let codingRoot = coding.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
    let status = (codingRoot?["Result"] as? [String: Any])?["Status"] as? String
    let note: String?
    switch status {
    case nil, "Reclaimed", "Released":
      note = "Coding Plan 未订阅（已回收）"
    case let s?:
      note = "Coding Plan \(s)"
    }
    return (out, planName: planName, note: note)
  }

  /// 毫秒 epoch（>0 才有效）→ Date。
  private static func msEpochDate(_ v: Any?) -> Date? {
    guard let ms = v as? Double, ms > 0 else { return nil }
    return Date(timeIntervalSince1970: ms / 1000)
  }
}
