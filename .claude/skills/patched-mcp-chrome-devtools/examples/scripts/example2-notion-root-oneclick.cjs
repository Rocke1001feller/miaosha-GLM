#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const {
  callToolWithRetry,
  createPatchedClient,
  ensureDir,
  extractChatSelectionFromDesc,
  parseJsonBlock,
  parseNetworkRows,
  parsePageLines,
  sleep,
} = require('./mcp-common.cjs');

function fail(message, details = {}) {
  console.error(JSON.stringify({ ok: false, message, details }, null, 2));
  process.exit(2);
}

function pickNotionPage(pages) {
  const candidates = pages.filter((p) => p.desc.startsWith('https://www.notion.so/'));
  return candidates.sort((a, b) => b.pageId - a.pageId)[0] || null;
}

function parseUidsFromSnapshot(snapshotText) {
  const newPageMatch = snapshotText.match(/uid=(\S+)\s+button\s+"New page"/i);
  const pageMatch = snapshotText.match(/uid=(\S+)\s+menuitem\s+"Page"/i);
  return {
    newPageUid: newPageMatch?.[1] || null,
    pageUid: pageMatch?.[1] || null,
  };
}

function parseSavedRequestJson(requestBasePath) {
  const filePath = `${requestBasePath}.network-request`;
  if (!fs.existsSync(filePath)) {
    return null;
  }
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

(async () => {
  const artifactDir = path.join(process.cwd(), '.tmp', 'notion-root');
  ensureDir(artifactDir);

  const client = await createPatchedClient('example2-notion-root-oneclick');
  try {
    const pagesBefore = parsePageLines(await callToolWithRetry(client, 'list_pages', {}, { retries: 3 }));
    const notionPage = pickNotionPage(pagesBefore);
    if (!notionPage) {
      fail('No Notion page found. Open a workspace root page first, then rerun.', {
        hint: 'Expected at least one https://www.notion.so/... page in list_pages',
      });
    }

    await callToolWithRetry(client, 'select_page', { pageId: notionPage.pageId, bringToFront: true }, { retries: 3 });

    const baselineRows = parseNetworkRows(await callToolWithRetry(client, 'list_network_requests', {
      pageSize: 320,
      pageIdx: 0,
      resourceTypes: ['xhr', 'fetch', 'document', 'preflight'],
      includePreservedRequests: true,
    }, { retries: 3 }));

    const baselineReqids = new Set(baselineRows.map((row) => row.reqid));

    const firstSnapshot = await callToolWithRetry(client, 'take_snapshot', {}, { retries: 3 });
    const firstUids = parseUidsFromSnapshot(firstSnapshot);
    if (!firstUids.newPageUid) {
      fail('Could not locate New page UID from snapshot.', {
        hint: 'Confirm Notion sidebar is visible and retry.',
      });
    }

    await callToolWithRetry(client, 'click', { uid: firstUids.newPageUid }, { retries: 3 });

    const secondSnapshot = await callToolWithRetry(client, 'take_snapshot', {}, { retries: 3 });
    const secondUids = parseUidsFromSnapshot(secondSnapshot);
    if (!secondUids.pageUid) {
      fail('Could not locate Page menu UID after clicking New page.', {
        hint: 'UIDs are dynamic; ensure menu is expanded and rerun.',
      });
    }

    await callToolWithRetry(client, 'click', { uid: secondUids.pageUid }, { retries: 3 });
    await sleep(3800);

    const afterRows = parseNetworkRows(await callToolWithRetry(client, 'list_network_requests', {
      pageSize: 360,
      pageIdx: 0,
      resourceTypes: ['xhr', 'fetch', 'document', 'preflight'],
      includePreservedRequests: true,
    }, { retries: 3 }));

    const newRows = afterRows.filter((row) => !baselineReqids.has(row.reqid));
    const saveRow = newRows.find((row) => row.url.includes('/api/v3/saveTransactionsFanout'))
      || afterRows.find((row) => row.url.includes('/api/v3/saveTransactionsFanout'))
      || null;

    if (!saveRow) {
      fail('Did not capture saveTransactionsFanout request. Cannot continue protocol proof.', {
        baselineCount: baselineRows.length,
        afterCount: afterRows.length,
        newRows: newRows.slice(0, 25),
      });
    }

    const reqBase = path.join(artifactDir, `save-req-${saveRow.reqid}`);
    const resBase = path.join(artifactDir, `save-res-${saveRow.reqid}`);

    await callToolWithRetry(client, 'get_network_request', {
      reqid: Number(saveRow.reqid),
      requestFilePath: reqBase,
      responseFilePath: resBase,
    }, { retries: 2 });

    const requestBody = parseSavedRequestJson(reqBase);
    const spaceId = requestBody?.transactions?.[0]?.spaceId || null;
    if (!spaceId) {
      fail('Could not parse SPACE_ID from saved saveTransactions request.', {
        requestPath: `${reqBase}.network-request`,
      });
    }

    const pagesMid = parsePageLines(await callToolWithRetry(client, 'list_pages', {}, { retries: 3 }));
    const chatPage = pagesMid
      .filter((page) => extractChatSelectionFromDesc(page.desc))
      .sort((a, b) => b.pageId - a.pageId)[0] || null;

    if (!chatPage) {
      fail('No chat-selection extension page found for runtime sync step.', {
        hint: 'Open chat-selection page first and rerun.',
      });
    }

    await callToolWithRetry(client, 'select_page', { pageId: chatPage.pageId, bringToFront: true }, { retries: 3 });

    const runtimeSyncText = await callToolWithRetry(client, 'evaluate_script', {
      function: `() => new Promise((resolve) => {
        const params = new URLSearchParams(location.search);
        const convId = params.get('id') || '';
        const key = convId ? 'chat_export_' + convId : null;

        if (!key) {
          resolve({ ok: false, reason: 'No conversation id in chat-selection URL' });
          return;
        }

        chrome.storage.local.get(key, (items) => {
          const raw = items?.[key];
          const conversation = raw && typeof raw === 'object' && raw.data ? raw.data : raw;
          const messages = Array.isArray(conversation?.messages) ? conversation.messages : [];
          const selectedMessageIds = messages.map((m) => m?.id).filter(Boolean);

          if (!conversation || !selectedMessageIds.length) {
            resolve({
              ok: false,
              reason: 'Missing conversation payload or selectedMessageIds',
              convId,
              key,
              hasConversation: !!conversation,
              selectedCount: selectedMessageIds.length,
            });
            return;
          }

          chrome.runtime.sendMessage({
            type: 'NOTION_SYNC_SELECTION',
            request: {
              parent: {
                id: '${spaceId}',
                kind: 'workspace',
                workspaceId: '${spaceId}',
              },
              conversation,
              selectedMessageIds,
              writeMode: 'markdown-import',
            },
          }, (response) => {
            resolve({
              ok: true,
              convId,
              key,
              selectedCount: selectedMessageIds.length,
              lastError: chrome.runtime.lastError ? chrome.runtime.lastError.message : null,
              response,
            });
          });
        });
      })`,
    }, { retries: 2 });

    const runtimeSync = parseJsonBlock(runtimeSyncText);
    if (!runtimeSync?.ok) {
      fail('Runtime sync script failed before Notion request completed.', {
        runtimeSync,
      });
    }

    const syncResult = runtimeSync?.response?.result || null;
    const pageUrl = syncResult?.pageUrl || null;

    let pageVerification = null;
    if (pageUrl) {
      await callToolWithRetry(client, 'new_page', { url: pageUrl }, { retries: 2 });
      const pagesAfter = parsePageLines(await callToolWithRetry(client, 'list_pages', {}, { retries: 3 }));
      const resultPage = pagesAfter.find((page) => page.desc.includes(pageUrl));
      if (resultPage) {
        await callToolWithRetry(client, 'select_page', { pageId: resultPage.pageId, bringToFront: true }, { retries: 2 });
        const verifyText = await callToolWithRetry(client, 'evaluate_script', {
          function: `() => ({
            href: location.href,
            title: document.title,
            h1: (document.querySelector('h1')?.textContent || '').trim().slice(0, 200),
          })`,
        }, { retries: 2 });
        pageVerification = parseJsonBlock(verifyText);
      }
    }

    const summary = {
      ok: true,
      example: 'example2-notion-root',
      notionPageId: notionPage.pageId,
      saveTransactionsReqid: saveRow.reqid,
      requestArtifact: `${reqBase}.network-request`,
      responseArtifact: `${resBase}.network-response`,
      spaceId,
      runtimeSync,
      pageVerification,
      notes: [
        'get_network_request requires reqid as number in current patched build.',
        'After clicking New page, re-take snapshot and rediscover Page menu uid.',
      ],
    };

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await client.close();
  }
})().catch((error) => {
  fail('Unexpected failure in example2-notion-root-oneclick.', {
    error: String(error?.stack || error?.message || error),
  });
});
