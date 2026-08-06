# Coding Plan Assistant ↔ Chrome 扩展 桥接协议（v1）

本文档是 Coding Plan Assistant macOS 菜单栏应用与其配套 Chrome 扩展（miaosha-GLM）之间的**桥接接口契约**。
两个仓库独立演进，契约由两侧各自的契约测试强制执行：

- App 侧：`Packages/UsageCore/Tests/UsageCoreTests/BridgeContractTests.swift`
- 扩展侧：`tests/unit/usage/bridge-contract.test.ts`
- 共享夹具：`docs/bridge-fixtures/snapshot-v1.json`（两侧测试都消费同一份文件）

## 谁是生产者 / 消费者

- **生产者**：Chrome 扩展（`lib/usage/bridge-push.ts` 的 `pushUsageToBridge`）。它周期性抓取四个平台
  （minimax / kimi / mimo / volcengine）的用量，把结果 POST 到本机桥服务器。
- **消费者**：Coding Plan Assistant macOS 应用（`Packages/UsageCore/Sources/UsageCore/BridgeServer.swift` 接收，
  `BridgeSnapshot.swift` 解码）。

**桥是可选的。** App 不依赖扩展也能独立运行（自身可直接抓取平台数据）；扩展未安装、未启用桥推送、
或 token 未配置时，App 照常工作，只是不显示扩展推送的快照。推送失败对扩展同样静默——App 未运行属常态。

## 传输

- `POST http://127.0.0.1:17389/v1/usage`
- **仅 loopback**：App 的桥服务器只绑定 `127.0.0.1`，不监听外部接口；扩展也只向 `127.0.0.1` 发请求。
- 端口默认 `17389`，扩展侧可在选项页配置（`BridgeConfig.port`），App 侧端口随之对齐。
- `Content-Type: application/json`；扩展侧请求带 2 秒超时（`AbortSignal.timeout(2000)`）。
- 响应：成功 `200`；token 错误 `401`；路径不存在 `404`；body 非法 JSON / 声明超大 Content-Length `400`。

## 认证

- 请求头：`Authorization: Bearer <token>`
- token 由 **App 生成**：首启时生成 UUID，存入 App 的 UserDefaults（默认 suite，key `"bridgeToken"`，
  见 `BridgeToken.swift`）。可通过 `defaults read <bundleId> bridgeToken` 读取。
- 用户把该 token **手动粘贴到扩展选项页**的桥设置中（存于扩展 `storage` 的 `local:bridgeConfig`）。
- 桥推送默认关闭（`enabled: false`），需用户在扩展选项页显式启用并填入 token。

## 载荷 schema（v1）

请求体是一个 JSON object：**平台 id → 用量卡片**。平台 id 取值集合：
`minimax`、`kimi`、`mimo`、`volcengine`（即扩展的 `UsagePlatform`）。键可以只出现子集
（`UsageCache = Partial<Record<UsagePlatform, UsageCardData>>`）。

每张卡片（对应扩展 `UsageCardData`）字段如下，字段名与类型必须完全一致：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `platform` | string | 是 | 平台 id，与外层键一致（App 解码时以外层键为准，忽略该字段值） |
| `displayName` | string | 是 | 展示名，如 `"Kimi Code"` |
| `consoleUrl` | string | 是 | 平台控制台地址；App 侧容忍缺失（解码为 `nil`），needs_login 卡用它做"打开控制台"跳转 |
| `planName` | string | 否 | 套餐名，如 `"Vivace"` |
| `status` | string enum | 是 | 取值见下表 |
| `bars` | array | 是 | 用量条数组，可为空（非 ok 卡通常为空） |
| `note` | string | 否 | 备注文本 |
| `errorMessage` | string | 否 | 错误/提示信息（needs_login、error 卡常见） |
| `fetchedAt` | number | 是 | 抓取时间，epoch **毫秒** |

`bars` 元素（对应扩展 `UsageBar`）：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `label` | string | 是 | 窗口标签，如 `"频限明细（5h）"`、`"本周用量"` |
| `percent` | number | 是 | **已用**比例，0–1（如 0.263 = 已用 26.3%） |
| `usedText` | string | 否 | 原始计数文本，如 `"8,162,846,607 / 49,200,000,000"` |
| `resetAt` | number | 否 | 额度重置时刻，epoch **毫秒**；未知/不适用时省略 |

### status 取值与 App 侧映射

扩展 `UsageStatus` 枚举（`lib/usage/types.ts`）：

| 扩展 `status` | App `CardStatus` | 说明 |
| --- | --- | --- |
| `"ok"` | `.ok` | 正常 |
| `"needs_login"` | `.needsLogin` | 需要登录 |
| `"no_subscription"` | `.unavailable` | 无订阅，App 归并为不可用 |
| `"error"` | `.unavailable` | 抓取失败，App 归并为不可用 |

补充规则（以 App `BridgeSnapshot.decode` 实际行为为准）：

- App 额外识别 `"stale"` → `.stale`（扩展当前不产生该值，属 App 预留）。
- **任何未知 status 字符串**（含扩展未来新增值）→ App 一律映射为 `.unavailable`（兜底，不抛错）。
- status 字段缺失时按 `"error"` 处理 → `.unavailable`。
- 外层出现**未知平台 id 的键** → App 直接忽略该条目，不影响其他平台。

## 演进规则

1. **只增不破**：v1 内只允许新增可选字段；不得重命名、删除字段或改变字段类型/语义
   （含单位——`fetchedAt`/`resetAt` 恒为 epoch 毫秒，`percent` 恒为 0–1 已用比例）。
2. **消费者必须忽略未知字段**（App 基于 `JSONSerialization` 按名取值，天然满足；扩展侧同理）。
3. **未知 status 按 unavailable 处理**（见上表），生产者新增 status 值不需要消费者同步发版。
4. 任何破坏性变更（改字段语义、改单位、改认证方式、改路径结构）必须走**新版本路径**
   `/v2/usage`，旧路径继续可用至少一个过渡周期。
5. 夹具 `docs/bridge-fixtures/snapshot-v1.json` 是 v1 的权威样例；schema 演进时同步更新夹具与两侧契约测试。

## 版本

- 当前版本 **v1**，隐含在 URL 路径中（`/v1/usage`），载荷内无版本字段。
- 共享夹具命名 `snapshot-v1.json`，与路径版本对应。
