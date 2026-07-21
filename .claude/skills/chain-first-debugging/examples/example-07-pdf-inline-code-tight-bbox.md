# Case Study 07 - PDF Inline Code Background: Renderer Geometry, Minimal Probes, And Real Acceptance

> Why this example exists. This incident is the standard teaching case for a stubborn visual bug where repeated local tuning creates motion but not elimination. The fix was not "try harder on `lineHeight`". The fix came from asking which layer could actually make the symptom impossible, then proving that direction with the cheapest falsifiable probes, and only then editing product code.

> Scope note. This is deliberately the second half of the incident, not the first move. In this repository, browser/export fact collection belongs to `patched-mcp-chrome-devtools`. Use the companion example [`../../patched-mcp-chrome-devtools/examples/chat-selection-pdf-visual-mismatch-facts-before-renderer-hypothesis.md`](../../patched-mcp-chrome-devtools/examples/chat-selection-pdf-visual-mismatch-facts-before-renderer-hypothesis.md) first to capture source truth, chat-selection truth, and fresh PDF artifact truth. This file starts after that evidence gate has already proven that the mismatch still exists only in the exported artifact.

---

## 0. Incident Snapshot

- Surface: PDF export (`pdfmake`)
- Symptom: inline code background rectangle protruded visibly above the code text; users noticed the top edge immediately
- Fact-gate prerequisite: source page and chat-selection were already aligned; a fresh exported PDF still showed the mismatch
- False-progress trap: style and `lineHeight` tweaks could make the chip look closer, while the real bug class stayed alive
- Final fix class: renderer-layer background geometry patch + inline-code marker + persisted install-time patching
- Acceptance loop: reload extension -> trigger real PDF export -> wait for fresh download -> inspect the exported artifact

---

## 1. Symptom (Not Cause)

The user-visible failure was not "PDF text is broken".
It was a geometry mismatch:

- the inline code text itself was readable
- the background chip was too tall on top
- the bug was visually obvious precisely because inline code chips are small, high-contrast, and repeatedly scanned by users

Several business-side tweaks changed the appearance slightly, but none removed the top protrusion class of bug.

That distinction mattered. The investigation only progressed once the question changed from:

"How do we squeeze this box a bit more?"

to:

"What layer is actually deciding where this rectangle starts?"

---

## 2. Chain Map

```text
markdown `inline code`
  -> Marked / HTML `<code>`
  -> html-to-pdfmake CODE node with background
  -> markdown/theme post-processing
  -> pdfmake line measurement
  -> pdfmake TextDecorator.drawBackground
  -> createPdf / blob
  -> downloaded PDF artifact
```

**Actual first distortion layer:** the `pdfmake` renderer's background geometry, not markdown/theme style code.

---

## 3. Wrong Intuitions That Were Eliminated

### Wrong Hypothesis 1: Keep Tuning Business-Side `lineHeight`

**Reasoning:** if the background box is too tall, maybe the markdown/theme layer still has the wrong `fontSize` or `lineHeight`.

**Why this was plausible:** style code is the nearest visible layer and the symptoms looked like spacing.

**Why it was eliminated:** upstream source inspection showed that `pdfmake` background painting was anchored to the line top in `TextDecorator.drawBackground`, while line ascent logic did not treat `lineHeight` as the true origin control for the rectangle. This meant style-level tuning could change the degree of the problem, but not erase the class of top protrusion.

**Lesson:** if repeated knob-turning changes the number but not the shape of the failure, the geometry is probably being decided below the layer you are editing.

### Wrong Hypothesis 2: If The Tight-Background Branch Exists In Source, It Must Be Working

**Reasoning:** once the branch is added, a changed screenshot should follow.

**Why it was eliminated:** this incident needed four separate confirmations:

1. inline code node was actually marked for the branch
2. `node_modules/pdfmake/build/pdfmake.js` was actually patched
3. the built `dist` chunk actually contained the patched path
4. the real exported PDF artifact actually changed

Until all four were checked, "the branch exists" was not evidence.

**Lesson:** for build-time/runtime bugs, verify the whole activation chain, not just the source file.

### Wrong Hypothesis 3: Any Glyph-BBox Strategy Will Automatically Work For Courier

**Reasoning:** if the rectangle should match the rendered glyphs, then glyph bbox is the right answer.

**Why it was only partially true:** it was the right direction, but the runtime font mattered. `PDFKit`'s built-in `Courier` standard font exposed no `layout()`/glyph objects, so a glyph-bbox-only implementation could silently no-op even when the branch was active.

**The pivot:** inspect the runtime font object first. That probe showed the algorithm needed a fallback metrics path for standard fonts.

**Lesson:** do not assume the runtime object supports the algorithm you want. Capability-check it first.

---

## 4. The Method Decisions That Actually Broke The Stalemate

### Decision 1: Do Not Rush To Edit More Product Code

The profitable question was not "which local style value should change next?"

It was:

**"Which layer could actually make this bug impossible if it were correct?"**

That reframing moved the investigation from theme code to renderer geometry.

### Decision 2: Read Upstream Source Before More Blind Tuning

Instead of continuing to tweak markdown styles, the investigation stepped into `pdfmake` source and asked:

- where is the background rectangle drawn?
- what inputs decide its top and height?
- does `lineHeight` really control the top edge?

This was cheaper than another blind iteration and immediately separated cosmetic motion from structural control.

### Decision 3: Use Minimal Probes Before Editing Product Logic

