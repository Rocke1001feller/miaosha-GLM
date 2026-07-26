# Example: Chat-Selection PDF Export Repro And Blob Verification

## Goal

Reproduce and verify the `chat-selection.html` -> `Export to PDF` runtime path with patched MCP Chrome DevTools.

This example records the verified scripts used for the PDF export regression investigation:

1. direct-open the extension `chat-selection.html?id=...` URL
2. click the real `Export to PDF` button and capture runtime error signals
3. install a page-level download probe, click PDF, and verify whether a real PDF blob is generated

## Prerequisites

- patched MCP Chrome DevTools is connected to the user's already-running Chrome
- the extension is installed and visible to patched MCP with `--categoryExtensions`
- the target chat-selection conversation id is known
- the target chat-selection page has a pending export envelope available in extension storage
- the production extension build has been loaded/reloaded before post-fix verification

## One-Click Minimal Script

```bash
node .claude/skills/patched-mcp-chrome-devtools/examples/scripts/example1-pdf-oneclick.cjs
```

Optional env overrides:

- `EXT_ID`
- `CONV_ID`

The script includes timeout retry branches and structured failure output.

## Local Variables To Rediscover

The scripts below preserve the exact verified run values. Rediscover or replace them before reusing on another machine.

| Value | Meaning |
|---|---|
| `/Users/justdoit/Documents/Cluely/ai-exporter-vanilla` | repository working directory |
| `$HOME/tools/chrome-devtools-mcp-extension-inspect/build/src/bin/chrome-devtools-mcp.js` | patched MCP CLI entry |
| `lhaoppckdeodmjldiciojkeonmgcblha` | local installed extension id |
| `7jPUdfwCqTTfrYRVpudWi` | local chat-selection conversation id |

## Field Errata From 2026-05 Verification

1. `URL.createObjectURL` probe is useful but not a sole success oracle.
2. In real runs, `downloadCount` can be `0` while the browser still downloads a valid PDF.
3. If probe shows no blob, verify browser Downloads before concluding export failure.
4. Apply bounded retries on `list_pages`, `select_page`, and `evaluate_script` to reduce transient MCP timeout noise.

## MCP Command Transcript

### Phase A. Reopen Chat-Selection Directly By Extension URL

This is the verified script used to pull `chat-selection` back up by direct extension-page URL.

````bash
cd /Users/justdoit/Documents/Cluely/ai-exporter-vanilla && node - <<'NODE'
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createRequire } = require('node:module');

function textFrom(result) { return (result?.content || []).filter((p) => p.type === 'text').map((p) => p.text).join('\n'); }
function parseJson(text) { const m = text.match(/```json\n([\s\S]*?)\n```/i); if (!m?.[1]) throw new Error('No JSON payload'); return JSON.parse(m[1]); }
function idsByUrl(listText, needle) {
  const ids = [];
  for (const line of listText.split(/\r?\n/)) {
    const m = line.match(/^(\d+):\s+(.*)$/);
    if (m && (m[2] || '').includes(needle)) ids.push(Number(m[1]));
  }
  return ids;
}

async function setup() {
  const buildEntry = path.join(os.homedir(), 'tools', 'chrome-devtools-mcp-extension-inspect', 'build', 'src', 'bin', 'chrome-devtools-mcp.js');
  const req = createRequire(buildEntry);
  const [{ Client }, { StdioClientTransport }] = await Promise.all([
    import(pathToFileURL(req.resolve('@modelcontextprotocol/sdk/client/index.js')).href),
    import(pathToFileURL(req.resolve('@modelcontextprotocol/sdk/client/stdio.js')).href),
  ]);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [buildEntry, '--autoConnect', '--categoryExtensions', '--no-usage-statistics', '--no-performance-crux'],
    stderr: 'pipe',
  });
  const client = new Client({ name: 'open-chat-selection', version: '0.1.0' });
  await client.connect(transport);
  return client;
}
async function call(client, name, args = {}) {
  const r = await client.callTool({ name, arguments: args });
  return { raw: r, text: textFrom(r) };
}

