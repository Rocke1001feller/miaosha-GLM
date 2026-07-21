---
name: url-to-export-e2e-regression
description: "Use when creating automated end-to-end regression cases that start from a real AI chat URL, open the extension flow, verify the fixed chat-selection rendering checkpoint, and optionally continue to one of 9 export/download endpoints. Trigger phrases: 真实URL端到端自动化, URL到Export回归, chat-selection固定检查点, PDF下载自动验证, Notion终点验收, 12种resources, 9种formats, 自动生成E2E脚本, manual point-check to automated regression."
---

# URL To Export E2E Regression

## 1. What This Skill Is For

This skill is for building **runnable automated E2E regression cases** from work that would otherwise be repeated manual clicking.

The start pointer is always a real source URL:

```text
source URL
  -> extension popup / extraction flow
  -> chat-selection page rendered
  -> optional export/download endpoint
  -> artifact content oracle
```

The goal is not to write a retrospective, a matrix-only acceptance note, or a jsdom-only renderer test. The goal is to produce a repeatable case and the script that executes it.

A valid output from this skill is:

```text
case module + browser runner command + chat-selection oracle + optional export artifact oracle + committed regression evidence
```

## 2. Case Inputs

Every case must define exactly these inputs before automation begins:

| Input | Meaning |
|---|---|
| `sourceUrl` | The real AI chat URL to open. This is the start pointer. |
| `platform` | Platform id used by the extension (`chatgpt`, `claude`, `google-aistudio`, `perplexity`, etc.). |
| `resource` | One of the 12 resource categories below. |
| `endpoint.kind` | `chat-selection` or `export`. |
| `endpoint.format` | Required only when `endpoint.kind === 'export'`; one of the 9 export formats. |
| `download.manualDownload` | Optional. `false` means auto-download; `true` means `Control Where to Save` is on and the browser asks where to save. For local E2E, default should remain `false`. |
| `chatSelectionOracle` | Assertions proving the resource survived into the fixed chat-selection checkpoint. |
| `exportOracle` | Assertions proving the resource survived inside the exported content carrier. Required for true E2E export cases. |

## 3. Resource Categories

The resource is the checked semantic unit. Pick one resource per case.

| Id | Resource | Fixed chat-selection checkpoint | Export endpoint oracle |
|---|---|---|---|
| `text` | Text | message text is rendered in the selected message | artifact text/JSON contains the same text |
| `sources-citations` | Sources + citations | `.citation-chip`, `.sources-block`, `.source-item[id^="source-"]` count and click chain | artifact preserves citation markers and source URLs/titles |
| `thinking-tool-calls` | Thinking + tool calls | `.thinking-block` / `.tool-activity-block` visible with expected status/content | artifact includes or excludes thinking according to export config, and preserves tool timeline semantics when included |
| `image-user-upload` | User-uploaded images | `img[data-original-url]` and staged asset status | artifact embeds or references the resolved image, not an expired source-page URL |
| `image-generated` | Generated images | generated image block rendered with original URL metadata | artifact embeds the generated image content or records a controlled unavailable placeholder |
| `image-search` | Search / grounding images | search image thumbnails or image-source blocks render | artifact preserves image references and associated sources |
| `files-artifacts` | Files + artifact links | attachment / artifact link rendered with label, mime, and URL | artifact preserves the link, filename, and extracted text when available |
| `code` | Code blocks | `pre code` plus language class when present | artifact preserves code fence/content and language when the format supports it |
| `formulas` | Formulas | formula text or rendered math survives | artifact preserves formula text or rendered math representation |
| `diagrams` | Diagrams | rendered Mermaid/SVG/fallback block is present | artifact contains rendered diagram image/SVG or controlled fallback |
| `tables` | Tables | table headers and body cells render | artifact contains a real table or table-equivalent content |
| `latex` | LaTeX | `.katex` / `.katex-display` or raw LaTeX fallback | artifact preserves LaTeX source or rendered math content |

## 4. Endpoint Types

### 4.1 Fixed checkpoint: `chat-selection`

This checkpoint is mandatory for every case.

It proves the extension reached the fixed target page and the chosen resource rendered there. It is the first half of the chain.

A case that stops here is valid for renderer/parser coverage, but it is not a full export E2E case.

Example: AI Studio citations where clicking a citation chip activates the matching source appendix item.

### 4.2 Export endpoint: `export`

This checkpoint continues after chat-selection into one of the 9 export formats:

| Format | Endpoint carrier | Recommended oracle |
|---|---|---|
| `json` | downloaded JSON blob | parse JSON and assert normalized resource fields |
| `markdown` | downloaded `.md` blob | assert markdown syntax, URLs, image refs, fences, citations |
| `copy-markdown` | clipboard markdown or `.md` fallback | assert clipboard/download text |
| `text` | downloaded `.txt` blob | assert plain text semantics |
| `pdf` | generated PDF blob / downloaded PDF | assert `application/pdf`, `%PDF` signature, size, and resource-specific extractability when parser support exists |
| `docx` | generated DOCX blob | unzip and inspect `word/document.xml` plus relationships |
| `image` | downloaded PNG | assert non-empty PNG and resource-specific visual/probe metadata when available |
| `copy` | clipboard image blob | assert image blob type/dimensions and resource-specific probe metadata when available |
| `notion` | real Notion page | reopen the created page and assert real block content in the browser session |

A true E2E case ends at the content carrier, not merely at a successful click or success toast.

## 5. Required Artifacts

