# Dev Notes — Task 2: Kimi LevelDB 原生通道

日期：2026-07-26 ｜ 仓库：UsageBar ｜ Brief：主仓 `.superpowers/sdd/decouple-task2-brief.md`

## 结果

Kimi 原生取数通道落地：standalone UsageBar 不再依赖 Chrome 扩展也能取 Kimi 用量。
链路：Chrome localStorage LevelDB（`~/Library/Application Support/Google/Chrome/Default/Local Storage/leveldb`）
→ 自研 raw-snappy 解码 + 块行走扫描出 `access_token` → UserDefaults 缓存（mtime 失效重扫）
→ POST `GetSubscriptionStats`（Bearer、`{}` body）→ `KimiParser` → ok 卡。

## 变更文件

新增（`Packages/UsageCore/Sources/UsageCore/ChromeLocalStorage/`）：
- `SnappyDecoder.swift` — 纯 Swift 最小 raw-snappy 解码器，`decode(_:from:) -> (output, consumed)`；
  四 opcode 语义逐行对齐探针 `leveldb_probe.py`（varint 长度、literal 扩展长度、copy1/2/4、
  重叠拷贝逐字节）；抛 `SnappyError`（badVarint/tooBig/malformed/lengthMismatch）。
- `LevelDBScanner.swift` — `.log` 原始字节直查 + `.ldb` 块行走（成功 `p += consumed+5`，
  失败 `p += 1`）；key 锚定 `kimi.com\x00\x01access_token`（`\x00\x01` 前缀排除
  `anonymous_access_token`）；value `\x01`=UTF-8 / `\x00`=UTF-16LE；多版本按
  文件 mtime 升序 + 文件内顺序取最后命中；v1 固定 `Default` profile（头注释标注）。
  WriteBatch 布局（key + varint 值长 + value）与 SSTable 直接布局均兼容，
  WriteBatch 路径要求 payload 长度与 varint 值长恰好吻合以二次锚定。
- `KimiTokenCache.swift` — UserDefaults 缓存 token + 目录 max-mtime；mtime 未变不重扫；
  `forceRescan` 供 401 后绕过缓存；scanner/defaults/directory 全可注入。

修改：
- `Providers/NativeCookieProvider.swift` — 删除 kimi 恒 needsLogin 硬编码；新增
  `KimiTokenReading` 协议 + `LiveKimiTokenReader`（生产走 KimiTokenCache），init 第三参数注入；
  新私有 `fetchKimi()`：无 token → needs_login「请用 Chrome 打开一次 Kimi 控制台」；
  401 → 强制重扫重试一次，仍失败 → needs_login「access_token 已过期，请打开一次 Kimi 控制台」；
  成功判定与扩展 `fetchKimi` 一致（status 200 且 JSON 无 `code`，`code: null` 视同缺失）；
  网络/业务瞬时错误 → nil 缺席快照。其余三平台逻辑零改动。
- `README.md` — 刷新机制、验收步骤第 4 条去掉「Kimi 原生不可读」过时表述；
  新增「已知限制」段（Chrome 改存储格式/压缩策略即失效、后续 WKWebView 方案、v1 仅 Default
  profile）与隐私段一行（只读 access_token、不写入不外传）。

测试（`Packages/UsageCore/Tests/UsageCoreTests/`，全合成字节，不碰真实 Chrome 目录）：
- `SnappyDecoderTests.swift`（12）：literal/扩展长度/copy1（含高位偏移）/copy2/copy4、
  非零 offset、badVarint/tooBig/malformed/lengthMismatch 各错误路径，断言输出字节与 consumed。
- `LevelDBScannerTests.swift`（9）：.ldb UTF-8/UTF-16、垃圾前缀块行走、anonymous 与
  `access_token_expiry` 双干扰不误中、同文件多块取最后、跨文件按 mtime 取最后、
  .log WriteBatch UTF-8/UTF-16、空目录/无记录/目录缺失 → nil。
- `KimiTokenCacheTests.swift`（4）：mtime 未变命中缓存、mtime 变重扫、forceRescan 绕过、
  扫描落空清缓存。
- `NativeCookieProviderTests.swift`（净 +6）：删 `kimi恒needsLogin提示localStorage`，
  新增无 token/成功+Bearer 头+`{}` body/401 重扫换 token 成功（断言 calls `[false, true]`
  与两次 Authorization 头）/401 后仍 401/401 后重扫无 token（不重试）/带 code 缺席/网络错误缺席；
  StubHTTP 加按序队列 `queues`；全部构造注入 `StubKimiTokenReader`。

## TDD 过程

先写全部测试 → `swift test` 红（新类型未定义编译失败，Swift 新模块 TDD 的常态红色）
→ 实现 → 绿。中途发现 3 个旧测试的多行构造没被注入替换覆盖，默认 `LiveKimiTokenReader`
扫了真实 leveldb 导致单测 146s——补上注入后整套 0.34s。此事故同时实证：扫描器在真实
leveldb 目录上可运行（当时未命中，与「用户当前未登录 kimi」一致）。

## 验证

- `cd Packages/UsageCore && DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer swift test`
  → **91 tests in 16 suites passed after 0.340 seconds**（60 基线 + 31 新增，全绿）。
- `scripts/dev-mac.sh` → `built: .build/Build/Products/Debug/UsageBar.app`（绿）。

## 偏差与已知事项

1. **真机未验收**：用户 leveldb 当前无 access_token（未登录态），端到端「扫出真 token →
   200 → ok 卡」未实跑；需用户在 Chrome 打开一次 kimi.com 控制台后人工验收。
2. **全量扫描性能**：冷扫描对用户真实 leveldb 目录约几十秒级（块行走 p+=1 回退的固有成本），
   有 KimiTokenCache 的 mtime 缓存兜底，仅 mtime 变化或 401 时才重扫；后台 tick 调用不阻塞 UI
   （provider 本就是 async 后台取数）。如真机感到卡顿，下一步可做增量扫描（只扫变化的文件）。
3. **snappy copy off=0**：探针 Python 版 `out[-0]` 会意外拷贝首字节（Python 负索引特性），
   Swift 版按 snappy 规范判 malformed——更严格，真实块不会触发。
4. **token 提取启发式**：.ldb 直接布局下 value 无显式长度，按「可打印 ASCII 最长连续段」
   截 token（探针同级启发式）；WriteBatch 布局有 varint 值长做严格校验。

## 评审修复

日期：2026-07-26 ｜ Commit：`29b6a97` ｜ 范围：LevelDB 通道评审 1 项 Important + 2 项 Minor

**Important（落空态每 tick 全量冷扫）**：`KimiTokenCache` 原仅在扫描命中时回写
`lastScanMtime`，落空（未登录 / token 过期后 401 强制重扫仍只找到死 token）时连 mtime
一并清除，导致每个 30s 引擎 tick 都付一次全目录冷扫（实测几十秒级）。修复：每次扫描
（命中或落空）都回写 `lastScanMtime`；`token()` 在目录 max-mtime 与之一致时直接回上次
扫描结局（命中回缓存 token，落空回 nil）——**含 `forceRescan` 路径**：目录未变时强制
重扫不可能得到不同结局，参数仅为 `KimiTokenReading` 协议兼容保留，源码内中文注释说明。
`forceRescan` 的实际效果收敛为「mtime 已变时间接生效」，未变时零成本返回。

**Minor 1（文件序不确定）**：`LevelDBScanner` 排序由 `$0.mtime < $1.mtime` 改为
`(mtime, 文件名)` 二元组升序——Swift sort 对相等元素顺序不稳定，同 mtime 并列时按文件名
升序 tie-break（LevelDB 编号越大越新，后扫者命中胜出），扫描结局从此确定。

**Minor 2（401 后卡片文案在「打开控制台」/「已过期」间翻动）**：本修复自然稳定之——
扫描结局按目录状态缓存后，重扫抖动（如 leveldb compaction 中途读到半个目录 → 偶发落空
清缓存 → 下一 tick 又扫回死 token）不再发生；同一目录状态下 token 结局恒定，文案不再
来回翻。未引入额外状态机。

**TDD 过程**：先写测试 → 红（`扫描落空也记录mtime不再重扫` scans=2≠1、
`强制重扫目录未变不重复扫描` scans=2≠1）→ 实现 → 绿。注意：旧测试 `强制重扫绕过缓存`
编码的正是评审要求移除的旧语义，已按新契约改写（未变不扫、变了照扫），非删除。
`落空后mtime变化再次重扫` 与 `同mtime并列按文件名升序取最后命中` 在旧实现下碰巧也绿
（前者本就如此，后者依赖不稳定的 sort 顺序），作为回归守卫保留。

**验证**：`cd Packages/UsageCore && DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
swift test` → **94 tests in 16 suites passed after 0.350 seconds**（91 + 净增 3：
KimiTokenCacheTests 4→6、LevelDBScannerTests 9→10）。

**变更文件**：`KimiTokenCache.swift`（核心修复）、`LevelDBScanner.swift`（tie-break +
头注释）、`NativeCookieProvider.swift`（协议注释一行，同步 forceRescan 新语义）、
`KimiTokenCacheTests.swift`、`LevelDBScannerTests.swift`。
