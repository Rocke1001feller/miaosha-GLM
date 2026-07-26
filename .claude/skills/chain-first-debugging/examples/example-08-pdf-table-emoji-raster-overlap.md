# Case Study 08 — PDF Table Overlap Was Not A Width Bug; Emoji Rasterization Replaced Wrap-able Text With Full-Width Images

> Why this example exists. This incident took five rounds to close because early attempts optimized the wrong layer: table widths, noWrap flags, and text-breaking internals. The visible symptom was "column 3 text crossing into column 4", but the first true distortion layer was a different boundary: emoji rasterization replacing table-cell text with image nodes.

---

## 0. Incident Snapshot

- Surface: chat-selection -> PDF export (`pdfmake`)
- Symptom: page 5 bottom / page 6 top table rows overlapped across col3 and col4 boundaries
- Severity: high visual correctness risk (facts in table remained present but became unreadable)
- Root-cause type: wrong artifact type in table cells (text -> image replacement) causing loss of column wrapping semantics
- Acceptance path: patched MCP real-loop (`example4`) with explicit page set including pages `5,6`

---

## 1. What Failed In The First Four Rounds

### Round 1 — Width And `noWrap` Tuning (Moved But Did Not Eliminate)

Actions:

- constrained table widths to explicit numeric pt values
- enforced `noWrap: false` recursively
- verified runtime logs for width array and content width

Why this failed:

- These controls only affect text layout.
- The problematic rows were no longer pure text by the time pdfmake rendered them.
- Once a cell is replaced by an image node, text wrapping controls cannot apply.

### Round 2 — Deep Dive Into pdfmake Text Breaking Internals

Actions:

- traced `TextBreaker`, `Line.hasEnoughSpaceForInline`, `noNewLine`, `isForceContinue`
- validated theory around CJK punctuation and token boundaries

Why this failed:

- The analysis assumed the renderer was laying out text inlines.
- In the failing rows, the renderer was laying out an image width, not text tokens.

### Round 3 — Parent/Child Property Propagation + Citation Link Semantics

Actions:

- propagated inline properties into font runs
- converted citation hash links to `linkToDestination`
- added stronger table `wordBreak` policy

What improved:

- citation click behavior became correct
- text-run metadata became safer against flattening

Why overlap still happened in earlier artifact:

- none of these changes remove a text->image replacement inside table cells

### Round 4 — Artifact Acceptance Without Full Boundary Isolation

Actions:

- ran real export acceptance and confirmed overlap persisted

Why this still did not produce root cause immediately:

- artifact truth was known, but source truth and chat-selection truth had not yet been locked together in one chain report
- until that happened, search space still included extraction/parser hypotheses

---

## 2. Chain-First Reframe That Broke The Stalemate

The key move was to force all three anchors first:

1. source truth (source site table looked normal)
2. target truth before artifact (chat-selection DOM metrics showed no horizontal overflow)
3. artifact truth (PDF page 6 still overlapped)

Once these three were aligned, the first distortion layer had to be inside PDF export transformation/render pipeline, not extraction and not chat-selection DOM.

---

## 3. Full Chain Map

```text
Kimi source page table
  -> extraction payload
  -> chat-selection DOM table
  -> markdown -> html-to-pdfmake table nodes
  -> applyTableLayouts (widths/noWrap/wordBreak)
  -> rasterizePdfEmojiContent (text node replacement)
  -> normalizePdfTextContent
  -> pdfmake layout/render
  -> downloaded PDF artifact
```

First true break:

- `rasterizePdfEmojiContent` replaced emoji-containing table cell text blocks (for example rows with `❌`, `⚠️`, `⭐⭐⭐`) with image nodes sized by page content width.

---

## 4. Real Evidence

### Evidence A — chat-selection table had no overflow before export

DOM metrics probe on chat-selection table showed:

- col3 and col4 had `scrollWidth === clientWidth`
- `overflowX: false` for data rows

So overlap did not exist at target pre-export stage.

### Evidence B — PDF artifact still overlapped

`example4` page screenshots (including page 6) showed col3 crossing into col4 in older artifact.

### Evidence C — emoji rasterizer contract explained the mismatch

`services/export-pdfmake/emoji.ts` behavior before fix:

- detect emoji in flattened text
- rasterize entire text block via Canvas
- replace node with `{ image, width: min(raster.width, contentWidth) }`
- `contentWidth` is page-level width, not table cell width

This makes table-cell content lose text wrapping semantics and allows visual overflow into adjacent cells.

---

## 5. Root Cause (Precise Statement)

The first distortion layer was not table column width calculation and not pdfmake text breaker.

It was a type-conversion bug in export transformation:

- table cell text containing emoji markers was converted into image nodes
- image nodes were width-bounded by page content width, not by table cell width
- pdfmake then laid out an oversized image inside the row, producing cross-cell overlap

---

## 6. Fix At The Correct Layer

Location:

- `services/export-pdfmake/emoji.ts`

Fix pattern:

1. Introduce internal traversal with an `inTable` flag.
2. Skip emoji rasterization when current subtree is inside a table.
3. Continue rasterization outside tables (preserve original behavior for normal paragraphs).

Implementation shape:

- `rasterizePdfEmojiContent()` now delegates to `rasterizePdfEmojiContentInternal(..., inTable=false)`
- recursion into `table.body` calls internal traversal with `inTable=true`
- string/object text replacement paths are gated by `!inTable`

Result:

- table cells stay as text nodes, so pdfmake column wrapping remains effective
- non-table emoji text can still be rasterized where intended

---

## 7. Regression Protection

Added focused test:

- `tests/services/pdfmake-pdf.service.test.ts`
- case: `skips emoji rasterization in tables so cell text remains wrap-able`

Assertions:

- table cell with emoji remains `text` (not `image`)
- non-table emoji text still rasterizes to image

This protects the exact boundary that failed in production.

---

## 8. Real Acceptance After Fix

Acceptance loop:

- reload extension
- real click on PDF export button (no synthetic JS click shortcut)
- wait for fresh download
- capture screenshots including pages `5` and `6`

Outcome:

- new artifact no longer shows col3/col4 overlap on page 6
- table content wraps within cell boundaries

---

## 9. Lessons From The Failed Rounds

1. If all width/noWrap diagnostics are correct but overlap persists, verify node type before studying text breaker internals.
2. For table bugs, any text->image conversion is a high-risk boundary and must be audited first.
3. Do not trust a single endpoint truth. Lock source + chat-selection + artifact before code edits.
4. A fix that improves adjacent behavior (for example citation linking) can still be irrelevant to the dominant visual failure class.
5. Keep acceptance page set explicit for incident anchors (`VERIFY_PAGES=5,6,...`) so the known failure boundary is always retested.

---

## 10. Reusable Trigger

Use this case when all of the following appear together:

- exported PDF table has cross-column overlap
- chat-selection table itself does not overflow
- problematic cells include emoji markers (status icons, stars, warning symbols)
- width/noWrap logs look correct but artifact remains wrong

If these conditions match, inspect emoji/image replacement in table subtrees before tuning pdfmake line-break internals.
