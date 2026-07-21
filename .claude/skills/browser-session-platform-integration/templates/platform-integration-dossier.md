# Platform Integration Dossier — Browser Session Reuse

Use this dossier before and during implementation for any destination platform that aims to reuse the browser's logged-in session.

## 1. Semantic Contract

- platform:
- feature name:
- one-sentence user promise:
- what "logged in" means here:
- does the feature require an open destination tab: yes / no / fallback only

## 2. Architecture Choice

- chosen option: A / B / C / D
- why this option fits:
- why the other options were rejected:

## 3. Auth Source Truth

- auth lives in: cookies / local storage / DOM / token / mixed
- proof that auth is already present:
- runtime that can observe it:

## 4. Extension Boundary Proof

- required host permissions:
- required connect-src origins:
- background fetch with credentials works: yes / no
- background replay proof recorded from a real request: yes / no
- known blockers:

## 5. Endpoint Inventory

| Purpose | Endpoint | Method | Auth Material | Required Headers | Notes |
|---|---|---|---|---|---|
| session read |  |  |  |  |  |
| destination discovery |  |  |  |  |  |
| draft creation |  |  |  |  |  |
| publish / append / update |  |  |  |  |  |

## 5A. Endpoint Discovery Notes

- smallest real user action used for endpoint discovery:
- network requests captured during that action:
- which requests replayed successfully from background:
- which requests failed and why:
- CSRF or anti-bot signals observed:

## 6. Normalized Models

- session snapshot fields:
- picker snapshot fields:
- destination target fields:
- write request fields:
- write result fields:

## 7. State Machine

- loading:
- ready:
- empty:
- needs-login:
- error:
- publishing:
- published:

## 7A. Destination Pattern

- chosen destination pattern: picker / implicit single destination / lightweight switcher / draft-only pipeline
- why this pattern fits this platform:
- what would make this pattern wrong:

## 8. Read Chain Plan

- background adapter file:
- repository adapter file:
- ViewModel or workflow owner:
- controller or UI consumer:

## 9. Write Chain Plan

- write path owner:
- write choreography type: append / create-draft-then-update / create-nested-destination-then-append / create-draft-then-publish
- create step:
- append / update / publish step:
- failure mapping:

## 10. Validation Matrix

| Validation Layer | Goal | Status | Notes |
|---|---|---|---|
| repository tests | message forwarding and normalization |  |  |
| background tests | endpoint mapping and platform parsing |  |  |
| router tests | message contract wiring |  |  |
| UI or ViewModel tests | state transitions are truthful |  |  |
| browser smoke | real extension page plus mocked destination APIs |  |  |
| real-profile proof | browser login enough is true in practice |  |  |

## 11. Hidden Dependencies

- profile partition assumptions:
- CSRF or anti-bot assumptions:
- publication or workspace scoping assumptions:
- private API change risk:
- placeholder UI risk review completed: yes / no

## 12. Transfer Notes

- which parts of this platform adapter are reusable:
- which parts are platform-specific only:
- what the next platform should steal from this work: