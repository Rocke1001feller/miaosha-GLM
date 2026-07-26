# Example: Notion Workspace Root Markdown Import

This is the standard example for process-reproducible patched MCP Chrome DevTools work in this repository.

It documents the browser investigation that fixed workspace-root Notion export for the `markdown-import` path.

## Goal

Prove why exporting selected chat messages to the Notion workspace root failed with an access error, locate the first distortion layer, fix only that layer, and verify with a real extension-to-Notion E2E run.

The process must be reproducible by another operator with:

- the patched MCP Chrome DevTools build
- an already-running logged-in Chrome profile
- the extension installed in that profile
- a Notion workspace where creating scratch pages is authorized

## One-Click Minimal Script

```bash
node .claude/skills/patched-mcp-chrome-devtools/examples/scripts/example2-notion-root-oneclick.cjs
```

This script includes failure branches for missing Notion page, missing `saveTransactionsFanout`, missing chat-selection payload, and runtime sync failures.

## Local Variables To Rediscover

These were the values from the original run. Do not hardcode them on another machine.

| Variable | Original run value | How to rediscover |
|---|---|---|
| `BUILD_ENTRY` | `$HOME/tools/chrome-devtools-mcp-extension-inspect/build/src/bin/chrome-devtools-mcp.js` | local install path |
| `DEV_EXT_ID` | `lhaoppckdeodmjldiciojkeonmgcblha` | `list_extensions` or extension page URL |
| `SPACE_ID` | `393b5c2d-6dc0-8156-9a1d-000377f35127` | Notion request headers/body |
| `USER_ID` | `34bd872b-594c-8119-b5db-000239c2a374` | Notion request headers/body |
| `SPACE_VIEW_ID` | `34bb5c2d-6dc0-8024-b1f8-0006b31cfd49` | Notion root `saveTransactionsFanout` body |
| `ROOT_WORKSPACE_PAGE_URL` | `https://www.notion.so/34bb5c2d6dc080848abff6d10ed20f2d?v=34bb5c2d6dc080c7952d000c35c5844b` | existing Notion workspace page |
| `CONV_ID` | `3be20628-868b-4102-b1de-734d729b2dab` | chat-selection URL/query or storage keys |
| `CONV_KEY` | `chat_export_3be20628-868b-4102-b1de-734d729b2dab` | `chrome.storage.local` enumeration |

## Field Errata From 2026-05 Verification

1. `list_network_requests` may return text rows (`reqid=...`) instead of JSON blocks.
2. `get_network_request` currently requires numeric `reqid` (number), not string.
3. After clicking `New page`, take a new snapshot and rediscover `Page` menu uid before second click.
4. Add retry branches around `list_pages`, `take_snapshot`, `select_page`, and `list_network_requests` to mitigate transient timeout failures.

## Phase A: Environment Confirmation

Run the acceptance gate from the main skill before this example.

Minimum MCP calls:

```text
list_pages {}
list_extensions {}
```

Expected observations:

- the user's real Notion tab is visible
- the dev extension page or worker is visible after wake-up/reload
- `sw-N` values are treated as temporary and rediscovered before use

If the dev service worker is asleep, wake the extension:

```text
reload_extension { id: DEV_EXT_ID }
list_pages {}
```

On the patched `extension-inspect` build, this is the preferred wake-up path even in `--autoConnect`: if Chrome does not expose the Extensions CDP domain, the tool falls back to worker-side `chrome.runtime.reload()`.

## Phase B: Capture Notion Native Source Truth

### B1. Baseline The Notion Root Page

MCP sequence:

```text
list_pages {}
select_page { pageId: <notionRootPageId>, bringToFront: true }
list_network_requests { pageSize: 200, pageIdx: 0, resourceTypes: ["xhr", "fetch", "document", "preflight"], includePreservedRequests: true }
take_snapshot {}
```

Record baseline `reqid` values.

### B2. Perform Exactly One Native Action

In the Notion sidebar:

```text
take_snapshot {}
click { uid: <New page button uid>, includeSnapshot: true }
take_snapshot {}
click { uid: <Page menu item uid from second snapshot> }
wait_for { text: ["Get started with", "Add cover", "New page"], timeout: 15000 }
evaluate_script { function: "() => location.href" }
```

Then capture the new requests:

```text
list_network_requests { pageSize: 200, pageIdx: 0, resourceTypes: ["xhr", "fetch", "document", "preflight"], includePreservedRequests: true }
get_network_request { reqid: <new api reqid>, requestFilePath: ".tmp/notion-root/req-<id>", responseFilePath: ".tmp/notion-root/res-<id>" }
```

If no JSON block is returned by `list_network_requests`, parse textual rows such as:

```text
reqid=14 POST https://www.notion.so/api/v3/saveTransactionsFanout [200]
```

Use numeric reqid for `get_network_request`, for example `reqid: 14`.

Source truth from the original run:

```text
block.set
block.update permissions
block.update { parent_id: SPACE_ID, parent_table: "space", alive: true }
space_view.private_pages.listBefore
block.update last_edited_*
```

Not present:

```text
space.pages.listAfter
setParent
```

### B3. Capture First Title Edit

This eliminates the hypothesis that Notion creates the page first and later fixes parentage on title edit.

MCP sequence:

```text
select_page { pageId: <newNotionPageId>, bringToFront: true }
list_network_requests { pageSize: 200, pageIdx: 0, resourceTypes: ["xhr", "fetch", "document", "preflight"], includePreservedRequests: true }
evaluate_script { function: <focus title textbox by placeholder "New page"> }
type_text { text: "probe-root-title-YYYYMMDD-001" }
wait_for { text: ["probe-root-title-YYYYMMDD-001"], timeout: 10000 }
list_network_requests { pageSize: 200, pageIdx: 0, resourceTypes: ["xhr", "fetch", "document", "preflight"], includePreservedRequests: true }
get_network_request { reqid: <title edit reqid>, requestFilePath: ".tmp/notion-title/req-<id>", responseFilePath: ".tmp/notion-title/res-<id>" }
```

Original result: title edit emitted `insertText` and last-edited updates only. It did not add `space.pages` or `setParent`.

## Phase C: Replay Competing Protocols In The Real Notion Page

Run `evaluate_script` in the logged-in Notion page and use same-origin `fetch` with `credentials: 'include'`.

Compare two create-then-append flows:

| Flow | Create transaction | Append first text block |
|---|---|---|
| `private_pages` flow | `block.set`, permissions update, parent update, `space_view.private_pages.listBefore` | succeeds |
| `space.pages` flow | `block.set(parent in args)`, `setParent`, `space.pages.listAfter`, `space_view.private_pages.listBefore` | fails with edit/access error |

This proves that `space.pages + setParent` is the wrong workspace-root contract for this operation.

## Phase D: Probe Extension Runtime Path

### D1. Inspect Storage From Chat-Selection Page

MCP sequence:

```text
list_pages {}
select_page { pageId: <chatSelectionPageId> }
evaluate_script { function: "() => ({ url: location.href, hasChrome: !!window.chrome?.runtime })" }
evaluate_script { function: <chrome.storage.local/session enumeration> }
```

Key result:

```text
chat_export_<conversationId> is a cache entry.
The real conversation object is cacheEntry.data.
```

### D2. Trigger Real Sync Programmatically

Use the extension page to call `chrome.runtime.sendMessage` with:

```json
{
  "type": "NOTION_SYNC_SELECTION",
  "request": {
    "parent": { "id": "SPACE_ID", "kind": "workspace", "workspaceId": "SPACE_ID" },
    "conversation": "cacheEntry.data",
    "selectedMessageIds": "conversation.messages.map(m => m.id)",
    "writeMode": "markdown-import"
  }
}
```

Failure before fix:

```json
{"lastError":null,"response":{"success":false,"error":"User does not have correct access to record block:<id>"}}
```

### D3. Why Worker Monkey Patch Was Not Authoritative

An attempted service-worker `self.fetch` interceptor produced an empty capture array.

Correct interpretation:

- the message still returned the real access error
- MV3 service workers can restart and lose in-memory monkey patches
- empty monkey-patch capture did not mean no Notion request happened

## Phase E: Map Evidence Back To Code

Runtime request contained:

```text
writeMode: "markdown-import"
```

Therefore the UI path was:

```text
entrypoints/chat-selection/viewmodel/notion-slice.ts
  -> NOTION_SYNC_SELECTION
  -> entrypoints/background/notion/sync/markdown-import.ts
```

The first distortion layer was the workspace branch in `markdown-import.ts`, not `destination.ts`.

Fix boundary:

- use Notion native `private_pages` protocol for workspace-root markdown import
- do not use `space.pages.listAfter`
- do not use `setParent`
- keep append/import behavior downstream unchanged

## Phase F: Reload And E2E Verify

Build validation:

```bash
npm run compile
npx vitest run tests/entrypoints/background-notion.test.ts
npm run build
```

Reload the extension:

```text
select_page { pageId: <chatSelectionPageId> }
evaluate_script { function: "() => { chrome.runtime.reload(); return 'reload triggered'; }" }
list_pages {}
```

Open a fresh chat-selection page:

```text
new_page { url: "chrome-extension://DEV_EXT_ID/chat-selection.html?id=CONV_ID" }
list_pages {}
select_page { pageId: <newChatSelectionPageId> }
evaluate_script { function: "() => ({ url: location.href, hasChrome: !!window.chrome?.runtime })" }
```

Trigger the same workspace-root sync again.

Success from the original run:

```json
{
  "lastError": null,
  "response": {
    "success": true,
    "result": {
      "status": "success",
      "pageUrl": "https://www.notion.so/74362733fc3b4d539029d0c6f4c8d982",
      "blockCount": 6
    }
  }
}
```

Final browser verification:

```text
navigate_page { url: "<result.pageUrl>" }
evaluate_script { function: "() => ({ url: location.href, pageTitle: document.title })" }
take_screenshot {}
```

Expected result: the created page URL resolves to a Notion page whose title matches the export title.

## Artifact Policy

Raw `.network-request` and `.network-response` files from Notion can contain user IDs, workspace IDs, cookies, auth-bearing headers, or short-lived tokens. Keep raw artifacts in ignored local paths and do not commit them.

Commit only:

- this reproducible process
- redacted/minimal fixtures if needed for regression tests
- code-level tests that assert the protocol shape without live credentials

## Malpractice Captured By This Example

1. Do not patch the extension before proving the source platform contract.
2. Do not infer workspace-root Notion behavior from subpage/database behavior.
3. Do not treat service-worker monkey patches as durable evidence.
4. Do not fix a plausible code path before proving the runtime message path.
5. Do not call a regression test sufficient until a real post-reload E2E has passed for this class of bug.