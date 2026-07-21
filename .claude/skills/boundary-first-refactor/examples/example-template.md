# Worked Example Template — Boundary-First Refactor

Use this template when turning a finished refactor into a reusable example.

Do not paste raw chat logs into this file.
Rewrite them into durable engineering language.

## Title

`Example NN — <System Or Pipeline Name> Boundary Refactor`

## Why This Example Exists

- what this example teaches
- why this case is representative
- what should transfer to other projects

## Context

- what the system does
- what sibling territories existed
- what the old topology looked like in practical terms

## Hard Constraints

- which siblings had to stay independent
- which public APIs had to remain stable
- which future patch classes were expected
- what truly shared core already existed

## Initial Topology Problems

- monoliths
- misleading shared names
- hidden compatibility logic
- accidental symmetry or accidental coupling

## Derived Boundary Model

Explain the boundaries as a model first, before listing folders.

## Chosen Target Topology

- show the chosen vertical slices
- explain why the slices were chosen
- explain where future changes now land

## Migration Plan

- phase 1
- phase 2
- phase 3

Each phase should state:

- what moved
- why that order was chosen
- what stayed stable for callers

## Verification Gates

- typecheck / compile
- tests
- build / package / deploy validation

## Final Outcome

- what changed structurally
- what remained stable externally
- what future work is now easier or safer

## Transferable Lessons

Write only lessons that travel beyond the specific repository.

Good examples:

- names are part of architecture
- shims preserve momentum
- optional engines should not force false symmetry
- compatibility fixes need a named home

Bad examples:

- local branch names
- one-off command history
- conversation residue