(async () => {
  const EXT_ID = 'lhaoppckdeodmjldiciojkeonmgcblha';
  const CONV_ID = '7jPUdfwCqTTfrYRVpudWi';
  const client = await setup();
  try {
    const url = `chrome-extension://${EXT_ID}/chat-selection.html?id=${CONV_ID}`;
    console.log('opening', url);
    const np = await call(client, 'new_page', { url });
    console.log('new_page:', np.text);

    const lp = await call(client, 'list_pages', {});
    const ids = idsByUrl(lp.text, `chrome-extension://${EXT_ID}/chat-selection.html?id=${CONV_ID}`);
    console.log('matching chat-selection ids:', ids);
    if (!ids.length) throw new Error('chat-selection page still missing');

    const target = Math.max(...ids);
    await call(client, 'select_page', { pageId: target, bringToFront: true });

    const probe = await call(client, 'evaluate_script', {
      function: `() => {
        const prose = Array.from(document.querySelectorAll('.message-prose,[class*="prose"]')).map(n => n.innerText).join('\\n');
        return {
          href: location.href,
          title: document.title,
          textLength: prose.length,
          hasReport: prose.includes('拓竹科技与陶冶发展研究报告'),
          hasPlan: prose.includes('已经拟定了一份研究计划'),
          buttonCount: document.querySelectorAll('button').length,
          firstButtons: Array.from(document.querySelectorAll('button')).slice(0,15).map(b => ({text:(b.innerText||'').trim().replace(/\\s+/g,' '), aria:(b.getAttribute('aria-label')||'').trim()}))
        };
      }`,
    });
    console.log('probe:', JSON.stringify(parseJson(probe.text), null, 2));
  } finally {
    await client.close();
  }
})().catch((e) => { console.error(e.stack || e.message || e); process.exit(1); });
NODE
````

### Phase B. Reproduce Export To PDF Failure And Capture Runtime Signals

This is the verified script used after the direct-open script to click the real PDF button and collect browser-side evidence.

````bash
cd /Users/justdoit/Documents/Cluely/ai-exporter-vanilla && node - <<'NODE'
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createRequire } = require('node:module');

function textFrom(result) { return (result?.content || []).filter((p) => p.type === 'text').map((p) => p.text).join('\n'); }
function parseJson(text) { const m = text.match(/```json\n([\s\S]*?)\n```/i); if (!m?.[1]) throw new Error('No JSON payload: ' + text.slice(0,160)); return JSON.parse(m[1]); }
function idsByUrl(listText, needle) {
  const ids = [];
  for (const line of listText.split(/\r?\n/)) {
    const m = line.match(/^(\d+):\s+(.*)$/);
    if (m && (m[2] || '').includes(needle)) ids.push(Number(m[1]));
  }
  return ids;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function setup() {
  const buildEntry = path.join(os.homedir(), 'tools', 'chrome-devtools-mcp-extension-inspect', 'build', 'src', 'bin', 'chrome-devtools-mcp.js');
  const req = createRequire(buildEntry);
  const [{ Client }, { StdioClientTransport }] = await Promise.all([
    import(pathToFileURL(req.resolve('@modelcontextprotocol/sdk/client/index.js')).href),
    import(pathToFileURL(req.resolve('@modelcontextprotocol/sdk/client/stdio.js')).href),
  ]);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [buildEntry, '--autoConnect', '--categoryExtensions', '--no-usage-statistics', '--no-performance-crux'],
    stderr: 'pipe',
  });
  const client = new Client({ name: 'pdf-click-repro', version: '0.1.0' });
  await client.connect(transport);
  return client;
}
async function call(client, name, args = {}) {
  const r = await client.callTool({ name, arguments: args });
  return { raw: r, text: textFrom(r) };
}

