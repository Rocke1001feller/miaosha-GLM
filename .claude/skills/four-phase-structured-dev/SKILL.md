# Four-Phase Structured Development: Interface-First, Evidence-Driven

**A proven methodology for building MVVM pipelines with clean Bloc-to-Bloc communication**

---

## Overview

This methodology emerged from building an AI Exporter Chrome Extension using WXT + MVVM architecture. It solves a common problem: **how to design interfaces when you don't yet know the implementation details**.

**Core Philosophy**: Interface contracts first, then empirical validation, then implementation.

```
Phase 1: Interface Architecture → Mock/Stub → Verify
Phase 2: Empirical Exploration → Data + Method Diversity
Phase 3: Architecture Review → Gap Analysis → Micro-adjustments
Phase 4: Precision Implementation → Build → Test → Deliver
```

---

## When to Use This Method

**Ideal for**:
- Building MVVM pipelines with multiple Blocs (ViewModels)
- Implementing features with unknown technical constraints
- Projects requiring multiple implementation strategies with fallbacks
- Cross-page data flow (popup → content → background)

**Not for**:
- Single-function scripts (overkill)
- Well-understood problems (direct implementation is faster)

---

## Phase 1: Interface Architecture Design

### Objective
Define clean interfaces before writing implementation code. Enable parallel development and early testing.

### Steps

1. **Identify Domain Models**
   - What data entities exist? (e.g., `ExtractedConversation`, `ChatMessage`)
   - What are the relationships? (e.g., one-to-many, parent-child)

2. **Define Core Interfaces**
   - Repository interfaces for data access
   - Service interfaces for business logic
   - Storage interfaces for shared state

3. **Create Mock/Stub Implementations**
   - In-memory implementations for fast testing
   - Static data that covers expected scenarios

4. **Verify Communication Contracts**
   - Test that Bloc A can write to shared storage
   - Test that Bloc B can read from shared storage
   - Verify no direct Bloc-to-Bloc coupling

### Output
```
interfaces/
├── IChatStorage.ts           # Shared data service
├── IChatExtractionService.ts # Business logic
└── IChatExtractionRepository.ts # Platform extraction aggregator

mocks/
├── mock-messaging-repository.ts
└── mock-chat-extraction-repository.ts
```

### Example: ChatGPT Exporter

**Problem**: PopupViewModel needs to extract chat and pass data to ChatSelectionViewModel.

**Iron Law Constraint**: Blocs cannot communicate directly. Must use shared data service.

**Solution**:
```typescript
// Interface
export interface IChatStorage {
  setPendingExport(data: ExtractedConversation): Promise<void>;
  getPendingExport(): Promise<ExtractedConversation | null>;
}

// Bloc A (PopupViewModel) writes
await this.chatStorage.setPendingExport(extractedData);

// Bloc B (ChatSelectionViewModel) reads
const data = await this.chatStorage.getPendingExport();
```

### Validation Checklist
- [ ] All interfaces defined with TypeScript types
- [ ] Mock implementations compile
- [ ] End-to-end communication test passes (Mock → Storage → Mock)
- [ ] No direct Bloc-to-Bloc imports

---

## Phase 2: Empirical Exploration

### Objective
Discover real-world constraints before committing to implementation. Test multiple approaches.

### **SKILL INTEGRATION: Patched MCP Chrome DevTools**

> **Important**: Browser probing in this phase must use the **Patched MCP Chrome DevTools skill** (`.claude/skills/patched-mcp-chrome-devtools/SKILL.md`).
>
> The Patched MCP Chrome DevTools skill is the single source of truth for:
> - MCP environment setup and acceptance checks
> - already-running Chrome session reuse
> - page, extension page, and MV3 service worker operations
> - Network request/body capture and passive replay
> - malpractice/anti-patterns learned from failed debugging
>
> When starting Phase 2, reference `patched-mcp-chrome-devtools/SKILL.md` for the browser-operation mechanics. This skill still owns the broader four-phase project method.

### Why This Phase Matters

