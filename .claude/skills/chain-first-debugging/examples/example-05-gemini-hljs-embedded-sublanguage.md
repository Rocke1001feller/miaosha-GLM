# Case Study 05 — Gemini DOCX: Zero Syntax Highlighting Inside HTML Code Blocks With `<script>` Tags

> **Why this example exists.** This incident is a canonical demonstration of **context-dependent transform failure** — where a transform that is correct for simple input silently produces wrong output for compound input because it destroys the context that the transform *engine* depends on. The chain-first method eliminated two plausible wrong hypotheses quickly and surfaced the real break in one systematic trace.

---

## 0. Incident Snapshot

- **Platform:** Gemini
- **Surface:** DOCX export, code blocks labeled `html` containing `<script>` JavaScript
- **Reported symptom:** Code block has zero color differentiation — no purple keywords, no green strings, everything appears as near-black monochrome plain text
- **Branch:** `polish-v2.0.0-release`
- **Status:** Resolved. All 41 regression tests passing.

---

## 1. What Was Observed (Symptom, Not Cause)

User exported a Gemini conversation containing an HTML code block. The chat-selection preview showed the code with color. The exported DOCX opened in Apple Pages showed the code in a single near-black color with no syntax differentiation at all.

---

## 2. The Wrong Intuitions That Were Eliminated

### Wrong Hypothesis 1: DOMParser unavailable in export context

**Reasoning:** DOCX export generates HTML strings via highlight.js; those strings are parsed by `extractHighlightedTokens` which calls `new DOMParser()`. If DOMParser is unavailable, token parsing silently fails → all tokens get `classes: []` → all text maps to `DocxCodePlain` color.

**Eliminated because:** DOCX export runs from `entrypoints/chat-selection/export-handler.ts`, which executes inside the **chat-selection extension page** — a full browser HTML page where `DOMParser` is always available. The Node.js regex fallback added in Phase 1 was correct for Vitest tests but does not apply to the actual export path.

> Lesson: Environment verification is cheap. Confirm the execution context before assuming an unavailable API.

### Wrong Hypothesis 2: Character styles not registered correctly in DOCX

**Reasoning:** Phase 1 added OOXML character styles via `externalStyles` XML; if those are not embedded or the style IDs are mismatched, all `TextRun` style references fail silently.

**Eliminated because:** Other platforms (ChatGPT Python code blocks, TypeScript blocks) showed correct colors in DOCX after Phase 1. The character style registration was working. The failure was specific to HTML-labeled blocks containing `<script>` content.

---

## 3. Chain Map — The Full Path For A Code Block Token

```text
source platform (Gemini): fenced code block ```html … </script> … ```
  └→ blocks/markdown.ts: extract lang="html", code=fullBlockString
      └→ highlightCodeToLines(code, 'html')             ← BREAK WAS HERE
          └→ resolveHighlightLanguage('html') → 'xml'
          └→ per-line: code.split('\n').map(line => highlightCodeLine(line, 'xml'))
              └→ hljs.highlight(line, {language:'xml'}) per line
                  └→ JS lines inside <script> produce no span classes → classes: []
          └→ HighlightedCodeLine[] (tokens with all classes: [])
      └→ createCodeLineParagraph(tokens)
          └→ resolveCodeTokenStyle([]) → DOCX_CODE_STYLE_IDS.plain → '050505'  ← secondary miss
      └→ TextRun with character style DocxCodePlain
  └→ PAGES_COMPATIBLE_EXTERNAL_STYLES XML (character style definitions embedded correctly)
  └→ DOCX artifact: all JS lines are near-black, zero color differentiation
```

---

## 4. Root Cause

### Primary: Per-Line Highlighting Destroys Embedded Language Context

`highlightCodeToLines` split the code block into lines first, then called `hljs.highlight(line, {language:'xml'})` on **each line independently**.

highlight.js `xml` language supports embedded JavaScript inside `<script>` tags via a `subLanguage: 'javascript'` grammar rule. This embedded-language rule **requires the entire document to be processed as a single unit**. When lines are split and highlighted independently:

- The line containing `<script>` is highlighted as an XML tag (correct for that line alone).
- The subsequent lines containing JavaScript code are each presented to the `xml` highlighter as independent XML fragments with no surrounding context.
- The `xml` highlighter sees no `<script>` open tag → never activates the JavaScript sublanguage → produces zero `<span class="hljs-…">` wraps → all tokens have `classes: []`.

**The fix**: highlight the entire block as one string, then split the resulting token stream by `\n` characters.

