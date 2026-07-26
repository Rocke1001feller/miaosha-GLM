---
name: docx-pages-first-validation
description: "Use when a DOCX export looks correct in tests or Word but renders wrong in Apple Pages — wrong alignment, missing spacing, collapsed padding, wrong font defaults, or any layout distortion that only surfaces in Pages. Covers the full Pages-first acceptance loop: Context7-first API lookup, minimal standalone probe, Pages AppleScript round-trip, OOXML package diff/bisection, mapping the winning diff back to docx-library-supported APIs, and real Pages render verification before declaring success. Trigger phrases: DOCX renders wrong in Pages, Pages-first validation, styles.xml, word/document.xml, right-aligned table cell, model badge padding, Context7 first, OOXML package diff, externalStyles, docDefaults, Normal style missing, Pages imports wrong alignment, 段落对齐在 Pages 里失效, Pages 不识别右对齐, DOCX 布局失真."
---

# DOCX Pages-First Validation

## 1. What This Skill Is For

Use this skill when a DOCX export artifact passes XML-level unit tests and looks correct in a quick preview but **renders incorrectly in Apple Pages**.

Common symptoms:

- A paragraph set to `AlignmentType.RIGHT` renders left-aligned after import into Pages.
- A table-cell spacing or padding that looks correct in Quick Look does not match what Pages actually shows.
- A model badge, user header, or assistant icon that looks right in a PDF preview appears shifted or missing inside Pages.
- Font or color defaults collapse to system defaults in Pages despite being set in the export code.
- Styles appear correct in `word/document.xml` but Pages ignores them.

The core insight this skill encodes:

> `document.xml` assertions are necessary but not sufficient. Pages applies its own interpretation of OOXML structural defaults. A DOCX that works in Word or passes XML inspection can still fail in Pages because of missing or incomplete definitions in `word/styles.xml`, `docDefaults`, or related parts.

---

## 2. Skill Positioning — When To Use What

This skill occupies a specific layer. Read this table before starting.

| Signal | Use this first |
|---|---|
| You do not know which layer in the export chain is distorted | `chain-first-debugging` |
| You have confirmed the DOCX artifact is wrong in Pages and need to find and fix the root cause | **this skill** |
| The DOCX is fixed and you need a repeatable browser-based regression runner from a real URL | `url-to-export-e2e-regression` with `endpoint.format='docx'` |
| You need to inspect live browser API traffic from a logged-in Chrome session | `patched-mcp-chrome-devtools` |

Do not combine the diagnostic loop here with URL-level browser automation. Fix and validate first; automate the regression after.

---

## 3. Core Principle

```text
source truth (intended layout)
  → generated OOXML truth (word/document.xml + word/styles.xml + relationships)
    → Pages-imported truth (what Pages actually renders)
      → first distortion layer
```

The first distortion layer is almost never the final visible symptom. Pages does not fail arbitrarily. It fails because a structural assumption in the OOXML package was never made explicit.

**The systematic job is:**

1. Confirm the source intent (what should this look like?).
2. Inspect the OOXML package as a whole, not just `document.xml`.
3. Generate a *working* Pages reference by letting Pages itself write a DOCX from its own state.
4. Binary-search the difference between the broken package and the working reference.
5. Map the first structural difference back to the smallest docx-library-supported fix.
6. Validate with real Pages render/export — not Quick Look, not Word, not a unit test.

---

## 4. Hard Rules

These are lessons that were learned by being wrong. Do not skip them.

1. **Query Context7 first.** Before guessing which `docx` object owns a OOXML behavior (alignment, spacing, font default, table default), call `mcp_io_github_ups_query-docs` for the `docx` library. The library's supported API surface is not always obvious from the TypeScript types alone.

2. **`document.xml` assertions are necessary but not sufficient.** A unit test that checks `<w:jc w:val="right"/>` is in `document.xml` does not prove Pages will honor it. Always add the real renderer gate.

3. **Quick Look is a cheap ambient check, not the oracle.** Use Quick Look to spot gross failures during iterative probing. Do not use it as a sign-off. The final acceptance gate is Pages itself.

4. **When `document.xml` looks correct but Pages renders wrong, jump to `styles.xml` next.** Pages' DOCX importer relies heavily on base style definitions. If `Normal` and `DefaultParagraphFont` are referenced but never defined, Pages falls back to its own defaults and can override paragraph-level properties including alignment.

