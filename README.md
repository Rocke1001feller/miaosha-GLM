# Coding Plan Assistant（Coding Plan 助手）

macOS 菜单栏用量监控：把 Kimi Code、小米 MiMo、MiniMax、火山引擎四个平台的额度用量钉在菜单栏、浮层与桌面浮窗上。

**完全独立运行**：无需任何浏览器扩展——MiniMax / 小米 MiMo / 火山引擎经 Chrome cookie 原生直取，Kimi Code 经 Chrome localStorage（LevelDB）读取 access_token。配套 Chrome 扩展（miaosha-GLM）只是**可选**的数据增强通道（127.0.0.1 本地桥推送，契约见 [docs/BRIDGE-PROTOCOL.md](docs/BRIDGE-PROTOCOL.md)）。

> 当前版本：**v1.4.1**。版本历史：`git tag -l`（Release zip 由 `scripts/release-mac.sh <版本>` 产出）。
>
> - v1.4.x：彻底去桥化（Kimi LevelDB 原生通道）、mock 独立开发模式、SwiftUI 主线程告警修复
> - v1.3.x：三主题收敛（新粗野默认 / 瑞士排版 / 系统）、AppIcon、orb 圆角修复
> - v1.1.x：菜单栏 5h 细粒度、菜单栏↔浮窗联动、多彩主题
> - v1.0.x：三表面架构 + 桥 + 原生兑底

> 截图占位：
>
> | 菜单栏 | 菜单栏浮层 | 桌面浮窗 |
> | --- | --- | --- |
> | （待补 `docs/screenshots/menubar.png`） | （待补 `docs/screenshots/popover.png`） | （待补 `docs/screenshots/widget.png`） |

## 功能：三个表面

- **菜单栏**：常驻显示 5h 细粒度用量最高的平台（短名 + 该平台最细窗口百分比），点击展开浮层；与桌面浮窗显示同一平台（联动）。
- **菜单栏浮层**：四平台用量卡片列表（套餐、各窗口用量条、重置时间、状态），footer 提供更新时刻、手动刷新、显示浮窗、点击穿透开关与设置入口。
- **桌面浮窗**：280×170 磨砂卡片，显示与菜单栏联动的当前平台（卡片箭头可手动切换，下次数据刷新自动回到 5h 最高平台），2s 无交互收缩为 80×80 悬浮球（点击球展开）。支持拖动、右键菜单（切换平台/收缩/置顶/透明度/穿透）、置顶、透明度调节、点击穿透；位置与开关状态跨启动记忆。
- **外观**：新粗野（默认，平台撞色 + 粗黑边硬影）/ 瑞士排版（白底黑字超大数字）/ 系统（磨砂 + 用量三档色）三配色，设置页「外观」分区切换，浮窗/浮层即时生效；菜单栏文本受 macOS 限制恒为单色。

卡片状态机：`ok`（正常）/ `stale`（超时未更新）/ `unavailable` / `needs_login`（引导打开控制台登录）/ `loading`。

## 安装

> 端到端用户步骤（含配套 Chrome 扩展安装与配对）见 [docs/USER-GUIDE.md](docs/USER-GUIDE.md)；分发流程见 [docs/DISTRIBUTION.md](docs/DISTRIBUTION.md)。

1. 解压 `CodingPlanAssistant-<版本>.zip`，把 `CodingPlanAssistant.app` 拖入 `/Applications`。
2. 首次运行前移除隔离属性（v1 为 ad-hoc 签名，未公证）：

   ```bash
   xattr -dr com.apple.quarantine /Applications/CodingPlanAssistant.app
   ```

3. 启动 app（LSUIElement，无 Dock 图标，只出现在菜单栏）。
4. 可选：设置页打开"登录时启动"（SMAppService 登录项；若提示需批准，到 系统设置 → 通用 → 登录项与扩展 允许 Coding Plan Assistant）。

## 独立开发（无扩展 / 无 Chrome 会话）

同事 clone 仓库后即可开发全部三个表面（菜单栏 / 浮层 / 浮窗），数据来自内置 mock 夹具，**不需要** Chrome 扩展、不需要任何浏览器会话：

