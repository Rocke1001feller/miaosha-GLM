# Example 05 — Grok Passive API Replay (Parser Forensics Template)

## Why This Example Exists

Grok uses a **three-call REST sequence** with cookie-only authentication. This template documents
the exact call chain and field inspection patterns needed to investigate parser bugs — such as
thinking content not displaying, image cards being lost, or tool-activity steps being misread.

This is a **transfer template**: it gives you the investigation scaffold. You fill in the specific
bug symptom and the field bisection once you have the probe output.

## Known Bug Class: Same Pattern As AI Studio

User-reported bugs (2026-04-26):
- `https://grok.com/c/7862228d-b13e-4967-ae96-076fdbf3a3db?rid=c08871b4-183f-455f-b485-a34607e334ae`
- Suspected: thinking content not shown, or model-generated images missing

The methodology is identical to Example 04. The difference is auth (cookie-only, not SAPISIDHASH)
and the three-call data retrieval pattern.

## Source Truth vs Target Truth (Fill In For Your Bug)

| | Your Bug |
|---|---|
| **Source truth** | What Grok shows in the browser |
| **Target truth** | What the extension shows after export |
| **Chain location** | `services/platform-slices/grok/parser.ts` |
| **Specific parser section** | `extractStepsThinking`, `parseGrokResponse`, card parsing |

## Auth: Cookie-Only

Grok uses standard browser session cookies. No SAPISIDHASH computation, no bootstrap token extraction.

```javascript
// No helper needed. credentials: 'include' is all that is required.
```

**Precondition**: The Grok tab must already be open and logged in. Do not open a fresh tab —
Cloudflare may challenge it.

## The Three-Call Sequence

### Why Three Calls?

| Call | Endpoint | Returns |
|------|----------|---------|
| 1 | `GET conversations_v2/{id}` | Conversation shell: title, flags, timestamps |
| 2 | `GET response-node?includeThreads=true` | Branch tree: `responseId → parentResponseId` topology |
| 3 | `POST load-responses` | Actual message content: text, steps, cards, images, thinking |

The active branch path is encoded in the URL's `?rid=` parameter. Call 3's POST body must contain
only the `responseIds` on the active branch, not all nodes. Sending all nodes exports non-current
branches.

### Building The Branch Path

```javascript
function buildBranchPath(nodes, targetRid) {
  // Walk from targetRid up to root via parentResponseId
  const nodeMap = Object.fromEntries(nodes.map(n => [n.responseId, n]));
  const path = [];
  let current = targetRid;
  while (current) {
    const node = nodeMap[current];
    if (!node) break;
    path.unshift(current);
    current = node.parentResponseId;
  }
  return path;
}
```

## Full Replay Script

```javascript
async () => {
  const convMatch = window.location.href.match(/\/c\/([0-9a-f-]{36})/);
  const ridMatch = new URLSearchParams(window.location.search).get('rid');
  if (!convMatch) return { error: 'no conversationId in URL: ' + window.location.href };
  const convId = convMatch[1];

  // Call 1: conversation shell (optional — provides title/metadata only)
  // const shellRes = await fetch(`https://grok.com/rest/app-chat/conversations_v2/${convId}?includeWorkspaces=true`, { credentials: 'include' });
  // const shell = await shellRes.json();

  // Call 2: branch topology
  const nodeRes = await fetch(
    `https://grok.com/rest/app-chat/conversations/${convId}/response-node?includeThreads=true`,
    { credentials: 'include' }
  );
  if (!nodeRes.ok) return { error: `response-node HTTP ${nodeRes.status}` };
  const nodeData = await nodeRes.json();
  const nodes = nodeData?.responseNode?.responseNodes ?? [];

  // Build branch path from URL ?rid= or fallback to all nodes
  function buildBranchPath(allNodes, targetRid) {
    const nodeMap = Object.fromEntries(allNodes.map(n => [n.responseId, n]));
    const path = [];
    let cur = targetRid;
    while (cur) {
      const node = nodeMap[cur];
      if (!node) break;
      path.unshift(cur);
      cur = node.parentResponseId;
    }
    return path.length > 0 ? path : allNodes.map(n => n.responseId);
  }
  const responseIds = ridMatch ? buildBranchPath(nodes, ridMatch) : nodes.map(n => n.responseId);

  // Call 3: load actual message content
  const loadRes = await fetch(
    `https://grok.com/rest/app-chat/conversations/${convId}/load-responses`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ responseIds }),
    }
  );
  if (!loadRes.ok) return { error: `load-responses HTTP ${loadRes.status}` };
  const loadData = await loadRes.json();
  const responses = loadData?.responses ?? [];

  // Field inspection — adapt based on your bug
  return responses.map((r, idx) => ({
    idx,
    responseId: r.responseId,
    sender: r.sender,
    messageSnippet: typeof r.message === 'string' ? r.message.slice(0, 80) : null,
    // Thinking signals
    thinkingStartTime: r.thinkingStartTime ?? null,
    thinkingEndTime: r.thinkingEndTime ?? null,
    // Steps (thinking content lives here)
    stepCount: Array.isArray(r.steps) ? r.steps.length : 0,
    stepTypes: Array.isArray(r.steps) ? r.steps.map(s => s.type ?? Object.keys(s).join(',')) : [],
    // Image signals
    cardCount: Array.isArray(r.cardAttachmentsJson) ? r.cardAttachmentsJson.length : 0,
    firstCardType: Array.isArray(r.cardAttachmentsJson) && r.cardAttachmentsJson.length > 0
      ? (() => { try { return JSON.parse(r.cardAttachmentsJson[0])?.type; } catch { return 'parse_error'; } })()
      : null,
    hasFileAttachments: Array.isArray(r.fileAttachments) && r.fileAttachments.length > 0,
    // Additional fields to investigate if bug is unclear
    allTopLevelKeys: Object.keys(r).join(', '),
  }));
}
```

## Bisection Guide For Grok Parser Bugs

### Thinking Not Displayed

Check that `extractStepsThinking()` in `parser.ts` correctly reads `r.steps[].text[]`. Known gotcha: steps may contain `<xai:…>` XML tool_usage_card blocks mixed with plain text — these are already filtered out. If thinking is still missing, probe:

```javascript
return responses
  .filter(r => r.sender === 'ASSISTANT')
  .map(r => ({
    id: r.responseId,
    stepTexts: (r.steps ?? []).map(s => ({
      textLines: s.text ?? [],
      hasXaiTag: (s.text ?? []).some(l => l.includes('<xai:')),
    })),
    thinkingStartTime: r.thinkingStartTime,
  }));