The investigation used cheap, targeted probes instead of large edits:

1. a numeric geometry probe to compare intended box height vs actual math
2. a runtime font-capability probe to inspect whether `Courier` exposed glyph layout data
3. a built-artifact grep to confirm the patch reached `dist`
4. a single real export page check to distinguish "branch active" from "visual symptom still present"

Each probe was designed to falsify one model quickly.

### Decision 4: Make A Small, Decisive Change

The first business-side edit was not a large refactor.
It was a narrow marker:

- mark inline `CODE` nodes with `_tightBackgroundGlyphBox`
- leave `PRE`/fenced code blocks alone

That made the renderer-layer experiment falsifiable without widening scope.

### Decision 5: Use Real Acceptance, Not Just Intermediate Confidence

The incident only truly closed once the loop became:

- reload extension
- click the real PDF export button
- wait for a fresh download
- inspect the actual PDF artifact

This separated three states that screenshots or tests alone could not reliably separate:

1. code path never executed
2. code path executed but artifact did not materially change
3. artifact changed and the user-visible symptom was actually gone

For this repo, `patched-mcp-chrome-devtools` provided the mechanics for that acceptance loop.

---

## 5. Evidence That Changed The Search Direction

### Evidence A: Upstream Renderer Source

Reading the `pdfmake` renderer source showed that the inline background rectangle was drawn in `TextDecorator.drawBackground` from line-level geometry.

That proved the decisive layer was renderer geometry, not markdown theme styling.

### Evidence B: Numeric Geometry Probe

A numeric probe showed that the current style math did not actually produce the intended compact box height.

This killed the vague belief that "we already effectively made it a 10pt chip" and forced the investigation back to measurement instead of intuition.

### Evidence C: Runtime Font Capability Probe

Inspecting `PDFKit`'s `Courier` standard font object showed:

- no `layout()` API
- no glyph-level objects
- only coarser font metrics like `ascender`, `descender`, `capHeight`, and `bbox`

This explained why a renderer patch could exist yet still fail to tighten the rectangle if the algorithm assumed glyph-layout support.

### Evidence D: Dist And Runtime Presence Checks

The investigation explicitly checked that the marker and patch existed at four levels:

1. markdown-side `CODE` nodes
2. patched `node_modules/pdfmake/build/pdfmake.js`
3. built `dist/chrome-mv3/chunks/pdfmake-pdf.service-*.js`
4. fresh exported PDF artifact

This prevented the classic false diagnosis:

"the algorithm is wrong"

when the real issue is:

"the runtime never executed the algorithm you think it did."

---

## 6. Final Fix Pattern

The landed solution used a two-part contract.

### Part A: Mark Only Inline Code For Tight Background Handling

In `services/export-pdfmake/blocks/markdown.ts`:

- walk the pdfmake content tree after `html-to-pdfmake`
- mark inline `CODE` nodes with `_tightBackgroundGlyphBox = true`
- skip `PRE` contexts so fenced code blocks keep their normal block styling

This localized the renderer patch to the exact surface that needed the geometry fix.

### Part B: Patch `pdfmake` Renderer Geometry At Install Time

In `scripts/patch-pdfmake-inline-background.cjs` and `package.json` `postinstall`:

- patch `node_modules/pdfmake/build/pdfmake.js`
- extend `TextDecorator` with a tight-background measurement path
- when `font.layout()` exists, derive bounds from actual glyph bbox data
- when it does not exist (for example StandardFont/Courier), fall back to available font metrics (`ascender`/`descender` or `bbox`)
- use those bounds to draw the rectangle from tight font bounds instead of full line height

This moved the fix to the layer that actually owned the rectangle geometry.

### Part C: Lock The Contract With Regression Coverage

The focused regression did not try to assert the final PDF pixels.
It asserted the business-side contract that makes the runtime patch reachable:

- inline code node exists
- inline code node still has background
- inline code node carries `_tightBackgroundGlyphBox`

That is the right unit boundary for the product code.

---

## 7. Why This Example Matters More Than The Specific Bug

This case is valuable because it teaches a reusable debugging posture:

1. Keep the user-visible goal fixed.
2. Prefer the layer that can actually eliminate the bug class.
3. Read first-party source when the library owns the behavior.
4. Use minimal probes before large edits.
5. Make the smallest falsifiable change.
6. Verify on the real artifact, not just an intermediate representation.

That pattern generalizes beyond PDF inline code.
It applies to parser bugs, renderer bugs, export mismatches, CSS/host-dependency incidents, and any case where local tuning creates the illusion of progress.

---

## 8. Reusable Triggers

| Signal | What to check next |
|---|---|
| Repeated style/spacing/font tweaks change the degree of the bug, not its class | Step down one abstraction level and inspect the renderer/library code that owns final geometry |
| A runtime patch exists in source but output still looks unchanged | Verify activation chain end-to-end: marker -> patched dependency -> built artifact -> real exported output |
| A font-aware algorithm works for one font family but not another | Inspect the actual runtime font object; check whether glyph-level APIs exist before assuming bbox logic can run |
| You cannot tell whether the fix ran or merely changed a test object | Build the smallest real acceptance loop around the user-visible artifact |

---

## 9. The Teaching Sentence

When a hard bug stops yielding to local tuning, the next move is not "one more tweak".
The next move is:

**Find the lowest layer that could actually make the symptom impossible, prove that direction with the cheapest falsifiable probe, then validate it on the real artifact.**