```bash
git clone <仓库地址> && cd CodingPlanAssistant
(cd Packages/UsageCore && swift test)        # 验证工具链与契约测试全绿
CODINGPLANASSISTANT_MOCK=1 ./scripts/dev-mac.sh run     # 构建并以前台 mock 模式启动（Ctrl+C 退出）
```

`CODINGPLANASSISTANT_MOCK=1` 把节奏引擎的兜底通道换成 `MockProvider`（返回 `docs/bridge-fixtures/snapshot-v1.json` 的内嵌副本：kimi/mimo 双 ok 卡、minimax needs_login、volcengine unavailable，足以覆盖各卡片状态 UI）。桥照常接线——此模式下若真实扩展推送进来，真实数据仍然优先，mock 只占兜底槽。

关于外部数据源，你**唯一**需要读的是 [docs/BRIDGE-PROTOCOL.md](docs/BRIDGE-PROTOCOL.md)（快照 JSON 契约：平台键、status 归并规则、毫秒 epoch）。桥本身是**可选**的：app 不依赖扩展即可运行，推送缺失对两侧都静默。

## 配对（app ↔ Chrome 扩展）

1. 打开 Coding Plan Assistant 设置页（菜单栏浮层 →"设置…"），在"桥配对"分区点"复制"令牌。
2. 打开 Chrome 扩展的选项页（options），把令牌粘贴到"Coding Plan Assistant 桥配对"输入框。
3. 扩展开始按节奏向 `http://127.0.0.1:17389/v1/usage` 推送（Bearer 鉴权），≤90s 内 app 三个表面出现真实数据。
4. 令牌可随时在设置页"重新生成"——生成后扩展侧需同步更新。令牌仅存于本机 UserDefaults。

## 刷新机制

- **扩展推送**：基础每 60s 推一次全量快照；任一平台 `resetAt` 落入 ±15min 重置窗口时加速到 30s（chrome.alarms 下限 0.5min）。
- **app 节奏引擎**：30s tick 评估 stale——距上次桥推送超过 10min，ok 卡转 `stale` 并标记"桥离线"。
- **桥离线兑底**：桥离线期间，每 tick 由原生兑底通道直读 Chrome 凭证调平台接口刷新（MiniMax/MiMo/火山读 cookie；Kimi 直读 localStorage LevelDB 取 access_token，从未在 Chrome 打开过 kimi.com 则落 `needs_login` 引导）。桥恢复后卡片自动回 `ok`。
- **冷启动**：上次的桥推送快照缓存在 `~/Library/Application Support/CodingPlanAssistant/snapshot.json`，启动先展示缓存再等新数据。

## 卸载

```bash
# 先退出 app（菜单栏浮层 → 关闭，或 Activity Monitor 结束 Coding Plan Assistant）
rm -rf /Applications/CodingPlanAssistant.app
rm -rf ~/Library/Application\ Support/CodingPlanAssistant
defaults delete app.codingplanassistant.mac 2>/dev/null || true
# 若开过"登录时启动"：系统设置 → 通用 → 登录项与扩展 中移除 Coding Plan Assistant
```

## 已知限制

- **Kimi 原生通道依赖 Chrome localStorage 的内部存储格式**（LevelDB + raw-snappy 压缩块，自研解码器直读）：Chrome 一旦更改存储格式或压缩策略该通道即失效，届时 Kimi 卡回落 `needs_login`（扩展桥通道不受影响）。后续迭代考虑内嵌 WKWebView 读取以摆脱格式依赖。v1 仅扫描 `Default` profile，未支持 `Profile *`。
- 原生兑底通道读 Chrome 凭证要求本机装有 Chrome 且已登录对应平台。
- `CODINGPLANASSISTANT_MOCK=1` 仅供开发：mock 卡为夹具定值（百分比/文案不反映真实用量），生产构建请勿设置。

## 隐私

