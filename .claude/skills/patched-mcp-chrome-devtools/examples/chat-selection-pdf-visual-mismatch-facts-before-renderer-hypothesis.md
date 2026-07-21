# Example: Chat-Selection PDF Visual Mismatch Facts Before Renderer Hypothesis

## Goal

Prove a localized PDF visual mismatch on a fresh exported artifact before proposing any renderer-side, parser-side, or library-side code fix.

This example exists for incidents like:

- inline code background looks wrong only in PDF
- code block after-text looks wrong only in PDF
- spacing or chip/background geometry differs only in PDF

The point is not to fix the bug here.
The point is to finish factual collection first, so later `chain-first-debugging` work starts from evidence instead of speculation.

## Prerequisites

- patched MCP Chrome DevTools is connected to the user's already-running Chrome
- source conversation page is open
- matching `chat-selection.html?id=<convId>` page is open or can be produced
- the extension build under test has been reloaded before acceptance
- exported PDF files land in a known Downloads directory

## Local Variables To Rediscover

| Value | Meaning |
|---|---|
| `SOURCE_URL` | exact source conversation URL in the connected Chrome session |
| `EXT_ID` | installed unpacked extension id |
| `CONV_ID` | conversation id shared by source and chat-selection |
| `KEYWORD` | stable nearby text anchor around the visual mismatch |
| `CODE_TOKEN` | expected nearby code token, when applicable |
| `VERIFY_PAGES` | PDF page set needed for acceptance screenshots |
| `PDF_NAME_CONTAINS` | optional filename filter for latest-PDF lookup |

## MCP Command Transcript

Minimal operational flow:

1. `list_pages {}` and rediscover the source page and chat-selection page.
2. `select_page(source)` and capture source DOM truth with `take_snapshot` plus `evaluate_script`.
3. `select_page(chat-selection)` and capture rendered DOM truth with `take_snapshot` plus `evaluate_script`.
4. In chat-selection, read `chrome.storage.local['chat_export_<convId>']` to capture storage truth around the same anchor.
5. Run the real export acceptance loop and collect fresh PDF screenshots.

Recommended reusable commands from this skill:

```bash
node .claude/skills/patched-mcp-chrome-devtools/examples/scripts/example4-pdf-reload-click-wait-download-verify-oneclick.cjs
node .claude/skills/patched-mcp-chrome-devtools/examples/scripts/example5-pdf-three-way-fence-bisection-oneclick.cjs
```

Use `example4` when the main question is artifact freshness and page-level verification.
Use `example5` when parser/export ownership is still unclear and source/chat-selection/storage/PDF must be compared in one run.

## Source Truth

Before discussing a fix, confirm what is actually correct on the source page:

- nearby prose around the mismatch anchor
- whether code is inline or fenced
- whether citations/anchors are present and interactive
- whether the surrounding list/section structure is intact

If source truth is not locked, do not interpret the PDF symptom yet.

## Target Truth

For this incident class, target truth has three layers:

1. chat-selection rendered DOM truth
2. chat-selection storage truth
3. fresh PDF artifact truth

The investigation is incomplete if only one of these is checked.

## Eliminated Hypotheses

This fact gate is designed to eliminate these common wrong starts:

- wrong page selected
- stale extension build or stale chat-selection page
- stale PDF file mistaken for a fresh export
- parser-loss before chat-selection, when chat-selection DOM and storage still match source
- code-fix speculation before artifact-only mismatch is actually proven

## First Distortion Layer

This example does not name a universal root cause.
It names the earliest boundary supported by evidence.

Typical outcomes:

- source wrong -> source/platform side or extraction preconditions
- source correct, chat-selection wrong -> extraction/parser/normalization boundary
- source and chat-selection correct, fresh PDF wrong -> export transformer or renderer boundary

Only after that boundary is proven should `chain-first-debugging` take over with code-level hypotheses.

## Fix Boundary

The fix boundary for this example is explicit handoff:

1. finish fact capture here
2. decide the first distortion layer here
3. then move to `chain-first-debugging` for root-cause reasoning and code changes

Companion post-triage case study:

[`../../chain-first-debugging/examples/example-07-pdf-inline-code-tight-bbox.md`](../../chain-first-debugging/examples/example-07-pdf-inline-code-tight-bbox.md)

## Verification Commands

```bash
npm run build
node .claude/skills/patched-mcp-chrome-devtools/examples/scripts/example4-pdf-reload-click-wait-download-verify-oneclick.cjs
node .claude/skills/patched-mcp-chrome-devtools/examples/scripts/example5-pdf-three-way-fence-bisection-oneclick.cjs
```

If parser vs export ownership is already known, `example5` can be replaced with a smaller manual probe, but the fresh-PDF acceptance loop must remain.

## E2E Browser Verification

Acceptance gates for this incident class:

- a fresh exported PDF file exists in Downloads
- the file differs from the previous artifact by timestamp and/or hash
- page-level screenshots from that fresh file are captured
- the same anchor region can be compared across source, chat-selection, and PDF

Do not conclude "fixed" from notice text or a single intermediate object.

## Artifacts

- `.tmp/.../pdf-after-reload-page-*.png`
- `.tmp/.../three-way-bisection-summary.json` when `example5` is used
- freshest PDF metadata from Downloads (`mtime`, `size`, optional hash)

## Cleanup And Security Notes

- screenshots and JSON summaries can contain private chat content
- keep generated artifacts under `.tmp/` or another ignored local folder
- do not commit raw PDFs or screenshots unless deliberately redacted

## Why This Example Exists Separately From `chain-first-debugging`

This example is intentionally operational, not interpretive.

- `patched-mcp-chrome-devtools` owns reproducible fact collection
- `chain-first-debugging` owns root-cause interpretation and fix-boundary choice

If those two responsibilities are merged mentally, the common failure mode is immediate hypothesis and early code edits before source/chat-selection/PDF truth is fully captured.

This example exists to prevent exactly that failure mode.