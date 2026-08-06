import Foundation

/// 原生兜底通道的 HTTP 抽象：任何状态码都正常返回（由调用方判定鉴权/业务错误），
/// 仅网络层失败抛错。
public struct HTTPResponse: Sendable, Equatable {
  public let status: Int
  public let data: Data
  public init(status: Int, data: Data) {
    self.status = status
    self.data = data
  }
}

public protocol HTTPSending: Sendable {
  func send(_ request: URLRequest) async throws -> HTTPResponse
}

/// 轻量 HTTP 客户端：ephemeral 会话（不落盘）、10s 超时、不碰系统 cookie 罐
/// （Cookie 完全由调用方手动注入，避免与 Chrome 无关的系统罐串味）。
public struct HTTPClient: HTTPSending {
  public static let userAgent =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

  public let session: URLSession

  public init(session: URLSession? = nil) {
    if let session {
      self.session = session
    } else {
      let config = URLSessionConfiguration.ephemeral
      config.timeoutIntervalForRequest = 10
      config.httpCookieStorage = nil
      config.httpShouldSetCookies = false
      self.session = URLSession(configuration: config)
    }
  }

  public func send(_ request: URLRequest) async throws -> HTTPResponse {
    var request = request
    if request.value(forHTTPHeaderField: "User-Agent") == nil {
      request.setValue(Self.userAgent, forHTTPHeaderField: "User-Agent")
    }
    let (data, response) = try await session.data(for: request)
    guard let http = response as? HTTPURLResponse else {
      throw URLError(.badServerResponse)
    }
    return HTTPResponse(status: http.statusCode, data: data)
  }
}

extension HTTPSending {
  public func get(_ url: URL, headers: [String: String] = [:]) async throws -> HTTPResponse {
    var request = URLRequest(url: url)
    for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
    return try await send(request)
  }

  public func postJSON(_ url: URL, headers: [String: String] = [:], body: Data = Data()) async throws -> HTTPResponse {
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    for (k, v) in headers { request.setValue(v, forHTTPHeaderField: k) }
    request.httpBody = body
    return try await send(request)
  }
}
