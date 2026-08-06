import Foundation

/// 读取指定域 Chrome cookie 的抽象（生产实现为 ChromeCookieReader，测试注入 stub）。
public protocol CookieReading: Sendable {
  func cookies(forDomains domains: [String]) throws -> [String: String]
}

public struct LiveCookieReader: CookieReading {
  public init() {}
  public func cookies(forDomains domains: [String]) throws -> [String: String] {
    try ChromeCookieReader.cookies(forDomains: domains)
  }
}

/// Kimi access_token 来源抽象（生产实现经 KimiTokenCache 读 Chrome localStorage
/// LevelDB，测试注入 stub）。forceRescan 标记 401 后的强制重取意图；目录 max-mtime
/// 未变时 KimiTokenCache 仍直接回上次扫描结局（重扫不可能得到不同结果）。
public protocol KimiTokenReading: Sendable {
  func token(forceRescan: Bool) -> String?
}

public struct LiveKimiTokenReader: KimiTokenReading {
  public init() {}
  public func token(forceRescan: Bool) -> String? {
    KimiTokenCache.token(forceRescan: forceRescan)
  }
}

/// 原生兑底 provider：桥离线时直读 Chrome 凭证调平台接口（MiniMax/MiMo/Volc 走
/// cookie；Kimi 走 localStorage LevelDB 扫描出的 access_token）。
/// 端点与判定逻辑与扩展 lib/usage/providers.ts 同构；原生无标签页自愈能力，
/// 会话失效直接落 needsLogin 引导用户打开控制台。
/// 单平台失败不影响其他平台；网络/解析等瞬时错误该平台缺席快照（引擎静默保留旧卡）。
public final class NativeCookieProvider: UsageProvider {
  public let id = "native-cookie"
  private let cookieReader: any CookieReading
  private let kimiTokenReader: any KimiTokenReading
  private let http: any HTTPSending

  public init(cookieReader: any CookieReading = LiveCookieReader(),
              http: any HTTPSending = HTTPClient(),
              kimiTokenReader: any KimiTokenReading = LiveKimiTokenReader()) {
    self.cookieReader = cookieReader
    self.http = http
    self.kimiTokenReader = kimiTokenReader
  }

  private static let minimaxURL = URL(string: "https://www.minimaxi.com/backend/account/token_plan/remains_percent")!
  private static let mimoUsageURL = URL(string: "https://platform.xiaomimimo.com/api/v1/tokenPlan/usage")!
  private static let mimoDetailURL = URL(string: "https://platform.xiaomimimo.com/api/v1/tokenPlan/detail")!
  private static let volcAfpURL = URL(string: "https://console.volcengine.com/api/top/ark/cn-beijing/2024-01-01/GetAgentPlanAFPUsage")!
  private static let volcCodingURL = URL(string: "https://console.volcengine.com/api/top/ark/cn-beijing/2024-01-01/GetCodingPlanUsage")!
  private static let kimiStatsURL = URL(string: "https://www.kimi.com/apiv2/kimi.gateway.membership.v2.MembershipService/GetSubscriptionStats")!

  private static let displayNames: [PlatformID: String] = [
    .minimax: "MiniMax", .kimi: "Kimi Code", .mimo: "小米 MiMo", .volcengine: "火山引擎",
  ]
  private static let consoleUrls: [PlatformID: String] = [
    .minimax: "https://platform.minimaxi.com/console/usage",
    .kimi: "https://www.kimi.com/code/console",
    .mimo: "https://platform.xiaomimimo.com/console/plan-manage",
    .volcengine: "https://console.volcengine.com/ark/region:cn-beijing/subscription/agent-plan",
  ]

  /// 按 MiniMax→MiMo→Volc→Kimi 顺序尽力取数；单平台失败不影响其他平台。
  public func fetchSnapshot() async -> [PlatformID: PlatformUsage] {
    var out: [PlatformID: PlatformUsage] = [:]
    if let card = await fetchMiniMax() { out[.minimax] = card }
    if let card = await fetchMiMo() { out[.mimo] = card }
    if let card = await fetchVolc() { out[.volcengine] = card }
    if let card = await fetchKimi() { out[.kimi] = card }
    return out
  }

  // MARK: - Kimi