For each new automated case, produce these files or their local equivalent:

```text
tests/e2e-cases/<case-id>.case.cjs        # case module with URL, resource, endpoint, oracles
scripts/e2e/<case-id>.cjs                 # executable wrapper, or documented runner command
.tmp/e2e/<case-id>/source/                # source truth artifacts, local/uncommitted if sensitive
.tmp/e2e/<case-id>/chat-selection/        # fixed checkpoint evidence
.tmp/e2e/<case-id>/export/                # endpoint evidence when endpoint.kind=export
```

If the case can be made deterministic without live login state, also add a Vitest lock under `tests/entrypoints/` or `tests/services/`. That lock is secondary; the browser runner is the E2E regression.

## 6. Standard Build Flow

### Step 1. Define the case

Use [case-spec.schema.md](case-spec.schema.md) and [examples/case-module.template.cjs](examples/case-module.template.cjs).

Choose:

1. the real `sourceUrl`,
2. exactly one `resource`,
3. endpoint `chat-selection` or `export`,
4. export `format` if needed,
5. concrete selectors/content expectations,
6. download mode (`download.manualDownload`, default `false` for local automation).

### Step 2. Write the chat-selection oracle

The oracle must prove two things:

1. the page is really `chrome-extension://<id>/chat-selection.html?id=<conversationId>`;
2. the selected resource rendered in the expected structure.

Do not accept a loaded shell as success. The resource must be present.

### Step 3. Write the export oracle when `endpoint.kind === 'export'`

The export oracle must inspect the actual carrier:

- read text/JSON/Markdown blobs as text,
- inspect DOCX zip XML,
- inspect PDF blob type/signature and extract text when available,
- inspect image blob metadata or pixel content when available,
- inspect Notion's real page blocks after sync.

A successful toast or browser download id is not enough.

### Step 4. Implement or copy the runner

Start from [scripts/url-to-export-e2e-runner.template.cjs](scripts/url-to-export-e2e-runner.template.cjs). The runner must automate:

1. open/select the source URL,
2. trigger extension popup export,
3. wait for a new chat-selection page,
4. run the fixed checkpoint oracle,
5. if requested, click the export format button and run the endpoint oracle.

### Step 5. Execute and harden

Run the case repeatedly. Remove sleeps that mask race conditions. Replace them with page probes where possible. Keep bounded retries around MCP operations, because the patched MCP layer can transiently time out.

### Step 6. Commit the reusable regression shape

Commit the case module, runner wrapper/command doc, and any sanitized fixture or deterministic Vitest lock. Keep private `.tmp/e2e/**` artifacts uncommitted.

Update [registry/e2e-case-registry.md](registry/e2e-case-registry.md) with the case id, resource, endpoint, format, runner command, and current status.

## 7. Existing Case Mapping

| Existing asset | What it covers | How to use it under this skill |
|---|---|---|
| [tests/entrypoints/google-aistudio-citation-e2e.test.ts](../../../tests/entrypoints/google-aistudio-citation-e2e.test.ts) | AI Studio citations into chat-selection renderer and click chain | Treat as a deterministic half-chain lock. Build a real URL runner around it when the start URL is needed. |
| [.claude/skills/patched-mcp-chrome-devtools/examples/scripts/example1-pdf-oneclick.cjs](../patched-mcp-chrome-devtools/examples/scripts/example1-pdf-oneclick.cjs) | Existing chat-selection page -> PDF button -> PDF blob probe | Treat as the export endpoint half. Combine after URL -> popup -> chat-selection to make it true full E2E. |
| [.claude/skills/patched-mcp-chrome-devtools/examples/scripts/example2-notion-root-oneclick.cjs](../patched-mcp-chrome-devtools/examples/scripts/example2-notion-root-oneclick.cjs) | Notion endpoint verification | Use as Notion export endpoint reference. |
| [.claude/skills/url-to-export-e2e-regression/scripts/copilot-loading-style-probe.cjs](scripts/copilot-loading-style-probe.cjs) | Copilot source-page loading overlay style mechanism probe | Use for chain-first triage when loading UI appears as unstyled text during URL -> popup -> chat-selection transition; compare `shadow.innerHTML` vs style-node injection behavior before patching render paths. |

## 8. Done Criteria

A case is done only when all are true:

- [ ] It starts from `sourceUrl`, not a pre-opened chat-selection page, unless the case is explicitly documented as endpoint-only.
- [ ] It verifies the fixed chat-selection checkpoint.
- [ ] If endpoint is `export`, it verifies the exported content carrier for the selected resource.
- [ ] It can be rerun by command without manual clicking.
- [ ] It fails with structured JSON explaining the failed phase and observed facts.
- [ ] It records whether it is `full-url-to-export`, `url-to-chat-selection`, or `endpoint-only`.
- [ ] It updates [registry/e2e-case-registry.md](registry/e2e-case-registry.md).

## 9. Anti-Patterns

- Starting from an already-open chat-selection page while calling the case full E2E.
- Treating `downloadCount > 0`, a success toast, or a returned download id as content verification.
- Verifying all 12 resources in one case. One case, one resource.
- Verifying all 9 formats in one case. One case, one endpoint format.
- Using a renderer snapshot as source truth.
- Comparing preview `img.src` to exported Markdown image URL; preview may rewrite URLs by design.
- Launching a fresh Chrome profile for login/session-dependent source URLs. Use the patched MCP skill and the running profile.
- Keeping `manualDownload=true` in local automation runs and then blaming native save dialogs for blocked downloads.
