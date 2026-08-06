import Foundation

/// 节奏引擎：30s tick 评估 stale；桥离线且有 fallback 时拉一次兜底；poke() 立即执行一拍。
/// 冷启动宽限：start() 起 fallbackGracePeriod（默认 90s）内不拉兜底——桥推送节奏 60s，
/// 冷启动前 2 拍（30s/60s）桥数据未至属正常，此时拉兜底只会白触发 Keychain 弹窗。
/// 例外：start() 时 store 无任何可用卡（空缓存/全错误卡）则立即拉一次兜底，不让用户盯错误卡等宽限。
@MainActor
public final class RefreshEngine {
  public static let tickInterval: Duration = .seconds(30)
  /// 冷启动兜底宽限默认 90s：覆盖桥首推窗口（60s 推送 + 余量）
  public static let defaultFallbackGracePeriod: TimeInterval = 90

  private let store: UsageStore
  private let bridge: BridgeServer
  private let fallback: (any UsageProvider)?
  /// 桥推送落盘缓存（可选）：apply 入库后保存，供下次冷启动恢复
  private let diskCache: SnapshotDiskCache?
  /// start() 起不拉兜底的宽限时长（秒，可注入便于测试）
  private let fallbackGracePeriod: TimeInterval
  /// start() 时刻（宽限锚点）；未 start 时无宽限（poke 直接可用兜底）
  private var startedAt: Date?
  private var tickTask: Task<Void, Never>?

  public init(store: UsageStore, bridge: BridgeServer, fallback: (any UsageProvider)?,
              diskCache: SnapshotDiskCache? = nil,
              fallbackGracePeriod: TimeInterval = RefreshEngine.defaultFallbackGracePeriod) {
    self.store = store
    self.bridge = bridge
    self.fallback = fallback
    self.diskCache = diskCache
    self.fallbackGracePeriod = fallbackGracePeriod
    // T4 评审接口注意：onSnapshot 在 BridgeServer 串行队列回调，消费方须自行跳 MainActor。
    bridge.onSnapshot = { [weak store, weak self] cards in
      Task { @MainActor in
        store?.apply(snapshot: cards, from: .bridge)
        self?.diskCache?.save(cards)
      }
    }
  }

  deinit {
    tickTask?.cancel()
    bridge.onSnapshot = nil
  }

  /// 启动 30s 循环并记录宽限锚点；重复调用幂等（锚点取首次 start）。
  public func start() {
    guard tickTask == nil else { return }
    startedAt = Date()
    // 冷启动无可用卡（空缓存/全错误卡）：立即拉一次兜底，不让用户盯错误卡等宽限
    if !store.hasUsableCard {
      Task { await self.pullFallback() }
    }
    tickTask = Task { [weak self] in
      while !Task.isCancelled {
        try? await Task.sleep(for: Self.tickInterval)
        guard let self, !Task.isCancelled else { break }
        await self.tick()
      }
    }
  }

  public func stop() {
    tickTask?.cancel()
    tickTask = nil
  }

  /// 立即执行一拍：evaluateStaleness + 桥离线时拉兜底（同样受冷启动宽限约束）。
  public func poke() async {
    await tick()
  }

  private func tick() async {
    store.evaluateStaleness(now: Date())
    if !store.bridgeOnline, !isWithinFallbackGracePeriod(now: Date()) {
      await pullFallback()
    }
  }

  /// start() 后宽限期内不拉兜底；未 start（startedAt 为 nil）时无宽限。
  private func isWithinFallbackGracePeriod(now: Date) -> Bool {
    guard let startedAt else { return false }
    return now.timeIntervalSince(startedAt) < fallbackGracePeriod
  }

  /// 拉取失败（空快照）静默：保留现有卡。
  private func pullFallback() async {
    guard let fallback else { return }
    let snapshot = await fallback.fetchSnapshot()
    guard !snapshot.isEmpty else { return }
    store.apply(snapshot: snapshot, from: .nativeFallback)
  }
}
