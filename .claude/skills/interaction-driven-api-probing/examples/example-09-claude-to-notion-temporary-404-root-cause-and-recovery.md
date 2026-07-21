# Case Study 09 - Claude to Notion Temporary Image 404: False-Pass Trap, Root Cause, and Recovery

**Pattern:** interaction-driven acceptance verification + chain-first root cause isolation + post-import block patch forensics
**Trigger phrases:** Notion image 404, temporary.notion-static.com, false pass, source-vs-target mismatch, loadPageChunk cursor, mixed staged/importer images

---

## Why This Example Exists

This case documents a high-risk failure mode in real E2E acceptance:

1. A run is reported as "passed".
2. User evidence (screenshot) contradicts the pass.
3. Real target page still has image 404.
4. Root cause is not in final rendering, but in post-import image patch coverage.

This example is the playbook for recovering from a false pass and moving to audit-grade acceptance.

---

## Incident Snapshot

- Source conversation: `https://claude.ai/chat/95a7eb68-2bef-409f-8eaf-21ac7b543992`
- Failed page (before final fix): `https://www.notion.so/951444b883fb4f95b214ac204bc1f5eb`
- Final validated page (after fix): `https://www.notion.so/1474e9b20b6747febdfe723013acc7a5`
- Core code fix: `entrypoints/background/notion/sync/markdown-import.ts`
- Regression coverage: `tests/entrypoints/background-notion.test.ts`

---

## What We Got Wrong First (Pitfalls)

### Pitfall 1 - Success UI was treated as truth

A success banner and optimistic state were treated as final acceptance. They were not.

**Correction:** acceptance must include negative signature checks on destination page:
- `temporary.notion-static.com` image chain
- image 404 signatures
- broken-image placeholders

### Pitfall 2 - Single-lens verification

Checking only one lens (UI) hid contradictions.

**Correction:** always use three lenses together:
1. extension UI state
2. destination page network/console
3. extension service worker network timeline

### Pitfall 3 - Assuming staged-asset map was complete

The patch path originally assumed all image blocks could be mapped from staged assets. Real import proved otherwise.

**Correction:** include fallback path for importer-generated temporary URLs not present in staged asset map.

### Pitfall 4 - First chunk bias

`loadPageChunk` was effectively treated as single-chunk truth. Large pages spread image blocks across chunks.

**Correction:** traverse chunk cursor chain with chunkNumber progression.

---

## Unknowns We Discovered During Investigation

These were not obvious before real forensic replay:

1. Notion image durability can fail partially: some images are secure-patched, others remain temporary.
2. Import success does not imply image durability success.
3. In service-worker logs, temporary PUT requests may appear as pending + 200 pairs; this alone is not failure.
4. Final good page may not show `secure.notion-static.com` directly; expected final delivery is often:
   - `www.notion.so/image/attachment:...` (302)
   - `img.notionusercontent.com/s3/prod-files-secure/...` (200)
5. Real fix required both coverage expansion and data fallback, not one or the other.

---

## Chain Map (The Version That Worked)

```text
source conversation (Claude)
  -> chat-selection save flow
    -> markdown import task success
      -> temporary image blocks created by importer
        -> post-import patch discovery (loadPageChunk across cursor chunks)
          -> secure upload (bucket=secure, record.id=block.id)
            -> saveTransactionsFanout patch source to attachment:UUID:filename
              -> destination page image chain resolves to prod-files-secure
```

The first distortion layer was in post-import patch coverage, not final page rendering.

---

## Acceptance Contract (Hard Gates)

A run is PASS only when all gates are true on the destination page:

1. `temporary_404 == 0`
2. `any image 404 == 0`
3. No broken-image placeholder text
4. Attachment proxy and durable host chain observed:
   - attachment proxy (`/image/attachment%3A`) responses
   - durable secure host (`img.notionusercontent.com/s3/prod-files-secure`) responses

Optional but recommended:
- reload destination page and repeat gates

---

## Root Cause Stack

### R1. Patch candidate gap

Only direct staged-asset mappings were patched. Importer-generated temporary images without staged mapping were skipped.

### R2. Discovery scope gap

Patch discovery did not reliably walk all `loadPageChunk` cursor chunks, so some image blocks were never seen.

