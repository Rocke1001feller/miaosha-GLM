# UsageBar × 主项目解耦实施计划（方案 C：彻底去桥化，桥保留为可选通道）

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Steps use checkbox syntax.

**Goal:** mac-os-only-fans/UsageBar 成为独立仓库的独立产品：不装主项目扩展也能显示全部四平台用量（Kimi 经 Chrome localStorage LevelDB 直读）；与扩展的桥保留为可选增强通道，接口契约显式签署。

**用户已裁决：** ① 方案 C（彻底去桥化）；② Kimi v1 走 LevelDB（脆弱性已知，后续迭代）；③ 桥保留为可选通道（契约照签）；④ 主项目基准分支 refactor-2.0.1。

**现状锚点：** 源码在主仓 only-fans 分支（最新 0722dd6）完好；mac-os-only-fans/.git 是另一会话的半成品（commit c7802c3 仅 3 文件，含生成物，废弃）；探针证实 Kimi access_token 在 Chrome leveldb 的 Snappy 压缩 .ldb 块内（.log 无近期记录），v1 需要 SSTable 块解压能力。

## Global Constraints

- 新仓库位置：`/Users/separationofconcerns/Documents/ReachVideo/UsageBar`（与主仓平级；用户目标"单独的项目"）。
- 主仓当前检出 only-fans，**不主动切换分支**；主仓侧删除 mac-os-only-fans/ 的操作在 refactor-2.0.1 上进行（列为用户/后续授权项，本计划不执行分支切换）。
- 新仓构建/测试一律前缀 `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`。
- 不引入第三方依赖（离线可构建）：Snappy 解压用内嵌源码实现。
- 桥协议只增不改；注释中文；UsageCore/UsageUI 测试全绿后才提交。

---

### Task 0: 清场 + 仓库分离（控制器执行，不用 subagent）

- [ ] 删除半成品嵌套仓库 `mac-os-only-fans/.git`（commit c7802c3 无源码、含生成物，无保留价值）。
- [ ] `git subtree split --prefix=mac-os-only-fans/UsageBar only-fans -b usagebar-standalone`（主仓内，不动 only-fans）。
- [ ] `git init /Users/separationofconcerns/Documents/ReachVideo/UsageBar && git -C <新仓> pull <主仓路径> usagebar-standalone`（历史完整迁入）。
- [ ] 新仓补 `.gitignore`：`.build/`、`.swiftpm/`、`DerivedData/`、`xcuserdata/`、`*.xcuserstate`、`.DS_Store`、`UsageBar.xcodeproj/`、`docs/design-explorations/`（设计稿归主仓历史档案，不带入产品仓）。
- [ ] 验证：`cd <新仓>/Packages/UsageCore && swift test`（58 绿）、`Packages/UsageUI`（16 绿）、`scripts/dev-mac.sh` 构建绿。
- [ ] 新仓首个 commit（gitignore + 必要说明）。
- [ ] 主仓 mac-os-only-fans/ 目录处理：refactor-2.0.1 上 `git rm -r` + README 留链接——**用户操作项**（本计划输出指引，不代执行）。

### Task 1: 桥接口契约签署（双端）

- [ ] 新仓写 `docs/BRIDGE-PROTOCOL.md`：POST `http://127.0.0.1:17389/v1/usage`、Bearer 令牌（app 生成、用户粘贴到扩展）、快照 JSON schema（platform→card：displayName/planName?/status(ok|needs_login|no_subscription|error)/bars[{label,percent 0–1 已用,usedText?,resetAt? epoch ms}]/note?/errorMessage?/consoleUrl/fetchedAt epoch ms）、演进规则（只增字段、消费者忽略未知、未知 status 按 unavailable 兜底）、版本（v1 隐式，破坏变更升 /v2/usage）。
- [ ] 契约 fixture：`docs/bridge-fixtures/snapshot-v1.json`（四平台混合态样例：ok×2 + needs_login + error），双端各存一份。
- [ ] 新仓：BridgeSnapshot 对 fixture 的 decode 契约测试。
- [ ] 主仓：扩展侧 vitest——`refreshUsageCache` 产物 JSON.stringify 后与 fixture schema 对齐（字段名/status 枚举/类型断言），测试放 `tests/unit/usage/bridge-contract.test.ts`。