5. **Prefer docx-library APIs over zip surgery.** The `docx` library exposes `externalStyles` (raw XML string for the styles part), `styles.default.document`, and `styles.importedStyles`. Use these before reaching for post-pack ZIP manipulation. Zip surgery is a last resort and breaks reproducibility.

6. **Validate with Pages render/export before declaring success.** Use the osascript round-trip in the scripts directory to open the DOCX in Pages, export to PDF, and render a thumbnail. A unit test passing is not done; Pages signing off is done.

7. **Never treat a Quick Look thumbnail or a `qlmanage` render as equivalent to Pages.** Quick Look uses a different rendering pipeline and is known to disagree with Pages on alignment properties inside table cells.

8. **For hyperlink/bookmark incidents, do not assume a Pages-written DOCX is a faithful reference package.** Pages can strip or rewrite bookmark and hyperlink OOXML semantics on export. Use the imported Pages document's click behavior, and when useful the exported PDF link annotations, as the acceptance truth.

9. **Do not assume `docx` helper objects generate Pages-safe OOXML.** If a bookmark or hyperlink bug survives a seemingly correct XML assertion, inspect the helper's emitted OOXML shape and the helper implementation itself. API-level correctness is not enough.

10. **For code-block syntax highlighting, highlight the entire block in a single call — never per-line.** Syntax highlighters with embedded-language support (highlight.js `xml`→`javascript` for `<script>` blocks, `xml`→`css` for `<style>` blocks) require the full document context in one pass. Splitting the code into lines before calling `hljs.highlight` destroys sublanguage activation: JS lines inside `<script>` return no `<span class="hljs-…">` elements and all tokens fall through to the plain character style. The canonical fix: highlight the whole block at once, then split the resulting token stream by `\n` characters. Regression signal: Python/TypeScript code blocks show colors correctly; HTML-labeled blocks with `<script>` content appear monochrome.

11. **After adding a new highlight.js language, audit all class names it emits and add any missing ones to `resolveCodeTokenStyle`.** Common unmapped classes for HTML/CSS documents: `hljs-tag`, `hljs-name`, `hljs-attr`, `hljs-selector`, `hljs-built_in`. If any class falls through to `DOCX_CODE_STYLE_IDS.plain`, it renders as near-black regardless of the token semantics.

---

## 5. Standard Operating Procedure

### Step 1. Confirm Source Intent

Write down in one sentence what the layout is supposed to look like. For example: "The user header row inside the bubble table cell must be right-aligned: timestamp on the left side of the text flow, but the whole paragraph anchored to the right edge."

Do not start probing until this is explicit.

### Step 2. Check Context7 For API Ownership

Ask Context7 which `docx` object controls the behavior:

```text
mcp_io_github_ups_query-docs: docx paragraph alignment table cell
mcp_io_github_ups_query-docs: docx externalStyles styles default document
mcp_io_github_ups_query-docs: docx IParagraphStylePropertiesOptions alignment
```

If Context7 returns a clear owner, start there. Do not guess.

### Step 3. Produce A Minimal Standalone Probe

Create a self-contained Node script outside the repository (e.g., `/tmp/probe-<feature>.mjs`) that:

- imports only `docx` and `node:fs`
- builds the smallest DOCX that exercises the behavior in question
- writes the DOCX to a temp path

This probe must be independent of the repo's Vite aliases, asset imports, and font loading. Keep it under 60 lines.

See `scripts/pages-roundtrip-template.sh` for a driver that opens the probe DOCX in Pages and exports to PDF for visual inspection.

### Step 4. Inspect The OOXML Package

Unzip the probe DOCX and inspect the relevant parts:

```bash
unzip -o /tmp/probe.docx -d /tmp/probe-unzip
```

Key files to read in order:

| File | What to look for |
|---|---|
| `word/styles.xml` | Are `Normal` and `DefaultParagraphFont` defined? Are `docDefaults` concrete or empty? |
| `word/document.xml` | Does the target paragraph contain `<w:jc>`, spacing, and indent nodes? |
| `word/settings.xml` | Compatibility flags that might suppress layout features |
| `word/_rels/document.xml.rels` | Are all required font/image/style relationships present? |

### Step 5. Generate A Pages Reference

