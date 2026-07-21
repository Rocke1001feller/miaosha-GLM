---
name: patched-mcp-chrome-devtools
description: "Single source of truth for operating the patched Chrome DevTools MCP against the user's already-running Chrome: environment setup and acceptance, basic page/extension/service-worker operations, anti-patterns learned from failed debugging, and reproducible examples for source-truth capture, API probing, extension inspection, and E2E verification. Use for MCP Chrome DevTools, patched chrome-devtools-mcp, --autoConnect, --categoryExtensions, list_pages, list_network_requests, get_network_request, evaluate_script, extension service worker debugging, logged-in browser probing, Notion/private web API probing, and process-reproducible MCP experiment reports."
---

# Patched MCP Chrome DevTools

This is the only maintained operating manual for MCP Chrome DevTools in this repository.

Any other skill, prompt, or doc may explain a domain method, but it must not restate MCP Chrome DevTools mechanics. Link here instead.

## 0. Scope And Verdict

### What This Replaces

The previous guidance failed because MCP operation was split across multiple files with overlapping and sometimes conflicting advice:

| Former source | Useful material merged here | Verdict |
|---|---|---|
| `extension-inspect-mcp` | patched build install, `--autoConnect --categoryExtensions`, extension pages, MV3 service workers, network body capture | Replaced by this skill |
| `mcp-data-pipeline-debugger` | page verification, storage/DOM/raw-data bisection, wrong-page zero-result trap | Replaced by this skill |
| `interaction-driven-api-probing` | controlled UI action -> request/response correlation, passive replay, Notion CRUD probing | Replaced by this skill |
| `extension-api-interception` | MAIN-world fetch/XHR interception and M1/M6 warnings | Replaced by this skill |
| `.github/instructions/reuse-running-chrome.instructions.md` | never launch a fresh browser for session-dependent probing | Replaced by this skill |
| `docs/mcp-chrome-devtools-all-steps.md` | the Notion workspace-root repair process | Moved into the example section here |

### Why The Old Guidance Failed In The Notion Root Fix

The old guidance had good individual pieces, but no single ordering discipline. In the failed round, that produced these concrete mistakes:

1. **Extension-first instead of source-truth-first**: the first visible error was in extension sync, so attention went to extension code before proving how Notion itself creates a workspace-root page.
2. **Wrong runtime path**: fixes initially targeted `destination.ts`, while the UI sent `writeMode: 'markdown-import'` and therefore used `markdown-import.ts`.
3. **Service-worker monkey-patch overconfidence**: an in-memory `self.fetch` patch was treated like a durable capture path, but MV3 service workers can restart between install and trigger.
4. **Protocol analogy**: a workspace-root page was treated as if it followed a `space.pages + setParent` contract. Real Notion traffic used `space_view.private_pages` with a separate parent update.
5. **No environment acceptance gate**: the run did not start with a documented proof that the patched MCP build, extension targets, page targets, worker targets, and request body persistence all worked.
6. **Hardcoded session identifiers**: `pageId`, `sw-N`, extension IDs, workspace IDs, and conversation keys appeared in scripts before the doc made clear which values must be rediscovered per machine.
7. **Historical examples were below reproducibility bar**: some examples recorded outcomes but not every MCP command needed to replay the process.

Treat these as malpractice. Do not repeat them.

## 2.1 Patched MCP Chrome 环境配置和如何确认验收环境是OK的篇

### 2.1.1 Iron Rule

MCP Chrome DevTools must attach to the user's already-running Chrome session whenever the task depends on login state, cookies, localStorage, IndexedDB, extension state, granted permissions, Cloudflare/challenge state, or private web API traffic.

Allowed connection modes for this repository:

- `--autoConnect` (preferred)
- `--browserUrl <existing Chrome DevTools URL>`
- `--wsEndpoint <existing CDP WS endpoint>`

Forbidden substitutes:

- fresh integrated browser
- headless Chrome
- isolated temporary profile
- clean Playwright context
- manual `--remote-debugging-port=9222` fallback that changes the profile under inspection
- official npm `chrome-devtools-mcp` when the task requires extension surfaces from the patched branch

If an already-running Chrome connection is unavailable, stop and say so. Do not invent a substitute.

### 2.1.2 Patched Build Install

