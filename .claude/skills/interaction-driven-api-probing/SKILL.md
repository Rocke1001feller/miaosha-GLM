---
name: interaction-driven-api-probing
description: "Use when actively probing dynamic web apps by changing page state, switching models, sending probe messages, refreshing pages, creating records/pages/databases, or mapping UI interactions to backend API requests/responses with Chrome DevTools MCP and an already-running logged-in Chrome instance. Also use for passive API replay and parser forensics: replaying the page-load API with reconstructed auth to inspect raw response fields and fix parsing bugs. Trigger phrases: active probing, 主动探查, passive replay, 被动回放, send probe message, switch model, refresh page, map UI action to API, dynamic content API, Notion CRUD probing, request/response correlation, parser forensics, 解析 bug, auth reconstruction, SAPISIDHASH, thinking misclassification, field bisection, Notion image broken, 图片显示异常, 上传到 Notion 图片 404, getUploadFileUrl bucket secure record field, attachment:UUID:filename, two-phase upload, post-import block patch, loadPageChunk block ID discovery."
---

# Interaction-Driven API Probing & Passive API Replay

## Description

Use this skill when the task is not just to inspect a page, but to **actively change the page** so the application reveals which backend API actually powers the behavior.

Typical tasks:

- determine which model ID is sent when an AI site switches models
- send probe messages and map each message to request/response payloads
- refresh or reopen a page to separate persisted API truth from ephemeral UI state
- discover which API creates a Notion page, creates a database, inserts rows, edits fields, or moves blocks
- prove whether a visible UI state is historical truth, current state, cached state, or merely a display label
- build a durable parser/extractor after observing real request/response traffic

The central idea is:

```text
controlled UI action -> network request(s) -> response/store/DOM change -> durable protocol understanding
```

This skill is deliberately more aggressive than passive debugging. It authorizes controlled interaction **only after explicit user permission and safety bounds** are clear.

---

## Pattern Map

Choose your pattern before starting. Both require the already-running logged-in Chrome instance.

| | **Pattern A: Interaction-Driven** | **Pattern B: Passive API Replay** |
|---|---|---|
| **When** | You don't know which API powers a behavior | You know the API but have a parsing bug or field-level misread |
| **Goal** | Discover endpoint + full request/response semantics | Re-fire the data-loading API; inspect the raw response |
| **Action required** | UI actions: send, click, switch, create | None — re-fire the page-load call from `evaluate_script` |
| **Auth complexity** | Inherited from logged-in session | Must be explicitly reconstructed per platform |
| **Data mutation risk** | Yes — sends messages, creates records | Read-only; no side effects |
| **Typical use** | New platform discovery, model switch investigation | Fix thinking misclassification, missing image, wrong field mapping |
| **Worked examples** | Examples 01-03, 08-09 | Examples 04-07 |

Both patterns build toward the same deliverable: a protocol dossier, a parser/extractor fix, and regression fixtures.

---

## Core Principle

Modern web apps hide source truth behind dynamic state. You often cannot learn the backend protocol by reading initial HTML or historical API responses alone.

The correct move is to create a small, uniquely identifiable action and watch what the app sends.

```text
prepare capture
  -> perform one intentional UI action
    -> capture all request bodies, response bodies, headers, timestamps, and page mutations
      -> correlate action nonce to backend payload
        -> repeat with one changed variable
          -> infer stable protocol fields
```

For model switching, the changed variable is usually `model`.
For Notion-like CRUD, the changed variable may be page title, property value, block type, parent ID, database schema, or inserted row content.

---

## Hard Safety Rules

This skill often mutates real accounts. Before sending messages, creating pages, inserting records, deleting anything, changing settings, or refreshing a live workflow, verify all of these:

1. The user has explicitly authorized the mutation class.
2. The target workspace/account/page/thread is correct.
3. Probe content is harmless, low-cost, and clearly identifiable.
4. Destructive actions are avoided unless the user explicitly asks for them.
5. For business tools like Notion, create a scratch page/database when possible.
6. Record enough evidence to clean up probe artifacts later if cleanup is requested.

Good probe content examples:

- `probe-model-gpt41-20260425-001: 1+1?`
- `probe-create-page-20260425-001`
- `probe-row-status-alpha-20260425-001`

