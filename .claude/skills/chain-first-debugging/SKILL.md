---
name: chain-first-debugging
description: "Use when debugging complex incidents, doing 全链路分析 or 根因分析, investigating source-vs-target mismatches, export/render distortions, hidden dependencies, or writing a real postmortem instead of a symptom-only recap."
---

# Chain-First Debugging

## Description

Use this skill when debugging complex incidents, regressions, export mismatches, rendering distortions, environment-specific failures, or any issue where the visible symptom is likely downstream of the real cause.

This skill exists to enforce one principle:

**Do not solve the symptom first. Rewrite the symptom as a chain, then eliminate uncertainty layer by layer until you find the first layer where truth, meaning, state, or dependency actually becomes distorted.**

Typical triggers:

- “全链路分析”
- “根因分析”
- “为什么线上坏，本地没问题”
- “在源环境正常，导出后失真”
- “测试通过，但真实页面不对”
- export artifact differs from source platform
- parser / renderer / API / environment boundary bugs
- incidents that require a postmortem instead of a quick patch

## What This Skill Forces

When this skill is active, the agent must explicitly produce or verify all of the following:

1. `source truth`
2. `target truth`
3. full chain map
4. candidate distortion layers
5. eliminated layers
6. real-world evidence
7. hidden dependency check
8. first true break in the chain
9. root-cause fix
10. regression protection

If any of these are missing, the analysis is incomplete.

## Core Principle

Most engineering failures look different on the surface, but they often share one structure:

**Something true at the source becomes false downstream because one layer transformed it incorrectly, dropped context, or depended on a host environment that was never made explicit.**

Therefore, the job is not:

- “fix the black UI”
- “fix the broken export”
- “fix the wrong page”

The real job is:

```text
source truth → handoff / transform → handoff / transform → handoff / transform → target artifact
```

Then ask:

- where does truth stop matching?
- which layer first becomes semantically wrong?
- what hidden dependency was silently borrowed from the source environment?

## Standard Operating Procedure

### Step 1. Rewrite The Symptom As A Chain

Never start from “why is it black?” or “why is the export wrong?”

Start from:

```text
what is the source truth?
what are the transformation layers?
what must remain true at the end?
```

If the chain is not defined, do not trust any diagnosis yet.

### Step 2. Define Both Ends

Always lock these two anchors first:

- `source truth`: what is correct at the origin?
- `target truth`: what must still be correct after transformation/export/render/deploy?

Without both ends, “it looks fixed” is meaningless.

### Repository Gate: Facts Before Hypotheses For Browser/Export Incidents

In this repository, if the incident involves any of these surfaces:

- source site page
- chat-selection page
- exported artifact (PDF, DOCX, image, markdown)

then the first operational step is not a code edit and not a speculative probe inside product logic.

First capture factual anchors with `patched-mcp-chrome-devtools`:

1. source truth from the source page
2. target truth from chat-selection DOM and storage when relevant
3. artifact truth from a fresh exported file and page-level verification when relevant

Only after those anchors exist should this skill permit candidate distortion layers, code hypotheses, or product-code edits.

If one of those anchors cannot be captured because the browser session, page, or artifact is unavailable, say so explicitly and stop before speculative fixing.

This skill defines what facts must exist.
`patched-mcp-chrome-devtools` defines how to collect them.

### Step 3. Enumerate Layers And Boundaries

List the full path explicitly.

Common boundaries include:

- API response
- browser runtime
- parser / serializer
- normalized model
- storage
- asset resolution
- renderer
- export step
- iframe / host context
- permissions / auth / CSP
- build / deployment environment

Incidents usually happen at boundaries, not in isolated abstractions.

### Step 4. Eliminate Wrong Layers Fast

Before editing anything, ask:

- is the renderer applying filters or transforms?
- is the parser already wrong?
- is the data correct but detached from a missing asset?
- is the artifact borrowing runtime context from the source environment?

Strong debugging is not “guess right on the first try”.
It is shrinking the search space quickly and deliberately.

### Step 5. Prefer Real Production Evidence Over Simplified Samples

