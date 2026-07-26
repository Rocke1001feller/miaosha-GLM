# Case Study 03 — Kimi Mermaid Diagrams Were Not "Too Large Inside"; The SVG Was Being Upscaled After Render

> **Why this example exists.** This incident illustrates a failure mode that is especially hard to debug: two passes of investigation changed the right-feeling things and produced no improvement. The failure looked like an internal geometry problem — nodes seemed too large, spacing too wide — but the actual root cause was at a completely different layer: the SVG embedding contract between the render output and the image element. The key lesson is that **internal geometry and external scaling are orthogonal debugging dimensions**; tuning one cannot fix the other.

---

## 0. Incident Snapshot

- **Date Range:** 2026-04-07 to 2026-04-08
- **Surface:** extension → chat-selection Mermaid hydrator → `<img>` SVG embed
- **Severity:** medium — diagrams technically rendered but visually broken in scale
- **Resolution depends on:** understanding the boundary between Mermaid's SVG generation contract and the browser's image embedding contract
- **Full postmortem:** `docs/archive/postmortems/postmortem-kimi-mermaid-scaling.md`
- **Regression test:** `tests/entrypoints/chat-selection-rendering.test.ts` — "keeps Mermaid SVGs on a fixed-width embed contract instead of width=100%"

---

## 1. What Was Observed (Symptom, Not Cause)

Before this incident: Kimi Mermaid fenced code blocks rendered as raw code in chat-selection and export. No diagram was produced.

After adding the shared Mermaid hydrator: diagrams now rendered. Problem solved? No.

The new symptom: **Mermaid diagrams appeared at roughly an order of magnitude larger scale than surrounding content**. A flowchart that should be thumbnail-sized was stretching to fill the entire chat-selection viewport width. Node labels appeared in massive text. Vertical rank spacing was enormous. The diagram was legible but grotesquely oversized compared to the prose paragraphs around it.

User confirmed: a screenshot comparison against the live Kimi source page showed the diagram was dramatically larger than Kimi's own rendering.

---

## 2. Intuition Round 1 — The First Wrong Model

**Intuition:** "Mermaid default font sizes and node spacing are too large. Reduce internal geometry parameters."

This felt logical. The nodes look big → the font is probably big → reduce the font. This is the "match the visual observation to an obvious control knob" instinct.

**Parameters adjusted in Round 1:**

```typescript
// MERMAID_RENDER_CONFIG before Round 1
flowchart: {
  useMaxWidth: true,    // ← never questioned
  nodeSpacing: 50,
  rankSpacing: 50,
  padding: 6,
}
themeVariables: {
  fontSize: '16px',
}

// After Round 1 adjustment
flowchart: {
  useMaxWidth: true,    // ← still not questioned
  nodeSpacing: 20,      // ← reduced
  rankSpacing: 25,      // ← reduced
  padding: 6,
}
themeVariables: {
  fontSize: '10px',     // ← reduced
}
```

**Result:** Tests passed. Build passed. In the real browser — **no visible change**. The diagram was still the same enormous size.

**Post-Round-1 analysis question:** How could reducing `fontSize` from 16px to 10px produce no visual change at all?

The answer, in hindsight: because those internal dimension values were multiplied by an external scale factor that was not yet identified. Even at 10px internal font size, if the entire SVG is being stretched to 4× its intrinsic width, the final rendered text appears at 40px.

---

## 3. Chain Map — The Full Path From Mermaid Input To Final Pixels

This was not drawn out until after Round 1 failed. It should have been the first move.

```
Kimi markdown code fence (```mermaid ... ```)
  └→ markdown-to-HTML (marked.js) → <pre class="language-mermaid"> literal code block
      └→ hydrateMermaidDiagrams() in rendering.ts
          └→ mermaid.initialize(MERMAID_RENDER_CONFIG)
              └→ mermaid.render('id', definition) → returns { svg: string }
                  └→ svg string with <svg width="?" height="?" viewBox="...">
                      └→ encodeURIComponent(svg) → URL-safe string
                          └→ `data:image/svg+xml,${encoded}` → data URI
                              └→ img.src = dataUri
                                  └→ <img> element placed in chat-selection container
                                      └→ browser renders <img> by SVG rules
                                          └→ FINAL VISUAL SIZE ON SCREEN
```