**Without exploration**: You might build a DOM extraction solution, only to discover it only captures 50% of messages.

**With exploration**: You test API interception, DOM extraction, and storage methods—then choose based on evidence.

### Two Axes of Exploration

#### Axis 1: Data Diversity（最难优先 Hardest-Case-First）

> **核心原则**：不要从纯文本 happy path 开始。第一个验收样本必须命中该平台最容易爆炸的能力组合（图片、代码块、分页、分支、多轮、thinking、公式）。如果最难的样本搞不定，说明技术方案有根本缺陷，越早发现越好。

Test with diverse data, **prioritizing the hardest cases first**:

| Priority | Dimension | Test Cases |
|----------|-----------|------------|
| **P0 (先测)** | Hardest Content | Images + Files, Code blocks, Thinking, LaTeX formulas |
| **P0 (先测)** | Hardest Structure | Long (40+), Pagination, Branching/multi-turn |
| P1 | Medium | Mixed content (2+ types), Medium length (10-20) |
| P2 | Baseline | Short (2-5), Text only, Recent, Active |

#### Axis 2: Method Diversity
Test multiple implementation approaches:

| Method | Description | Pros | Cons |
|--------|-------------|------|------|
| M1: Backend API | Direct HTTP to API | Complete data | Needs auth |
| M2: DOM Static | Query selectors | Simple | Visible only |
| M8: Fetch Hook | Monkey-patch window.fetch | Seamless | Injection timing |
| M9: LocalStorage | Read browser storage | No network | Metadata only |

### Exploration Tools

- **Patched MCP Chrome DevTools**: use `.claude/skills/patched-mcp-chrome-devtools/SKILL.md` for all browser-operation mechanics, logged-in session probing, network capture, extension pages, and service workers.
- **Playwright MCP**: automated testing across public/anonymous sites or clean-room flows where logged-in Chrome state is not required.
- **Context7**: documentation lookup for APIs and libraries.
- **跨平台模式手册**: `docs/cross-platform-patterns.md` — 开始探索前必读，按问题维度查阅已验证模式（顺序解析、资产传输、M1/M6 对等、认证策略等）。

### Common Obstacle Patterns

During Phase 2 exploration, you'll encounter common anti-bot protections. Use these generalized patterns:

#### Pattern 1: Cloudflare Turnstile (Checkbox Challenge)

**Detection**: Page shows "Just a moment...", "Checking your browser...", or checkbox "Verify you are human".

**Rule**: This is a logged-in/session-sensitive browser operation. Do not restate the MCP procedure here; use `.claude/skills/patched-mcp-chrome-devtools/SKILL.md` for the current operating steps and acceptance checks.

#### Pattern 2: Dynamic Hash Selectors

**Problem**: Tailwind CSS, styled-components, and similar frameworks generate hash classes like `.css-1a2b3c` that change on each build

**Solution**: Use semantic elements and aria attributes instead of classes

```
❌ AVOID: div.css-hash123, div[class*="thread"]
✅ PREFER: h1, h2, [role="article"], aria-label="..."
✅ FALLBACK: Semantic relationships (heading + paragraph pairs)
```

**Detection Pattern**:
```javascript
// Check if selector uses hash classes
if (/[a-f0-9]{6,}/.test(selector)) {
  // Unstable selector, find semantic alternative
  const headings = document.querySelectorAll('h1, h2, h3, [role="heading"]');
}
```

#### Pattern 3: SSE/Streaming Responses

**Problem**: Server-Sent Events deliver data incrementally, not as a single JSON response

**Detection**: Response `Content-Type: text/event-stream`

**Solutions**:
- **Option A**: DOM extraction (wait for content to render, then extract)
- **Option B**: Network interception (requires fetch/XHR hook)
- **Option C**: EventSource parsing (complex, requires custom handling)

**Recommendation**: Start with DOM extraction (Option A) for Phase 4

#### Pattern 4: Auth Token Requirements

**Problem**: API requires `Authorization` header or specific cookies

