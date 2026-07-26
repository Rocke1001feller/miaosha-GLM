# Case Study 02 — Citation InternalHyperlink Bookmark Resolution: Pages Rejects Table-Cell Targets and Colliding Bookmark IDs

> **Why this example exists.** Case Study 01 taught that Pages can ignore otherwise-correct paragraph layout because the style chain is under-specified. This incident adds a different class of failure: a DOCX can contain matching `InternalHyperlink` anchors and bookmark names, pass unit tests, and still fail in Pages because the bookmark identity and placement semantics are wrong for Pages' importer. The key lessons are that `Bookmark` IDs must be unique in the OOXML, bookmark targets inside table cells are unsafe in Pages, and bare `source-${refId}` anchor names are not globally safe across multiple cited messages.

---

## 0. Incident Snapshot

- **Date:** 2026-05-16 (investigation and fix committed)
- **Branch:** `polish-v2.0.0-release`
- **Surface:** DOCX export → inline citation markers `[n]` linking to the source appendix
- **Symptom in Pages:** Clicking an inline citation marker such as `[2]` showed Pages' dialog: "There's no bookmark for this link."
- **Severity:** High — citation navigation semantics were broken even though the text and source list rendered correctly
- **Status:** Resolved — 38 DOCX tests pass; real Pages click behavior now jumps from inline citation markers to the correct source entries

---

## 1. What Was Observed (Symptom, Not Cause)

The exported DOCX showed compact inline citation markers like `[2]` and a numbered `Sources (...)` section. The visible text looked right. The generated `word/document.xml` also appeared promising: inline references were serialized as `<w:hyperlink w:anchor="...">` and the source entries emitted matching `<w:bookmarkStart w:name="...">` nodes.

Despite that, clicking `[2]` or `[0]` in Apple Pages raised "There's no bookmark for this link." The same failure persisted even after the first attempted fix, which made the incident look like either a Pages limitation or a bad architectural choice.

---

## 2. Wrong Hypotheses Eliminated First

**Hypothesis A: Apple Pages does not support DOCX internal hyperlinks at all.**

Investigation: This was plausible because the first implementation used the textbook `Bookmark + InternalHyperlink` pattern and Pages still failed. Eliminated after the final fix: the same `InternalHyperlink` approach works in Pages once the bookmark target structure is valid for Pages.

**Hypothesis B: Matching `w:anchor` and `w:name` strings are sufficient.**

Investigation: The generated XML already contained matching names, but Pages still rejected the target. This eliminated the assumption that string equality alone proves a valid bookmark target. Bookmark identity and placement also matter.

**Hypothesis C: The only bug is duplicate bookmark numeric IDs.**

Investigation: Inspecting the `docx` library source showed that `new Bookmark(...)` created a fresh per-instance numeric counter, so every bookmark serialized with `w:id="1"`. Fixing that bug was necessary, but the user still reproduced the Pages failure afterward. Eliminated as a complete explanation.

**Hypothesis D: A bookmark inside a DOCX table cell is equivalent to a top-level paragraph bookmark.**

Investigation: A focused probe compared two repo-generated paths: the last message's sources were emitted as top-level paragraphs, while non-final messages emitted the same source rows inside a table wrapper. The failing Pages path placed `<w:bookmarkStart>` inside `<w:tc>`. Moving the source rows out of the table resolved the click failure. Eliminated.

**Hypothesis E: Bare `source-${refId}` bookmark names are globally safe.**

Investigation: Repository memory and a follow-up regression test showed that multiple cited assistant messages can each contain `[^1^]`. Reusing `source-1` globally causes collisions across messages even when each individual source block looks correct in isolation. Eliminated.

---

## 3. Chain Map

```text
source intent (inline citation marker should jump to the matching source row)
  → DOCX export code rewrites [^n^] into InternalHyperlink anchors
    → source appendix rows emit Bookmark targets
      → docx library serializes matching names into word/document.xml
        → BUT built-in Bookmark emits duplicate numeric w:id values
          → AND non-final source blocks are wrapped in a table, placing bookmarks inside w:tc
            → AND bare source-${refId} names can collide across messages
              → Pages importer cannot resolve a unique, stable bookmark target
                → visible symptom: clicking [n] shows "There's no bookmark for this link."
```

**First distortion layer:** `word/document.xml` — the bookmark target semantics were invalid for Pages even though the visible text and string names looked correct.

---

## 4. The Pages Validation Strategy

This incident required a slight variation on the usual round-trip reference method.

1. Confirmed the repo export generated matching `w:anchor` and `w:name` values for citations.
2. Added a minimal probe via the repo's DOCX test harness to compare two shapes:
   - non-final message citation sources rendered inside a table wrapper
   - final message citation sources rendered as top-level paragraphs
3. Inspected the generated `word/document.xml` fragments directly to verify where `<w:bookmarkStart>` landed.
4. Read the `docx` library implementation to inspect how `Bookmark` generated numeric `w:id` values.
5. Used real Pages click behavior on the imported DOCX as the acceptance gate.

**Why no Pages-written DOCX diff was used as the main proof:** Pages strips or rewrites hyperlink/bookmark OOXML semantics when exporting DOCX. For this bug class, the authoritative acceptance signal is the click behavior in the original imported Pages document, not the round-tripped DOCX package.

---

## 5. OOXML Inspection Result

