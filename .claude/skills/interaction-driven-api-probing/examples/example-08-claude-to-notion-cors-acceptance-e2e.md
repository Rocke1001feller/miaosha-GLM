# Example 08 - Claude URL -> Notion Page CORS Acceptance E2E

**Pattern: Interaction-Driven acceptance verification + URL forensics + stability recheck**
**Trigger phrases:** same-session E2E, Claude -> Notion image CORS, temporary.notion-static.com, image.svgxml, URL forensics, timeout fallback, refresh revalidation

---

## Why This Example Exists

This case documents a strict acceptance workflow where the team must prove all of the following on a **real** browser/account path:

1. The exact same Claude conversation (the one that reported CORS) is used end-to-end.
2. Import success is real, not inferred.
3. Post-import console/network evidence shows no recurring `temporary.notion-static.com` + `image.svgxml` CORS signature.
4. Final image delivery lands on durable Notion-hosted paths, not temporary ingest URLs.
5. A page reload re-check confirms the pass is stable, not one lucky load.

This is a reusable runbook for colleagues when they need audit-grade acceptance evidence.

---

## Acceptance Criteria

### Criterion A - CORS signature disappears and stays gone

After import (and after a reload), there must be no recurring signature equivalent to:

- `temporary.notion-static.com`
- `image.svgxml`
- `blocked by CORS policy`
- `Access-Control-Allow-Origin`

### Criterion B - Final image host is durable Notion path

Image requests must resolve to Notion-managed long-lived pathing, such as:

- `https://www.notion.so/image/attachment:...:image.png?...`
- resolved Notion image delivery path (`img.notionusercontent.com` / `prod-files-secure` chain)

and must not remain on temporary ingest-only URL signatures.

---

## Chain Map Used In This Case

```text
full transcript
  -> locate original failing Claude URL
    -> open extension chat-selection for same conversation
      -> execute Save to Notion
        -> if timeout, branch to same-conversation minimal reproducible subset
          -> successful import + destination page URL
            -> collect console + network evidence on Notion page
              -> run negative signature checks + positive host checks
                -> reload destination page
                  -> repeat checks
                    -> pass/fail by criteria A/B
```

---

## Step 1 - URL Forensics From Full Transcript (No Sample Drift)

Goal: guarantee we are not changing samples and then claiming a fix.

Use full transcript search:

```bash
grep -nE "https://claude\.ai/chat/[0-9a-f-]{36}" \
"/Users/separationofconcerns/Library/Application Support/Code/User/workspaceStorage/f069bf5463cf3265bca443c9e8d6c9be/GitHub.copilot-chat/transcripts/af834cd9-914f-40bf-a6a2-b1cb116b1a47.jsonl" \
| head -n 20
```

Representative hit from this incident:

```text
3045: ... 原始URL是：https://claude.ai/chat/95a7eb68-2bef-409f-8eaf-21ac7b543992 ...
```

Derived extension target for the same conversation:

```text
chrome-extension://ajgdageheaefoocldmlckfkdkpimbldf/chat-selection.html?id=95a7eb68-2bef-409f-8eaf-21ac7b543992
```

---

## Step 2 - Real Browser Context Only

Use the already-running logged-in Chrome session via MCP tools. Do not open a fresh isolated browser.

Core tool sequence:

1. `mcp_io_github_chr_list_pages` - verify target tabs and select correct context.
2. `mcp_io_github_chr_new_page` - open the extension chat-selection URL for the exact conversation ID.
3. `mcp_io_github_chr_take_snapshot` - capture actionable element IDs.

---

## Step 3 - Execute Real Import Action

Action contract:

1. Click `Save to Notion` in extension page.
2. Wait for result signals (success or timeout), not guesswork.

Signal watcher call shape:

```json
{
  "name": "mcp_io_github_chr_wait_for",
  "text": [
    "100%",
    "Saved to Notion",
    "Open in Notion",
    "Sync complete",
    "Notion file import timed out after 30 seconds."
  ]
}
```

Observed in this case:

- Full selection (20/20) hit timeout: `Notion file import timed out after 30 seconds.`

---

## Step 4 - Timeout Branch (Keep Same Conversation, Reduce Scope)

When full import times out, do not switch to another source conversation.

Use this branch:

1. Stay on the same Claude conversation ID.
2. Reduce to minimal reproducible subset that still includes SVG-involved content.
3. Re-run `Save to Notion` and wait for success signals.

Why this branch is valid:

- It isolates import throughput timeout from CORS-hosting acceptance.
- It preserves sample identity, so the conclusion still addresses the original bug report.

Observed success output in this incident:

- Save success signal shown.
- Destination page created:
  - `https://www.notion.so/4931a935503840b3b2d4fabd8b8f78e1`