Fixtures and mocks are for regression after the cause is known.

When identifying root cause, prioritize:

1. real production payloads
2. real browser state
3. real network traffic
4. real host environment
5. then convert the finding into fixtures/tests

**Use fixtures to preserve the answer, not to substitute for reality.**

### Step 6. If Source Works But Target Fails, Suspect Hidden Dependencies

This is a default rule.

If something works in the original environment but fails after export, migration, reuse, or detachment, first suspect:

- CSS
- CSS variables
- class-based theming
- fonts
- scripts
- DOM structure
- iframe host styles
- auth state
- permissions
- CSP
- feature flags
- runtime state
- browser defaults

Do not assume the content is self-contained until proven.

### Step 7. Fix The First Distortion Layer, Not The Last Visible Layer

A surface patch is not a root-cause fix.

A real fix must answer:

- where did distortion begin?
- why did it begin there?
- how do we restore correct semantics there?
- does the downstream now recover naturally?

If downstream only works because of another patch, the root cause is probably still alive.

### Step 8. Validate Self-Consistency

The goal is not “looks okay in this one view”.

The goal is:

**The artifact remains valid after leaving the original host environment.**

That means:

- required dependencies are explicit
- outputs are self-contained when they need to be
- the fix still holds under realistic payloads
- the success does not depend on invisible borrowed context

### Step 9. Encode The Learning

Every resolved incident should leave behind:

1. a regression test or fixture when applicable
2. a project-level note, postmortem, or instruction update
3. a reusable insight for future debugging

A solved incident that teaches nothing is unfinished engineering.

## Execution Discipline For Hard Bugs

This skill is not only about writing a good chain map after the fact.
It also enforces search economics while the investigation is still live.

### 1. Do Not Rush To Edit Business Code

If the current layer cannot plausibly eliminate the whole bug class, pause.
First identify one nearby lower-level direction that could actually make the symptom impossible, not merely less obvious.

### 2. Optimize For A Decisive Direction, Not Local Motion

If changing spacing, `lineHeight`, CSS, retry timing, or parser cleanup only changes the degree of failure, ask whether the real control point is one layer lower:

- renderer geometry
- parser field selection
- runtime capability
- build artifact
- host dependency

Do not mistake movement for elimination.

### 3. Read Upstream Docs And Source Before Another Round Of Blind Tuning

When a library or framework owns the behavior, first-party docs and source are often cheaper than one more speculative patch.

Read enough to answer:

- where is the behavior actually computed?
- which inputs are ignored?
- what invariant makes the current strategy impossible?

### 4. Use The Smallest Probe That Can Falsify The Current Model

Before editing product logic, prefer the cheapest probe that can kill the current explanation:

1. numeric geometry probe
2. runtime capability probe
3. one-off build-artifact inspection
4. single-request or single-page reproduction

Probes exist to eliminate wrong models quickly, not to build a second product.

### 5. Make The Smallest Falsifiable Change

After the probe points to a layer, make the smallest change that can prove or disprove the new model.
A good first edit is often a narrow marker, switch, or instrumentation point rather than the full final refactor.

### 6. Close The Loop With Real Acceptance

Unit tests, intermediate objects, and screenshots are not interchangeable.
Choose the narrowest real acceptance loop that can distinguish:

1. code path did not execute
2. code path executed but artifact did not change
3. artifact changed and the user-visible symptom is actually gone

For browser/export flows in this repository, use `patched-mcp-chrome-devtools` to make that loop reproducible.

## Mandatory Output Shape

When using this skill, the final analysis should usually answer these headings explicitly:

1. Symptom
2. Source Truth
3. Target Truth
4. Chain Map
5. Eliminated Layers
6. Real Evidence
7. Hidden Dependencies
8. Root Cause
9. Fix At The Correct Layer
10. Regression Protection
11. Residual Risks

## Anti-Patterns

Avoid these:

