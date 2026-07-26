# Example 04 — AI Studio Passive API Replay (Complete Walkthrough)

## Why This Example Exists

This example documents a complete Pattern B investigation: three parser bugs on Google AI Studio
conversations were diagnosed and fixed by replaying the `ResolveDriveResource` gRPC-web API from
inside the already-running logged-in Chrome tab, with no new UI actions required.

The transferable lessons are:
- How to compute the `SAPISIDHASH` authorization header from the page's session cookie
- How to navigate AI Studio's deeply nested positional-array response
- How to use field enumeration + bisection to find a classification bug in < 3 probe rounds
- Why `turn[16]` was a wrong thinking indicator and how `turn[19]` was discovered as the real one

## Bugs Being Investigated

| Bug ID | Symptom | Bug URL |
|--------|---------|---------|
| 1.1 | Image-model text prefix shown as thinking (hidden text) | `https://aistudio.google.com/u/1/prompts/1SuFmIWtJVpGIkmMaHY7c5hht9fXk4_kD` |
| 1.2 | Model-generated image (nano banana) not shown | Same URL |
| 2.1 | Mermaid diagram renders as broken image icon | `https://aistudio.google.com/prompts/1LwLa4fNUxgKFRVMkpPDSCDomtlXHDgYz` |

Bug 2.1 turned out to be a renderer bug (not API), so Pattern B only applied to Bugs 1.1 and 1.2.

## Source Truth vs Target Truth

| | Bug 1.1 | Bug 1.2 |
|---|---|---|
| **Source truth** | Page shows "好的，这是一个 TCP/IP 通信的架构图。\n\n" as visible text | Page shows the generated PNG image |
| **Target truth** | Extension hides this text (shows thinking indicator) | Extension shows nothing for this turn |
| **Chain location** | Parser misclassification at `isThinking` condition | Parser did not read `turn[12]` |

## Auth Reconstruction: AI Studio

AI Studio rejects requests that lack a valid `Authorization: SAPISIDHASH …` header. The header
is not a static API key — it is computed per-request using a SHA-1 hash of:

```text
"<unix_timestamp> <SAPISID_cookie_value> <page_origin>"
```

The `x-goog-authuser` header must also match the `/u/N/` path segment. If the URL is
`/u/1/prompts/…`, the header must be `x-goog-authuser: 1`. A mismatch causes HTTP 403.

Complete auth snippet (run inside `evaluate_script`):

```javascript
async function buildAiStudioHeaders() {
  function getCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|;)\\s*' + name + '\\s*=\\s*([^;]+)'));
    return m ? decodeURIComponent(m[1]) : '';
  }
  const sapisid = getCookie('SAPISID') || getCookie('__Secure-3PAPISID');
  const ts = Math.floor(Date.now() / 1000);
  const msg = new TextEncoder().encode(`${ts} ${sapisid} https://aistudio.google.com`);
  const hashBuf = await crypto.subtle.digest('SHA-1', msg);
  const hex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  const authorization = `SAPISIDHASH ${ts}_${hex} SAPISID1PHASH ${ts}_${hex} SAPISID3PHASH ${ts}_${hex}`;

  const auMatch = window.location.pathname.match(/\/u\/(\d+)\//);
  const authuser = auMatch ? auMatch[1] : '0';

  return { authorization, 'x-goog-authuser': authuser };
}
```

## API Endpoint

```text
POST https://alkalimakersuite-pa.clients6.google.com/$rpc/google.internal.alkali.applications.makersuite.v1.MakerSuiteService/ResolveDriveResource

Content-Type: application/json+protobuf
x-goog-api-key: AIzaSyDdP816MREB3SkjZO04QXbjsigfcI0GWOs
x-user-agent: grpc-web-javascript/0.1

