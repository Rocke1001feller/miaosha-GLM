# Medium Draft-Only Dossier Prefill

Use this as a starting dossier for a Medium integration.

This file is intentionally prefilled with a mix of:

- working assumptions that fit the skill's current method
- explicit unknowns that still require live browser proof
- implementation placeholders that should be replaced with concrete evidence before coding

Do not treat this file as protocol truth.
Treat it as a disciplined starting point that prevents blank-page planning.

---

## 1. Semantic Contract

- platform: Medium
- feature name: Medium draft export
- one-sentence user promise: If the Chrome profile is already logged into Medium, the extension can create a Medium draft and return the draft URL without requiring OAuth and without requiring a persistent Medium tab.
- what "logged in" means here: the browser profile holds an authenticated Medium session that Medium honors for the minimal read plus write sequence needed to create and update a draft
- does the feature require an open destination tab: no in the target architecture; fallback only during discovery if proof is incomplete

## 2. Architecture Choice

- chosen option: A as the working target, D as the fallback if background replay cannot truthfully reproduce write prerequisites
- why this option fits: Medium looks like a draft-first publishing surface where the first meaningful milestone is "create draft and return URL", so a draft-only pipeline should be simpler than a picker-heavy destination model
- why the other options were rejected:
  - B: requiring a live Medium tab violates the desired product semantic
  - C: OAuth is heavier than the product promise currently requires
  - D: keep only as fallback if CSRF, anti-bot, or page-scoped editor state blocks true background-first writes

## 3. Auth Source Truth

- auth lives in: cookies, plus possibly page-bootstrapped CSRF or editor tokens that still need to be proven
- proof that auth is already present: user can manually open Medium while logged in and create a new story in the same browser profile
- runtime that can observe it: background is the target runtime; a logged-in Medium tab may be temporarily used only for discovery and replay proof

## 4. Extension Boundary Proof

- required host permissions: candidate origin set includes `https://medium.com/*`; add other origin families only if live capture proves they are required
- required connect-src origins: candidate origin set includes `https://medium.com`; expand only after endpoint discovery
- background fetch with credentials works: TBD
- background replay proof recorded from a real request: no
- known blockers:
  - write flow may require CSRF or editor bootstrap state beyond cookies
  - publication-scoped publishing may require additional identifiers not visible until the editor or publication switcher loads
  - anti-bot behavior is currently unknown

## 5. Endpoint Inventory

| Purpose | Endpoint | Method | Auth Material | Required Headers | Notes |
|---|---|---|---|---|---|
| session read | TBD - capture while loading Medium home, profile menu, or editor bootstrap | TBD | cookies, possibly boot payload | TBD | goal is only to prove authenticated identity and draft capability |
| destination discovery | TBD - capture only if Medium exposes publication or account switching worth surfacing | TBD | cookies, possibly CSRF | TBD | do not assume a picker is needed |
| draft creation | TBD - capture while creating a new story | TBD | cookies, possibly CSRF/editor token | TBD | this is the first critical endpoint family |
| publish / append / update | TBD - capture while saving title, body, tags, canonical URL, and draft status | TBD | cookies, possibly CSRF/editor token | TBD | split draft save from final publish if the platform does |

## 5A. Endpoint Discovery Notes

- smallest real user action used for endpoint discovery: open the Medium editor while logged in, create a new story, enter a title, enter body text, and observe whether publication switching exists before publish
- network requests captured during that action: TBD
- which requests replayed successfully from background: none yet
- which requests failed and why: none recorded yet
- CSRF or anti-bot signals observed: unknown; must be explicitly checked during draft creation and draft update replay

## 6. Normalized Models

- session snapshot fields:
  - `status`
  - `userId`
  - `displayName`
  - `defaultDestinationLabel`
  - `canCreateDraft`
  - `availablePublications?`
  - `needsLogin`
  - `diagnostic?`
- picker snapshot fields:
  - prefer none if Medium proves to be implicit-destination or lightweight-switcher only
  - if needed later: publication summaries with `id`, `name`, `slug`, `role`, `isDefault`
