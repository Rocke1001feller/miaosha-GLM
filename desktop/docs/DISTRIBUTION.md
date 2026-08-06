# Coding Plan Assistant 分发指南（维护者）

面向发布维护者：如何把 Coding Plan Assistant（macOS app + 配套 Chrome 扩展）交付给最终用户。最终用户步骤见 [USER-GUIDE.md](USER-GUIDE.md)。

## 产物组成（两件，缺一不可）

Coding Plan Assistant 是「app + Chrome 扩展」套装：扩展抓取用量并经 `127.0.0.1:17389` 本地桥推送给 app。只发 app 用户看不到数据（除桥离线兑底的三个平台外）。

| 产物 | 构建命令 | 输出 | 签名 |
|---|---|---|---|
| macOS app | `desktop/scripts/release-mac.sh 1.1.0` | `desktop/.build/CodingPlanAssistant-1.1.0.zip` | ad-hoc（未公证） |
| Chrome 扩展 | `web/` 下 `pnpm zip` | `web/output/coding-plan-assistant-web-<版本>-chrome.zip` | 无（用户开发者模式加载） |

构建前置：Xcode（≥15）、xcodegen、pnpm。CLT 机器脚本已自动处理 `DEVELOPER_DIR`。

发布前回归基线（必须全绿）：

```bash
(cd web && pnpm vitest run)                                      # 扩展 253
(cd desktop/Packages/UsageCore && swift test)                # 97
(cd desktop/Packages/UsageUI && swift test)                  # 16
desktop/scripts/dev-mac.sh                                   # Debug 构建
```

## 发布步骤（GitHub Releases，推荐）

1. 打 tag 并推送：`git tag codingplanassistant-v1.1.0 && git push origin codingplanassistant-v1.1.0`（app 与扩展同仓，tag 前缀区分产品版本）。
2. 在 GitHub 仓库 → Releases → Draft a new release：选该 tag，标题 `Coding Plan Assistant v1.1.0`。
3. 上传两个 zip 作为 Assets：
   - `CodingPlanAssistant-1.1.0.zip`（macOS app）
   - `coding-plan-assistant-web-3.0.0-chrome.zip`（配套扩展，版本号以 web/package.json 为准）
4. Release notes 里粘贴 [USER-GUIDE.md](USER-GUIDE.md) 的「安装三步」摘要，并链接完整文档。
5. Publish。

私有仓库注意：私有 repo 的 Release Asset 下载需要登录授权，外部用户拿不到；对外分发请用公开仓库 Release、或任何静态托管（OSS/CDN/网盘）放两个 zip，链接发给用户即可。

## 签名与公证现状（重要）

- app 当前为 **ad-hoc 签名、未公证**：用户首次运行必须 `xattr -dr com.apple.quarantine /Applications/CodingPlanAssistant.app`（或右键 → 打开）。这是分发体验的最大摩擦点，务必在用户文档中醒目标注。
- 扩展为 **解压加载（开发者模式）**：用户需在 `chrome://extensions` 开启开发者模式后「加载已解压的扩展程序」。上架 Chrome Web Store 后可消除此步骤。

## 长期路线（消除摩擦）

1. **Developer ID + 公证**：有 Apple 付费开发者账号后，`scripts/release-mac.sh` 已预留 hook（`DEVELOPER_ID` 环境变量），走 `codesign --sign "Developer ID Application"` + `notarytool` 公证，用户双击即用。
2. **Chrome Web Store 上架**：`pnpm zip` 产物即商店包格式；上架后用户一键安装，且自动更新。
3. 两者落地前，每次发版都必须随包附带 USER-GUIDE.md 链接。

## 版本号约定

- app：`release-mac.sh <版本>` 注入 `MARKETING_VERSION`（如 1.1.0）。
- 扩展：`package.json` 的 `version`（如 3.0.0），两者独立演进；Release notes 里写清配套关系（哪个 app 版本需要 ≥ 哪个扩展版本）。桥协议（`POST /v1/usage`，Bearer token，快照 JSON 字段）是兼容边界：改协议必须双端同发。
