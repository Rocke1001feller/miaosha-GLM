# Case Study 01 — Claude Widget SVG: Three Bug Classes In One Surface

> **Why this example exists.** This is the first time this repository applied the chain-first methodology end-to-end. It established the pattern that all later incidents follow: define both ends first, map the chain, eliminate systematically, fix at the first true distortion layer, never patch the final symptom.
>
> **Post-incident update (2026-04-08):** The original postmortem declared this incident "resolved." It was not. Two follow-up incidents revealed that Claude widget SVGs fail in **three independent ways**, and fixing only one class creates a false sense of completeness. This case study now documents all three bug classes and the meta-lesson about premature closure.

---

## 0. Incident Snapshot

- **Date:** 2026-04-06 (initial), 2026-04-07 (Bug Class 2), 2026-04-08 (Bug Class 3)
- **Branch:** `popup-7-sites` → `dev-hot-fix-clean-code`
- **Surface:** extension → chat-selection / export artifact
- **Severity:** medium — visually broken but not data-losing
- **Status:** resolved after three rounds — all three bug classes now have fixes + regression tests
- **Full postmortem:** `docs/archive/postmortems/postmortem-claude-widget-black-rendering.md`

### Bug Class Summary

| # | Root Cause | Symptom | Fix |
|---|---|---|---|
| 1 | Host CSS dependency (no inline styles) | All-black rendering | `injectClaudeWidgetTheme()` + `resolveIsolatedSvgColors()` |
| 2 | `onclick` handlers with unescaped nested `"` | XML parse error → `<img>` onerror | `stripSvgEventHandlers()` |
| 3 | Missing `xmlns="http://www.w3.org/2000/svg"` | Browser SVG renderer refuses to render | `ensureSvgNamespace()` |

---

## 1. What Was Observed (Symptom, Not Cause)

User opened an exported Claude conversation in chat-selection. Several widget outputs — the kind Claude produces for `visualize:show_widget` tool calls — appeared as almost entirely black rectangles. No node labels were readable, no connector colors were visible, no theme values carried through.

The same widgets on the live Claude page looked completely fine: colored nodes, readable text, correct diagram semantics.

---

## 2. The Wrong Intuition That Almost Sent The Investigation In The Wrong Direction

**First instinct:** "The chat-selection page CSS is inverting or overriding the image colors."

This is the natural first guess for any color-related visual regression. The symptom is visible on the rendering surface, so the renderer feels like the place to start.

**Why this intuition must be held as a hypothesis, not a conclusion:**
- The symptom location and the failure location are often different.
- Chat-selection CSS has been stable and does not recolor SVG image content.
- The correct question is not "what does the render page do to it?" — it is "what state does the asset arrive in?"

---

## 3. Chain Map — The Actual Path Of The Asset

Before touching any layer, explicitly trace every transform the asset passes through:

```
Claude conversation API
  └→ GET /chat_conversations/{uuid}?render_all_tools=true
      └→ response JSON: messages[].content[].tool_use.input.widget_code (raw SVG string)
          └→ Claude parser (services/platform-slices/claude/parser.ts)
              └→ parseWidgetSvg() → data URI encoding (btoa / encodeURIComponent)
                  └→ chat-selection MessagePart with type="image" src="data:image/svg+xml,..."
                      └→ <img> element in chat-selection HTML
                          └→ browser standalone SVG rendering rules
                              └→ final on-screen pixels
```

The symptom appears at the bottom of this chain. The question is: **at which layer does the SVG first stop being self-contained?**

---

## 4. Define Both Ends (The Mandatory First Move)

### Source Truth

The live Claude runtime rendered the same widgets with:
- Background fills (grays, whites, theme-appropriate colors)
- Colored node borders (`c-purple`, `c-teal`, `c-coral`, `c-amber`, `c-blue`, `c-gray`, `c-green`)
- Working connector arrow styling
- Readable dark text on light backgrounds

The raw `widget_code` in the API response was obtained by calling Claude's `render_all_tools=true` endpoint. This is production reality, not a simplified fixture.

### Target Truth

