import Foundation

/// 桥鉴权 token：首启生成 UUID 落 UserDefaults（默认 suite，key "bridgeToken"），
/// 供 BridgeServer 校验、curl 调试（`defaults read <bundleId> bridgeToken`）与设置页展示。
public enum BridgeToken {
  public static let defaultsKey = "bridgeToken"

  public static func loadOrCreate(defaults: UserDefaults = .standard) -> String {
    if let existing = defaults.string(forKey: defaultsKey), !existing.isEmpty {
      return existing
    }
    let token = UUID().uuidString
    defaults.set(token, forKey: defaultsKey)
    return token
  }

  /// 强制写入新 UUID 并返回（设置页"重新生成"）：调用方负责重建 BridgeServer 使新令牌生效
  @discardableResult
  public static func regenerate(defaults: UserDefaults = .standard) -> String {
    let token = UUID().uuidString
    defaults.set(token, forKey: defaultsKey)
    return token
  }
}