**Detection**: Network panel shows 401/403 responses without auth

**Solutions**:
- **Option A**: Use `.claude/skills/patched-mcp-chrome-devtools/SKILL.md` to capture or replay from the existing logged-in session.
- **Option B**: DOM extraction when rendered content is sufficient and no private API replay is needed.
- **Option C**: Fetch hook only when installed before the relevant request and validated against real Network evidence.

### Output

```
docs/
├── exploration-p1-data-catalog.md       # What was tested
├── exploration-p2-method-comparison.md  # Scoring matrix
└── exploration-p01-final-summary.md     # Key findings
```

#### 平台 Dossier（必须产出）

每个平台完成 Phase 2 后，必须产出一份 **平台 dossier** 文件 `docs/platform-dossiers/{platform}-dossier.md`，持续维护直到该平台完全上线。Dossier 是活文档，不是一次性报告。

**固定包含项**：

```markdown
# {Platform} Dossier

## 1. 接口拓扑
- API 端点 URL pattern
- HTTP Method + Headers
- 响应格式（JSON / SSE / batchexecute 等）
- 分页机制（如有）

## 2. 认证方式
- Cookie / Bearer Token / Session
- Token 获取方式（如 /api/auth/session）
- Token 有效期

## 3. 消息顺序语义
- API 返回的消息顺序是否等于 UI 展示顺序？
- 是否需要 client-side sorting？排序字段是什么？
- 分支/多轮场景下的 mapping 结构

## 4. 资产链路
- 非文本资产类型（图片、文件、音频等）
- 资产 URL 是直链还是需要 resolve？
- 签名 URL 有效期
- M1 模式下的 imageUrlMap 构建策略
- M6 模式下的资产获取策略
- chat-selection 中的渲染方式（crossorigin、proxy、dataUrl）

## 5. M1/M6 策略
- M1 拦截的 API pattern
- M1 parseCapture 是否需要（非 JSON 响应）
- M6 extractViaM6 的请求构造
- M1/M6 等价性验证结果

## 6. chat-selection 消费方式
- ParseResult 到 UI 渲染的映射
- 哪些字段需要特殊处理（thinking、LaTeX、sources）
- message-renderer.ts 是否需要新增渲染分支

## 7. 已验证样本矩阵
| # | URL | 难度 | M1 | M6 | 资产 | 端到端 |
|---|-----|------|:--:|:--:|:----:|:------:|
| 1 | ... | 最难 | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |
| 2 | ... | 中等 | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |
| 3 | ... | 基线 | ✅/❌ | ✅/❌ | ✅/❌ | ✅/❌ |

## 8. 已知风险
- (列出已发现但未解决的问题)

## 9. 最后验证日期
- YYYY-MM-DD
```

### Example: ChatGPT Exporter Discovery

**Tested**: 6 conversations, 5 extraction methods

**Critical Finding**: LocalStorage/IndexedDB/Cache API store only metadata, NOT content. Content must come from API or DOM.

**Decision**: Use 3-method fallback chain (M1→M8→M2)

### Validation Checklist
- [ ] Tested 3+ data variations (hardest-case-first)
- [ ] Tested 3+ implementation methods
- [ ] Created scoring matrix
- [ ] Documented why methods work/fail
- [ ] **平台 Dossier 初稿已创建**（`docs/platform-dossiers/{platform}-dossier.md`，§1-§5 已填写）
- [ ] **Fixture Bank 已建立**（`tests/fixtures/{platform}/` 下至少有 raw-response + parse-result 各 1 个）

---

## Phase 3: Architecture Review & Micro-Adjustments

### Objective
Compare interface design against exploration findings. Identify gaps and adjust.

### Key Questions

1. **Coverage**: Do interfaces handle all discovered data types?
2. **Gaps**: Are there edge cases not covered?
3. **Over-Engineering**: Are there unused abstractions?
4. **Priority**: Which method should be primary vs fallback?

### Decision Framework

