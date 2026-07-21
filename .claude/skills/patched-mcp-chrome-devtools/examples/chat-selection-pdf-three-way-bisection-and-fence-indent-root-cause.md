# Example: Chat-Selection PDF Three-Way Bisection And Fence-Indent Root Cause

## Goal

Pinpoint the first distortion layer when a block code segment is visible in source and chat-selection but disappears in exported PDF.

This example formalizes a three-way comparison:

1. source page DOM truth
2. chat-selection DOM + storage truth
3. newest exported PDF page truth

## Prerequisites

- patched MCP Chrome DevTools connected to the user's already-running Chrome (`--autoConnect --categoryExtensions`)
- source conversation page is open (for example `https://copilot.microsoft.com/chats/<convId>`)
- matching `chat-selection.html?id=<convId>` page is open
- latest extension build has been reloaded before capture if code changed

## One-Click Minimal Script

```bash
node .claude/skills/patched-mcp-chrome-devtools/examples/scripts/example5-pdf-three-way-fence-bisection-oneclick.cjs
```

Optional env:

- `SOURCE_URL` (default: current Copilot case URL)
- `EXT_ID` (default: current local extension id)
- `CONV_ID` (auto-parsed from SOURCE_URL if omitted)
- `KEYWORD` (default: `terminal.external.osxExec`)
- `CODE_TOKEN` (default: `iTerm.app`)
- `VERIFY_PAGE` (default: `1`)
- `PDF_NAME_CONTAINS` (optional latest-PDF filter)
- `OUT_DIR`
- `DOWNLOADS_DIR`

## Local Variables To Rediscover

| Value | Meaning |
|---|---|
| `SOURCE_URL` | exact source conversation URL in your Chrome session |
| `EXT_ID` | installed unpacked extension id |
| `CONV_ID` | conversation id shared by source and chat-selection |
| `KEYWORD` | stable nearby anchor string around missing block code |
| `CODE_TOKEN` | code line expected inside the missing fence |

## MCP Command Transcript

Script-level sequence:

1. `list_pages` and rediscover source page + chat-selection page
2. `select_page(source)` + `evaluate_script` for source DOM probe
3. `select_page(chat-selection)` + `evaluate_script` for rendered DOM probe
4. `evaluate_script` on chat-selection to read `chrome.storage.local['chat_export_<convId>']`
5. inspect storage markdown around `CODE_TOKEN` and compute fence indentation window
6. open latest PDF in `Downloads` and capture verify-page screenshot
7. emit JSON summary with first-distortion-layer hint

## Source Truth

Source page should still contain the block code segment in rendered content.

Required checks:

- code block count from `pre code`
- snippet around `KEYWORD`
- presence of `CODE_TOKEN` inside at least one source code block

## Target Truth

At minimum, chat-selection storage and chat-selection rendered DOM should preserve the same code block semantics.

For final artifact truth, verify page screenshot from the newest downloaded PDF.

## Eliminated Hypotheses

This flow can eliminate:

- wrong-page probe (both source and chat-selection page IDs are rediscovered)
- parser-loss before storage (if storage still contains fenced markdown)
- renderer-loss before export (if chat-selection DOM still contains code block text)

## First Distortion Layer

Field case from this repo:

- source truth: code block present
- chat-selection DOM + storage truth: code block present
- storage markdown: fenced lines had 5 leading spaces inside list context
- PDF truth: block code missing

First distortion layer was markdown-to-pdf fence splitting logic that only handled shallow indentation.

## Fix Boundary

Fix at transformer boundary (`splitMarkdownByCodeFences`) rather than patching final PDF rendering symptom.

Working pattern:

- support deep list indentation for opening/closing fences
- keep indentation normalization deterministic via opener-indent stripping
- add regression tests for both 3-space and 5-space fence cases

## Verification Commands

```bash
npm run build
npm test -- tests/services/pdfmake-pdf.service.test.ts
node .claude/skills/patched-mcp-chrome-devtools/examples/scripts/example4-pdf-reload-click-wait-download-verify-oneclick.cjs
node .claude/skills/patched-mcp-chrome-devtools/examples/scripts/example5-pdf-three-way-fence-bisection-oneclick.cjs
```

## E2E Browser Verification

Acceptance gates for this incident class:

- `example4` reports `ok: true` and emits a fresh PDF artifact
- `example5` reports source/chat-selection/storage evidence with `firstDistortionHint`
- verify screenshot from newest PDF confirms expected block code segment appears

## Artifacts

- `.tmp/patched-mcp-chrome-devtools/example5-*/three-way-bisection-summary.json`
- `.tmp/patched-mcp-chrome-devtools/example5-*/pdf-latest-page-*.png`

## Cleanup And Security Notes

- artifact JSON may include private chat content snippets
- do not commit `.tmp/` outputs
- use `PDF_NAME_CONTAINS` when Downloads contains many unrelated PDFs

## Lessons Learned

- three-way truth (source vs chat-selection vs PDF) is faster than guessing parser/renderer ownership.
- chat-selection storage may preserve deep-indented fences even when PDF drops them; inspect indentation, not only text.
- export notice text is advisory; newest-file freshness in Downloads is a stronger acceptance signal.
- in dense export toolbars, pick `Export to PDF` by highest-confidence tooltip/description evidence, not by loose `pdf` keyword matching.
