---
name: error-and-action
description: "Use when touching Chrome Errors, console.error/warn, catch blocks, runtime issue capture, user-facing error copy, ungoverned diagnostics, ErrorKind taxonomy, or incident/postmortem writeups."
---

# Error and Action

## Description

Use this skill whenever a change affects how the extension classifies, routes, displays, persists, suppresses, or documents failures.

Typical triggers:

- "Chrome Errors"
- `console.error`
- `console.warn`
- `catch` block
- "ungoverned"
- "runtime issue"
- "user-facing error"
- `ErrorKind`
- `ActionKind`
- postmortem / incident review

## Required Source Of Truth

Before changing behavior, read these in order:

1. `docs/error-and-action/README.md`
2. `docs/error-and-action/principles.md`
3. `docs/error-and-action/taxonomy.md`
4. `docs/error-and-action/architecture.md`
5. `docs/error-and-action/code-map.md`

## Core Rules

1. `models/error-kinds.ts` is the only taxonomy boundary for regex/string fingerprint classification.
2. New failure handling must choose exactly one primary channel: `user-action`, `runtime-issue`, or `raw-diagnostic`.
3. Known lifecycle noise must not be mirrored to `console.error` or `console.warn` unless a `shouldMirror*` gate allows it.
4. User-facing text must come from `services/user-facing-error.service.ts` or an explicitly typed equivalent.
5. A new `ErrorKind` requires model metadata, taxonomy docs, user-facing mapping review, and tests in the same change.
6. If a change alters a governance file, update `docs/error-and-action/code-map.md` and preserve the file's `@see` header.

## Standard Operating Procedure

### Step 1. Classify The Failure

Ask:

- Is this already represented by an existing `ErrorKind`?
- If not, is it genuinely a new failure class or just a new message for an existing class?
- Which owner layer should own the fix?

Do not add local `message.includes(...)` or regex checks in services. Route through `classifyError()`.

### Step 2. Pick The Channel

Choose one primary channel:

- `user-action`: actionable product feedback for the user
- `runtime-issue`: durable diagnostic state for feedback/debug surfaces
- `raw-diagnostic`: developer-only console/probe output

If two channels are needed, state why. Duplicate disclosure is exceptional.

### Step 3. Use The Correct Gate

For background code, use `shouldMirrorBackgroundRuntimeError()` before console mirroring.

For extension pages, use `shouldMirrorExtensionPageRuntimeError()` before console mirroring.

For user copy, route through `toUserFacingError()` or `toUserFacingErrorFromUnknown()`.

### Step 4. Update The Map

If you add or move a governance artifact, update:

- `docs/error-and-action/code-map.md`
- the relevant `@see docs/error-and-action/...` file header
- the focused test for that file

### Step 5. Add Regression Protection

At minimum, add or update one of:

- taxonomy test in `tests/models/error-kinds.test.ts`
- user-facing copy test in `tests/services/user-facing-error.service.test.ts`
- governance structural guard in `tests/services/error-and-action-governance.test.ts`
- incident archive guard once the change is incident-driven

## Mandatory Output Shape

When reporting an Error and Action change, include:

1. Current phase/status
2. ErrorKind(s) touched
3. Channel(s) selected
4. Files changed
5. Tests or guards run