Bad probe content examples:

- ambiguous text like `test`
- large prompts that consume quota unnecessarily
- real customer data
- destructive CRUD actions before the API contract is understood

---

## Mandatory Dimensions

Think across these dimensions before declaring the probe complete.

| Dimension | Question | Example |
|---|---|---|
| User action | What exact UI action is being mapped? | switch Copilot model, click Notion New page |
| Variable under test | What one thing changes between probes? | model picker value, database property value |
| Probe nonce | How will the action be uniquely found in payloads? | `probe-kimi-thinking-001` |
| Browser session | Are we using the logged-in, already-running Chrome instance? | required for GitHub, Kimi, Notion |
| Capture timing | Was interception installed before the action? | install before send/click/refresh |
| Request truth | Which request body contains the semantic field? | Copilot `body.model` |
| Response truth | Which response confirms persistence or created IDs? | Notion transaction result |
| UI/store truth | Does DOM/state match backend payload? | selected model may only be current state |
| Persistence truth | Does refresh/reopen preserve the result? | page exists after reload |
| Auth/runtime dependency | Does replay need cookies, bearer token, CSRF, nonce, build label, workspace ID? | Notion transaction API headers |
| Generalization | Which fields are invariant vs site-specific? | parent ID, block ID, model ID, schema ID |
| Cleanup | Do probe artifacts need removal? | scratch rows/pages |

---

## Mandatory Layers

Work through these layers in order.

| Layer | What To Establish |
|---|---|
| L0. Permission boundary | What mutations are allowed? Are probe messages/CRUD writes authorized? |
| L1. Target surface | Which exact tab, page, workspace, conversation, database, or account? |
| L2. Probe matrix | Which controlled actions and variables will be tested? |
| L3. Capture setup | DevTools Network plus MAIN-world fetch/XHR interceptor installed before action |
| L4. UI action execution | Click/type/send/refresh/switch model/create row, one action at a time |
| L5. Network capture | Request URL, method, headers, request body, response body, status, timing |
| L6. Correlation | Match nonce/action to request and response; eliminate unrelated background calls |
| L7. Persistence check | Refresh/reopen/refetch to identify durable truth vs transient UI state |
| L8. Protocol model | Document endpoint topology, auth, IDs, field semantics, ordering, pagination |
| L9. Implementation boundary | Decide parser/extractor/storage/API client changes from source truth |
| L10. Regression evidence | Save fixtures/tests/dossier examples using real payload-derived facts |

---

## Standard Operating Procedure

### Step 1. Define The Probe Contract

Write a compact probe table before touching the page.

```markdown
| Probe | UI Action | Unique Input | Expected Network Difference | Cleanup |
|---|---|---|---|---|
| P1 | select GPT-4.1 + send | probe-copilot-gpt41-001 | request body model changes | keep/delete thread |
| P2 | select Claude + send | probe-copilot-claude-001 | request body model changes | keep/delete thread |
| P3 | refresh page | none | persisted messages reload | none |
```

For Notion-like CRUD:

```markdown
| Probe | UI Action | Unique Input | Expected Network Difference | Cleanup |
|---|---|---|---|---|
| P1 | create page | probe-page-20260425-001 | transaction creates block/page ID | delete page |
| P2 | create database | probe-db-20260425-001 | schema/collection payload appears | delete DB |
| P3 | insert row | probe-row-alpha | row/page under collection appears | delete row |
```

### Step 2. Attach To The Already-Running Chrome Instance

Use Chrome DevTools MCP against the user's existing logged-in browser session whenever auth/session state matters.

Preferred order:

1. list/select existing pages
2. navigate only when needed
3. snapshot before each interaction
4. install capture before sending/clicking
5. use Network request listing and request-detail tools when available
6. use `evaluate_script` as the fallback for request interception or state inspection

Avoid launching a fresh clean browser profile when the task depends on logged-in GitHub/Kimi/Notion state.

### Step 3. Install A Capture Harness Before The Action

Capture both request and response. Response-only capture is not enough for many dynamic apps.

Use this MAIN-world probe shape and adapt the URL predicate:

