---
name: old-tab-export-resilience
description: "Use when export works on a fresh AI chat page but fails on an already-open tab after extension reload/build/update/service worker restart; old tab export, stale tab, 旧 tab 不刷新无法导出, extension 刷新后导出失败, M1 lost, M6 auth/bootstrap drift, rendered DOM fallback, and you want Grok-style no-refresh export resilience."
---

# Old Tab Export Resilience

## Description

Use this skill when a platform can export from a fresh page, but fails from an already-open chat tab after the extension reloads, rebuilds, updates, or restarts its service worker.

Typical user phrasing:

- `extension 刷新后旧 tab 无法导出`
- `old tab export fails unless I refresh`
- `像 Grok 一样，不刷新页面也能 Export`
- `M1 没了以后 M6 顶不住`
- `stale tab / stale bridge / old tab / no-refresh export`

This skill exists because this repo supports many AI platforms, and old-tab export failures repeat the same shape even when the transport details differ.

The goal is not:

- blindly forcing refresh
- patching the renderer
- treating every platform as a parser bug

The goal is:

**make export resilient after extension reload by finding which surviving truth source still exists on the old tab, then recovering semantics at the earliest reliable layer.**

## What This Skill Forces

When this skill is active, the investigation and fix must explicitly cover all of these:

1. fresh-tab vs old-tab behavior delta
2. source-tab bridge survivability
3. M1 availability after reload
4. M6 dependency class
5. rendered-DOM recoverability
6. parser / raw-contract landing zone
7. image / attachment / source / thinking parity
8. user-facing error fidelity
9. export-consumer parity
10. regression protection

If any one of these is skipped, the fix is incomplete.

## Core Principle

Old-tab export failures are not one bug class. They are a chain problem:

```text
extension reload / service worker restart
  -> already-open source tab
  -> content-main may not exist on that tab anymore
  -> M1 capture may be absent
  -> source-tab bridge may or may not still answer
  -> M6 becomes the primary recovery path
  -> M6 may depend on cookies, bootstrap tokens, runtime IDs, or page-local state
  -> if M6 is fragile, rendered DOM may be the only surviving truth source
  -> fallback data must still satisfy parser + export contracts
```

The correct question is never just:

`Why does export fail after reload?`

The correct questions are:

- what truth source is gone after reload?
- what truth source still survives on the old tab?
- where should recovery happen so preview and all export formats stay semantically correct?

## Resilience Strategy Classes

Not every platform should be fixed the same way. This skill forces classification before implementation.

| Class | Shape | Typical Platform Pattern | Preferred Fix |
|---|---|---|---|
| A | M6 is self-sufficient | cookie/session-backed REST transport | harden M6; no DOM fallback needed |
| B | M6 depends on page bootstrap values | CSRF token, build label, session id scraped from page | keep M6, add rendered-DOM fallback when bootstrap recovery fails |
| C | M6 depends on runtime-derived identifiers | org id / tenant id / resource graph | keep M6, add rendered-DOM fallback when runtime discovery fails |
| D | source-tab bridge is stale but export can proceed without it | bridge only needed for loading/error UI | do not hard-block export on bridge loss |
| E | no reliable M6 and no DOM truth source | page truly cannot be reconstructed | block with an explicit refresh requirement and document why |

`Grok-like UX` does not mean every platform becomes Class A.

It means the user can still export from an old tab through whichever recovery path is technically honest for that platform.

## Mandatory Dimensions

