# Case Study NN — [Short Descriptive Title]

> **Why this example exists.** [One to three sentences explaining what new lesson or edge case this incident captures that is not already in Case Study 01 or the SKILL.md. If it does not add a new lesson, do not create a new case study — update an existing one instead.]

---

## 0. Incident Snapshot

- **Date:** YYYY-MM-DD (initial investigation), YYYY-MM-DD (fix committed)
- **Branch:** `[branch name]`
- **Surface:** DOCX export → [which element: user header / assistant block / model badge / table cell / code block / etc.]
- **Symptom in Pages:** [One sentence: what the user sees in Pages that is wrong. Be specific: "left-aligned when it should be right-aligned", "font collapsed to system default", "extra blank line between paragraphs", etc.]
- **Severity:** [low / medium / high] — [one sentence rationale]
- **Status:** [In progress / Resolved] — [if resolved: what tests pass and what Pages render confirms]

---

## 1. What Was Observed (Symptom, Not Cause)

[Describe what the user or engineer saw. Focus on the observable output, not an explanation. Reserve causal language for later sections. One short paragraph.]

---

## 2. Wrong Hypotheses Eliminated First

List each hypothesis that was considered and why it was eliminated. This section matters because future engineers will encounter the same initial guesses. Documenting the elimination reasoning saves them time.

**Hypothesis A: [Name]**

Investigation: [What was checked? What was found? Why eliminated?]

**Hypothesis B: [Name]**

Investigation: [Same structure.]

[Add more hypotheses as needed. Only include ones that were actually tested, not ones that were dismissed without investigation.]

---

## 3. Chain Map

```text
source intent (what it should look like)
  → DOCX export code: [relevant new Paragraph / new Table / etc. call]
    → docx library serializes [OOXML node] into [word/document.xml or word/styles.xml]
      → [what the generated package actually contains]
        → [what Pages interprets from that package]
          → [first distortion: what Pages does differently from the intent]
            → visible symptom: [what the user sees]
```

**First distortion layer:** [word/styles.xml or word/document.xml or word/settings.xml or a relationship file] — [one sentence explanation of what is missing or wrong at this layer]

---

## 4. The Pages Round-Trip Reference

[Describe how you generated the reference DOCX that Pages would import correctly. If you used the `scripts/pages-roundtrip-template.sh` script, say so. If you manually edited a document in Pages and exported it, describe the exact steps.]

1. Created minimal probe: [describe what the probe does]
2. Opened in Pages via AppleScript: [script snippet or reference to template]
3. Mutated the relevant property in Pages: [AppleScript snippet]
4. Exported back to DOCX: [AppleScript export call]
5. Compared packages: [command used, e.g., `python scripts/docx-package-diff-template.py broken.docx reference.docx`]

---

## 5. OOXML Package Diff Result

**Broken package — [which part, e.g., styles.xml]:**
```xml
[paste the relevant excerpt from the broken package]
```

**Pages-written reference — same part:**
```xml
[paste the relevant excerpt from the reference package]
```

**Bisection result:** [Which part(s) swapped from reference to broken were sufficient to fix the Pages render? One sentence.]

---

## 6. The Fix

**Location:** [file path(s) changed]

**Mechanism:** [Which docx library API was used — `externalStyles`, `styles.default.document`, `styles.paragraphStyles`, or post-pack ZIP surgery. If ZIP surgery, explain why the docx API was insufficient and add a `// DOCX-HACK:` comment in the code.]

**Key code change:**
```ts
[Minimal representative snippet. Not the whole file — only the lines that implement the fix.]
```

---

## 7. Regression Tests Added

In `tests/services/docx-export.service.test.ts`:

**Test 1 — [name]:**
```ts
[Test code]
```

**Test 2 — [name]:**
```ts
[Test code]
```

---

## 8. Verification

1. [Which vitest command was run and what was the result: e.g., "All 28 DOCX tests pass."]
2. [Pages round-trip acceptance: what was opened in Pages, what was exported, what the PDF thumbnail showed.]

---

## 9. Transferable Lessons

[Number each lesson. Focus on things that are not already in SKILL.md. If this incident confirms an existing SKILL.md hard rule, note which rule it confirms. If it reveals a new rule candidate, note it explicitly and consider adding it to SKILL.md.]

1. **[Short lesson title]:** [One to two sentences.]
2. **[Short lesson title]:** [One to two sentences.]
[Add as many lessons as warranted. Do not pad with generic advice already in SKILL.md.]