```javascript
() => {
  if (window.__activeApiProbe?.active) return 'already active';

  const state = window.__activeApiProbe = {
    active: true,
    captures: [],
  };

  const originalFetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const input = args[0];
    const init = args[1] || {};
    const url = input instanceof Request ? input.url : String(input);
    const method = (init.method || (input instanceof Request ? input.method : 'GET') || 'GET').toUpperCase();
    const shouldCapture = /api|graphql|rpc|transaction|conversation|message|thread|block|collection/i.test(url);

    let requestText = null;
    if (shouldCapture) {
      try {
        if (typeof init.body === 'string') requestText = init.body;
        else if (input instanceof Request) requestText = await input.clone().text();
      } catch {}
    }

    const response = await originalFetch(...args);

    if (shouldCapture) {
      let responseText = null;
      try { responseText = await response.clone().text(); } catch {}
      state.captures.push({
        ts: Date.now(),
        url,
        method,
        status: response.status,
        requestText,
        responseText,
      });
    }

    return response;
  };

  return 'active api probe installed';
}
```

Also patch XHR if the site uses it. For gRPC-web or Connect protocols, capture raw body text/bytes and decode framing separately.

### Step 4. Execute One Action At A Time

Do not batch actions until you know the API shape.

For each action:

1. take a snapshot
2. click/select/type exactly one variable change
3. send or commit
4. read captured requests
5. identify the probe nonce
6. write down the exact endpoint and field changes

If the action mutates data, prefer a fresh scratch page/thread/database and unique probe labels.

### Step 5. Correlate Action To Backend Payload

Use multiple anchors, not just URL names.

Strong correlation anchors:

- probe nonce appears in request body
- model/field/property value changes exactly when UI value changes
- response contains created/updated ID
- refresh/reopen fetch returns the same ID/value
- timestamps match the action order
- repeated probe with one variable changed changes only the expected field

Weak anchors:

- endpoint name sounds right
- request occurs near the click but contains no nonce
- DOM changed but no response was inspected
- current UI value is used as historical truth

### Step 6. Refresh And Reopen To Separate Truth Classes

Always classify the evidence:

| Truth Class | Meaning | How To Test |
|---|---|---|
| Request-time truth | true for one action at send/click time | outbound request body |
| Response-time truth | accepted by backend | response body/status |
| Persisted truth | survives reload/reopen | refresh and refetch |
| Current UI truth | current selector/store only | DOM after later interactions |
| Derived display truth | human label, not ID | model picker text |

The Copilot model incident exists because current UI truth was mistaken for request-time truth.

### Step 7. Produce A Protocol Dossier

The result of the probe should be a short, reusable protocol dossier:

```markdown
## Protocol Dossier: <site/action>

### Action Matrix
| Action | Endpoint | Method | Request Truth | Response Truth | Persisted Check |
|---|---|---|---|---|---|

### Auth And Runtime Dependencies
- Cookie:
- Bearer token:
- CSRF/nonce:
- Workspace/page/thread IDs:

### Field Semantics
- `model`: request-time model ID, not returned by history GET
- `parentId`: destination parent block/page/database
- `schema`: database property definition

### Replay/Implementation Notes
- M1 needed for request-time truth:
- M6 enough for persisted truth:
- Cannot recover after refresh without:

### Regression Fixtures
- request fixture:
- response fixture:
- parsed output fixture:
```

---

## Generalizing To Notion And Other CRUD Apps

Notion is not special. It is a dynamic CRUD app where meaningful backend actions are often hidden behind batched transaction APIs.

Apply the same probe model:

```text
create page UI action
  -> capture transaction/request body
    -> identify parent/page/block IDs
      -> inspect response IDs
        -> refresh/reopen
          -> verify persisted block/page/database state
```

For Notion-like apps, add these dimensions:

| CRUD Operation | Probe Variable | Expected Backend Truth |
|---|---|---|
| Create page | unique title | new page/block ID, parent ID, title property |
| Create database | unique DB title + one property | collection/schema payload, view payload |
| Insert row | unique row title/status | row page ID under collection/database |
| Edit property | unique property value | property ID/value update operation |
| Add block under page | unique block text | parent page ID + block type/content |
| Move/reorder | known source/target positions | transaction with before/after ordering |

To make the skill work on other computers:

1. depend on real Chrome session state, not hardcoded tokens
2. use user-created scratch workspaces/pages when possible
3. use unique nonces so payloads can be found across different UIs/languages
4. document endpoint family and field semantics instead of brittle CSS selectors
5. record how to recover auth/runtime IDs from the page or network panel
6. include refresh/reopen verification so transient UI state is not mistaken for persisted truth
7. convert findings into fixtures/tests or an API client only after real protocol evidence exists

---

## Required Output Shape

When using this skill, report the investigation in this shape:

1. **Permission And Scope** — what mutations were authorized and where they happened
2. **Probe Matrix** — each action, nonce, variable, and expected difference
3. **Capture Setup** — DevTools page, interceptor, filters, refresh strategy
4. **Action-To-API Map** — UI action -> endpoint -> request fields -> response fields
5. **Truth Classification** — request-time, response-time, persisted, current UI, display label
6. **Eliminated False Sources** — fields/DOM states that looked plausible but were wrong
7. **Protocol Dossier** — stable endpoint/auth/field semantics
8. **Implementation Boundary** — where code should capture/parse/store the truth
9. **Regression Protection** — fixtures/tests/manual repro matrix
10. **Residual Risk** — what cannot be recovered without live capture or user permission

---

## Pattern B: Passive API Replay (Parser Forensics Mode)

Use this pattern when:
- A specific conversation URL shows a bug in the extension (wrong content, missing image, text shown as thinking)
- The data was already served by the API when the user loaded the page
- You want to inspect the raw API response without performing any new user actions
- The bug is a **parsing or normalization error** in an already-known platform slice

### Pattern B SOP

#### B1. Identify The Bug Turn

Before touching Chrome, establish:
- Which turn is misclassified (role, approximate content, position in conversation)?
- What does the extension show vs what should it show?
- What parser file handles this platform?

Write these down. This is your source-truth vs target-truth statement.

#### B2. Connect To The Bug Page

Use Chrome DevTools MCP `select_page` or `navigate_page` to reach the specific conversation URL in the already-running logged-in Chrome.

Never launch a fresh browser for parser forensics. A fresh session will not have the cookies required for auth.

#### B3. Reconstruct Auth And Replay The Data-Loading API

Use `evaluate_script` to fire the platform's data-loading API call. Adapt the recipe for this platform (see **Auth Extraction Recipes** below).

All replay scripts share this shape:

```javascript
async () => {
  // 1. Extract conversation / thread ID from current URL
  const urlMatch = window.location.href.match(/<PLATFORM_ID_REGEX>/);
  const id = urlMatch?.[1];
  if (!id) return { error: 'could not extract id from URL: ' + window.location.href };

  // 2. Build auth headers (platform-specific — see Auth Extraction Recipes)
  const headers = await buildAuthHeaders();

  // 3. Fire the API call with the live session credentials
  const response = await fetch(<ENDPOINT_URL>, {
    method: '<GET|POST>',
    credentials: 'include',
    headers: { ...headers },
    body: <NULL_OR_JSON_OR_PROTOBUF>,
  });
  if (!response.ok) return { error: `HTTP ${response.status}` };
  const data = await response.json();

  // 4. Return targeted inspection only — never dump the full response
  return inspectRelevantFields(data);
}
```

#### B4. Field Enumeration For Unknown Structures

When a platform uses positional arrays (AI Studio, Gemini), the field semantics must be reverse-engineered. Use this enumeration utility:

```javascript
function enumFields(arr) {
  return arr.map((v, i) => ({
    i,
    type: Array.isArray(v) ? 'array' : typeof v,
    len: Array.isArray(v) ? v.length : undefined,
    val: v === null ? 'null' : JSON.stringify(v)?.slice(0, 140),
  })).filter(x => x.val !== 'null' && x.val !== undefined);
}
```

Apply to **one turn at a time**. Never enumerate the full response in a single call.

Return shape to use in `evaluate_script`:
```javascript
return turns.map((t, idx) => ({
  idx,
  role: t[8],                    // or whichever positional index holds role
  nonNullFields: enumFields(t),
}));
```

#### B5. Bisect Good Turn vs Bug Turn

This is the core forensic step. Compare fields of a correctly-displayed turn against the bug turn:

1. Find a turn that the extension displays correctly
2. Find the bug turn
3. Run `enumFields()` on both in the same `evaluate_script` call
4. The **field that differs** between the two turns is the likely classification driver
5. Cross-reference with the parser code to confirm the exact condition

