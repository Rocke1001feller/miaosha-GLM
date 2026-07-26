# Example 01 — Kimi Model Switch Probing

## Why This Example Exists

This example shows how to prove model semantics by actively switching Kimi models and sending probe messages, instead of guessing from UI labels or historical conversations.

The transferable lesson is: when two visible model choices share most backend fields, the differentiator may be a small request-body flag rather than a different endpoint.

## Context

The task was to identify the real backend model truth for a fresh Kimi chat after switching between model modes.

The visible UI showed labels such as:

- `K2.6 Instant`
- `K2.6 Thinking`

But the implementation needed backend truth that could survive extraction and export.

## Permission And Probe Scope

The user explicitly authorized sending new probe messages and switching models in a fresh Kimi chat.

Probe messages were intentionally small arithmetic prompts so they were low-cost and easy to find in request bodies.

## Probe Matrix

| Probe | UI Action | Unique Input | Expected Difference |
|---|---|---|---|
| P1 | select K2.6 Instant, send | short arithmetic prompt | `options.thinking=false` |
| P2 | select K2.6 Thinking, send | short arithmetic prompt | `options.thinking=true` |
| P3 | refresh/reopen | no new prompt | determine what persisted in history APIs |

## Capture Setup

Chrome DevTools MCP was attached to the already-running logged-in Chrome instance.

A MAIN-world fetch interceptor was installed before sending probe messages. The target was Kimi's Connect/JSON chat endpoint:

```text
POST /apiv2/kimi.gateway.chat.v1.ChatService/Chat
```

Kimi used a Connect-style framed body. The useful JSON payload came after the frame prefix, so the body needed protocol-aware decoding instead of naive JSON parsing.

## Real Evidence

The fresh probe showed:

| UI Model | Backend Scenario | Thinking Flag | Derived Label |
|---|---|---|---|
| K2.6 Instant | `SCENARIO_K2D5` | `false` | `K2.6 Instant` |
| K2.6 Thinking | `SCENARIO_K2D5` | `true` | `K2.6 Thinking` |

The key discovery was that both modes used the same scenario family. The actual distinguishing truth was the `options.thinking` flag.

## False Leads Eliminated

| Candidate Truth | Why It Was Insufficient |
|---|---|
| UI label alone | current display label, not necessarily durable protocol truth |
| old conversations | could reflect historical defaults rather than current backend behavior |
| scenario alone | both Instant and Thinking used `SCENARIO_K2D5` |
| response text quality | output style is a symptom, not a protocol field |

## Protocol Model

```text
Kimi model truth for observed K2.6 modes:
  scenario = SCENARIO_K2D5
  options.thinking = true  -> K2.6 Thinking
  options.thinking = false -> K2.6 Instant
```

## Implementation Boundary

The correct implementation layer is the parser/acquisition boundary:

- capture or preserve `scenario`
- capture or preserve `options.thinking`
- derive the display model from both fields
- do not infer Thinking/Instant from the final response text

## Regression Protection

Create fixtures that include:

1. request body with `SCENARIO_K2D5` and `thinking=false`
2. request body with `SCENARIO_K2D5` and `thinking=true`
3. parsed output proving `K2.6 Instant` and `K2.6 Thinking` differ

## Transferable Lessons

- Switch exactly one variable at a time.
- Use fresh sessions when old conversations may hide the current protocol.
- Request body may contain model truth even when history APIs do not.
- Do not stop at the first plausible field if it cannot distinguish the tested variants.