```typescript
// Before — destroys embedded language context
return code.split('\n').map(line => highlightCodeLine(line, lang));

// After — preserves sublanguage context for entire block
const html = hljs.highlight(normalized, { language, ignoreIllegals: true }).value;
return splitHighlightedHtmlIntoLines(html);
```

### Secondary: `hljs-tag` And `hljs-selector` Had No Mapping In `resolveCodeTokenStyle`

When HTML `<script>` and `</script>` tags are highlighted by the `xml` grammar, they produce tokens with class `hljs-tag`. This class was not in `resolveCodeTokenStyle`'s check list → fell through to `DOCX_CODE_STYLE_IDS.plain` (near-black). After the primary fix, `<script>` tag text would be correctly tokenized but rendered as plain color.

**The fix**: add `cls.includes('tag') || cls.includes('selector')` to the `function`-color branch (blue `2563EB`).

---

## 5. Evidence That Confirmed Root Cause

After applying the whole-block fix, manually calling `hljs.highlight(htmlBlock, {language:'xml'})` in a REPL on the Gemini sample block produced:

- `<span class="hljs-tag">` wrapping `<script>` / `</script>` elements
- `<span class="language-javascript"><span class="hljs-keyword">` wrapping `const`, `function`, `return`, etc.
- `<span class="language-javascript"><span class="hljs-string">` wrapping string literals

Zero of these appeared in per-line mode. Every `<script>` content line returned raw text with no spans.

---

## 6. Fix Summary

**File 1: `utils/markdown-parse.ts`**

- `highlightCodeToLines`: rewritten to highlight entire block at once and call `splitHighlightedHtmlIntoLines`
- `highlightCodeLine`: deleted (no longer needed)
- `splitHighlightedHtmlIntoLines` (new): receives multi-line token stream from whole-block `hljs.highlight`, iterates tokens, splits on embedded `\n` chars, builds per-line arrays

**File 2: `services/export-docx/blocks/code.ts`**

- `resolveCodeTokenStyle`: added `cls.includes('tag') || cls.includes('selector')` to the `DocxCodeFunction` (blue) branch

**Result:** 41/41 tests pass. Gemini HTML code blocks now show purple keywords, green strings, blue tag names in Pages-opened DOCX.

---

## 7. Reusable Rules

### Rule 1: Syntax Highlighters With Embedded Language Support Must Receive The Full Block

Any highlighter that supports sublanguage or embedded grammars (highlight.js `xml`→`javascript`, `html`→`css`, Prism, etc.) requires the complete input. Per-line splitting destroys context-sensitivity. **Never split before highlighting when the language might embed another language.**

### Rule 2: Confirm Execution Context Before Assuming API Unavailability

When a browser API might be missing (DOMParser, fetch, etc.), first confirm *which JS context* the code actually runs in. Extension service workers, content scripts, chat-selection pages, offscreen documents, and Node.js test environments each have different API sets. Look at the entrypoint, not the code.

### Rule 3: When A Bug Is Specific To One Language Class But Not Others, Suspect Context-Dependency, Not Global Registration

If ChatGPT Python blocks work but Gemini HTML blocks don't, the character styles and token renderer are fine. The bug is in the path that handles HTML specifically — and the most likely candidate is anything that is context-sensitive about what makes HTML different from Python (embedded languages, multi-token structures, tag grammar).

### Rule 4: Audit Token Class Coverage After Any Highlighter Upgrade Or Language Addition

When adding a new highlight.js language or upgrading it, enumerate the classes it produces and verify every one is handled by `resolveCodeTokenStyle`. Common missing classes: `hljs-tag`, `hljs-name`, `hljs-attr`, `hljs-selector`, `hljs-built_in`, `hljs-params`.

---

## 8. Pattern Recognition For Future Incidents

| Signal | What to check |
|---|---|
| Code highlighting works for single-language blocks (Python, JS) but not for HTML/XML blocks | Per-line vs whole-block highlight strategy — check `highlightCodeToLines` |
| HTML code block produces zero colors but other languages work | Run `hljs.highlight(line, {language:'xml'})` on one of the JS-inside-script lines manually; if it returns no spans, you have confirmed line-by-line context destruction |
| Some token types in a code block are colored but structural tokens (tags, selectors) are plain | `resolveCodeTokenStyle` is missing a class pattern; audit `hljs-tag`, `hljs-name`, `hljs-selector`, `hljs-attr` |
| "Phase 1 fixed tests but export still broken" | Check whether the fix addressed the right execution context; tests (Node.js, Vitest) and browser pages have different available APIs |
