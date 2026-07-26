---
name: browser-session-platform-integration
description: "Use when integrating a destination platform by reusing an already-logged-in browser session instead of requiring OAuth or an always-open tab. Triggers: 浏览器登录即可, background-first, browser session reuse, sync to Notion, publish to Medium, publish to Substack, Dev.to integration, logged-in Chrome profile, private web API, picker plus publish flow."
---

# Browser-Session Platform Integration

## Description

Use this skill when the product contract is:

**If the user is already logged into the destination platform in the browser profile, the extension should be able to read targets and write content without forcing OAuth and without requiring a destination tab to stay open.**

This skill exists to turn that contract into a repeatable engineering workflow.

The core pattern is:

```text
logged-in browser profile
  -> background-first session reuse
  -> normalized read models
  -> explicit UI or workflow state machine
  -> draft / sync / publish write path
  -> focused tests
  -> browser smoke proof
```

Notion is the richest worked example in this repository, but the method is intentionally broader than Notion. It is meant to transfer to platforms such as Medium, Substack, and Dev.to.

## When To Use This Skill

Use this skill when the user asks for any of the following:

- integrate a destination platform using existing browser login
- 浏览器登录即可
- background-first session reuse
- sync selected content to a private or semi-private platform
- publish to Medium from the extension
- publish to Substack from the extension
- publish to Dev.to from the extension
- add a destination picker backed by browser session
- use private web APIs from extension background
- replace placeholder login UI with real session truth

## Do Not Use This Skill For

- official OAuth integrations where the product explicitly wants account linking
- server-side publisher pipelines that do not rely on browser session
- one-off scripts that post to a public API with static credentials
- integrations that fundamentally require a live destination tab DOM as the source of truth

## The Non-Negotiable Product Question

Before touching code, force this decision:

**What exactly does "logged in" mean for this feature?**

Possible meanings:

1. the Chrome profile has valid destination cookies
2. a destination tab is currently open and authenticated
3. the user completed an explicit OAuth connect flow
4. the app backend owns and refreshes the destination token

If you do not lock this semantic contract first, the implementation will drift and the tests will prove the wrong thing.

## Thinking Dimensions

When creating or reviewing this class of integration, think across all of these dimensions explicitly:

1. Product semantic
   What promise are we making to the user: browser login, tab presence, OAuth connection, or backend account link?

2. Browser runtime
   Where does auth truth actually live: cookies, local storage, IndexedDB, tab DOM, or service worker state?

3. Extension boundary
   Which runtime should own platform access: background, extension page, content script, or a hybrid?

4. Permission and CSP
   Which origins must be in host permissions and connect-src for the chosen flow to work reliably?

5. Protocol surface
   Which endpoints support session read, picker read, draft creation, append, publish, or post status?

6. Domain model
   Which platform concepts must be normalized: workspace, publication, page, database, draft, tag, visibility, destination target?

7. State machine
   Which user-visible states must exist: loading, ready, empty, needs-login, error, publishing, published, partial failure?

8. Write semantics
   Is the write model append, replace, create draft, create row page, publish article, or submit transaction?

9. Observability
   What exact signals will prove the chosen architecture works: focused unit tests, router tests, browser smoke, real profile validation?

10. Portability
   Which parts are universal method, which parts are platform adapter, and which parts are product-specific policy?

11. Destination pattern
   Does this platform really need a picker, or is the truthful abstraction a single default destination, a lightweight publication switcher, or a draft-only flow?

12. Payload taxonomy
   What are the real entity kinds the platform returns, and where does the kind label *lie*? (e.g. Notion `block.type === 'page'` can mean either a real page or a database row; only `parent_table` disambiguates.)

13. Multi-source response shape
   When one endpoint returns more than one container (e.g. `results[]` plus `recordMap.*` plus `signals[].data[]`), which container is authoritative for which entity kind? Treating any single container as the full truth is the most common silent data-loss bug.

14. Naming-vs-semantics gap
   The endpoint or signal name is *not* a contract. `editedPages` returns database rows. `search` may exclude templates. `recent` may exclude databases. Always validate name against live response before letting the name shape your model.

