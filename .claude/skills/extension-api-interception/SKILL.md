---
name: extension-api-interception
description: Captures network requests from web pages in Chrome Extensions by intercepting fetch/XHR in the MAIN JS world and re-fetching via API if needed. Use when building data extraction extensions that need to intercept page requests, capture chat data, or extract API responses. This is the Phase 2 practical guide for Four-Phase Structured Development methodology. Triggers: "intercept requests", "capture network data", "extension interception", "MAIN world patch", "monkey patch"
---

# Extension API Interception

**定位**: 这是 `.claude/skills/four-phase-structured-dev/SKILL.md` 中 **Phase 2: Empirical Exploration** 的实际操作指南。

**前置必读**: `docs/cross-platform-patterns.md` — 开始任何新平台的 Phase 2 前，先查阅跨平台模式手册中的已知模式，避免重复踩坑。

Technique for reliably extracting data from single-page applications (SPAs) in Chrome Extensions by intercepting the fetch/XHR calls the page itself makes.

---

## Context: 在 Four-Phase Structured Development 中的位置

```
Phase 1: Interface Architecture → Mock/Stub → Verify
Phase 2: Empirical Exploration → Data + Method Diversity  ← 本技能所在
Phase 3: Architecture Review → Gap Analysis → Micro-adjustments
Phase 4: Precision Implementation → Build → Test → Deliver
```

本技能为 Phase 2 提供系统化的 API 拦截与验证流程，确保在进入 Phase 4 实现之前，技术方案已通过实证验证。

---

## Input & Output

### Input (输入)
- **站点名称** (如 `ChatGPT`, `Perplexity`, `Claude`)
- 或 **具体的聊天记录详情页 URL** (如 `https://chatgpt.com/c/xxx`)

### Output (输出)
1. **经过验证的 API 端点**: 确认可用的 API URL、Method、Headers
2. **可直接集成的代码片段**:
   - M1 代码片段 (MAIN World Fetch Interception)
   - M6 代码片段 (API Re-fetch)
3. **验证状态**:
   - 代码片段已被独立测试过
   - 可以获取原始 API response 的 raw JSON
   - JSON 中的数据是页面 DOM 渲染的数据来源
   - 内容丰富度 ≥ AI 聊天详情页 DOM 渲染的数据

---

## Core Principle

Chrome Extensions have **3 isolated JavaScript contexts**. Content Scripts (ISOLATED world) cannot access page's `window.fetch` or `window.XMLHttpRequest`. Solution: **inject code into MAIN world** to intercept requests before Content Script can see them, then relay captured data back.

| Context | Access | Use Case |
|---------|--------|----------|
| **MAIN** | `window.fetch`, `window.XMLHttpRequest` | Intercept requests ✅ |
| **ISOLATED** | DOM only | Cannot access page APIs ❌ |
| **EXTENSION** | Sandboxed API | No page access ❌ |

---

## 核心步骤 (Core Steps)

### Step 1: 挑选三个具备多样性的 URL（最难优先）

**目标**: 从目标站点选择 3 个聊天详情页 URL，**第一个 URL 必须覆盖该平台已知最难的能力维度**。

**核心原则：Hardest-Case-First（最难样本优先）**

> 不要从纯文本 happy path 开始定义完成度。第一个验收样本必须命中该平台最容易爆炸的能力组合。
> 如果第一个 URL 的 M1/M6 就搞不定，说明技术方案有根本缺陷，越早发现越好。

**每个平台的"最难能力"不同，但通常来自以下维度**：

| 难度维度 | 典型表现 | 为什么难 |
|----------|----------|----------|
| **图片/文件** | 消息中嵌入图片、上传文件 | 涉及资产链路：transport → resolve → render，不是纯 JSON |
| **代码块** | 多语言代码 + 语法高亮 | highlight.js 静默失效、长代码截断 |
| **长对话分页** | 50+ 消息、API 分页 | 需要拼接多页、保持顺序不变 |
| **分支/多轮** | 同一消息的多个回复版本 | 树结构 mapping，非线性消息流 |
| **thinking** | AI 的推理过程块 | 独立内容类型，需要特殊渲染 |
| **公式** | LaTeX / KaTeX 数学公式 | 需要数学渲染引擎支持 |
| **sources/citations** | 引用来源链接 | 嵌套数据结构，需要 normalize |

**选样规则**：