(async () => {
  const client = await setup();
  try {
    const list = await call(client, 'list_pages', {});
    const ids = idsByUrl(list.text, 'chrome-extension://lhaoppckdeodmjldiciojkeonmgcblha/chat-selection.html?id=7jPUdfwCqTTfrYRVpudWi');
    if (!ids.length) throw new Error('chat-selection page not found');
    const target = Math.max(...ids);
    await call(client, 'select_page', { pageId: target, bringToFront: true });

    const inv = await call(client, 'evaluate_script', {
      function: `() => {
        const buttons = Array.from(document.querySelectorAll('button')).map((b, i) => ({
          i,
          id: b.id || null,
          txt: (b.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 80),
          aria: (b.getAttribute('aria-label') || '').trim(),
          title: (b.getAttribute('title') || '').trim(),
          dataFormat: b.getAttribute('data-export-format') || null,
          cls: (b.className || '').slice(0, 120),
          disabled: !!b.disabled,
        }));
        const candidates = buttons.filter((b) => {
          const s = (String(b.txt) + ' ' + String(b.aria) + ' ' + String(b.title) + ' ' + String(b.dataFormat || '')).toLowerCase();
          return s.includes('pdf') || s.includes('export') || s.includes('download') || s.includes('导出');
        });
        return { candidates, total: buttons.length };
      }`
    });

    const invData = parseJson(inv.text);
    console.log('=== CANDIDATES ===');
    console.log(JSON.stringify(invData, null, 2));

    const click = await call(client, 'evaluate_script', {
      function: `() => {
        window.__pdf_err = [];
        window.__pdf_unhandled = [];
        window.__pdf_console = [];

        const oldErr = console.error;
        console.error = (...args) => {
          window.__pdf_console.push(args.map(a => String(a)).join(' '));
          oldErr.apply(console, args);
        };

        addEventListener('error', (event) => {
          window.__pdf_err.push({
            message: event.message || null,
            stack: event.error?.stack || null,
            filename: event.filename || null,
            lineno: event.lineno || null,
            colno: event.colno || null,
          });
        });

        addEventListener('unhandledrejection', (event) => {
          window.__pdf_unhandled.push({
            reason: String(event.reason),
            stack: event.reason?.stack || null,
          });
        });

        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find((b) => {
          const s = (String((b.innerText||'').trim()) + ' ' + String((b.getAttribute('aria-label')||'').trim()) + ' ' + String((b.getAttribute('title')||'').trim())).toLowerCase();
          return s.includes('export to pdf') || s.includes('download pdf') || s.includes('pdf');
        });
        if (!btn) return { clicked: false, reason: 'No PDF button found' };
        const info = {
          text: (btn.innerText || '').trim(),
          aria: (btn.getAttribute('aria-label') || '').trim(),
          title: (btn.getAttribute('title') || '').trim(),
          id: btn.id || null,
          cls: (btn.className || '').slice(0, 120),
          disabled: !!btn.disabled,
        };
        btn.click();
        return { clicked: true, info };
      }`
    });

    console.log('=== CLICK ===');
    console.log(JSON.stringify(parseJson(click.text), null, 2));

    await sleep(3000);

    const post = await call(client, 'evaluate_script', {
      function: `() => {
        const notices = Array.from(document.querySelectorAll('[role="alert"], .toast, .flash-notification, .modal, .error')).map(e => (e.textContent||'').trim()).filter(Boolean).slice(0, 12);
        const downloadAnchors = Array.from(document.querySelectorAll('a[download]')).map(a => ({name: a.getAttribute('download'), href: (a.getAttribute('href') || '').slice(0, 80)}));
        return {
          errorEvents: window.__pdf_err || [],
          unhandledRejections: window.__pdf_unhandled || [],
          consoleErrors: window.__pdf_console || [],
          notices,
          downloadAnchors,
        };
      }`
    });

    console.log('=== POST ===');
    console.log(JSON.stringify(parseJson(post.text), null, 2));

  } finally {
    await client.close();
  }
})().catch((e) => { console.error(e.stack || e.message || e); process.exit(1); });
NODE
````

## Source Truth

The PDF failure is not source-platform truth; it is target/runtime truth from the extension page itself. Source truth for this specific incident is the selected `chat-selection.html?id=7jPUdfwCqTTfrYRVpudWi` page and its pending export envelope.

## Target Truth

The target truth is the clicked PDF export runtime path inside `chat-selection.html`:

- PDF button exists in the rendered extension page
- click either produces the generic export failure notice or produces a PDF blob
- if error stacks are surfaced, the Phase B probe captures `errorEvents`, `unhandledRejections`, `consoleErrors`, and visible notices

## Eliminated Hypotheses

- A missing chat-selection page is eliminated by Phase A direct `new_page` plus `list_pages` rediscovery.
- A missing PDF button is eliminated by the Phase B candidate inventory.
- A purely browser-level crash is not proven unless `errorEvents`, `unhandledRejections`, or `list_console_messages` show it. In the verified investigation, the visible symptom was the generic export failure notice.

## First Distortion Layer

For the verified PDF incident, the first distortion layer was PDF font asset loading. Four Garamond files were invalid HTML payloads masquerading as `.ttf` files, and optional font failure was allowed to break the whole PDF export chain.

## Fix Boundary

Keep the fix at the PDF export font-loading boundary:

- validate binary font signatures before registering pdfmake VFS entries
- keep required fonts strict
- make optional Garamond loading non-fatal
- map `EBGaramond` to an existing fallback family when optional Garamond is not fully valid

## Verification Commands

Run normal project verification from the repository root after fixing:

```bash
npm test
npm run build
```

## E2E Browser Verification

### Phase C. Page-Level Download Probe And PDF Blob Verification

This is the verified patched MCP Node wrapper used to install a page-level `URL.createObjectURL` probe, click the PDF button, and check both the visible failure notice and generated blob metadata.