After extraction and export, every widget must:
- Render its labeled text in readable contrast
- Show node fills and border colors, not all-black default fills
- Display connector arrows with non-default strokes
- Work inside a standalone `<img>` element with `data:image/svg+xml,...` URI — no access to Claude's host runtime

---

## 5. Candidate Layers (Before Any Evidence Is Gathered)

Listed in order from final symptom back to source, as required by chain-first protocol:

1. **Chat-selection page CSS** — does any filter/invert rule apply to the `<img>` element?
2. **Browser SVG rendering rules for data URIs** — is the browser incapable of rendering this SVG class?
3. **Data URI encoding step** — did the SVG mutate during encoding (`btoa`, percent-encoding)?
4. **SVG extraction in the parser** — did the SVG lose content during extraction?
5. **Hidden host dependency in the SVG source** — does the raw `widget_code` depend on Claude host styles not present in a standalone document?
6. **API payload integrity** — does the raw API payload already have degraded SVG content?

---

## 6. Investigation: Eliminating Layers, Newest-First

### Move 1 — Inspect the chat-selection render surface

**Question:** Does any CSS rule on the chat-selection page apply a color transform to image content?

**Action:** Review `entrypoints/chat-selection/style.css` and the page HTML for `filter`, `invert`, `opacity`, `mix-blend-mode`, or `color-scheme` properties that target `img` elements.

**Result:** No such rules found. The page has no color inversion logic. Image elements are unstyled beyond basic layout constraints.

**Conclusion:** Layer 1 eliminated. Render-surface CSS is not the cause.

---

### Move 2 — Inspect the SVG structure in the exported artifact

**Question:** Is the SVG arriving to the `<img>` with the right structural content, or is the node/edge structure already missing?

**Action:** Decode the `data:image/svg+xml,...` URI from the exported artifact back to SVG text and inspect the markup.

**Result:** The SVG structure was intact. Nodes, edges, group elements, and label text all existed in the markup. The shapes were present and positioned correctly.

**Conclusion:** Layer 4 and Layer 6 partially eliminated. The SVG content was not truncated or lost. The failure was not zero-content. Something else caused every visible element to appear black.

---

### Move 3 — Compare the raw `widget_code` against the decoded SVG artifact

**Question:** Did the data URI encoding step corrupt the SVG in a way that affects color?

**Action:** Inspect the parser path in `services/platform-slices/claude/parser.ts`. Trace how `widget_code` becomes the `src` of an image part.

**Result:** The encoding step was faithful. The decoded SVG matched the raw `widget_code`. No content transformation at this step.

**Conclusion:** Layer 3 eliminated. The encoding pipeline is not the cause.

---

### Move 4 — Read the raw `widget_code` from the live API payload

**Question:** Does the live production SVG itself contain any self-contained color/fill rules, or does it rely on something external?

**Action:** Inspect the real Claude API response (`/chat_conversations/{uuid}?render_all_tools=true`). Extract `widget_code` and read its SVG text carefully — specifically look for: `<style>` blocks, `fill` attributes, `stroke` attributes, `class` attributes, and `var(--...)` tokens.

**Result (critical findings):**

The raw `widget_code` SVG used:

1. **Only class-based styling, no explicit colors.** Node fills were defined purely by class names like `c-purple`, `c-teal`, `c-coral`, `c-amber`, etc. There was no corresponding `<style>` block inside the SVG.

2. **CSS custom property tokens.** Some stroke and fill values were `var(--color-background-secondary)`, `var(--color-text-info)`, `var(--t)`, and other tokens from Claude's design system.

3. **`context-stroke` on connectors.** Arrow connectors used `context-stroke` — a CSS keyword that inherits stroke from the rendering context. In standalone SVG, `context-stroke` has no parent context to inherit from, so it resolves to the browser default: black.

4. **No `<defs>` or inline styles in the SVG.** The SVG had no self-contained style information at all. Every color depended on an external Claude host stylesheet.

**Conclusion:** This is the pivot moment. Layer 5 is confirmed. The SVG was never self-contained. It always depended on Claude's host CSS runtime to render correctly. The source truth was "correct rendering via borrowed host context." The target truth required "correct rendering detached from host context." These two never overlapped with the original export pipeline.