| # | 要求 | 说明 |
|---|------|------|
| URL 1 | **最难能力** | 包含该平台最复杂的内容类型（图片+代码+长对话优先） |
| URL 2 | **中等复杂** | 包含至少 2 种内容类型，15+ 消息 |
| URL 3 | **基线验证** | 短消息 + 纯文本，验证 happy path 不被复杂逻辑破坏 |

**工具**: MCP Chrome DevTools

**步骤**:
1. 连接已登录 Chrome
2. 导航到目标站点 (如 `https://chatgpt.com`)
3. 打开侧边栏，浏览聊天历史记录
4. 使用以下 MCP Chrome DevTools 工具进行导航和选择:

**Input Automation (9 tools)**:
- `click` - 点击聊天记录项
- `drag` - 拖拽滚动
- `fill` / `fill_form` - 填写搜索框
- `hover` - 悬停查看详情
- `press_key` / `type_text` - 键盘操作

**Navigation Automation (6 tools)**:
- `list_pages` - 查看已打开页面
- `navigate_page` - 导航到 URL
- `new_page` - 打开新标签页
- `select_page` - 切换到指定页面
- `wait_for` - 等待页面加载完成

5. 选择 3 个聊天（最难优先）:
   - URL 1: **最难** — 该平台最复杂的内容组合（图片+代码+长对话）
   - URL 2: **中等** — 至少 2 种内容类型，15+ 消息
   - URL 3: **基线** — 短消息 + 纯文本（验证复杂逻辑不破坏简单场景）
6. 记录每个 URL 的特征，**特别标注 URL 1 覆盖了哪些难度维度**

**输出**:
```markdown
### 测试集

| # | URL | 消息数 | 内容类型 | 时间 |
|---|-----|--------|----------|------|
| 1 | https://chatgpt.com/c/xxx1 | 3条 | 纯文本 | 最近 |
| 2 | https://chatgpt.com/c/xxx2 | 15条 | 含代码块 | 7天前 |
| 3 | https://chatgpt.com/c/xxx3 | 50条+ | 含图片 | 30天前 |
```

---

### Step 2: 调试并获取 M1 和 M6 所需的 API

**目标**: 对于 Step 1 中的每个 URL，使用 MCP Chrome DevTools 调试工具，直到拿到 M1 和 M6 需要用到的 API 接口端口、request 和 response。

**工具**: MCP Chrome DevTools

**Network (2 tools)**:
- `list_network_requests` - 列出所有网络请求，过滤 XHR/Fetch
- `get_network_request` - 获取特定请求的详细信息

**Debugging (6 tools)**:
- `evaluate_script` - 在页面上下文中执行 JavaScript
- `get_console_message` / `list_console_messages` - 查看控制台日志
- `take_snapshot` - 获取页面快照

**步骤** (对每个 URL 逐一执行):

1. 导航到测试集 URL (使用 `navigate_page`)
2. 打开 Network 面板 (使用 `list_network_requests` 过滤 XHR/Fetch)
3. 找到返回聊天数据的 API 请求
4. 记录: URL、Method、Headers、Response 结构
5. **验证 M1**: 注入拦截代码，确认能捕获 API 响应
6. **验证 M6**: 使用 API 信息重新请求，确认能获取数据

**M1 验证** (通过 `evaluate_script` 注入):

```javascript
// 在 MAIN world 注入 fetch 拦截器
(function() {
  if (window.__chatInterceptorActive) return;
  window.__chatInterceptorActive = true;

  const captured = [];
  const originalFetch = window.fetch;

  window.fetch = async (...args) => {
    const url = typeof args[0] === 'string' ? args[0] : args[0].url;

    // 检查是否是目标 API (根据实际站点调整)
    if (url.includes('/conversation') || url.includes('/api/chat')) {
      const response = await originalFetch.apply(this, args);
      try {
        const clone = response.clone();
        const data = await clone.json();
        captured.push({ url, timestamp: Date.now(), data });
        console.log('[M1] Captured', data.messages?.length || 0, 'messages');
        window.postMessage({ type: '__API_CAPTURED', payload: captured }, '*');
      } catch (e) {
        console.error('[M1] Parse error:', e);
      }
      return response;
    }

    return originalFetch.apply(this, args);
  };

  window.__capturedChatData = captured;
  console.log('[M1] Interceptor installed');
})();
```

**M6 验证** (通过 `get_network_request` 获取 API 信息后):

```javascript
// 使用 API 信息重新请求
async function reFetchAPI(apiUrl) {
  const cookies = await chrome.cookies.getAll({ url: apiUrl });
  const cookieHeader = cookies.map(c => `${c.name}=${c.value}`).join('; ');

  const response = await fetch(apiUrl, {
    headers: {
      'Cookie': cookieHeader,
      'User-Agent': 'Mozilla/5.0...'
    }
  });

  return response.json();
}
```