The patched build is expected at this shape:

```text
$HOME/tools/chrome-devtools-mcp-extension-inspect/build/src/bin/chrome-devtools-mcp.js
```

Install or update it from the patched branch:

```bash
git clone --branch extension-inspect \
  https://github.com/Rocke1001feller/chrome-devtools-mcp.git \
  "$HOME/tools/chrome-devtools-mcp-extension-inspect"
cd "$HOME/tools/chrome-devtools-mcp-extension-inspect"
npm install
npm run build
```

Use this MCP server shape in user-scope and project-scope config. Both scopes must point to the same patched build.

```jsonc
{
  "servers": {
    "chrome-devtools": {
      "type": "stdio",
      "command": "node",
      "args": [
        "/absolute/path/to/chrome-devtools-mcp-extension-inspect/build/src/bin/chrome-devtools-mcp.js",
        "--autoConnect",
        "--categoryExtensions",
        "--no-usage-statistics",
        "--no-performance-crux"
      ]
    }
  }
}
```

Restart the MCP client after changing config. Saving the config file is not enough if the old MCP process is still alive.

### 2.1.3 Acceptance Gate

Before debugging, prove these capabilities on the current machine:

| Gate | Required proof |
|---|---|
| patched CLI guard | `node <BUILD_ENTRY> --categoryExtensions` throws because no connection mode was supplied |
| real Chrome attached | `list_pages {}` shows the user's real tabs, not a blank clean profile |
| extension visibility | `list_pages {}` shows `chrome-extension://...` pages or `sw-*` entries when extension debugging is needed |
| extension registry | `list_extensions {}` returns installed extensions or the patched target-derived fallback |
| page script | `evaluate_script { function: '() => ({ url: location.href, title: document.title })' }` works on a selected page |
| worker script | `evaluate_script { serviceWorkerId: 'sw-N', function: '() => 1 + 1' }` returns `2` after dynamically selecting the worker |
| page network | `list_network_requests { pageSize: 200, pageIdx: 0, includePreservedRequests: true }` returns page traffic when probing a web app |
| worker network | `list_network_requests { serviceWorkerId: 'sw-N', pageSize: 200, pageIdx: 0 }` returns worker traffic when the flow really fetches from the worker |
| request detail | `get_network_request { reqid, requestFilePath, responseFilePath }` writes non-empty body files when the captured request/response has bodies |

Do not skip this gate. If it fails, fix wiring before interpreting any app behavior.

### 2.1.4 Reusable Node Wrapper

Use this wrapper when the chat interface cannot call every patched tool directly or when the result must be reproducible as a script.

```bash
cd /path/to/project && node - <<'NODE'
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createRequire } = require('node:module');
const process = require('node:process');

async function setup(clientName = 'patched-mcp-repro') {
  const BUILD_ENTRY = process.env.BUILD_ENTRY || path.join(
    os.homedir(),
    'tools',
    'chrome-devtools-mcp-extension-inspect',
    'build',
    'src',
    'bin',
    'chrome-devtools-mcp.js',
  );
  const buildRequire = createRequire(BUILD_ENTRY);
  const clientPath = buildRequire.resolve('@modelcontextprotocol/sdk/client/index.js');
  const stdioPath = buildRequire.resolve('@modelcontextprotocol/sdk/client/stdio.js');
  const [{ Client }, { StdioClientTransport }] = await Promise.all([
    import(pathToFileURL(clientPath).href),
    import(pathToFileURL(stdioPath).href),
  ]);

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      BUILD_ENTRY,
      '--autoConnect',
      '--categoryExtensions',
      '--no-usage-statistics',
      '--no-performance-crux',
    ],
    stderr: 'pipe',
  });

  const client = new Client({ name: clientName, version: '0.1.0' });
  await client.connect(transport);
  return client;
}

async function call(client, name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  return result?.content?.filter((part) => part.type === 'text').map((part) => part.text).join('\n') || '';
}

(async () => {
  const client = await setup();
  console.log(await call(client, 'list_pages'));
  await client.close();
})().catch((err) => {
  console.error(err.stack || err.message || err);
  process.exit(1);
});
NODE
```

## 2.2 Patched MCP Chrome 基本操作篇

### 2.2.1 Page And Worker Selection

Never hardcode `pageId` or `sw-N` across sessions.

