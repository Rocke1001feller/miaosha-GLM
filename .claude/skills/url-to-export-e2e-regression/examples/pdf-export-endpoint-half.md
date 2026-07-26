# Example: PDF Export Endpoint Half

## What This Case Proves

The existing PDF script proves the **back half** of the chain:

```text
existing chat-selection page -> click PDF export button -> generated PDF blob metadata
```

It does not open a source URL. Therefore it is `endpoint-only`, not `full-url-to-export`.

## Existing Script

```bash
node .claude/skills/patched-mcp-chrome-devtools/examples/scripts/example1-pdf-oneclick.cjs
```

The script:

1. finds an already-open `chat-selection.html?id=...` page,
2. reopens it directly,
3. clicks the real PDF export button,
4. patches `URL.createObjectURL`,
5. records generated blob `type` and `size`,
6. reports notice text and probe errors.

Important erratum from the existing script: `downloadCount=0` can still happen even when Chrome downloads a valid PDF, so the content carrier oracle must not rely on download count alone.

## How To Convert To Full URL -> PDF E2E

Use the new skill runner shape:

```text
source URL -> popup Export Now -> chat-selection checkpoint -> click [data-format="pdf"] -> PDF carrier oracle
```

Case module sketch:

```js
module.exports = {
  id: 'perplexity-sources-citations-pdf',
  kind: 'full-url-to-export',
  sourceUrl: 'https://www.perplexity.ai/search/REDACTED',
  platform: 'perplexity',
  resource: 'sources-citations',
  endpoint: { kind: 'export', format: 'pdf' },
  chatSelection: {
    probe: `() => ({
      url: location.href,
      chipCount: document.querySelectorAll('.citation-chip').length,
      sourceCount: document.querySelectorAll('.source-item[id^="source-"]').length,
    })`,
    assert(result, assert) {
      assert(result.url.includes('/chat-selection.html?id='), 'chat-selection should be open', result);
      assert(result.chipCount > 0, 'citations should render before PDF export', result);
      assert(result.sourceCount > 0, 'sources should render before PDF export', result);
    },
  },
  export: {
    waitMs: 3500,
    probeKind: 'blob-create-object-url',
    assert(result, assert) {
      const latest = result.blobs.at(-1);
      assert(latest, 'PDF export should create a blob', result);
      assert(latest.type === 'application/pdf', 'exported blob should be a PDF', latest);
      assert(latest.size > 1000, 'PDF blob should be non-empty', latest);
      assert(String(latest.firstBytesHex || '').startsWith('25504446'), 'PDF should start with %PDF', latest);
    },
  },
};
```

This is a minimal PDF carrier oracle. For resource-level PDF content verification, extend it with a PDF text extraction step and assert the selected resource text/source/citation content inside the PDF.

## Why This Distinction Matters

- `example1-pdf-oneclick.cjs` is valuable because it verifies the export runtime boundary.
- It is not enough for URL-start E2E because it skips source capture, parser, normalization, and chat-selection creation.
- A full automated regression must combine the URL-to-chat-selection runner with this PDF endpoint probe.
