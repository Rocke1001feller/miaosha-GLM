# Case Study 02 — Kimi Citation Markers Point To Wrong Sources

> **Why this example exists.** This is the most methodologically complete case study in this repository. Every move is documented: the hypothesis, the tool call, the actual result from the live Kimi API, and the conclusion. The investigation exposed a category of error that is invisible in fixtures but obvious from real production data: choosing the **wrong sibling field** in a payload, and treating a semantic identifier as a positional index.

---

## 0. Incident Snapshot

- **Branch:** `dev-hot-fix-clean-code`
- **Surface:** extension → Kimi parser → chat-selection citation badges
- **Severity:** medium — citations technically present, but semantically wrong
- **Root cause type:** wrong API field selected during normalization; number identity vs. positional index confusion
- **Full investigation log:** `root-cause.md` (archived in repo root at time of investigation)

---

## 1. What Was Observed (Symptom, Not Cause)

Kimi's assistant messages contain inline citation markers in the form `[^2^]`, `[^8^]`, `[^14^]`. These are rendered as numbered badges in chat-selection, with each badge linking to a source URL.

The observable symptom: **the badge numbers did not match the expected sources**. A user encountered a passage referencing a Weixin article about 1940万部 cars and an annual growth figure. The text contained `[^2^]`. In the rendered export, badge `2` linked to the wrong URL. The source displayed for citation `8` was also wrong. The pattern was consistent: the badge number was correct, but the URL behind the badge was from a completely different source — often unrelated to the cited passage.

---

## 2. The Wrong Intuition That Almost Misdirected The Investigation

**First intuition:** "The renderer is numbering citations incorrectly in the output list."

This felt plausible because the visible problem was a numbering mismatch. The natural instinct is to look at the rendering code: maybe the source list was being rendered in the wrong order, or maybe the badge index was being incremented incorrectly.

**Why this must be held as a hypothesis and not a conclusion:**
- The numbers in the text (`[^2^]`, `[^8^]`, `[^14^]`) come from the source data, not from the renderer.
- If the renderer was wrong, the numbers would still point to the right source — just displayed in the wrong order visually.
- The actual failure was that badge `2` linked to a different source at a different URL. That is a semantic mapping failure, not a display ordering failure.

**The chain-first question:** At which layer does `[^2^]` first become incorrectly mapped to the wrong URL?

---

## 3. Chain Map — Every Layer From Source To Badge

```
Kimi API: ListMessages (POST /apiv2/kimi.gateway.chat.v1.ChatService/ListMessages)
  └→ raw message: {
       id: string,
       blocks: [ { text.content: "...1940万部[^2^]..." }, { search.webPages: [...] } ],
       refs: {
         searchChunks: [ { id: "2", base: { url, title, siteName } }, ... ],
         usedSearchChunks: [ ... ]
       }
     }
       └→ Kimi parser (services/platform-slices/kimi/parser.ts)
           └→ parseKimiMessage() → ChatMessage {
                sources: [ {title, url} ],   // ← built from blocks[].search.webPages
                citationMap: { 1: {...}, 2: {...} }  // ← also built from webPages positionally
              }
               └→ chat-selection rendering.ts: resolveCitationMarkers()
                   └→ badge `[^2^]` → citationMap[2] → displayed source URL
                       └→ <a href="...">2</a> link rendered in exported chat
```

The chain has two candidate distortion layers:
1. **Parser field selection**: which API field populates `sources` and `citationMap`?
2. **Citation number interpretation**: is `[^2^]` a 1-based array position or an authoritative ref ID?

---

## 4. Define Both Ends

### Source Truth

From the live Kimi page, the passage "1940万部/同比增长6%" had exactly one `.rag-tag` bubble attached. That bubble's `data-site-name` attribute identified the publication name. The Kimi page was rendering citation `2` correctly, pointing to a specific Weixin article.

The ground truth artifacts were inspected via `evaluate_script` in the live Kimi browser tab:

```javascript
// Run in live Kimi tab to get DOM rag-tag siteName for the target passage
document.querySelectorAll('.rag-tag')[0].getAttribute('data-site-name')
// → "XX出行" (a specific automotive publication)
```

### Target Truth

In the exported chat-selection view and in the JSON/Markdown/HTML export formats, `[^2^]` in the text must link to the same URL that Kimi's live `.rag-tag` linked to — not to whatever happens to be at index `1` in `blocks[].search.webPages`.