**Real example** (AI Studio session, 2026-04-26): Text prefix turn of image model showed as thinking.

```text
Good turn (text, t[16]=1, t[19]=null)  →  fields: {i:0,val:"好的..."}, {i:8,val:"model"}, {i:16,val:1}
Bug  turn (text, t[16]=null, t[19]=null) →  fields: {i:0,val:"好的..."}, {i:8,val:"model"}  ← no t[16]
Known thinking turn (t[19]=1)           →  fields: {i:0,val:"...**Examining**..."}, {i:8,val:"model"}, {i:19,val:1}
```

Bisection revealed: `t[16] !== 1` was the old thinking condition, and it fired falsely on image-model text turns where `t[16]` is null. The real thinking marker is `t[19] === 1`.

#### B6. Map Finding To Parser And Write Regression Test

Once you have the field-level truth:
1. Locate the exact condition in the parser that reads this field
2. Write a narrow patch with a comment citing the evidence (page URL, session date)
3. Write a regression test whose fixture sets the newly-discovered field
4. Run `npm run compile && npm test && npm run build`

---

## Auth Extraction Recipes

Paste these inside the `evaluate_script` body. Each recipe runs inside the page's MAIN world and therefore has access to `document.cookie`, `window`, and `localStorage`.

### Recipe 1 — Cookie-Only (Grok, Perplexity, ChatGPT, Claude, Kimi, DeepSeek)

No computation needed. `credentials: 'include'` sends the session cookie automatically.

```javascript
// No helper needed — just use credentials: 'include' in the fetch call.
// Some platforms require additional static headers (see Platform Protocol Reference).
const response = await fetch(apiUrl, {
  method: 'GET',
  credentials: 'include',
  headers: { 'accept': 'application/json' },
});
```

### Recipe 2 — SAPISIDHASH (AI Studio, Gemini, any Google API)

Google APIs reject requests that lack a computed `Authorization: SAPISIDHASH …` header. The hash is derived from the `SAPISID` (or `__Secure-3PAPISID`) cookie, a Unix timestamp, and the page origin.

```javascript
async function buildSapisidhash(origin) {
  function getCookie(name) {
    const m = document.cookie.match(new RegExp('(?:^|;)\\s*' + name + '\\s*=\\s*([^;]+)'));
    return m ? decodeURIComponent(m[1]) : '';
  }
  const sapisid = getCookie('SAPISID') || getCookie('__Secure-3PAPISID');
  if (!sapisid) return null;   // not logged in
  const ts = Math.floor(Date.now() / 1000);
  const msg = new TextEncoder().encode(`${ts} ${sapisid} ${origin}`);
  const hashBuf = await crypto.subtle.digest('SHA-1', msg);
  const hex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
  return `SAPISIDHASH ${ts}_${hex} SAPISID1PHASH ${ts}_${hex} SAPISID3PHASH ${ts}_${hex}`;
}
```

AI Studio additionally requires `x-goog-authuser` matching the `/u/N/` URL path segment:

```javascript
const auMatch = window.location.pathname.match(/\/u\/(\d+)\//);
const authuser = auMatch ? auMatch[1] : '0';
// Include in headers: { 'x-goog-authuser': authuser }
```

**Critical**: mismatch between the `x-goog-authuser` header and the URL path digit causes HTTP 403 even with valid SAPISIDHASH.

### Recipe 3 — Bootstrap Tokens From Inline Scripts (Gemini batchexecute)

Gemini embeds session tokens in inline `<script>` tags. These tokens expire per page load.

```javascript
function extractBootstrapToken(varName) {
  for (const script of document.querySelectorAll('script')) {
    const text = script.textContent || '';
    // Matches: varName:"value", 'varName':'value', _varName_='value', etc.
    const m = text.match(new RegExp('[\'"]?' + varName + '[\'"]?\\s*[:=]\\s*[\'"]([^\'"]+)[\'"]'));
    if (m) return m[1];
  }
  return null;
}

const at  = extractBootstrapToken('SNlM0e');  // request nonce / at token
const bl  = extractBootstrapToken('cfb2h');   // build label
const sid = extractBootstrapToken('FdrFJe');  // f.sid (session ID)
```