  /// 与扩展 fetchKimi 同构：token 来自 localStorage LevelDB 缓存/扫描 →
  /// POST GetSubscriptionStats（Bearer、{} body）→ status 200 且 JSON 无 code 为成功。
  /// 401 → 强制重扫（绕过缓存）重试一次；仍失败落 needsLogin 引导打开控制台。
  /// 网络/解析等瞬时错误 → nil（缺席快照，与其他平台同策略）。
  private func fetchKimi() async -> PlatformUsage? {
    guard let token = kimiTokenReader.token(forceRescan: false) else {
      return card(.kimi, status: .needsLogin, error: "请用 Chrome 打开一次 Kimi 控制台")
    }
    var response: HTTPResponse
    do {
      response = try await postKimiStats(token: token)
    } catch {
      return nil // 网络层错误：缺席快照，保留旧卡
    }
    if response.status == 401 {
      // token 可能已过期：强制重扫换新 token 重试一次（与扩展 401 重捕获同模式）
      guard let fresh = kimiTokenReader.token(forceRescan: true) else {
        return card(.kimi, status: .needsLogin, error: "access_token 已过期，请打开一次 Kimi 控制台")
      }
      do {
        response = try await postKimiStats(token: fresh)
      } catch {
        return nil
      }
      if response.status == 401 {
        return card(.kimi, status: .needsLogin, error: "access_token 已过期，请打开一次 Kimi 控制台")
      }
    }
    let json = try? JSONSerialization.jsonObject(with: response.data) as? [String: Any]
    let code = json?["code"]
    // 成功判定与扩展一致：status 200 且 JSON 无 code 字段（null 视同缺失）
    guard response.status == 200, json != nil, code == nil || code is NSNull else {
      if Self.isAuthFailure(status: response.status, body: String(decoding: response.data, as: UTF8.self)) {
        return card(.kimi, status: .needsLogin, error: "HTTP \(response.status)")
      }
      return nil
    }
    guard let windows = KimiParser.windows(from: response.data) else { return nil }
    return card(.kimi, status: .ok, windows: windows)
  }

  private func postKimiStats(token: String) async throws -> HTTPResponse {
    try await http.postJSON(Self.kimiStatsURL,
                            headers: ["Authorization": "Bearer \(token)"],
                            body: Data("{}".utf8))
  }

  // MARK: - MiniMax

  private func fetchMiniMax() async -> PlatformUsage? {
    let jar: [String: String]
    do {
      jar = try cookieReader.cookies(forDomains: [".minimaxi.com"])
    } catch {
      return card(.minimax, status: .needsLogin, error: "读取 Chrome cookie 失败：\(error.localizedDescription)")
    }
    guard !jar.isEmpty else {
      return card(.minimax, status: .needsLogin, error: "未读取到 MiniMax 会话，请登录控制台后刷新")
    }
    let response: HTTPResponse
    do {
      response = try await http.get(Self.minimaxURL, headers: ["Cookie": Self.cookieHeader(jar)])
    } catch {
      return nil // 网络层错误：缺席快照，保留旧卡
    }
    let json = try? JSONSerialization.jsonObject(with: response.data) as? [String: Any]
    let statusCode = ((json?["base_resp"] as? [String: Any])?["status_code"] as? NSNumber)?.intValue
    guard response.status == 200, statusCode == 0 else {
      if Self.isAuthFailure(status: response.status, body: String(decoding: response.data, as: UTF8.self)) {
        return card(.minimax, status: .needsLogin, error: "HTTP \(response.status)")
      }
      return nil
    }
    // MiniMaxParser 无 general 返回 nil（既定接口分歧）：归一为空窗口 ok 卡，
    // 与扩展 parseMinimax 的 `bars: []` 语义对齐
    let windows = MiniMaxParser.windows(from: response.data) ?? []
    return card(.minimax, status: .ok, windows: windows)
  }

  // MARK: - MiMo

  private func fetchMiMo() async -> PlatformUsage? {
    let jar: [String: String]
    do {
      jar = try cookieReader.cookies(forDomains: [".xiaomimimo.com"])
    } catch {
      return card(.mimo, status: .needsLogin, error: "读取 Chrome cookie 失败：\(error.localizedDescription)")
    }
    guard !jar.isEmpty else {
      return card(.mimo, status: .needsLogin, error: "未读取到 MiMo 会话，请登录控制台后刷新")
    }
    let headers = ["Cookie": Self.cookieHeader(jar)]
    async let usageReq = http.get(Self.mimoUsageURL, headers: headers)
    async let detailReq = http.get(Self.mimoDetailURL, headers: headers)
    let usage: HTTPResponse
    let detail: HTTPResponse?
    do {
      usage = try await usageReq
      detail = try? await detailReq // detail 可缺省（仅提供套餐名/有效期）
    } catch {
      return nil
    }
    // 401：会话 cookie 已失效（扩展走标签页 SSO 自愈，原生无此路径 → 直接引导）
    if usage.status == 401 {
      return card(.mimo, status: .needsLogin, error: "会话已过期，请打开浏览器控制台")
    }
    let json = try? JSONSerialization.jsonObject(with: usage.data) as? [String: Any]
    let code = (json?["code"] as? NSNumber)?.intValue
    guard usage.status == 200, code == 0 else {
      if Self.isAuthFailure(status: usage.status, body: String(decoding: usage.data, as: UTF8.self)) {
        return card(.mimo, status: .needsLogin, error: "HTTP \(usage.status)")
      }
      return nil
    }
    let parsed = MimoParser.windows(usage: usage.data, detail: detail?.data)
    return card(.mimo, status: .ok, windows: parsed.windows,
                planName: parsed.planName, note: parsed.note)
  }