```

### Image Cards Not Shown

Grok image cards come from `r.cardAttachmentsJson[]` as JSON strings (not objects). Each string must be `JSON.parse()`d. Known card types: `render_searched_image`, `image_card`.

```javascript
return responses
  .filter(r => r.sender === 'ASSISTANT')
  .flatMap(r => (r.cardAttachmentsJson ?? []).map(raw => {
    try {
      const card = JSON.parse(raw);
      return { type: card.type, imageUrl: card.imageUrl ?? card.url ?? 'N/A' };
    } catch { return { type: 'PARSE_ERROR', raw: raw.slice(0, 80) }; }
  }));
```

### Tool Activity Structures

Steps with `tool_usage_card` and `raw_function_result` appear in `r.steps[].toolUsageCards[]` and `r.steps[].toolUsageResults[]`. The parser looks for `webSearch` and `browsePage` types. If new tool types are appearing in your conversation, enumerate them:

```javascript
return responses
  .filter(r => r.sender === 'ASSISTANT')
  .flatMap(r => (r.steps ?? []).flatMap(s => [
    ...(s.toolUsageCards ?? []).map(c => ({ from: 'card', type: c.type ?? c.cardType })),
    ...(s.toolUsageResults ?? []).map(c => ({ from: 'result', type: c.type ?? c.cardType })),
  ]));
```

## Protocol Dossier (Verified)

From `docs/platform-dossiers/grok-dossier.md`:

```text
Auth:         Cookie-only (credentials: 'include')
Shell:        GET /rest/app-chat/conversations_v2/{id}
Branch tree:  GET /rest/app-chat/conversations/{id}/response-node?includeThreads=true
Messages:     POST /rest/app-chat/conversations/{id}/load-responses  { responseIds: [...] }
Assets:       GET /rest/assets/{assetId}
Share links:  GET /rest/app-chat/share_links?pageSize=100&conversationId={id}

Thinking:     r.thinkingStartTime / r.thinkingEndTime on assistant responses
              Thinking text lives in r.steps[].text[] (plain text lines only; skip <xai:> lines)
Images:       r.cardAttachmentsJson[] (JSON strings, not objects; type: render_searched_image / image_card)
File uploads: r.fileAttachments[] + r.fileAttachmentsMetadata[]
Branch path:  r.parentResponseId on each node; active branch = chain from ?rid back to root
```

## Implementation Boundary

Once you find the misread field via bisection:
- Parser file: `services/platform-slices/grok/parser.ts`
- Relevant functions: `extractStepsThinking`, `parseGrokCards`, the main `parseGrokResponse`
- Regression test: `tests/services/platform-slices/grok-slice.test.ts` (or inline in service tests)

## Transferable Lessons

1. **Grok is the simplest auth in the repo.** Cookie-only, no header computation. If it fails, the tab is not logged in.
2. **Three calls are mandatory.** `load-responses` data is not in `conversations_v2`. Do not short-circuit.
3. **Branch fidelity matters.** Always use the `rid` URL param to build the branch path. Sending all nodeIds gives you non-active branches and may cause parser errors on unexpected response orderings.
4. **`cardAttachmentsJson` is a JSON-string array.** A future colleague will try to iterate it as objects. It must be `JSON.parse()`d per element.
5. **Thinking is in `steps[].text[]`, not a top-level field.** The `thinkingStartTime` / `thinkingEndTime` fields indicate a thinking session happened but do not contain the text.
