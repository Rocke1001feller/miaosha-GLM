# Case Study 01 — Gemini Old-Tab Export After Extension Reload

> **Why this example exists.** This incident turned a one-off Gemini fix into a reusable skill. The important lesson was not `how Gemini works`. The important lesson was that old-tab export resilience is a repeatable incident family with stable layers, stable decision points, and reusable repair strategies.

---

## 0. Incident Snapshot

- **Date:** 2026-04-23
- **Branch:** `full-check-gemini`
- **Surface:** extension reload -> already-open Gemini tab -> delegated export
- **Comparator:** Grok old tabs exported successfully after reload
- **Prior precedent:** Perplexity had previously moved from `refresh required` to rendered-DOM recovery
- **Status:** resolved for Gemini via rendered-DOM fallback on M6 failure

---

## 1. Symptom

After `npm run build` and extension reload:

- an already-open Grok chat tab could still click `Export` and proceed normally
- an already-open Gemini chat tab failed without page refresh

The user-facing error was:

`Extraction failed (HTTP 0). Please refresh the page and try again.`

That text was misleading. The incident was not about scroll position.

---

## 2. Fresh-vs-Stale Delta

The failure only appeared in this state:

```text
Gemini tab opened before extension reload
  -> extension rebuilt / reloaded
  -> user clicks Export on the same old tab
  -> delegated export reaches M6
  -> export fails
```

The same conversation succeeded when:

- the page was refreshed after reload
- or the conversation was opened in a new tab after reload

This immediately narrowed the problem from `Gemini parser bug` to `old-tab state after extension reload`.

---

## 3. Source Truth

The source truth was not `Gemini should behave like Grok internally`.

The source truth was:

- on a fresh Gemini page, export succeeded
- the page visibly still contained the full conversation on the old tab
- the user requirement was `old tab no-refresh export should still work`

That means the recovery target was valid even if Gemini needed a different technical route than Grok.

---

## 4. Target Truth

After extension reload, an already-open Gemini tab should still be able to export without a manual page refresh, while preserving:

- visible conversation text
- message order
- images
- Gemini thinking when visible and recoverable
- chat-selection preview parity
- downstream export correctness

---

## 5. Chain Map

The actual chain was:

```text
extension reload / service worker restart
  -> already-open Gemini source tab
  -> content-main document_start interceptor is gone on that old tab
  -> M1 capture is absent
  -> delegated export falls through to M6
  -> Gemini M6 must reconstruct auth/bootstrap context from the page
  -> if M6 fails, there was originally no second recovery path
  -> extraction pipeline surfaces generic HTTP 0 / scroll-to-top text
```

This was not a renderer issue, not a filename issue, and not a generic export pipeline issue.

---

## 6. Working Comparator And Internal Learning

Two comparisons mattered.

### Comparator A — Grok

Grok old tabs still exported after reload.

Investigation showed why:

- Grok M6 uses stable cookie/session-backed REST endpoints
- it does not require the same fragile page-bootstrap reconstruction Gemini needs
- Grok success on old tabs did not depend on surviving M1 state

### Comparator B — Perplexity

Perplexity had historically suffered from the same class of problem and had already been fixed.

The key learning from the Perplexity diff was not `copy the code`.

It was:

**when M6 becomes unreliable on a stale tab, rendered DOM can become the honest second truth source.**

Perplexity had already proven this recovery pattern in the repo:

- `shouldRecoverFromRenderedDom(result)`
- `executeRenderedDomFallback(...)`
- preserve the original fetch failure if DOM recovery also fails

That converted the Gemini task from a platform mystery into a known incident pattern.

---

## 7. Real Evidence

### Evidence 1 — Old tabs lost M1 state

Real browser checks on Gemini and Grok pages showed old tabs no longer had reliable `window.__apiInterceptorInstalled` / `window.__apiCaptures` after the extension reload.

This proved the issue lived in the `M1 gone, M6 must recover` class.

### Evidence 2 — Gemini M6 was bootstrap-sensitive

Gemini M6 did not use a simple cookie-backed REST path.

It scraped page bootstrap values from inline scripts:

- `SNlM0e` -> `at`
- `cfb2h` -> `bl`
- `FdrFJe` -> `f.sid`

These values were required to POST to `/_/BardChatUi/data/batchexecute`.

Real-page validation confirmed sensitivity:

- real values -> request succeeded
- fake `at` -> HTTP 400

So Gemini was not `Grok but failing`. Gemini belonged to a different M6 dependency class.