````bash
cd /Users/justdoit/Documents/Cluely/ai-exporter-vanilla && node - <<'NODE'
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createRequire } = require('node:module');

async function setup(clientName = 'pdf-download-probe') {
  const BUILD_ENTRY = path.join(os.homedir(),'tools','chrome-devtools-mcp-extension-inspect','build','src','bin','chrome-devtools-mcp.js');
  const buildRequire = createRequire(BUILD_ENTRY);
  const clientPath = buildRequire.resolve('@modelcontextprotocol/sdk/client/index.js');
  const stdioPath = buildRequire.resolve('@modelcontextprotocol/sdk/client/stdio.js');
  const [{ Client }, { StdioClientTransport }] = await Promise.all([
    import(pathToFileURL(clientPath).href),
    import(pathToFileURL(stdioPath).href),
  ]);
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [BUILD_ENTRY,'--autoConnect','--categoryExtensions','--no-usage-statistics','--no-performance-crux'],
    stderr: 'pipe',
  });
  const client = new Client({ name: clientName, version: '0.1.0' });
  await client.connect(transport);
  return client;
}
async function call(client, name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  return result?.content?.filter((p) => p.type === 'text').map((p) => p.text).join('\n') || '';
}
(async () => {
  const EXT_ID = 'lhaoppckdeodmjldiciojkeonmgcblha';
  const client = await setup();
  try {
    const pagesText = await call(client, 'list_pages');
    const matches = [...pagesText.matchAll(new RegExp(`^(\\d+):\\s+(chrome-extension:\\/\\/${EXT_ID}\\/chat-selection[^\\n]*)`, 'gm'))]
      .map((m) => ({ id: Number(m[1]), url: m[2] }));
    if (matches.length === 0) {
      console.log('NO_CHAT_SELECTION_PAGE');
      return;
    }

    const target = matches[0];
    await call(client, 'select_page', { pageId: target.id });

    await call(client, 'evaluate_script', {
      function: `() => {
        window.__pdfDownloads = [];
        window.__pdfProbeErrors = [];
        const origCreate = URL.createObjectURL.bind(URL);
        URL.createObjectURL = function patchedCreateObjectURL(blob) {
          try {
            window.__pdfDownloads.push({
              at: Date.now(),
              size: blob?.size ?? null,
              type: blob?.type ?? null,
            });
          } catch (err) {
            window.__pdfProbeErrors.push(String(err));
          }
          return origCreate(blob);
        };
        return { ready: true };
      }`,
    });

    const click = await call(client, 'evaluate_script', {
      function: `() => {
        const btn = document.querySelector('button[title*="multi-page PDF"]') || document.querySelector('[data-format="pdf"]');
        if (!btn) return { clicked: false };
        btn.click();
        return { clicked: true, title: btn.getAttribute('title') || null };
      }`,
    });

    await call(client, 'evaluate_script', {
      function: `() => new Promise((resolve) => setTimeout(() => resolve(true), 2600))`,
    });

    const finalState = await call(client, 'evaluate_script', {
      function: `() => {
        const notice = document.getElementById('export-task-notice');
        const msg = document.getElementById('export-task-notice-message');
        return {
          noticeVisible: notice?.getAttribute('aria-hidden') === 'false',
          noticeText: msg?.textContent?.trim() || null,
          downloadCount: window.__pdfDownloads?.length || 0,
          latestDownload: window.__pdfDownloads?.slice(-1)[0] || null,
          probeErrors: window.__pdfProbeErrors || [],
        };
      }`,
    });

    console.log('TARGET', JSON.stringify(target));
    console.log('CLICK', click);
    console.log('FINAL', finalState);
  } finally {
    await client.close();
  }
})().catch((err) => {
  console.error(err?.stack || err?.message || String(err));
  process.exit(1);
});
NODE
````

Expected post-fix signals from the verified run:

```json
{
  "noticeVisible": false,
  "downloadCount": 1,
  "latestDownload": {
    "size": 441779,
    "type": "application/pdf"
  },
  "probeErrors": []
}
```

Field note:

- this shape is a strong success signal, not an absolute requirement in every browser/runtime combination
- if `downloadCount` is `0`, cross-check the actual downloaded file before marking failure

## Artifacts

No raw private network artifacts are required for this example. The important artifacts are the console output from the scripts and, post-fix, the generated browser download/PDF blob metadata.

## Cleanup And Security Notes

- Do not commit raw chat-selection storage payloads unless intentionally redacted.
- The extension id and conversation id in these scripts are local values from the verified run.
- The `URL.createObjectURL` patch is page-local and lasts for the lifetime of the selected chat-selection page.