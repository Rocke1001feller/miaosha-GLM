import Foundation

/// 千分位格式（对应扩展 lib/usage/parsers.ts 的 fmtInt：`toLocaleString('en-US')`，
/// 默认最多 3 位小数）。非有限值（NaN/Inf）返回空串，与 TS 的 `isFinite` 分支一致。
public func fmtInt(_ v: Double) -> String {
  guard v.isFinite else { return "" }
  let f = NumberFormatter()
  f.locale = Locale(identifier: "en_US")
  f.numberStyle = .decimal
  f.maximumFractionDigits = 3
  f.minimumFractionDigits = 0
  return f.string(from: NSNumber(value: v)) ?? ""
}

/// AFP 计数格式：千分位、最多一位小数（对应 TS fmtAfp：
/// `toLocaleString('en-US', { maximumFractionDigits: 1 })`）。非有限值返回空串。
public func fmtAfp(_ v: Double) -> String {
  guard v.isFinite else { return "" }
  let f = NumberFormatter()
  f.locale = Locale(identifier: "en_US")
  f.numberStyle = .decimal
  f.maximumFractionDigits = 1
  f.minimumFractionDigits = 0
  return f.string(from: NSNumber(value: v)) ?? ""
}
