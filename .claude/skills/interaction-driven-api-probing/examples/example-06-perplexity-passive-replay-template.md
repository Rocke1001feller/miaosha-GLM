# Example 06 — Perplexity Passive API Replay (Parser Forensics Template)

## Why This Example Exists

Perplexity uses cookie authentication plus a small set of `x-app-*` version headers. Its response
schema uses a **typed block array** rather than positional arrays or flat message text, making it
structurally different from AI Studio and Grok.

This is a **transfer template**: it gives you the investigation scaffold and the key fields to
inspect for the most common parser bug classes.

## Known Bug Class: Same Pattern As AI Studio

User-reported bugs (2026-04-26):
- `https://www.perplexity.ai/search/ee2237df-69e8-4c91-b83f-e2a46daf2164`
- Suspected: thinking content not shown, or model-generated images missing, or wrong text content

## Source Truth vs Target Truth (Fill In For Your Bug)

| | Your Bug |
|---|---|
| **Source truth** | What Perplexity shows in the browser |
| **Target truth** | What the extension shows after export |
| **Chain location** | `services/platform-slices/perplexity/parser.ts` |
| **Specific parser section** | `extractPerplexityBlockText`, `extractPerplexityImages`, block type dispatch |

## Auth: Cookie + x-app Headers

Perplexity requires three extra headers beyond cookies. These are static and match the API version
the parser was built against:

```javascript
const PERPLEXITY_HEADERS = {
  'x-app-apiclient': 'default',
  'x-app-apiversion': '2.18',
  'x-perplexity-request-try-number': '1',
};
```

**Cloudflare precaution**: If you navigate to a Perplexity URL in a fresh tab, Cloudflare may
show a Turnstile challenge. Do NOT open a fresh tab for this. Use an existing open Perplexity tab
or navigate within the existing tab.

## API Endpoint

```text
GET https://www.perplexity.ai/rest/thread/{slug}
    ?with_parent_info=true
    &with_schematized_response=true
    &version=2.18
    &source=default
    &limit=10
    &offset=0
    &from_first=true
    &supported_block_use_cases=answer_modes
    &supported_block_use_cases=media_items
    &supported_block_use_cases=inline_images
    ... (see PERPLEXITY_SUPPORTED_BLOCK_USE_CASES in parser.ts for full list)
```

The `slug` is the UUID at the end of the `/search/` URL path segment.

## Full Replay Script

```javascript
async () => {
  const slug = window.location.href.match(/\/search\/([0-9a-f-]{36})/)?.[1];
  if (!slug) return { error: 'no thread slug in URL: ' + window.location.href };

  // Build query params matching the parser's buildPerplexityThreadApiUrl
  const params = new URLSearchParams({
    with_parent_info: 'true',
    with_schematized_response: 'true',
    version: '2.18',
    source: 'default',
    limit: '10',
    offset: '0',
    from_first: 'true',
  });
  // Include all supported_block_use_cases from parser.ts
  for (const uc of [
    'answer_modes','media_items','knowledge_cards','inline_entity_cards',
    'inline_images','inline_assets','unified_assets','canvas_mode',
    'diff_blocks','workflow_steps','answer_tabs',
  ]) { params.append('supported_block_use_cases', uc); }

  const res = await fetch(
    `https://www.perplexity.ai/rest/thread/${slug}?${params}`,
    {
      credentials: 'include',
      headers: {
        'accept': 'application/json',
        'x-app-apiclient': 'default',
        'x-app-apiversion': '2.18',
        'x-perplexity-request-try-number': '1',
        'x-perplexity-request-reason': 'search-components',
        'x-perplexity-request-endpoint': `https://www.perplexity.ai/rest/thread/${slug}`,
      },
    }
  );
  if (!res.ok) return { error: `HTTP ${res.status} ${res.statusText}` };
  const data = await res.json();

  // Navigate to the messages array — structure may vary by response version
  const messages = data?.thread?.messages ?? data?.messages ?? data?.items ?? [];

  return messages.map((m, idx) => ({
    idx,
    role: m.role ?? m.type,
    modelId: m.display_model ?? m.user_selected_model ?? m.model ?? null,
    textLen: (m.text ?? m.answer ?? '').length,
    // Block type map — this is the most important inspection output
    blockSummary: (m.blocks ?? []).map(b => {
      const blockKey = Object.keys(b).find(k => k.endsWith('_block'));
      return blockKey ? blockKey : Object.keys(b).slice(0, 3).join(',');
    }),
    // Known content paths
    hasMarkdownBlock: (m.blocks ?? []).some(b => 'markdown_block' in b),
    hasTextBlock: (m.blocks ?? []).some(b => 'text_block' in b),
    hasInlineImages: (m.blocks ?? []).some(b => 'inline_images_block' in b || 'unified_assets_block' in b),
    hasWorkflowSteps: (m.blocks ?? []).some(b => 'workflow_steps_block' in b),
    // Top-level message fields (for thinking or special content outside blocks)
    topLevelKeys: Object.keys(m).filter(k => k !== 'blocks').join(', '),
  }));
}
```

## Block Schema: How Perplexity Structures Content

Unlike AI Studio (positional arrays) or Grok (flat response.message), Perplexity wraps content in
typed blocks. The parser dispatches by block key:

| Block key | Parser function | Contains |
|-----------|----------------|----------|
| `markdown_block` | `extractPerplexityBlockText` → `.answer`, `.text`, `.paragraphs[]` | Main answer text |
| `text_block` | `extractPerplexityBlockText` → `.text`, `.answer` | Plain text sections |
| `equation_block` | `extractPerplexityBlockText` → `.latex`, `.text` | LaTeX equations |
| `inline_images_block` | `extractPerplexityImages` | Web search images |
| `unified_assets_block` | `extractPerplexityImages` | Uploaded/generated assets |
| `knowledge_cards` block | Separate handling | Factual cards |
| `workflow_steps_block` | Not yet parsed (as of 2026-04) | Agent step results |

If a block type is not in this table, it may be **silently dropped** by the parser. Check
`extractPerplexityBlockText` for the full dispatch.

## Bisection Guide For Perplexity Parser Bugs

### Text Content Missing Or Garbled

Step 1: Check which block type holds the answer text in this conversation:

```javascript
return messages
  .filter(m => m.role === 'assistant')
  .map(m => ({
    blockTypes: (m.blocks ?? []).map(b => Object.keys(b).find(k => k.endsWith('_block')) ?? '?'),
    markdownAnswerLen: (m.blocks ?? []).find(b => b.markdown_block)?.markdown_block?.answer?.length ?? 0,
    textBlockLen: (m.blocks ?? []).find(b => b.text_block)?.text_block?.text?.length ?? 0,
    topLevelTextLen: (m.text ?? m.answer ?? '').length,
  }));
