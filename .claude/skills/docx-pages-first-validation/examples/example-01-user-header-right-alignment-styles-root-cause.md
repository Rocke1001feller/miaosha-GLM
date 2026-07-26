# Case Study 01 — User Header Right Alignment: Pages Ignores `<w:jc>` When Base Styles Are Undefined

> **Why this example exists.** This is the first incident that required the Pages-first validation methodology. It established that Apple Pages can silently override paragraph-level alignment when `word/styles.xml` references base styles that are never defined. The fix — supplying `externalStyles` with concrete `Normal`, `DefaultParagraphFont`, and `docDefaults` — became the template for all subsequent Pages compatibility work.

---

## 0. Incident Snapshot

- **Date:** 2026-05-14 (initial investigation), 2026-05-15 (fix committed)
- **Branch:** `polish-v2.0.0-release`
- **Surface:** DOCX export → user message header row inside bubble table cell
- **Symptom in Pages:** The user header paragraph (timestamp left, username right) rendered entirely left-aligned. The `<w:jc w:val="right"/>` node was present in `document.xml` and the unit tests passed, but Pages showed left-aligned text.
- **Severity:** Medium — visually wrong but not data-losing
- **Status:** Resolved — all 28 DOCX tests pass; real Pages render shows correct right-alignment

---

## 1. What Was Observed (Symptom, Not Cause)

After building a DOCX export of a conversation, the user message header row inside each chat bubble table cell showed the timestamp and username both left-aligned. On the source chat site (ChatGPT, Claude), the user label appears right-aligned inside the bubble.

The unit tests asserting `<w:jc w:val="right"/>` in `document.xml` passed. Quick Look thumbnail of the DOCX also appeared to show correct alignment in the header row at first glance.

---

## 2. Wrong Hypotheses Eliminated First

**Hypothesis A: The `AlignmentType.RIGHT` property was being overridden by a Paragraph option.**

Investigation: Inspected every `new Paragraph({...})` call in the user header row. Confirmed `alignment: AlignmentType.RIGHT` was set. Confirmed `<w:jc w:val="right"/>` was present in `document.xml`. This hypothesis was eliminated.

**Hypothesis B: Pages requires the alignment on the TableCell, not the paragraph.**

Investigation: Added `textType: TextDirection.LEFT_TO_RIGHT_TOP_TO_BOTTOM` to the TableCell definition. Made no difference. Eliminated.

**Hypothesis C: Quick Look is rendering it correctly and Pages is wrong.**

Investigation: Generated a Pages round-trip reference DOCX (see Step 4 below). The Quick Look thumbnail of that reference did not differ from the broken DOCX. Confirmed Quick Look is not a reliable oracle for this property. Eliminated.

---

## 3. Chain Map

```text
source chat site (intended layout: right-aligned user header)
  → DOCX export code: new Paragraph({ alignment: AlignmentType.RIGHT, ... })
    → docx library serializes <w:jc w:val="right"/> into word/document.xml
      → docx library generates word/styles.xml with:
          - empty <w:rPrDefault/> and <w:pPrDefault/> in docDefaults
          - all paragraph styles reference basedOn="Normal"
          - Normal itself is NEVER defined in styles.xml
            → Pages DOCX importer encounters undefined base style
              → Pages falls back to its own default paragraph alignment (left)
                → <w:jc w:val="right"/> in document.xml is overridden
                  → visible symptom: right-aligned paragraph renders left
```

**First distortion layer:** `word/styles.xml` — missing `Normal` and `DefaultParagraphFont` definitions.

---

## 4. The Pages Round-Trip Reference

The bisection required a ground-truth DOCX that Pages would render with correct right-alignment. Generated as follows:

1. Created a minimal probe DOCX (`/tmp/probe-right-align.docx`) using a standalone Node script with one table containing one paragraph with `AlignmentType.RIGHT`.
2. Opened the probe in Pages via AppleScript:
   ```applescript
   tell application "Pages"
     set docRef to open POSIX file "/tmp/probe-right-align.docx"
   end tell
   ```
3. Used Pages itself to set right-alignment on the paragraph, then exported back to DOCX:
   ```applescript
   tell application "Pages"
     tell docRef
       tell its body text
         set alignment of paragraph 1 of table 1 of text item 1 to right
       end tell
       export to POSIX file "/tmp/probe-right-align-reference.docx" as Microsoft Word
     end tell
   end tell
   ```
4. Unzipped both DOCX files and ran the diff script on `word/styles.xml`.

---

## 5. OOXML Package Diff Result

The `styles.xml` diff between the broken probe and the Pages-written reference revealed:

**Broken probe `styles.xml`:**
```xml
<w:docDefaults>
  <w:rPrDefault/>
  <w:pPrDefault/>
</w:docDefaults>
<!-- ... all paragraph styles reference basedOn="Normal" ... -->
<!-- Normal is never defined -->
```