---

## 5. Investigation Move 1 — Establish The Live Source Truth

**Question:** On the actual live Kimi page, what does the rag-tag for `[^2^]` point to? Is it consistent with what we see in blocks[].search.webPages[1]?

**Tool call (live browser tab evaluation):**

```javascript
// Get DOM state — source page rag-tag survey
(() => {
  const allParagraphs = [...document.querySelectorAll('.paragraph')];
  const target = allParagraphs.find(
    (el) => el.textContent?.includes('1940万部') && el.textContent?.includes('同比增长6%')
  );
  if (!target) return { found: false };
  const ragTags = [...target.querySelectorAll('.rag-tag')];
  return {
    found: true,
    ragTagCount: ragTags.length,
    ragTags: ragTags.map((el, index) => ({
      index: index + 1,
      siteName: el.getAttribute('data-site-name'),
    })),
  };
})()
```

**Result:** Found 1 rag-tag in the target paragraph. `siteName` was an automotive publication — not the position-0 item in the webPages array.

**Conclusion:** There is at least one citation on the source page that does not correspond to the first item in webPages. The DOM is proof that Kimi's source rendering does not use positional webPages ordering.

---

## 6. Investigation Move 2 — Inspect The Full Visible Citation Order vs API webPages

**Question:** For every rag-tag in this message block, what site name does the DOM show? Does that match `blocks[].search.webPages[index-1].siteName`?

**Tool call:**

```javascript
// Get all rag-tags in block container ordered by appearance
(() => {
  const paragraphs = [...document.querySelectorAll('.paragraph')];
  const container = paragraphs
    .find((el) => el.textContent?.includes('1940万部'))
    ?.closest('.block-item');
  if (!container) return { found: false };
  return {
    taggedParagraphs: [...container.querySelectorAll('.paragraph')]
      .filter((p) => p.querySelector('.rag-tag'))
      .map((p, idx) => ({
        order: idx + 1,
        text: p.textContent?.trim(),
        siteName: p.querySelector('.rag-tag')?.getAttribute('data-site-name') || null,
      })),
  };
})()
```

**Result:** The DOM showed citation 2 pointing to a specific Weixin article about yearly output. The `search.webPages` array in the API had 46+ entries. `webPages[1]` (index 1 = citation 2 positionally) was a completely different article — automotive industry macro overview, not the specific 1940万 article.

**This is the primary comparative evidence:** DOM order ≠ `webPages` order.

---

## 7. Investigation Move 3 — Call The Real API And Map Citations To webPages

**Question:** Can we directly verify that `[^2^]` in the text does not correspond to `webPages[1]`?

**Tool call (live API call from browser):**

```javascript
async () => {
  const chatId = location.pathname.split('/chat/')[1]?.split('?')[0];
  const token = localStorage.getItem('access_token');
  const headers = {
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
    'connect-protocol-version': '1',
    'x-msh-platform': 'web',
  };
  const msgsResp = await fetch('/apiv2/kimi.gateway.chat.v1.ChatService/ListMessages', {
    method: 'POST',
    headers,
    body: JSON.stringify({ chat_id: chatId, page_size: 100 }),
  });
  const msgsData = await msgsResp.json();
  const messages = msgsData.messages ?? [];
  const assistant = messages.find(
    (msg) => msg?.blocks?.some?.((b) => b?.text?.content?.includes?.('1940万部'))
  );
  const targetText = assistant.blocks
    .find((b) => b?.text?.content?.includes?.('1940万部'))
    .text.content;
  const markers = [...targetText.matchAll(/\[\^(\d+)\^\]/g)].map((m) => Number(m[1]));
  const pages = assistant.blocks.flatMap((b) => b?.search?.webPages || []);
  const mapped = markers.map((n) => ({
    citation: n,
    webPagesPositional: pages[n - 1]
      ? { title: pages[n - 1].title, url: pages[n - 1].url }
      : null,
  }));
  return { markers, mapped };
}
```

**Result:**

| `[^n^]` in text | `webPages[n-1].url` | Does it match the source DOM rag-tag? |
|---|---|---|
| `[^2^]` | `https://...eastmoney.com/1450558215` | **No.** DOM showed a Weixin article. |
| `[^8^]` | `https://...sinafin.../2025-08-14...` | **No.** Wrong article. |
| `[^14^]` | `https://...c114.net/...` | **No.** Completely different domain. |