15. Fixture provenance
   Are the test fixtures captured from real platform responses, or reverse-engineered from your parser? The latter creates a closed loop where tests pass while the user-visible symptom never moves.

## Thinking Levels

This integration class should be reasoned about in layers, from highest meaning to lowest mechanics:

1. Semantic layer
   Define the user promise in one sentence. Example: "Browser login alone is sufficient; no destination tab is required."

2. Capability layer
   Decide whether the extension can actually honor that promise with background fetch plus browser credentials.

3. Boundary layer
   Decide which runtime owns truth and which runtimes only consume normalized snapshots.

4. Protocol layer
   Discover and validate the read endpoints and write endpoints needed for the chosen workflow.

5. Model layer
   Normalize platform-specific payloads into stable internal session, picker, and write request models.

6. Interaction layer
   Connect normalized state to a real state machine. Remove placeholder UI paths that bypass truth.

7. Write layer
   Implement the actual sync, draft, append, or publish path only after the read chain is stable.

8. Regression layer
   Lock the contract with focused tests and at least one browser-level smoke that proves the promised semantics in a realistic runtime.

## Decision Ladder

Use this decision ladder before committing to architecture:

| Option | Source of auth truth | Requires destination tab | Meets "browser login enough" | Typical fit |
|---|---|---:|---:|---|
| A. Background-first session reuse | Browser profile cookies or browser-managed auth | No | Yes | Notion-like destination pickers, destination drafts, internal web APIs |
| B. Tab-assisted same-origin read | DOM plus same-origin runtime of an open destination tab | Yes | No | Sites that expose no usable background-callable endpoint |
| C. OAuth or explicit connect | Platform token granted via user connect flow | No | No | Long-lived cross-device publishing or official public API support |
| D. Hybrid | Background-first, with tab fallback for edge cases | Sometimes | Usually | Platforms with unstable private APIs or partial same-origin restrictions |

If the product requirement is truly "browser login enough", Option A is the default until evidence proves it impossible.

## What This Skill Forces

A complete integration design or review must explicitly answer all of the following:

1. What is the source truth for authentication?
2. Why is background-first justified or rejected?
3. Which endpoints power session read, picker read, and write?
4. What normalized models are needed for session, target selection, and write requests?
5. Which UI or workflow states are required?
6. Where is the first distortion layer if the UI disagrees with source truth?
7. How will the write path avoid being implemented before the read path is trustworthy?
8. What are the mandatory tests?
9. What hidden dependencies remain?
10. What part of the solution is reusable for the next platform?

If any of these are missing, the integration plan is incomplete.

## Standard Operating Procedure

### Step 1. Lock The Product Semantic

Write the contract in one sentence. Good examples:

- "If the profile is logged into Notion, the extension can show pages and databases without an open Notion tab."
- "If the profile is logged into Medium, the extension can create a draft article without an OAuth connect step."

Bad examples:

- "Integrate Medium"
- "Support publishing"

### Step 2. Separate Source Truth From Placeholder UI

Treat these as independent questions:

- Is the platform actually authenticated in the browser profile?
- Does the extension currently consume that truth, or is the UI still a stub?

This is the easiest place to fool yourself. A hardcoded login gate often looks like a real auth failure.

### Step 3. Prove The Extension Boundary

Before building models or UI, prove the extension boundary can support the contract.

Checklist:

- host permissions include the destination origin
- extension page CSP connect-src includes the destination origin
- the background runtime can call the required endpoint with `credentials: 'include'`
- the target platform actually honors the browser session in that background call path

If any of these fail, escalate early to Option B, C, or D.

### Step 4. Discover The Protocol Surface

Do not start by designing the picker or publish modal. First discover the endpoint surface.

For each platform, identify:

- session or identity read endpoint
- recent or search endpoint for destination discovery
- write endpoint: create draft, append blocks, publish article, update story, submit transaction, and so on
- required headers beyond cookies
- workspace or publication scoping rules

Treat private web APIs as empirical contracts. Revalidate them with live browser evidence.

## Endpoint Discovery Playbook

When the protocol surface is unknown, use this playbook before defining interfaces:

1. Identify the smallest real user action that proves the capability exists.
   Examples: open destination list, search publication, create draft, append content, publish article.

