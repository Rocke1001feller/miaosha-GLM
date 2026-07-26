import Foundation

/// 移植自 lib/usage/parsers.ts 的 parseMimo。
public enum MimoParser {
  /// usage 解析窗口；detail 提供套餐名与有效期（可缺省）。宽松解析，永不抛错。
  public static func windows(usage: Data, detail: Data?)
    -> (windows: [UsageWindow], planName: String?, note: String?)
  {
    let root = try? JSONSerialization.jsonObject(with: usage) as? [String: Any]
    let data = root?["data"] as? [String: Any] ?? [:]
    let usageItems = (data["usage"] as? [String: Any])?["items"] as? [[String: Any]] ?? []
    let monthItems = (data["monthUsage"] as? [String: Any])?["items"] as? [[String: Any]] ?? []
    // TS: find(name === 'plan_total_token') ?? items[0]
    let planTotal = usageItems.first(where: { $0["name"] as? String == "plan_total_token" })
      ?? usageItems.first
    let monthTotal = monthItems.first

    var out: [UsageWindow] = []
    if let p = planTotal?["percent"] as? Double {
      out.append(UsageWindow(
        label: "套餐用量", percent: p,
        usedText: "\(fmtInt(planTotal?["used"] as? Double ?? .nan)) / \(fmtInt(planTotal?["limit"] as? Double ?? .nan))"
      ))
    }
    if let p = monthTotal?["percent"] as? Double {
      out.append(UsageWindow(
        label: "月用量", percent: p,
        usedText: "\(fmtInt(monthTotal?["used"] as? Double ?? .nan)) / \(fmtInt(monthTotal?["limit"] as? Double ?? .nan))"
      ))
    }

    let dRoot = detail.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
    let dData = dRoot?["data"] as? [String: Any]
    let planName = (dData?["planName"] as? String).flatMap { $0.isEmpty ? nil : $0 }
    let end = (dData?["currentPeriodEnd"] as? String).flatMap { $0.isEmpty ? nil : $0 }
    let note = planName.flatMap { p in end.map { "\(p) 套餐 · 有效期至 \($0)" } }
    return (out, planName: planName, note: note)
  }
}