  // MARK: - Volc

  private func fetchVolc() async -> PlatformUsage? {
    let jar: [String: String]
    do {
      jar = try cookieReader.cookies(forDomains: [".volcengine.com"]) // 含 CHIPS 分区 digest
    } catch {
      return card(.volcengine, status: .needsLogin, error: "读取 Chrome cookie 失败：\(error.localizedDescription)")
    }
    guard !jar.isEmpty else {
      return card(.volcengine, status: .needsLogin, error: "未读取到火山引擎会话，请登录控制台后刷新")
    }
    var header = Self.cookieHeader(jar)
    // csrfToken 是会话级 cookie，缺失时合成 32hex 同时注入 Cookie 与 x-csrf-token
    // （火山双提交校验两端相等即放行，与扩展 fetchVolc 完全同构，2026-07-21 实证）
    let csrf = jar["csrfToken"] ?? Self.randomHex(16)
    if jar["csrfToken"] == nil { header += "; csrfToken=\(csrf)" }
    let headers = ["Cookie": header, "x-csrf-token": csrf]
    async let afpReq = http.postJSON(Self.volcAfpURL, headers: headers, body: Data("{}".utf8))
    async let codingReq = http.postJSON(Self.volcCodingURL, headers: headers, body: Data("{}".utf8))
    let afp: HTTPResponse
    let coding: HTTPResponse?
    do {
      afp = try await afpReq
      coding = try? await codingReq // coding 可缺省（缺省视同未订阅）
    } catch {
      return nil
    }
    let json = try? JSONSerialization.jsonObject(with: afp.data) as? [String: Any]
    let error = (json?["ResponseMetadata"] as? [String: Any])?["Error"] as? [String: Any]
    let code = error?["Code"] as? String
    guard afp.status == 200, error == nil else {
      // NotLogin = digest 会话凭证失效（合成 csrf 救不了鉴权层）→ needsLogin
      if code == "NotLogin"
          || Self.isAuthFailure(status: afp.status, body: String(decoding: afp.data, as: UTF8.self)) {
        return card(.volcengine, status: .needsLogin, error: code ?? "HTTP \(afp.status)")
      }
      return nil
    }
    let parsed = VolcParser.windows(afp: afp.data, coding: coding?.data)
    return card(.volcengine, status: .ok, windows: parsed.windows,
                planName: parsed.planName, note: parsed.note)
  }

  // MARK: - helpers

  private func card(_ platform: PlatformID, status: CardStatus, windows: [UsageWindow] = [],
                    planName: String? = nil, note: String? = nil, error: String? = nil) -> PlatformUsage {
    PlatformUsage(platform: platform,
                  displayName: Self.displayNames[platform] ?? platform.rawValue,
                  planName: planName, status: status, windows: windows, note: note,
                  errorMessage: error, consoleUrl: Self.consoleUrls[platform], fetchedAt: Date())
  }

  /// 与扩展 isAuthFailure 一致：401/403 或响应体含鉴权关键词。
  static func isAuthFailure(status: Int, body: String) -> Bool {
    if status == 401 || status == 403 { return true }
    return body.range(
      of: #"unauthenticated|notlogin|not logged in|登录凭证已过期|重新登录|授权不存在"#,
      options: [.regularExpression, .caseInsensitive]) != nil
  }

  /// name=value 拼接（按 name 排序使输出稳定）。
  static func cookieHeader(_ jar: [String: String]) -> String {
    jar.map { "\($0.key)=\($0.value)" }.sorted().joined(separator: "; ")
  }

  /// 32hex 合成 csrf（16 字节随机）。
  static func randomHex(_ bytes: Int) -> String {
    (0 ..< bytes).map { _ in String(format: "%02x", UInt8.random(in: .min ... .max)) }.joined()
  }
}