2. Perform that action in the real logged-in browser and inspect the Network panel.

3. Group the observed requests by purpose:
   - session or identity
   - destination discovery
   - draft creation
   - content update
   - publish or submit

4. For each promising request, record:
   - URL and method
   - whether cookies alone were enough
   - any CSRF token, bearer token, or custom header
   - required publication, workspace, organization, or draft identifiers
   - minimal response fields needed by the extension
   - **every container in the response body** (e.g. `results[]`, `recordMap.*`, `included`, `entities`, `signals[].data[]`) and which entity kind each container actually carries
   - **which entity kinds the named results container is known to omit** (capture this empirically by editing one of each kind in the live profile and re-running the call)

5. Replay the request from the runtime you plan to own the integration.
   If same-origin tab calls work but background replay does not, you may not have a true background-first platform.

6. **Save the captured response (redacted) as a real-payload fixture** before you write any parser. Label the fixture with date, endpoint, account context. Every regression test for this endpoint must trace back to such a captured fixture, not a synthetic one.

7. Only after replay proof and the taxonomy + multi-container map exist should you lock the repository interface and normalized models.

## Background-First Rejection Signals

Recognize these signals early. They usually mean Option A is blocked or incomplete:

- background fetch hits CORS rejection even with correct host permissions
- background fetch includes cookies but still receives 401 because a page-scoped CSRF token is missing
- the platform requires DOM-generated state or transient form tokens unavailable to background
- anti-bot defenses accept interactive tab traffic but reject background replay
- write calls depend on same-origin runtime state that the extension cannot honestly reproduce in background

When these appear, stop forcing the same idea. Re-evaluate whether the platform needs a hybrid or OAuth model instead.

## Payload Taxonomy And Entity Disambiguation

Private web APIs almost always carry a hidden taxonomy that the field names do not reveal. Before normalizing any response into your domain model, force these questions:

1. **What entity kinds does this platform actually have?**
   Pages, database top-level blocks, database rows, templates, drafts, archived items, comments, attachments — list them all.

2. **Where does the `type` field lie?**
   In Notion, `block.type === 'page'` covers both real pages and database rows. The disambiguator is `parent_table` (`'space'` / `'block'` = real page, `'collection'` = database row). Until you write that rule down, every recent/picker/search response will leak rows into the page list.

3. **Which entity kinds the API actively hides?**
   Notion's `getUserSignals[editedPages]` does not list top-level databases at all, even when the user just edited one. Their block records do appear in `recordMap.block` though. If you only iterate the named results array, those entities are invisible to your UI forever.

4. **Which fields must be cross-checked, not trusted?**
   `alive`, `is_template`, `archived`, `parent_table`, `parent_id`, `space_id`, `collection_id`. Build a single `isTopLevel*Target()` / `isDatabaseBlock()` / `isRow()` helper and route every entity through it.

Write this taxonomy down once per platform, in the dossier. Make it the contract that parsers, normalizers, and tests share.

## Multi-Source Response Reconciliation

When one endpoint returns multiple containers, enumerate them and decide for each entity kind which container is authoritative.

Example, Notion `getUserSignals` response shape:

| Container | What it actually carries | Trap |
|---|---|---|
| `signals[i].data[]` | Only `pageId` references | Misses databases entirely; many `pageId`s are actually database rows |
| `recordMap.block` | Full block records including top-level `collection_view_page` | Skipped if your code only iterates `signals[].data` |
| `recordMap.collection` | Database titles, icons | The DB block has no title — title lives here |
| `recordMap.space` | Workspace name | Required to resolve `parentTitle` for top-level entries |

The rule:

- **Iterate the named results container for ordering and recency hints.**
- **Then sweep the `recordMap` (or equivalent) for any entity kind that the named container is known to omit.**
- **Dedupe by id, sort by `last_edited_time` or equivalent.**

If you skip the sweep, you ship the bug we shipped twice: "recent picker shows zero databases even though the user just edited one."

## Real-Payload-First Fixtures

This skill mandates one rule that overrides convenience:

**Every parser test fixture must be derived from a captured real platform response, not invented from your parser's expectations.**

Why: if a fixture is hand-shaped to match what the parser already does, the test is a closed loop. It will stay green through both correct and incorrect refactors. The user-visible symptom is the only signal that ever moves.