- 桥服务只绑定 **127.0.0.1** 环回接口（`NWParameters.requiredInterfaceType = .loopback`），令牌 Bearer 鉴权，数据不出本机。
- 原生兑底通道仅在桥离线时访问对应平台官方接口（与你浏览器里的会话等价），不向任何第三方发送数据。
- Keychain 仅用于**读取** "Chrome Safe Storage" 口令以解密本机 Chrome cookie，不写入。
- Kimi 通道仅**读取** Chrome localStorage LevelDB 中 kimi.com 的 access_token，不写入、不外传。
- 全部状态（令牌、浮窗偏好、快照缓存）只落在本机 UserDefaults 与 Application Support。

## 开发

```bash
# 构建 + 运行（Debug，bundle id app.codingplanassistant.mac.dev）
./scripts/dev-mac.sh run

# 单元测试（UsageCore 与 UsageUI 两个 package 都要跑）
(cd Packages/UsageCore && swift test)
(cd Packages/UsageUI && swift test)

# 打包 Release zip（bundle id app.codingplanassistant.mac）
./scripts/release-mac.sh 0.1.0   # 产物 .build/CodingPlanAssistant-0.1.0.zip
```

依赖：Xcode（≥15，Swift 5.9）、[xcodegen](https://github.com/yonaskolb/XcodeGen)、macOS 14+ 部署目标。

**CLT 机器注意**：若 `xcode-select -p` 指向 `/Library/Developer/CommandLineTools`，`xcodebuild`/`swift test` 需要完整 Xcode。`dev-mac.sh` 与 `release-mac.sh` 已自动探测：CLT 且 `/Applications/Xcode.app` 存在时自动 `export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`，无需手动处理。手动跑 `swift test` 时需自行前置该环境变量。

**生成物约定**：`CodingPlanAssistant/Info.plist` 与 `CodingPlanAssistant.xcodeproj/` 均为 xcodegen 由 `project.yml` 确定性生成的**只读生成物，勿手改**——改配置请编辑 `project.yml` 后重新 `xcodegen generate`。其中 `Info.plist` 已入库便于审查 diff，`*.xcodeproj/` 被 `.gitignore` 排除。

### 目录结构

```
CodingPlanAssistant/
├── project.yml              # xcodegen 工程定义（Release bundle id: app.codingplanassistant.mac）
├── CodingPlanAssistant/
│   ├── Info.plist           # 生成物（只读）
│   └── Sources/             # App 层：装配、菜单栏、浮层、设置、浮窗
│       ├── CodingPlanAssistantApp.swift
│       ├── AppState.swift
│       ├── MenuBarLabel.swift
│       ├── Popover/
│       ├── Settings/
│       └── Widget/
├── Packages/
│   ├── UsageCore/           # 模型/解析器/桥服务/节奏引擎/兑底 provider（含测试）
│   └── UsageUI/             # SwiftUI 视图组件与格式化（含测试）
└── scripts/
    ├── dev-mac.sh           # Debug 构建（可选 run）
    └── release-mac.sh       # Release 打包 zip
```

扩展侧源码见仓库根目录 `entrypoints/` 与 `lib/usage/`（WXT + Vitest：`pnpm vitest run`）。

## 验收步骤（真机终验）

以下各项需在本机完整走一遍，逐项打勾：

1. `./scripts/dev-mac.sh run` 启动，菜单栏显示最高用量平台。
2. 扩展 options 粘贴令牌后 ≤90s 内，app 三表面（菜单栏/浮层/浮窗）出现真实四平台数据，且与扩展 popup 一致。
3. 浮窗拖动 / 菜单栏联动（手动切换同步、刷新回弹）/ 2s 收缩球（点击展开）/ 右键菜单（切换平台、置顶、透明度、穿透）全部可用。
4. 退出 Chrome → ≤10min 后卡片转 `stale` 标"桥离线"；原生兑底通道仍刷新 MiniMax（Kimi 若曾在 Chrome 打开过 kimi.com 亦原生刷新，从未打开则落 `needs_login` 符合预期）。
5. 重开 Chrome → 桥恢复，卡片回 `ok`。
6. `swift test`（UsageCore）与 `pnpm vitest run`（扩展）全绿。
7. `./scripts/release-mac.sh 0.1.0` 产出 `.build/CodingPlanAssistant-0.1.0.zip`。
