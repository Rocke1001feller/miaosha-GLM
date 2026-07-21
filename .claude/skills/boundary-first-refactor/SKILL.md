---
name: boundary-first-refactor
description: "Use when refactoring a growing monolith into bounded vertical slices while preserving public APIs, forbidding sibling-module coupling, isolating compatibility patches, and giving future changes fixed landing zones. Trigger phrases: 垂直拆分, 大文件重构, 边界重构, monolith split, directory refactor, keep API stable, shim migration, evolutionary refactor."
---

# Boundary-First Refactor

## Positioning

This is a **portable methodology skill**, not a repository-bound operations checklist.

Its job is to answer:

- how to derive boundaries from constraints
- how to turn those boundaries into a sustainable structure
- how to migrate without breaking public callers
- how to package the result into a reusable engineering pattern

Its job is **not** to hardcode one repository's file paths into the method itself.

Project-specific paths, folder names, commands, and concrete case studies belong in:

- `examples/` inside the skill package
- repository docs
- repo-specific prompts or instructions

If `SKILL.md` itself cannot travel to another project without path edits, the abstraction has failed.

## Description

Use this skill when a codebase is growing in the wrong direction:

- one or more files keep absorbing unrelated changes
- sibling modules that should be independent are starting to know about each other
- compatibility patches are scattered through orchestration code
- the team wants to reorganize structure without changing public behavior
- future patches need fixed landing zones instead of "put it in the big file"

This skill exists to enforce one principle:

**Do not start from folder aesthetics. Start from constraints, derive boundaries, and only then derive the directory shape, migration order, and validation plan.**

The goal is not just to split a large file.
The goal is to make future growth predictable.

## When To Use

Use this skill when the problem has most of these traits:

- a service, pipeline, adapter layer, renderer, compiler, or backend integration has become a monolith
- multiple sibling engines, providers, adapters, or renderers must remain independent
- the current shared layer is polluted with misleading names or engine-specific assumptions
- the system needs gradual migration with tests staying green throughout
- external callers should not need to change import paths or public API usage during the refactor

Typical triggers:

- “垂直拆分”
- “边界重构”
- “这个文件又失控了”
- “保持 API 不变，重构内部结构”
- “monolith split”
- “directory refactor”
- “shim migration”
- “evolutionary refactor”

## Do Not Use This Skill For

Do not use this skill for:

- small single-file cleanup
- renaming-only refactors with no boundary problem
- product redesign masquerading as refactor
- rewrites that intentionally change behavior, contracts, or domain semantics

## Portable Skill vs Project Overlay

Before writing a refactor skill, classify which layer you are writing.

| Layer | Purpose | What Belongs There | What Must Not Belong There |
|---|---|---|---|
| **Portable methodology skill** | Reusable thinking model | decision process, constraints, deliverables, validation gates, anti-patterns | repo-specific paths, product-specific folder names, local commands unless clearly parameterized |
| **Project overlay** | Local instantiation | actual repo boundaries, actual commands, actual directories, local examples | claims of universality |

This file is the first layer.
Concrete instantiations belong in example artifacts or repo docs.

## Input And Output

### Input

At minimum, gather:

1. the current topology
2. the hard independence constraints
3. the public APIs that must remain stable
4. the recurring patch classes that keep arriving
5. the real shared core, if any
6. the validation gate that defines “safe to continue”

### Output

A complete run of this skill should produce:

1. a boundary map
2. a truthful shared-core definition
3. a target topology with rationale
4. a migration plan with phases
5. a compatibility strategy for public entrypoints
6. a verification gate after each phase
7. a polished worked example or post-refactor case note

## What This Skill Forces

The refactor is not complete unless all of these are explicit:

1. architectural constraints
2. gravity well mechanism identified and addressed (not just file sizes)
3. truth source audit: all facts have exactly one declaring owner
4. migration stance selected (Bleeding Stop / Growth Inhibition / Truth Oracle)
5. forbidden coupling boundaries
6. truthful shared boundary
7. semantic invariants defined before tests are written
8. landing zones for future change
9. frozen public API surface
10. migration order
11. validation gate after each step (M7 if stance requires it)
12. cleanup rule for temporary compatibility artifacts
13. growth governance rules installed (automated, structural, or quantitative)
14. a polished worked example if the refactor is meant to teach future work