### Evidence 3 — The old tab still contained enough visible truth

Chrome DevTools inspection of the real Gemini page showed:

- visible `You said` and `Gemini said` turn markers
- visible answer text
- visible inline images
- a `Show thinking` control
- expanded thinking text could be read from the DOM after interaction

This was the decisive pivot.

It proved that even when M6 was fragile, the rendered old tab still carried enough semantics to recover export honestly.

---

## 8. Platform Classification

Gemini was classified as:

**Class B — bootstrap-sensitive M6 with viable rendered-DOM recovery**

That meant the correct fix was:

- keep M6 as the first attempt
- add rendered-DOM fallback only when M6 bootstrap recovery fails
- land the fallback inside the Gemini platform slice, not in shared consumers

---

## 9. Wrong Paths That Were Avoided

These would all have been wrong-layer fixes:

1. patch chat-selection rendering
2. force refresh unconditionally because Gemini is not Grok
3. widen the global platform contract before proving it was needed
4. recover only plain text and ignore thinking / images
5. treat `scroll to top` as the root cause

The incident only moved once the team stopped asking `why isn't Gemini like Grok?` and started asking `which truth source survives Gemini old tabs after reload?`

---

## 10. Fix At The Correct Layer

The fix was intentionally local.

### File 1 — `services/platform-slices/gemini/index.ts`

Added the Perplexity-style recovery structure:

- `shouldRecoverFromRenderedDom(...)`
- `executeRenderedDomFallback(tabId)`
- M6 keeps running first
- if M6 fails or cannot parse batchexecute, Gemini tries rendered-DOM recovery
- if DOM recovery succeeds, the platform returns a parser-compatible fallback payload
- if DOM recovery fails, the original M6 failure is preserved

### File 2 — `services/platform-slices/gemini/parser.ts`

Added a minimal parser-local fallback branch:

- detect `__fallback: 'gemini-dom'`
- parse the synthetic fallback payload into normal `ParseResult`
- keep images and thinking in the same downstream shape chat-selection and exports already expect

This was deliberate.

The team did **not** widen the global platform contracts first. The fallback landed at the smallest local boundary that could preserve current public behavior.

---

## 11. Why This Was The Right Fix

This fix respected the chain.

- The first missing truth source after reload was M1, not the renderer.
- The fragile layer was Gemini's bootstrap-sensitive M6.
- The surviving truth source was the rendered DOM.
- The correct landing zone was the Gemini slice and Gemini parser, not shared export consumers.

Once recovery happened there, downstream preview and export consumers resumed naturally.

---

## 12. Regression Protection

Three focused protections were added.

### Slice tests

`tests/services/platform-slices/gemini-slice.test.ts`

- recovery succeeds when M6 bootstrap reconstruction fails but DOM fallback returns a recoverable conversation
- original Gemini M6 failure is preserved when DOM recovery finds nothing usable

### Parser test

`tests/services/gemini-parser.test.ts`

- parser can consume the rendered-DOM fallback payload without disturbing the normal Gemini batchexecute path

### Broader validation

- focused touched-slice tests passed
- full unit suite passed except for unrelated pre-existing repo issues
- production build passed

---

## 13. Reusable Lessons

This incident became a reusable skill because it taught durable rules.

1. `Old tab after reload` is a platform-runtime incident family, not a parser family.
2. Grok is a UX comparator, not a transport template.
3. The right first question is `what truth source survived?`
4. Perplexity established the repo pattern: M6 first, rendered-DOM fallback second, preserve original failure if fallback also fails.
5. Parser-local fallback shapes are often the best first landing zone.
6. Recovery is incomplete if it restores only text and loses images or thinking.

---

## 14. Residual Risks

Two risks remained visible even after the fix.

1. The background extraction pipeline still used generic `scroll to top` messaging for many M6 failures, which can obscure diagnosis.
2. DOM fallback depends on visible page semantics. If Gemini significantly changes its DOM landmarks, the fallback may need maintenance.

These risks do not invalidate the fix. They just mark the next layer of hardening.

---

## 15. Why This Example Belongs In The Skill

Gemini was the moment the team stopped thinking in platform-specific one-offs and started treating stale old-tab export as a reusable incident class.

That is why this example is not just `Gemini notes`.

It is the proof that the skill's abstract method can be grounded in a real repository fix:

- a real user symptom
- a real comparison with Grok
- a real internal lesson from Perplexity
- real browser evidence
- a local code fix
- focused regression protection