---

### Move 5 — Confirm the failure mode in standalone rendering

**Question:** If the SVG is placed in a standalone document without any Claude host CSS, what happens?

**Analysis:**
- Class names like `c-purple` resolve to nothing → browser default: no fill → element background becomes transparent or black, depending on parent context.
- `var(--color-background-secondary)` resolves to nothing → browser treats it as `unset` → falls back to `black` for fill, `none` for background on dark paths.
- `context-stroke` resolves to nothing → browser default: `black`.

**Conclusion:** The observed black artifact is exactly the expected outcome when host-dependent SVG is embedded standalone. Every shape that should have been colored resolves to browser default black when the host stylesheet is absent.

---

## 7. Root Cause — Stated Precisely

The source Claude widget SVGs were **never self-contained**. They only rendered correctly because Claude's host runtime supplied:
- class-level CSS rules that resolved `c-purple`, `c-teal`, etc. to actual fill colors
- CSS custom property (`var(--...)`) definitions for all theme tokens
- arrow connector `context-stroke` resolution from a containing styled element

The parser extracted the SVG from the API payload and converted it into a standalone data URI without injecting the CSS contract those classes and tokens required. The first point of distortion was **not the renderer** and **not the encoding**. It was the **parser-to-artifact boundary**: the moment we created a standalone export object from a host-dependent SVG.

---

## 8. Fix At The Correct Layer

The fix went into `services/platform-slices/claude/parser.ts` — not into chat-selection CSS, not into the browser rendering layer, not into an encoding override.

**What was changed:**

```typescript
// Before: raw widget_code passed directly to data URI encoding
// After: widget_code is made self-contained before encoding

function injectClaudeWidgetTheme(svg: string): string {
  // 1. Map every observed Claude color class to a concrete fill/stroke value:
  //    c-purple → #8b5cf6, c-teal → #14b8a6, c-coral → #f97316, c-amber → #f59e0b
  //    c-blue   → #3b82f6, c-gray → #6b7280, c-green → #22c55e, etc.
  //
  // 2. Resolve known CSS custom properties to concrete values:
  //    --color-background-secondary → #f9fafb, --color-text-info → #3b82f6, etc.
  //
  // 3. Replace `context-stroke` with `currentColor` on arrowhead markers.
  //
  // 4. Inject a <style> block into the SVG before encoding.
  return svgWithInlinedStyles;
}
```

**Why this is the correct layer:**

The parser is the last point in the pipeline where the SVG is still text that can be manipulated before it becomes a binary/encoded asset. And it is the layer that owns the "source-specific knowledge" of what Claude's widget contract requires.

Patching chat-selection CSS would be a downstream symptom patch: it would require the page to know what SVGs contain host-dependent styles and re-inject host overrides at render time. That is brittle, wrong-layer, and would not work for the download/export path.

**Tests added:**

- Parser test: `parseClaudeWidgetSvg injected theme → result does not contain unresolved var(--...) or context-stroke`
- Parser test: `c-purple class → fill:#8b5cf6 present in encoded SVG`

---

## 9. Self-Consistency Check (Bug Class 1 Only)

| Question | Answer |
|---|---|
| Does the exported SVG still depend on Claude's runtime? | No. All theme dependencies are now inlined. |
| If opened in a fresh browser tab with no Claude context, does it render? | Yes — verified manually. |
| What would break this fix? | A future Claude widget variant using new class names or token names not in the current map. |
| Is that residual risk documented? | Yes, in the postmortem and the parser code comments. |

> **⚠️ Post-incident note:** This check was accurate for Bug Class 1, but it was also premature. Declaring "resolved" here caused a false sense of completeness. Two more failure classes in the same SVG surface were discovered within 48 hours.

---

## 10. Bug Class 2 — `onclick` Handlers With Unescaped Nested Quotes (2026-04-07)

### Symptom

In conversation `95a7eb68`, message index 17 had two SVG widgets from the same assistant turn. Widget 1 (`market_directions`) rendered correctly. Widget 2 (`naming_brainstorm_matrix`) showed `[Image unavailable]`.

