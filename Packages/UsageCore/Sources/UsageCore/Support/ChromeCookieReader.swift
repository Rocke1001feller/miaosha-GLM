import Foundation
import CommonCrypto
import SQLite3

/// 直读 Chrome cookie 并解密（原生兑底通道凭证来源）。
/// 链路与参考实现 claude_usage.py 123-186 行同构：
/// Keychain "Chrome Safe Storage"（见 KeychainHelper）→ PBKDF2-HMAC-SHA1
/// （salt=`saltysalt`, iter=1003, len=16）→ Cookies SQLite 先拷 tmp 再读
/// → `v10`/`v11` 前缀 AES-128-CBC（IV=16 空格）→ Chromium ≥130 跳过前 32 字节
/// host-binding 前缀（SHA256(host)，启发式：前 32 字节含非可打印字符即跳过）。
public enum ChromeCookieReader {
  public enum Failure: Error, Equatable {
    case cookieDatabaseNotFound
    case sqliteOpenFailed(path: String)
    case sqlitePrepareFailed(message: String)
    case unknownPrefix
    case malformedCiphertext
    case cryptFailed(status: Int32)
  }

  /// PBKDF2-HMAC-SHA1(password, salt="saltysalt", iter=1003) → 16 字节 AES key。
  public static func deriveKey(password: String) -> Data {
    var derived = Data(count: 16)
    let passwordData = Data(password.utf8)
    let saltData = Data("saltysalt".utf8)
    _ = derived.withUnsafeMutableBytes { derivedPtr in
      saltData.withUnsafeBytes { saltPtr in
        passwordData.withUnsafeBytes { passwordPtr in
          CCKeyDerivationPBKDF(
            CCPBKDFAlgorithm(kCCPBKDF2),
            passwordPtr.baseAddress?.assumingMemoryBound(to: CChar.self), passwordData.count,
            saltPtr.baseAddress?.assumingMemoryBound(to: UInt8.self), saltData.count,
            CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA1),
            1003,
            derivedPtr.baseAddress?.assumingMemoryBound(to: UInt8.self), 16)
        }
      }
    }
    return derived
  }

  /// 解密 `v10`/`v11` 密文（AES-128-CBC, IV=16 空格, PKCS7）；≥130 host 前缀按启发式剥离。
  /// CBC 密文必为整块且非空；非块对齐输入直接拒绝（CCCrypt 对此类输入会宽松放行出垃圾字节）。
  public static func decryptV10(_ encrypted: Data, key: Data) throws -> Data {
    let prefix = encrypted.prefix(3)
    guard prefix == Data("v10".utf8) || prefix == Data("v11".utf8) else {
      throw Failure.unknownPrefix
    }
    let payload = encrypted.dropFirst(3)
    guard !payload.isEmpty, payload.count % kCCBlockSizeAES128 == 0 else {
      throw Failure.malformedCiphertext
    }
    var plaintext = try crypt(CCOperation(kCCDecrypt), payload, key: key)
    if plaintext.count > 32, plaintext.prefix(32).contains(where: { $0 < 0x20 || $0 > 0x7e }) {
      plaintext = plaintext.dropFirst(32)
    }
    return plaintext
  }

  /// 测试专用辅助：按 Chrome 同构格式加密（"v10" 前缀 + AES-128-CBC/PKCS7），用于自洽向量。
  public static func testEncrypt(_ plaintext: Data, key: Data) throws -> Data {
    Data("v10".utf8) + (try crypt(CCOperation(kCCEncrypt), plaintext, key: key))
  }

  /// 主入口：Keychain 口令 → 派 key → 扫 Default + Profile * → 合并解密（name→value）。
  /// CHIPS 分区条目在同一张 cookies 表（host_key 相同），随查询自然收录。
  public static func cookies(forDomains domains: [String]) throws -> [String: String] {
    let password = try KeychainHelper.chromeSafeStoragePassword()
    let root = FileManager.default.homeDirectoryForCurrentUser
      .appendingPathComponent("Library/Application Support/Google/Chrome")
    return try cookies(forDomains: domains, profileRoot: root, password: password)
  }

  /// 可注入 profileRoot/password 的入口（测试用自洽向量，不碰真实 Keychain/Chrome 目录）。
  static func cookies(forDomains domains: [String], profileRoot: URL, password: String) throws -> [String: String] {
    let dbs = cookieDatabaseURLs(profileRoot: profileRoot)
    guard !dbs.isEmpty else { throw Failure.cookieDatabaseNotFound }
    let key = deriveKey(password: password)
    var merged: [String: Data] = [:]
    for db in dbs {
      for (name, enc) in try readEncrypted(dbAt: db, forDomains: domains) {
        if merged[name].map({ enc.count > $0.count }) ?? true { merged[name] = enc }
      }
    }
    // 单条解密失败（陈旧/截断条目）只跳过该条，不影响整罐
    var out: [String: String] = [:]
    for (name, enc) in merged {
      if let plain = try? decryptV10(enc, key: key) {
        out[name] = String(decoding: plain, as: UTF8.self)
      }
    }
    return out
  }

  /// 扫描 Default 与 Profile * 下的 Cookies 库（优先现代 Network/ 布局，退回旧布局）。
  static func cookieDatabaseURLs(profileRoot: URL) -> [URL] {
    let fm = FileManager.default
    guard let entries = try? fm.contentsOfDirectory(atPath: profileRoot.path) else { return [] }
    var urls: [URL] = []
    for entry in entries.sorted() where entry == "Default" || entry.hasPrefix("Profile ") {
      let profile = profileRoot.appendingPathComponent(entry)
      let modern = profile.appendingPathComponent("Network/Cookies")
      let legacy = profile.appendingPathComponent("Cookies")
      if fm.fileExists(atPath: modern.path) { urls.append(modern) }
      else if fm.fileExists(atPath: legacy.path) { urls.append(legacy) }
    }
    return urls
  }

  /// 拷 tmp 后读 cookies 表（含 -wal/-shm 伴生文件，避免 Chrome 持锁或 WAL 未 checkpoint 丢数据）。
  /// 返回 name→密文；同名条目（多 host_key/分区）保留密文较长者（与参考实现一致）。
  static func readEncrypted(dbAt url: URL, forDomains domains: [String]) throws -> [String: Data] {
    let fm = FileManager.default
    let tmp = fm.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try fm.createDirectory(at: tmp, withIntermediateDirectories: true)
    defer { try? fm.removeItem(at: tmp) }
    let copy = tmp.appendingPathComponent("Cookies")
    try fm.copyItem(at: url, to: copy)
    for suffix in ["-wal", "-shm"] {
      let side = URL(fileURLWithPath: url.path + suffix)
      if fm.fileExists(atPath: side.path) {
        try? fm.copyItem(at: side, to: URL(fileURLWithPath: copy.path + suffix))
      }
    }

    var db: OpaquePointer?
    guard sqlite3_open(copy.path, &db) == SQLITE_OK else {
      sqlite3_close(db)
      throw Failure.sqliteOpenFailed(path: url.path)
    }
    defer { sqlite3_close(db) }

    let clause = domains.map { _ in "(host_key = ? OR host_key LIKE ? ESCAPE '\\')" }
      .joined(separator: " OR ")
    var stmt: OpaquePointer?
    guard sqlite3_prepare_v2(db, "SELECT name, encrypted_value FROM cookies WHERE \(clause)",
                             -1, &stmt, nil) == SQLITE_OK else {
      throw Failure.sqlitePrepareFailed(message: String(cString: sqlite3_errmsg(db)))
    }
    defer { sqlite3_finalize(stmt) }
    var bindIndex: Int32 = 1
    let transient = unsafeBitCast(-1, to: sqlite3_destructor_type.self)
    for domain in domains {
      sqlite3_bind_text(stmt, bindIndex, domain, -1, transient); bindIndex += 1
      // 前导点域（".minimaxi.com"）额外后缀匹配子域 host_key（"www.minimaxi.com" 等）
      let escaped = domain
        .replacingOccurrences(of: "\\", with: "\\\\")
        .replacingOccurrences(of: "%", with: "\\%")
        .replacingOccurrences(of: "_", with: "\\_")
      sqlite3_bind_text(stmt, bindIndex, "%" + escaped, -1, transient); bindIndex += 1
    }

    var out: [String: Data] = [:]
    while sqlite3_step(stmt) == SQLITE_ROW {
      guard let namePtr = sqlite3_column_text(stmt, 0) else { continue }
      let name = String(cString: namePtr)
      let blobSize = sqlite3_column_bytes(stmt, 1)
      guard blobSize > 0, let blobPtr = sqlite3_column_blob(stmt, 1) else { continue }
      let enc = Data(bytes: blobPtr, count: Int(blobSize))
      if out[name].map({ enc.count > $0.count }) ?? true { out[name] = enc }
    }
    return out
  }

  /// AES-128-CBC + PKCS7，IV 为 16 个空格（0x20，Chromium 约定）。
  private static func crypt(_ operation: CCOperation, _ input: Data, key: Data) throws -> Data {
    var output = Data(count: input.count + kCCBlockSizeAES128)
    var outputLength = 0
    let capacity = output.count
    var iv = Data(repeating: 0x20, count: kCCBlockSizeAES128)
    let status = output.withUnsafeMutableBytes { outPtr in
      input.withUnsafeBytes { inPtr in
        key.withUnsafeBytes { keyPtr in
          iv.withUnsafeMutableBytes { ivPtr in
            CCCrypt(operation, CCAlgorithm(kCCAlgorithmAES), CCOptions(kCCOptionPKCS7Padding),
                    keyPtr.baseAddress, key.count, ivPtr.baseAddress,
                    inPtr.baseAddress, input.count,
                    outPtr.baseAddress, capacity, &outputLength)
          }
        }
      }
    }
    guard status == kCCSuccess else { throw Failure.cryptFailed(status: status) }
    output.count = outputLength
    return output
  }
}
