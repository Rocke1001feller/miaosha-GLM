# Patched MCP Example One-Click Scripts

These scripts are minimal one-click repro runners for the five standard examples.

All scripts:

- attach to the patched MCP Chrome DevTools build
- reuse the currently running logged-in Chrome profile
- include timeout retry branches for MCP tool calls
- emit structured JSON output with `ok: true|false`

## Prerequisites

- patched build exists at the default path or set `BUILD_ENTRY`
- Chrome is already running and reachable by patched MCP `--autoConnect`
- required source pages are already open unless noted otherwise

## Scripts

### 1) Chat-selection PDF repro + blob probe

```bash
node .claude/skills/patched-mcp-chrome-devtools/examples/scripts/example1-pdf-oneclick.cjs
```

Optional env:

- `EXT_ID`: force extension id
- `CONV_ID`: force chat-selection conversation id

Expected behavior:

- reopen target `chat-selection.html?id=...`
- run phase B runtime error probe
- run phase C `URL.createObjectURL` probe

Notes:

- `downloadCount=0` can still happen even when browser download succeeds; verify Downloads when needed.

### 2) Notion workspace-root markdown-import

```bash
node .claude/skills/patched-mcp-chrome-devtools/examples/scripts/example2-notion-root-oneclick.cjs
```

Expected behavior:

- capture Notion native create-page traffic
- persist `saveTransactionsFanout` request/response artifacts under `.tmp/notion-root/`
- parse `SPACE_ID` from captured request
- trigger extension `NOTION_SYNC_SELECTION` with `writeMode: markdown-import`
- verify returned Notion page URL when available

Notes:

- this script mutates live Notion workspace data (creates page)
- current patched build requires `get_network_request.reqid` as number

### 3) Perplexity dual snapshot + popup export loop

```bash
node .claude/skills/patched-mcp-chrome-devtools/examples/scripts/example3-perplexity-dual-snapshot-oneclick.cjs
```

Optional env:

- `EXT_ID`: force extension id
- `SOURCE_URL`: open this Perplexity URL if no source page exists

Expected behavior:

- capture source snapshot + probe
- run extension loop (reload -> focus source -> trigger popup -> click Export Now)
- poll for chat-selection creation
- capture target snapshot + probe

### 4) Chat-selection PDF post-fix reload + explicit click + latest-download verification

```bash
node .claude/skills/patched-mcp-chrome-devtools/examples/scripts/example4-pdf-reload-click-wait-download-verify-oneclick.cjs
```

Optional env:

- `EXT_ID`: force extension id
- `CONV_ID`: force chat-selection conversation id
- `WAIT_SECONDS`: max wait for fresh PDF in Downloads (default `540`)
- `POLL_INTERVAL_SECONDS`: wait polling interval (default `15`)
- `VERIFY_PAGES`: comma-separated page set to capture (default `10,11,12,13,17,18`)
- `PDF_NAME_CONTAINS`: optional filename filter for Downloads scan
- `OUT_DIR`: output directory for captured page screenshots
- `DOWNLOADS_DIR`: override Downloads path

Expected behavior:

- reload extension from `chrome://extensions` by clicking Reload in real Chrome
- reopen fresh `chat-selection.html?id=...`
- click real `Export to PDF` button via MCP click
- patiently poll Downloads for a fresh PDF artifact (heavy image exports can be slow)
- capture verification screenshots for required pages from the newest PDF

Notes:

- this flow intentionally avoids relying on `evaluate_script` synthetic `button.click` for export acceptance
- capture output defaults to `.tmp/patched-mcp-chrome-devtools/example4-*`

Field-verified Kimi page 5/6 acceptance command:

```bash
EXT_ID=lhaoppckdeodmjldiciojkeonmgcblha \
CONV_ID=19df63fd-9042-85ca-8000-09ffa741ca85 \
VERIFY_PAGES=5,6 \
node .claude/skills/patched-mcp-chrome-devtools/examples/scripts/example4-pdf-reload-click-wait-download-verify-oneclick.cjs
```

This exact run covers the full loop:

- reload extension
- reopen `chat-selection.html?id=...`
- click real `Export to PDF`
- wait for the newest PDF in `Downloads`
- screenshot pages 5 and 6 from that fresh artifact

### 5) Chat-selection PDF three-way bisection (source vs chat-selection vs PDF)

```bash
node .claude/skills/patched-mcp-chrome-devtools/examples/scripts/example5-pdf-three-way-fence-bisection-oneclick.cjs
```

Optional env:

- `SOURCE_URL`: source conversation URL to anchor page discovery
- `EXT_ID`: force extension id
- `CONV_ID`: force chat-selection conversation id (auto-parsed from SOURCE_URL if omitted)
- `KEYWORD`: nearby anchor string around missing segment (default `terminal.external.osxExec`)
- `CODE_TOKEN`: code text expected in missing block (default `iTerm.app`)
- `VERIFY_PAGE`: PDF page number to screenshot (default `1`)
- `PDF_NAME_CONTAINS`: optional latest-PDF filename filter
- `OUT_DIR`, `DOWNLOADS_DIR`

Expected behavior:

- capture source DOM truth (snippet + code-block set)
- capture chat-selection DOM truth (snippet + code-block set)
- capture chat-selection storage truth and fence indentation window from `chat_export_<convId>`
- capture verify-page screenshot from newest PDF in Downloads
- emit first-distortion-layer hint in JSON summary

## Failure Branches

Each script fails with JSON payload and exit code `2` when key gates fail, for example:

- no required source page
- missing popup/export control
- missing `saveTransactionsFanout`
- no chat-selection page after export
- no source/chat-selection page pair for three-way comparison
- no fresh PDF artifact within wait window
- missing reload/PDF button uid discovery in dynamic snapshot

## Security

- generated Notion request artifacts may include sensitive headers and cookies
- keep `.tmp/` artifacts local and uncommitted
