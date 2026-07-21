# Example: Perplexity Citation Dual Snapshot And Popup Export Flow

This example is the standard reproducible workflow for incidents where:

- Perplexity source page appears correct
- extension chat-selection output loses citation behavior or formatting
- ownership between parser and renderer is unclear

It combines two mandatory ideas:

1. dual-truth snapshot (source page vs chat-selection)
2. coherent extension operation loop (reload -> re-extract -> new chat-selection page)

## Goal

Identify the first distortion layer in this chain:

source Perplexity page -> extraction/parsing -> chat-selection storage payload -> chat-selection rendered DOM

## Prerequisites

- patched MCP Chrome DevTools is connected to the user's already-running logged-in Chrome
- the extension is installed and enabled
- the target Perplexity conversation URL is known
- popup export can be triggered (action button or popup page URL fallback)

## One-Click Minimal Script

```bash
node .claude/skills/patched-mcp-chrome-devtools/examples/scripts/example3-perplexity-dual-snapshot-oneclick.cjs
```

Optional env overrides:

- `EXT_ID`
- `SOURCE_URL`

## Local Variables To Rediscover

Do not hardcode values below across machines.

| Variable | Meaning | How to rediscover |
|---|---|---|
| BUILD_ENTRY | patched MCP CLI path | local install path |
| EXT_ID | extension id | extension page URL or list_extensions |
| SOURCE_URL | Perplexity conversation URL | user-provided or active tab |
| CONV_ID | chat-selection conversation id | parsed from chat-selection URL |
| SOURCE_PAGE_ID | page id for Perplexity tab | list_pages + URL match |
| POPUP_PAGE_ID | page id for popup tab | list_pages + URL match |
| TARGET_PAGE_ID | page id for chat-selection tab | list_pages + URL match |

## Field Errata From 2026-05 Verification

1. Popup export button selection must prefer `file_download Export Now`.
2. Exclude `Log in to sync exports` and disabled export-looking buttons.
3. `chat-selection.html?id=...` creation can be delayed; poll `list_pages` for 8-12 seconds.
4. Add bounded retries for `reload_extension`, `trigger_extension_action`, `list_pages`, and `take_snapshot` due transient timeout errors.

## MCP Command Transcript

### Phase A. Capture source truth snapshot first

1. Discover and select source page.

```text
list_pages {}
select_page { pageId: SOURCE_PAGE_ID, bringToFront: true }
```

2. Freeze structural state.

```text
take_snapshot {}
```

3. Capture source probe payload.

```text
evaluate_script {
  function: "() => {
    const main = document.querySelector('main') || document.body;
    const text = (main.textContent || '').replace(/\\s+/g, ' ').trim();
    const anchors = [...main.querySelectorAll('a[href]')]
      .map((a) => ({ href: a.href, text: (a.textContent || '').trim() }))
      .filter((x) => x.href);
    return {
      location: location.href,
      tokenShape: {
        hasNumericBracket: /\\[(\\d+)\\]/.test(text),
        hasFootnoteMarker: /\\[\\^(\\d+)\\^\\]/.test(text),
        hasDomainLikeToken: /(?:[a-z0-9-]+\\.)+[a-z]{2,}(?:\\s*\\+\\s*\\d+)?/i.test(text),
      },
      sourceLinksCount: anchors.length,
      sourceLinksSample: anchors.slice(0, 15),
      textHead: text.slice(0, 900),
    };
  }"
}
```

### Phase B. Coherent extension operation loop

Order is strict:

1. reload extension
2. re-focus source page
3. trigger popup
4. click export in popup
5. discover fresh chat-selection page

1. Reload extension.

```text
reload_extension { id: EXT_ID }
```

2. Re-select source page by URL.

```text
list_pages {}
select_page { pageId: SOURCE_PAGE_ID, bringToFront: true }
```

3. Trigger popup.

Preferred path:

```text
trigger_extension_action { id: EXT_ID }
```

Fallback path:

```text
new_page { url: "chrome-extension://EXT_ID/popup.html" }
```

4. Select popup page and click export.

```text
list_pages {}
select_page { pageId: POPUP_PAGE_ID, bringToFront: true }
take_snapshot {}
click { uid: <Export Now uid, prefer "file_download Export Now"> }
```

5. Discover fresh chat-selection page created by this run.

```text
list_pages {}   # poll every 1s for 8-12s
select_page { pageId: TARGET_PAGE_ID, bringToFront: true }
```

### Phase C. Capture target truth snapshot

Capture both storage truth and rendered DOM truth.

1. Structural snapshot.

```text
take_snapshot {}
```

2. Storage + rendered probe.

```text
evaluate_script {
  function: "() => new Promise((resolve) => {
    const params = new URLSearchParams(location.search);
    const convId = params.get('id') || '';
    const key = convId ? `chat_export_${convId}` : null;

    const rendered = {
      citationChipCount: document.querySelectorAll('.citation-chip').length,
      staleBadgeCount: document.querySelectorAll('.citation-stale, .citation-chip--stale').length,
      sourceBlocks: document.querySelectorAll('.message-sources, .sources-list, .message__sources').length,
      proseHead: (document.querySelector('.message-content, .message-text')?.textContent || '').slice(0, 800),
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
          markerSample: (content.match(/\\[\\^\\d+\\^\\]/g) || []).slice(0, 20),
          contentHead: content.slice(0, 800),
        } : null,
        rendered,
      });
    });
  })"
}
```

## Source Truth

Extract from Phase A probe:

- source token shape
- source links count and sample
- representative prose near citation-rich paragraph

## Target Truth

Extract from Phase C probe:

- storage-level sources/citationMap/markers
- rendered-level citation chips/source blocks/stale badges

## Eliminated Hypotheses

Use this table after both snapshots are captured.

| Observation | Eliminate | First suspect layer |
|---|---|---|
| source has citation semantics, storage has none | renderer-first hypothesis | extraction/parser |
| storage has markers and citationMap, rendered has no chips | extraction/parser hypothesis | renderer/enricher |
| storage markers still domain-like (no [^N^]) while source is domain-chip style | renderer-only hypothesis | parser token normalization |
| rendered chips exist but stale badge ratio is high | token conversion hypothesis | citation map linkage |

## First Distortion Layer

Choose exactly one based on evidence above and record why upstream layers were eliminated.

## Fix Boundary

Patch only the first distortion layer:

- extraction/parser boundary for missing source/citation data
- renderer boundary for missing chip rendering from valid normalized payload

Do not patch both in one pass without proof.

## Verification Commands

After patch:

```text
npm test -- tests/services/platform-slices/perplexity-slice.test.ts
npm run build
```

Then rerun the full Phase B + Phase C loop from this file.

## E2E Browser Verification

Success criteria for this incident class:

- source snapshot and target snapshot agree on citation semantics
- chat-selection storage has non-empty sources and citationMap
- rendered DOM has citation chips and source blocks
- stale badge count is zero or expected by known edge cases

## Artifacts

Store each run's source and target probes as JSON text artifacts under an ignored path such as:

```text
.tmp/perplexity-dual-snapshot/run-YYYYMMDD-HHMM/
```

Recommended files:

- source-snapshot.json
- target-snapshot.json
- chain-decision.md

## Cleanup And Security Notes

- snapshots can include private conversation content and URLs
- do not commit raw artifacts unless redacted
- if the probe creates extra tabs/pages, close only the tabs created by this run