This was paradoxical: same message, same parser path, same rendering code — yet one succeeded and one failed.

### Investigation

Chain-first analysis eliminated all shared layers (API, parser extraction, encoding pipeline, renderer) because Widget 1 proved those layers functional. The difference had to be in the **content itself**.

**Key finding:** Widget 2's SVG contained `onclick` event handlers with Chinese text that included unescaped double quotes:

```xml
<g class="node c-amber" onclick="sendPrompt('产品名「Asked」：过去式，暗示"我曾经问过这个"')">
```

The `"` at column 64 is an unescaped double quote inside a double-quoted XML attribute. This is valid in HTML parsers (Claude.ai page) but breaks XML well-formedness required by `data:image/svg+xml` in `<img>` tags.

- Widget 1 had `onclick` handlers **without** nested quotes → valid XML → loads
- Widget 2 had `onclick` handlers **with** unescaped nested `"` → invalid XML → fails

### Fix

`stripSvgEventHandlers()` — removes all `on*` event handler attributes from SVG before encoding. These handlers are useless in `<img>` context (fully sandboxed, no script execution) and are the source of XML invalidity.

### Why Bug Class 1 Did Not Catch This

Bug Class 1 was about **missing styles** (host dependency). The SVG markup itself was valid XML — it just rendered with wrong colors. Bug Class 2 is about **invalid XML** — the SVG structure itself breaks the parser. These are orthogonal failure modes in the same pipeline.

---

## 11. Bug Class 3 — Missing `xmlns` Namespace Declaration (2026-04-08)

### Symptom

In conversation `1ebe8ce8`, **all 4 widget SVGs** failed to display. Console logged `[ASSET_FAIL] ChatSelection image load failed: data:image/svg+xml;base64,...` for every widget.

### Investigation

All 4 SVGs passed XML validity checks (DOMParser found no errors). All 4 had no `onclick` handlers. Yet all 4 failed as `<img>` data URIs.

**Key finding:** All 4 SVGs were missing `xmlns="http://www.w3.org/2000/svg"`:

```xml
<!-- Failing (new conversation) -->
<svg width="100%" viewBox="0 0 680 620" role="img">

<!-- Working (previous conversation) -->
<svg width="100%" viewBox="0 0 680 480" xmlns="http://www.w3.org/2000/svg">
```

Claude's LLM **non-deterministically** includes or omits the namespace. When SVG is inline in HTML, the HTML parser assigns the SVG namespace implicitly — no xmlns needed. But `data:image/svg+xml` in `<img>` tags is parsed as **standalone XML**, where namespace MUST be explicit. Without it, elements are in "no namespace" and the browser's SVG renderer refuses to render them.

**Proof:** Adding `xmlns` to a failing SVG → `img.onload` fires, renders at 165×150.

### Fix

`ensureSvgNamespace()` — checks for xmlns declaration and injects it when missing.

### Why Bug Classes 1 & 2 Did Not Catch This

Bug Class 1's test SVGs all had xmlns (Claude happened to include it). Bug Class 2's test SVG explicitly included xmlns in the test fixture. Neither fix would trigger on well-formed, validly-namespaced SVGs that simply lacked the namespace. The three bug classes are **fully orthogonal**.

---

## 12. The Complete `svgToDataUri` Pipeline After All Three Fixes

