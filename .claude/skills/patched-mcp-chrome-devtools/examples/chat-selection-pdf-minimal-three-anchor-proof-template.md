# Example Template: Minimal MCP Probes To Prove Source + Chat-Selection Are Correct And Only PDF Artifact Is Distorted

## Goal

Provide the shortest reproducible acceptance workflow to answer one question:

Is the first distortion layer already present before export, or does it appear only in the final PDF artifact?

This template is for incidents like:

- PDF table overlaps but source/chat-selection looks normal
- PDF spacing or glyph layout differs while extension UI looks fine
- you need hard evidence before discussing renderer/library fixes

## Use This Template When

- the symptom is visible in exported PDF pages
- ownership between parser and PDF rendering is still unclear
- you need a fast, low-noise triage before code edits

## Prerequisites

- patched MCP server connected to the already-running logged-in Chrome
- source page open in that Chrome session
- matching chat-selection page open for the same conversation id
- extension build under test already loaded

## Local Variables To Rediscover

| Name | Meaning |
|---|---|
| SOURCE_URL | source conversation URL |
| EXT_ID | extension id |
| CONV_ID | conversation id |
| KEYWORD | nearby anchor text around the failing region |
| VERIFY_PAGES | PDF pages to verify (must include the failing page) |

## Minimal Three-Anchor Probe Flow

### Anchor A — Source Truth (Read-only probe)

1. list pages and select source page
2. run one probe that returns:
   - url, title
   - text snippet around KEYWORD
   - optional target-node geometry

Recommended probe shape:

```javascript
() => {
  const key = 'REPLACE_KEYWORD';
  const host = document.querySelector('main') || document.body;
  const text = String(host?.innerText || '');
  const idx = text.indexOf(key);
  return {
    url: location.href,
    title: document.title,
    found: idx >= 0,
    around: idx >= 0 ? text.slice(Math.max(0, idx - 300), Math.min(text.length, idx + 800)) : null,
  };
}
```

Acceptance for Anchor A:

- KEYWORD found
- snippet semantically matches user-reported source truth

### Anchor B — Chat-Selection Truth (Read-only probe)

1. select matching chat-selection page
2. run one probe that returns:
   - same snippet around KEYWORD
   - table cell metrics when table incidents are involved (`clientWidth`, `scrollWidth`, `overflowX`)

Recommended table-focused extension probe:

```javascript
() => {
  const target = Array.from(document.querySelectorAll('table')).find((table) =>
    Array.from(table.querySelectorAll('th')).some((th) => (th.textContent || '').includes('REPLACE_HEADER'))
  );
  if (!target) return { found: false };

  const rows = Array.from(target.querySelectorAll('tr')).map((tr, rowIndex) => ({
    row: rowIndex + 1,
    cells: Array.from(tr.querySelectorAll('th,td')).map((cell, colIndex) => ({
      col: colIndex + 1,
      text: (cell.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
      clientWidth: cell.clientWidth,
      scrollWidth: cell.scrollWidth,
      overflowX: cell.scrollWidth > cell.clientWidth,
    })),
  }));

  return { found: true, rows };
}
```

Acceptance for Anchor B:

- KEYWORD or target region found
- no pre-export overflow for the incident rows when applicable

### Anchor C — Artifact Truth (Fresh PDF verification)

Run the real export acceptance loop using the existing one-click script:

```bash
VERIFY_PAGES=REPLACE_FAILING_PAGE_SET \
node .claude/skills/patched-mcp-chrome-devtools/examples/scripts/example4-pdf-reload-click-wait-download-verify-oneclick.cjs
```

Required outputs:

- fresh PDF file detected (new mtime/filename)
- screenshot set includes failing pages
- metadata captured (size, hash when needed)

Acceptance for Anchor C:

- artifact screenshots reproduce or clear the symptom on the expected pages

## Distortion-Layer Decision Table

| Anchor A | Anchor B | Anchor C | First Distortion Layer |
|---|---|---|---|
| wrong | any | any | source/extraction preconditions |
| correct | wrong | any | parser/normalization/chat-selection rendering boundary |
| correct | correct | wrong | export transformer or PDF renderer boundary |
| correct | correct | correct | likely stale artifact, wrong page checkpoint, or false report |

## Minimal Deliverable Contract

At triage end, store one compact JSON summary with:

- source probe payload
- chat-selection probe payload
- latest PDF metadata
- failing/success page screenshots paths
- firstDistortionLayer decision

## Anti-Patterns This Template Prevents

- editing product code before locking source/chat-selection/artifact truth
- treating notice text alone as artifact truth
- checking only one page and missing the actual failing page boundary
- assuming parser fault when chat-selection metrics already prove no pre-export overflow

## Recommended Next Step Handoff

When decision is export/renderer boundary, hand off to chain-first-debugging with:

- this triage JSON
- failing screenshots
- exact file hash of fresh PDF
- statement: source and chat-selection anchors already validated
