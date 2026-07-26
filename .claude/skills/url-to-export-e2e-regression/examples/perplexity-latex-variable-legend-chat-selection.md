# Example: Perplexity LaTeX Variable Legend To Chat-Selection Checkpoint

## Incident Summary

Symptom on chat-selection:

- `$$P$$ = 贷款本金`
- `$$r$$ = 月利率`
- `$$n$$ = 贷款总期数（月数）`

were rendered as a split two-line layout (`P`/`r`/`n` floating alone), while the source Perplexity page displayed them inline.

## Chain Map (Used For Root-Cause Isolation)

```text
Perplexity source page
-> API raw markdown ("- $$P$$ = ...")
-> parser/normalized conversation/storage
-> chat-selection render + KaTeX auto-render
-> chat-selection CSS
```

First distortion layer was confirmed at chat-selection CSS, not parser:

- `$$...$$` correctly generated `.katex-display`.
- outer `.katex-display` was already overridden to inline.
- but child `.katex` and `.katex-html` remained KaTeX default block-centered, still forcing visual split.

## Final Fix Shape

The stable fix needs all three selectors for list-inline legend rows:

```css
.message-item li > span > .katex-display { display: inline; ... }
.message-item li > span > .katex-display > .katex { display: inline; width:auto behavior; ... }
.message-item li > span > .katex-display > .katex > .katex-html { display: inline; ... }
```

And must preserve paragraph formula blocks:

- `li > p > span > .katex-display` remains block-level.

## Automation Case (URL -> Chat-Selection)

Case module:

```text
tests/e2e-cases/perplexity-latex-variable-legend-chat-selection.case.cjs
```

Runner wrapper:

```text
scripts/e2e/perplexity-latex-variable-legend-chat-selection.cjs
```

Run command:

```bash
EXT_ID=lhaoppckdeodmjldiciojkeonmgcblha \
CASE_MODULE=tests/e2e-cases/perplexity-latex-variable-legend-chat-selection.case.cjs \
node scripts/e2e/perplexity-latex-variable-legend-chat-selection.cjs
```

## Oracle Design

This case validates two invariants in the fixed checkpoint:

1. Legend row inline invariant:
- `.katex-display === inline`
- `.katex === inline`
- `.katex-html === inline`
- `.katex width === auto`

2. Full formula block invariant:
- paragraph-level formula `.katex-display === block`

This prevents the regression from returning while also guarding against over-fixing that would collapse real display formulas.

## Scripts Used During Investigation

Reusable base:

```text
.claude/skills/patched-mcp-chrome-devtools/examples/scripts/mcp-common.cjs
```

Direct MCP script patterns used:

1. `list_pages` + `select_page` by URL (avoid stale pageId assumptions)
2. `evaluate_script` for:
- source truth probes (DOM text and layout)
- chat-selection computed style probes
- CSS hash verification (`link[rel="stylesheet"]`)
3. temporary runtime CSS injection to validate candidate fix before file edits

## Problems Encountered And Resolutions

1. Problem: page IDs changed after extension reload, causing probes to hit wrong tabs.
- Resolution: always resolve target by URL from `list_pages` each time before probing.

2. Problem: extension page sometimes still served old CSS hash after manual reload attempts.
- Resolution: assert the active stylesheet hash from page DOM and compare with built artifact hash.

3. Problem: fixing only `.katex-display` looked correct in CSS but visual split remained.
- Resolution: probe child computed styles; found `.katex` still `display:block` and width full-row.

4. Problem: temporary verification style polluted runtime page.
- Resolution: remove injected style node (`#tmp-katex-inline-fix`) and re-check baseline.

5. Problem: URL flow sometimes opened chat-selection for a different conversation id (active-tab drift).
- Resolution: add strict chat-selection id assertion for the target conversation and use a unique source URL hash suffix to force a fresh source tab; when mismatch still happens, treat it as a real E2E failure signal instead of weakening the oracle.

## Lessons To Reuse

1. For KaTeX display-math regressions, always inspect both wrapper and child display models.
2. In URL E2E debugging, treat pageId as ephemeral and URL as source of truth.
3. For extension reload validation, include bundle-hash assertion in the oracle.
4. For renderer bugs, build one-resource URL checkpoint case first, then extend to export endpoint only when the checkpoint is stable.