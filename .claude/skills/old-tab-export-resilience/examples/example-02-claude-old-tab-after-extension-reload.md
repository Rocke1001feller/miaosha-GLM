# Case Study 02 — Claude Old-Tab Export After Extension Reload

> **Why this example exists.** Gemini taught the team how to recover a bootstrap-sensitive platform through rendered DOM. Claude taught the second half of the lesson: sometimes the recovery path already exists, but an older upstream gate still blocks the user before recovery even runs.

---

## 0. Incident Snapshot

- **Date:** 2026-04-23
- **Branch:** `full-check-gemini`
- **Surface:** delegated export -> already-open Claude tab after extension reload
- **Comparator:** Grok and fixed Gemini old tabs were allowed to continue exporting after reload
- **Status:** resolved by removing stale-bridge hard-blocking for Claude

---

## 1. Symptom

The user wanted Claude to behave like Grok:

- extension reloads
- an already-open Claude chat tab remains open
- user clicks `Export`
- export should continue without manual page refresh

Instead, Claude still surfaced a hard refresh requirement on old tabs.

---

## 2. Fresh-vs-Stale Delta

Claude fresh tabs were no longer the interesting case.

The important delta was:

```text
Claude tab opened before extension reload
  -> extension reloads
  -> source-tab bridge probe fails
  -> delegated export returns refresh-required error before extraction starts
```

That meant the failure might not be in Claude extraction at all.

---

## 3. Source Truth

By the time this incident was revisited, Claude already had:

- `extractViaM6()` in `services/platform-slices/claude/runtime.ts`
- a rendered-DOM recovery path when runtime-derived organization discovery failed
- parser coverage proving Claude fallback payloads could still be normalized

So the source truth was:

**Claude already had a platform-local recovery path that should have been capable of old-tab export.**

---

## 4. Target Truth

After extension reload, an already-open Claude tab should still be allowed to enter the normal delegated export flow and attempt Claude recovery, rather than being blocked purely because the source-tab bridge is stale.

---

## 5. Chain Map

The relevant chain was:

```text
extension reload
  -> already-open Claude tab
  -> source-tab bridge probe returns false
  -> delegate-export checks stale-bridge policy
  -> Claude is hard-coded as refresh-required
  -> handleDelegateExportFlow returns error early
  -> extractConversation never runs
  -> Claude M6 / rendered-DOM recovery is never reached
```

This chain mattered because it showed the first break was upstream of extraction.

---

## 6. Eliminated Layers

Several tempting layers were ruled out immediately.

### Not the parser

Claude parser tests already covered fallback-compatible payloads and normalized outputs.

### Not the runtime recovery path

`tests/services/platform-slices/claude-slice.test.ts` already proved the platform slice could:

- recover from `Could not determine Claude organization id from page runtime`
- fall back to `Recovered from rendered Claude DOM`
- preserve the original Claude M6 failure when DOM recovery found nothing usable

### Not chat-selection or export consumers

The flow never got far enough for preview or export rendering to matter.

---

## 7. Real Evidence

The decisive evidence was in the delegated export tests and control path.

### Evidence 1 — early hard block existed

`entrypoints/background/delegate-export.ts` contained:

```ts
const STALE_SOURCE_TAB_BRIDGE_PLATFORMS = {
  claude: 'Claude',
};
```

That meant Claude was singled out for a refresh-required error whenever the source-tab bridge probe failed.

### Evidence 2 — the old test encoded the old product decision

`tests/entrypoints/background-extraction-pipeline.test.ts` explicitly asserted:

- stale Claude bridge -> immediate failure
- `extractConversation` must not be called

That was the local proof that the current product behavior was still locked to the old assumption.

### Evidence 3 — Claude recovery already existed downstream

The Claude slice tests proved the downstream recovery path already existed.

So the real question was no longer `can Claude recover?`

It was:

`why are we preventing Claude from trying?`

---

## 8. Platform Classification

Claude, in this incident phase, was classified as a combined case:

- **Class C** at the extraction layer: runtime-derived M6 with rendered-DOM recovery
- **Class D** at the delegated-export layer: stale bridge should not hard-block export once recovery exists downstream

This is why the fix differed from Gemini.

Gemini's first break was inside the platform slice.
Claude's first break was earlier, in the delegate-export policy layer.

---

## 9. Root Cause

Claude old-tab export was still failing because delegated export retained an outdated hard-coded stale-bridge gate for Claude.

That gate was correct before Claude had a viable recovery path.

After Claude gained M6 + rendered-DOM recovery, the gate became the new first distortion layer:

- it assumed stale bridge implied unrecoverable export
- it returned refresh-required immediately
- it prevented the actual recovery path from executing

---

## 10. Fix At The Correct Layer

The fix was intentionally narrow.

### File 1 — `entrypoints/background/delegate-export.ts`

Removed Claude from `STALE_SOURCE_TAB_BRIDGE_PLATFORMS` so stale bridge no longer hard-blocks Claude delegated export.

This changed the product behavior from:

- `stale bridge => stop before extraction`

to:

- `stale bridge => skip loading/error UI, but continue into extraction and let Claude recovery decide`

### File 2 — `tests/entrypoints/background-extraction-pipeline.test.ts`

Replaced the old blocking test with a new regression that asserts:

- stale Claude bridge no longer blocks export
- `extractConversation` can proceed
- pending export staging and tab handoff still occur
- no loading UI is shown when the bridge is gone

This was the right layer because the first break was in delegate-export policy, not parser, runtime, or consumer code.

---

## 11. Why This Was The Right Fix

This incident is the complementary lesson to Gemini.

Gemini required adding a recovery path.

Claude required removing an obsolete upstream gate so the existing recovery path could run.

If the team had patched Claude runtime again, it would have been wrong-layer work, because runtime recovery was never being reached.

---

## 12. Regression Protection

Two protections matter here.

### Existing downstream protection

`tests/services/platform-slices/claude-slice.test.ts`

already protects Claude's platform-local recovery behavior.

### New upstream protection

`tests/entrypoints/background-extraction-pipeline.test.ts`

now protects the delegated-export policy boundary so Claude cannot silently regress back to refresh-required gating.

---

## 13. Reusable Lessons

This example adds a second major rule to the skill.

1. Not every old-tab incident is solved by adding more recovery logic.
2. After a platform gains recovery, older product gates may become the new first failure layer.
3. `stale bridge` and `unrecoverable extraction` are different claims and must not be conflated.
4. If stale bridge only removes loading/error UI, export should usually still proceed.
5. The right fix can be `remove the obsolete guard`, not `add another fallback`.

---

## 14. Residual Risks

Residual risks after this fix:

1. Claude old-tab success still depends on the current DOM landmarks and runtime recovery assumptions inside the Claude platform slice.
2. Generic background extraction error messaging still deserves future hardening so users see clearer recovery-stage failures.

---

## 15. Why This Example Belongs In The Skill

Without Claude, the skill would teach only one shape:

- `M6 fragile -> add DOM fallback`

Claude proves a second essential shape:

- `recovery already exists -> remove stale upstream blocking`

That makes the skill materially stronger for future platforms, because it teaches teams to ask not only:

- `what fallback is missing?`

but also:

- `what old assumption is still preventing the fallback from running?`