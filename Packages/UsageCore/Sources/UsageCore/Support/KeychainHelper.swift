import Foundation

/// 读取 macOS Keychain 中 Chrome 的 cookie 加密口令（service "Chrome Safe Storage"）。
/// 经 `/usr/bin/security` 子进程获取（与参考实现 claude_usage.py 同路径）；
/// 首次调用会触发 Keychain 授权弹窗，属用户交互项。
/// 故成功读取后缓存口令于进程内（app 生命周期），后续平台/后续 tick 复用——
/// 弹窗降为每次 app 运行最多 1 次（用户点"始终允许"后 0 次）；
/// 读取失败不缓存，下次 tick 重试（保持可恢复）。
public enum KeychainHelper {
  public enum Failure: Error, Equatable {
    case securityFailed(status: Int32, message: String)
    case emptyPassword
  }

  public static let chromeService = "Chrome Safe Storage"

  /// 进程内口令缓存（NSLock 保护，跨线程安全）；测试经其注入计数 stub。
  static let cache = PasswordCache(provider: { try readFromSecurity() })

  /// 读口令：命中缓存直接返回；未命中走 security 子进程，成功才缓存。
  public static func chromeSafeStoragePassword() throws -> String {
    try cache.password()
  }

  /// 测试专用：清缓存并恢复真实读取器（每个缓存用例 setup/teardown 调用）。
  static func resetCacheForTesting() {
    cache.reset(provider: { try readFromSecurity() })
  }

  /// `security find-generic-password -s "Chrome Safe Storage" -w`，输出口令原文。
  static func readFromSecurity() throws -> String {
    let process = Process()
    let stdout = Pipe()
    let stderr = Pipe()
    process.executableURL = URL(fileURLWithPath: "/usr/bin/security")
    process.arguments = ["find-generic-password", "-s", chromeService, "-w"]
    process.standardOutput = stdout
    process.standardError = stderr
    try process.run()
    process.waitUntilExit()
    guard process.terminationStatus == 0 else {
      let message = String(decoding: stderr.fileHandleForReading.readDataToEndOfFile(), as: UTF8.self)
        .trimmingCharacters(in: .whitespacesAndNewlines)
      throw Failure.securityFailed(status: process.terminationStatus, message: message)
    }
    let password = String(decoding: stdout.fileHandleForReading.readDataToEndOfFile(), as: UTF8.self)
      .trimmingCharacters(in: .whitespacesAndNewlines)
    guard !password.isEmpty else { throw Failure.emptyPassword }
    return password
  }
}

/// 口令缓存：NSLock 保护的可变状态（@unchecked Sendable 由锁保证）。
/// provider 可注入，便于测试统计真实读取次数而不碰 Keychain。
final class PasswordCache: @unchecked Sendable {
  private let lock = NSLock()
  private var cached: String?
  private var provider: () throws -> String

  init(provider: @escaping () throws -> String) {
    self.provider = provider
  }

  /// 命中缓存直接返回；未命中调 provider，成功才缓存（失败留给下次重试）。
  func password() throws -> String {
    lock.lock()
    defer { lock.unlock() }
    if let cached { return cached }
    let value = try provider()
    cached = value
    return value
  }

  /// 清缓存并替换 provider（测试注入/复原共用）。
  func reset(provider: @escaping () throws -> String) {
    lock.lock()
    defer { lock.unlock() }
    cached = nil
    self.provider = provider
  }
}
