#!/usr/bin/env node

const {
  callToolWithRetry,
  createPatchedClient,
  extractChatSelectionFromDesc,
  parseJsonBlock,
  parsePageLines,
  sleep,
} = require('./mcp-common.cjs');

function fail(message, details = {}) {
  console.error(JSON.stringify({ ok: false, message, details }, null, 2));
  process.exit(2);
}

function pickPerplexitySourcePage(pages) {
  const candidates = pages.filter((page) => page.desc.includes('https://www.perplexity.ai/search/'));
  return candidates.sort((a, b) => b.pageId - a.pageId)[0] || null;
}

function pickExtensionId(pages) {
  if (process.env.EXT_ID) {
    return process.env.EXT_ID;
  }
  for (const page of pages) {
    const parsed = extractChatSelectionFromDesc(page.desc);
    if (parsed?.extId) {
      return parsed.extId;
    }
  }
  return null;
}

function pickLatestPopupPage(pages, extId) {
  const candidates = pages.filter((page) => page.desc.includes(`chrome-extension://${extId}/popup.html`));
  return candidates.sort((a, b) => b.pageId - a.pageId)[0] || null;
}

function pickLatestChatSelectionPage(pages, extId) {
  const candidates = pages.filter((page) => page.desc.includes(`chrome-extension://${extId}/chat-selection.html?id=`));
  return candidates.sort((a, b) => b.pageId - a.pageId)[0] || null;
}

function captureChatSelectionPageIds(pages, extId) {
  const ids = new Set();
  for (const page of pages) {
    if (!page.desc.includes(`chrome-extension://${extId}/chat-selection.html?id=`)) {
      continue;
    }
    ids.add(page.pageId);
  }
  return ids;
}

function parseExportButton(snapshotText) {
  const candidates = [];
  for (const line of snapshotText.split(/\r?\n/)) {
    const match = line.match(/uid=(\S+)\s+button\s+"([^"]*)"(.*)$/i);
    if (!match) {
      continue;
    }
    const uid = match[1];
    const label = match[2];
    const suffix = (match[3] || '').toLowerCase();
    const lower = label.toLowerCase();
    if (!lower.includes('export') && !lower.includes('导出')) {
      continue;
    }
    candidates.push({ uid, label, disabled: suffix.includes('disabled') });
  }

  const strong = candidates.find((item) => item.label.toLowerCase().includes('export now') && !item.disabled);
  if (strong) {
    return { pick: strong, candidates };
  }

  const nonSync = candidates.find((item) => {
    const lower = item.label.toLowerCase();
    return !item.disabled && !lower.includes('sync exports') && !lower.includes('log in');
  });
  if (nonSync) {
    return { pick: nonSync, candidates };
  }

  const fallback = candidates.find((item) => !item.disabled) || null;
  return { pick: fallback, candidates };
}