```
If exploration confirms interface design:
    → Proceed to implementation (no changes)

If exploration reveals missing pieces:
    → Add new methods/fields to interfaces

If exploration proves some assumptions wrong:
    → Revise interfaces, update mocks
```

### Example: ChatGPT Exporter Adjustment

**Original Assumption**: DOM extraction sufficient for short chats.

**Finding**: DOM captures all visible messages for short chats (2-16), but API is needed for completeness.

**Decision**: Keep interface unchanged (already supports both), prioritize M1→M2 fallback.

### Output

```
docs/
└── exploration-p3-production-architecture.md  # Implementation plan
```

### Validation Checklist
- [ ] All exploration findings mapped to interface
- [ ] Implementation priority defined
- [ ] No blocking gaps remaining

### Hard Exit Gate: 五项硬门槛（全部通过才能进入 Phase 4）

平台只有在这五项都通过后，才能被标记为 `extractionSupported: true`：

| # | 门槛 | 验证方式 | 不通过的后果 |
|---|------|----------|------------|
| 1 | **协议验证通过** | M1/M6 对 3 个测试集 URL 均返回有效 JSON | 技术方案不可行，退回 Phase 2 |
| 2 | **最难样本通过** | URL 1（hardest-case）的导出结果在 chat-selection 中完整渲染（含图片、代码、公式等） | 只验了 happy path，Phase 4 必爆 |
| 3 | **M1/M6 结果等价** | 同一 URL 的 M1 和 M6 输出经 `parseResponse` 后的 `ParseResult` 语义等价（title、messages 数量、消息顺序、非文本资产数量一致） | 降级路径形同虚设 |
| 4 | **资产链路通过** | 非文本资产（图片、文件）从 API 响应到 chat-selection 渲染，端到端可见可下载 | 图片问题重演 Gemini 灾难 |
| 5 | **真实浏览器端到端通过** | 在真实 Chrome 中走完 popup → extraction → chat-selection → export 全链路，导出文件内容完整 | 集成点断裂 |

```
Phase 3 Exit Decision:
  五项全部 ✅ → 进入 Phase 4
  任一项 ❌  → 退回 Phase 2 补充探索，或修正接口
  部分 ⚠️   → 记录为已知限制，在 dossier 中标明，评估是否可接受
```

### Objective
Build working code based on validated interfaces and exploration insights.

### Why It's Fast Now

1. **Interfaces are stable**—no redesign mid-coding
2. **Technical unknowns resolved**—no research blocks
3. **Clear fallback strategy**—error handling is predictable

### Steps

1. **Implement Primary Method** (e.g., API extraction)
2. **Add Fallback Methods** (e.g., DOM extraction)
3. **Wire Up MVVM Pipeline**
4. **End-to-End Test**
5. **Fix UI/UX Details**

### Example: ChatGPT Exporter Implementation

**Time to working code**: ~2 hours

- M2 (DOM): Already implemented in `ChatGPTStrategy.ts`
- M1 (API): Ready to implement using exploration findings
- ChatStorage: Already defined, just wire up
- JSON Export: Simple file download

### Common Pitfalls to Avoid

| Pitfall | Solution |
|---------|----------|
| Coupling Blocs directly | Use shared storage service |
| Hardcoding single method | Design for fallback chain |
| Ignoring edge cases | Use exploration data |
| Skipping mocks | Keep mocks for testing |

### Validation Checklist
- [ ] All methods from exploration implemented
- [ ] Fallback chain works (primary → secondary → error)
- [ ] End-to-end flow completes
- [ ] UI renders correctly
- [ ] Export produces valid data

### 阶段级可观测性（Stage-Level Observability）

每个平台的提取管线在调试时，必须能快速定位 **失败发生在哪个阶段**。不允许只有"extraction failed"的黑盒错误。

**五个阶段与对应的错误标签**：