**输出** (每个 URL):
```markdown
### [Site Name] - URL #{n}

**Page URL**: https://...

**API Endpoint**:
- URL: `GET https://xxx.com/api/conversations/{id}`
- Auth: Cookie / Bearer Token

**M1 验证**: ✅/❌ (捕获消息数: N)
**M6 验证**: ✅/❌ (获取消息数: N)
**资产链路**: ✅/❌ (非文本资产数: N, 可渲染: N)
**M1/M6 等价**: ✅/❌ (messages 数量差: 0, 顺序一致: Y/N)
**阶段诊断就绪**: ✅/❌ (每个 catch 块是否带有阶段标签: capture/parse/normalize/resolveAsset/render)
```

> **阶段标签规范**: 每个平台 slice 代码中的错误日志必须包含阶段前缀 `[CAPTURE_FAIL]` / `[PARSE_FAIL]` / `[NORMALIZE_FAIL]` / `[ASSET_FAIL]` / `[RENDER_FAIL]`。这是 Phase 4 排障的唯一线索。详见 `four-phase-structured-dev/SKILL.md` Phase 4 的「阶段级可观测性」。

---

### Step 3: Report - 沉淀可集成的代码片段 + 平台 Dossier

**目标**: 输出两类产物：
1. 经过验证的、可直接集成的 M1 和 M6 代码片段
2. 平台 Dossier 初稿（见 `four-phase-structured-dev/SKILL.md` Phase 2 Output 中的 Dossier 模板）

**Step 3 完成标准**：
- [ ] 验证报告包含 M1/M6 代码片段
- [ ] 平台 Dossier 的 §1-§5 已填写（接口拓扑、认证、顺序语义、资产链路、M1/M6 策略）
- [ ] Dossier 的 §7 已验证样本矩阵已填写
- [ ] 三类 Fixture 已保存到 `tests/fixtures/{platform}/`（见 Fixture Bank 要求）

**输出格式**:

```markdown
## 验证报告: [Site Name]

### 测试集

| # | URL | 消息数 | 内容类型 | 时间 |
|---|-----|--------|----------|------|
| 1 | https://... | 3条 | 纯文本 | 最近 |
| 2 | https://... | 15条 | 含代码块 | 7天前 |
| 3 | https://... | 50条+ | 含图片 | 30天前 |

### API Endpoint

- **URL**: `GET https://xxx.com/api/conversations/{id}`
- **Method**: GET
- **Auth**: Cookie / Bearer Token

### M1 验证结果 (MAIN World Monkey Patch)

| 测试集 | URL | 捕获成功 | 消息数 | 数据完整 |
|--------|-----|:--------:|:------:|:--------:|
| #1 | https://... | ✅ | 3 | ✅ |
| #2 | https://... | ✅ | 15 | ✅ |
| #3 | https://... | ✅ | 50+ | ✅ |

**结论**: M1 ✅ 稳定通过 (3/3)

### M6 验证结果 (API Re-fetch)

| 测试集 | API URL | 请求成功 | 消息数 | 数据完整 |
|--------|---------|:--------:|:------:|:--------:|
| #1 | https://... | ✅ | 3 | ✅ |
| #2 | https://... | ✅ | 15 | ✅ |
| #3 | https://... | ✅ | 50+ | ✅ |

**结论**: M6 ✅ 稳定通过 (3/3)

### 可集成代码片段

#### M1: MAIN World Interceptor

```typescript
// interceptor.ts
async function injectInterceptor(tabId: number, apiPattern: string) {
  await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN', // ← Critical: MAIN world, not ISOLATED
    func: (pattern: string) => {
      if (window.__interceptorActive) return;
      window.__interceptorActive = true;
      const captured: any[] = [];

      const originalFetch = window.fetch;
      window.fetch = async function(...args) {
        const url = typeof args[0] === 'string' ? args[0] : args[0].url;
        if (url.includes(pattern)) {
          const response = await originalFetch.apply(this, args);
          try {
            const clone = response.clone();
            const data = await clone.json();
            captured.push({ url, timestamp: Date.now(), data });
            window.postMessage(
              { type: 'API_CAPTURED', payload: data },
              '*'
            );
          } catch {}
          return response;
        }
        return originalFetch.apply(this, args);
      };
      window.__capturedData = captured;
    },
    args: [apiPattern],
  });
}
```