```typescript
function svgToDataUri(svg: string): string {
  const themed = injectClaudeWidgetTheme(svg);       // Bug Class 1: inject missing host styles
  const resolved = resolveIsolatedSvgColors(themed);  // Bug Class 1: resolve CSS var tokens
  const sanitized = stripSvgEventHandlers(resolved);  // Bug Class 2: strip invalid onclick attrs
  const namespaced = ensureSvgNamespace(sanitized);   // Bug Class 3: inject missing xmlns
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(namespaced)))}`;
}
```

Each step is independent and order-insensitive between classes. The pipeline is now a **defensive normalization chain** that makes any LLM-generated SVG safe for standalone `<img>` embedding.

---

## 13. Meta-Lesson: Premature Closure On LLM-Generated Content

### The Pattern That Was Missed

After Bug Class 1 was fixed, the postmortem declared the incident "resolved" based on:
- The regression test passed
- The specific failing widgets now rendered correctly
- The fix logic was sound

This was a valid conclusion **for the specific failure mode investigated**. But it was premature as a general claim because:

1. **LLM output is non-deterministic by nature.** Claude generates widget SVGs on the fly. Different conversations produce different SVG structures, with or without xmlns, with or without onclick handlers, with different quoting patterns. A fix validated against one conversation's SVGs does NOT generalize to all possible SVG outputs.

2. **"Source works, export fails" has multiple independent causes.** The chain-first methodology correctly identifies the first distortion layer, but LLM-generated content can have **multiple independent distortions in the same document**. Fixing one does not eliminate others.

3. **The correct mental model is not "find THE root cause" but "enumerate the vulnerability surface."** For LLM-generated content being re-hosted in a different rendering context, the question is: what are ALL the ways this content can be valid in the source context but invalid in the target context?

### Updated Self-Consistency Check (All Three Classes)

| Question | Answer |
|---|---|
| Does the exported SVG still depend on Claude's runtime? | No. Styles are inlined (Class 1). |
| Is the SVG valid standalone XML? | Yes. Event handlers stripped (Class 2), xmlns ensured (Class 3). |
| Can the browser's SVG renderer process it in `<img>` context? | Yes. Namespace is explicit, markup is well-formed, no scripts. |
| What could still break? | New SVG features Claude starts using that are valid in HTML-inline but not in standalone XML (e.g., `<foreignObject>`, external `<use>` references, CSS `@import`). |
| Is the vulnerability surface documented? | Yes, in this case study and in parser code comments. |

---

## 14. Reusable Judgment Template From This Case

> **"This looks like the Claude SVG case."**
>
> Trigger: source renders SVG correctly; exported `data:image/svg+xml` in `<img>` fails — black rendering, broken image icon, or `[Image unavailable]`.
>
> **Do not stop at the first fix.** LLM-generated SVGs can fail in multiple independent ways:
>
> | Check | Bug Class | Fix |
> |---|---|---|
> | Does SVG use `var(--)`, class-only styling, `context-stroke`? | Class 1: host dependency | Inject inline styles |
> | Does SVG have `on*` handlers with unescaped nested quotes? | Class 2: XML invalidity | Strip event handlers |
> | Does SVG have `xmlns="http://www.w3.org/2000/svg"`? | Class 3: missing namespace | Inject xmlns |
>
> Core lesson: **LLM-generated content is non-deterministic. A fix validated against one sample does not generalize. Enumerate the full vulnerability surface between source context (HTML parser) and target context (standalone XML in `<img>`).**

---

## 15. What This Changed In The Repository's Debugging Culture

Before this incident series:
- The natural starting point for color bugs was "find the CSS rule that's inverting things."
- Fixtures were assumed to represent production reality.
- A single successful fix was considered "resolved."

After all three rounds:
- Color/rendering failures in exported artifacts trigger hidden-dependency check first.
- Parser layer is understood as the artifact-sealing boundary where self-containment must be enforced.
- New incidents start from real production payloads, not fixtures.
- **For LLM-generated content, a single fix is treated as "one class resolved" — the incident remains open until the vulnerability surface is enumerated.** This is the key new principle.
- The `svgToDataUri` pipeline is now a **defensive normalization chain**, not a single-purpose converter.

---

## Appendix: Key Files

| File | Role in this incident |
|---|---|
| `services/platform-slices/claude/parser.ts` | Where all three fixes were applied — `svgToDataUri` pipeline |
| `entrypoints/chat-selection/message-renderer.ts` | Where the symptom was visible — unchanged, correctly eliminated |
| `entrypoints/chat-selection/style.css` | Eliminated in Move 1 — no color transforms on images |
| `docs/archive/postmortems/postmortem-claude-widget-black-rendering.md` | Full structured postmortem record |
| `tests/services/claude-parser.test.ts` | Regression tests for all three bug classes |