---

## Step 5 - Destination Evidence Capture (Console + Network)

Open the destination Notion page and collect both console and network evidence.

### 5.1 Console Checks

Tools:

1. `mcp_io_github_chr_list_console_messages`
2. `mcp_io_github_chr_get_console_message` for suspicious IDs

Expected: no CORS signature tied to `temporary.notion-static.com` + `image.svgxml`.

### 5.2 Network Checks

Tools:

1. `mcp_io_github_chr_list_network_requests` (image-only and full list)
2. Grep extracted log for negative and positive signatures

Negative signature check (must return no matches):

```bash
grep -inE "temporary\.notion-static\.com|image\.svgxml|image\.svg\+xml|blocked by CORS|Access-Control-Allow-Origin" \
"/Users/separationofconcerns/Library/Application Support/Code/User/workspaceStorage/f069bf5463cf3265bca443c9e8d6c9be/GitHub.copilot-chat/chat-session-resources/ebad758a-6eba-4616-b6dc-0a9dc61acd0d/call_B6itgN0GKGP5XrzfuAvEHeXM__vscode-1778925607066/content.txt"
```

Positive signature check (must show durable path evidence):

```bash
grep -inE "attachment%3A.*image\.png|prod-files-secure|img\.notionusercontent\.com" \
"/Users/separationofconcerns/Library/Application Support/Code/User/workspaceStorage/f069bf5463cf3265bca443c9e8d6c9be/GitHub.copilot-chat/chat-session-resources/ebad758a-6eba-4616-b6dc-0a9dc61acd0d/call_B6itgN0GKGP5XrzfuAvEHeXM__vscode-1778925607066/content.txt" \
| head -n 40
```

Observed positive hit in this case:

```text
GET https://www.notion.so/image/attachment%3A...%3Aimage.png?... [200]
```

403 false-positive filter:

```bash
grep -n "\[403\]" \
"/Users/separationofconcerns/Library/Application Support/Code/User/workspaceStorage/f069bf5463cf3265bca443c9e8d6c9be/GitHub.copilot-chat/chat-session-resources/ebad758a-6eba-4616-b6dc-0a9dc61acd0d/call_B6itgN0GKGP5XrzfuAvEHeXM__vscode-1778925607066/content.txt" \
| head -n 20
```

Observed 403 in this case:

```text
GET https://cdn.metadata.io/pixel/config/1127.json [403]
```

This is unrelated tracker traffic, not the Notion image path under test.

---

## Step 6 - Stability Recheck After Page Reload

This step prevents accidental one-load pass claims.

Sequence:

1. `mcp_io_github_chr_navigate_page` with `type: reload` on destination Notion page.
2. `mcp_io_github_chr_wait_for` on stable page text.
3. Repeat console + network checks from Step 5.

In this incident, the reload pass remained clean:

- no `temporary.notion-static.com` / `image.svgxml` CORS signature
- durable image path still present

---

## Final Decision Table (This Incident)

| Criterion | Result | Evidence |
|---|---|---|
| A. No recurring temporary SVG CORS signature post-import | PASS | Console + network signature grep returned no matches for `temporary.notion-static.com` / `image.svgxml` on load and reload |
| B. Final image host is Notion durable path | PASS | `https://www.notion.so/image/attachment%3A...%3Aimage.png` image request returned `200` |

Separate residual issue (not part of A/B acceptance):

- Full 20/20 import still hit the 30-second import timeout and should be tracked as a reliability/performance follow-up.

---

## Reusable Checklist For Future Incidents

1. Lock source truth by transcript URL forensics first.
2. Enforce same-session E2E (same conversation ID).
3. Use explicit wait signals for success vs timeout branches.
4. If timeout occurs, branch to same-conversation minimal reproducible subset.
5. Collect both console and network evidence on destination page.
6. Run both negative signatures (must be absent) and positive signatures (must be present).
7. Reload destination page and repeat checks for stability.
8. Record acceptance decision and isolate unrelated residual issues.

---

## Artifacts Recorded In This Run

- Source conversation URL:
  - `https://claude.ai/chat/95a7eb68-2bef-409f-8eaf-21ac7b543992`
- Destination Notion page:
  - `https://www.notion.so/4931a935503840b3b2d4fabd8b8f78e1`
- Transcript evidence anchor:
  - line hits around `3045`, `3997`, `4018`, `4110` in
    `af834cd9-914f-40bf-a6a2-b1cb116b1a47.jsonl`
- Network evidence dumps:
  - `call_iTLzUebrrrDviRGEuJgp2F0X__vscode-1778925607066/content.txt`
  - `call_B6itgN0GKGP5XrzfuAvEHeXM__vscode-1778925607066/content.txt`