**Two entirely different layers control "size":**

| Layer | What it controls | Config knob |
|---|---|---|
| Mermaid internal geometry | Node size, label font size, spacing between ranks | `fontSize`, `nodeSpacing`, `rankSpacing`, `padding` |
| SVG intrinsic sizing contract | Whether the SVG expands to container width or stays fixed-pixel | `useMaxWidth` → `width="100%"` vs `width="320"` |

Round 1 only touched Layer A. Layer B was never touched.

---

## 4. Define Both Ends (Should Have Been The First Move)

### Source Truth

Kimi's own source page rendered the same flowchart definition as a compact block — visually proportional to adjacent paragraph text, sitting within a readable width boundary.

The Mermaid definition text itself was ordinary flowchart syntax with no dimension annotations. There was no reason in the source content to expect an oversized output.

### Target Truth

In chat-selection:
- The diagram should appear visually proportional to surrounding message content.
- It should be readable without horizontal scrolling.
- It should not fill the entire viewport width.
- It should scale no larger than the Kimi source rendering.

---

## 5. Round 1 Evidence That Was Ignored

After Round 1, the symptom was unchanged. The correct response to this would have been: "If reducing internal geometry by 50% did not change the visual size at all, then the visual size is not controlled by internal geometry."

This reasoning was not applied immediately. A second round of internal geometry adjustment was reached for instead. **This is the pattern to learn from: when an obvious fix produces zero effect, the symptom is likely at a different layer than you are working on.**

---

## 6. Intuition Round 2 — Still Wrong, But Getting Closer To The Right Question

After Round 1 produced no improvement, the investigation tried more extreme internal values:

```typescript
fontSize: '8px',  // ← extreme reduction
nodeSpacing: 15,
rankSpacing: 20,
```

**Result:** Slight reduction visible but still massively oversized. The ratios between node and surrounding content improved only trivially.

**The question that should have ended Round 2 immediately:**
> If this chart's internal font is 8px and the rest of the page is 14px, why does the chart still appear larger?

The answer was in the SVG output itself: **the width attribute on the generated SVG root element**.

---

## 7. Investigation Move — Inspect The Actual Generated SVG

**Question:** What does the SVG that Mermaid generates actually look like? Specifically: what values does it have on `width`, `height`, and `viewBox`?

**Action:** In the browser's developer tools (or by log/inspect inside `hydrateMermaidDiagrams()`), capture the raw SVG string returned by `mermaid.render()` before it gets encoded into a data URI.

**Result:**

```html
<svg width="100%" style="max-width: 960px;" viewBox="0 0 960 480" ...>
  ...all diagram content...
</svg>
```

**This is the proof.** `width="100%"`.

---

## 8. Tracing The Width="100%" Through The Embedding Chain

With `width="100%"` in the SVG:

**Step 1: SVG is encoded to data URI**
```
data:image/svg+xml,%3Csvg%20width%3D%22100%25%22...
```
The `width="100%"` is preserved inside the URI.

**Step 2: Data URI is set as `img.src`**
```html
<img src="data:image/svg+xml,..." style="max-width:100%">
```

**Step 3: Browser resolves the `<img>` dimensions**
The browser sees an `<img>` with no explicit `width` attribute. To determine the rendered size, it reads the SVG's intrinsic dimensions from its root element. The SVG says `width="100%"` — which means: "100% of my containing block." Inside an `<img>` element, the containing block is the `<img>` itself, which typically fills its own container (the chat-selection content column, ~900px wide).

**Result:** Even with `fontSize: '8px'` inside the viewBox, the entire viewBox is stretched to 900px wide. A `viewBox="0 0 960 480"` diagram rendered at 900px effective width makes every 8px internal font appear as ~7.5px × 900/960 ≈ 7px actual render font. Wait — that's proportional. But the problem is not the font relative to the viewBox. The problem is the viewBox rendered at 900px vs. what it should be rendered at.

