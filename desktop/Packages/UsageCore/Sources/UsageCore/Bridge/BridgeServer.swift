import Foundation
import Network

/// 127.0.0.1 环回 HTTP 接收服务：接收扩展推送的用量快照（POST /v1/usage，Bearer 鉴权）。
public final class BridgeServer: @unchecked Sendable {
  public private(set) var boundPort: UInt16 = 0
  public private(set) var lastReceivedAt: Date?
  public var onSnapshot: (@Sendable ([PlatformID: PlatformUsage]) -> Void)?
  private let token: String
  private var listener: NWListener?
  private let queue = DispatchQueue(label: "bridge-server")

  public init(port: UInt16 = 17389, token: String) {
    self.boundPort = port
    self.token = token
  }

  /// 启动监听并阻塞至 ready（port 传 0 时由系统分配，ready 后回填 `boundPort`）。
  public func start() throws {
    let params = NWParameters.tcp
    params.requiredInterfaceType = .loopback
    let listener: NWListener
    if let port = NWEndpoint.Port(rawValue: boundPort), port.rawValue != 0 {
      listener = try NWListener(using: params, on: port)
    } else {
      listener = try NWListener(using: params) // 系统分配端口
    }
    let ready = DispatchSemaphore(value: 0)
    var startError: Error?
    listener.stateUpdateHandler = { [weak self, weak listener] state in
      switch state {
      case .ready:
        self?.boundPort = listener?.port?.rawValue ?? 0
        ready.signal()
      case .failed(let error):
        startError = error
        ready.signal()
      default:
        break
      }
    }
    listener.newConnectionHandler = { [weak self] conn in self?.handle(conn) }
    listener.start(queue: queue)
    self.listener = listener
    ready.wait()
    if let startError {
      listener.cancel()
      self.listener = nil
      throw startError
    }
  }

  public func stop() {
    listener?.cancel()
    listener = nil
  }

  // MARK: - 连接处理

  private struct HTTPResponse {
    let statusCode: Int
    let body: String
  }

  private func handle(_ conn: NWConnection) {
    conn.start(queue: queue)
    receive(conn, accumulated: Data())
  }

  /// 递归接收直至拿到完整 header+body，处理后响应并关闭连接。
  private func receive(_ conn: NWConnection, accumulated: Data) {
    conn.receive(minimumIncompleteLength: 1, maximumLength: 1 << 20) { [weak self] chunk, _, isComplete, error in
      guard let self else {
        conn.cancel()
        return
      }
      var data = accumulated
      if let chunk { data.append(chunk) }
      if let response = self.tryProcess(data) {
        self.respond(conn, response)
      } else if isComplete || error != nil {
        conn.cancel()
      } else {
        self.receive(conn, accumulated: data)
      }
    }
  }

  /// 单请求累积上限 1 MB：限制 pre-auth 缓冲，防本地进程恶意撑大每连接内存。
  private static let maxRequestBytes = 1 << 20

  /// 数据未集齐返回 nil；集齐则解析并给出响应（成功时回调 onSnapshot）。
  private func tryProcess(_ data: Data) -> HTTPResponse? {
    guard let headerEnd = data.range(of: Data([13, 10, 13, 10])) else {
      // header 未完整但累积已超上限，立即拒绝
      return data.count > Self.maxRequestBytes
        ? HTTPResponse(statusCode: 400, body: #"{"error":"bad request"}"#)
        : nil
    }
    guard let headerText = String(data: data[..<headerEnd.lowerBound], encoding: .utf8) else {
      return HTTPResponse(statusCode: 400, body: #"{"error":"bad request"}"#)
    }
    var lines = headerText.components(separatedBy: "\r\n")
    let requestLine = lines.removeFirst()
    let parts = requestLine.split(separator: " ")
    let path = parts.count >= 2 ? String(parts[1]) : ""
    var headers: [String: String] = [:]
    for line in lines {
      guard let colon = line.firstIndex(of: ":") else { continue }
      let key = line[..<colon].trimmingCharacters(in: .whitespaces).lowercased()
      let value = line[line.index(after: colon)...].trimmingCharacters(in: .whitespaces)
      headers[key] = value
    }
    let contentLength = Int(headers["content-length"] ?? "") ?? 0
    guard contentLength <= Self.maxRequestBytes else {
      return HTTPResponse(statusCode: 400, body: #"{"error":"bad request"}"#)
    }
    let bodyStart = headerEnd.upperBound
    guard data.count >= bodyStart + contentLength else { return nil } // body 未收满，继续读

    guard headers["authorization"] == "Bearer \(token)" else {
      return HTTPResponse(statusCode: 401, body: #"{"error":"unauthorized"}"#)
    }
    guard path == "/v1/usage" else {
      return HTTPResponse(statusCode: 404, body: #"{"error":"not found"}"#)
    }
    do {
      let cards = try BridgeSnapshot.decode(data.subdata(in: bodyStart ..< bodyStart + contentLength))
      lastReceivedAt = Date()
      onSnapshot?(cards)
      return HTTPResponse(statusCode: 200, body: #"{"ok":true}"#)
    } catch {
      return HTTPResponse(statusCode: 400, body: #"{"error":"bad request"}"#)
    }
  }

  private func respond(_ conn: NWConnection, _ response: HTTPResponse) {
    let reason: String = switch response.statusCode {
    case 200: "OK"
    case 400: "Bad Request"
    case 401: "Unauthorized"
    case 404: "Not Found"
    default: "Status"
    }
    let text = """
    HTTP/1.1 \(response.statusCode) \(reason)\r
    Content-Type: application/json\r
    Content-Length: \(response.body.utf8.count)\r
    Connection: close\r
    \r
    \(response.body)
    """
    conn.send(content: Data(text.utf8), completion: .contentProcessed { _ in conn.cancel() })
  }
}
