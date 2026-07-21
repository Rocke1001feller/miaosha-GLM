# Example 01 — Notion Background-First Session Integration

> **Why this example exists.** This example proves that "browser login enough" can be a real product contract, not just a slogan. It captures the full path from a false login symptom in the UI to a background-first read chain, then to a real write path and a browser smoke test. Notion is the specific platform, but the transferable method applies to Medium, Substack, Dev.to, and similar destination integrations.

---

## 0. Snapshot

- **Platform:** Notion
- **Architecture choice:** A. Background-first session reuse
- **User promise:** If the Chrome profile is logged into Notion, the extension can browse destinations and sync content without requiring a persistent Notion tab.
- **Integration class:** destination picker plus write path
- **Root lesson:** the first bug was not auth. It was a placeholder UI that never consumed real auth truth.

---

## 1. Starting Symptom

The chat-selection page showed "Need to login to Notion" even while the browser already had a live Notion session.

At first glance this looked like a cookie or permission problem. The visible symptom suggested the extension could not detect the logged-in state.

That conclusion was false.

---

## 2. Source Truth And Target Truth

### Source Truth

- The browser profile already had a valid Notion session.
- The extension had the necessary Notion host permission and connect-src coverage.
- Background Notion reads were already technically possible.

### Target Truth

When the profile is logged into Notion, chat-selection should:

1. read a real session snapshot
2. show recent pages and databases or a search picker
3. show login only when the real session is absent or rejected
4. allow syncing selected messages to the chosen destination

---

## 3. The Real First Break

The first break was not in cookies, permissions, or the Notion API.

It was in the chat-selection UI layer.

The Notion panel still contained a placeholder interaction path that went straight to a login panel instead of asking for a real session snapshot. The UI emitted a hardcoded login conclusion before the real source truth had a chance to enter the page state machine.

That distinction matters because it changes the fix from "debug auth" to "wire truth into the UI."

---

## 4. Chosen Architecture

The integration was explicitly modeled as:

```text
Chrome profile Notion session
  -> extension background fetch with credentials: include
  -> normalized session snapshot and picker snapshot
  -> ChatSelectionViewModel state
  -> NotionInlineController state-driven UI
  -> background syncSelection write path
```

This architecture preserved the product contract:

- no OAuth
- no dependency on an open Notion tab
- no direct UI guesswork about login state

---

## 5. Read Chain Implementation

### Background adapter

The background Notion adapter was built around the browser-backed Notion web API surface:

- `getSpaces` for session and workspace truth
- `getUserSignals` for recent targets
- `search` for workspace search

This logic lives in `entrypoints/background/notion.ts`.

### Repository adapter

`services/real-notion-repository.ts` became the page-facing adapter that forwards:

- `NOTION_GET_SESSION`
- `NOTION_GET_PICKER`
- `NOTION_SYNC_SELECTION`

and normalizes failures into typed result objects instead of throwing raw runtime errors into the UI.

### State integration

The chat-selection ViewModel was extended to hold real Notion state:

- session snapshot
- picker snapshot
- selected target
- loading state

The controller stopped treating login as a click outcome and started treating it as a state outcome.

---

## 6. Write Path Implementation

Only after the read chain became stable was the real write path implemented.

The write model in `entrypoints/background/notion.ts` does two different things depending on destination type:

### Page target

1. resolve the destination with `loadPageChunk`
2. serialize selected chat messages into Notion text blocks
3. append those blocks to the page with `saveTransactions`

### Database target

1. resolve the database block and collection id
2. create a new row page in the collection with `saveTransactions`
3. append the serialized chat blocks into that new row page

The universal lesson is that the write path should be expressed as a normalized internal request and a typed result, while the platform adapter owns the exact private API choreography.

---

## 7. Browser Smoke Was Essential

The most important proof did not come from jsdom. It came from a browser-level smoke test against the real extension page.

`tests/smoke/notion-picker.smoke.mjs` validates all of this together:

1. the MV3 extension loads successfully in Playwright
2. the service worker exposes a real extension id
3. pending export data is seeded into extension storage
4. Notion API endpoints are mocked at the browser boundary
5. the chat-selection page renders the conversation
6. opening the picker does not show a false login gate
7. searching and selecting a Notion target enables the save button

This test caught several runtime-specific truths that unit tests do not naturally surface.

---

## 8. Hard-Earned Practical Lessons

### Lesson 1. Placeholder UI can impersonate a platform auth failure

If the UI short-circuits into a login panel, the visible symptom looks like auth breakage even when the browser session is healthy.

### Lesson 2. Browser login truth often lives in profile session state, not in the existence of a live destination tab

That is what made background-first the right architecture here.

### Lesson 3. Read chain first, write chain second

Until session and picker truth are stable, write-path failures are too expensive to localize.

### Lesson 4. Extension smoke tests have their own hidden dependencies

This Notion work surfaced multiple real extension-test gotchas:

- Playwright MV3 extension loading required the `chromium` channel, not `chrome`
- the smoke needed to wait for the MV3 service worker before deriving the extension id
- direct storage seeding had to use WXT driver keys without the `local:` prefix
- the same target can appear in multiple picker sections, so smoke selectors cannot assume unique visible text

These are not Notion-specific. They generalize to any browser-session destination integration tested through a real MV3 extension runtime.

### Lesson 5. The named results container is almost never the full truth

A later iteration of the picker shipped with this regression: top-level databases never appeared in the recent list, even when the user had just edited one in their browser.

The first patch attempt assumed the cause was inline-database block-type recognition (`collection_view` vs `collection_view_page`) and added taxonomy support inside the page-drilldown branch. Tests went from 549 to 552 green. The user's screenshot did not change.

Live capture against the user's real workspace via Chrome DevTools revealed the actual chain:

- `/api/v3/getUserSignals` with the `editedPages` signal returned 14 entries in `signals[0].data`.
- All 14 entries were `pageId`s. None were database ids. Most were actually database **rows** (`parent_table === 'collection'`).
- The top-level `collection_view_page` for "Goals Tracker" appeared only in `recordMap.block`, never in `signals[].data`.
- The parser only iterated `signals[].data`, so the database was structurally invisible regardless of how many block-type checks we added.

Three lessons compound here:

1. **The signal name lies.** `editedPages` does not list edited pages. It lists `pageId`s, many of which are database rows, and it omits databases entirely.
2. **One endpoint, multiple containers.** `signals[].data` is a recency hint; `recordMap.block` is the actual entity catalog. A correct parser must enumerate both and decide per entity kind which container is authoritative.
3. **Fictional fixtures hide real bugs.** The original test fixture had artificially placed a database id into `signals[].data`. That made the parser look correct for years while real Notion never produced that shape. The first 552-test patch passed only because the new fixture was also synthetic.

The real fix in `entrypoints/background/notion.ts` (`flattenSignalTargets`) sweeps `recordMap.block` after consuming `signals[].data` and surfaces any top-level `isDatabaseBlock` entry the named container omitted. The accompanying regression test in `tests/entrypoints/background-notion.test.ts` deliberately uses the captured-from-real-Notion shape: only `pageId`s in `signals[].data`, the database block visible only in `recordMap`.

Carry these forward as cross-platform habits:

- For every read endpoint, enumerate every container in the response, not just the named results array.
- Treat endpoint and signal names as marketing, not contracts. Validate against live response.
- Capture real responses as fixtures before writing parser tests; never let parser expectations shape the fixture.
- When tests are green but the user's symptom is unchanged, the diagnosis layer is wrong. Re-capture before re-patching.

---

## 9. Validation Matrix

The Notion integration was considered complete only after all of these layers existed:

- repository tests for session, picker, and sync forwarding
- background handler tests for session read, picker read, page writes, and database writes
- router tests for new Notion message types
- controller and ViewModel tests for authenticated picker flow
- browser smoke test for the authenticated picker experience
- full repository test suite and build validation

This is the standard you should carry forward for Medium, Substack, and Dev.to.

---

## 10. How This Transfers To Medium, Substack, And Dev.to

The transfer model is direct:

### What stays the same

- define the user promise first
- prove background-first session reuse is real
- discover the read endpoints and the write endpoints
- normalize snapshots and result objects
- remove placeholder UI conclusions
- prove the flow through a browser smoke

### What changes by platform

- destination model: publication, space, page, draft, article, tag, visibility
- write semantics: create draft, patch content, submit publish, save transaction
- headers, CSRF tokens, and publication scoping rules
- whether the platform supports background-only read and write, or needs a hybrid fallback

### Decision shortcut

If the next platform can honor browser cookies from background fetch and exposes enough web endpoints for destination discovery plus draft or publish, start with this exact pattern.

---

## 11. Transferable Lessons

1. The product contract must be stated in user language before architecture is chosen.
2. Session truth belongs to a runtime boundary, not to a button handler.
3. Background-first is the cleanest way to honor "browser login enough" when the platform allows it.
4. The UI should consume normalized session truth, not invent auth conclusions.
5. The real smoke test for this integration class is the extension runtime, not only jsdom.
6. Every read-endpoint response must be enumerated container by container; the named results array almost always omits at least one entity kind.
7. Endpoint and signal names are marketing copy, not contracts. Validate against live response shape before modeling.
8. `type` fields lie. Always pair them with a disambiguator field (Notion: `parent_table`) and route every entity through a single helper.
9. Test fixtures must be derived from captured real responses. Synthetic fixtures create closed loops where green tests do not move the user-visible symptom.
10. When a fix lands and the symptom is unchanged in the user's screenshot, the diagnosis layer is wrong. Re-capture live evidence before patching again.

---

## 12. Files Worth Studying

- `services/real-notion-repository.ts`
- `entrypoints/background/notion.ts`
- `entrypoints/chat-selection/viewmodel.ts`
- `entrypoints/chat-selection/controllers/notion-inline.controller.ts`
- `tests/entrypoints/background-notion.test.ts`
- `tests/services/real-notion-repository.test.ts`
- `tests/entrypoints/background-router.test.ts`
- `tests/smoke/notion-picker.smoke.mjs`

This example is the concrete proof that the skill is not abstract theory. It already worked once under real constraints.