If any of these are missing, the refactor is still operating on taste rather than engineering.

## Core Principle

The correct sequence is:

```text
constraints → gravity diagnosis → truth-source audit → boundaries
  → migration stance → shared-core rule → semantic invariants
  → target topology → migration phases → verification gates
  → growth governance → codified example
```

Not this:

```text
big file → split by intuition → hope the new folders age well
```

Most failed refactors skip the first three steps.
That is why they produce prettier folders without stronger architecture.

## Migration Stance Classification

Before writing a single line of the migration plan, classify which stance this refactor requires.
Different stances have radically different risk profiles and execution paths.

| Stance | Core Goal | When To Use | Equivalence Risk |
|--------|-----------|-------------|------------------|
| **Bleeding Stop** | Restore boundary lines without touching algorithms. Move code, rename files, forbid cross-imports. | When structure is broken but behavior is correct and you need to act immediately. | Lowest — algorithms are untouched |
| **Growth Inhibition** | Extract shared capability modules and install forced registration paths so new features cannot bypass the boundary. | After bleeding stop, or when a known recurring patch class keeps arriving and the structure has no named home for it. | Low-medium — logic moves but semantics stay |
| **Truth Oracle Migration** | Use the old implementation as a truth oracle: capture its output on real payloads, then prove the new implementation produces an identical result. | Any time behavior is being rewritten or moved across a semantically meaningful boundary. | Lowest achievable — oracle eliminates subjective judgment |

A single refactor can require multiple stances applied in sequence.
Choosing the wrong stance wastes effort: applying Truth Oracle overhead to a pure file-move, or skipping it when algorithms are actually changing.

Document which stance (or sequence of stances) this refactor requires before designing the target topology.

## Standard Operating Procedure

### Step 1. Derive Hard Constraints Before Discussing Structure

Ask:

- which sibling systems must not know about each other?
- which public APIs must remain stable?
- which categories of future patches keep arriving?
- which parts are truly shared, and which are only accidentally shared?

Examples of hard constraints:

- exporter A must not import exporter B
- provider A must not depend on provider B
- parser cannot know renderer internals
- entrypoint contract must remain unchanged for callers

If the constraints are weak, the folder plan will be weak.

### Step 1.5. Diagnose The Gravity Well Mechanism

Before auditing the current topology, answer this question:

**Why does new code naturally flow into this file instead of somewhere else?**

This is not the same as "what is wrong with the structure". It is asking about the mechanism.
If you cannot name the mechanism, the split will produce prettier folders that fill back up by the same force.

Common gravity well mechanisms:

- **Single-phase collapse**: a function signature collapses the entire pipeline into one call. No visible intermediate stages means no natural landing zones for incremental additions.
- **Missing ownership**: no file is obviously "responsible" for a new feature, so every addition goes to the closest large file.
- **Absent detection**: no lint rule, line-budget gate, or test prevents growth, so the cost of growth is zero.
- **Misleading name**: a file named `utils.ts` or `helpers.ts` or `index.ts` is a named catch-all that invites anything.
- **Hidden dependency**: the monolith holds global state or a side effect that callers depend on silently, making extraction feel risky.

Document the mechanism explicitly before proceeding.
The step that later removes the gravity well must address the mechanism, not just move code.

### Step 2. Audit The Current Growth Pattern

Before moving code, identify what is actually broken about the current topology.

Look for:

- monolith files with multiple unrelated reasons to change
- sideways imports between sibling modules
- helper files with misleading names that imply the wrong ownership boundary
- compatibility workarounds hidden in orchestration files
- optional or experimental engines being treated as fully symmetric siblings without a product decision

The point is to explain **why the current structure keeps attracting bad patches**.

Also perform a **truth source audit** before moving any code:

- Count how many places in the codebase independently declare the same fact (capability matrix, platform list, format registry, feature flags, route table).
- More than one declarative source for the same fact is a latent drift source.
- For each duplicate truth source, decide: which one is the single source of truth? How do the others become consumers rather than declarers?

This audit often reveals that the boundary problem extends beyond code structure into ownership of facts.
A refactor that splits files without consolidating truth sources will produce structurally clean code that still drifts.

### Step 3. Define The Truthful Shared Boundary

There is often a real shared layer. Keep it, but make it honest.

A healthy shared boundary should contain only:

- pure algorithms
- data contracts
- stateless transforms
- utilities that do not know which engine, adapter, or sibling module consumes them

It should not contain:

- engine-specific types
- renderer-specific policy
- one sibling's naming leaked into another sibling's imports
- compatibility hacks that only exist for one backend

If shared files are truthful but badly named, rename them.
Bad names are architectural debt because they distort future decisions.

### Step 4. Design The Target Topology Around Change Axes

Each bounded territory should be vertically self-contained.

Generic shape:

```text
feature-or-engine/
  index.ts           # orchestration / public API only
  setup.ts           # constants, creation, local config
  flow.ts            # main sequencing when needed
  pagination.ts      # page/chunk boundary logic when needed
  header.ts          # optional
  message.ts         # optional

  blocks/            # one file per semantic variation axis
    text.ts
    code.ts
    table.ts
    image.ts
    ...

  compat/            # named compatibility patches and engine quirks only
    emoji-raster.ts
    svg-bridge.ts
    importer-workaround.ts
    ...

  inline/ or adapters/
    ...              # engine-specific micro-layers only when truly needed
```

Rules:

1. `index.ts` orchestrates and exports. It does not absorb rendering logic.
2. `blocks/` are semantic landing zones. New content type means new file.
3. `compat/` is the only legal home for named workarounds.
4. engine-specific micro-layers stay local to that engine's directory.
5. sibling directories do not import each other.

### Step 5. Freeze The Compatibility Surface With Shims

If callers already import a legacy path, keep that path stable during the refactor.

Pattern:

```text
legacy-entry.ts  →  re-export shim  →  new vertical directory/index.ts
```

This lets you refactor internals without forcing immediate caller churn.

Shims are migration stabilizers, not the final architecture.

### Step 6. Migrate One Slice At A Time

Do not do a big-bang move.

Recommended order:

1. create the target directory skeleton
2. migrate the orchestration boundary
3. move one semantic slice at a time
4. validate after each move
5. only then remove the old monolith or backup

Pick the order by risk, not by symmetry.

Useful heuristics:

- migrate the default or primary engine first
- migrate the most reusable or most frequently touched slices early
- defer optional or experimental engines until their product status is explicit

### Step 6.5. Define Semantic Invariants Before Migrating

Before migration begins (and before writing tests), write down the properties that must remain true across any correct implementation.

Invariants are facts about the domain, not about the implementation.
Tests verify invariants. If you write tests without first naming invariants, you are testing the current shape rather than the required semantics.

For each invariant, record:

```text
Invariant: [human-readable statement of the property]
Check: [how to verify it — assertion type, property, comparison]
Failure risk: [which downstream feature breaks if this invariant is violated]
```

Example invariants for a data-transformation module:

- Item count and order are preserved end-to-end.
- Every input role maps to exactly one output role; no role is lost or duplicated.
- Deduplication is idempotent: running it twice produces the same result as running it once.
- Parent-child topology is closed: every child references a parent that exists, and every parent lists all its children.
- Aggregate statistics (counts, totals) match the sum of their constituent items.

Invariants defined here become the acceptance contract for Truth Oracle tests (Step 7) and regression tests going forward.

### Step 7. Enforce Verification Gates

After each meaningful move, run the smallest trustworthy validation set.

Minimum gate usually includes:

- typecheck / compile
- relevant tests
- build or packaging step if the refactor touches bundling or runtime boundaries

Do not let the refactor advance on a red baseline unless that risk is explicit.

#### Truth Oracle Migration Pattern (M7)

When the migration stance is **Truth Oracle Migration**, the verification gate must be stronger than "tests pass".
The only acceptable definition of equivalence is: the new implementation produces the same output as the old implementation on the same real inputs.

Implementation steps:

1. **Preserve the old implementation as a truth oracle.** Do not delete or overwrite it. Either keep it in the codebase temporarily, or capture its output before deletion (step 2 can handle this).

2. **Build a corpus of real inputs.** Use production payloads, not simplified fixtures. Fixtures prove that your fixture works. A corpus proves that the real system works. Store as `tests/corpus/<module>/sample-N.json`.

3. **Capture golden output.** Run the old implementation against every corpus item and serialize the output. Store as `tests/golden/<module>/sample-N.json`. These files are the machine-readable truth.

