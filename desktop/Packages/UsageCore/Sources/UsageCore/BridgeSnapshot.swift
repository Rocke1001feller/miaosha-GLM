import Foundation

/// 解码扩展 POST 的 UsageCache JSON（键为平台 id；fetchedAt/resetAt 为毫秒 epoch）。
public enum BridgeSnapshot {
  public enum DecodeError: Error { case notADictionary, entryNotObject }

  public static func decode(_ data: Data) throws -> [PlatformID: PlatformUsage] {
    guard let root = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
      throw DecodeError.notADictionary
    }
    var out: [PlatformID: PlatformUsage] = [:]
    for (key, value) in root {
      guard let id = PlatformID(rawValue: key) else { continue } // 未知平台忽略
      guard let obj = value as? [String: Any] else { throw DecodeError.entryNotObject }
      out[id] = try decodeCard(id: id, obj: obj)
    }
    return out
  }

  private static func decodeCard(id: PlatformID, obj: [String: Any]) throws -> PlatformUsage {
    let statusRaw = obj["status"] as? String ?? "error"
    let status: CardStatus = switch statusRaw {
    case "ok": .ok
    case "needs_login": .needsLogin
    case "stale": .stale
    default: .unavailable // "error" / "no_subscription" 等归并为 unavailable
    }
    let bars = (obj["bars"] as? [[String: Any]]) ?? []
    let windows = bars.map { b in
      UsageWindow(
        label: b["label"] as? String ?? "",
        percent: b["percent"] as? Double ?? 0,
        usedText: b["usedText"] as? String,
        resetAt: (b["resetAt"] as? Double).map { Date(timeIntervalSince1970: $0 / 1000) }
      )
    }
    let fetchedMs = (obj["fetchedAt"] as? Double) ?? 0
    return PlatformUsage(
      platform: id,
      displayName: obj["displayName"] as? String ?? id.rawValue,
      planName: obj["planName"] as? String,
      status: status,
      windows: windows,
      note: obj["note"] as? String,
      errorMessage: obj["errorMessage"] as? String,
      consoleUrl: obj["consoleUrl"] as? String,
      fetchedAt: Date(timeIntervalSince1970: fetchedMs / 1000)
    )
  }
}
