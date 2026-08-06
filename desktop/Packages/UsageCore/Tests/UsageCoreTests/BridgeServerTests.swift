import Testing
import Foundation
import Network
@testable import UsageCore

/// 测试用互斥锁（包最低部署 macOS 14，标准库 Synchronization.Mutex 需 macOS 15，故自定义）。
private final class Mutex<Value>: @unchecked Sendable {
  private var value: Value
  private let lock = NSLock()
  init(_ value: Value) { self.value = value }
  func withLock<T>(_ body: (inout Value) -> T) -> T {
    lock.lock()
    defer { lock.unlock() }
    return body(&value)
  }
}

@Suite("BridgeServer")
struct BridgeServerTests {
  private func post(port: UInt16, path: String, token: String?, body: String) async throws -> (Int, String) {
    var req = URLRequest(url: URL(string: "http://127.0.0.1:\(port)\(path)")!)
    req.httpMethod = "POST"
    if let token { req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
    req.httpBody = body.data(using: .utf8)
    let (data, res) = try await URLSession.shared.data(for: req)
    return ((res as! HTTPURLResponse).statusCode, String(data: data, encoding: .utf8) ?? "")
  }

  @Test func 正常推送触发onSnapshot_错误令牌401_错误路径404() async throws {
    let server = BridgeServer(port: 0, token: "T1") // port 0 = 系统分配
    try server.start()
    let port = server.boundPort
    let received = Mutex<[PlatformID: PlatformUsage]?>(nil)
    server.onSnapshot = { cards in received.withLock { $0 = cards } }

    let body = """
    {"minimax":{"platform":"minimax","displayName":"MiniMax","status":"ok",
      "bars":[{"label":"5h 限额","percent":0.21}],"fetchedAt":1783999000000}}
    """
    let (code, _) = try await post(port: port, path: "/v1/usage", token: "T1", body: body)
    #expect(code == 200)
    try await Task.sleep(for: .milliseconds(100))
    #expect(received.withLock { $0?[.minimax]?.windows.first?.percent } == 0.21)
    #expect(server.lastReceivedAt != nil)

    let (code401, _) = try await post(port: port, path: "/v1/usage", token: "WRONG", body: body)
    #expect(code401 == 401)
    let (code404, _) = try await post(port: port, path: "/nope", token: "T1", body: body)
    #expect(code404 == 404)
    let (code400, _) = try await post(port: port, path: "/v1/usage", token: "T1", body: "{broken")
    #expect(code400 == 400)
    server.stop()
  }

  @Test func 声明超大ContentLength立即400() async throws {
    let server = BridgeServer(port: 0, token: "T1")
    try server.start()
    defer { server.stop() }

    // 裸 TCP 连接发送声明 2MB body 的 header（URLSession 会覆写 Content-Length，不可用）
    let statusLine = try await withCheckedThrowingContinuation { (cont: CheckedContinuation<String, Error>) in
      let conn = NWConnection(
        host: "127.0.0.1",
        port: NWEndpoint.Port(rawValue: server.boundPort)!,
        using: .tcp
      )
      conn.stateUpdateHandler = { state in
        switch state {
        case .ready:
          let header = "POST /v1/usage HTTP/1.1\r\nAuthorization: Bearer T1\r\nContent-Length: 2097152\r\n\r\n"
          conn.send(content: Data(header.utf8), completion: .contentProcessed { sendError in
            if let sendError {
              cont.resume(throwing: sendError)
              conn.cancel()
              return
            }
            conn.receive(minimumIncompleteLength: 1, maximumLength: 4096) { data, _, _, recvError in
              if let recvError {
                cont.resume(throwing: recvError)
              } else {
                cont.resume(returning: String(data: data ?? Data(), encoding: .utf8) ?? "")
              }
              conn.cancel()
            }
          })
        case .failed(let error):
          cont.resume(throwing: error)
          conn.cancel()
        default:
          break
        }
      }
      conn.start(queue: .global())
    }
    #expect(statusLine.hasPrefix("HTTP/1.1 400"))
  }
}