4. **Write equivalence tests.** For each corpus item, run the new implementation and deep-compare against the golden output. The test must fail if any invariant-relevant field differs.

   ```typescript
   // Equivalence test skeleton
   it('produces output identical to oracle for sample-N', () => {
     const input = loadCorpus('module/sample-N.json');
     const golden = loadGolden('module/sample-N.json');
     const result = newImplementation(input);
     expect(result).toEqual(golden); // or use deep-diff for detailed reporting
   });
   ```

5. **Whitelist intentional differences.** If a known behavioral improvement creates a deliberate diff (e.g., a deduplication bug fixed during migration), document it explicitly in `tests/golden/allowed-diff.ts` or equivalent. Every non-empty allowed-diff entry requires a named, justified reason.

**Critical distinction**: a test that snapshots the *current* implementation's output and then passes is NOT an equivalence proof. It is a forward regression guard. Equivalence requires the oracle to be the *old* implementation, not the new one.

**Portability note**: in projects where the old implementation cannot be preserved (e.g., third-party library upgrade), the oracle can be the live production system's API responses captured before migration.

### Step 8. Clean Up Migration Debt

Only after validation is green:

- delete monolith backups
- delete dead aliases
- remove temporary forwarding layers that are no longer needed
- preserve only the shims that are intentionally part of the external compatibility surface

Temporary safety artifacts should not silently become permanent architecture.

### Step 9. Package A Real Worked Example

A raw chat transcript is **not** a worked example.

### Step 10. Codify Growth Governance

A refactor that does not install governance will fill back up.
This step converts the boundary decisions into enforceable, persistent rules.

For each boundary you enforced during the refactor, create at least one of:

**Automated detection rule** (strongest)
- A lint rule, ESLint plugin, or custom Vitest test that makes the violation impossible to merge.
- Example: a test that scans all `*/parser.ts` files and asserts that none of them contains `fetch(`, `browser.`, `Blob`, or `FileReader`.

**Forced registration path** (structural)
- New features of a given type must be added in a specific location, with no alternative lower-friction landing zone.
- Example: new content types must add a file to `blocks/`; there is no other place to put them because `index.ts` only orchestrates imports.

**Line budget** (quantitative)
- Assign a soft limit (warning) and a hard limit (CI gate) to each file class.
- Hard limits must be enforced in CI: files over the hard limit cannot merge to the main branch.

| File Class | Soft Limit | Hard Limit |
|------------|-----------|------------|
| orchestration / index | 50 lines | 100 lines |
| platform or engine runtime | 250 lines | 400 lines |
| pure parser or transformer | 350 lines | 500 lines |
| shared capability module | 200 lines | 350 lines |

Adjust the table for the actual project. The point is that the numbers are written down and enforced, not implicit.

**Ownership declaration** (social)
- Document which file is the required landing zone for each recurring patch class.
- When a PR arrives that places a patch in the wrong location, the reviewer can cite this document rather than rely on tribal knowledge.

A proper worked example must be rewritten into a durable engineering artifact with at least:

1. context
2. hard constraints
3. initial topology problems
4. derived boundary model
5. chosen target topology
6. migration phases
7. verification gates
8. final outcome
9. transferable lessons

If an example still contains conversational residue such as “I can do this next” or “shall I continue”, it is not finished.

## Boundary Rules

These rules generalize well across projects:

1. **Orchestration files stay small.** If detailed logic appears in `index.ts`, the boundary is drifting.
2. **Compatibility code gets a name and a folder.** Anonymous workaround branches are forbidden.
3. **New semantic variation means new file.** Do not append unrelated cases into an existing block out of convenience.
4. **Shared means truly engine-agnostic.** If a utility contains backend policy, it does not belong in the shared layer.
5. **API stability is a first-class requirement.** Refactors should not force caller churn unless that churn is part of the goal.

## Portability Guide

This method is not specific to export pipelines.
Map it to other systems like this:

| This Skill Term | In Other Projects Might Mean |
|---|---|
| engine / exporter | adapter, provider, backend, renderer, compiler, transport |
| block | feature slice, content type, command family, operation class |
| compat | browser quirks, importer fixes, vendor workarounds, protocol edge cases |
| shared algorithm layer | parser helpers, normalization utils, pure transforms, layout math |
| shim | facade, compatibility export, bridge module, forwarding entrypoint |

If another project has:

- multiple providers that must stay independent
- multiple renderers sharing only normalized data
- a monolithic service absorbing unrelated patches
- a stable external API that must not change during internal cleanup

then this skill applies.

## Acceptance Checklist

A refactor following this skill should be able to answer “yes” to all of these:

**Diagnosis**
- Was the gravity well mechanism named explicitly before moving any code?
- Does the chosen migration stance match the actual risk profile of this refactor?

**Boundaries and Structure**
- Were the constraints written before the folder plan?
- Did the truth source audit find and resolve all duplicate declarers?
- Is the shared layer truthful and engine-agnostic?
- Do sibling modules avoid horizontal imports?
- Does each recurring patch class have a named landing zone?
- Is `index.ts` orchestration-only?

**Equivalence and Testing**
- Were semantic invariants defined before tests were written?
- If the stance required Truth Oracle Migration: is the oracle the old implementation, not the new one? Are corpus and golden files committed?
- Are all intentional behavioral differences documented in an allowed-diff file?

**Migration Hygiene**
- Are public entrypoints preserved with shims where needed?
- Was the migration done incrementally with green verification gates?
- Were temporary backups removed after validation?

**Sustainability**
- Are at least one automated detection rule, one forced registration path, or one line budget installed as a CI gate?
- Was the final example polished into a reusable artifact rather than copied from chat?

If not, the structure may look cleaner while still being fragile.

## Anti-Patterns

Avoid these:

1. Starting from folder aesthetics instead of constraints.
2. Splitting files without diagnosing the gravity well mechanism — the new files will fill up by the same force.
3. Creating a giant `common/` or `shared/` directory that hides engine-specific logic.
4. Forcing different engines to have identical shapes when their product role is not identical.
5. Moving everything at once and discovering breakage only at the end.
6. Letting orchestration files accumulate edge-case fixes.
7. Leaving misleading names in the shared layer because "it still works".
8. Writing tests that snapshot the current (post-refactor) implementation and calling it an equivalence proof — it is only a forward regression guard.
9. Refactoring code structure without auditing truth sources — structural clarity with multiple declarers of the same fact still produces drift.
10. Completing the refactor without installing governance rules — the structure will fill back up within weeks.
11. Treating raw chat or scratch notes as publishable examples.
12. Hardcoding repository paths inside the methodology itself.

## Reusable Execution Template

Before a refactor, fill in these blanks:

```text
1. Gravity well mechanism:
   - Why does new code flow into this file/module? (single-phase collapse /
     missing ownership / absent detection / misleading name / hidden dependency)
   - How will the refactor address the mechanism, not just the symptom?

2. Migration stance:
   - Bleeding Stop / Growth Inhibition / Truth Oracle Migration
   - Justification: ...

3. Truth source audit:
   - Facts that currently have multiple independent declarers: ...
   - Designated single source of truth for each: ...
   - How do current secondary sources become consumers: ...

4. Sibling territories that must stay independent:
   - ...

5. Public APIs that must stay stable during migration:
   - ...

6. Truthful shared boundary:
   - data contracts: ...
   - pure algorithms: ...

7. Semantic invariants (defined before writing tests):
   - Invariant: ... | Check: ... | Failure risk: ...
   - ...

8. Recurring patch classes that need fixed landing zones:
   - ...

9. Target vertical slices per territory:
   - ...

10. Truth oracle plan (if stance = Truth Oracle Migration):
    - Old implementation location or capture strategy: ...
    - Corpus path: tests/corpus/<module>/
    - Golden path: tests/golden/<module>/
    - Allowed-diff file: ...

11. Validation gate after each step:
    - typecheck: ...
    - tests: ...
    - build/package: ...

12. Growth governance to install after migration:
    - Automated detection: ...
    - Forced registration path: ...
    - Line budgets (soft / hard): ...

13. Cleanup rule:
    - remove temporary backups when ...

14. Worked example artifact:
    - path: ...
    - sections included: ...
```

If you cannot fill this template cleanly, you are not ready to move files yet.

## Worked Examples

The skill package should ship its examples alongside itself so the package stays portable.

- `examples/example-01-export-pipeline.md` — a fully rewritten, repository-backed case study
- `examples/example-template.md` — a reusable template for future refactors in other projects

Read the example for a concrete instantiation.
Read the template when you want to reuse the method elsewhere.