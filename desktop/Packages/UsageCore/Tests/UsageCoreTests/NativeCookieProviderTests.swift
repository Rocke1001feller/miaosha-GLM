import Testing
import Foundation
@testable import UsageCore

private struct StubError: Error { let msg: String }

private struct StubCookieReader: CookieReading {
  var jars: [String: [String: String]] = [:]
  var failingDomains: Set<String> = []
  func cookies(forDomains domains: [String]) throws -> [String: String] {
    for d in domains {
      if failingDomains.contains(d) { throw StubError(msg: "keychain denied") }
      if let jar = jars[d] { return jar }
    }
    return [:]
  }
}

/// Kimi token 来源 stub：normal 为常规返回值；forced 外层非 nil 时覆盖 forceRescan 调用的返回值
/// （`.some(nil)` 表示强制重扫仍无 token）。calls 记录每次调用的 forceRescan 标志。
private final class StubKimiTokenReader: KimiTokenReading, @unchecked Sendable {
  private let lock = NSLock()
  var normal: String?
  var forced: String??
  private var _calls: [Bool] = []
  var calls: [Bool] { lock.lock(); defer { lock.unlock() }; return _calls }

  init(token: String? = nil, forced: String?? = nil) {
    self.normal = token
    self.forced = forced
  }

  func token(forceRescan: Bool) -> String? {
    lock.lock()
    _calls.append(forceRescan)
    let f = forced
    let n = normal
    lock.unlock()
    if forceRescan, let f { return f }
    return n
  }
}

private final class StubHTTP: HTTPSending, @unchecked Sendable {
  struct Recorded { let url: String; let method: String; let headers: [String: String]; let body: Data }
  private let lock = NSLock()
  private var _recorded: [Recorded] = []
  var responses: [String: Result<HTTPResponse, Error>] = [:] // key: URL 全串
  var queues: [String: [Result<HTTPResponse, Error>]] = [:] // 同 URL 需按序多次应答时用（优先于 responses）

  var recorded: [Recorded] { lock.lock(); defer { lock.unlock() }; return _recorded }

  func send(_ request: URLRequest) async throws -> HTTPResponse {
    let url = try { () throws -> String in
      guard let u = request.url?.absoluteString else { throw StubError(msg: "no url") }
      return u
    }()
    lock.lock()
    _recorded.append(Recorded(url: url, method: request.httpMethod ?? "GET",
                              headers: request.allHTTPHeaderFields ?? [:],
                              body: request.httpBody ?? Data()))
    if var q = queues[url], !q.isEmpty {
      let r = q.removeFirst()
      queues[url] = q
      lock.unlock()
      return try r.get()
    }
    let r = responses[url]
    lock.unlock()
    guard let r else { throw StubError(msg: "no stub for \(url)") }
    return try r.get()
  }

  func requests(to url: String) -> [Recorded] { recorded.filter { $0.url == url } }
}

private func jsonData(_ obj: Any) -> Data {
  try! JSONSerialization.data(withJSONObject: obj) // 测试输入均为合法 JSON 对象
}

@Suite("NativeCookieProvider")
struct NativeCookieProviderTests {
  private let minimaxURL = "https://www.minimaxi.com/backend/account/token_plan/remains_percent"
  private let mimoUsageURL = "https://platform.xiaomimimo.com/api/v1/tokenPlan/usage"
  private let mimoDetailURL = "https://platform.xiaomimimo.com/api/v1/tokenPlan/detail"
  private let volcAfpURL = "https://console.volcengine.com/api/top/ark/cn-beijing/2024-01-01/GetAgentPlanAFPUsage"
  private let volcCodingURL = "https://console.volcengine.com/api/top/ark/cn-beijing/2024-01-01/GetCodingPlanUsage"
  private let kimiStatsURL = "https://www.kimi.com/apiv2/kimi.gateway.membership.v2.MembershipService/GetSubscriptionStats"

  @Test func minimax成功返回窗口并带Cookie头() async throws {
    let http = StubHTTP()
    http.responses[minimaxURL] = .success(HTTPResponse(status: 200, data: jsonData([
      "base_resp": ["status_code": 0],
      "model_remains": [[
        "model_name": "general",
        "current_interval_used_percent": 0.4,
        "current_weekly_used_percent": "4%",
        "end_time": 1_700_000_000_000.0,
        "weekly_end_time": 1_700_000_000_000.0,
      ]],
    ])))
    let provider = NativeCookieProvider(
      cookieReader: StubCookieReader(jars: [".minimaxi.com": ["sid": "x"]]), http: http, kimiTokenReader: StubKimiTokenReader())
    let snapshot = await provider.fetchSnapshot()
    let card = try #require(snapshot[.minimax])
    #expect(card.status == .ok)
    #expect(card.windows.count == 2)
    #expect(card.windows[0].percent == 0.4)
    #expect(card.windows[1].percent == 0.04)
    #expect(http.requests(to: minimaxURL).first?.headers["Cookie"] == "sid=x")
  }