**The distortion:** If the diagram was designed to render at ~400px natural width (matching Kimi's own display), but it is being stretched to 900px, every element is 2.25× larger than intended.

---

## 9. Root Cause — Stated Precisely

**The first true distortion layer** was the SVG generation contract, not the internal node geometry.

- `mermaid.initialize({ flowchart: { useMaxWidth: true } })` caused Mermaid to emit SVGs with `width="100%"`.
- Once that SVG traveled through the chain: `mermaid.render()` → string → `encodeURIComponent` → `data:image/svg+xml,...` → `img.src`, it was no longer an inline DOM SVG under Mermaid's layout control.
- It became a raster-like image asset whose final display size was controlled by the browser's image embedding rules.
- An SVG with `width="100%"` as an image asset expands to the full width of its container.
- This expansion re-inflated all internal geometry proportionally, neutralizing every attempt to reduce `fontSize`, `nodeSpacing`, `rankSpacing`, etc.

**Why Rounds 1 and 2 failed:**
- They changed the internal geometry inside the viewBox.
- The viewBox was then stretched to fill the container anyway.
- The two layers are mathematically orthogonal: if the stretch factor is `S`, reducing internal dimension by `R` produces final size `D × S × R`. If `S` is still `900/400 = 2.25×`, no reduction in `R` fixes the problem unless `R < (target/actual)` — which would make the diagram too small without the stretch, and still too large with it.

---

## 10. Fix At The Correct Layer

**Location:** `entrypoints/chat-selection/rendering.ts` — `MERMAID_RENDER_CONFIG`

**The change:**

```typescript
// Before
const MERMAID_RENDER_CONFIG: MermaidConfig = {
  theme: 'base',
  flowchart: {
    useMaxWidth: true,    // ← emitted <svg width="100%">
    nodeSpacing: 50,
    rankSpacing: 50,
  },
  // ...
};

// After
const MERMAID_RENDER_CONFIG: MermaidConfig = {
  theme: 'base',
  flowchart: {
    useMaxWidth: false,   // ← now emits <svg width="320"> (fixed pixel)
    nodeSpacing: 25,      // kept at reasonable compact values
    rankSpacing: 30,
    padding: 8,
    diagramPadding: 6,
    wrappingWidth: 150,
  },
  themeVariables: {
    fontSize: '12px',
    // ... amber color scheme, readable at this scale
  },
};
```

**Why `useMaxWidth: false` is the correct layer:**

`useMaxWidth` is the control that decides whether Mermaid's output SVG is a **responsive document fragment** (intended to live inside a flowing document where the parent controls width) or a **fixed-size asset** (intended to be embedded as a self-contained image artifact).

In this pipeline:
- We are embedding the SVG in a `data:image/svg+xml,...` URI.
- The `<img>` element is used, not inline SVG.
- The embedding contract requires a fixed intrinsic size to prevent browser upscaling.
- `useMaxWidth: false` satisfies this requirement.

**Why tempting alternative fixes were wrong:**

| Alternative | Why wrong |
|---|---|
| Keep reducing `fontSize` until diagram looks right | Dimensions are orthogonal; smaller font + upscale = same size. Diagram would become unreadable when upscale is removed. |
| Add CSS `transform: scale(0.5)` on the `<img>` | Downstream symptom patch. Content would be wrong size for copy, selection, or different screen widths. |
| Use a separate Mermaid config for preview vs. export | Creates fork maintenance burden and violates single-source-of-truth for the render contract. |

---

## 11. Why This Bug Was Harder Than It Looked: The "Already Tried The Obvious Thing" Trap

The specific difficulty of this incident was that the obvious fix (reduce size numbers) produced a detectable but insufficient improvement. This creates a psychological trap:

- "The change partially worked, so I'm on the right track."
- "I just need to push the values further."

**The chain-first discipline would have broken this trap at Round 2:**

> Stop. A change that produces only marginal improvement on a 10× problem is not evidence you're on the right track. It may be evidence that you're touching the wrong layer and seeing noise. Redraw the full chain. Look for a layer you have not touched yet.

The untouched layer was always `useMaxWidth`. None of the investigations up to Round 2 had looked at the SVG root element's `width` attribute directly.

---

## 12. Regression Test Added

```typescript
// tests/entrypoints/chat-selection-rendering.test.ts

it('keeps Mermaid SVGs on a fixed-width embed contract instead of width=100%', async () => {
  let initializedConfig: MermaidConfig | undefined;
  vi.mocked(mermaid.initialize).mockImplementation((config) => {
    initializedConfig = config as MermaidConfig;
  });
  vi.mocked(mermaid.render).mockImplementation((_id, _def) => {
    // Simulate what Mermaid actually does based on useMaxWidth
    const useMaxWidth = (initializedConfig?.flowchart as { useMaxWidth?: boolean })?.useMaxWidth ?? true;
    const svg = useMaxWidth
      ? '<svg width="100%" viewBox="0 0 320 240">...</svg>'
      : '<svg width="320" viewBox="0 0 320 240">...</svg>';
    return Promise.resolve({ svg });
  });

  await hydrateMermaidDiagrams(container);

  // Assert the config uses fixed-width contract
  expect(initializedConfig?.flowchart?.useMaxWidth).toBe(false);

  // Assert the final img src SVG does not contain width="100%"
  const img = container.querySelector('img');
  const dataUri = img?.src ?? '';
  const decoded = decodeURIComponent(dataUri.replace('data:image/svg+xml,', ''));
  expect(decoded).toContain('width="320"');
  expect(decoded).not.toContain('width="100%"');
});
```

This test prevents any future change from accidentally re-enabling `useMaxWidth: true` without being noticed.

---

## 13. Self-Consistency Check

| Question | Answer |
|---|---|
| Does the diagram still depend on Kimi's rendering context? | No. SVG is self-contained by our own render pipeline. |
| Would changing container width change diagram scale? | No. `useMaxWidth: false` means fixed-pixel SVG. |
| What would re-introduce this bug? | Setting `useMaxWidth: true` again, or switching to embedding SVG as `<svg>` inline without preserving fixed dimensions. |
| Is the residual risk documented? | Yes, in postmortem §11 and cross-platform-patterns.md §9. |

---

## 14. Reusable Judgment Template From This Case

> **"This looks like the Mermaid scaling case."**
>
> Trigger: a rendered SVG (via any library) looks too large after being embedded as `data:image/svg+xml,...` in an `<img>` element, even after reducing internal dimension values.
>
> First move: inspect the raw SVG root element attributes before encoding. What are `width` and `height`? If `width="100%"`, you are in this failure mode. Do not touch font sizes or spacing first.
>
> Core lesson: **always separate internal geometry from external scaling**. Internal geometry lives inside the SVG's viewBox. External scaling is determined by the SVG's `width` and `height` root attributes relative to how the browser embeds the image. Changing internal geometry cannot fix an external scaling problem.

---

## 15. The Deeper Architectural Lesson For Any SVG Embedding Pipeline

When you capture a rendered SVG and embed it as a standalone image asset (data URI, Blob URL, `<src>` attribute), you are crossing a **rendering contract boundary**:

| Before the boundary | After the boundary |
|---|---|
| SVG is a living DOM element | SVG is a static asset |
| Parent CSS and container layout controls its size | Its own `width`/`height` attributes control intrinsic size |
| `width="100%"` means "fill my CSS parent" | `width="100%"` means "fill the `<img>` element" = expand to container |
| Inline SVG can query its context | Data-URI SVG has no context to query |

Any rendering library that defaults to `width="100%"` on its output SVG (Mermaid, D3, Chart.js, etc.) requires an explicit override when its output is destined for data-URI embedding instead of inline DOM placement.

This principle is documented in `docs/cross-platform-patterns.md` §9 as a reusable pattern.

---

## Appendix: Key Files

| File | Role in this incident |
|---|---|
| `entrypoints/chat-selection/rendering.ts` | `MERMAID_RENDER_CONFIG` — where `useMaxWidth: false` is set |
| `tests/entrypoints/chat-selection-rendering.test.ts` | Regression test: SVG width contract assertion |
| `docs/archive/postmortems/postmortem-kimi-mermaid-scaling.md` | Full structured postmortem with all 15 sections |
| `docs/cross-platform-patterns.md` §9 | Generalized SVG/data URI sizing pattern |