### Task 2: Kimi LevelDB 原生通道（新仓 UsageCore）

- [ ] `Sources/UsageCore/ChromeLocalStorage/`：
  - `SnappyDecoder`（内嵌 Snappy 解压最小实现：varint 前缀 +  Literal/Copy1/Copy2/Copy4 四 opcode，纯 Swift ~150 行，无第三方依赖）。
  - `LevelDBScanner`：.log 原始扫描 + .ldb 滑窗块解压（varint 长度前缀试探，探针已验证此朴素法可行）；目标 key：`\x01https://www.kimi.com\x00\x01access_token`；取**最后出现**（最新写入）的 value（首字节 \x01=UTF-8 / \x00=UTF-16LE 两种编码都要处理）。
  - `KimiTokenStore`：UserDefaults 缓存 + mtime 失效（leveldb 目录新于缓存则重扫）。
- [ ] `KimiNativeProvider`：GET 缓存 token → POST `https://www.kimi.com/apiv2/kimi.gateway.membership.v2.MembershipService/GetSubscriptionStats`（Bearer，与扩展同端点）→ `KimiParser` 解析；401 → 强制重扫 leveldb 重试一次；仍失败 → needs_login「请用 Chrome 打开一次 Kimi 控制台」。
- [ ] 接入 `NativeCookieProvider.fetchSnapshot()`：替换现在的 Kimi 恒 needsLogin 硬编码（注释更新）。
- [ ] 测试（TDD）：Snappy 解压（hand-crafted 压缩块 fixtures：literal/copy1/copy2）、key/value 提取（合成 leveldb 字节串，UTF-8/UTF-16 两态、多次写入取最后）、无记录 → nil；provider 走 stub scanner。
- [ ] 已知脆弱性写入代码注释 + README「已知限制」：Chrome 改 localStorage 存储格式/压缩策略即失效，后续迭代考虑内嵌 WebView。

### Task 3: 独立开发 mock 模式 + 文档（新仓）

- [ ] `USAGEBAR_MOCK=1` 环境变量（AppState init 检测）→ RefreshEngine 的 fallback 替换为 `MockProvider`（返回 docs/bridge-fixtures/snapshot-v1.json 的四平台快照），同事无扩展无 Chrome 会话也能开发三表面。
- [ ] 新仓 README 增「独立开发」节：同事上手三步（克隆 → `swift test` → `USAGEBAR_MOCK=1 ./scripts/dev-mac.sh run`），并指向 BRIDGE-PROTOCOL.md（唯一需要知道的"外部数据来源"）。
- [ ] 「已知限制」节：LevelDB 脆弱性、Kimi 走 Chrome localStorage 的依赖说明。

### Task 4: 回归 + 真机验收 + 重装

- [ ] 全量：UsageCore/UsageUI swift test 绿；主仓 vitest 绿（含新契约测试）。
- [ ] 真机：卸载/不装扩展状态下，app 四平台出数（Kimi 经 LevelDB 取到 token 显示真实 5h/周用量）→ 截图留证；mock 模式四平台出 fixture 数据 → 截图。
- [ ] `release-mac.sh 1.4.0` 安装 /Applications。
- [ ] 台账收尾（`.superpowers/sdd/progress.md` 仅记录决策与结果摘要，新仓自身记录在新仓 README/dev 文档）。

## 真机验收清单

1. 无扩展：四平台（含 Kimi）出真实数据。
2. 装回扩展并配对：桥推送优先，数据一致。
3. mock 模式：fixture 四平台全显。
4. 新仓独立构建/测试全绿；主仓 vitest 绿。