1. Treating the first visible symptom as the cause.
2. Patching the final renderer without verifying upstream truth.
3. Using fixtures as the only evidence source.
4. Stopping when the page “looks right”.
5. Ignoring why the source environment succeeds.
6. Ignoring hidden dependencies.
7. Skipping regression coverage or writeup.

## Concrete Examples From This Repository

If this skill stays abstract, people will nod and then go back to patching symptoms.

Seven real incidents from this codebase are the teaching set, including one cross-skill dual-entry case. Each one is documented exhaustively in the `examples/` subfolder: the wrong intuition, the actual tool calls, the live API responses, every hypothesis that was eliminated and why, the pivot moment, the root cause, the fix, and the regression test.

Read them. Not the summary below — the full files.

---

### Example 1 — Claude Widget SVG: Three Bug Classes In One Surface

**One-line summary:** Claude's LLM-generated widget SVGs fail in `data:image/svg+xml` `<img>` embedding for three independent reasons — any one of which is sufficient to break rendering — discovered across three rounds of investigation.

| Bug Class | Root Cause | Wrong Intuition |
|---|---|---|
| 1 (all-black) | Host CSS dependency — no inline styles, only class names + `var(--)` | "The renderer is corrupting colors" |
| 2 (one image fails, sibling works) | `onclick` handlers with unescaped nested `"` → invalid XML | "Parser is filtering some widgets" |
| 3 (all images fail, XML valid) | Missing `xmlns="http://www.w3.org/2000/svg"` namespace | "Something changed in the encoding" |

**Actual first distortion layer:** Parser-to-artifact boundary — the `svgToDataUri()` pipeline must normalize LLM-generated SVG into valid, self-contained, standalone XML before encoding.
**Reusable trigger:** source renders SVG correctly in HTML context; `data:image/svg+xml` in `<img>` fails.
**Meta-lesson:** For LLM-generated content, a single fix is "one class resolved" — the incident stays open until the vulnerability surface is enumerated.

→ **Full case study:** [`examples/example-01-claude-widget-svg-black.md`](examples/example-01-claude-widget-svg-black.md)

---

### Example 2 — Kimi Citation Markers Point To Wrong Sources

**One-line summary:** `[^n^]` in Kimi text is an explicit `refs.searchChunks.id`, not a position in `blocks[].search.webPages`; choosing the wrong sibling field in the parser sent every citation to the wrong URL.

**Wrong intuition:** "The renderer is numbering the list incorrectly."
**Actual first distortion layer:** `kimi/parser.ts` — wrong API field selected; `citationMap` built positionally from `webPages` instead of semantically from `refs.searchChunks` by `id`.
**Reusable trigger:** citation numbers look reasonable visually; the linked URLs are factually wrong; live real API payload examination shows a sibling field that was never parsed.

→ **Full case study:** [`examples/example-02-kimi-citation-ref-id-vs-position.md`](examples/example-02-kimi-citation-ref-id-vs-position.md)

---

### Example 3 — Kimi Mermaid Diagrams Rendered At 10× Scale

**One-line summary:** two rounds of reducing internal dimension values (fontSize, nodeSpacing) produced no improvement because the entire SVG was being externally upscaled after `useMaxWidth: true` emitted `width="100%"` in the SVG root.

**Wrong intuition (×2):** "The nodes are too big — shrink Mermaid internal geometry."
**Actual first distortion layer:** SVG generation contract — `useMaxWidth: true` emitted a responsive-width SVG that became a full-container-width image after data-URI embedding.
**Reusable trigger:** an obvious size knob does nothing; a second pass on the same knob also does nothing; check whether internal geometry and external scaling are orthogonal layers you have not yet separated.

→ **Full case study:** [`examples/example-03-kimi-mermaid-svg-upscaling.md`](examples/example-03-kimi-mermaid-svg-upscaling.md)

---

### Example 4 — Perplexity Citation Chain Needed Dual-Truth Snapshots

**One-line summary:** Perplexity source pages can expose citation semantics as domain-like chips (`weixin.qq`, `qks.sufe.edu +N`) while chat-selection resolver expects marker-style references (`[^N^]`), so parser normalization and renderer behavior can only be separated by capturing both source and target truth snapshots around a deterministic reload -> re-extract -> fresh-page loop.