**Conclusion:** `[^n^]` is definitively NOT a position in `blocks[].search.webPages`. Positional mapping is wrong.

---

## 8. Investigation Move 4 — Look For Hidden Fields In The Raw Payload

**Question:** Is there another citation-related structure in the raw message object that we are not currently using?

**Tool call:**

```javascript
// Scan the full raw message for any citation/ref/source related keys
async () => {
  // ...fetch same message...
  const json = JSON.stringify(assistant);
  const interestingPaths = [];
  const wantedKeys = /(citation|cite|reference|ref|source|footnote|rag)/i;
  const visit = (value, path) => {
    if (value && typeof value === 'object') {
      for (const [key, child] of Object.entries(value)) {
        const nextPath = path ? `${path}.${key}` : key;
        if (wantedKeys.test(key)) {
          interestingPaths.push({
            path: nextPath,
            type: Array.isArray(child) ? 'array' : typeof child,
            preview: Array.isArray(child) ? `array(${child.length})` : Object.keys(child ?? {}).slice(0, 5),
          });
        }
        visit(child, nextPath);
      }
    }
  };
  visit(assistant, 'assistant');
  return { assistantKeys: Object.keys(assistant), interestingPaths: interestingPaths.slice(0, 100) };
}
```

**Result — critical discovery:**

The raw assistant message had a top-level field called `refs`. This field was not inside `blocks`. It was a sibling:

```
assistant.refs.searchChunks   → array of 15 items
assistant.refs.usedSearchChunks → array of items
```

These were completely absent from every parser code path. The parser was reading `blocks[].search.webPages` and ignoring `refs.searchChunks` entirely.

---

## 9. Investigation Move 5 — Inspect `refs.searchChunks` Structure

**Question:** What does `refs.searchChunks` actually contain? Does each item have an `id` field?

**Tool call:**

```javascript
// Expand refs.searchChunks structures
async () => {
  // ...fetch same message...
  const refs = assistant.refs;
  return {
    refKeys: Object.keys(refs),
    searchChunksCount: refs.searchChunks?.length,
    searchChunksSample: refs.searchChunks?.slice(0, 5).map((chunk, idx) => ({
      idx: idx + 1,
      id: chunk.id,
      keys: Object.keys(chunk),
      title: chunk.base?.title,
      url: chunk.base?.url,
      siteName: chunk.base?.siteName,
    })),
  };
}
```

**Result:**

```json
{
  "searchChunksCount": 15,
  "searchChunksSample": [
    { "id": "2",  "title": "1940万辆...", "url": "http://mp.weixin.qq.com/s?__biz=MjM5OTAzMjc4MA==...", "siteName": "XX出行" },
    { "id": "8",  "title": "...",         "url": "http://mp.weixin.qq.com/s?__biz=MjM5MzAzNzE0MQ==...", "siteName": "..." },
    { "id": "14", "title": "...",         "url": "https://finance.sina.com.cn/...", "siteName": "新浪财经" }
  ]
}
```

**This is the proof.** `refs.searchChunks[0].id === "2"`. The `id` value IS the number seen in `[^2^]`. The URL in this item matches what the source DOM rag-tag showed. The `id` is not a position; it is an explicit reference identifier.

---

## 10. Investigation Move 6 — Cross-Matrix Verification Against The Three Problem URLs

**Question:** Are those three expected URLs truly in `refs.searchChunks` at the correct `id` positions, and are they completely absent from `webPages` at matching positions?

**Tool call:**

```javascript
// Direct URL lookup in both arrays
async () => {
  const wanted = [
    'http://mp.weixin.qq.com/s?__biz=MjM5OTAzMjc4MA==&mid=2650832122&idx=4&sn=7b9621d3f81fe49dab6033dc75ef56a4',
    'http://mp.weixin.qq.com/s?__biz=MjM5MzAzNzE0MQ==&mid=2651593570&idx=3&sn=af598b6ac802dc2b7f5f0fe3578b2e7a',
    'https://finance.sina.com.cn/stock/s/2025-08-15/doc-infkyrfp6642793.shtml...',
  ];
  const pages = assistant.blocks.flatMap((b) => b?.search?.webPages || []);
  const refs = assistant.refs.searchChunks;
  return {
    inWebPages: wanted.map((url) => {
      const idx = pages.findIndex((p) => p?.url === url);
      return { url, positionalIndex: idx + 1 || null };
    }),
    inRefs: wanted.map((url) => {
      const ref = refs.find((r) => r.base?.url === url);
      return { url, refId: ref?.id || null };
    }),
  };
}
```

