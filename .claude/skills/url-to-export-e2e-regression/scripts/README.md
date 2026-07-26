# URL To Export E2E Runner Scripts

## Generic Template

```bash
CASE_MODULE=tests/e2e-cases/<case-id>.case.cjs \
EXT_ID=<installed-extension-id> \
node .claude/skills/url-to-export-e2e-regression/scripts/url-to-export-e2e-runner.template.cjs
```

The template runner automates:

1. open the real source URL,
2. trigger the extension popup,
3. click `Export Now`,
4. wait for `chat-selection.html?id=...`,
5. run the case's fixed chat-selection oracle,
6. optionally click one export format and run a blob-based endpoint oracle.

## Download Mode (Automation Baseline)

The runner configures `manualDownload` from the extension options page before export starts.

- Local default: `manualDownload=false` (auto-download).
- Override priority:
- `case.download.manualDownload`
- `E2E_MANUAL_DOWNLOAD` env (`true|false|1|0|yes|no|on|off`)
- default `false`

Example forcing `Control Where to Save` behavior:

```bash
E2E_MANUAL_DOWNLOAD=true \
CASE_MODULE=tests/e2e-cases/<case-id>.case.cjs \
EXT_ID=<installed-extension-id> \
node .claude/skills/url-to-export-e2e-regression/scripts/url-to-export-e2e-runner.template.cjs
```

## Supported Endpoint Probe In Template

The template implements `blob-create-object-url`:

- patches `URL.createObjectURL` in the chat-selection page,
- captures blob `type`, `size`, first bytes for binary carriers,
- captures text for JSON/Markdown/Text carriers,
- returns structured JSON with `ok: true|false`.

Other endpoint types need case-specific extension of the runner:

- `copy-markdown`: clipboard text oracle,
- `copy`: clipboard image oracle,
- `notion`: real Notion page oracle,
- deep PDF text extraction: download file or parse PDF bytes with an added parser.

## Existing Endpoint-Half References

- PDF endpoint half: `.claude/skills/patched-mcp-chrome-devtools/examples/scripts/example1-pdf-oneclick.cjs`
- Notion endpoint half: `.claude/skills/patched-mcp-chrome-devtools/examples/scripts/example2-notion-root-oneclick.cjs`
- URL -> popup -> chat-selection pattern: `.claude/skills/patched-mcp-chrome-devtools/examples/scripts/example3-perplexity-dual-snapshot-oneclick.cjs`

A full case combines the URL -> chat-selection pattern with the chosen endpoint probe.

## Copilot Loading Style Mechanism Probe

Use this script when export flow reaches source-page loading transition but the overlay looks unstyled.

Script:

```text
.claude/skills/url-to-export-e2e-regression/scripts/copilot-loading-style-probe.cjs
```

Command:

```bash
SOURCE_URL="https://copilot.microsoft.com/chats/JGKawoHekkBgb4wz7kPoa" \
node .claude/skills/url-to-export-e2e-regression/scripts/copilot-loading-style-probe.cjs
```

What it checks:

1. probe A: `shadow.innerHTML` style injection with embedded `<style>`
2. probe B: programmatic style-node append (`createElement('style') + shadow.append`)
3. compare computed styles (`position`, `background`, typography)

If probe A is unstyled while probe B is styled, treat this as a root-cause signal and migrate loading modal construction away from `shadow.innerHTML`.
