# Example 01 — Export Pipeline Refactor

## Why This Example Exists

This example shows how the boundary-first refactor method was applied to a real export pipeline with three sibling engines.

The point is not to copy this exact folder tree into every project.
The point is to show how hard constraints were translated into boundaries, then into topology, then into a safe migration plan.

## Context

The repository contained three export implementations consuming the same normalized conversation data:

- PDFKit
- DOCX
- pdfmake

The system already had a legitimate shared algorithm layer under `utils/`, but parts of that layer were misleadingly named with `pdf-` prefixes even though DOCX also consumed them.

At the same time, each export engine had at least one oversized monolith file, and future patches were likely to keep landing in those files unless the structure changed.

## Hard Constraints

The refactor started from constraints rather than folder taste.

### Constraint 1. Sibling Engines Must Stay Independent

PDF, DOCX, and pdfmake are separate territories.
One exporter must not import another exporter.

### Constraint 2. Public Callers Must Not Churn

Existing entrypoints such as the service-level export functions had to remain stable during migration.

### Constraint 3. Future Patches Need Fixed Landing Zones

The team expected future work on:

- code block rendering
- image handling
- compatibility fixes
- pagination/import quirks
- tool/thinking/source semantic blocks

Those patch classes needed explicit homes so new work would not drift back into monoliths.

### Constraint 4. Shared Code Must Be Truthful

Only truly engine-agnostic logic could remain shared.
Misleading ownership names had to be corrected.

## Initial Topology Problems

The structure had three architectural smells:

1. monolith implementation files had too many reasons to change
2. the shared utility layer contained names implying one engine owned logic that was actually cross-engine
3. compatibility and semantic rendering concerns were not separated cleanly enough to constrain future growth

This meant the codebase still worked, but its structure was training future contributors to put changes in the wrong places.

## Derived Boundary Model

From those constraints, the boundary model became:

```text
normalized conversation model
  → truthful shared utils layer
  → export-pdf/
  → export-docx/
  → export-pdfmake/
```

Where:

- `utils/` is the only shared algorithm boundary
- each exporter is vertically self-contained
- service entrypoints become compatibility shims, not implementation homes

## Chosen Target Topology

Each exporter was reorganized around change axes rather than around the old monolith.

Common principles:

- `index.ts` is orchestration only
- semantic rendering lives under `blocks/`
- compatibility and engine quirks live under `compat/` where applicable
- engine-specific micro-layers stay local to the engine directory

### Example Shape

```text
export-engine/
  index.ts
  setup.ts
  fonts.ts
  message.ts
  pagination.ts

  blocks/
    markdown.ts
    code.ts
    table.ts
    image.ts
    thinking.ts
    sources.ts
    tools.ts

  compat/
    ...

  inline/ or engine-specific helpers/
    ...
```

## Migration Plan

The migration was executed in three phases.

### Phase 1. PDFKit Vertical Split

- create `services/export-pdf/`
- move implementation behind a stable service shim
- split semantic blocks and compatibility concerns into dedicated files
- verify after each step

### Phase 2. DOCX Vertical Split

- create `services/export-docx/`
- extract setup, fonts, pagination, header/footer, message assembly, inline rendering, and semantic blocks
- preserve service-level entrypoint compatibility via shim
- verify after each step

### Phase 3. Shared Utility Rename And pdfmake Isolation

- rename shared algorithm files to truthful names
- update imports across engines
- split `export-pdfmake/` into its own bounded territory
- keep pdfmake structurally isolated rather than pretending it is the same engine as PDFKit

## Verification Gates

The refactor was only allowed to advance under green gates.

The actual gates were:

- TypeScript compile / typecheck
- unit tests
- production build

This matters because boundary refactors often appear harmless while quietly breaking imports, packaging assumptions, or runtime assets.

## Final Outcome

The resulting system achieved four things:

1. public API stability was preserved through service-level shims
2. sibling export engines stopped being structurally entangled
3. shared utilities became more truthful through neutral naming
4. future patches now have explicit landing zones instead of one ever-growing file

In concrete terms, the monolith implementations were replaced by bounded vertical directories for:

- PDFKit
- DOCX
- pdfmake

And the build/test gates remained green at the end of the migration.

## Transferable Lessons

This example generalizes beyond export pipelines.

### Lesson 1. Names Are Part Of Architecture

If a shared utility is called `pdf-*` but is used by DOCX too, the name is already teaching the wrong boundary.

### Lesson 2. Shims Buy You Migration Freedom

Stable public entrypoints let you refactor internal topology without forcing the rest of the system to move in lockstep.

### Lesson 3. Optional Engines Should Not Dictate Symmetry

If one backend is experimental or secondary, isolate it structurally. Do not force artificial sameness just to satisfy an aesthetic pattern.

### Lesson 4. Compatibility Fixes Need A Legal Address

If compatibility logic has no named home, it will leak into orchestration files and become invisible architecture.

### Lesson 5. A Polished Example Is Part Of The Refactor

If the team wants the refactor to become reusable method, the final output must include a rewritten case study, not just the code changes.