# Case Module Schema

Use a CommonJS module so each case can carry executable assertions without inventing a JSON expression language.

Filename convention:

```text
tests/e2e-cases/<platform>-<resource>-<endpoint>.case.cjs
```

Minimal shape:

```js
module.exports = {
  id: 'google-aistudio-sources-citations-chat-selection',
  kind: 'full-url-to-export', // or 'url-to-chat-selection' or 'endpoint-only'
  sourceUrl: 'https://aistudio.google.com/prompts/REDACTED',
  platform: 'google-aistudio',
  resource: 'sources-citations',
  endpoint: {
    kind: 'chat-selection', // or 'export'
    // format: 'pdf',       // required when kind === 'export'
  },
  extension: {
    envId: 'EXT_ID',
    reloadBeforeRun: false,
  },
  download: {
    // Optional. false = auto-download, true = ask where to save for each file.
    // Local automation default should remain false.
    manualDownload: false,
  },
  source: {
    probe: `() => ({ url: location.href, title: document.title })`,
    assert(result, assert) {
      assert(result.url.includes('aistudio.google.com'), 'source page should be AI Studio');
    },
  },
  chatSelection: {
    waitMs: 1000,
    probe: `() => ({
      url: location.href,
      chipCount: document.querySelectorAll('.citation-chip').length,
      sourceCount: document.querySelectorAll('.source-item[id^="source-"]').length,
    })`,
    assert(result, assert) {
      assert(result.url.includes('/chat-selection.html?id='), 'chat-selection URL should be active');
      assert(result.chipCount >= 2, 'expected at least two citation chips');
      assert(result.sourceCount >= 2, 'expected at least two source appendix items');
    },
  },
  export: {
    waitMs: 3500,
    probeKind: 'blob-create-object-url',
    assert(result, assert) {
      const latest = result.blobs.at(-1);
      assert(latest?.type === 'application/pdf', 'expected PDF blob');
      assert(latest?.size > 1000, 'expected non-empty PDF blob');
    },
  },
};
```

## Required Fields

| Field | Required | Notes |
|---|---:|---|
| `id` | yes | Stable kebab-case id. Also used for output folder names. |
| `kind` | yes | `full-url-to-export`, `url-to-chat-selection`, or `endpoint-only`. Use `endpoint-only` only for scripts that start from an existing chat-selection page. |
| `sourceUrl` | yes except endpoint-only | Real source URL. Sanitize if committed. |
| `platform` | yes | Extension platform id. |
| `resource` | yes | One of the 12 ids from `SKILL.md`. |
| `endpoint.kind` | yes | `chat-selection` or `export`. |
| `endpoint.format` | when export | One of `json`, `markdown`, `copy-markdown`, `text`, `pdf`, `docx`, `image`, `copy`, `notion`. |
| `download.manualDownload` | no | Optional override. `false` means auto-download, `true` means `Control Where to Save` is on and the browser asks where to save. If omitted, runner defaults to local `false`, unless `E2E_MANUAL_DOWNLOAD` env is set. |
| `chatSelection.probe` | yes | Browser function string executed in the chat-selection page. Must return JSON-serializable data. |
| `chatSelection.assert` | yes | Node-side assertion function. |
| `export.assert` | when export | Node-side assertion function over the export carrier probe. |

## Probe Rules

- Probe functions must return plain JSON data.
- Do not return DOM nodes, Blobs, Files, Maps, or cyclic objects.
- Use stable selectors from `entrypoints/chat-selection`, especially `data-format`, `.export-btn`, `.citation-chip`, `.source-item`, `.thinking-block`, `.tool-activity-block`, `img[data-original-url]`, `pre code`, `.katex`, `.mermaid`, `table`.
- Assertions should state the resource count, ordering, title/url/content, and interaction result when relevant.

## Endpoint Probe Kinds

| Probe kind | Formats | Meaning |
|---|---|---|
| `blob-create-object-url` | `json`, `markdown`, `text`, `pdf`, `docx`, `image` | Patch `URL.createObjectURL`, capture blob metadata and text/bytes where possible. |
| `clipboard-text` | `copy-markdown` | Read clipboard text after the copy command when browser permissions allow. |
| `clipboard-image` | `copy` | Assert clipboard image blob metadata through injected copy adapter when available. |
| `notion-page` | `notion` | Reopen the created Notion page and assert real block content. |

The generic runner template implements `blob-create-object-url`. Other probe kinds should use a case-specific runner or extend the template.
