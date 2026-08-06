import Foundation

/// 从 Chrome localStorage 的 LevelDB 直读 kimi.com access_token（Kimi 原生通道凭证来源）。
///
/// 已知脆弱性：本实现依赖 Chrome 当前的 localStorage 存储格式（LevelDB + raw-snappy
/// 压缩数据块）；Chrome 一旦更改存储格式或压缩策略，本通道即失效（届时 Kimi 卡回落
/// needs_login 引导）。后续迭代考虑内嵌 WKWebView 读取，见 README「已知限制」。
///
/// 文件布局（探针实证，与主仓 .tmp/leveldb_probe.py 语义一致）：
/// - `.log`：未压缩顺序写入记录（WriteBatch：key + varint 值长 + value），原始字节直接查。
/// - `.ldb`：SSTable，数据块连续存放，每块 = raw-snappy 负载 + 5 字节 trailer
///   （1B 类型 + 4B crc）。块行走：p 处尝试 snappy 解码，成功则块内查找、
///   前进 consumed+5；失败 p += 1。
/// - 目标 key 含 "kimi.com\x00\x01access_token"：\x00\x01 前缀锚定键名恰为
///   access_token（排除 anonymous_access_token 干扰键），value 首字节
///   \x01 = UTF-8 / \x00 = UTF-16LE。
/// - 同一 key 可能多版本：按文件 mtime 升序（同 mtime 按文件名升序 tie-break）、
///   文件内顺序扫描，取最后命中。
///
/// v1 固定 Default profile；后续迭代支持 "Profile *"。
public enum LevelDBScanner {
  /// localStorage LevelDB 目录（Default profile）。
  public static var defaultDirectory: URL {
    FileManager.default.homeDirectoryForCurrentUser
      .appendingPathComponent("Library/Application Support/Google/Chrome/Default/Local Storage/leveldb")
  }

  /// 扫描目标字节序列：origin 片段 + \x00\x01 + 键名（锚定键名恰为 access_token）。
  static let keyPattern: [UInt8] = Array("kimi.com".utf8) + [0x00, 0x01] + Array("access_token".utf8)

  /// 主入口：扫描 dir 下全部 .log/.ldb，返回最后命中的 access_token；无命中 → nil。
  public static func scanKimiAccessToken(in dir: URL) -> String? {
    let fm = FileManager.default
    guard let entries = try? fm.contentsOfDirectory(atPath: dir.path) else { return nil }
    var files: [(url: URL, mtime: Date)] = []
    for entry in entries where entry.hasSuffix(".log") || entry.hasSuffix(".ldb") {
      let url = dir.appendingPathComponent(entry)
      let mtime = (try? fm.attributesOfItem(atPath: url.path))?[.modificationDate] as? Date ?? .distantPast
      files.append((url, mtime))
    }
    // mtime 升序、同 mtime 按文件名升序（LevelDB 编号越大越新，后扫者命中胜出）；
    // Swift sort 对相等元素顺序不稳定，并列时必须显式 tie-break 保证结果确定。
    files.sort { ($0.mtime, $0.url.lastPathComponent) < ($1.mtime, $1.url.lastPathComponent) }
    var lastHit: String?
    for file in files {
      guard let data = try? Data(contentsOf: file.url) else { continue }
      let hit = file.url.pathExtension == "log" ? scanRaw([UInt8](data)) : scanSSTable(data)
      if let hit { lastHit = hit }
    }
    return lastHit
  }

  /// .log：原始字节直接查找 key，命中后解析 value；同一文件多次命中取最后。
  /// WriteBatch 布局（key 后跟 varint 值长再跟 value）与直接前缀布局均兼容。
  static func scanRaw(_ bytes: [UInt8]) -> String? {
    var lastHit: String?
    var from = 0
    while let q = find(pattern: Self.keyPattern, in: bytes, from: from) {
      if let token = extractToken(in: bytes, afterKey: q + Self.keyPattern.count) {
        lastHit = token
      }
      from = q + 1
    }
    return lastHit
  }

  /// .ldb：块行走（语义与探针一致）：p 处尝试 snappy 解码，成功则块内查找、
  /// p += consumed + 5（块 trailer），失败 p += 1。
  static func scanSSTable(_ data: Data) -> String? {
    var lastHit: String?
    var p = 0
    while p < data.count - 12 {
      if let (output, consumed) = try? SnappyDecoder.decode(data, from: p) {
        if let hit = scanRaw([UInt8](output)) { lastHit = hit }
        p += consumed + 5
      } else {
        p += 1
      }
    }
    return lastHit
  }

  /// key 之后的 value 解析：先试 SSTable 直接布局（首字节即 \x01/\x00 前缀），
  /// 再试 WriteBatch 布局（varint 值长 + 前缀 + payload，要求 payload 长度恰好吻合以锚定）。
  static func extractToken(in bytes: [UInt8], afterKey q: Int) -> String? {
    if let direct = decodeValue(in: bytes, at: q, expectedPayloadLength: nil) { return direct }
    guard let (len, q2) = readVarint(bytes, at: q), len > 1, len <= (1 << 20) else { return nil }
    return decodeValue(in: bytes, at: q2, expectedPayloadLength: len - 1)
  }

  /// 解析 localStorage value：\x01 前缀 UTF-8 / \x00 前缀 UTF-16LE。
  /// expectedPayloadLength 非空时要求 token 字节数恰好等于该值（WriteBatch 值长校验）。
  static func decodeValue(in bytes: [UInt8], at p: Int, expectedPayloadLength: Int?) -> String? {
    guard p < bytes.count else { return nil }
    switch bytes[p] {
    case 0x01:
      var end = p + 1
      while end < bytes.count, isTokenByte(bytes[end]) { end += 1 }
      let count = end - (p + 1)
      guard count > 0 else { return nil }
      if let expectedPayloadLength, count != expectedPayloadLength { return nil }
      return String(decoding: bytes[(p + 1) ..< end], as: UTF8.self)
    case 0x00:
      var units: [UInt16] = []
      var i = p + 1
      while i + 1 < bytes.count, isTokenByte(bytes[i]), bytes[i + 1] == 0 {
        units.append(UInt16(bytes[i])); i += 2
      }
      guard !units.isEmpty else { return nil }
      if let expectedPayloadLength, units.count * 2 != expectedPayloadLength { return nil }
      return String(utf16CodeUnits: units, count: units.count)
    default:
      return nil
    }
  }

  /// token 字符集：可打印 ASCII（JWT 等 Bearer token 均为其内）。
  static func isTokenByte(_ b: UInt8) -> Bool { b >= 0x21 && b <= 0x7E }

  /// 朴素子串查找，返回 pattern 在 bytes[start...] 中首次出现的下标。
  static func find(pattern: [UInt8], in bytes: [UInt8], from start: Int) -> Int? {
    guard !pattern.isEmpty, start <= bytes.count - pattern.count else { return nil }
    for i in start ... (bytes.count - pattern.count) where bytes[i] == pattern[0] {
      var ok = true
      for j in 1 ..< pattern.count where bytes[i + j] != pattern[j] { ok = false; break }
      if ok { return i }
    }
    return nil
  }

  /// varint 读取（WriteBatch 值长用）；防溢出：shift 超 28 即放弃。
  static func readVarint(_ bytes: [UInt8], at p: Int) -> (value: Int, next: Int)? {
    var result = 0
    var shift = 0
    var i = p
    while i < bytes.count {
      let b = bytes[i]; i += 1
      result |= Int(b & 0x7F) << shift
      if b & 0x80 == 0 { return (result, i) }
      shift += 7
      if shift > 28 { return nil }
    }
    return nil
  }
}