Working rules:

1. Before writing the first parser test, capture at least one **real response** via the repository's Patched MCP Chrome DevTools skill (`.claude/skills/patched-mcp-chrome-devtools/SKILL.md`). Do not restate MCP operation mechanics here.
2. Save a redacted slice of the real payload as the fixture. Label its provenance (date, endpoint, workspace/account context).
3. When a bug is reported and the existing test passes, the **fixture is suspect**. Re-capture before re-diagnosing.
4. Add a regression test whose fixture mirrors the *narrowest real response shape* that reproduces the bug — never a synthetic response constructed to make your patch pass.

## When Tests Pass But Symptom Persists

If you ship a fix, the test suite is green, and the user comes back with the same screenshot, treat that as a high-priority signal that the diagnosis layer is wrong, not a sign you need a different patch on the same layer.

Mandatory next steps:

1. **Capture the real platform response live** before changing any more code. Do not iterate on the same hypothesis with fresh fixtures.
2. **Re-walk the chain from source truth.** The previous fix may have addressed a sibling problem. Confirm by mapping the captured response field-by-field through every transformation layer.
3. **Compare the captured response against the test fixture that "covered" this code path.** If they diverge, the fixture is fictional and the test was never protecting the real contract.
4. **Apologize for the misdiagnosis explicitly to the user**, name what the previous fix actually addressed, then proceed with the real-evidence fix.
5. **Save the captured response shape into repo memory** so the next iteration starts from truth.

This is the single most important habit for browser-session integrations, because private web APIs are undocumented and the only honest source of truth is the live response.

## CSRF And Anti-Bot Review

Cookie-backed auth is not the whole story. For each write path, explicitly check:

- is there a CSRF token in headers, meta tags, inline JSON, or bootstrapped page state?
- is the token stable across reloads, draft sessions, or publication switches?
- do write calls require a same-origin referer or origin pattern?
- does the platform challenge automated write traffic differently from read traffic?
- can the required token be obtained truthfully from background, or does that force a hybrid architecture?

Treat CSRF and anti-bot behavior as architecture constraints, not post-implementation surprises.

## Destination Pattern Choice

Do not force every platform into a Notion-style picker.

Choose the simplest truthful destination pattern:

1. Picker
   Use when the user must choose among many destinations such as pages, databases, publications, or organizations.

2. Implicit single destination
   Use when the platform has one natural default target and choice adds noise.

3. Lightweight switcher
   Use when the user chooses among a small number of publications, newsletters, or org scopes.

4. Draft-only pipeline
   Use when the first valuable milestone is simply creating a draft and returning a draft URL.

The platform model should decide the UI pattern, not the previous integration.

## Platform Pattern Sketches

Use these as starting hypotheses only. Validate them with the dossier and endpoint discovery playbook before coding.

| Platform shape | Candidate destination pattern | What must be validated before copying UI |
|---|---|---|
| Notion-like knowledge base | Picker | workspace scope, recent/search endpoints, append vs create-child choreography |
| Medium-like publishing surface | Implicit single destination or lightweight switcher | publication scope, draft creation flow, metadata update flow, whether background write is accepted |
| Substack-like newsletter surface | Lightweight switcher or draft-only pipeline | newsletter scope, CSRF behavior, anti-bot sensitivity, draft URL semantics |
| Dev.to-like article platform | Draft-only pipeline or lightweight org switcher | org scope, markdown body model, draft vs publish separation, cookie-backed vs token-backed write acceptance |

If a teammate starts from the Notion picker without validating this table, they are probably cargo-culting the wrong interaction model.

## Write Choreography Patterns

Name the write choreography before you code it. Most platforms fit one of these shapes:

1. Append to existing destination
   Resolve target -> append or merge content -> return updated destination URL.

2. Create draft then update body
   Create draft -> patch title, body, metadata -> return draft URL.

3. Create nested destination then append
   Create child resource -> append content -> return nested resource URL.

4. Create draft then publish or schedule
   Create draft -> patch fields -> publish or schedule -> return final status.

If the choreography is unnamed, the implementation tends to blur platform API details with product-level behavior.