```

Step 2: If a block type that exists in the response is not in the parser's dispatch, the content
is silently lost. Add a case for it in `extractPerplexityBlockText`.

### Thinking Content Missing

Perplexity surfaces thinking content differently depending on model:
- For Claude Thinking models: look for a block with `thinking_content`, `thinking_block`, or a
  `type: 'thinking'` field at the top message level
- For GPT-5 Thinking / Grok 4 models via Perplexity: check `m.thinking` or `m.reasoning_content`

Probe:
```javascript
return messages
  .filter(m => m.role === 'assistant')
  .map(m => ({
    topKeys: Object.keys(m).join(', '),
    hasThinkingField: 'thinking' in m || 'reasoning_content' in m || 'thinking_content' in m,
    thinkingSnippet: (m.thinking ?? m.reasoning_content ?? '').slice(0, 100),
    blockTypes: (m.blocks ?? []).map(b => Object.keys(b).find(k => k.includes('think')) ?? null).filter(Boolean),
  }));
```

### Images Missing

```javascript
return messages
  .filter(m => m.role === 'assistant')
  .flatMap(m => (m.blocks ?? []).filter(b => b.inline_images_block || b.unified_assets_block))
  .map(b => ({
    blockKey: b.inline_images_block ? 'inline_images_block' : 'unified_assets_block',
    images: (b.inline_images_block?.images ?? b.unified_assets_block?.assets ?? [])
      .map(img => ({ url: img.url ?? img.image_url ?? '?', mimeType: img.mime_type ?? img.type ?? '?' })),
  }));
```

### Model ID Wrong Or Missing

Perplexity returns `display_model` and `user_selected_model` as internal ID strings. The parser
maps these via `PERPLEXITY_MODEL_LABELS`. If a new model ID appears that is not in the map, the
parser will show the raw ID string as the display label.

Check the raw model IDs:
```javascript
return messages
  .filter(m => m.role === 'assistant')
  .map(m => ({ displayModel: m.display_model, userSelectedModel: m.user_selected_model }));
```

Add any missing IDs to `PERPLEXITY_MODEL_LABELS` in `parser.ts`.

## Protocol Dossier

```text
Auth:         Cookie-only + x-app-apiclient: default + x-app-apiversion: 2.18
Thread API:   GET /rest/thread/{slug}?with_schematized_response=true&version=2.18&...
Pagination:   First page: offset=0&from_first=true. Next pages: cursor=<cursor_from_response>
Slug:         UUID from URL path /search/<uuid>
Block types:  markdown_block | text_block | equation_block | inline_images_block | unified_assets_block | ...
Model IDs:    display_model / user_selected_model (map via PERPLEXITY_MODEL_LABELS)
Cloudflare:   Reuse existing open logged-in tab. Never open fresh tab for forensics.
```

## Implementation Boundary

Parser file: `services/platform-slices/perplexity/parser.ts`
Key functions: `extractPerplexityBlockText`, `extractPerplexityImages`, `parsePerplexityResponse`
M6 fetch: `services/platform-slices/perplexity/index.ts` → `executeFetch` → `buildPerplexityThreadApiUrl`
Tests: `tests/services/platform-slices/perplexity-slice.test.ts`

## Transferable Lessons

1. **Block types are the dispatch key.** If content is lost, the first question is: what is the block type, and is it handled in `extractPerplexityBlockText`?
2. **`x-app-apiversion` must stay in sync with `buildPerplexityThreadApiUrl` in the parser.** If the parser upgrades its version string but the forensics header does not match, the API may return a different schema.
3. **Use an existing Perplexity tab.** Cloudflare Turnstile blocks new headless tabs. The logged-in Chrome tab already passed the challenge.
4. **`display_model` → label mapping breaks on new models.** When Perplexity adds a new model ID, it silently shows as the raw string. Add it to `PERPLEXITY_MODEL_LABELS`.
5. **Thinking content location is model-dependent.** Different underlying models route thinking to different fields. Always probe `m.thinking`, `m.reasoning_content`, and block types before assuming thinking is absent.