Correct sequence:

1. `list_pages {}`
2. Identify the page or worker by URL, extension ID, title, or known route.
3. `select_page { pageId, bringToFront: true }` for page operations.
4. `evaluate_script { function: '() => ({ url: location.href, title: document.title })' }` to verify context.
5. Only then run diagnostic probes.

The zero-result rule:

```text
querySelectorAll(...) === 0 does not prove absence until you have re-verified the selected page.
```

### 2.2.2 Page Network Capture

Use page network capture for normal web app APIs, including Notion UI traffic.

Protocol:

1. Select the target web page.
2. Capture baseline request IDs:
   ```json
   { "pageSize": 200, "pageIdx": 0, "resourceTypes": ["xhr", "fetch", "document", "preflight"], "includePreservedRequests": true }
   ```
3. Perform exactly one UI action.
4. List requests again and diff by `reqid`.
5. For every candidate `/api/`, `/graphql`, `/rpc`, or transaction endpoint, call `get_network_request` with body file paths.
6. Summarize request shape before reading product code.

Use stable semantic selectors from `take_snapshot`. Avoid brittle CSS hash classes and deep nth-child selectors.

### 2.2.3 Extension Page Operations

An extension page (`chrome-extension://<id>/...`) is usually the best surface for extension state:

- `chrome.storage.local.get(null, callback)`
- `chrome.storage.session.get(null, callback)`
- `chrome.runtime.sendMessage(...)`
- DOM queries for chat-selection or option pages
- `chrome.runtime.reload()` from inside the extension page

Always wrap callback APIs in a Promise:

```javascript
() => new Promise((resolve) => {
  chrome.storage.local.get(null, (items) => {
    resolve({ keys: Object.keys(items), total: Object.keys(items).length });
  });
})
```

For this repo, remember that `chat_export_<conversationId>` is often a cache wrapper. The real conversation object can be in `.data`.

### 2.2.4 MV3 Service Worker Operations

Service workers are inspectable but ephemeral.

Use worker-aware tools only after dynamically finding the current worker ID:

```json
{ "serviceWorkerId": "sw-N", "function": "() => chrome.runtime.getManifest()" }
```

What works well:

- inspect manifest and runtime state
- send controlled fetches from the worker
- list worker-originated requests with `list_network_requests({ serviceWorkerId })`
- persist request/response bodies with `get_network_request({ serviceWorkerId, reqid, ... })`

What is not durable:

- module-scope variables installed by a one-off `evaluate_script`
- `self.fetch` monkey patches installed in the worker and then used later
- assuming the worker stays alive between baseline, trigger, and readback

If the extension action fetches from a page or content script, worker network capture will be empty by design. Use page-targeted network tools or the extension page runtime instead.

### 2.2.5 Controlled UI Probing

For dynamic web apps, map behavior with a small action matrix:

| Probe | UI action | Unique nonce | Expected request field | Cleanup |
|---|---|---|---|---|
| P1 | create page | `probe-root-page-YYYYMMDD-001` | transaction creates page block | delete/archive if needed |
| P2 | edit title | `probe-title-YYYYMMDD-001` | title mutation only | optional |
| P3 | append block | `probe-body-YYYYMMDD-001` | block child append succeeds | optional |

Rules:

- One action at a time.
- Baseline request IDs before each action.
- Use nonce strings to correlate request body, response body, and UI result.
- Save artifact paths and exact MCP calls.
- For mutations, get explicit user permission first and avoid destructive actions.

### 2.2.6 Passive API Replay

Use passive replay when the endpoint is known and you need raw response truth for parser/debugging.

Preferred methods:

1. `get_network_request` on the real browser request if it is visible.
2. `evaluate_script` in the same logged-in page to `fetch(...)` with `credentials: 'include'`.
3. Terminal `curl` only after copying/verifying all required headers and accepting that browser-protected endpoints may still diverge.

Never call a replay successful just because it returns HTTP 200. Verify the specific semantic fields that caused the bug.

### 2.2.7 Extension Reload

After build changes, reload the installed extension before rerunning E2E.

Preferred order:

1. `reload_extension { id: EXT_ID }`. In the patched `extension-inspect` build, this is the preferred path even under `--autoConnect`: when Chrome does not expose the Extensions CDP domain, the tool falls back to the target extension's running MV3 service worker and executes `chrome.runtime.reload()` there.
2. From an extension page only if the tool cannot reach a running worker for the target extension:
   ```javascript
   () => { chrome.runtime.reload(); return 'reload triggered'; }
   ```
3. Only if needed, use `chrome://extensions` UI automation. Re-verify pages and workers after reload.

After reload, immediately rerun `list_pages {}` and rediscover the extension page id and any `sw-N` values. Then open a fresh extension page. A stale extension page can keep old chunks or old runtime assumptions alive.

### 2.2.8 Dual-Truth Snapshot And Reload-Reextract-New-Page SOP

Use this when debugging source-vs-target citation/render mismatches (for example: Perplexity source page looks correct, but chat-selection loses citation behavior or formatting).

This SOP always produces two comparable snapshots:

1. source snapshot: platform source page DOM truth
2. target snapshot: extension chat-selection data truth plus rendered DOM truth

#### Phase A. Capture source snapshot first (before any patch assumptions)

1. Locate and select the source tab.
   - `list_pages {}`
   - `select_page { pageId: <sourcePageId>, bringToFront: true }`
2. Freeze a structural snapshot.
   - `take_snapshot {}`
3. Capture source DOM facts in one structured `evaluate_script` result.
   - message text head/tail
   - citation token shape (numeric `[N]`, footnote `[^N^]`, or domain-like chips)
   - source-link count and sample links

Suggested source probe:

```javascript
() => {
  const main = document.querySelector('main') || document.body;
  const text = (main.textContent || '').replace(/\s+/g, ' ').trim();
  const anchors = [...main.querySelectorAll('a[href]')]
    .map((a) => ({ href: a.href, text: (a.textContent || '').trim() }))
    .filter((item) => item.href);
  return {
    location: location.href,
    tokenShape: {
      hasNumericBracket: /\[(\d+)\]/.test(text),
      hasFootnoteMarker: /\[\^(\d+)\^\]/.test(text),
      hasDomainLikeToken: /(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\s*\+\s*\d+)?/i.test(text),
    },
    sourceLinksCount: anchors.length,
    sourceLinksSample: anchors.slice(0, 15),
    textHead: text.slice(0, 800),
  };
}
```

#### Phase B. Run coherent extension operation flow

Target order (do not skip):

1. extension reload
2. reopen or focus source page
3. trigger popup
4. click export in popup
5. open fresh chat-selection page for this run

Recommended MCP sequence:

1. `reload_extension { id: EXT_ID }`
2. `list_pages {}` then re-select source page by URL
3. trigger popup
   - preferred: `trigger_extension_action { id: EXT_ID }`
   - fallback: `new_page { url: "chrome-extension://EXT_ID/popup.html" }`
4. `list_pages {}` and `select_page` on `chrome-extension://EXT_ID/popup.html`
5. `take_snapshot {}` then click the export button uid
6. `list_pages {}` and locate the newest `chat-selection.html?id=<conversationId>` page

If popup-trigger tools are unavailable in the current autoConnect session, use the same runtime path via extension message from popup/chat-selection page and keep the reload -> re-extract -> new-page sequence unchanged.

#### Phase C. Capture target snapshot in two layers

Layer 1: storage/data truth (what parser produced)

- run `evaluate_script` in chat-selection extension page:
  - read `chrome.storage.local` conversation payload
  - collect assistant message `sources`, `citationMap`, and marker shape in text

Layer 2: rendered DOM truth (what user sees)

- `take_snapshot {}`
- run `evaluate_script` to collect:
  - citation chip count
  - citation stale-badge count
  - sources block count
  - rendered prose sample

Suggested target probe:

```javascript
() => new Promise((resolve) => {
  const params = new URLSearchParams(location.search);
  const convId = params.get('id') || '';
  const key = convId ? `chat_export_${convId}` : null;

  const rendered = {
    citationChipCount: document.querySelectorAll('.citation-chip').length,
    staleBadgeCount: document.querySelectorAll('.citation-stale, .citation-chip--stale').length,
    sourceBlocks: document.querySelectorAll('.message-sources, .sources-list, .message__sources').length,
    proseHead: (document.querySelector('.message-content, .message-text')?.textContent || '').slice(0, 600),
  };

  if (!key) return resolve({ convId, key, storage: null, rendered });

  chrome.storage.local.get(key, (items) => {
    const raw = items?.[key];
    const payload = raw && typeof raw === 'object' && raw.data ? raw.data : raw;
    const messages = Array.isArray(payload?.messages) ? payload.messages : [];
    const assistant = messages.find((m) => m?.role === 'assistant') || null;
    const content = typeof assistant?.content === 'string' ? assistant.content : '';
    resolve({
      convId,
      key,
      storage: assistant ? {
        sourcesLen: Array.isArray(assistant.sources) ? assistant.sources.length : 0,
        citationMapLen: assistant.citationMap && typeof assistant.citationMap === 'object'
          ? Object.keys(assistant.citationMap).length
          : 0,
        markerSample: (content.match(/\[\^\d+\^\]/g) || []).slice(0, 20),
        contentHead: content.slice(0, 600),
      } : null,
      rendered,
    });
  });
})
```

#### Phase D. Distortion-layer decision table

| Observation | First suspect layer |
|---|---|
| source has citation semantics, storage has no `sources`/`citationMap` | extraction / parser |
| storage has `sources` and markers, rendered has no chips/sources UI | chat-selection renderer/enricher |
| source tokens are domain-like, storage still keeps domain tokens (no `[^N^]`) | parser token normalization |
| rendered has chips but stale badges dominate | citationMap-source mapping mismatch |

This bisection output is the incident anchor. Do not patch before this table is satisfied by evidence.

### 2.2.9 `list_network_requests` Output Shape (Field Errata)

Do not assume `list_network_requests` always returns JSON.

In current patched builds it can return text rows in this shape:

```text
reqid=14 POST https://www.notion.so/api/v3/saveTransactionsFanout [200]
```

Operational rule:

- parse `reqid=...` rows when no JSON block is returned
- diff by `reqid` across baseline and post-action snapshots exactly the same way

### 2.2.10 `get_network_request` Reqid Type (Field Errata)

In current patched builds, `get_network_request.reqid` is validated as `number`.

Bad:

```json
{ "reqid": "14" }
```

Good:

```json
{ "reqid": 14 }
```

If you pass string reqid, you will get input validation failure before capture.

### 2.2.11 UID Churn After Click (Field Errata)

Some dynamic menus regenerate the accessibility tree after the first click.

Critical example from Notion root flow:

1. click `New page`
2. **take_snapshot again**
3. rediscover `Page` menu uid from the fresh snapshot
4. click `Page`

Do not reuse the old `Page` uid captured before clicking `New page`.

### 2.2.12 Popup Export Selection And Chat-Selection Polling (Field Errata)

For popup export flows, selection rules are mandatory:

- prefer `file_download Export Now`
- exclude `Log in to sync exports`
- exclude disabled export-looking buttons

After clicking export, do not conclude failure immediately if target page is missing.

Use delayed polling:

- rerun `list_pages {}` every 1 second
- poll for 8-12 seconds
- pick newest `chat-selection.html?id=...` page

### 2.2.13 Timeout Retry Strategy (Field Errata)

MCP calls can fail with transient `MCP error -32001: Request timed out`.

Use bounded retries on non-destructive and idempotent steps:

- `list_pages`
- `take_snapshot`
- `select_page`
- `list_network_requests`
- `evaluate_script` probes

Recommended policy:

- 2-3 retries
- retry delay 1.2s -> 2.4s -> 3.6s
- if still failing, fail fast with the exact step name and captured context

### 2.2.14 Export-Button Disambiguation In Dense Toolbars (Field Errata)

When an extension page has many export-looking controls, `pdf` keyword matching is not enough.

Use scored selection with this precedence:

1. exact export description/aria (for example `Export selected messages as a multi-page PDF`)
2. icon plus label pair (for example `picture_as_pdf PDF`)
3. lower-confidence text fallback (`multi-page PDF`, `download pdf`)

Always exclude:

- `Log in to sync exports`
- disabled controls

Operational rule:

- include the matched snapshot line (`uid`, score, line text) in script output for post-run auditability

### 2.2.15 Export Notice Text Is Not Artifact Truth (Field Errata)

`Export failed` in notice UI is advisory, not final truth, in some runtime paths.

