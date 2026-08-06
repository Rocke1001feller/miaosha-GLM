import Foundation

/// 编译期内嵌的桥快照夹具，与 docs/bridge-fixtures/snapshot-v1.json **逐字节一致**
/// （含末尾换行）。由该夹具文件机械生成（生成/校验命令见 docs/dev-notes-task3.md），
/// 夹具更新后须重新生成本文件；MockProviderTests 内有逐字节一致的防漂移测试。
/// 选内嵌字符串而非 Bundle resource：app target 由 xcodegen 生成、未配置资源拷贝，
/// 内嵌零构建配置，`swift test` 与 .app 两种运行方式下都可用。
public enum MockFixture {
  /// snapshot-v1.json 全文（逐字节，含末尾换行）
  public static let snapshotV1JSON: String = #"""
{
  "kimi": {
    "platform": "kimi",
    "displayName": "Kimi Code",
    "consoleUrl": "https://www.kimi.com/code/console",
    "status": "ok",
    "bars": [
      { "label": "频限明细（5h）", "percent": 0.263, "resetAt": 1785076200000 },
      { "label": "本周用量", "percent": 0.318 }
    ],
    "fetchedAt": 1785067200000
  },
  "mimo": {
    "platform": "mimo",
    "displayName": "小米 MiMo",
    "consoleUrl": "https://platform.xiaomimimo.com/console/plan-manage",
    "planName": "Pro",
    "status": "ok",
    "bars": [
      { "label": "套餐用量", "percent": 0.17, "usedText": "8,162,846,607 / 49,200,000,000" },
      { "label": "月用量", "percent": 0.166 }
    ],
    "note": "数据来自 MiMo 控制台套餐页",
    "fetchedAt": 1785067200000
  },
  "minimax": {
    "platform": "minimax",
    "displayName": "MiniMax",
    "consoleUrl": "https://platform.minimaxi.com/console/usage",
    "status": "needs_login",
    "bars": [],
    "errorMessage": "会话已过期且自动登录失败，请打开控制台登录",
    "fetchedAt": 1785067200000
  },
  "volcengine": {
    "platform": "volcengine",
    "displayName": "火山引擎",
    "consoleUrl": "https://console.volcengine.com/ark/region:cn-beijing/subscription/agent-plan",
    "status": "error",
    "bars": [],
    "errorMessage": "NotLogin",
    "fetchedAt": 1785067200000
  }
}
"""# + "\n"

  /// 夹具的 UTF-8 Data 形式，直接喂给 BridgeSnapshot.decode
  public static var snapshotV1Data: Data { Data(snapshotV1JSON.utf8) }
}