**Result:**

| URL (shortened) | `webPages` position | `refs.searchChunks` id |
|---|---|---|
| Weixin 1940万 article | position **25** | id **`"2"`** |
| Weixin 6% growth article | position **46** | id **`"8"`** |
| Sina Finance article | position **45** | id **`"14"`** |

**This result is decisive.** The citation numbers `2`, `8`, `14` match exactly the `refs.searchChunks.id` values. They have nothing to do with the webPages array positions `25`, `46`, `45`.

Any code that maps `[^2^]` to `webPages[1]` produces a citation that is wrong by roughly 25 positions.

---

## 11. Investigation Move 7 — Confirm The Bug Was Already Live In Our Codebase, Not Just Hypothetically Possible

**Question:** Does the `kimi/parser.ts` currently consume `refs.searchChunks` at all?

**Action:** Search the full codebase for any usage of `refs.searchChunks`, `usedSearchChunks`, or `assistant.refs`.

**Result (`grep_search` across `services/`, `entrypoints/`, `models/`, `tests/`):**

```
No results found.
```

Zero references. The field was completely unknown to the parser. The codebase had never parsed it.

**And then the parser code confirmed the wrong path being used:**

```typescript
// services/platform-slices/kimi/parser.ts — before fix
const sources = block.search?.webPages?.map((wp) => ({
  title: wp.title,
  url: wp.url,
})) ?? [];

// citationMap was built positionally from sources:
citationMap = Object.fromEntries(
  sources.map((s, i) => [i + 1, { title: s.title, url: s.url }])
);
// ^ This maps [^1^] → sources[0], [^2^] → sources[1], etc.
// For Kimi, this is WRONG. [^2^] should map to refs.searchChunks where id === "2".
```

**Conclusion:** The first true distortion layer is `services/platform-slices/kimi/parser.ts`. Specifically: the `citationMap` construction. This layer chose the wrong field (`webPages` positional) instead of the authoritative field (`refs.searchChunks` by id). Every layer downstream — `resolveCitationMarkers()`, `renderSourcesList()`, markdown/HTML/JSON exports — faithfully propagated this wrong mapping.

---

## 12. Additional Verification — Previous "API Truncation" Hypothesis Was Also Wrong

A previous investigation attempt had flagged a Kimi message (`19aca167...`) where citation numbers like `77`, `78`, `100` appeared in text as a suspected API truncation (assuming only 14–20 sources could exist). This was re-examined now that `refs.searchChunks` was known.

**Tool call:**

```javascript
// Check message 19aca167: are [^77^], [^78^], [^100^] resolvable via refs.searchChunks.id?
async () => {
  const assistant = messages.find((msg) => msg?.id?.startsWith?.('19aca167'));
  const uniqueCitations = [...new Set(
    [... (assistant.blocks.filter(b => b?.text?.content)
         .map(b => b.text.content).join('\n'))
         .matchAll(/\[\^(\d+)\^\]/g)]
         .map(m => Number(m[1]))
  )].sort((a, b) => a - b);
  const refs = assistant.refs?.searchChunks ?? [];
  const unresolved = uniqueCitations.filter(
    (n) => !refs.some((r) => Number(r.id) === n)
  );
  return { uniqueCitations, citationCount: uniqueCitations.length, refsCount: refs.length, unresolved };
}
```

**Result:**

```json
{ "uniqueCitations": [77,78,79,82,84,86,89,90,91,92,97,100], "unresolved": [] }
```

Every citation in that message, including the ones with numbers like `77` and `100`, resolved perfectly against `refs.searchChunks`. The previous "API truncation" diagnosis was wrong. The numbers were never array positions. They were always `ref.id` values. The refs array for that message just happened to have 100+ entries with sparse IDs.

---

## 13. Root Cause — Stated Precisely

**Primary cause:** In `services/platform-slices/kimi/parser.ts`, the `citationMap` was built from `blocks[].search.webPages` using 1-based positional indexing (`i + 1`). This was incorrect for Kimi because `[^n^]` in Kimi text represents an explicit `refs.searchChunks.id`, not a positional offset into `webPages`.