### Step 5. Normalize The Platform Into Stable Models

Do not let the UI consume raw destination payloads.

Typical normalized models:

- session snapshot
- picker snapshot
- destination target summary
- sync or publish request
- sync or publish result

The repository or background adapter owns platform-specific parsing. The ViewModel or workflow layer consumes only normalized shapes.

### Step 6. Ship The Read Chain Before The Write Chain

The read chain must be trustworthy first.

In practical terms:

1. session truth is readable
2. picker truth is readable
3. UI state machine reflects the normalized truth
4. only then implement sync, draft, append, or publish

If you implement the write path before the read chain stabilizes, every failure will be harder to localize.

### Step 7. Replace Placeholder UI With State-Driven UI

The UI layer must never decide auth truth on its own.

The controller or page workflow should:

- ask the ViewModel or workflow layer for a session snapshot
- use normalized picker snapshots for selection state
- show login only when the session snapshot actually says `needs-login`
- disable save or publish when no target is selected
- keep `loading`, `ready`, `empty`, `needs-login`, and `error` distinct

### Step 8. Implement The Real Write Path

Only after the read chain is stable, implement the write path in the same background-first architecture.

Examples:

- create a Notion row page, then append text blocks
- create a Medium draft story, then patch content
- create a Substack draft post, then update title, body, and visibility
- create a Dev.to draft article, then publish or keep draft status

Prefer explicit write-result objects that the UI can display or log.

### Step 9. Validate In Increasing Reality

Validation order should be:

1. focused repository tests
2. focused background handler tests
3. router or message contract tests
4. UI or ViewModel tests for state transitions
5. browser-level smoke using the real extension page and mocked platform endpoints
6. real-profile manual validation when the product promise depends on browser session reuse

## Deep Test Ladder

For this skill class, "tested" means more than unit tests.

### Level 1. Contract Tests

- message contracts compile
- repository forwards correctly
- background handlers map errors into normalized results

### Level 2. State Machine Tests

- authenticated session shows picker, not login gate
- `needs-login` shows login gate only when real session says so
- empty and error states are not collapsed into login

### Level 3. Write Path Tests

- page target writes append correctly
- collection or publication target creates the correct destination first
- result payload returns usable identifiers or URLs

### Level 4. Browser Smoke

Use the real extension page, not a jsdom-only stand-in.

For MV3 extension smoke tests, remember these practical pitfalls from the Notion case:

- use Playwright's `chromium` channel for extension loading
- wait for the MV3 service worker before deriving the extension id
- if seeding WXT storage directly through `chrome.storage.local`, use the driver key without the `local:` prefix
- picker items may legitimately appear in multiple sections, so selectors must not assume unique text

### Level 5. Real Browser Proof

When the product promise is "browser login enough", do at least one real-profile proof:

- destination platform is logged in
- destination tab is not required to stay open
- extension still reads picker or publication targets
- write path completes or fails with a truthful error

## Placeholder UI Recognition Checklist

Use this checklist in code review whenever the visible symptom looks like an auth bug:

1. Does any click handler route directly to a login panel instead of asking the repository or ViewModel for session truth?
2. Is login state derived from a click path instead of a normalized session snapshot?
3. Are `needs-login`, `empty`, and `error` collapsed into one screen or one message?
4. Does the UI conclude the platform is unavailable before the background adapter had a chance to answer?
5. Is a missing selected target being misrepresented as an auth failure?

If any answer is yes, you are probably looking at a placeholder UI or an invalid state machine, not a real authentication failure.

## Hard Lessons From The Notion Integration

