import Testing
import Foundation
@testable import UsageCore

@Suite("KimiTokenCache")
struct KimiTokenCacheTests {
  private func makeDefaults() -> UserDefaults {
    UserDefaults(suiteName: "KimiTokenCacheTests.\(UUID().uuidString)")!
  }

  private func tempDirWithLog(mtime: Date) throws -> URL {
    let dir = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    let fm = FileManager.default
    try fm.createDirectory(at: dir, withIntermediateDirectories: true)
    let file = dir.appendingPathComponent("000001.log")
    try Data([0x01]).write(to: file)
    try fm.setAttributes([.modificationDate: mtime], ofItemAtPath: file.path)
    return dir
  }

  private func setMtime(_ dir: URL, _ mtime: Date) throws {
    try FileManager.default.setAttributes(
      [.modificationDate: mtime],
      ofItemAtPath: dir.appendingPathComponent("000001.log").path)
  }

  @Test func mtime未变命中缓存不重扫() throws {
    let dir = try tempDirWithLog(mtime: Date(timeIntervalSince1970: 1000))
    let defaults = makeDefaults()
    var scans = 0
    let scanner: (URL) -> String? = { _ in scans += 1; return "tok" }
    let t1 = KimiTokenCache.token(defaults: defaults, directory: dir, scanner: scanner)
    let t2 = KimiTokenCache.token(defaults: defaults, directory: dir, scanner: scanner)
    #expect(t1 == "tok")
    #expect(t2 == "tok")
    #expect(scans == 1)
  }

  @Test func mtime变化触发重扫() throws {
    let dir = try tempDirWithLog(mtime: Date(timeIntervalSince1970: 1000))
    let defaults = makeDefaults()
    var scans = 0
    let scanner: (URL) -> String? = { _ in scans += 1; return "tok\(scans)" }
    _ = KimiTokenCache.token(defaults: defaults, directory: dir, scanner: scanner)
    try setMtime(dir, Date(timeIntervalSince1970: 2000))
    let t2 = KimiTokenCache.token(defaults: defaults, directory: dir, scanner: scanner)
    #expect(t2 == "tok2")
    #expect(scans == 2)
  }

  @Test func 强制重扫目录未变不重复扫描() throws {
    let dir = try tempDirWithLog(mtime: Date(timeIntervalSince1970: 1000))
    let defaults = makeDefaults()
    var scans = 0
    let scanner: (URL) -> String? = { _ in scans += 1; return "tok" }
    _ = KimiTokenCache.token(defaults: defaults, directory: dir, scanner: scanner)
    // 目录 max-mtime 未变：强制重扫也不可能得到不同结局，不再扫描
    _ = KimiTokenCache.token(forceRescan: true, defaults: defaults, directory: dir, scanner: scanner)
    #expect(scans == 1)
    // mtime 变化后强制重扫仍然生效
    try setMtime(dir, Date(timeIntervalSince1970: 2000))
    _ = KimiTokenCache.token(forceRescan: true, defaults: defaults, directory: dir, scanner: scanner)
    #expect(scans == 2)
  }

  @Test func 扫描落空也记录mtime不再重扫() throws {
    let dir = try tempDirWithLog(mtime: Date(timeIntervalSince1970: 1000))
    let defaults = makeDefaults()
    var scans = 0
    let scanner: (URL) -> String? = { _ in scans += 1; return nil }
    // 落空（未登录/token 失效）同样缓存 mtime：连续两个 tick 只扫一次
    #expect(KimiTokenCache.token(defaults: defaults, directory: dir, scanner: scanner) == nil)
    #expect(KimiTokenCache.token(defaults: defaults, directory: dir, scanner: scanner) == nil)
    #expect(scans == 1)
  }

  @Test func 落空后mtime变化再次重扫() throws {
    let dir = try tempDirWithLog(mtime: Date(timeIntervalSince1970: 1000))
    let defaults = makeDefaults()
    var scans = 0
    var result: String?
    let scanner: (URL) -> String? = { _ in scans += 1; return result }
    #expect(KimiTokenCache.token(defaults: defaults, directory: dir, scanner: scanner) == nil)
    // mtime 变化（用户登录写入 localStorage）→ 重新扫描并能拿到新 token
    try setMtime(dir, Date(timeIntervalSince1970: 2000))
    result = "tok"
    #expect(KimiTokenCache.token(defaults: defaults, directory: dir, scanner: scanner) == "tok")
    #expect(scans == 2)
  }

  @Test func 扫描落空清除缓存token() throws {
    let dir = try tempDirWithLog(mtime: Date(timeIntervalSince1970: 1000))
    let defaults = makeDefaults()
    var result: String? = "tok"
    let scanner: (URL) -> String? = { _ in result }
    #expect(KimiTokenCache.token(defaults: defaults, directory: dir, scanner: scanner) == "tok")
    // mtime 变化 + 扫描落空 → 返回 nil 且缓存被清
    try setMtime(dir, Date(timeIntervalSince1970: 2000))
    result = nil
    #expect(KimiTokenCache.token(defaults: defaults, directory: dir, scanner: scanner) == nil)
    // mtime 再变、scanner 恢复 → 正常重新扫出（验证旧缓存未残留）
    try setMtime(dir, Date(timeIntervalSince1970: 3000))
    result = "tok2"
    #expect(KimiTokenCache.token(defaults: defaults, directory: dir, scanner: scanner) == "tok2")
  }
}