**Broken package — duplicate bookmark IDs and table-cell target:**
```xml
<w:hyperlink w:history="1" w:anchor="source-2">...</w:hyperlink>
...
<w:tc>
  <w:p>
    <w:bookmarkStart w:name="source-2" w:id="1"/>
    <w:r><w:t>[2] </w:t></w:r>
    <w:bookmarkEnd w:id="1"/>
  </w:p>
</w:tc>
...
<w:bookmarkStart w:name="source-7" w:id="1"/>
```

**Fixed package — unique IDs, message-scoped names, and top-level paragraph target:**
```xml
<w:hyperlink w:history="1" w:anchor="msg-assistant-citations-source-2">...</w:hyperlink>
...
</w:tbl>
<w:p>
  <w:bookmarkStart w:name="msg-assistant-citations-source-2" w:id="1"/>
  <w:r><w:t>[2] </w:t></w:r>
  <w:bookmarkEnd w:id="1"/>
  ...
</w:p>
<w:p>
  <w:bookmarkStart w:name="msg-assistant-citations-source-7" w:id="2"/>
```

**Bisection result:** The failure was caused by two stacked OOXML problems, not one: duplicate numeric bookmark IDs from the `docx` library implementation, and bookmark targets emitted inside table cells. Anchor-name collisions across messages were a third latent failure mode that needed to be fixed before declaring the design safe.

---

## 6. The Fix

**Location:**
- `services/export-docx/citations.ts`
- `services/export-docx/message.ts`
- `services/export-docx/blocks/sources.ts`
- `services/export-docx/bookmarks.ts`

**Mechanism:** Keep the official `InternalHyperlink` strategy, but repair the surrounding target semantics:
- replace docx's duplicate bookmark numeric IDs with a document-level counter
- scope citation anchor names by `message.id`
- emit citation source bookmarks as top-level paragraphs instead of table-wrapped blocks

**Key code change:**
```ts
export function getCitationAnchor(messageId: string, refId: number): string {
  return `msg-${sanitizeBookmarkToken(messageId)}-source-${refId}`;
}

export function createUniqueBookmark(name: string, children: TextRun[]): Bookmark {
  const bookmark = new Bookmark({ id: name, children });
  const uniqueId = getNextDocxBookmarkId();
  (bookmark as unknown as { start: BookmarkStart }).start = new BookmarkStart(name, uniqueId);
  (bookmark as unknown as { end: BookmarkEnd }).end = new BookmarkEnd(uniqueId);
  return bookmark;
}

// Apple Pages fails to resolve internal hyperlinks that target
// bookmarks nested inside table cells, so sources must stay as
// top-level paragraphs rather than table-wrapped blocks.
groups.push({ blocks: buildSourcesParagraphs(block, message.id), passthrough: true });
```

---

## 7. Regression Tests Added

In `tests/services/docx-export.service.test.ts`:

**Test 1 — bookmark IDs remain unique:**
```ts
const bookmarkIds = [...documentXml.matchAll(/w:bookmarkStart[^>]*w:id="(\d+)"/g)].map((m) => m[1]);
expect(new Set(bookmarkIds).size).toBe(bookmarkIds.length);
```

**Test 2 — non-final message citation targets stay outside tables:**
```ts
const bookmarkMarker = `w:bookmarkStart w:name="${getCitationAnchor('assistant-cited', 2)}"`;
const bookmarkPos = documentXml.indexOf(bookmarkMarker);
const lastTableStart = documentXml.lastIndexOf('<w:tbl>', bookmarkPos);
const lastTableEnd = documentXml.lastIndexOf('</w:tbl>', bookmarkPos);
expect(lastTableEnd).toBeGreaterThan(lastTableStart);
```

**Test 3 — repeated ref IDs across messages do not collide:**
```ts
const firstAnchor = getCitationAnchor('assistant-first', 1);
const secondAnchor = getCitationAnchor('assistant-second', 1);
expect(firstAnchor).not.toBe(secondAnchor);
expect(documentXml).toContain(`w:anchor="${firstAnchor}"`);
expect(documentXml).toContain(`w:anchor="${secondAnchor}"`);
```

---

## 8. Verification

1. `npx vitest run tests/services/docx-export.service.test.ts` → all 38 DOCX tests pass.
2. Rebuilt the extension and re-exported the same conversation.
3. Opened the new DOCX in Pages and clicked inline citation markers. Pages now jumps to the correct source rows instead of showing "There's no bookmark for this link."

---

## 9. Transferable Lessons

1. **Matching names do not prove a valid bookmark target:** Pages cares about the full bookmark semantics, not just `w:anchor === w:name`.

2. **Do not trust library helpers blindly:** The `docx` library's `Bookmark` helper looked correct at the API level but serialized duplicate numeric `w:id` values. When a renderer behaves irrationally, inspect the generated OOXML and the helper implementation itself.

3. **Pages can stack incompatibilities:** Fixing one plausible XML defect does not prove the incident is over. This case had at least two active failures and one latent collision hazard.

4. **Bookmark targets inside table cells are not a safe default for Pages:** If the feature depends on `InternalHyperlink` resolution, prefer top-level paragraph targets unless a real Pages probe proves the table-cell form works.

5. **Anchor namespaces matter in real exports:** A citation design that looks correct in a one-message probe can still fail in real multi-message exports if bookmark names are only `source-${refId}`. Scope anchors by message identity.

6. **Pages round-trip DOCX is not always the right oracle:** For bookmark and hyperlink incidents, use the imported Pages document's click behavior and, when useful, exported PDF link annotations as the acceptance truth. The round-tripped DOCX can discard the very semantics you are trying to study.