Body: JSON.stringify(['<fileId>'])
```

The `fileId` comes from the URL:
- `/prompts/<fileId>` → no authuser prefix
- `/u/N/prompts/<fileId>` → authuser N

## Replay Script (Production-Ready)

```javascript
async () => {
  function getCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|;)\\s*' + name + '\\s*=\\s*([^;]+)'));
    return m ? decodeURIComponent(m[1]) : '';
  }
  const sapisid = getCookie('SAPISID') || getCookie('__Secure-3PAPISID');
  const ts = Math.floor(Date.now() / 1000);
  const msg = new TextEncoder().encode(`${ts} ${sapisid} https://aistudio.google.com`);
  const hashBuf = await crypto.subtle.digest('SHA-1', msg);
  const hex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  const authorization = `SAPISIDHASH ${ts}_${hex} SAPISID1PHASH ${ts}_${hex} SAPISID3PHASH ${ts}_${hex}`;
  const auMatch = window.location.pathname.match(/\/u\/(\d+)\//);
  const authuser = auMatch ? auMatch[1] : '0';
  const fileId = window.location.pathname.match(/\/prompts\/([^/?]+)/)?.[1];
  if (!fileId) return { error: 'no fileId in URL' };

  const response = await fetch(
    'https://alkalimakersuite-pa.clients6.google.com/$rpc/google.internal.alkali.applications.makersuite.v1.MakerSuiteService/ResolveDriveResource',
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'content-type': 'application/json+protobuf',
        authorization,
        'x-goog-api-key': 'AIzaSyDdP816MREB3SkjZO04QXbjsigfcI0GWOs',
        'x-user-agent': 'grpc-web-javascript/0.1',
        'x-goog-authuser': authuser,
      },
      body: JSON.stringify([fileId]),
    }
  );
  const data = await response.json();
  const prompt = data[0];

  // Find the turns array: scan backwards for a nested structure like [[turns], ...]
  let turnsData = null;
  for (let i = prompt.length - 1; i >= 0; i--) {
    const c = prompt[i];
    if (!Array.isArray(c) || c.length < 1 || !Array.isArray(c[0])) continue;
    const inner = c[0];
    if (inner.length === 0 || Array.isArray(inner[0])) { turnsData = c; break; }
  }
  if (!turnsData) return { error: 'could not locate turns in response' };

  const turns = turnsData[0];
  return {
    turnCount: turns.length,
    turns: turns.map((t, idx) => ({
      idx,
      role: t[8],
      t16: t[16],
      t19: t[19],
      t25: t[25],
      textSnippet: typeof t[0] === 'string' ? t[0].slice(0, 60) : null,
      hasT12: t[12] !== null && t[12] !== undefined,
      t12mimeType: Array.isArray(t[12]) ? t[12][0] : null,
    })),
  };
}
```

## What The Probe Returned

### Bug URL (image model, gemini-2.5-flash-image)

```json
{
  "turnCount": 3,
  "turns": [
    { "idx": 0, "role": "user",  "t16": null, "t19": null, "t25": null, "textSnippet": "给我画一个 TCP IP 通信的架构图。" },
    { "idx": 1, "role": "model", "t16": null, "t19": null, "t25": null, "textSnippet": "好的，这是一个 TCP/IP 通信的架构图。", "hasT12": false },
    { "idx": 2, "role": "model", "t16": 1,    "t19": null, "t25": null, "textSnippet": null, "hasT12": true, "t12mimeType": "image/png" }
  ]
}
```

### Thinking URL (mermaid, Gemini 3.1 Pro Preview)

```json
{
  "turns": [
    { "idx": 0, "role": "user",  "t16": null, "t19": null, "t25": null },
    { "idx": 1, "role": "model", "t16": null, "t19": 1,    "t25": null, "textSnippet": "**Defining the Goal**..." },
    { "idx": 2, "role": "model", "t16": 1,    "t19": null, "t25": null, "textSnippet": "好的！这是一个..." }
  ]
}
```

## Bisection: Finding The Real Thinking Field

| Turn | Role | t[16] | t[19] | t[25] | Correct classification | Old parser result |
|------|------|-------|-------|-------|------------------------|-------------------|
| Image-text (idx 1) | model | null  | null  | null  | text                   | **thinking** ← BUG |
| Thinking (idx 1, mermaid URL) | model | null | **1** | null | thinking | would be text with old code |
| Response (idx 2) | model | 1 | null | null | text | text ✓ |
| Explicit thinking (old platform) | model | any | null | **-1** | thinking | thinking ✓ |

Old condition: `isThinking = role === 'model' && (turn[25] === -1 || turn[16] !== 1)`

- Image-text turn: `t[16]=null` → `null !== 1` is `true` → **fires → BUG**

New condition: `isThinking = role === 'model' && (turn[25] === -1 || turn[19] === 1)`

- Image-text turn: `t[19]=null` → `null === 1` is `false` → **does not fire → CORRECT**
- Auto-mode thinking turn: `t[19]=1` → `1 === 1` is `true` → **fires → CORRECT**

## Bug 1.2: Model-Generated Image In turn[12]

The image model response (idx 2) had `hasT12: true` and `t12mimeType: "image/png"`. The old parser never read `turn[12]`. It only read `turn[0]` (text) and `turn[1]` (user Drive file refs).

Fix: Check `turn[12]` for `[mimeType: string, base64: string]` shape and emit an `image` part with `url: "data:image/png;base64,<base64>"`.

## False Leads Eliminated

| Candidate | Why It Was Wrong |
|-----------|-----------------|
| `turn[16] !== 1` as thinking marker | Fires on image-model text turns where `t[16]` is null |
| Checking `turn[0] === null` | Image turn has null t[0], but so can malformed text turns |
| Response ordering alone | Two consecutive model turns with different semantics; order is insufficient |

## Regression Tests Written

1. `'Auto-mode thinking (turn[19]=1) is classified as thinking, not text'` — fixture sets `t[8]='model', t[19]=1`
2. `'image-model text prefix (t16=null, t19=null) is text, not thinking'` — fixture sets `t[8]='model', t[16]=null, t[19]=null`
3. `'model-generated inline image (turn[12]=[mime,base64]) produces image part'` — fixture sets `t[12]=['image/png','<base64>']`

## Transferable Lessons

1. **Never use a field's absence as a classification trigger.** `t[16] !== 1` is true for both null and for any non-1 value, which is a much larger set than intended.
2. **Always probe two or more representative turns in the same call.** Probing only the bug turn misses the bisection comparison.
3. **SAPISIDHASH must be recomputed per request.** It contains a Unix timestamp. A cached authorization header from a prior session will be rejected.
4. **`x-goog-authuser` must match the URL path segment.** Even if you are authenticated, a mismatch causes 403. Always extract it dynamically from `window.location.pathname`.
5. **Positional array fields shift between models.** `turn[12]` held an image for the image model but was null for text models. Do not assume any positional field has a single universal type.