**Pages-written reference `styles.xml`:**
```xml
<w:docDefaults>
  <w:rPrDefault>
    <w:rPr>
      <w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/>
      <w:sz w:val="24"/>
      <w:szCs w:val="24"/>
    </w:rPr>
  </w:rPrDefault>
  <w:pPrDefault>
    <w:pPr>
      <w:jc w:val="left"/>
      <w:spacing w:line="276" w:lineRule="auto"/>
    </w:pPr>
  </w:pPrDefault>
</w:docDefaults>
<!-- Explicit Normal style definition -->
<w:style w:type="paragraph" w:default="1" w:styleId="Normal">
  <w:name w:val="Normal"/>
  <w:pPr>...</w:pPr>
  <w:rPr>...</w:rPr>
</w:style>
<!-- Explicit DefaultParagraphFont definition -->
<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont">
  <w:name w:val="Default Paragraph Font"/>
  <w:semiHidden/>
  <w:unhideWhenUsed/>
</w:style>
```

**Bisection result:** Swapping only `styles.xml` from the reference into the broken probe was sufficient to make Pages honor the right-alignment. `settings.xml` and `document.xml` were not causal.

---

## 6. The Fix

**Location:** Created a new file `services/export-docx/external-styles.ts`

**Mechanism:** The `docx` library accepts an `externalStyles` property on `new Document({...})` that injects raw XML into `word/styles.xml` via `ExternalStylesFactory`. This is the correct docx-library-supported API.

**Content of `PAGES_COMPATIBLE_EXTERNAL_STYLES`:**

The exported constant provides:
1. `<w:docDefaults>` with concrete `<w:rPrDefault>` (font, size, color) and `<w:pPrDefault>` (spacing, indent, left-alignment as the document default)
2. `<w:style w:type="paragraph" w:default="1" w:styleId="Normal">` — the base paragraph style Pages requires to exist
3. `<w:style w:type="character" w:default="1" w:styleId="DefaultParagraphFont">` — the base character style with `semiHidden` and `unhideWhenUsed`

**Wired in `services/export-docx/index.ts`:**
```ts
import { PAGES_COMPATIBLE_EXTERNAL_STYLES } from './external-styles';

const doc = new Document({
  externalStyles: PAGES_COMPATIBLE_EXTERNAL_STYLES,
  // ... rest of Document options
});
```

---

## 7. Regression Tests Added

In `tests/services/docx-export.service.test.ts`:

**Test 1 — Structural (was already passing before fix):**
```ts
it('user header paragraph has right alignment', async () => {
  const blob = await buildDocxBlob(fixture);
  const docXml = await readDocxXmlParts(blob);
  expect(docXml).toContain('<w:jc w:val="right"/>');
});
```

**Test 2 — Styles completeness (new, added as part of fix):**
```ts
it('emits the base styles Pages needs to preserve right-aligned table-cell paragraphs', async () => {
  const blob = await buildDocxBlob(smallestFixture);
  const stylesXml = await readDocxStylesXml(blob);
  expect(stylesXml).toContain('w:styleId="Normal"');
  expect(stylesXml).toContain('w:styleId="DefaultParagraphFont"');
  expect(stylesXml).toContain('<w:pPrDefault><w:pPr>');
  expect(stylesXml).toContain('<w:rPrDefault><w:rPr>');
});
```

---

## 8. Verification

1. All 28 DOCX unit tests pass: `npx vitest run tests/services/docx-export.service.test.ts`.
2. Pages round-trip acceptance: opened the fixed DOCX in Pages via AppleScript, exported to PDF, rendered thumbnail with `qlmanage -t -s 1600`. The header row shows timestamp on the left and username text right-aligned — correct layout confirmed.

---

## 9. Transferable Lessons

1. **`document.xml` is not the whole truth.** Pages resolves paragraph properties against the full style inheritance chain. A missing base style definition can silently override paragraph-level properties even when the correct node is present.

2. **Quick Look lies about alignment.** For this specific bug class, Quick Look and `qlmanage` showed no visible difference between the broken and fixed DOCX. Only a real Pages render revealed the problem.

3. **The docx library leaves `styles.xml` minimal by design.** The library generates the smallest valid OOXML package. "Smallest valid" according to the OOXML spec is not the same as "concrete enough for Pages to trust." Pages requires base styles to be explicitly defined.

4. **`externalStyles` is the correct escape hatch.** The docx library explicitly supports injecting raw XML into the styles part. This is not a hack — it is the intended extension point for behaviors the typed API does not expose.

5. **The Pages round-trip bisection method is reliable.** Generating a reference DOCX from Pages itself, then diffing it against the broken package, produces a minimal and verifiable change set. The bisection terminates quickly because DOCX packages have a small number of structurally distinct parts.

6. **Swap only one part at a time.** Replacing all changed parts at once does not prove causality. Replace only `styles.xml` first. If that is sufficient, you have the root cause. Only combine parts if the single-part swap does not fix the behavior.
