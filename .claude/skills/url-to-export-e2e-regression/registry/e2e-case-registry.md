# URL To Export E2E Case Registry

This registry tracks automated cases produced by the skill. It is not a product capability matrix. It answers: **which manual point-checks have been converted into runnable scripts?**

Status values:

- `full-url-to-export` — starts at source URL and ends at exported content carrier.
- `url-to-chat-selection` — starts at source URL and stops at the mandatory chat-selection checkpoint.
- `endpoint-only` — starts from an existing chat-selection page or stored envelope; useful but not full E2E.
- `planned` — desired case, no runner yet.

| Case id | Status | Platform | Resource | Endpoint | Runner / lock | Notes |
|---|---|---|---|---|---|---|
| `google-aistudio-sources-citations-chat-selection` | `url-to-chat-selection` | Google AI Studio | `sources-citations` | chat-selection | `tests/entrypoints/google-aistudio-citation-e2e.test.ts` | Deterministic parser->renderer->click-chain lock exists; needs real URL runner to be source-URL E2E. |
| `perplexity-latex-variable-legend-chat-selection` | `url-to-chat-selection` | Perplexity | `latex` | chat-selection | `EXT_ID=lhaoppckdeodmjldiciojkeonmgcblha CASE_MODULE=tests/e2e-cases/perplexity-latex-variable-legend-chat-selection.case.cjs node scripts/e2e/perplexity-latex-variable-legend-chat-selection.cjs` | Regression lock for KaTeX variable legend rows (`$$P$$/$$r$$/$$n$$`) to stay inline while preserving paragraph formula blocks as display-mode. |
| `chat-selection-pdf-blob-endpoint` | `endpoint-only` | any existing chat-selection | selected resource varies | `export:pdf` | `.claude/skills/patched-mcp-chrome-devtools/examples/scripts/example1-pdf-oneclick.cjs` | Existing script verifies the PDF endpoint from an already-open chat-selection page; combine after URL->chat-selection to become full E2E. |
| `copilot-thinking-toolcalls-export-matrix` | `full-url-to-export` | GitHub Copilot | `thinking-tool-calls` | `export:pdf/markdown/docx/text/image/json/copy/copy-markdown/notion` | `EXT_ID=lhaoppckdeodmjldiciojkeonmgcblha CASE_MODULE=tests/e2e-cases/copilot-thinking-toolcalls-export-matrix.case.cjs node scripts/e2e/copilot-thinking-toolcalls-export-matrix.cjs` | Full chain acceptance from real Copilot URL through chat-selection toggle checkpoint and all 9 endpoints, including Notion target-select/save/open-page verification. Local runner default is auto-download (`manualDownload=false`); use `E2E_MANUAL_DOWNLOAD=true` only when reproducing native save-dialog paths. |

Add one row for each new automated point-check. Do not mark a case `full-url-to-export` unless it opens the source URL itself and verifies exported content.