If Step 4 shows `document.xml` looks correct but Pages still renders wrong:

1. Open the broken DOCX in Pages via AppleScript (see `scripts/pages-roundtrip-template.sh`).
2. Use Pages AppleScript to set the offending property to the correct value directly on the imported document (e.g., `set alignment of paragraph 1 of cell X to right`).
3. Export back to DOCX: `export docRef to POSIX file "...reference.docx" as Microsoft Word`.
4. Unzip and compare the reference DOCX against the original broken DOCX using `scripts/docx-package-diff-template.py`.

Exception for bookmark/hyperlink incidents: if Pages rewrites or strips bookmark semantics on export, use direct OOXML inspection of the original package plus imported Pages click behavior instead of relying on the round-tripped DOCX as your main diff source.

### Step 6. Binary-Search The OOXML Parts

Use the diff script to identify which files changed between the broken and reference packages. Then test each candidate in isolation:

1. If `styles.xml` changed and `document.xml` did not → rebuild only `styles.xml` swap into the broken package and re-test in Pages.
2. If `settings.xml` changed → try the same swap.
3. Continue bisecting until exactly one changed file (or set of nodes within a file) makes Pages render correctly.

Use `scripts/docx-package-diff-template.py` with `--swap-only styles.xml` to automate this.

### Step 7. Map The Fix To The docx Library

Once you know which OOXML nodes must change, find the smallest docx-library fix:

- **If the fix is in `styles.xml` docDefaults or base styles** → use `externalStyles` to supply a minimal XML fragment with concrete `Normal`, `DefaultParagraphFont`, and `docDefaults`.
- **If the fix is a paragraph-level style property** → use `styles.default.document.paragraph`.
- **If the fix requires adding a named paragraph style** → use `styles.paragraphStyles` array.
- **Only if no docx API covers the needed change** → use post-pack ZIP patching as a documented last resort and add a comment explaining why.

### Step 8. Add Narrow Regression Tests

Add at least two tests to the relevant `tests/services/` file:

1. **XML structure test**: assert the specific OOXML node (e.g., `<w:jc w:val="right"/>`) is present in `document.xml` or `styles.xml`.
2. **Styles completeness test**: assert the DOCX emits `w:styleId="Normal"`, `w:styleId="DefaultParagraphFont"`, non-empty `<w:pPrDefault>`, and non-empty `<w:rPrDefault>` in `word/styles.xml`.

Use the `readDocxXmlParts` + `readDocxStylesXml` pattern from `tests/services/docx-export.service.test.ts`.

### Step 9. Run Real Pages Acceptance

Run the acceptance gate before merging:

```bash
# 1. Build the minimal probe or use the vitest temp-export pattern
npx vitest run tests/services/docx-export.service.test.ts

# 2. Generate a real artifact using the repo's own export code (vitest pattern)
# See example-01 and example-02 for the exact vitest one-shot pattern

# 3. Open in Pages and export to PDF
osascript scripts/pages-roundtrip-template.sh /path/to/artifact.docx /tmp/artifact.pdf

# 4. Render thumbnail and inspect
qlmanage -t -s 1600 -o /tmp/pages-result /tmp/artifact.pdf
```

If the Pages thumbnail shows the correct layout, the fix is done.

---

## 6. Acceptance Gate

All must be true before the fix is declared complete:

| Gate | Required evidence |
|---|---|
| Unit test: XML structure | Vitest assertion passes on `<w:jc w:val="right"/>` or the target OOXML node |
| Unit test: styles completeness | Vitest assertion passes on `Normal`, `DefaultParagraphFont`, `<w:pPrDefault>`, `<w:rPrDefault>` |
| Real Pages render | Pages-exported PDF thumbnail shows correct layout (not Quick Look, not Word) |
| No zip surgery without comment | If `externalStyles` or docx-library APIs were not sufficient, the post-pack code has a comment citing the unsupported OOXML feature |
| Regression test committed | The fixing test is in `tests/services/docx-export.service.test.ts`, not just a temp probe |

---

## 7. Anti-Patterns

1. **Treating Quick Look as the acceptance oracle.** Quick Look and Pages use different rendering pipelines. `qlmanage` is for rapid iteration only.

2. **Fixing `document.xml` without checking `styles.xml`.** If Pages ignores paragraph-level properties, the root cause is almost always in the styles part, not the paragraph node.

