# Example 07 — Notion Secure Image Upload Protocol Discovery

**Pattern: Passive API Replay + Field Bisection**
**Trigger: Images appear as ⚠️ broken in Notion after export from ChatGPT**

---

## Symptom

After syncing a ChatGPT conversation to Notion, all images show as broken (⚠️ icon). The images were uploaded to `temporary.notion-static.com` (private S3 bucket). The browser cannot load images from this bucket — it is not Notion's CDN.

---

## Chain Analysis

```text
ChatGPT image URL
  → upload to Notion S3 via getUploadFileUrl
    → embedded as ![img](url) in markdown
      → enqueueTask markdown import
        → Notion creates image block with source = uploaded URL
          → Notion UI renders image block
```

Symptom is at the **last step** (render), but the **loss happens at step 2** — wrong S3 bucket choice.

---

## Root Cause Discovery: Webpack Module Bisection

The correct bucket is `secure`, but earlier attempts with `bucket: 'secure'` returned HTTP 400 "Invalid input".

**Method**: Read Notion's webpack bundle in the running Chrome page to find the full `getUploadFileUrl` call signature.

```javascript
// In Chrome DevTools MCP — evaluate_script on the Notion tab
const modules = Object.entries(window.__webpack_require__.m);
const imageModule = modules.find(([id, fn]) =>
  fn.toString().includes('getUploadFileUrl') &&
  fn.toString().includes('secure')
);
// Found: module 208185
```

**Key discovery in module 208185**: `bucket: 'secure'` requires a `record` field:

```javascript
{
  bucket: 'secure',
  name: fileName,
  contentType: mimeType,
  record: {           // ← MISSING in all previous attempts
    table: 'block',
    id: blockId,      // ← requires the actual Notion block ID
    spaceId: spaceId,
  }
}
```

Without `record`, the endpoint returns 400. With it, the response changes completely:

| Field | `temporary` (no record) | `secure` (with record) |
|-------|--------------------------|------------------------|
| `url` | `https://s3.amazonaws.com/temporary.notion-static.com/…` | `attachment:UUID:filename` |
| `signedPutUrl` | `https://s3.amazonaws.com/temporary.notion-static.com/…` | `https://prod-files-secure.s3.us-west-2.amazonaws.com/…` |
| Browser-accessible? | ❌ Private bucket | ✅ Notion CDN via image proxy |

---

## The `attachment:UUID:filename` Format

When `bucket: 'secure'` succeeds, the `url` field returns `attachment:UUID:filename` (not an HTTP URL). This is Notion's internal permanent file reference.

- Stored in block: `properties.source = [["attachment:UUID:filename"]]`
- Rendered by Notion via: `https://www.notion.so/image/attachment%3AUUID%3Afilename?table=block&id=…`
- Can be resolved to a signed CDN URL via `getSignedFileUrls` API (24h TTL)

**Confirmed working**: Set block source to `attachment:UUID:filename` → block renders correctly (`naturalWidth: 1` on a test 1×1 PNG).

---

## The Second Blocker: Markdown Import Rejects `attachment:` URLs

Embedding `attachment:UUID:filename` directly in the markdown sent to Notion's importer fails:

```
enqueueTask → import → state: 'failure'
```

Notion's server-side markdown importer cannot handle the `attachment:` scheme. It only accepts HTTP(S) URLs in `![img](url)` syntax.

**This means `bucket: 'secure'` cannot be used before the import task.**

---

## Solution: Two-Phase Upload

```text
Phase 1 — Before markdown import:
  uploadStagedImagesToNotionS3(bucket: 'temporary')
    → returns HTTP URL (temporary.notion-static.com)
    → embed in markdown as ![img](tempUrl)
  → markdown import succeeds

Phase 2 — After import task completes:
  patchImageBlocksToSecureBucket()
    → loadPageChunk(pageId) → discover actual block IDs
    → for each image block whose source == tempUrl:
        getUploadFileUrl(bucket: 'secure', record: { table: 'block', id: blockId, spaceId })
          → returns { url: 'attachment:UUID:filename', signedPutUrl: 'prod-files-secure…' }
        PUT image bytes → signedPutUrl
        saveTransactionsFanout:
          set properties.source = [["attachment:UUID:filename"]]
          listAfter file_ids with fileUUID
          createLastEditedUpdateOperation
```

