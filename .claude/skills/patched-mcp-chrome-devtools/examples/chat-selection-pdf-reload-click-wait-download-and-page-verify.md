# Example: Chat-Selection PDF Reload + Explicit Click + Latest-Download Page Verification

## Goal

Provide a reproducible end-to-end acceptance loop after a PDF export fix:

1. apply code changes
2. `npm run build`
3. reload unpacked extension in real Chrome
4. explicitly click `Export to PDF`
5. wait long enough for heavy-image PDF generation
6. verify a fresh file appears in `Downloads`
7. capture and inspect fixed pages (for this incident: 10/11/12/13/17/18)

## Prerequisites

- patched MCP Chrome DevTools connected to the user's already-running Chrome (`--autoConnect --categoryExtensions`)
- extension chat-selection page already exists for the target conversation
- fix has been implemented in code and built with `npm run build`
- local machine has write access to `Downloads` and repository `.tmp/`

## One-Click Minimal Script

```bash
node .claude/skills/patched-mcp-chrome-devtools/examples/scripts/example4-pdf-reload-click-wait-download-verify-oneclick.cjs
```

Recommended pre-step:

```bash
npm run build
```

Optional env:

- `EXT_ID`: force extension id
- `CONV_ID`: force chat-selection conversation id
- `WAIT_SECONDS`: max wait for fresh PDF (default `540`)
- `POLL_INTERVAL_SECONDS`: polling interval (default `15`)
- `VERIFY_PAGES`: comma-separated pages (default `10,11,12,13,17,18`)
- `PDF_NAME_CONTAINS`: optional filename substring filter in Downloads
- `OUT_DIR`: custom screenshot output dir
- `DOWNLOADS_DIR`: override Downloads folder path

### Field-Verified Variant: Kimi Page 5/6 Table-Overlap Acceptance

Use this exact command when you want the same one-shot acceptance loop used in the real Kimi PDF table-overlap fix:

```bash
EXT_ID=lhaoppckdeodmjldiciojkeonmgcblha \
CONV_ID=19df63fd-9042-85ca-8000-09ffa741ca85 \
VERIFY_PAGES=5,6 \
node .claude/skills/patched-mcp-chrome-devtools/examples/scripts/example4-pdf-reload-click-wait-download-verify-oneclick.cjs
```

This exact run performs, in one shot:

- reload extension
- open the target chat-selection page
- click `Export to PDF`
- wait for the latest PDF under `Downloads`
- capture verification screenshots for pages 5 and 6

Expected outputs:

- `freshPdf` metadata with filename, path, size, and `sha256`
- `pdf-after-reload-page-05.png`
- `pdf-after-reload-page-06.png`
- notice text may still report `Export failed`; do not treat that as artifact truth when a fresh file and page screenshots exist

## Local Variables To Rediscover

| Value | Meaning |
|---|---|
| `lhaoppckdeodmjldiciojkeonmgcblha` | local extension id |
| `19e35f64-df22-88dc-8000-09ff49ce0f2a` | local conversation id |
| `/Users/justdoit/Downloads` | local Downloads folder |
| `10,11,12,13,17,18` | page set for post-fix visual acceptance |

## MCP Command Transcript

This example uses patched MCP commands in this sequence:

1. `list_pages` -> rediscover target `chat-selection.html?id=...`
2. `new_page(chrome://extensions/?id=<extId>)`
3. `take_snapshot` + `click(uid=<reload-button>)` for extension reload
4. `new_page(chrome-extension://<extId>/chat-selection.html?id=<convId>)`
5. `take_snapshot` + `click(uid=<pdf-button>)` for explicit export trigger
	- button is selected by scored snapshot matching (exact export description wins)
6. poll `Downloads` for a fresh PDF artifact
7. `new_page(file:///...pdf#page=<n>&zoom=page-fit)` + `take_screenshot` for each verify page

## Source Truth

- source truth for this acceptance loop is the exact extension runtime you just built and reloaded
- stale extension memory is not accepted as source truth

## Target Truth

- a newly generated PDF file in Downloads (not a pre-existing file)
- page-level screenshots from that fresh file for the required verification pages

## Eliminated Hypotheses

- "I changed code so extension state must be updated": false until reload is explicitly executed
- "button.click in evaluate_script is equivalent to real click": false for some export paths
- "export notice text alone is final truth": false; fresh file detection in Downloads is the acceptance gate
- "short waits are enough": false for payloads with many images

## First Distortion Layer

In this incident class, the first distortion layer is operational, not parser logic:

- running new code without effective extension reload
- assuming synthetic click semantics are equivalent to user click
- concluding export status before download artifact appears

## Fix Boundary

Keep fixes separated and explicit:

- code fix boundary: export/formula pipeline implementation
- runtime acceptance boundary: reload + explicit click + artifact freshness + required page screenshots

## Verification Commands

```bash
npm run build
node .claude/skills/patched-mcp-chrome-devtools/examples/scripts/example4-pdf-reload-click-wait-download-verify-oneclick.cjs
```

The script emits structured JSON with:

- `reloadButtonUid`
- `pdfButtonUid`
- `pdfButtonMatch` (uid + score + matched snapshot line)
- `freshPdf` (name/path/mtime/size/sha256)
- screenshot paths for each verification page

## E2E Browser Verification

Field-verified run characteristics:

- extension reload done through `chrome://extensions` Reload button when protocol `reload_extension` was unavailable
- PDF export triggered via MCP `click` on the discovered PDF button UID
- heavy payload required patient waiting and polling for fresh file creation
- captured 10/11/12/13/17/18 from the newest PDF file

## Artifacts

Produced artifacts are local and reproducible:

- latest PDF file in `Downloads`
- screenshot set in `.tmp/patched-mcp-chrome-devtools/example4-*/pdf-after-reload-page-*.png`
- JSON summary emitted to terminal for auditability

## Cleanup And Security Notes

- screenshots and logs can contain private conversation content; keep them local
- do not commit `.tmp/` artifacts
- if a run mutates extension settings or destination systems, confirm intent before rerun

## Lessons Learned

- do not trust fixed `pageId`/UID across runs; always rediscover
- in dense export toolbars, resolve `Export to PDF` by highest-confidence description/aria evidence, not loose `pdf` keyword matching
- treat long-running PDF export as an asynchronous job with bounded polling
- freshness is verified by file delta and hash, not by UI text alone
- acceptance should bind to explicit required pages, not random visual spot checks
