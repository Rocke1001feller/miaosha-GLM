# First Platform Handoff Checklist

Use this before a teammate starts the first implementation of a new browser-session destination platform.

Goal:

- avoid copying the previous platform blindly
- force real source-truth proof before UI work
- hand off one platform with enough structure that the teammate can move independently

---

## 1. Contract

- [ ] One-sentence user promise is written.
- [ ] "Logged in" is defined precisely: browser cookies, open tab, OAuth, or backend token.
- [ ] The chosen success milestone is explicit: picker, draft URL, publish result, or append success.

## 2. Architecture Choice

- [ ] Option A, B, C, or D is chosen explicitly.
- [ ] Rejected options are written down, not implied.
- [ ] If Option A is claimed, someone has stated what would disprove it.

## 3. Source Truth Proof

- [ ] The real authenticated browser state has been observed in a logged-in profile.
- [ ] Placeholder UI has been separated from real session truth.
- [ ] The team knows which runtime is supposed to own truth: background, tab, or hybrid.

## 4. Endpoint Discovery

- [ ] The smallest real user action has been chosen for network capture.
- [ ] Candidate session, discovery, and write requests have been recorded.
- [ ] Replay from the intended runtime has been attempted.
- [ ] CSRF, referer, or anti-bot signals have been checked explicitly.

## 5. Destination Pattern

- [ ] The team decided whether this platform is picker, implicit destination, lightweight switcher, or draft-only.
- [ ] Nobody is copying the Notion picker by default.
- [ ] If a picker is planned, there is evidence that users truly need one.

## 6. Normalized Models

- [ ] Session snapshot shape is defined.
- [ ] Destination target shape is defined only if the platform really needs one.
- [ ] Write request and write result shapes are defined.
- [ ] Failure mapping distinguishes `needs-login`, `empty`, and `error`.

## 7. State Machine

- [ ] Loading, ready, empty, needs-login, and error are distinct.
- [ ] Publishing and published states exist if writes exist.
- [ ] No button handler decides auth truth on its own.

## 8. Write Choreography

- [ ] The write choreography is named: append, create-draft-then-update, create-nested-destination-then-append, or create-draft-then-publish.
- [ ] The first minimal write proof is identified.
- [ ] Duplicate-write or duplicate-draft risk has been considered.

## 9. Validation Plan

- [ ] Repository tests are scoped.
- [ ] Background tests are scoped.
- [ ] Router or message tests are scoped.
- [ ] UI or workflow tests are scoped.
- [ ] Browser smoke plan exists.
- [ ] Real-profile proof plan exists.

## 10. Handoff Package

- [ ] The generic dossier has been cloned and filled.
- [ ] Any platform-specific prefill has been attached.
- [ ] The teammate has both contrasting examples: Notion picker and draft-only publisher.
- [ ] Known unknowns are written as TBD items, not hidden in chat.

## Stop Conditions

Stop and re-evaluate before coding if any of these are true:

- background replay fails but the design still insists on Option A
- the team cannot say whether the platform needs a picker or a draft-only flow
- the UI mock already assumes login or target selection before source truth is proven
- write steps are being designed before the first successful read or capability proof exists

If these stop conditions appear, return to the dossier instead of pushing implementation forward.