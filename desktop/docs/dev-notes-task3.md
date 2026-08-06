# Dev Notes — Task 3: 独立开发 mock 模式（USAGEBAR_MOCK=1）+ 同事上手文档

日期：2026-07-26 ｜ 仓库：UsageBar ｜ Brief：主仓 decouple plan Task 3

## 结果

同事 clone 仓库后，无需 Chrome 扩展、无需任何浏览器会话，即可用真实感数据开发
菜单栏 / 浮层 / 桌面浮窗三个表面：`USAGEBAR_MOCK=1 ./scripts/dev-mac.sh run`。
引擎 fallback 槽换为 `MockProvider`（内嵌四平台夹具），桥照常接线——真实扩展推送仍优先，
mock 只占兜底路径。

## 变更文件

新增：
- `Packages/UsageCore/Sources/UsageCore/Providers/MockFixture.swift` — 编译期内嵌夹具，
  与 `../shared/bridge/fixtures/snapshot-v1.json` **逐字节一致**（含末尾换行，Swift 多行
  raw 字符串不吞行尾换行，故显式 `+ "\n"` 补齐）。
- `Packages/UsageCore/Sources/UsageCore/Providers/MockProvider.swift` —
  `public final class MockProvider: UsageProvider`（`id = "mock-fixture"`）。
  `fetchSnapshot()` 走 `BridgeSnapshot.decode(MockFixture.snapshotV1Data)`，
  与桥消费路径完全同一解码器；**每次拉取把各卡 `fetchedAt` 重打为当前时刻**——
  夹具内是定值时间戳，不重打则拉取 10 分钟后（`UsageStore.staleThreshold`）ok 卡
  被 `evaluateStaleness` 转 stale，独立开发时无法常看 ok 态。
- `Packages/UsageCore/Tests/UsageCoreTests/MockProviderTests.swift`（3 测试）：
  四平台与状态映射（预期复用 BridgeContractTests：kimi/mimo ok、minimax needsLogin、
  volcengine unavailable）；fetchedAt 重打在拉取时刻区间内；内嵌夹具与磁盘夹具
  逐字节一致（防漂移，改夹具后须重新生成 MockFixture.swift）。

修改：
- `UsageBar/Sources/AppState.swift` — `makeWiredBridge` 内按
  `ProcessInfo.processInfo.environment["USAGEBAR_MOCK"] == "1"` 选
  `MockProvider()` 或 `NativeCookieProvider()`（注释标明：mock 是给无扩展/无会话的
  独立开发场景）。桥、磁盘缓存、引擎其余接线零改动。
- `scripts/dev-mac.sh` — `run` 分支：`USAGEBAR_MOCK` 非空时 `exec` 直接前台执行
  二进制（`open(1)` 不向子进程传环境变量，这是 mock 能生效的关键；Ctrl+C 退出），
  否则维持原 `open` 行为。
- `README.md` — 新增「独立开发（无扩展 / 无 Chrome 会话）」段（位置：安装之后、
  配对之前）：三步上手（clone → `swift test` → `USAGEBAR_MOCK=1 ./scripts/dev-mac.sh run`），
  指明 `../shared/bridge/BRIDGE-PROTOCOL.md` 是关于外部数据源唯一需要读的文档、桥本身可选；
  「已知限制」补一条 mock 仅供开发、数据为夹具定值。

## 关键决策：内嵌字符串而非 Bundle resource

app target 由 xcodegen（`project.yml`）确定性生成，sources 仅 `UsageBar/Sources` 与
`Assets.xcassets`，无资源拷贝配置；为一份开发夹具引入 xcodegen 资源声明（且要重新
生成只读生成物 Info.plist / xcodeproj）得不偿失。编译期内嵌字符串零构建配置，
`swift test`（SPM）与 `.app`（xcodebuild）两种运行方式天然都可用——运行期
`#filePath` 相对路径在 .app 场景不成立（源码树不存在于用户机器），故仅测试用它做
防漂移校验，运行期只吃内嵌常量。

## 生成与逐字节校验（报告要求记录）

生成（python3，仓库根）：

```bash
python3 - <<'EOF'
from pathlib import Path
fixture = Path("../shared/bridge/fixtures/snapshot-v1.json").read_text(encoding="utf-8")
assert '"""#' not in fixture
body = fixture[:-1] if fixture.endswith("\n") else fixture
trailing = ' + "\\n"' if fixture.endswith("\n") else ""
# ... 包入 MockFixture.swift 模板（头注释 + enum + snapshotV1Data 便捷属性）
EOF
```

校验（本轮已执行）：从 `MockFixture.swift` 正则提取 `#"""` 与 `"""#` 间内容并补回
`+ "\n"` 语义，与 `../shared/bridge/fixtures/snapshot-v1.json` 全文 `==` 比较 →
**byte-identical OK, 1377 bytes**。另有常驻防漂移测试
`内嵌夹具与共享夹具文件逐字节一致` 在每次 `swift test` 强校验同一断言。

## 验证

- `cd Packages/UsageCore && DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer swift test`
  → **97 tests in 17 suites passed after 0.351 seconds**（94 基线 + 3 新增，全绿）。
- `USAGEBAR_MOCK=1 scripts/dev-mac.sh` → `built: .build/Build/Products/Debug/UsageBar.app`（绿）。
- 冒烟：`USAGEBAR_MOCK=1` 直接前台执行产物二进制，6s 存活无启动崩溃，kill 干净退出。

## 偏差与已知事项

1. **三表面 UI 未逐项人眼验收**（菜单栏/浮层/浮窗渲染 mock 卡）：本轮只验证到
   进程级存活与单测/构建绿；同事按 README 三步跑起来即可目检。
2. **mock 不绕过冷启动宽限**：首次运行（无磁盘缓存）`hasUsableCard == false` 会立即
   拉一次 mock 兜底，数据秒现；若磁盘缓存已有可用卡，则按既有宽限逻辑 ≤90s 后
   首个 tick 才拉 mock——语义与生产 fallback 完全一致，未为 mock 特设快路径。
3. **dev-mac.sh 前台 exec 的取舍**：mock 模式占用终端（日志直出 stderr/stdout，
   对开发反而是优点），Ctrl+C 即退出；未设置 `USAGEBAR_MOCK` 时行为与旧版一致。
4. **fetchedAt 重打与协议的偏离是有意的**：桥契约里 fetchedAt 是数据时刻；
   mock 为保 ok 态常显而重打，仅存在于 MockProvider 内部，不影响 BridgeServer 路径。