  @Test func minimax鉴权失败转needsLogin() async throws {
    let http = StubHTTP()
    http.responses[minimaxURL] = .success(HTTPResponse(status: 401, data: Data("unauthenticated".utf8)))
    let provider = NativeCookieProvider(
      cookieReader: StubCookieReader(jars: [".minimaxi.com": ["sid": "x"]]), http: http, kimiTokenReader: StubKimiTokenReader())
    let snapshot = await provider.fetchSnapshot()
    #expect(snapshot[.minimax]?.status == .needsLogin)
  }

  @Test func minimax无general时给空窗口ok卡() async throws {
    // 与扩展 parseMinimax 的 `bars: []` 语义对齐（Swift 端 parser 返回 nil 由 provider 归一）
    let http = StubHTTP()
    http.responses[minimaxURL] = .success(HTTPResponse(status: 200, data: jsonData([
      "base_resp": ["status_code": 0], "model_remains": [],
    ])))
    let provider = NativeCookieProvider(
      cookieReader: StubCookieReader(jars: [".minimaxi.com": ["sid": "x"]]), http: http, kimiTokenReader: StubKimiTokenReader())
    let snapshot = await provider.fetchSnapshot()
    #expect(snapshot[.minimax]?.status == .ok)
    #expect(snapshot[.minimax]?.windows.isEmpty == true)
  }

  @Test func 空cookie罐直接needsLogin且不发请求() async throws {
    let http = StubHTTP()
    let provider = NativeCookieProvider(cookieReader: StubCookieReader(), http: http, kimiTokenReader: StubKimiTokenReader())
    let snapshot = await provider.fetchSnapshot()
    #expect(snapshot[.minimax]?.status == .needsLogin)
    #expect(http.requests(to: minimaxURL).isEmpty)
  }

  @Test func mimo成功返回窗口与套餐名() async throws {
    let http = StubHTTP()
    http.responses[mimoUsageURL] = .success(HTTPResponse(status: 200, data: jsonData([
      "code": 0,
      "data": ["usage": ["items": [[
        "name": "plan_total_token", "percent": 0.5, "used": 100.0, "limit": 200.0,
      ]]]],
    ])))
    http.responses[mimoDetailURL] = .success(HTTPResponse(status: 200, data: jsonData([
      "code": 0, "data": ["planName": "Pro", "currentPeriodEnd": "2026-08-01"],
    ])))
    let provider = NativeCookieProvider(
      cookieReader: StubCookieReader(jars: [".xiaomimimo.com": ["api-platform_serviceToken": "t"]]),
      http: http, kimiTokenReader: StubKimiTokenReader())
    let snapshot = await provider.fetchSnapshot()
    let card = try #require(snapshot[.mimo])
    #expect(card.status == .ok)
    #expect(card.planName == "Pro")
    #expect(card.note == "Pro 套餐 · 有效期至 2026-08-01")
    #expect(card.windows.first?.label == "套餐用量")
    #expect(card.windows.first?.usedText == "100 / 200")
  }

  @Test func mimo401转needsLogin带会话过期提示() async throws {
    let http = StubHTTP()
    http.responses[mimoUsageURL] = .success(HTTPResponse(status: 401, data: Data()))
    http.responses[mimoDetailURL] = .success(HTTPResponse(status: 401, data: Data()))
    let provider = NativeCookieProvider(
      cookieReader: StubCookieReader(jars: [".xiaomimimo.com": ["api-platform_serviceToken": "t"]]),
      http: http, kimiTokenReader: StubKimiTokenReader())
    let snapshot = await provider.fetchSnapshot()
    #expect(snapshot[.mimo]?.status == .needsLogin)
    #expect(snapshot[.mimo]?.errorMessage?.contains("会话已过期") == true)
  }