| Dimension | Why It Matters | What Must Be Verified |
|---|---|---|
| 1. Working comparator | Without a comparator, failure stays vague | Compare failing platform against a working platform or a previously-fixed platform |
| 2. Bridge survivability | Export UI may depend on content-script messaging even when extraction does not | Check whether source-tab bridge loss should block export or only degrade UX |
| 3. M1 dependency | Old tabs usually lose document_start interception | Verify whether `window.__apiCaptures` / capture path still exists after reload |
| 4. M6 dependency class | Different auth/runtime shapes imply different fixes | Classify M6 as cookie-only, bootstrap-token, runtime-derived, or unsupported |
| 5. DOM recoverability | DOM fallback is only valid if visible semantics are rich enough | Prove the page exposes ordered turns, visible text, images, links, thinking, and other critical metadata |
| 6. Parser landing zone | Recovery must land somewhere precise | Decide whether to synthesize parser-compatible raw data or a parser-local fallback shape |
| 7. Semantic parity | A fallback that drops key content is only a partial fix | Validate title, order, images, citations, attachments, and thinking parity |
| 8. Asset continuity | Images are where fallback fixes often silently regress | Confirm image URLs, thumbnails, and attachment metadata survive old-tab recovery |
| 9. Observability | Generic retry text hides the real break | Preserve the original M6 failure when fallback also fails; keep logs actionable |
| 10. Export parity | Preview success alone is not enough | Verify chat-selection plus export consumers still receive the same semantics |

## Mandatory Layers

Always reason through these levels in order.

| Layer | Question |
|---|---|
| L0. User symptom | What exactly does the user click, and what exact failure do they see? |
| L1. Source truth / target truth | What works on a fresh page, and what must remain true after reload on the old tab? |
| L2. Extension runtime boundary | Did the reload kill content-main interception, content-script bridge, or both? |
| L3. Transport/auth boundary | Can M6 still fetch with cookies only, or does it depend on page bootstrap/runtime state? |
| L4. Surviving truth source | If M6 is fragile, does the rendered DOM still expose usable conversation truth? |
| L5. Parser boundary | Where should recovered data enter: raw parser input, parser-local fallback, or ParseResult? |
| L6. Asset + semantics boundary | Do images, attachments, citations, code, and thinking still survive the fallback path? |
| L7. Consumer boundary | Does chat-selection and all export formats still receive equivalent semantics? |
| L8. Regression boundary | Are tests, dossier updates, and incident examples added so the same class stays solved? |

## Standard Operating Procedure

### Step 1. Lock The Exact Old-Tab Delta

Record all four states explicitly:

1. fresh tab before reload
2. same tab after extension reload
3. newly-opened tab after reload
4. a working comparison platform after reload

If these are not separated, the incident gets mislabeled.

### Step 2. Determine Whether Bridge Loss Is The Cause Or Just A Symptom

Check separately:

- source-tab `PING_CONTENT_SCRIPT`
- `window.__apiInterceptorInstalled`
- `window.__apiCaptures`

Do not assume stale bridge means extraction must fail.

Some platforms only lose loading/error UI while extraction can still proceed through M6.

### Step 3. Classify M6 Before Editing Anything

Use real browser evidence to answer:

- cookie/session-backed only?
- page-bootstrap token dependent?
- runtime-derived id dependent?
- mixed?

If you do not classify M6, you will choose the wrong recovery strategy.

### Step 4. Probe Rendered DOM As A Truth Source

Use real browser inspection, not fixtures, to answer:

- can you identify ordered visible turns?
- can you read user and assistant text separately?
- can you collect visible images or files?
- can you recover citations or source links?
- can thinking be expanded and read, or only summarized?

DOM fallback is justified only after this proof.

### Step 5. Choose The Smallest Honest Recovery Strategy

Preferred order:

1. harden M6 if the transport can become self-sufficient
2. keep M6 and add rendered-DOM fallback if the page still carries usable truth
3. gate only the stale bridge if the bridge is the real hard dependency
4. require refresh only when neither transport nor DOM can honestly recover

### Step 6. Land Recovery At The Correct Contract Boundary

Default rule:

**Prefer the smallest parser-local landing zone that preserves public contracts.**

In practice, that usually means one of these:

- synthesize a parser-compatible raw payload
- add a parser-local fallback shape for one platform
- avoid widening global platform contracts unless two or more platforms truly need it

### Step 7. Preserve Semantics, Not Just Text

Recovery is incomplete if it only restores plain text.

Validate:

- title
- chronological order
- message roles
- images / attachments
- citations / links
- thinking
- metadata needed by downstream export consumers

### Step 8. Preserve The Original Failure When Recovery Also Fails

If rendered-DOM recovery finds nothing usable, do not overwrite the original M6 reason with another vague generic message.