(async () => {
  const client = await createPatchedClient('example3-perplexity-dual-snapshot-oneclick');
  let freshClient = null;
  try {
    let pages = parsePageLines(await callToolWithRetry(client, 'list_pages', {}, { retries: 3 }));
    let sourcePage = pickPerplexitySourcePage(pages);

    if (!sourcePage && process.env.SOURCE_URL) {
      await callToolWithRetry(client, 'new_page', { url: process.env.SOURCE_URL }, { retries: 2 });
      pages = parsePageLines(await callToolWithRetry(client, 'list_pages', {}, { retries: 3 }));
      sourcePage = pickPerplexitySourcePage(pages);
    }

    if (!sourcePage) {
      fail('No Perplexity source page found.', {
        hint: 'Open a Perplexity search page or set SOURCE_URL and rerun.',
      });
    }

    const extId = pickExtensionId(pages);
    if (!extId) {
      fail('Could not resolve extension ID.', {
        hint: 'Set EXT_ID env var or open any chat-selection extension page first.',
      });
    }

    await callToolWithRetry(client, 'select_page', { pageId: sourcePage.pageId, bringToFront: true }, { retries: 3 });

    const sourceSnapshot = await callToolWithRetry(client, 'take_snapshot', {}, { retries: 3 });
    const sourceProbeText = await callToolWithRetry(client, 'evaluate_script', {
      function: `() => {
        const main = document.querySelector('main') || document.body;
        const text = (main.textContent || '').replace(/\\s+/g, ' ').trim();
        const anchors = [...main.querySelectorAll('a[href]')]
          .map((a) => ({ href: a.href, text: (a.textContent || '').trim() }))
          .filter((x) => x.href);
        return {
          location: location.href,
          title: document.title,
          tokenShape: {
            hasNumericBracket: /\\[(\\d+)\\]/.test(text),
            hasFootnoteMarker: /\\[\\^(\\d+)\\^\\]/.test(text),
            hasDomainLikeToken: /(?:[a-z0-9-]+\\.)+[a-z]{2,}(?:\\s*\\+\\s*\\d+)?/i.test(text),
          },
          sourceLinksCount: anchors.length,
          sourceLinksSample: anchors.slice(0, 15),
          textHead: text.slice(0, 900),
        };
      }`,
    }, { retries: 2 });
    const sourceProbe = parseJsonBlock(sourceProbeText) || { raw: sourceProbeText };

    const baselineChatPages = captureChatSelectionPageIds(pages, extId);

    const notes = [];

    try {
      await callToolWithRetry(client, 'reload_extension', { id: extId }, { retries: 2 });
    } catch (error) {
      notes.push(`reload_extension failed, continuing without hard stop: ${String(error?.message || error)}`);
    }

    await callToolWithRetry(client, 'select_page', { pageId: sourcePage.pageId, bringToFront: true }, { retries: 3 });

    try {
      await callToolWithRetry(client, 'trigger_extension_action', { id: extId }, { retries: 2 });
    } catch (error) {
      notes.push(`trigger_extension_action failed, falling back to popup URL: ${String(error?.message || error)}`);
      await callToolWithRetry(client, 'new_page', { url: `chrome-extension://${extId}/popup.html` }, { retries: 2 });
    }

    pages = parsePageLines(await callToolWithRetry(client, 'list_pages', {}, { retries: 3 }));
    const popupPage = pickLatestPopupPage(pages, extId);
    if (!popupPage) {
      fail('No popup page found after trigger/fallback.', { extId, notes });
    }

    await callToolWithRetry(client, 'select_page', { pageId: popupPage.pageId, bringToFront: true }, { retries: 3 });
    const popupSnapshot = await callToolWithRetry(client, 'take_snapshot', {}, { retries: 3 });

    const exportPick = parseExportButton(popupSnapshot);
    if (!exportPick.pick) {
      fail('No usable export button found in popup.', {
        popupPage,
        candidates: exportPick.candidates,
      });
    }

    await callToolWithRetry(client, 'click', { uid: exportPick.pick.uid }, { retries: 3 });

    let targetPage = null;
    let targetClient = client;
    for (let i = 0; i < 24; i += 1) {
      await sleep(1000);
      const loopPages = parsePageLines(await callToolWithRetry(client, 'list_pages', {}, { retries: 2 }));
      const candidate = pickLatestChatSelectionPage(loopPages, extId);
      if (!candidate) {
        continue;
      }
      if (!baselineChatPages.has(candidate.pageId)) {
        targetPage = candidate;
        break;
      }
      targetPage = candidate;
    }

    if (!targetPage) {
      notes.push('Current MCP session did not surface chat-selection page after export; retrying with a fresh client session.');

      freshClient = await createPatchedClient('example3-perplexity-dual-snapshot-oneclick-fresh-poll');
      try {
        for (let i = 0; i < 12; i += 1) {
          await sleep(1000);
          const freshPages = parsePageLines(await callToolWithRetry(freshClient, 'list_pages', {}, { retries: 2 }));
          const freshCandidate = pickLatestChatSelectionPage(freshPages, extId);
          if (!freshCandidate) {
            continue;
          }
          targetPage = freshCandidate;
          targetClient = freshClient;
          break;
        }
      } finally {
        if (freshClient && targetClient !== freshClient) {
          await freshClient.close();
          freshClient = null;
        }
      }
    }

    if (!targetPage) {
      fail('No chat-selection target page discovered after Export Now.', {
        extId,
        popupPage,
        exportButton: exportPick.pick,
        exportCandidates: exportPick.candidates,
      });
    }

    await callToolWithRetry(targetClient, 'select_page', { pageId: targetPage.pageId, bringToFront: true }, { retries: 3 });
    const targetSnapshot = await callToolWithRetry(targetClient, 'take_snapshot', {}, { retries: 3 });

    const targetProbeText = await callToolWithRetry(targetClient, 'evaluate_script', {
      function: `() => new Promise((resolve) => {
        const params = new URLSearchParams(location.search);
        const convId = params.get('id') || '';
        const key = convId ? 'chat_export_' + convId : null;

        const rendered = {
          citationChipCount: document.querySelectorAll('.citation-chip').length,
          staleBadgeCount: document.querySelectorAll('.citation-stale, .citation-chip--stale').length,
          sourceBlocks: document.querySelectorAll('.message-sources, .sources-list, .message__sources').length,
          proseHead: (document.querySelector('.message-content, .message-text')?.textContent || '').slice(0, 800),
        };

        if (!key) {
          resolve({ convId, key, storage: null, rendered });
          return;
        }

        chrome.storage.local.get(key, (items) => {
          const raw = items?.[key];
          const payload = raw && typeof raw === 'object' && raw.data ? raw.data : raw;
          const messages = Array.isArray(payload?.messages) ? payload.messages : [];
          const assistant = messages.find((m) => m?.role === 'assistant') || null;
          const content = typeof assistant?.content === 'string' ? assistant.content : '';

          resolve({
            convId,
            key,
            storage: assistant ? {
              sourcesLen: Array.isArray(assistant.sources) ? assistant.sources.length : 0,
              citationMapLen: assistant.citationMap && typeof assistant.citationMap === 'object'
                ? Object.keys(assistant.citationMap).length
                : 0,
              markerSample: (content.match(/\\[\\^\\d+\\^\\]/g) || []).slice(0, 20),
              contentHead: content.slice(0, 800),
            } : null,
            rendered,
          });
        });
      })`,
    }, { retries: 2 });

    const targetProbe = parseJsonBlock(targetProbeText) || { raw: targetProbeText };

    const summary = {
      ok: true,
      example: 'example3-perplexity-dual-snapshot',
      extId,
      sourcePage,
      popupPage,
      targetPage,
      sourceSnapshotHasContent: sourceSnapshot.length > 0,
      targetSnapshotHasContent: targetSnapshot.length > 0,
      sourceProbe,
      targetProbe,
      exportButton: exportPick.pick,
      exportCandidates: exportPick.candidates,
      notes,
    };

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await client.close();
    if (freshClient) {
      await freshClient.close();
    }
  }
})().catch((error) => {
  fail('Unexpected failure in example3-perplexity-dual-snapshot-oneclick.', {
    error: String(error?.stack || error?.message || error),
  });
});