  @Test func volc成功且合成csrf双提交() async throws {
    let http = StubHTTP()
    http.responses[volcAfpURL] = .success(HTTPResponse(status: 200, data: jsonData([
      "Result": ["PlanType": "pro", "AFPFiveHour": ["Quota": 100.0, "Used": 25.0]],
    ])))
    http.responses[volcCodingURL] = .success(HTTPResponse(status: 200, data: jsonData([
      "Result": ["Status": "Active"],
    ])))
    let provider = NativeCookieProvider(
      cookieReader: StubCookieReader(jars: [".volcengine.com": ["digest": "d"]]), http: http, kimiTokenReader: StubKimiTokenReader())
    let snapshot = await provider.fetchSnapshot()
    let card = try #require(snapshot[.volcengine])
    #expect(card.status == .ok)
    #expect(card.planName == "Agent Plan Pro")
    #expect(card.note == "Coding Plan Active")
    #expect(card.windows.first?.percent == 0.25)

    // 双提交：x-csrf-token 与 Cookie 内 csrfToken 同值（32hex 合成），两个请求一致
    let afpReq = try #require(http.requests(to: volcAfpURL).first)
    let codingReq = try #require(http.requests(to: volcCodingURL).first)
    let csrf = try #require(afpReq.headers["x-csrf-token"])
    #expect(csrf.range(of: #"^[0-9a-f]{32}$"#, options: .regularExpression) != nil)
    #expect(codingReq.headers["x-csrf-token"] == csrf)
    #expect(afpReq.headers["Cookie"]?.contains("digest=d") == true)
    #expect(afpReq.headers["Cookie"]?.contains("csrfToken=\(csrf)") == true)
  }

  @Test func volc已有csrfToken时不合成() async throws {
    let http = StubHTTP()
    http.responses[volcAfpURL] = .success(HTTPResponse(status: 200, data: jsonData([
      "Result": ["PlanType": "pro"],
    ])))
    http.responses[volcCodingURL] = .success(HTTPResponse(status: 200, data: jsonData([:])))
    let provider = NativeCookieProvider(
      cookieReader: StubCookieReader(jars: [".volcengine.com": ["digest": "d", "csrfToken": "abc123"]]),
      http: http, kimiTokenReader: StubKimiTokenReader())
    _ = await provider.fetchSnapshot()
    let req = try #require(http.requests(to: volcAfpURL).first)
    #expect(req.headers["x-csrf-token"] == "abc123")
    #expect(req.headers["Cookie"]?.contains("csrfToken=abc123") == true)
  }

  @Test func volcNotLogin转needsLogin() async throws {
    let http = StubHTTP()
    http.responses[volcAfpURL] = .success(HTTPResponse(status: 200, data: jsonData([
      "ResponseMetadata": ["Error": ["Code": "NotLogin"]],
    ])))
    http.responses[volcCodingURL] = .success(HTTPResponse(status: 200, data: jsonData([:])))
    let provider = NativeCookieProvider(
      cookieReader: StubCookieReader(jars: [".volcengine.com": ["digest": "d"]]), http: http, kimiTokenReader: StubKimiTokenReader())
    let snapshot = await provider.fetchSnapshot()
    #expect(snapshot[.volcengine]?.status == .needsLogin)
    #expect(snapshot[.volcengine]?.errorMessage == "NotLogin")
  }

  @Test func kimi无token落needsLogin且不发请求() async throws {
    let http = StubHTTP()
    let provider = NativeCookieProvider(
      cookieReader: StubCookieReader(), http: http, kimiTokenReader: StubKimiTokenReader())
    let snapshot = await provider.fetchSnapshot()
    #expect(snapshot[.kimi]?.status == .needsLogin)
    #expect(snapshot[.kimi]?.errorMessage == "请用 Chrome 打开一次 Kimi 控制台")
    #expect(http.requests(to: kimiStatsURL).isEmpty)
  }

  @Test func kimi成功返回窗口并带Bearer头() async throws {
    let http = StubHTTP()
    http.responses[kimiStatsURL] = .success(HTTPResponse(status: 200, data: jsonData([
      "ratelimitCode5h": ["ratio": 0.3, "resetTime": "2026-07-26T13:00:00Z"],
      "ratelimitCode7d": ["ratio": 0.5, "resetTime": "2026-07-30T00:00:00Z"],
    ])))
    let provider = NativeCookieProvider(
      cookieReader: StubCookieReader(), http: http,
      kimiTokenReader: StubKimiTokenReader(token: "tok123"))
    let snapshot = await provider.fetchSnapshot()
    let card = try #require(snapshot[.kimi])
    #expect(card.status == .ok)
    #expect(card.windows.count == 2)
    #expect(card.windows[0].percent == 0.3)
    #expect(card.windows[1].percent == 0.5)
    let req = try #require(http.requests(to: kimiStatsURL).first)
    #expect(req.method == "POST")
    #expect(req.headers["Authorization"] == "Bearer tok123")
    #expect(String(decoding: req.body, as: UTF8.self) == "{}")
  }

