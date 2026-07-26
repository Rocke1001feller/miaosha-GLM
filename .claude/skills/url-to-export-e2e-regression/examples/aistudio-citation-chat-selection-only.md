# Example: AI Studio Citation To Chat-Selection Checkpoint

## What This Case Proves

This is a **front-half** regression:

```text
AI Studio source payload -> parser -> normalized message -> chat-selection render -> citation click chain
```

It proves that citation chips and source appendix entries agree after reaching `chat-selection`.

It does **not** prove that citations survive into PDF, Markdown, DOCX, Notion, or any other export format.

## Existing Lock

Path:

```text
tests/entrypoints/google-aistudio-citation-e2e.test.ts
```

That test runs:

1. minimal AI Studio raw payload,
2. real `parseAistudioResponse`,
3. real `ChatMessageRenderer`,
4. storage assertions for `citationMap` and `[^N^]` markers,
5. render assertions for `.citation-chip` and `.source-item`,
6. click assertion from chip to active source appendix item.

## How To Upgrade To URL-Based E2E

Create a case module:

```text
tests/e2e-cases/google-aistudio-sources-citations-chat-selection.case.cjs
```

Use:

```js
module.exports = {
  id: 'google-aistudio-sources-citations-chat-selection',
  kind: 'url-to-chat-selection',
  sourceUrl: 'https://aistudio.google.com/prompts/REDACTED',
  platform: 'google-aistudio',
  resource: 'sources-citations',
  endpoint: { kind: 'chat-selection' },
  chatSelection: {
    probe: `() => ({
      url: location.href,
      chipCount: document.querySelectorAll('.citation-chip[href^="#source-"]').length,
      sourceCount: document.querySelectorAll('.source-item[id^="source-"]').length,
      firstHref: document.querySelector('.citation-chip')?.getAttribute('href') || null,
    })`,
    assert(result, assert) {
      assert(result.url.includes('/chat-selection.html?id='), 'chat-selection should be open', result);
      assert(result.chipCount >= 2, 'expected at least two citation chips', result);
      assert(result.sourceCount >= 2, 'expected at least two source appendix items', result);
      assert(result.firstHref === '#source-1', 'first chip should target source-1', result);
    },
  },
};
```

Run with the generic runner:

```bash
CASE_MODULE=tests/e2e-cases/google-aistudio-sources-citations-chat-selection.case.cjs \
EXT_ID=<installed-extension-id> \
node .claude/skills/url-to-export-e2e-regression/scripts/url-to-export-e2e-runner.template.cjs
```

## How To Upgrade To Full Export E2E

Pick one export format and create a separate case, for example:

```text
google-aistudio-sources-citations-pdf.case.cjs
```

Change endpoint:

```js
endpoint: { kind: 'export', format: 'pdf' }
```

Then add an export oracle proving the generated PDF carrier contains the citation/source semantics. Until that endpoint oracle exists, the case remains `url-to-chat-selection`, not `full-url-to-export`.
