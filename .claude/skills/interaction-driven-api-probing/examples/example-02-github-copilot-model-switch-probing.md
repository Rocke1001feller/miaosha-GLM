# Example 02 — GitHub Copilot Model Switch Probing

## Why This Example Exists

This example documents the exact failure mode that motivated this skill: the current model selector was mistaken for historical per-message model truth.

The transferable lesson is: if users can switch models inside one conversation, a current selector is not enough. You must capture the send-time request.

## Context

The task was to show real backend model names in a GitHub Copilot chat-selection export.

The user opened a fresh Copilot chat and repeatedly switched models before sending probe messages. The goal was to prove whether each assistant response could retain its own model.

## Permission And Probe Scope

The user authorized creating a new Copilot chat, switching models, sending probe messages, and refreshing the page.

Probe prompts were short arithmetic prompts:

```text
What is 1+1?
What is 2+2?
3+3=?
4+4=?
5+5=?
6+6=?
```

## Probe Matrix

| Probe | UI Model | Prompt | Captured Request Model |
|---|---|---|---|
| P1 | GPT-4.1 | `What is 1+1?` | `gpt-4.1` |
| P2 | Claude Sonnet 4.6 | `What is 2+2?` | `claude-sonnet-4.6` |
| P3 | GPT-4o | `3+3=?` | `gpt-4o` |
| P4 | Gemini 2.5 Pro | `4+4=?` | `gemini-2.5-pro` |
| P5 | Claude Opus 4.7 | `5+5=?` | `claude-opus-4.7` |
| P6 | Grok Code Fast 1 | `6+6=?` | `grok-code-fast-1` |

## Capture Setup

Chrome DevTools MCP was attached to the logged-in running Chrome instance.

A MAIN-world fetch interceptor captured POST request bodies to:

```text
POST https://api.individual.githubcopilot.com/github/chat/threads/{threadId}/messages?
```

The `/models` catalog endpoint was also inspected:

```text
GET https://api.individual.githubcopilot.com/models
```

It provided display labels such as:

```text
claude-opus-4.7 -> Claude Opus 4.7
claude-sonnet-4.6 -> Claude Sonnet 4.6
gemini-3.1-pro-preview -> Gemini 3.1 Pro
```

## Real Evidence

The outbound POST request body contained the real model ID for each turn.

The history endpoint did not contain per-message model fields:

```text
GET /github/chat/threads/{threadId}/messages
```

Observed message keys included:

```text
id, parentMessageID, intent, role, content, createdAt, threadID,
references, skillExecutions, copilotAnnotations, interrupted,
confirmations, clientConfirmations
```

There was no `model`, `modelID`, or `modelId` field in the GET history response.

## False Leads Eliminated

| Candidate Truth | Why It Was Wrong Or Insufficient |
|---|---|
| current `Model: GPT-4.1` composer label | only current UI state; changed after the historical sends |
| `selectedModel` side-channel | same problem: current selector, not per-turn history |
| GET history messages | no per-message model fields |
| assistant `Retry with <model>` buttons | useful evidence, but UI-derived and not as direct as request body |

## Protocol Model

```text
Copilot per-turn model truth:
  source = outbound POST /messages request body
  fields = { model, content }

Copilot display label truth:
  source = GET /models catalog
  fields = { id, name }

Copilot persisted message body truth:
  source = GET /messages
  fields = message ids, roles, content, references, skills
  does not include per-turn model
```

## Implementation Boundary

The correct fix is not in chat-selection rendering.

The correct fix is:

1. capture live POST request history while the user sends messages
2. store `model + content + observedAt`
3. fetch persisted messages via GET history
4. align request history back to assistant turns by user prompt/content and order
5. show model badges only when message-level evidence exists
6. store current `selectedModel` separately as current UI state, not historical truth

## Regression Protection

Regression tests should prove:

- `selectedModel` alone does not populate historical `message.model`
- `requestHistory` maps model IDs back to assistant turns
- raw IDs format correctly through the catalog or generic fallback
- non-GPT IDs such as `claude-sonnet-4.6`, `gemini-2.5-pro`, and `grok-code-fast-1` do not remain raw when display labels are needed

## Transferable Lessons

- If the UI supports model switching inside one thread, history extraction must preserve request-time model state.
- Request body and persisted history response can carry different truth classes.
- A model catalog maps IDs to display names; it does not prove which model was used for a turn.
- Refreshing the page is a necessary test: it reveals what persists and what was only live runtime state.