**Wrong intuition:** "The renderer still loses format and citations, so patch renderer first."
**Actual first distortion layer:** parser normalization boundary — source token shape was not yet transformed into the resolver contract.
**Reusable trigger:** source page looks right, but chat-selection seems stale or inconsistent across runs; ownership between parser and renderer is unclear.

→ **Full case study:** [`examples/example-04-perplexity-dual-snapshot-citation-chain.md`](examples/example-04-perplexity-dual-snapshot-citation-chain.md)

---

### Example 5 — Gemini DOCX: HTML Code Block With `<script>` Shows Zero Syntax Colors

**One-line summary:** `highlightCodeToLines` split code into lines before calling `hljs.highlight` — per-line XML highlighting never activates the JavaScript sublanguage for `<script>` content, so every JS token produces `classes: []` → all text maps to the plain near-black DOCX character style.

**Wrong intuition (×2):** (1) "DOMParser is unavailable in extension context" — eliminated; DOCX runs in the chat-selection browser page, not a service worker. (2) "Character styles are not registered" — eliminated; Python/TypeScript blocks showed correct colors, so the OOXML style embedding was fine.
**Actual first distortion layer:** `utils/markdown-parse.ts` `highlightCodeToLines` — per-line strategy destroys the context-sensitive sublanguage activation that highlight.js requires for embedded grammars.
**Fix:** highlight entire block as one call, then split the resulting token stream by `\n` characters with `splitHighlightedHtmlIntoLines`. Also add `hljs-tag` / `hljs-selector` mappings to `resolveCodeTokenStyle`.
**Reusable trigger:** syntax highlighting works for single-language code blocks (Python, JS, TS) but HTML-labeled blocks with `<script>` content appear monochrome; running `hljs.highlight(singleJsLine, {language:'xml'})` returns no `<span>` elements, confirming context destruction.

→ **Full case study:** [`examples/example-05-gemini-hljs-embedded-sublanguage.md`](examples/example-05-gemini-hljs-embedded-sublanguage.md)

---

### Example 6 — Claude to Notion: Temporary Image 404 False-Pass Trap

**One-line summary:** a run was reported as pass while destination Notion page still had temporary image 404; the first distortion layer was post-import patch coverage (candidate gap + chunk traversal gap), not final renderer output.

**Wrong intuition:** "Success toast means export is done and durable."
**Actual first distortion layer:** Notion markdown-import post-processing boundary — temporary image blocks were only partially secure-patched because importer-generated temp URLs and multi-chunk `loadPageChunk` coverage were incomplete.
**Reusable trigger:** UI shows success, but user screenshot/network still shows `temporary.notion-static.com` 404 or missing images after reload.

→ **Full case study (dual-entry):** [`../interaction-driven-api-probing/examples/example-09-claude-to-notion-temporary-404-root-cause-and-recovery.md`](../interaction-driven-api-probing/examples/example-09-claude-to-notion-temporary-404-root-cause-and-recovery.md)

---

### Example 7 — PDF Inline Code Background: Stop Tuning `lineHeight`, Step Into Renderer Geometry

**One-line summary:** repeated business-side `lineHeight` and style tweaks moved the inline-code chip symptom but could not remove top protrusion, because the real control point was `pdfmake` renderer geometry. The decisive fix was a renderer-layer tight-background patch, reached through upstream source reading, minimal probes, and a real reload -> export -> fresh PDF acceptance loop.

**Scope note:** this is a post-triage example, not the first move. In this repository, the source/chat-selection/PDF fact gate should be completed first with [`../patched-mcp-chrome-devtools/examples/chat-selection-pdf-visual-mismatch-facts-before-renderer-hypothesis.md`](../patched-mcp-chrome-devtools/examples/chat-selection-pdf-visual-mismatch-facts-before-renderer-hypothesis.md). This case study starts after ownership has already been narrowed to the final artifact layer.