Acceptance order for PDF export verification:

1. fresh file delta in `Downloads`
2. file metadata (`mtime`, `size`) and integrity hash when needed
3. page-level screenshot checks from that fresh file
4. notice text as secondary diagnostic context

Do not fail acceptance solely on notice text when a fresh artifact exists and page checks pass.

### 2.2.16 `evaluate_script` Regex-Literal Escaping Trap (Field Errata)

Long injected script strings can fail with errors like:

```text
Invalid regular expression: missing /
Invalid or unexpected token
```

This frequently happens when regex literals are embedded in escaped multi-layer strings.

Safer patterns:

- prefer string operations (`indexOf`, `split`, `trimStart`) in probes
- if regex is unavoidable, build it with `new RegExp(...)` from explicit string input
- keep probe scripts short and return structured JSON directly

### 2.2.17 Operational Contract With `chain-first-debugging`

For browser/export incidents in this repository, this skill is the fact-collection gate.

Before `chain-first-debugging` is allowed to propose code hypotheses or product-code edits, use this skill to capture as many of these truths as the incident requires:

1. source truth from the source page
2. chat-selection truth from rendered DOM and storage
3. artifact truth from a fresh export file with page-level verification

If those truths cannot be captured, the correct outcome is to report the missing anchor, not to speculate.

`chain-first-debugging` owns interpretation and fix-boundary choice.
This skill owns reproducible browser/session/artifact evidence collection.

## 2.3 Patched MCP Chrome 的 Malpractice / Anti-Pattern 汇总

These are forbidden patterns learned from real failures in this repository.

### 2.3.1 Starting At The Visible Error

Bad:

```text
Extension sync failed -> inspect extension code first.
```

Good:

```text
Define source truth and target truth, then map the chain.
For Notion writes: first capture how Notion itself performs the same operation.
```

### 2.3.2 Treating A Service Worker Monkey Patch As Evidence

Bad:

```javascript
self.fetch = async (...) => { captures.push(...); return originalFetch(...); }
```

Then later assuming `captures.length === 0` means no request happened.

Good:

- consider worker monkey patches auxiliary only
- use `list_network_requests({ serviceWorkerId })` for worker-originated requests
- use page-targeted network capture for page-originated requests
- trust real message return values and request logs over lost in-memory state

### 2.3.3 Hardcoding Session IDs

Bad:

```text
select_page 8
serviceWorkerId sw-3
```

Good:

- discover with `list_pages` every time
- match by URL and extension ID
- record which values are example values and which are local variables

### 2.3.4 Confusing Extension Inspection With Source-Site Protocol Discovery

Extension service worker traffic answers: what did the extension do?

Source-site traffic answers: what is the platform's real contract?

For private web API integrations, source-site protocol discovery must happen first. The extension cannot invent a correct Notion protocol if the source truth was never captured.

### 2.3.5 Letting Historical Skills Compete

Bad:

```text
Use one skill for service workers, another for data pipeline, another for API probing, another for MAIN-world interception.
```

Good:

```text
Use this skill for all MCP Chrome DevTools mechanics. Domain skills may say what to investigate, but this skill says how to operate MCP.
```

### 2.3.6 Reading Code Before Browser Truth

Code can reveal possible paths, but it does not prove the runtime path. In this incident, `destination.ts` was plausible but not used by the UI. The runtime message carried `writeMode: 'markdown-import'`.

Probe first:

- source browser request
- extension storage/message payload
- actual response/error

Then edit only the first distortion layer.

### 2.3.7 Believing Fixtures Over Live Symptoms

If tests pass but the user sees the same failure, the fixture may be fictional or the test may cover a sibling path. Recapture real browser state before making another patch.

### 2.3.8 Using `console.log` As Probe Output

MCP captures returned values. Return structured JSON-serializable objects from `evaluate_script`.

Bad:

```javascript
() => { console.log(window.state); }
```

Good:

```javascript
() => ({ url: location.href, keys: Object.keys(window).filter((key) => key.includes('state')) })
```

### 2.3.9 Installing Capture After The Request

MAIN-world fetch/XHR interception only sees future traffic. If the page-load API already fired, install-before-action cannot be retroactively fixed. Use Network preserved requests, refresh with capture already armed, or same-page passive replay.