Combined effect:
- subset patched to secure
- remainder stayed on temporary chain
- later destination loads showed 404 for remaining temporary links

---

## Fix Strategy and Implementation

### Fix A - Expand patch candidate set

In `patchImageBlocksToSecureBucket`:
- include all temporary image blocks from imported page chunks
- do not restrict to staged direct hits

### Fix B - Add fallback byte source

When temp URL is not in staged map:
- fetch bytes directly from temp URL
- infer mime type and filename
- continue secure upload path

Key helper:
- `resolveAssetDataForTemporaryUrl(...)`

### Fix C - Traverse page chunks

Add cursor-driven collection across `loadPageChunk` responses:
- `collectTemporaryImageBlocksFromPageChunks(...)`
- uses cursor stack + chunkNumber progression
- dedupes by block id

### Fix D - Regression test for mixed source images

Add deterministic test for mixed scenario:
- one staged image + one importer-generated temporary image
- assert both get secure patch upload calls

Test:
- `patches importer-generated temporary image URLs to secure attachment URLs when only part of images have staged assets`

---

## Tooling and Scripts Used

## MCP tools

1. `mcp_io_github_chr_list_pages`
2. `mcp_io_github_chr_new_page`
3. `mcp_io_github_chr_take_snapshot`
4. `mcp_io_github_chr_click`
5. `mcp_io_github_chr_wait_for`
6. `mcp_io_github_chr_list_network_requests` (page + service worker)
7. `mcp_io_github_chr_list_console_messages`

## Terminal scripts

### 1) Image-chain counters on destination page logs

```bash
python3 - <<'PY'
import re, pathlib
p = pathlib.Path('.../call_IMAGE_LOG/content.txt')
rows = []
for ln in p.read_text(errors='ignore').splitlines():
    m = re.match(r'reqid=\d+\s+\w+\s+(\S+)\s+\[(\d+|pending)\]', ln)
    if m: rows.append((m.group(1), m.group(2)))

def c(sub, status=None):
    return sum(1 for u,s in rows if sub in u and (status is None or s == status))

print('temporary_404', c('temporary.notion-static.com', '404'))
print('attachment_302', c('/image/attachment%3A', '302'))
print('prod_secure_200', c('img.notionusercontent.com/s3/prod-files-secure', '200'))
PY
```

### 2) Service-worker endpoint signature counts

```bash
for p in \
  "api/v3/getUploadFileUrl" \
  "api/v3/loadPageChunk" \
  "api/v3/saveTransactions" \
  "temporary.notion-static.com"
do
  echo "$p => $(grep -c "$p" sw-log.txt || true)"
done
```

### 3) Snapshot text smoke checks

```bash
grep -nE "This image couldn't be found|couldn.t be found|Image not found|404" snapshot.txt
```

---

## Before/After Evidence Table

| Metric | Before (failed page) | After (validated page) |
|---|---:|---:|
| temporary image 404 | 22 | 0 |
| temporary image requests on destination page | >0 | 0 |
| attachment proxy 302 | partial/incomplete chain | 13 |
| prod-files-secure 200 | partial/incomplete chain | 13 |
| visible broken placeholder | present | not observed |

---

## Reusable Workflow (Do This Next Time)

1. Lock source truth (exact conversation URL and destination page URL).
2. Run same-session E2E; do not switch samples mid-run.
3. Collect three-lens evidence (UI + destination page + service worker).
4. Use hard acceptance gates (negative + positive signatures).
5. If conflict appears, trust chain evidence over UI labels.
6. Fix first distortion layer, not final renderer symptoms.
7. Encode fix in deterministic regression test.
8. Re-run real E2E and publish numeric pass/fail counters.

---

## Anti-Patterns to Avoid

1. Claiming pass from success toast alone.
2. Declaring fix without destination page network evidence.
3. Assuming staged asset map is complete.
4. Reading only first `loadPageChunk` as whole-page truth.
5. Shipping without mixed-source regression coverage.

---

## Related Files

- `entrypoints/background/notion/sync/markdown-import.ts`
- `tests/entrypoints/background-notion.test.ts`
- `docs/incident-postmortem-template.md`
- `./example-08-claude-to-notion-cors-acceptance-e2e.md`
