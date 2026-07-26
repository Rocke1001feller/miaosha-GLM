# Worked Example Template — Browser-Session Platform Integration

Use this template when turning a finished platform integration into a reusable example for this skill.

Do not paste raw chat logs into this file.
Rewrite them into durable engineering language.

## Title

`Example NN — <Platform> <Background-First / Hybrid / OAuth> Integration`

## Why This Example Exists

- what this example teaches
- why this platform is representative
- what lessons transfer to other platforms

## Semantic Contract

- what exactly "logged in" means for this platform
- whether the product promise is browser session, open tab, OAuth, or backend token

## Architecture Choice

- which option was chosen: A / B / C / D
- why the rejected options were rejected

## Source Truth

- where real auth truth lives
- what proof established that truth

## Target Truth

- what the extension should be able to read or write once authenticated

## First Real Break

- where the first distortion or missing link actually was
- why the initial intuition was wrong if it was wrong

## Protocol Surface

- session read endpoint
- destination discovery endpoints
- write endpoints
- required headers or tokens

## Normalized Models

- session snapshot
- picker snapshot
- destination target
- write request
- write result

## Read Chain

- which runtime owns platform calls
- how raw platform responses become normalized models

## Write Chain

- create / append / update / publish sequence
- idempotency or result semantics if relevant

## UI Or Workflow State Machine

- loading
- ready
- empty
- needs-login
- error
- publishing / published if relevant

## Hidden Dependencies

- browser profile assumptions
- tab assumptions
- storage assumptions
- CSP / permission assumptions
- platform-private API assumptions

## Validation Matrix

- focused repository tests
- background handler tests
- router or contract tests
- UI or ViewModel tests
- browser smoke
- real-profile proof

## Practical Pitfalls

- runtime gotchas
- smoke harness gotchas
- selector gotchas
- storage gotchas

## Final Outcome

- what the integration can now do
- what still remains risky or intentionally out of scope

## Transferable Lessons

Write only lessons that travel to the next platform.

Good examples:

- browser login truth should be modeled as a runtime contract
- do not implement publish before destination discovery is trustworthy
- state-driven UI prevents fake auth conclusions

Bad examples:

- one-off branch names
- local command history without engineering meaning
- chat residue