### 2.3.10 Writing Non-Reproducible Examples

An example is not acceptable if it only says what happened. It must include:

- environment prerequisites
- exact MCP calls
- how dynamic IDs are discovered
- which values are local placeholders
- artifacts produced
- expected success and failure outputs
- cleanup/security notes

## 2.4 Patched MCP Chrome 的 Examples

### 2.4.1 Standard Example: Notion Workspace Root Markdown Import

Use the full process in `examples/notion-workspace-root-markdown-import.md` as the quality bar for future examples.

It demonstrates:

- environment discovery
- Notion-native source-truth capture
- title-edit capture to eliminate a hidden second transaction hypothesis
- same-page replay of competing protocols
- extension-side message triggering
- why worker monkey-patch capture was non-authoritative
- mapping evidence back to `writeMode: 'markdown-import'`
- rebuild, reload, fresh page, and real E2E success

### 2.4.2 Standard Example: Perplexity Citation Dual Snapshot And Popup Export Flow

Use `examples/perplexity-citation-dual-snapshot-and-popup-export.md` for incidents where:

- source platform shows citation context but extension output is missing or incorrect
- parser vs renderer ownership is unclear
- a reproducible popup export flow is needed for E2E debugging

It demonstrates:

- two-truth snapshot capture (source DOM vs chat-selection storage plus DOM)
- strict reload -> re-extract -> fresh chat-selection evidence loop
- popup-triggered export path and fallback path handling
- distortion-layer decision table for parser/renderer boundary

### 2.4.3 Standard Example: Chat-Selection PDF Export Repro And Blob Verification

Use `examples/chat-selection-pdf-export-repro-and-blob-verification.md` for incidents where:

- `chat-selection.html` is already known and should be opened directly by URL
- clicking `Export to PDF` fails behind the generic export failure notice
- the runtime path must be verified by patching `URL.createObjectURL` and checking the generated PDF blob

It demonstrates:

- direct extension-page launch with `new_page`
- PDF button discovery and click from the real chat-selection page
- browser-side error, unhandled-rejection, console, and notice capture
- page-level PDF blob verification through a download probe

### 2.4.4 Standard Example: Chat-Selection PDF Reload + Explicit Click + Latest-Download Verification

Use `examples/chat-selection-pdf-reload-click-wait-download-and-page-verify.md` for incidents where:

- code fix has been applied and `npm run build` already passed
- verification must prove extension reload happened before export
- PDF export payload includes many images and generation can take minutes
- acceptance requires specific page checkpoints from the newest downloaded PDF

It demonstrates:

- extension reload via `chrome://extensions` UI click when `reload_extension` protocol path is unavailable
- explicit MCP `click` for `Export to PDF` instead of relying on `evaluate_script` synthetic `button.click`
- bounded long-wait polling of `Downloads` for a truly fresh PDF artifact
- fixed-page screenshot capture from the latest file via `file:///...#page=N&zoom=page-fit`
- artifact integrity recording with filename, timestamp, size, and SHA-256

Field-verified invocation for the Kimi page 5/6 acceptance loop:

```bash
EXT_ID=lhaoppckdeodmjldiciojkeonmgcblha \
CONV_ID=19df63fd-9042-85ca-8000-09ffa741ca85 \
VERIFY_PAGES=5,6 \
node .claude/skills/patched-mcp-chrome-devtools/examples/scripts/example4-pdf-reload-click-wait-download-verify-oneclick.cjs
```

This exact one-shot run performs:

- reload unpacked extension in real Chrome
- reopen the target `chat-selection.html?id=...`
- click the real `Export to PDF` button
- wait for the newest PDF artifact in `Downloads`
- capture page 5 and page 6 screenshots from that fresh file

### 2.4.5 Standard Example: Chat-Selection PDF Three-Way Bisection And Fence-Indent Root Cause

Use `examples/chat-selection-pdf-three-way-bisection-and-fence-indent-root-cause.md` for incidents where:

- source page and chat-selection both appear correct
- exported PDF still drops block code or structurally important markdown segments
- you need a first-distortion-layer decision before touching parser/export code

It demonstrates:

- source DOM vs chat-selection DOM vs chat-selection storage triage in one run
- storage fence-indentation window capture around a missing code token
- newest-PDF verify-page screenshot capture tied to the same investigation run
- converting evidence into a concrete first-layer hint (for example fence indentation handling)