**Wrong intuition:** "A few more style tweaks in markdown/theme code will get the background close enough."
**Actual first distortion layer:** `pdfmake` `TextDecorator.drawBackground` geometry, not the markdown/theme layer.
**Reusable trigger:** visual artifact remains in the same class after multiple parameter tweaks; the next profitable move is to inspect the upstream renderer/library source instead of iterating one more local patch.

→ **Full case study:** [`examples/example-07-pdf-inline-code-tight-bbox.md`](examples/example-07-pdf-inline-code-tight-bbox.md)

---

### Example 8 — PDF Table Cell Overlap: Width Logs Were Right, But Emoji Rasterization Replaced Wrap-able Text

**One-line summary:** a page 5/6 table overlap looked like a width/noWrap bug, but source truth + chat-selection truth proved no pre-export overflow; the first distortion layer was emoji rasterization converting table-cell text (with `❌`, `⚠️`, `⭐⭐⭐`) into image nodes bounded by page width instead of cell width.

**Wrong intuition (×4):** explicit widths are wrong; `noWrap` not propagating; pdfmake `TextBreaker` noNewLine is forcing overflow; nested run styles are causing wrap collapse.
**Actual first distortion layer:** `services/export-pdfmake/emoji.ts` text->image replacement inside table subtree.
**Reusable trigger:** chat-selection table metrics show `overflowX: false`, but exported PDF table still crosses cell boundaries, especially in rows containing emoji status markers.

→ **Full case study:** [`examples/example-08-pdf-table-emoji-raster-overlap.md`](examples/example-08-pdf-table-emoji-raster-overlap.md)

---

## How To Apply These Examples To New Incidents

When starting a new investigation, do not reach for the method. Reach for pattern recognition first:

| Situation | Matches which case? | First move |
|---|---|---|
| Source renders SVG; export `<img>` fails (black, broken, unavailable) | Example 1 (Claude SVG) | Check for: (1) `var(--)` / class-only styling, (2) `on*` handlers with nested quotes, (3) missing `xmlns` |
| Numbered badges/links point to wrong content | Example 2 (Kimi citation) | Verify whether the number is position or identity; look for unparsed sibling field |
| Size fix does nothing after first or second attempt | Example 3 (Mermaid scaling) | Separate internal geometry from external scaling; inspect raw SVG `width` attribute |
| Source page citations are fine but extension output drifts across runs | Example 4 (Perplexity dual snapshot) | Capture source and target snapshots first, then enforce reload -> re-extract -> fresh chat-selection evidence loop |
| HTML/XML code block in DOCX export shows zero colors; single-language blocks (Python, JS) are fine | Example 5 (Gemini hljs sublanguage) | Check per-line vs whole-block highlight strategy; run `hljs.highlight(oneLine, {language:'xml'})` manually — if no spans, per-line context is destroyed |
| UI reports Notion sync success but destination page still has image 404 | Example 6 (Notion temporary 404) | Ignore toast-only pass; run destination negative/positive signature gates and inspect post-import patch coverage across `loadPageChunk` cursor chunks |
| Repeated style/spacing/font tweaks change the degree of a visual export bug but not its class | Example 7 (PDF inline code geometry) | First complete the source/chat-selection/PDF fact gate with `patched-mcp-chrome-devtools`, then step down into the renderer/library layer that actually owns final geometry |
| PDF table crosses column boundaries while source/chat-selection table looks normal | Example 8 (PDF table emoji raster overlap) | Audit text->image conversion boundaries (emoji rasterization, markdown image substitution) before touching width/noWrap/text-break internals |
| None of the above | Default chain-first SOP | Define both ends → map full chain → eliminate layers → find first distortion |

That makes the method operational instead of philosophical.

## Project Integration Note

In this repository, when an incident deserves a durable writeup, document it with:

`docs/incident-postmortem-template.md`

For a structured in-chat invocation, use:

`.github/prompts/chain-first-root-cause-analysis.prompt.md`

For a role-isolated incident investigator, use:

`.github/agents/chain-first-debugger.agent.md`

The template and prompt together turn this skill into a repeatable operating procedure instead of a one-off insight.