3. **Writing a Pages round-trip reference and then ignoring it.** The reference DOCX written by Pages is the ground truth. If you do not diff it against the broken package, you are guessing.

4. **Using post-pack ZIP surgery without documenting why.** If `externalStyles` covers the change, use it. Only reach for ZIP manipulation when the docx library genuinely does not expose the required XML node.

5. **Skipping Context7.** The `docx` library has a large API surface with non-obvious property names. Guessing which option controls a behavior leads to exhaustive trial-and-error. Context7 gives a faster and more reliable starting point.

6. **Declaring success after unit tests pass.** Unit tests verify XML structure. They do not verify Pages behavior. The real Pages render gate cannot be skipped.

7. **Creating a full fixture file just to run one probe.** The minimal standalone probe pattern (Step 3) exists for fast iteration. Keep probes outside the repo. Only commit the regression test shape.

8. **Assuming bookmark targets inside table cells are equivalent to top-level paragraph targets.** For Pages, that is not a safe assumption. If internal hyperlinks must resolve reliably, prove the table-cell variant with a real Pages probe before you commit to it.

9. **Assuming `w:anchor` and `w:name` string equality is sufficient.** Pages also depends on bookmark identity and placement semantics. Duplicate `w:id` values or unstable target placement can still make the link fail.

10. **Using bare `source-${refId}` bookmark names in real multi-message exports.** A one-message probe can hide anchor collisions. If the export can contain multiple cited messages, scope bookmark names by message identity.

---

## 8. Known Root Causes Catalog

| Symptom in Pages | Root cause | Fix |
|---|---|---|
| Right-aligned paragraph in table cell renders left-aligned | `word/styles.xml` references `Normal` and `DefaultParagraphFont` but never defines them; Pages falls back to its own defaults | Provide `externalStyles` with explicit `Normal`, `DefaultParagraphFont`, and `docDefaults` |
| Font defaults collapse to system font | `docDefaults > rPrDefault` is empty or absent | Add concrete `<w:rFonts>`, `<w:sz>`, `<w:color>` to `rPrDefault` in the `externalStyles` fragment |
| Paragraph spacing ignored | `docDefaults > pPrDefault` is absent | Add concrete `<w:spacing>` and `<w:ind>` to `pPrDefault` |
| Table cell background or border not shown | Relationship or namespace missing in the package | Inspect `word/_rels/document.xml.rels` and cross-reference with `[Content_Types].xml` |
| Clicking an internal citation link shows "There's no bookmark for this link." | Bookmark target is inside a table cell, bookmark numeric `w:id` values are duplicated, or both | Move the target bookmark to a top-level paragraph, ensure each bookmark gets a document-unique numeric `w:id`, and verify in real Pages click behavior |
| Citation links work in a single-message probe but jump incorrectly or collide in a real export | Bookmark names are only `source-${refId}` and collide across multiple cited messages | Scope bookmark names and internal hyperlink anchors by `message.id` |

---

## 9. See Also

- [`chain-first-debugging`](../chain-first-debugging/SKILL.md) — Use first when the distortion layer is unknown. This skill assumes you already know the artifact is wrong in Pages and the chain up to DOCX generation is clear.
- [`url-to-export-e2e-regression`](../url-to-export-e2e-regression/SKILL.md) — Use after the fix is verified to build a repeatable browser-based regression case starting from a real URL.
- [`patched-mcp-chrome-devtools`](../patched-mcp-chrome-devtools/SKILL.md) — Use when you need to capture live browser API traffic to establish source truth for the conversation content being exported.
- [Case Study 01 — User Header Right Alignment](./examples/example-01-user-header-right-alignment-styles-root-cause.md) — Base styles missing in `styles.xml` cause Pages to ignore otherwise-correct paragraph alignment.
- [Case Study 02 — Citation InternalHyperlink Bookmark Resolution](./examples/example-02-citation-internal-hyperlink-bookmark-resolution.md) — Pages rejects internal citation links when bookmark IDs, placement, or anchor namespaces are unsafe.
- [`/memories/repo/docx-pages-base-styles-alignment.md`](../../../memories/repo/docx-pages-base-styles-alignment.md) — Repository-scoped lesson from the first incident that triggered this skill.