### 2.4.6 Standard Example: Chat-Selection PDF Visual Mismatch Facts Before Renderer Hypothesis

Use `examples/chat-selection-pdf-visual-mismatch-facts-before-renderer-hypothesis.md` for incidents where:

- the source page and chat-selection may still look correct
- the exported PDF has a localized visual mismatch
- you need a hard evidence gate before discussing renderer-side or library-side fixes

It demonstrates:

- source/chat-selection/PDF fact capture before any product-code hypothesis
- composition of three-way truth capture with fresh-file page verification
- narrowing ownership to the final artifact layer before handing off to `chain-first-debugging`
- keeping MCP evidence collection separate from later code-level root-cause work

### 2.4.7 Standard Example Template: Minimal Three-Anchor Proof (Source + Chat-Selection Correct, Only PDF Artifact Distorted)

Use `examples/chat-selection-pdf-minimal-three-anchor-proof-template.md` when you need the fastest low-noise acceptance gate for incidents where:

- source and chat-selection likely look normal
- exported PDF still shows localized distortion
- you must prove first distortion layer before discussing parser/renderer fixes

It provides:

- a minimal three-anchor probe flow (source truth, chat-selection truth, artifact truth)
- explicit acceptance criteria per anchor
- a compact distortion-layer decision table
- a handoff contract for `chain-first-debugging`
- anti-pattern guards to prevent premature code edits

### 2.4.8 Future Example Standard

Every new example must follow this skeleton:

```markdown
# Example: <scenario>

## Goal
## Prerequisites
## Local Variables To Rediscover
## MCP Command Transcript
## Source Truth
## Target Truth
## Eliminated Hypotheses
## First Distortion Layer
## Fix Boundary
## Verification Commands
## E2E Browser Verification
## Artifacts
## Cleanup And Security Notes
```

Do not add examples that cannot be replayed by another person with the same patched MCP and equivalent account/project state.

### 2.4.9 One-Click Minimal Script Set

Field-verified one-click scripts for these five script-backed standard examples are provided at:

```text
examples/scripts/
```

Use:

```bash
node .claude/skills/patched-mcp-chrome-devtools/examples/scripts/example1-pdf-oneclick.cjs
node .claude/skills/patched-mcp-chrome-devtools/examples/scripts/example2-notion-root-oneclick.cjs
node .claude/skills/patched-mcp-chrome-devtools/examples/scripts/example3-perplexity-dual-snapshot-oneclick.cjs
node .claude/skills/patched-mcp-chrome-devtools/examples/scripts/example4-pdf-reload-click-wait-download-verify-oneclick.cjs
node .claude/skills/patched-mcp-chrome-devtools/examples/scripts/example5-pdf-three-way-fence-bisection-oneclick.cjs
```

See script usage and env overrides in:

```text
examples/scripts/README.md
```

## 2.5 Patched MCP Chrome 的其他事项

### Security

Raw request/response artifacts can include cookies, bearer tokens, account IDs, workspace IDs, and private user content. Do not commit raw `.network-request` / `.network-response` files unless they are deliberately redacted fixtures.

Use `.tmp/` or another ignored local folder for raw artifacts. Promote only sanitized summaries or minimal redacted fixtures into the repository.

### Artifact Naming

When using `get_network_request`, provide dot-free base names for predictable output. The patched formatter appends `.network-request` and `.network-response` automatically and may replace existing extensions.

Good:

```text
/tmp/notion-root/req-11
/tmp/notion-root/res-11
```

Risky:

```text
/tmp/notion-root/req-11.json
```

### When To Stop

Stop and fix environment wiring when:

- `list_pages` does not show the expected real Chrome state
- extension surfaces are invisible under an extension task
- `serviceWorkerId` probes fail after rediscovery and wake-up
- request body persistence cannot be proven but body evidence is required

Stop and ask/confirm when:

- the next probe mutates real user data and the user has not authorized that mutation class
- cleanup would delete user-visible records/pages/messages

### Repository Rule

If a task mentions MCP Chrome DevTools, patched Chrome DevTools MCP, extension service workers, logged-in browser probing, private web API probing, or cross-machine reproducible browser evidence, use this skill first.