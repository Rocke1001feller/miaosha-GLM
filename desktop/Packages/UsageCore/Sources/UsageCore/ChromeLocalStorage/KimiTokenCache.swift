import Foundation

/// Kimi access_token 的 UserDefaults 缓存：记录 leveldb 目录 max-mtime 与上次扫描结局，
/// mtime 未变直接回上次结局（命中返回缓存 token，落空返回 nil）；变了才重扫并回写。
public enum KimiTokenCache {
  private static let tokenKey = "kimi.localStorageAccessToken"
  private static let mtimeKey = "kimi.localStorageLevelDBMaxMtime"

  /// 取 token：目录 max-mtime 与上次扫描一致直接回上次结局；否则重扫并回写。
  /// scanner 可注入便于测试（生产为 LevelDBScanner.scanKimiAccessToken）。
  public static func token(forceRescan: Bool = false,
                           defaults: UserDefaults = .standard,
                           directory: URL = LevelDBScanner.defaultDirectory,
                           scanner: (URL) -> String? = LevelDBScanner.scanKimiAccessToken(in:)) -> String? {
    let current = maxMtime(in: directory)
    // 目录 max-mtime 未变 ⇒ 目录内容未变，重扫不可能得到不同结局——401 后的强制重扫
    // 同理（forceRescan 参数仅为协议兼容保留，语义上已由 mtime 校验覆盖）：命中回缓存
    // token，落空回 nil。未登录/token 失效态下不再每个引擎 tick 付一次全目录冷扫。
    if let current,
       let lastScanMtime = defaults.object(forKey: mtimeKey) as? TimeInterval,
       lastScanMtime == current {
      return defaults.string(forKey: tokenKey)
    }
    let scanned = scanner(directory)
    // 每次扫描（命中或落空）都回写 lastScanMtime，作为「该目录状态已扫过」的判据
    if let scanned {
      defaults.set(scanned, forKey: tokenKey)
    } else {
      defaults.removeObject(forKey: tokenKey)
    }
    if let current { defaults.set(current, forKey: mtimeKey) }
    else { defaults.removeObject(forKey: mtimeKey) }
    return scanned
  }

  /// 目录内 .log/.ldb 的最大 mtime（epoch 秒）；目录缺失或无目标文件 → nil。
  static func maxMtime(in dir: URL) -> TimeInterval? {
    let fm = FileManager.default
    guard let entries = try? fm.contentsOfDirectory(atPath: dir.path) else { return nil }
    var result: TimeInterval?
    for entry in entries where entry.hasSuffix(".log") || entry.hasSuffix(".ldb") {
      let path = dir.appendingPathComponent(entry).path
      guard let mtime = (try? fm.attributesOfItem(atPath: path))?[.modificationDate] as? Date else { continue }
      let t = mtime.timeIntervalSince1970
      result = result.map { Swift.max($0, t) } ?? t
    }
    return result
  }
}
