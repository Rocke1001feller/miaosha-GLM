import Testing
import Foundation
import SQLite3
@testable import UsageCore

private let SQLITE_TRANSIENT = unsafeBitCast(-1, to: sqlite3_destructor_type.self)

@Suite("ChromeCookieReader 解密链")
struct ChromeCookieReaderTests {
  @Test func pbkdf2派生key长度与已知向量() {
    // 自洽向量：python3 hashlib.pbkdf2_hmac('sha1', b'test-password', b'saltysalt', 1003, 16)
    let key = ChromeCookieReader.deriveKey(password: "test-password")
    #expect(key.count == 16)
    #expect(key.hex == "c0ffe4c25f07f62bfc6ab011d9efa54e")
  }

  @Test func v10加密解密往返() throws {
    let key = ChromeCookieReader.deriveKey(password: "test-password")
    let plaintext = Data("session-value".utf8)
    let encrypted = try ChromeCookieReader.testEncrypt(plaintext, key: key) // 测试专用辅助
    #expect(encrypted.prefix(3) == Data("v10".utf8))
    let decrypted = try ChromeCookieReader.decryptV10(encrypted, key: key)
    #expect(decrypted == plaintext)
  }

  @Test func chromium130起跳过32字节host绑定前缀() throws {
    let key = ChromeCookieReader.deriveKey(password: "k")
    let value = Data("real-cookie-value".utf8)
    // 前缀含非可打印字节 → 触发 ≥130 跳过逻辑
    let prefixed = Data(repeating: 0x01, count: 32) + value
    let encrypted = try ChromeCookieReader.testEncrypt(prefixed, key: key)
    #expect(try ChromeCookieReader.decryptV10(encrypted, key: key) == value)
  }

  @Test func 长可打印明文不误判host前缀() throws {
    let key = ChromeCookieReader.deriveKey(password: "k")
    // >32 字节且前 32 字节全部可打印 → 不得跳过
    let value = Data(String(repeating: "a", count: 64).utf8)
    let encrypted = try ChromeCookieReader.testEncrypt(value, key: key)
    #expect(try ChromeCookieReader.decryptV10(encrypted, key: key) == value)
  }

  @Test func 未知前缀拒绝解密() throws {
    let key = ChromeCookieReader.deriveKey(password: "k")
    #expect(throws: ChromeCookieReader.Failure.self) {
      try ChromeCookieReader.decryptV10(Data("v99abcdef".utf8), key: key)
    }
  }

  @Test func 端到端读库解密_Profile扫描_后缀匹配_同名取长() throws {
    let key = ChromeCookieReader.deriveKey(password: "pw")
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }

    // Default/Network/Cookies（现代布局）
    try makeCookieDB(at: root.appendingPathComponent("Default/Network/Cookies"), rows: [
      (host: ".minimaxi.com", name: "sid",
       blob: ChromeCookieReader.testEncrypt(Data(repeating: 0x02, count: 32) + Data("s".utf8), key: key)),
      (host: ".minimaxi.com", name: "csrfToken",
       blob: ChromeCookieReader.testEncrypt(Data("t0ken".utf8), key: key)),
      (host: ".other.com", name: "nope",
       blob: ChromeCookieReader.testEncrypt(Data("x".utf8), key: key)),
    ])
    // Profile 1/Cookies（旧布局）：子域后缀命中 + 同名 sid 密文更长（64B > Default 的 48B）→ 覆盖
    try makeCookieDB(at: root.appendingPathComponent("Profile 1/Cookies"), rows: [
      (host: "www.minimaxi.com", name: "sid",
       blob: ChromeCookieReader.testEncrypt(Data(repeating: 0x03, count: 32) + Data("longer-session-value".utf8), key: key)),
    ])
    // 非 Profile 目录不参与扫描
    try makeCookieDB(at: root.appendingPathComponent("Snapshots/Cookies"), rows: [
      (host: ".minimaxi.com", name: "ghost",
       blob: ChromeCookieReader.testEncrypt(Data("g".utf8), key: key)),
    ])

    let cookies = try ChromeCookieReader.cookies(forDomains: [".minimaxi.com"],
                                                 profileRoot: root, password: "pw")
    #expect(cookies == ["sid": "longer-session-value", "csrfToken": "t0ken"])
  }

  @Test func 无法解密的条目跳过不影响其他条目() throws {
    let key = ChromeCookieReader.deriveKey(password: "pw")
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    defer { try? FileManager.default.removeItem(at: root) }
    try makeCookieDB(at: root.appendingPathComponent("Default/Network/Cookies"), rows: [
      (host: ".minimaxi.com", name: "badPrefix", blob: Data("raw-not-encrypted".utf8)),
      (host: ".minimaxi.com", name: "truncated", blob: Data("v10xy".utf8)), // 非块对齐
      (host: ".minimaxi.com", name: "good",
       blob: ChromeCookieReader.testEncrypt(Data("ok-value".utf8), key: key)),
    ])
    let cookies = try ChromeCookieReader.cookies(forDomains: [".minimaxi.com"],
                                                 profileRoot: root, password: "pw")
    #expect(cookies == ["good": "ok-value"])
  }

  @Test func 数据库不存在时抛错() {
    let root = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    #expect(throws: ChromeCookieReader.Failure.self) {
      try ChromeCookieReader.cookies(forDomains: [".minimaxi.com"], profileRoot: root, password: "pw")
    }
  }

  /// 建最小 cookies 表并插入行（host_key/name/encrypted_value 三列即够读取方使用）。
  private func makeCookieDB(at url: URL, rows: [(host: String, name: String, blob: Data)]) throws {
    try FileManager.default.createDirectory(at: url.deletingLastPathComponent(),
                                            withIntermediateDirectories: true)
    var db: OpaquePointer?
    try #require(sqlite3_open(url.path, &db) == SQLITE_OK)
    defer { sqlite3_close(db) }
    try #require(sqlite3_exec(db, "CREATE TABLE cookies (host_key TEXT, name TEXT, encrypted_value BLOB)",
                              nil, nil, nil) == SQLITE_OK)
    var stmt: OpaquePointer?
    try #require(sqlite3_prepare_v2(
      db, "INSERT INTO cookies (host_key, name, encrypted_value) VALUES (?, ?, ?)", -1, &stmt, nil) == SQLITE_OK)
    defer { sqlite3_finalize(stmt) }
    for row in rows {
      sqlite3_reset(stmt)
      sqlite3_bind_text(stmt, 1, row.host, -1, SQLITE_TRANSIENT)
      sqlite3_bind_text(stmt, 2, row.name, -1, SQLITE_TRANSIENT)
      _ = row.blob.withUnsafeBytes { ptr in
        sqlite3_bind_blob(stmt, 3, ptr.baseAddress, Int32(row.blob.count), SQLITE_TRANSIENT)
      }
      try #require(sqlite3_step(stmt) == SQLITE_DONE)
    }
  }
}

extension Data {
  fileprivate var hex: String { map { String(format: "%02x", $0) }.joined() }
}