  @Test func kimi401后强制重扫换token成功() async throws {
    let http = StubHTTP()
    http.queues[kimiStatsURL] = [
      .success(HTTPResponse(status: 401, data: Data())),
      .success(HTTPResponse(status: 200, data: jsonData(["ratelimitCode5h": ["ratio": 0.1]]))),
    ]
    let tokens = StubKimiTokenReader(token: "old", forced: "new")
    let provider = NativeCookieProvider(
      cookieReader: StubCookieReader(), http: http, kimiTokenReader: tokens)
    let snapshot = await provider.fetchSnapshot()
    #expect(snapshot[.kimi]?.status == .ok)
    #expect(tokens.calls == [false, true])
    let reqs = http.requests(to: kimiStatsURL)
    #expect(reqs.count == 2)
    #expect(reqs[0].headers["Authorization"] == "Bearer old")
    #expect(reqs[1].headers["Authorization"] == "Bearer new")
  }

  @Test func kimi401后重扫仍401转needsLogin() async throws {
    let http = StubHTTP()
    http.queues[kimiStatsURL] = [
      .success(HTTPResponse(status: 401, data: Data())),
      .success(HTTPResponse(status: 401, data: Data())),
    ]
    let tokens = StubKimiTokenReader(token: "old", forced: "new")
    let provider = NativeCookieProvider(
      cookieReader: StubCookieReader(), http: http, kimiTokenReader: tokens)
    let snapshot = await provider.fetchSnapshot()
    #expect(snapshot[.kimi]?.status == .needsLogin)
    #expect(snapshot[.kimi]?.errorMessage == "access_token 已过期，请打开一次 Kimi 控制台")
    #expect(http.requests(to: kimiStatsURL).count == 2)
  }

  @Test func kimi401后重扫无token转needsLogin() async throws {
    let http = StubHTTP()
    http.responses[kimiStatsURL] = .success(HTTPResponse(status: 401, data: Data()))
    let tokens = StubKimiTokenReader(token: "old", forced: .some(nil))
    let provider = NativeCookieProvider(
      cookieReader: StubCookieReader(), http: http, kimiTokenReader: tokens)
    let snapshot = await provider.fetchSnapshot()
    #expect(snapshot[.kimi]?.status == .needsLogin)
    #expect(snapshot[.kimi]?.errorMessage == "access_token 已过期，请打开一次 Kimi 控制台")
    #expect(http.requests(to: kimiStatsURL).count == 1) // 无新 token 不再重试
  }

  @Test func kimi响应带code字段时缺席快照() async throws {
    // 与扩展 fetchKimi 一致：status 200 但 JSON 含 code → 业务错误，缺席快照
    let http = StubHTTP()
    http.responses[kimiStatsURL] = .success(HTTPResponse(status: 200, data: jsonData(["code": 1001])))
    let provider = NativeCookieProvider(
      cookieReader: StubCookieReader(), http: http,
      kimiTokenReader: StubKimiTokenReader(token: "tok123"))
    let snapshot = await provider.fetchSnapshot()
    #expect(snapshot[.kimi] == nil)
  }

  @Test func kimi网络错误缺席快照() async throws {
    let http = StubHTTP()
    http.responses[kimiStatsURL] = .failure(StubError(msg: "offline"))
    let provider = NativeCookieProvider(
      cookieReader: StubCookieReader(), http: http,
      kimiTokenReader: StubKimiTokenReader(token: "tok123"))
    let snapshot = await provider.fetchSnapshot()
    #expect(snapshot[.kimi] == nil)
  }

  @Test func 单平台cookie读取异常不影响其他平台() async throws {
    let http = StubHTTP()
    http.responses[mimoUsageURL] = .success(HTTPResponse(status: 200, data: jsonData([
      "code": 0, "data": ["usage": ["items": []]],
    ])))
    http.responses[mimoDetailURL] = .success(HTTPResponse(status: 200, data: jsonData(["code": 0])))
    let reader = StubCookieReader(
      jars: [".xiaomimimo.com": ["api-platform_serviceToken": "t"]],
      failingDomains: [".minimaxi.com"])
    let provider = NativeCookieProvider(cookieReader: reader, http: http, kimiTokenReader: StubKimiTokenReader())
    let snapshot = await provider.fetchSnapshot()
    #expect(snapshot[.minimax]?.status == .needsLogin)
    #expect(snapshot[.mimo]?.status == .ok)
  }

  @Test func 网络错误时该平台缺席快照() async throws {
    let http = StubHTTP()
    http.responses[minimaxURL] = .failure(StubError(msg: "offline"))
    let provider = NativeCookieProvider(
      cookieReader: StubCookieReader(jars: [".minimaxi.com": ["sid": "x"]]), http: http, kimiTokenReader: StubKimiTokenReader())
    let snapshot = await provider.fetchSnapshot()
    #expect(snapshot[.minimax] == nil)
    #expect(snapshot[.kimi] != nil) // kimi 无 token 恒落 needs_login 卡
  }
}