The image block now permanently lives in `prod-files-secure.s3.us-west-2.amazonaws.com` and Notion serves it via its CDN image proxy.

---

## `NotionRecordWrapper<T>` — Double-Value Structure

`loadPageChunk` returns blocks wrapped in `NotionRecordWrapper<T>`:

```typescript
// Type: NotionRecordWrapper<BlockRecord> = { spaceId?, role?, value?: { value: T } }
// Access pattern:
const block = chunkResult.data.recordMap.block[blockId].value?.value;
//                                                       ^^^^^^^^^^^
//                                                       double-deref required
```

**Common mistake**: accessing `.value` only once gets `{ value: BlockRecord }`, not the block itself.

---

## Key Protocol Facts

| Fact | Detail |
|------|--------|
| `getUploadFileUrl` endpoint | `POST https://www.notion.so/api/v3/getUploadFileUrl` |
| `bucket: 'secure'` requires | `record: { table: 'block', id: blockId, spaceId }` |
| Block ID source | `loadPageChunk` after import, not before (block doesn't exist yet) |
| `attachment:` URL format | `attachment:{fileUUID}:{originalFilename}` |
| `file_ids` patch | `listAfter: { id: fileUUID }` on the block's `file_ids` property |
| Markdown import restriction | Only HTTP(S) URLs work in `![img](url)` — `attachment:` causes `state: 'failure'` |
| Notion CDN render pattern | `https://www.notion.so/image/attachment%3A{uuid}%3A{filename}?table=block&id=…` |

---

## Regression Fixture Pattern

Tests must mock the full 12-call sequence:

1. `getSpaces`
2. `saveTransactionsFanout` (page creation)
3. `getUploadFileUrl` — image, **`temporary` bucket** → returns HTTP temp URL
4. S3 PUT → temp bucket
5. `getUploadFileUrl` — markdown, `temporary` bucket
6. S3 PUT → markdown bytes
7. `enqueueTask`
8. `getTasks` → `state: 'success'`
9. `loadPageChunk` → image block with `source: [[tempUrl]]` (double-value structure)
10. `getUploadFileUrl` — image, **`secure` bucket** → returns `attachment:UUID:filename`
11. S3 PUT → `prod-files-secure`
12. `saveTransactionsFanout` → block patch

Test assertion distinguisher: find markdown PUT by `call[0].includes('chat.md')`, not by `temporary.notion-static.com` (the image binary PUT also hits that domain).

---

## Follow-Up Bug: Chat-Selection Can Display Claude SVG, But Notion Sync Still Needs Raster Fallback

`chat-selection` rendering success is not the same thing as Notion import compatibility.

Claude images reach `chat-selection` through two SVG-friendly paths:

- direct `data:image/svg+xml;base64,...` widget images emitted by the Claude parser
- staged SVG data URLs that the page renderer can display directly

This means the preview surface can look correct even while the Notion write path is still unsafe.

```text
chat-selection render success
  != Notion markdown-import compatibility
```

The DOCX/PDF export path already had a proven browser-side fallback:

```text
staged SVG in DOM
  -> load resolved <img>
  -> draw to canvas
  -> export PNG data URL
```

The Notion sync path originally did not reuse that fallback. It sent raw staged SVG assets into the markdown-import pipeline, leaving the import dependent on Notion's undocumented SVG handling and the temporary-bucket patch chain.

The safer fix is:

```text
chat-selection DOM
  -> collectResolvedImagesFromDom()
  -> buildNotionSyncStagedAssetOverrides()
  -> syncSelectedMessagesToNotion(stagedAssetsOverride)
  -> markdown-import uploads PNG instead of SVG
```

This preserves the user-visible rendering truth from `chat-selection` while making the Notion write path independent of whether Notion will successfully accept and permanently serve SVG attachments.
