# Example 04 — Notion Three-Round API Discovery (Real Case Study)

## Why This Example Exists

This is not a template. It is the actual record of how this codebase mapped Notion's private web API across three rounds of probing, what it got right, and — more importantly — the four production bugs that shipped because earlier rounds **looked complete but were not**.

Read this example when:

- You are about to start probing a private CRUD-style backend (Notion, Linear, Coda, Airtable, Asana, Monday, ClickUp, Confluence, etc.)
- You have already mapped the read API of such a backend and think you are "done"
- You are integrating with any platform where users select a destination and your code creates content there
- You hit an error like `block to replace does not exist`, `parent not found`, or `presigned URL expired` and want to understand the underlying class of mistake

If you only read one section, read **Lessons** at the bottom. The wins are documentation; the lessons are insurance.

---

## Setup Assumed By Every Round

All three rounds shared these prerequisites — replicate them on the target machine before reproducing any round:

- A real, logged-in Chrome profile with a Notion account in a workspace you can write to
- Chrome DevTools MCP attached to that profile (not a clean profile)
- A scratch parent page in Notion named with a unique probe prefix, e.g. `api-probe-20260425`
- A MAIN-world fetch/XHR interceptor installed before each UI action — the canonical shape lives in [SKILL.md → Step 3](../SKILL.md)
- Permission from the user to perform the mutation class for that round

If the host machine cannot satisfy any of these, no probe in this file will reproduce.

---

## Round 1 — Read API Discovery

### Goal

Map the endpoints needed to: enumerate the user's spaces, list recent top-level pages and databases, search by query, and load a destination page's structure (so the user can pick a parent for sync).

### Probe Matrix

| Probe | UI Action | Unique Anchor | Captured From |
|---|---|---|---|
| R1 | Open Notion app, observe initial load | none | initial XHR burst |
| R2 | Click "Search" and type a unique scratch page title | `api-probe-20260425` | search request body |
| R3 | Open the scratch page | parent ID from R2 | page load XHR |
| R4 | Refresh the page | none | persisted re-fetch |

### Endpoints Mapped

| Endpoint | Purpose | Key Auth Headers |
|---|---|---|
| `POST /api/v3/getSpaces` | enumerate user's spaces and current user identity | cookie session |
| `POST /api/v3/getUserSignals` | recently visited top-level pages and databases | `x-notion-active-user-header`, `x-notion-space-id` |
| `POST /api/v3/search` | search by query within a space | as above |
| `POST /api/v3/loadPageChunk` | structural recordMap of a single page | as above |

### What Felt Like Completion

After Round 1 the dossier looked complete. The picker UI worked end-to-end. We could enumerate, search, select. Tests passed. We thought "Notion is done."

### Lesson From Round 1 → applies to L6 in SKILL.md

Read APIs are an **invitation surface**, not a complete protocol. Every identifier surfaced by a read call (page ID, collection ID, view ID, space ID, user ID) is a future write-API parameter. Mapping read APIs means you know the **vocabulary**; it does not mean you know the **grammar** of mutations. We declared victory too early.

---

## Round 2 — Write API Discovery (saveTransactionsFanout)

### Goal

Given a destination chosen via the read API, write a child page or database row containing exported chat content.

### Trigger That Forced Round 2

Users tried "Save to Notion" on a real conversation. Round 1's identifiers were correct but **nothing was created** — we had no write protocol.

### Probe Matrix

| Probe | UI Action | Unique Anchor | What To Capture |
|---|---|---|---|
| W1 | Click "+ New page" under scratch parent | `api-probe-page-w1-001` | endpoint, transaction structure, op grammar |
| W2 | Type a paragraph into the new page | `api-probe-block-w2-001` | block create + listAfter ordering |
| W3 | Drag the new page to a different parent | none | setParent semantics |
| W4 | Create a database under scratch parent | `api-probe-db-w3-001` | collection / view / schema payload |
| W5 | Insert a row | `api-probe-row-w4-001`, status `Alpha` | parent_table='collection' vs 'block' |
| W6 | Refresh and re-load | none | persistence verification |

### Endpoints Mapped

| Endpoint | Purpose |
|---|---|
| `POST /api/v3/saveTransactionsFanout` | the universal mutation endpoint — accepts a list of transactions, each containing a list of operations |

### Operation Grammar Discovered

A single transaction operation has shape:

```
{ pointer: { table, id, spaceId }, path: [...], command, args: {...} }
```

Commands observed:

| Command | Effect |
|---|---|
| `set` | create/overwrite a record (block, collection_view, etc.) |
| `update` | partial field update (e.g., `last_edited_time`) |
| `setParent` | reparent a block to another block or collection |
| `listAfter` | append a child ID to a parent's content list, optionally after a sibling |

Critical field semantics:

- For pages under another page: `parent_table = 'block'`, `parent_id = parentPageId`
- For database rows: `parent_table = 'collection'`, `parent_id = collectionId`, plus a `listAfter` on `collection_view.page_sort`
- Each new block needs a client-generated UUID; Notion does not auto-assign IDs

### What Felt Like Completion

Round 2's implementation passed 12 unit tests with full mock coverage of the transaction grammar. The chat-selection panel could write to both page and database parents. We thought "write is done."

### Lesson From Round 2 → applies to L4 in SKILL.md

The probe was performed inside the Notion tab via MAIN-world interception. Replaying the request from the extension service worker required a permission decision we did not even know we were making: background SW fetches are governed by `host_permissions`, not `connect-src`. We added `https://www.notion.so/*` correctly only after the first request from production code returned a CSP violation in the wrong layer of devtools, sending us on a 30-minute detour.

**Carry-forward rule**: As part of probe documentation, record **which runtime will replay this request in production**, not just which runtime captured it.

---

## Round 3 — File Import API Discovery

### Goal

Add a "save as Markdown file" mode that imports the conversation as a single Markdown attachment, so the resulting Notion page renders rich content (code blocks, math, tables) the same way a manually-uploaded `.md` file would.

### Trigger That Forced Round 3

Building Markdown content as native blocks via `saveTransactionsFanout` lost fidelity (LaTeX, fenced code, nested lists). Notion's own "Import → Markdown" flow rendered the same content correctly. Therefore there had to be a different sub-protocol.

### Probe Matrix

| Probe | UI Action | Unique Anchor | What To Capture |
|---|---|---|---|
| F1 | Notion menu → "Import" → "Markdown" → upload a tiny `.md` file with a unique heading | `# api-probe-import-f1-001` | full request sequence |
| F2 | Open the resulting page | none | where did it land in the tree? |
| F3 | Repeat F1 with a larger file | `# api-probe-import-f2-large` | file size and putHeaders shape |
| F4 | Refresh the workspace | none | persistence + parent verification |

### Endpoint Sequence Mapped (Five Steps)

| Step | Endpoint / URL | Purpose |
|---|---|---|
| 1 | `POST /api/v3/getUploadFileUrl` with `bucket: 'temporary'` | request a pre-signed upload URL and a `signedToken` |
| 2 | `PUT <signedPutUrl>` to AWS S3, with `putHeaders` from step 1 (excluding `Content-Length`) | upload the markdown bytes |
| 3 | `POST /api/v3/enqueueTask` with `eventName: 'importFile'`, `importType: 'ReplaceBlock'`, `block.id = <pageId>`, `signedToken` from step 1 | enqueue the conversion job |
| 4 | `POST /api/v3/getTasks` with `taskIds: [...]`, polled every 2s | wait for `state: success` |
| 5 | (implicit) the page at `block.id` is now populated with the imported markdown | — |

### Critical Field Semantics

- `bucket: 'temporary'` is required — other bucket values are rejected
- `supportExtraHeaders: true` is required for `putHeaders` to be returned
- `putHeaders` includes `x-amz-tagging` which **must** be forwarded to S3, but `Content-Length` **must not** (browsers compute it and forbid manual override)
- `signedToken` ties the uploaded file to the import task — without it the import sees no file
- `block.id` is the target page that will be **transformed in place**, not a new page that will be created

### What Felt Like Completion

The implementation followed the captured sequence exactly. Tests for steps 1, 2, 3, 4 all passed. The first real run produced **four separate production bugs**, none of which the unit tests caught.

---

## The Four Production Bugs From Round 3 (And Their General Lessons)

### Bug 1 — `block to replace does not exist`

**Symptom**: `enqueueTask` returned `{taskId: ...}`. `getTasks` polled and returned `state: failure, error: "importFile.ReplaceBlock: block to replace does not exist: <uuid>"`.

**Root cause**: We generated a fresh client-side UUID for `block.id` and passed it directly. `ReplaceBlock` is **not** a create operation; it is an in-place transform. The target block must already exist in Notion before the import task can transform it. The Notion UI's own "Import" flow first creates a placeholder page via `saveTransactionsFanout`, then runs `ReplaceBlock` against that real ID — we missed the placeholder step in Round 3 because the probe captured the whole UI flow as a single user action.

**Fix**: Before `enqueueTask`, perform a `saveTransactionsFanout` that creates an empty page (`set` block of `type: 'page'`, plus `setParent`, plus `listAfter`) under the user's selected destination. Use **that** page's ID as `block.id` in the import task.

**Generalization** → maps to **L1** in SKILL.md: Operation names lie. `Replace` does not imply `Create`. Always negative-probe a new operation with a non-existent ID and read the error message.

### Bug 2 — Page lands at workspace root, not at user-selected parent

