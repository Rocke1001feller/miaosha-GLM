import Foundation
import Combine
import UsageCore

/// App 层装配：磁盘缓存恢复 → 桥服务（Bearer token）→ 节奏引擎。
/// bridge.onSnapshot 槽由 RefreshEngine.init 接管并跳 MainActor，本类不覆写；
/// 桥推送的落盘由引擎内 diskCache 钩子完成。
@MainActor
final class AppState: ObservableObject {
  let store: UsageStore
  /// 引擎与桥在"重新生成令牌"时整体重建（引擎 init 接管新桥 onSnapshot 槽，T5 接线不变）
  private(set) var engine: RefreshEngine
  private(set) var bridge: BridgeServer
  private let diskCache: SnapshotDiskCache
  private var cancellables = Set<AnyCancellable>()

  init() {
    let store = UsageStore()
    let diskCache = SnapshotDiskCache()
    if let cached = diskCache.load() {
      store.apply(snapshot: cached, from: .nativeFallback) // 冷启动先展示上次快照
    }
    let token = BridgeToken.loadOrCreate() // UserDefaults "bridgeToken"，供 curl 调试与设置页展示
    let (bridge, engine) = Self.makeWiredBridge(token: token, store: store, diskCache: diskCache)
    self.store = store
    self.bridge = bridge
    self.engine = engine
    self.diskCache = diskCache
    // store（ObservableObject）的变更转发给 App 层：@StateObject/@ObservedObject 订阅本对象即可联动刷新
    store.objectWillChange
      .sink { [weak self] in self?.objectWillChange.send() }
      .store(in: &cancellables)
  }

  /// 设置页"重新生成"：写新令牌并重建桥（stop→init→start）。
  /// 方案选"重建引擎"而非"引擎可换桥"：RefreshEngine 的 bridge 是私有 let（T5），
  /// 重建实例即可让新桥 onSnapshot 槽在引擎 init 中被接管，无需改动 UsageCore 公共接口。
  /// 旧引擎随引用释放 deinit（清旧桥槽位+取消 tick），这里先主动停桥停引擎，顺序明确。
  @discardableResult
  func regenerateBridgeToken() -> String {
    engine.stop()
    bridge.onSnapshot = nil // 旧引擎 deinit 时机不定，主动解槽避免旧桥残留回调
    bridge.stop()
    let token = BridgeToken.regenerate()
    let (bridge, engine) = Self.makeWiredBridge(token: token, store: store, diskCache: diskCache)
    self.bridge = bridge
    self.engine = engine
    return token
  }

  /// 创建桥+引擎并完成接线：引擎 init 先挂 onSnapshot，再 start 监听（避免启动窗口丢推送），最后启 tick。
  /// fallback 为原生兑底通道（Chrome cookie 直取，T10）：桥离线时每 tick 尽力拉取。
  /// CODINGPLANASSISTANT_MOCK=1 时改用 MockProvider——mock 是给无扩展/无会话的独立开发场景；
  /// 桥照常接线，真实扩展推送仍然优先（mock 只占 fallback 槽）。
  private static func makeWiredBridge(token: String, store: UsageStore,
                                      diskCache: SnapshotDiskCache) -> (BridgeServer, RefreshEngine) {
    let bridge = BridgeServer(token: token)
    let fallback: any UsageProvider =
      ProcessInfo.processInfo.environment["CODINGPLANASSISTANT_MOCK"] == "1"
      ? MockProvider() : NativeCookieProvider()
    let engine = RefreshEngine(store: store, bridge: bridge,
                               fallback: fallback, diskCache: diskCache)
    do {
      try bridge.start()
    } catch {
      // 端口被占用等失败静默：无桥运行，仅靠缓存/兜底数据
    }
    engine.start()
    return (bridge, engine)
  }
}