Keep the original failure for diagnostics and logs.

### Step 9. Encode The Fix

Every resolved old-tab incident must leave behind:

1. focused slice tests for recovery success
2. focused slice tests for failure preservation
3. parser tests if a fallback shape was added
4. dossier / example updates when the pattern teaches something reusable

## Decision Matrix

| Observation | Likely Meaning | Preferred Move |
|---|---|---|
| old tab fails, fresh tab works, `__apiCaptures` missing | M1 vanished after reload | inspect whether M6 is enough |
| M6 succeeds without page-local bootstrap | self-sufficient transport | strengthen M6 only |
| M6 fails until page tokens are scraped | bootstrap-sensitive transport | add DOM fallback after M6 failure |
| M6 depends on org/runtime ids discovered from page state | runtime-derived transport | add DOM fallback after runtime discovery failure |
| DOM exposes headings, text, images, sources, thinking controls | rendered DOM is viable truth source | synthesize parser-compatible fallback |
| DOM exposes only a visual shell with no recoverable turns | no honest DOM recovery | explicit refresh may be required |
| error text says `scroll to top`, but real cause is auth/runtime | observability drift | preserve platform-specific failure reason |

## Implementation Rules

Use these rules when coding the fix.

1. Do not patch chat-selection first. Old-tab failures almost always originate earlier.
2. Keep M6 as the first recovery attempt when it is semantically stronger than DOM.
3. DOM fallback must be inside the platform slice or its runtime module, not scattered across consumers.
4. Parser-local fallback shapes are preferred over widening global contracts on the first incident.
5. When DOM fallback fails, preserve the original M6 failure reason.
6. A stale bridge should only block export if the bridge is a true hard dependency.
7. Compare with one working platform and one previously-fixed platform whenever possible.

## Validation Matrix

Before closing the incident, validate all of these:

| Scenario | Must Pass |
|---|---|
| fresh tab export | yes |
| same tab after extension reload | yes |
| new tab after extension reload | yes |
| image-containing conversation | yes if platform supports images |
| thinking-containing conversation | yes if platform exposes thinking |
| chat-selection preview | yes |
| at least one binary export consumer | yes |

If the platform supports richer semantics, test them on the old-tab path too.

## Mandatory Output Shape

When using this skill, report these headings explicitly:

1. Symptom
2. Fresh-vs-Stale Delta
3. Source Truth
4. Target Truth
5. Platform Classification
6. Chain Map
7. Surviving Truth Sources
8. Chosen Recovery Strategy
9. Fix At The Correct Layer
10. Regression Protection
11. Residual Risks

## Anti-Patterns

Avoid these:

1. treating `scroll to top` as the root cause
2. assuming every platform should become Grok internally
3. widening global contracts before trying a parser-local landing zone
4. declaring success when only plain text recovered
5. blocking on stale bridge without proving the bridge is required
6. using fixtures as the only evidence for DOM recoverability
7. closing the incident without old-tab regression tests

## Example

Read this full case study before applying the method to another platform:

- `examples/example-01-gemini-old-tab-after-extension-reload.md`
- `examples/example-02-claude-old-tab-after-extension-reload.md`

That example shows the full pattern:

- compare Grok vs Gemini
- learn from Perplexity's earlier fix
- classify Gemini as bootstrap-sensitive M6
- prove DOM recoverability with real browser evidence
- add platform-local rendered-DOM fallback
- preserve parser contracts with the smallest possible change

The Claude example complements it with a different first-break layer:

- Claude already had platform-local M6 + rendered-DOM recovery
- the real blocker was stale-bridge hard-gating in delegated export
- the correct fix was to remove the wrong early guard so the recovery path could actually run

## How This Skill Fits With Other Skills

Use together with:

- `chain-first-debugging` when the incident still needs root-cause isolation
- `patched-mcp-chrome-devtools` when you need MCP Chrome DevTools mechanics for M6 classification, live API/runtime evidence, extension pages, or service workers

This skill is not a replacement for those two. It is the reusable playbook for one specific recurring incident family in this repository.