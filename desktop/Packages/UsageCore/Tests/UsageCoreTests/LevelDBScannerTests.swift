import Testing
import Foundation
@testable import UsageCore

@Suite("LevelDBScanner")
struct LevelDBScannerTests {
  private let token = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.dGVzdHNpZ25hdHVyZQ"

  // MARK: - 合成辅助（测试全合成，不触碰 Chrome 真实目录）

  /// 纯字面量 raw-snappy 编码（测试辅助，与 SnappyDecoder 语义互逆）。
  private func snappyEncode(_ payload: [UInt8]) -> [UInt8] {
    var out = varintBytes(payload.count)
    let l = payload.count
    if l <= 60 {
      out.append(UInt8((l - 1) << 2))
    } else {
      var v = l - 1
      var lenBytes: [UInt8] = []
      while v > 0 { lenBytes.append(UInt8(v & 0xFF)); v >>= 8 }
      out.append(UInt8((59 + lenBytes.count) << 2))
      out.append(contentsOf: lenBytes)
    }
    out.append(contentsOf: payload)
    return out
  }

  private func varintBytes(_ value: Int) -> [UInt8] {
    var v = value
    var out: [UInt8] = []
    while true {
      let b = v & 0x7F
      v >>= 7
      if v == 0 { out.append(UInt8(b)); break }
      out.append(UInt8(b | 0x80))
    }
    return out
  }

  /// kimi localStorage 记录 key：\x01 + origin + \x00\x01 + 键名。
  private func kimiKey(_ name: String = "access_token") -> [UInt8] {
    [0x01] + Array("https://www.kimi.com".utf8) + [0x00, 0x01] + Array(name.utf8)
  }

  private func utf8Value(_ token: String) -> [UInt8] { [0x01] + Array(token.utf8) }

  private func utf16Value(_ token: String) -> [UInt8] {
    [0x00] + token.unicodeScalars.flatMap { [UInt8($0.value & 0xFF), UInt8($0.value >> 8)] }
  }

  /// .ldb 文件字节：每块 = snappy 负载 + 5 字节 trailer（类型 + crc，内容不校验）。
  private func ldbFile(_ blocks: [[UInt8]]) -> [UInt8] {
    blocks.flatMap { snappyEncode($0) + [0, 0, 0, 0, 0] }
  }

  private func tempDir() throws -> URL {
    let url = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: url, withIntermediateDirectories: true)
    return url
  }

  private func writeFile(_ dir: URL, _ name: String, _ bytes: [UInt8], mtime: Date? = nil) throws {
    let url = dir.appendingPathComponent(name)
    try Data(bytes).write(to: url)
    if let mtime {
      try FileManager.default.setAttributes([.modificationDate: mtime], ofItemAtPath: url.path)
    }
  }

  // MARK: - .ldb 块行走

  @Test func ldb块中解出UTF8token() throws {
    let dir = try tempDir()
    try writeFile(dir, "000001.ldb", ldbFile([kimiKey() + utf8Value(token)]))
    #expect(LevelDBScanner.scanKimiAccessToken(in: dir) == token)
  }

  @Test func ldb块中解出UTF16token() throws {
    let dir = try tempDir()
    try writeFile(dir, "000001.ldb", ldbFile([kimiKey() + utf16Value(token)]))
    #expect(LevelDBScanner.scanKimiAccessToken(in: dir) == token)
  }

  @Test func 垃圾前缀后块行走仍能命中() throws {
    let dir = try tempDir()
    // 0xFF 垃圾：解码必然失败（badVarint/tooBig），逐字节滑到真实块起始
    let file = [UInt8](repeating: 0xFF, count: 7) + ldbFile([kimiKey() + utf8Value(token)])
    try writeFile(dir, "000001.ldb", file)
    #expect(LevelDBScanner.scanKimiAccessToken(in: dir) == token)
  }

  @Test func anonymous干扰键不误中() throws {
    let dir = try tempDir()
    let decoys = kimiKey("anonymous_access_token") + utf8Value("decoy-token-1234567890")
      + kimiKey("access_token_expiry") + utf8Value("decoy-expiry-1234567890")
    try writeFile(dir, "000001.ldb", ldbFile([decoys]))
    #expect(LevelDBScanner.scanKimiAccessToken(in: dir) == nil)
  }

  @Test func 同文件多块同key取最后命中() throws {
    let dir = try tempDir()
    let b1 = kimiKey() + utf8Value("token-old-1111111111")
    let b2 = kimiKey() + utf8Value("token-new-2222222222")
    try writeFile(dir, "000001.ldb", ldbFile([b1, b2]))
    #expect(LevelDBScanner.scanKimiAccessToken(in: dir) == "token-new-2222222222")
  }

  @Test func 跨文件按mtime升序取最后命中() throws {
    let dir = try tempDir()
    // 文件名序与 mtime 序相反：应以 mtime 为准（000001 更新 → 其 token 胜出）
    try writeFile(dir, "000002.ldb", ldbFile([kimiKey() + utf8Value("token-A-aaaaaaaaaa")]),
                  mtime: Date(timeIntervalSince1970: 1000))
    try writeFile(dir, "000001.ldb", ldbFile([kimiKey() + utf8Value("token-B-bbbbbbbbbb")]),
                  mtime: Date(timeIntervalSince1970: 2000))
    #expect(LevelDBScanner.scanKimiAccessToken(in: dir) == "token-B-bbbbbbbbbb")
  }

  @Test func 同mtime并列按文件名升序取最后命中() throws {
    let dir = try tempDir()
    // mtime 相同：文件名升序扫描（LevelDB 编号越大越新），000002 后扫、其 token 胜出
    let same = Date(timeIntervalSince1970: 1000)
    try writeFile(dir, "000002.ldb", ldbFile([kimiKey() + utf8Value("token-B-bbbbbbbbbb")]),
                  mtime: same)
    try writeFile(dir, "000001.ldb", ldbFile([kimiKey() + utf8Value("token-A-aaaaaaaaaa")]),
                  mtime: same)
    #expect(LevelDBScanner.scanKimiAccessToken(in: dir) == "token-B-bbbbbbbbbb")
  }

  // MARK: - .log 原始字节直查（WriteBatch：key + varint 值长 + value）

  @Test func log原始字节解出UTF8token() throws {
    let dir = try tempDir()
    let value = utf8Value(token)
    let log: [UInt8] = [0x01] + kimiKey() + varintBytes(value.count) + value
    try writeFile(dir, "000005.log", log)
    #expect(LevelDBScanner.scanKimiAccessToken(in: dir) == token)
  }

  @Test func log原始字节解出UTF16token() throws {
    let dir = try tempDir()
    let value = utf16Value(token)
    let log: [UInt8] = [0x01] + kimiKey() + varintBytes(value.count) + value
    try writeFile(dir, "000005.log", log)
    #expect(LevelDBScanner.scanKimiAccessToken(in: dir) == token)
  }

  // MARK: - 空结果

  @Test func 空目录与无记录返回nil() throws {
    let dir = try tempDir()
    #expect(LevelDBScanner.scanKimiAccessToken(in: dir) == nil)
    try writeFile(dir, "000001.ldb", ldbFile([[0x01, 0x02, 0x03, 0x04]]))
    #expect(LevelDBScanner.scanKimiAccessToken(in: dir) == nil)
    #expect(LevelDBScanner.scanKimiAccessToken(
      in: FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)) == nil)
  }
}
