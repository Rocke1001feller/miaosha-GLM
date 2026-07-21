# Case Study 04 - Perplexity Citations: Dual-Truth Snapshot + Reload-Reextract-New-Page Chain Bisection

> Why this example exists. This is the standard chain-first pattern for incidents where users report that source-page citations look fine but extension output loses citation behavior or formatting. The key was not a new regex. The key was disciplined evidence capture at both ends of the chain, plus a deterministic extension operation loop that removed stale-cache ambiguity.

---

## 0. Incident Snapshot

- Platform: Perplexity
- Representative conversation: `9c18c901-d796-4c79-899f-07582d2ab3d0`
- Reported symptoms:
  - formatting still degraded
  - `weixin.qq` citation behavior not effective in chat-selection
- Root-cause class: parser normalization mismatch with source token shape
- Investigation method: dual-truth snapshot + coherent popup export loop

---

## 1. Symptom (Not Cause)

User-visible symptom in chat-selection:

- source list may exist, but inline citation behavior is inconsistent
- citation text in prose can still appear as domain-like tokens (`weixin.qq`, `qks.sufe.edu +1`) instead of interactive marker-resolved chips
- timeline-like paragraphs look glued after export

Natural but wrong shortcut:

- patch renderer CSS first

Chain-first requirement:

- prove whether distortion starts in extraction/parser or in renderer/enricher

---

## 2. Source Truth And Target Truth

### Source Truth

From the Perplexity source page DOM snapshot:

- citation semantics can appear as domain-like chip tokens, not always numeric markers
- source links are present in page anchors / source areas
- text structure around timeline sections contains line boundaries that should survive into target rendering

### Target Truth

From chat-selection page after export:

- storage payload should contain assistant `sources` and `citationMap`
- assistant `content` should use marker shape compatible with resolver (`[^N^]`)
- rendered DOM should show citation chips, sources block, and no stale citation badges

---

## 3. Chain Map

```text
Perplexity source DOM
  -> extension extraction path (M1/M6, fallback aware)
  -> Perplexity parser normalization
  -> chat_export_<id> storage payload (data truth)
  -> chat-selection renderer/enricher (DOM truth)
```

The incident is solved only when both target layers agree:

1. storage truth is semantically correct
2. rendered DOM truth consumes it correctly

---

## 4. The Two SOP Techniques That Made This Investigation Deterministic

### Technique A: Dual-Truth Snapshot

Capture two snapshots every run:

1. source page snapshot (platform truth)
2. target page snapshot with two layers:
   - storage payload truth
   - rendered DOM truth

This prevents the classic anti-pattern:

- patching renderer while parser output is already distorted

### Technique B: Coherent Extension Operation Loop

Always run this exact sequence before taking target evidence:

1. reload extension
2. re-focus source URL
3. trigger popup
4. click export in popup
5. inspect a fresh chat-selection page for this run

This prevents stale-page and stale-cache false negatives.

---

## 5. Evidence Procedure (Replayable)

### A. Source Snapshot

1. select Perplexity source tab
2. `take_snapshot`
3. `evaluate_script` for:
   - token shape (`[N]`, `[^N^]`, domain-like tokens)
   - source-link count/sample
   - representative text segment

### B. Operation Loop

1. `reload_extension { id: EXT_ID }`
2. reselect source tab
3. open popup (`trigger_extension_action` or popup URL fallback)
4. click popup export button
5. discover new `chat-selection.html?id=...`

### C. Target Snapshot (Two Layers)

1. in chat-selection, read `chrome.storage.local` for `chat_export_<id>`
2. extract assistant `sources`, `citationMap`, marker sample from `content`
3. `take_snapshot`
4. collect rendered metrics:
   - citation chip count
   - source block count
   - stale badge count
   - rendered prose head

---

## 6. Distortion-Layer Decision Table

| Observation | First distortion layer |
|---|---|
| source has citation semantics, storage has no sources/citationMap | extraction/parser |
| storage has sources/citationMap + `[^N^]`, rendered still no chips | renderer/enricher |
| source tokens are domain-like, storage still domain-like (not normalized) | parser token normalization |
| rendered chips exist but stale badges dominate | citationMap-source alignment |

In this incident class, the decisive pattern was:

- source token shape was domain-like
- storage still needed parser-side normalization to resolver-compatible markers

So the first distortion layer was parser normalization, not renderer CSS.

---

## 7. Root Cause In This Case Pattern

Perplexity DOM/fallback citation semantics can be domain-chip style (`weixin.qq`, `qks.sufe.edu +N`), while chat-selection resolver expects marker-style references (`[^N^]`) with coherent `citationMap` indexing.

When parser output preserved domain tokens without normalization, renderer had no valid inline marker contract to consume. The symptom appeared in chat-selection, but distortion started earlier.

---

## 8. Correct-Layer Fix Pattern

Patch parser boundary, not renderer cosmetics:

- extract source metadata from both API and fallback shapes
- build citation map from resolved source order
- normalize domain-style citation tokens to `[^N^]`
- keep spacing/paragraph repair near parser output where text semantics are still explicit

Then verify renderer naturally recovers without renderer-specific hacks.

---

## 9. Regression Protection

For this incident class, regression coverage must include:

1. DOM fallback source extraction with object-array `entry.sources`
2. domain-style token normalization to marker style
3. grouped count token guard (avoid explosive marker expansion)
4. API web-result path parity with fallback path
5. no-source path remains clean

---

## 10. Why This Example Is A Standard SOP Example

This case turned a vague debugging loop into an operational standard:

- evidence from both ends before edits
- deterministic extension operation loop before target capture
- explicit distortion-layer table to choose fix boundary

Use this template whenever a user says:

- "source page is fine, export/chat-selection is wrong"
- "citation chips missing or not clickable"
- "I think refactor broke parser/renderer boundary"
