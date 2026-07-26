# Example 02 — Draft-Only Publisher Background-First Pattern

> **Why this example exists.** The Notion example teaches a picker-first destination model. This example exists to teach the opposite shape: a publisher where the first truthful milestone is simply "create a draft and return the URL." It is a pattern example for Medium-, Substack-, and Dev.to-like platforms. It is intentionally concrete, but it is not a claim that this repository already ships one of these integrations.

---

## 0. Snapshot

- **Platform class:** draft-only publisher
- **Representative targets:** Medium, Substack, Dev.to
- **Architecture choice:** A as the target, D as the explicit fallback if background replay cannot truthfully satisfy write prerequisites
- **User promise:** If the browser profile is logged into the publisher, the extension can create a draft and return a draft URL without forcing OAuth and without requiring the publisher tab to stay open
- **Integration class:** draft-only pipeline, with optional lightweight switcher
- **Root lesson:** the first risk is often not authentication failure. It is copying a picker workflow into a platform whose real first value is draft creation

---

## 1. Starting Symptom

Teams that just finished a Notion-like integration often overgeneralize the previous solution.

The next publisher platform gets framed as:

1. add recent targets
2. add search
3. add a picker
4. then maybe add publish

For a draft-only publisher, that order is usually backwards.

The first valuable proof is not "can the UI search destinations?"
The first valuable proof is "can the extension create a draft and return a truthful URL under the logged-in browser session?"

---

## 2. Source Truth And Target Truth

### Source Truth

- the browser profile is already logged into the publisher
- a human can manually create a new draft in that profile
- the publisher may expose additional write prerequisites beyond cookies, such as CSRF or editor bootstrap state

### Target Truth

When the browser session is valid, the extension should be able to:

1. prove the user is authenticated enough to create drafts
2. create a draft through the truthful platform write path
3. update title and body in a normalized internal write sequence
4. return a draft URL or truthful failure

No heavy destination picker is needed unless live evidence proves that users must choose among multiple first-class destinations before draft creation.

---

## 3. The Real First Break

The first break in this platform class is usually product modeling, not transport.

The wrong question is:

"How do we build the next picker?"

The right question is:

"Is the platform's real unit of value a destination choice, or simply a draft slot that can be created immediately?"

If you answer the wrong question first, the implementation accumulates unnecessary search state, target selection logic, and fake login edges before the team has even proven the write choreography.

---

## 4. Chosen Architecture

The default architecture for this pattern should be:

```text
browser profile publisher session
  -> background-first authenticated replay
  -> normalized session or draft-capability snapshot
  -> minimal workflow state machine
  -> create-draft step
  -> update-draft step
  -> return draft URL or truthful failure
```

This preserves the right product semantic:

- no OAuth by default
- no requirement to keep a publisher tab open
- no fake picker workflow when the platform does not actually need one

---

## 5. Read Chain Implementation Goal

The read chain is intentionally smaller than the Notion picker case.

The minimum read chain should answer only these questions:

1. is the browser session authenticated enough to create a draft?
2. is there a default destination or only a small set of publication choices?
3. what identifiers are required for the create-draft call?

That means the normalized read model is usually one of these two shapes:

### Implicit destination

- session status
- can create draft
- default destination label

### Lightweight switcher

- session status
- can create draft
- small list of publication or org targets

What it usually is not:

- a large search surface
- a recent-target explorer
- a destination tree

---

## 6. Write Chain Implementation Goal

The write chain should be modeled explicitly.

Most draft-only publishers fit this sequence:

1. create draft shell
2. receive draft identifier or URL
3. update title
4. update body
5. update metadata such as tags, canonical URL, subtitle, or visibility
6. optionally publish later

The critical engineering rule is:

Do not collapse all of these into one black-box "publish" call in the extension model.

The repository and background adapter should expose normalized write request and write result objects so the UI can understand whether the system:

- created a draft but failed to patch body
- created and updated a draft successfully
- failed before any draft was created

---

## 7. State Machine Shape

The workflow state machine is usually simpler than a picker flow:

- `loading`
- `ready`
- `empty`
- `needs-login`
- `error`
- `publishing`
- `published`

The usual UI differences from a Notion-like picker are:

- no search box by default
- no target selection requirement before the first draft proof unless the platform actually needs it
- success is a draft URL first, not necessarily a published URL

---

## 8. Hidden Dependencies

This platform class concentrates risk in a different place from Notion.

### High-probability hidden dependencies

- CSRF or anti-bot behavior on write requests
- editor bootstrap tokens that exist only after the web editor loads
- body serialization format differences between markdown, rich text JSON, or HTML
- publication selection that appears only after draft creation or inside the editor
- retries accidentally creating duplicate drafts if idempotency is not modeled

That means the cheapest discriminating proof is usually:

"Can background replay create one draft successfully and return one stable URL?"

---

## 9. Validation Matrix

The validation ladder for this platform class should be:

1. repository tests for session snapshot and write result normalization
2. background tests for create-draft and update-draft endpoint choreography
3. router tests for message boundaries
4. UI or workflow tests proving there is no fake login gate and no fake target-selection requirement
5. browser smoke proving authenticated draft creation through the real extension page with mocked publisher endpoints
6. real-profile proof that a logged-in browser can create a draft without keeping the publisher tab open

This is deliberately smaller than the Notion picker surface, but it is not lower quality.

---

## 10. Practical Pitfalls

### Pitfall 1. Copying the Notion picker into a platform that does not need a picker

This creates unnecessary UI and hides the real architectural unknowns.

### Pitfall 2. Treating draft creation and publish as the same milestone

For many publishers, returning a reliable draft URL is the first meaningful product win.

### Pitfall 3. Misclassifying CSRF or anti-bot failures as auth failures

Cookies can be valid while the write path still fails for architecture reasons.

### Pitfall 4. Letting the UI require a selected destination before draft creation is even proven

That is the draft-only equivalent of a fake login gate.

### Pitfall 5. Ignoring duplicate-draft risk in retry flows

If write retries are not modeled, transient failures can create multiple drafts and confuse users.

---

## 11. Final Outcome

When this pattern is implemented well, the extension can truthfully say:

"You are already logged in. I created a publisher draft for you. Here is the draft URL."

That is often the correct first milestone before full publication switching, scheduling, or one-click publish is attempted.

---

## 12. Transferable Lessons

1. Not every destination platform deserves a picker.
2. The first proof for a draft-only publisher is create-draft, not destination search.
3. Returning a draft URL is a stronger milestone than a vague "publish supported" checkbox.
4. CSRF and anti-bot behavior often decide the architecture more than cookies do.
5. A small truthful workflow is better than a large copied UI.