1. A fake login gate can look identical to a real auth failure until you trace the chain.
2. Browser login truth usually lives in the profile session, not in the existence of an open tab.
3. Background-first is not just an implementation detail. It is the architecture that preserves the product semantic.
4. Repository, ViewModel, and controller boundaries matter because they isolate platform parsing from UI state.
5. Do not build the write path until session and picker truth are already stable.
6. Browser smoke is where extension loading, service workers, storage keys, and duplicate UI targets finally show their real behavior.
7. **Endpoint and signal names lie.** `editedPages` returned database rows and omitted databases. Validate name against live response before modeling.
8. **`block.type` is not the entity kind.** A `page` block with `parent_table === 'collection'` is a database row, not a page. Build disambiguator helpers and route every entity through them.
9. **One endpoint, multiple containers.** When a response has both a results array and a `recordMap`, enumerate every container and decide which is authoritative for each entity kind. The named array almost always omits something.
10. **Fictional fixtures hide real bugs.** A fixture that mirrors what your parser expects, instead of a captured real response, will let broken parsers stay green forever.
11. **A green test suite + an unchanged user symptom = wrong diagnosis layer.** Re-capture the live response before iterating; do not change patches on the same layer.
12. **Drilldown bugs and root-list bugs are different problems.** Fixing inline-DB visibility inside a page is not the same as fixing root-level DB visibility in the picker. Map the symptom to the exact chain segment before patching.

## Anti-Patterns

Avoid these failures:

1. Hardcoding `showLoginRequired()` in UI interactions before a real session read exists.
2. Equating "destination tab is open" with "user is authenticated".
3. Letting extension pages call platform endpoints directly when background-first is the intended contract.
4. Implementing publish or sync before recent and search reads are trustworthy.
5. Conflating `needs-login`, `empty`, and `error` into one dead-end screen.
6. Declaring success based only on unit tests when the real product promise depends on extension runtime behavior.
7. **Iterating only the named results container** (`signals[].data`, `results[]`, `items[]`) and ignoring the parallel `recordMap` / `included` / `entities` map.
8. **Trusting the endpoint or signal name** as a contract. `editedPages` does not return all edited pages. `search` may exclude templates. `recent` may exclude databases.
9. **Hand-shaping fixtures to match the parser** instead of capturing them from a real response. The resulting test loop is closed and worthless as regression protection.
10. **Re-patching the same layer** after the user reports the symptom did not move. Re-capture live evidence first.
11. **Using the same `kind`/`type` field** from the platform without a disambiguator helper. Database rows leak into page lists; templates leak into pickers; archived items leak into recents.

## Required Output Shape

When applying this skill to a new platform, produce or verify these sections explicitly:

1. Semantic Contract
2. Architecture Choice
3. Source Truth
4. Extension Boundary Proof
5. Protocol Surface
6. **Payload Taxonomy** (entity kinds, disambiguator rules, which fields lie)
7. **Multi-Container Map** (per endpoint: which container is authoritative for which entity kind, which kinds the named results omit)
8. Normalized Models
9. UI or Workflow State Machine
10. Write Path
11. **Real-Payload Fixture Inventory** (captured live responses backing every parser test)
12. Validation Matrix
13. Residual Risks
14. Transferable Lessons

## Bundled Assets

Start from these files instead of inventing a fresh structure every time:

- worked example: `examples/example-01-notion-background-first-session-integration.md`
- pattern example: `examples/example-02-draft-only-publisher-background-first-pattern.md`
- prefilled Medium dossier: `examples/medium-draft-only-dossier-prefill.md`
- reusable case template: `examples/example-template.md`
- reusable planning dossier: `templates/platform-integration-dossier.md`
- first-platform handoff checklist: `templates/first-platform-handoff-checklist.md`

Use them in this order when handing a new platform to a teammate:

1. read the Notion example to understand the full successful chain
2. read the draft-only pattern example to avoid over-copying picker workflows
3. clone the generic dossier, then compare it with the Medium prefill for the expected level of specificity
4. run the one-page handoff checklist before implementation starts

## Repository Integration Note

In this repository, the Notion implementation teaches the full chain:

- background session and picker adapter
- chat-selection state integration
- write path through background sync
- browser-level smoke against the real extension page

Key files to study when using this skill in this repo:

- `services/real-notion-repository.ts`
- `entrypoints/background/notion.ts`
- `entrypoints/chat-selection/viewmodel.ts`
- `entrypoints/chat-selection/controllers/notion-inline.controller.ts`
- `tests/entrypoints/background-notion.test.ts`
- `tests/smoke/notion-picker.smoke.mjs`

## Final Principle

The destination platform is not the feature.

The reusable feature is this:

**Turn browser-resident auth truth into a truthful read-write integration without lying in the UI and without forcing a second auth model unless the product actually wants one.**