| 阶段 | 错误标签 | 含义 | 典型原因 |
|------|---------|------|----------|
| **capture** | `[CAPTURE_FAIL]` | M1 拦截器未捕获到数据 | API pattern 不匹配、注入时机太晚 |
| **parse** | `[PARSE_FAIL]` | `parseResponse()` 返回空或抛异常 | API 响应格式变更、字段路径错误 |
| **normalize** | `[NORMALIZE_FAIL]` | ParseResult 结构不符合 contracts.ts 要求 | messages 为空、title 缺失、mapping 异常 |
| **resolveAsset** | `[ASSET_FAIL]` | 非文本资产无法解析为可渲染 URL | 签名过期、CORS 拒绝、resolveAsset 返回 null |
| **render** | `[RENDER_FAIL]` | chat-selection 页面渲染异常 | 图片 broken、代码块无高亮、消息缺失 |

**实施要求**：
1. `extraction-pipeline.ts` 中每个 catch 块必须带有阶段标签前缀
2. 每个平台 slice 的 `extractViaM6()` 返回的 `statusText` 必须包含阶段标签
3. chat-selection 的 `message-renderer.ts` 遇到渲染异常时，console.error 必须带 `[RENDER_FAIL]`
4. **Dossier §8（已知风险）中，每个未解决问题必须标注属于哪个阶段**

---

## The ChatGPT Export Example: Condensed

### Phase 1: Interface Design
```typescript
// IChatStorage.ts - Shared data service (Iron Law compliance)
export interface IChatStorage {
  setPendingExport(data: ExtractedConversation): Promise<void>;
  getPendingExport(): Promise<ExtractedConversation | null>;
}

// interfaces/IChatExtractionRepository.ts - Platform extraction aggregator
export interface IChatExtractionRepository {
  extractFromCurrentTab(): Promise<ExtractContentResponse>;
}
```

### Phase 2: Exploration Findings
- **M1 (API)**: 100% complete, requires auth
- **M2 (DOM)**: 100% for short chats, no auth needed
- **M9/M10/M11 (Storage)**: No content stored
- **Decision**: M1→M2 fallback chain

### Phase 3: Architecture Review
- Interface design fully covers exploration findings
- No changes needed, proceed to implementation

### Phase 4: Implementation
```typescript
// ChatStorage service (already defined)
export const ChatStorage: IChatStorage = {
  async setPendingExport(data) {
    await storage.setItem('pending_export', data);
  },
  async getPendingExport() {
    return await storage.getItem('pending_export');
  }
};

// PopupViewModel writes
async openCustomExportWithContent() {
  const data = await this.extractionRepository.extractFromCurrentTab();
  await this.chatStorage.setPendingExport(data.data);
  this.repository.openCustomExport();
}

// ChatSelectionViewModel reads
async init() {
  const data = await this.chatStorage.getPendingExport();
  this.conversation.value = data;
}
```

---

## Key Principles Summary

### Iron Law: Convergence in Data Layer
```
Bloc A → Shared Data Service ← Bloc B
         (IChatStorage)
```
**Never**: `Bloc A → Bloc B` direct communication

### Evidence Over Opinion
- Test assumptions with real data
- Compare multiple methods empirically
- Document why something works/fails

### Interface First, Implementation Second
- Define contracts before coding
- Use mocks for early validation
- Change is cheap when implementation doesn't exist

### Fallback by Design
- Assume primary method can fail
- Have secondary method ready
- Graceful degradation, not errors

---

## When to Skip This Method

**Direct implementation is faster when**:
- Problem is well-understood
- Single obvious solution
- No cross-Bloc communication
- Low risk (easy to change)

**Example**: Adding a simple "Copy to Clipboard" button

---

## Further Reading

**Internal Project Docs**:
- `docs/exploration-p01-final-summary.md` - Full exploration report
- `docs/exploration-p3-production-architecture.md` - Production architecture
- `interfaces/IChatStorage.ts` - Iron Law implementation

**External Concepts**:
- MVVM Pattern: Separation of concerns, testable ViewModels
- Repository Pattern: Abstract data access behind interfaces
- Strategy Pattern: Multiple extraction methods, swappable at runtime
- Observer Pattern: Observable state for reactive UI updates