**Symptom**: Import succeeded. User opened Notion. The new page was in the Private section at workspace root, not under the parent they had selected in the picker.

**Root cause**: When `block.id` does not yet exist (Bug 1's situation), Notion synthesizes the page as a top-level workspace child. Even if Bug 1 had not surfaced, the import would have ignored the destination because there was no `setParent` operation in the chain.

**Fix**: The placeholder `saveTransactionsFanout` from Bug 1's fix already includes `setParent` and `listAfter` for the user-selected destination. Bug 1 and Bug 2 share a single fix.

**Generalization** → maps to **L2** in SKILL.md: `state: success` is task success, not user-visible success. The probe matrix should have included a **placement check** (open the imported page → walk up its ancestors → assert the top is the user-selected parent), not just a status check.

### Bug 3 — `Failed to fetch` on the S3 PUT in production

**Symptom**: Step 2 (`PUT <signedPutUrl>`) failed with `TypeError: Failed to fetch` from the background service worker, despite the same fetch working in our MAIN-world probe inside the Notion tab.

**Root cause**: We had added Notion's own origin (`https://www.notion.so/*`) to `host_permissions`, but the S3 host (`s3.us-west-2.amazonaws.com`) was not declared. Manifest V3 background SW fetches are gated by `host_permissions` for every cross-origin destination — the probe ran inside the Notion tab and bypassed this gate entirely.

**First (wrong) fix**: Added `https://s3.us-west-2.amazonaws.com/*` to `host_permissions`. This worked for the prober — who happened to be on the US west coast — and shipped a region-locked extension.

**Correct fix**: Replaced the region-specific entry with the wildcard `https://*.amazonaws.com/*`. Removed the S3 entries from `connect-src` entirely (background SW does not consult CSP).

**Generalization** → maps to **L3** in SKILL.md: Pre-signed URL hostnames are samples of the prober's location, not features of the protocol. Always classify hostname components as **stable / region-variable / shard-variable** before adding them to a manifest.

### Bug 4 — `writeMode: 'markdown-import'` was never sent from the viewmodel

**Symptom**: After implementing all of Round 3 in the background service, clicking "Save to Notion" still ran the legacy native-block path. No file import requests appeared in the network panel.

**Root cause**: The new `writeMode` dispatcher field was implemented end-to-end in the background, but the viewmodel that issued the request never set it. Backend defaulted to legacy. All 12 new unit tests passed because they directly invoked the handler with `writeMode: 'markdown-import'` set.

**Fix**: One line in the viewmodel: `writeMode: 'markdown-import'` in the request payload sent to the background.

**Generalization** → maps to **L5** in SKILL.md: A new dispatcher field requires a field-traversal smoke before any branch test is meaningful. Capture one real outbound request from production UI and grep for the new field name. If it is absent, no branch unit test below can be trusted.

---

## Cross-Round Reproducibility Checklist

For another engineer on another machine to reproduce this discovery from scratch:

- [ ] Logged-in Chrome profile with Notion access (no clean profile)
- [ ] Chrome DevTools MCP attached to that profile
- [ ] A scratch parent page in Notion named with a unique probe prefix
- [ ] MAIN-world fetch interceptor installed before any UI action ([SKILL.md → Step 3](../SKILL.md))
- [ ] Round 1: enumerate spaces, search, open page, refresh — capture the four read endpoints
- [ ] Round 2: create page → add block → reparent → create database → insert row → refresh — capture transaction operation grammar
- [ ] Round 3: Notion menu Import → Markdown → upload tiny file → open result → refresh — capture the five-step file import sequence
- [ ] After implementation: **field-traversal smoke** (Bug 4 lesson), **placement assertion** (Bug 2 lesson), **negative ID probe** (Bug 1 lesson), **region-variability audit** (Bug 3 lesson)
- [ ] Async task fixtures cover all three states (in_progress / success / failure) — Lesson L7
- [ ] Endpoint inventory marked as `explored / partially-explored / suspected-unexplored` for the next round — Lesson L6

If any of these are skipped, expect the same four bugs (or their cousins) to ship.

---

## Carry-Forward Notes For Other Platforms

The same three-round shape applies to any private CRUD/RPC backend:

- **Round 1 — Read**: Enumerate, search, load. Mistake: declaring victory here.
- **Round 2 — Write**: One mutation endpoint usually accepts a list of operations. Mistake: forgetting which runtime will replay the request in production.
- **Round 3 — Specialized sub-protocols**: File upload, OAuth-like flows, async jobs, webhook subscriptions. Mistake: assuming the operation name means what it sounds like, and assuming pre-signed URL hostnames are protocol-stable.

When mapping Linear, Coda, Airtable, Monday, Asana, ClickUp, or Confluence, expect the same staircase. The endpoints will differ; the lessons will not.