- destination target fields:
  - `kind` personal-profile or publication
  - `id`
  - `label`
  - `slug?`
  - `isDefault`
- write request fields:
  - `title`
  - `subtitle?`
  - `bodyMarkdownOrHtml`
  - `tags?`
  - `canonicalUrl?`
  - `publishMode` draft or publish
  - `selectedDestination?`
- write result fields:
  - `status`
  - `draftId`
  - `draftUrl`
  - `publishedUrl?`
  - `destinationLabel?`
  - `warning?`
  - `diagnostic?`

## 7. State Machine

- loading: session or editor capability proof in flight
- ready: authenticated and able to create a draft; if multiple destinations exist, switcher data is available
- empty: authenticated but no valid draft destination or publication target is available
- needs-login: authenticated session could not be proven from real source truth
- error: replay proof, parsing, or write flow failed in a way that is not equivalent to needs-login
- publishing: draft creation or draft update in flight
- published: draft created or final publish completed with a usable URL

## 7A. Destination Pattern

- chosen destination pattern: implicit single destination first, with lightweight switcher only if live discovery proves Medium accounts commonly have meaningful publication selection before or during draft creation
- why this pattern fits this platform: the first user value is usually "get my content into a draft editor and give me the URL", not "search among many arbitrary destinations"
- what would make this pattern wrong: if Medium strongly requires upfront publication selection or exposes multiple equally important destinations that users must choose before draft creation

## 8. Read Chain Plan

- background adapter file: `entrypoints/background/medium.ts`
- repository adapter file: `services/real-medium-repository.ts`
- ViewModel or workflow owner: `entrypoints/chat-selection/viewmodel.ts`
- controller or UI consumer: `entrypoints/chat-selection/controllers/medium-inline.controller.ts`

## 9. Write Chain Plan

- write path owner: background Medium adapter plus real repository bridge
- write choreography type: create-draft-then-update as the default target; add create-draft-then-publish only after draft persistence is trustworthy
- create step: issue the minimal authenticated request sequence that yields a draft identifier or draft URL
- append / update / publish step: patch title, body, metadata, and final status in explicit steps rather than conflating them into one opaque write
- failure mapping:
  - expired session -> `needs-login`
  - missing CSRF or editor token -> normalized `error` with diagnostic
  - missing destination scope -> normalized `empty` or `error` depending on truth
  - anti-bot rejection -> normalized `error` and architecture re-evaluation

## 10. Validation Matrix

| Validation Layer | Goal | Status | Notes |
|---|---|---|---|
| repository tests | message forwarding and normalization | planned | should lock session snapshot and write result shapes first |
| background tests | endpoint mapping and platform parsing | planned | focus on create-draft and update-draft separation |
| router tests | message contract wiring | planned | mirror the Notion message boundary discipline |
| UI or ViewModel tests | state transitions are truthful | planned | verify no fake login gate when draft capability exists |
| browser smoke | real extension page plus mocked destination APIs | planned | smoke should prove draft creation enables success flow without a picker |
| real-profile proof | browser login enough is true in practice | required | must be completed before claiming Option A is proven |

## 11. Hidden Dependencies

- profile partition assumptions: Medium auth cookies and any bootstrapped token source must exist in the same browser profile the extension reuses
- CSRF or anti-bot assumptions: Medium may require a CSRF token, editor bootstrap token, referer pattern, or other anti-automation signal beyond cookies
- publication or workspace scoping assumptions: publication choice may be optional, delayed, or hidden behind editor state rather than exposed through a search list
- private API change risk: high until live endpoint families and replay proof are documented
- placeholder UI risk review completed: no

## 12. Transfer Notes

- which parts of this platform adapter are reusable:
  - the draft-only state machine
  - normalized draft write request and result objects
  - the anti-picker discipline
  - the browser smoke shape for authenticated draft creation
- which parts are platform-specific only:
  - exact Medium endpoint families
  - CSRF or editor token acquisition
  - publication selection rules
  - body serialization format accepted by the write path
- what the next platform should steal from this work:
  - first prove create-draft before designing a destination picker
  - model publication selection as optional until evidence proves it is primary
  - keep draft URL return as the first completion milestone