**Secondary cause:** The parser was completely unaware that `message.refs.searchChunks` existed. It was a sibling field (not inside `blocks[]`) that had never been discovered until live API inspection.

**Downstream amplification:** `resolveCitationMarkers()` in chat-selection consumed the malformed `citationMap` without any ability to correct it — the renderer did exactly what it was told. The fix could only be at the parser, not the renderer.

---

## 14. Fix At The Correct Layer

**Location:** `services/platform-slices/kimi/parser.ts`

**What changed:**

```typescript
// After fix — parse refs at message level (not block level)
function parseKimiRefs(raw: Record<string, unknown>): KimiRefs | undefined {
  const searchChunks = getArray(raw.searchChunks)...;
  const usedSearchChunks = getArray(raw.usedSearchChunks)...;
  // ...
}

// citationMap built from refs.searchChunks by id, not webPages by position:
if (msg.refs?.searchChunks && msg.refs.searchChunks.length > 0) {
  citationMap = Object.fromEntries(
    msg.refs.searchChunks.map((chunk) => [
      Number(chunk.id),                          // ← the ref id, NOT i+1
      { title: chunk.base.title, url: chunk.base.url },
    ])
  );
} else if (sources.length > 0) {
  // fallback for messages without refs
  citationMap = Object.fromEntries(
    sources.map((s, i) => [i + 1, { title: s.title, url: s.url }])
  );
}
```

**Why the correct layer:**
- The parser is the only layer that has access to both the raw `blocks[].text.content` (with the `[^n^]` markers) and the raw `refs.searchChunks` (with the authoritative `id` → `url` mapping).
- No downstream layer can fix a malformed `citationMap` without re-accessing the raw API payload.

---

## 15. Regression Tests Added

```typescript
// tests/services/platform-slices/kimi-parser.test.ts

it('maps [^2^] to refs.searchChunks.id=2, not to webPages[1]', () => {
  const msg = buildKimiMessage({
    text: '...output[^2^]...',
    webPages: [{ url: 'https://wrong.com', title: 'Wrong' }],  // position 0
    searchChunks: [
      { id: '2', base: { url: 'https://correct.com', title: 'Correct' } },
    ],
  });
  const result = parseKimiMessages([msg], chatId);
  expect(result.messages[0].citationMap?.[2]?.url).toBe('https://correct.com');
});

it('resolves sparse citation ids like [^77^] without assuming dense 1..N range', () => {
  // validates that refs with id=77 can be found even without refs 1..76
});
```

---

## 16. Reusable Judgment Template From This Case

> **"This looks like the Kimi citation case."**
>
> Trigger: citation badges in exports show a number that looks reasonable, but the URL behind the badge is factually wrong or points to a different topic than the cited passage.
>
> First move: don't look at the renderer. Ask: does the visible marker number represent a **position** or an **identity**? Look for a sibling field in the raw payload (separate from the list being enumerated) that carries an explicit `id`.
>
> Core lesson: **when numbers appear in source data text, they may be semantic identifiers, not array indices.** Always verify which data structure the original source runtime uses to resolve those numbers. Then make the parser use the same structure.

---

## 17. Why Fixtures Would Not Have Caught This

The fixture `tests/fixtures/kimi/...` was built from a simplified Kimi response. That fixture happened to have the same number of `webPages` items as the citation markers were wide, making the positional mapping _appear_ correct by coincidence.

Only real production data — a live Kimi conversation with `[^2^]` mapping to `webPages[24]` — could expose the bug.

**Rule for this repository:** fixture tests validate that a known-correct implementation stays correct. They are not a substitute for real production payload inspection when hunting root causes.

---

## Appendix: Key Files

| File | Role |
|---|---|
| `services/platform-slices/kimi/parser.ts` | Where the fix was applied — `refs.searchChunks` parsing + `citationMap` by id |
| `services/platform-slices/kimi/index.ts` | M6 extraction — ListMessages endpoint definition |
| `entrypoints/chat-selection/rendering.ts` | `resolveCitationMarkers()` — correctly eliminated as non-cause |
| `models/chat.ts` | `ChatMessage.citationMap` type — updated comment to reflect id-not-position semantics |
| `tests/services/platform-slices/kimi-parser.test.ts` | Regression tests for ref-id → url mapping |