Extract and use in the **same** `evaluate_script` call. Tokens fetched in one call and used in a later call may be expired.

### Recipe 4 — Bearer Token From localStorage or Meta Tag (varies by platform)

Some platforms store a bearer token in `localStorage`:

```javascript
const token = localStorage.getItem('token')
  || localStorage.getItem('accessToken')
  || localStorage.getItem('auth_token');
// Then: headers: { 'Authorization': `Bearer ${token}` }
```

Others embed it in a `<meta>` tag:

```javascript
const token = document.querySelector('meta[name="user-token"]')?.content;
```

Check the Network panel first to see what the `Authorization` header looks like on a live request.

---

## Platform Protocol Reference

Quick reference for passive API replay on all platforms in this repository. Use the correct recipe and endpoint before writing your `evaluate_script` call.

| Platform | Auth Recipe | Protocol | Primary Data Endpoint | Key Notes |
|---|---|---|---|---|
| **AI Studio** | Recipe 2 (SAPISIDHASH) + `x-goog-authuser` | gRPC-web, JSON body | `POST /MakerSuiteService/ResolveDriveResource` | File ID from URL `/prompts/<fileId>` or `/u/N/prompts/<fileId>`; response is nested positional arrays |
| **Gemini** | Recipe 2 + Recipe 3 (bootstrap tokens) | batchexecute POST | `POST https://gemini.google.com/_/BardChatUi/data/batchexecute` | Requires `SNlM0e`, `cfb2h`, `FdrFJe`; extract and use in same call |
| **Grok** | Recipe 1 (cookie) | REST JSON | 3 calls: `GET conversations_v2/{id}`, `GET response-node?includeThreads=true`, `POST load-responses` | `rid` URL param selects active branch; `load-responses` POST body needs `responseIds` from response-node |
| **Perplexity** | Recipe 1 + x-app headers | REST JSON | `GET /rest/thread/{slug}?with_schematized_response=true&version=2.18&…` | `slug` = UUID from URL path; Cloudflare Turnstile on freshly-opened tabs; use existing logged-in tab |
| **ChatGPT** | Recipe 1 (cookie) | REST JSON | `GET /backend-api/conversation/{id}` | If cookies alone fail, check Recipe 4 for bearer in localStorage |
| **Claude** | Recipe 1 (cookie) | REST JSON | `GET /api/organizations/{orgId}/chat_conversations/{id}/with_messages_and_meta` | `orgId` obtained from `/api/auth/session` or any prior request |
| **GitHub Copilot** | Recipe 1 (cookie) | REST JSON | `GET /github/chat/threads/{id}/messages` | Per-message model IS NOT in the history response; must be captured at send-time via Pattern A |
| **Kimi** | Recipe 1 (cookie) | Connect/JSON (framed) | `GET /apiv2/chat/{id}` | Response body uses Connect framing; JSON payload starts after first 5 bytes |
| **DeepSeek** | Recipe 1 (cookie) | REST JSON | Check `services/platform-slices/deepseek/index.ts` | — |
| **Microsoft Copilot** | Recipe 1 (cookie) | REST JSON | Check `services/platform-slices/microsoft-copilot/` | — |

### Grok Three-Call Replay (Expanded)

Grok requires three sequential calls because conversation data is split across endpoints:

```javascript
async () => {
  // Step 1: Get conversation shell + available response IDs
  const convId = window.location.href.match(/\/c\/([0-9a-f-]+)/)?.[1];
  const rid = new URLSearchParams(window.location.search).get('rid');
  if (!convId) return { error: 'no conversationId in URL' };

  const shellRes = await fetch(
    `https://grok.com/rest/app-chat/conversations_v2/${convId}?includeWorkspaces=true&includeTaskResult=true`,
    { credentials: 'include' }
  );
  const shell = await shellRes.json();

  // Step 2: Get branch topology to find the active responseIds
  const nodeRes = await fetch(
    `https://grok.com/rest/app-chat/conversations/${convId}/response-node?includeThreads=true`,
    { credentials: 'include' }
  );
  const nodeData = await nodeRes.json();
  const nodes = nodeData?.responseNode?.responseNodes ?? [];

  // Step 3: Load the actual message bodies for the active branch
  // Use 'rid' from URL to select branch; fallback to all leaf nodes
  const responseIds = rid
    ? buildBranchPath(nodes, rid)
    : nodes.map(n => n.responseId);

  const loadRes = await fetch(
    `https://grok.com/rest/app-chat/conversations/${convId}/load-responses`,
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ responseIds }),
    }
  );
  const loadData = await loadRes.json();
  const responses = loadData?.responses ?? [];

  // Inspect: enumerate fields of the first few assistant responses
  return responses.slice(0, 4).map(r => ({
    responseId: r.responseId,
    sender: r.sender,
    messageLen: r.message?.length,
    hasSteps: Array.isArray(r.steps) && r.steps.length > 0,
    thinkingStartTime: r.thinkingStartTime ?? null,
    thinkingEndTime: r.thinkingEndTime ?? null,
    // Add more fields as you discover the bug
  }));
}
```

### Perplexity Thread Replay (Expanded)

```javascript
async () => {
  const slug = window.location.href.match(/\/search\/([0-9a-f-]+)/)?.[1];
  if (!slug) return { error: 'no thread slug in URL' };

  const params = new URLSearchParams({
    with_parent_info: 'true',
    with_schematized_response: 'true',
    version: '2.18',
    source: 'default',
    limit: '10',
    offset: '0',
    from_first: 'true',
  });
  // Add all supported_block_use_cases (copy from parser.ts PERPLEXITY_SUPPORTED_BLOCK_USE_CASES)
  for (const uc of ['answer_modes','media_items','inline_images','unified_assets']) {
    params.append('supported_block_use_cases', uc);
  }

  const res = await fetch(
    `https://www.perplexity.ai/rest/thread/${slug}?${params}`,
    {
      credentials: 'include',
      headers: {
        'x-app-apiclient': 'default',
        'x-app-apiversion': '2.18',
        'x-perplexity-request-try-number': '1',
      },
    }
  );
  if (!res.ok) return { error: `HTTP ${res.status} ${res.statusText}` };
  const data = await res.json();

  // Inspect thread messages and their block types
  const messages = data?.thread?.messages ?? data?.messages ?? [];
  return messages.slice(0, 6).map((m, i) => ({
    idx: i,
    role: m.role ?? m.type,
    blockTypes: (m.blocks ?? []).map(b => Object.keys(b).filter(k => k.endsWith('_block') || k === 'type')),
    textLen: m.text?.length ?? m.answer?.length ?? 0,
  }));
}
```

---

## Anti-Patterns

Avoid these:

1. Treating visible current UI as historical truth.
2. Inspecting old responses only after the relevant truth lived in the request body.
3. Sending several probes at once before the endpoint family is known.
4. Capturing response bodies but not request bodies.
5. Forgetting to refresh/reopen to distinguish persisted state from transient state.
6. Relying on one account-specific URL, token, or CSS selector as the whole solution.
7. Mutating a user's real workspace without explicit permission and cleanup awareness.
8. Building implementation code before the action-to-API mapping is proven.

---

## Worked Examples

Read the most relevant example before applying this skill to a new site.

**Pattern A — Interaction-Driven:**
- `examples/example-01-kimi-model-switch-probing.md` — Kimi model switch; two request body flags differ on one variable
- `examples/example-02-github-copilot-model-switch-probing.md` — Copilot model per-turn; history API lacks model field; must capture at send-time
- `examples/example-03-notion-crud-transfer-template.md` — Transfer template for any CRUD app
- `examples/example-08-claude-to-notion-cors-acceptance-e2e.md` — Same-session Claude URL -> Notion import acceptance runbook (URL forensics, timeout branch, console/network evidence, reload stability check)

**Pattern B — Passive API Replay:**
- `examples/example-04-aistudio-passive-replay.md` — Complete walkthrough: SAPISIDHASH auth, positional-array bisection, thinking-vs-text misclassification fix
- `examples/example-05-grok-passive-replay-template.md` — Three-call sequence, cookie auth, branch-aware response loading, parser forensics template
- `examples/example-06-perplexity-passive-replay-template.md` — Cookie + x-app headers, block-schema forensics, Cloudflare precaution
- `examples/example-07-notion-secure-image-upload-protocol.md` — Notion secure image protocol discovery, markdown-import constraint, and post-import patch chain