#### M6: API Re-fetch

```typescript
// retry-handler.ts
async function reFetchAPI(apiUrl: string): Promise<any> {
  const cookies = await chrome.cookies.getAll({ url: apiUrl });
  const cookieHeader = cookies
    .map((c) => `${c.name}=${c.value}`)
    .join('; ');

  const response = await fetch(apiUrl, {
    headers: {
      Cookie: cookieHeader,
      'User-Agent': 'Mozilla/5.0...',
    },
  });

  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}
```
```

---

## Fixture Bank（三类固定资产）

每个平台完成 Step 2/3 后，必须将真实 payload 保存为 fixture 文件，供单元测试和回归测试使用。

**存放路径**: `tests/fixtures/{platform}/`

**三类 Fixture**:

| 类型 | 文件名约定 | 内容 | 用途 |
|------|-----------|------|------|
| **raw response** | `raw-response-{n}.json` | API 原始响应 JSON（脱敏后） | parser.ts 的输入测试 |
| **normalized ParseResult** | `parse-result-{n}.json` | `parseResponse()` 的预期输出 | parser 正确性断言 |
| **asset-resolution** | `asset-resolve-{n}.json` | `imageUrlMap` / `resolveAsset` 的输入输出对 | 资产链路回归测试 |

**脱敏规则**：
- 替换真实 URL 中的 token/签名为 `REDACTED`
- 替换用户 ID 为 `user-xxx`
- 保留 JSON 结构和字段名不变
- 保留消息内容（测试需要真实内容结构）

**Fixture 命名中的 {n}**:
- `1` = URL 1（最难样本）
- `2` = URL 2（中等样本）
- `3` = URL 3（基线样本）

**示例目录结构**:
```
tests/fixtures/claude/
├── raw-response-1.json      # 最难样本的 API 原始响应
├── raw-response-3.json      # 基线样本
├── parse-result-1.json      # 最难样本的预期 ParseResult
└── asset-resolve-1.json     # 最难样本的资产解析对
```

> **为什么 fixture 比 prose doc 更有价值？** 这次 Gemini 最大教训之一：文字说明远不如真实 payload fixture。文字会过时，fixture 可以直接跑测试。后续每个平台都应该沉淀三类固定资产。

---

## How It Works: Dual-Method Strategy

Two complementary methods, used in order:

### Method 1 (M1): MAIN World Fetch Interception (Primary)

Inject code into MAIN world to patch `window.fetch` and capture API responses as they occur.

**Advantages**:
- ✅ Captures real API calls the page makes
- ✅ No manual API re-request needed
- ✅ Works with modern fetch-based SPAs
- ✅ No debugger UI overhead

**When it fails**: Pages using WebSocket, Server-Sent Events, or other non-fetch mechanisms.

### Method 6 (M6): Direct API Re-fetch (Fallback)

If M1 fails, use Chrome DevTools to find the API endpoint, then re-fetch directly via background script with captured cookies/headers.

**Advantages**:
- ✅ Works for any API
- ✅ Explicit control over request timing
- ✅ Lower resource usage than continuous monitoring

**When needed**: M1 failed or page uses alternative transport.

---

## FAQ (常见问题)

### Q1: 遇到 Cloudflare checkbox 验证怎么办？

**现象**: 页面显示 "Just a moment..." 或 "Verify you are human" 复选框

**解决方案**:
1. 使用 `take_snapshot` 获取页面快照
2. 找到 checkbox 的 uid
3. 使用 `click` 工具直接点击验证
4. 等待 5-10 秒后进入真正的页面

**重要**: 不要等待自动通过，直接使用 MCP Chrome DevTools 的 `click` 功能完成验证。

### Q2: 为什么叫 M1 和 M6？可以改成 M1 和 M2 吗？

**答案**: 不可以。M1 和 M6 的命名与代码中的具体实现保持一致，是整个 Four-Phase Structured Development 方法论中的标准命名。请保持不变。

**命名来源**:
- M1 = Method 1 (MAIN World Fetch Interception)
- M6 = Method 6 (API Re-fetch)

### Q3: M1 验证失败怎么办？

**可能原因**:
- 页面使用 WebSocket 而非 fetch
- API 拦截时机太晚
- URL 匹配模式不正确

**解决方案**:
1. 使用 `list_console_messages` 查看是否有错误
2. 调整 URL 匹配模式
3. 尝试更早注入 (document_start)

### Q4: M6 验证时遇到 401/403 错误？

**可能原因**:
- Cookie 过期
- Authorization Token 失效
- 缺少必需的 Header

**解决方案**:
1. 使用 `get_network_request` 重新获取完整的请求头
2. 确认 Cookie 和 Token 的有效期
3. 检查是否需要额外的 Header (如 Referer, Origin)

---

## Validation Checklist（五项硬门槛）

Before deploying, ALL five gates must pass. Failing any gate means returning to Step 1/2 for further exploration:

### Gate 1: 协议验证通过
M1 和 M6 对 3 个测试集 URL 均返回有效数据：

| Method | URL 1 (最难) | URL 2 (中等) | URL 3 (基线) |
|--------|:-----------:|:-----------:|:-----------:|
| M1 | ✅/❌ | ✅/❌ | ✅/❌ |
| M6 | ✅/❌ | ✅/❌ | ✅/❌ |

### Gate 2: 最难样本通过
URL 1（hardest-case）的导出结果在 chat-selection 页面中完整渲染：
- [ ] 图片/文件可见可下载（如果该平台有）
- [ ] 代码块有语法高亮（如果有代码内容）
- [ ] 消息顺序与原始页面一致
- [ ] 非文本内容类型（thinking、LaTeX、sources）正确渲染

### Gate 3: M1/M6 结果等价
同一 URL 分别用 M1 和 M6 获取，经 `parseResponse` 后的 `ParseResult` 语义等价：
- [ ] `title` 一致
- [ ] `messages.length` 一致
- [ ] 消息顺序一致（逐条 `role` + `content` 前 200 字符比对）
- [ ] 非文本资产数量一致（`media.images.length`、`imageUrlMap` key 数量）

### Gate 4: 资产链路通过
非文本资产从 API 响应到 chat-selection 渲染，端到端验证：
- [ ] `imageUrlMap` 或 `resolveAsset` 能为所有非文本资产提供可访问 URL
- [ ] chat-selection 中 `<img>` 标签实际渲染出图片（非 broken image）
- [ ] 若平台使用签名 URL，验证 URL 有效期 ≥ 导出流程耗时

### Gate 5: 真实浏览器端到端通过
在真实 Chrome 中完成完整导出流程：
- [ ] popup 点击导出 → background extraction → chat-selection 渲染 → 下载文件
- [ ] 导出的 JSON/Markdown 文件内容完整（消息数 = 原始页面消息数）
- [ ] 导出文件中的非文本资产引用有效

**Deliverable**: 五项门槛全部通过后，才可将 `platform-manifest.service.ts` 中该平台的 `extractionSupported` 设为 `true`。

---

## Manifest Configuration

```json
{
  "permissions": ["scripting", "cookies", "storage"],
  "host_permissions": ["*://*.target-site.com/*"],
  "content_scripts": [
    {
      "matches": ["*://*.target-site.com/*"],
      "js": ["content-script.js"],
      "run_at": "document_start"
    }
  ],
  "background": { "service_worker": "background.js" }
}
```

---

## Key Gotchas

1. **ISOLATED vs MAIN**: Always use `world: 'MAIN'` in `executeScript`, not default ISOLATED
2. **Response cloning**: Call `response.clone()` before reading, since response body is readable once
3. **Cookie handling**: Use `chrome.cookies.getAll(url)` to filter by specific domain
4. **postMessage origin**: Set origin to `'*'` for same-origin messages
5. **Token expiry**: If using M6 (re-fetch), verify auth token hasn't expired between capture and re-request
6. **命名约定**: 保持 M1 和 M6 的命名，不要更改

---

## When to Use

- Build data extraction extensions (capture chat histories, export forum posts, etc.)
- SPA pages where data comes from API calls, not static HTML
- Need reliable, real-time data capture without browser debugger UI
- API tokens/cookies exist on page; want to reuse them

---

## 实施流程总结

```
输入: 站点名称或聊天详情页 URL
  ↓
Step 1: 挑选 3 个多样性 URL
  ├─ 使用 MCP Chrome DevTools 导航工具
  └─ 输出: 测试集表格
  ↓
Step 2: 调试并获取 API
  ├─ 对每个 URL 使用 Network + Debugging 工具
  ├─ 验证 M1 (注入拦截器)
  ├─ 验证 M6 (重新请求 API)
  └─ 输出: 每个 URL 的 API 信息 + 验证结果
  ↓
Step 3: Report
  ├─ 沉淀验证成功的成果
  ├─ 输出可集成的 M1 和 M6 代码片段
  └─ 输出: 完整验证报告
  ↓
输出: 经过验证的 API 端点 + 可集成代码片段
```
