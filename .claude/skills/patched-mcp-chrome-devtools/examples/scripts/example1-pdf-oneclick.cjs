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
  const payload = { ok: false, message, details };
  console.error(JSON.stringify(payload, null, 2));
  process.exit(2);
}

function pickTargetChatSelectionPage(pages, extId, convId) {
  const filtered = pages.filter((page) => {
    const parsed = extractChatSelectionFromDesc(page.desc);
    if (!parsed) {
      return false;
    }
    if (extId && parsed.extId !== extId) {
      return false;
    }
    if (convId && parsed.convId !== convId) {
      return false;
    }
    return true;
  });

  if (!filtered.length) {
    return null;
  }
  return filtered.sort((a, b) => b.pageId - a.pageId)[0];
}

(async () => {
  const client = await createPatchedClient('example1-pdf-oneclick');
  try {
    const pagesText = await callToolWithRetry(client, 'list_pages', {}, { retries: 3 });
    const pages = parsePageLines(pagesText);

    const seedPage = pickTargetChatSelectionPage(
      pages,
      process.env.EXT_ID || null,
      process.env.CONV_ID || null,
    );

    if (!seedPage) {
      fail('No chat-selection page found. Open a chat-selection page first, then rerun.', {
        hint: 'Expected chrome-extension://<extId>/chat-selection.html?id=<convId>',
      });
    }

    const seedParsed = extractChatSelectionFromDesc(seedPage.desc);
    const extId = seedParsed.extId;
    const convId = seedParsed.convId;
    const targetUrl = `chrome-extension://${extId}/chat-selection.html?id=${convId}`;

    await callToolWithRetry(client, 'new_page', { url: targetUrl }, { retries: 1 });

    const pagesAfterOpen = parsePageLines(await callToolWithRetry(client, 'list_pages', {}, { retries: 3 }));
    const targetPage = pickTargetChatSelectionPage(pagesAfterOpen, extId, convId);
    if (!targetPage) {
      fail('chat-selection page missing after new_page.', { extId, convId, targetUrl });
    }

    await callToolWithRetry(client, 'select_page', { pageId: targetPage.pageId, bringToFront: true }, { retries: 3 });

    const inventoryText = await callToolWithRetry(client, 'evaluate_script', {
      function: `() => {
        const buttons = Array.from(document.querySelectorAll('button')).map((b, i) => ({
          i,
          txt: (b.innerText || '').trim().replace(/\\s+/g, ' ').slice(0, 120),
          aria: (b.getAttribute('aria-label') || '').trim(),
          title: (b.getAttribute('title') || '').trim(),
          dataFormat: b.getAttribute('data-export-format') || b.getAttribute('data-format') || null,
          disabled: !!b.disabled,
        }));
        const pdfCandidates = buttons.filter((b) => {
          const s = (String(b.txt) + ' ' + String(b.aria) + ' ' + String(b.title) + ' ' + String(b.dataFormat || '')).toLowerCase();
          return s.includes('pdf') || s.includes('export');
        });
        return { total: buttons.length, pdfCandidates };
      }`,
    }, { retries: 2 });

    const inventory = parseJsonBlock(inventoryText);

    const clickPhaseBText = await callToolWithRetry(client, 'evaluate_script', {
      function: `() => {
        window.__pdf_err = [];
        window.__pdf_unhandled = [];
        window.__pdf_console = [];

        const oldErr = console.error;
        console.error = (...args) => {
          try { window.__pdf_console.push(args.map((x) => String(x)).join(' ')); } catch {}
          oldErr.apply(console, args);
        };

        addEventListener('error', (event) => {
          window.__pdf_err.push({
            message: event.message || null,
            stack: event.error?.stack || null,
          });
        });

        addEventListener('unhandledrejection', (event) => {
          window.__pdf_unhandled.push({
            reason: String(event.reason),
            stack: event.reason?.stack || null,
          });
        });

        const button = Array.from(document.querySelectorAll('button')).find((b) => {
          const s = (
            String((b.innerText || '').trim()) + ' ' +
            String((b.getAttribute('aria-label') || '').trim()) + ' ' +
            String((b.getAttribute('title') || '').trim())
          ).toLowerCase();
          return s.includes('export to pdf') || s.includes('multi-page pdf') || s.includes('download pdf') || s.includes('pdf');
        });

        if (!button) {
          return { clicked: false, reason: 'No PDF button found' };
        }

        button.click();
        return {
          clicked: true,
          info: {
            text: (button.innerText || '').trim(),
            aria: (button.getAttribute('aria-label') || '').trim(),
            title: (button.getAttribute('title') || '').trim(),
          },
        };
      }`,
    }, { retries: 2 });

    const clickPhaseB = parseJsonBlock(clickPhaseBText);
    if (!clickPhaseB?.clicked) {
      fail('Could not click PDF button in phase B.', {
        inventory: inventory?.pdfCandidates || [],
        clickPhaseB,
      });
    }

    await sleep(3200);

    const postPhaseBText = await callToolWithRetry(client, 'evaluate_script', {
      function: `() => {
        const notice = document.getElementById('export-task-notice');
        const msg = document.getElementById('export-task-notice-message');
        return {
          noticeVisible: notice?.getAttribute('aria-hidden') === 'false',
          noticeText: msg?.textContent?.trim() || null,
          errorEvents: window.__pdf_err || [],
          unhandledRejections: window.__pdf_unhandled || [],
          consoleErrors: window.__pdf_console || [],
        };
      }`,
    }, { retries: 2 });

    const postPhaseB = parseJsonBlock(postPhaseBText);

    const clickPhaseCText = await callToolWithRetry(client, 'evaluate_script', {
      function: `() => {
        window.__pdfDownloads = [];
        window.__pdfProbeErrors = [];

        const origCreate = URL.createObjectURL.bind(URL);
        URL.createObjectURL = function patchedCreateObjectURL(blob) {
          try {
            window.__pdfDownloads.push({
              at: Date.now(),
              size: blob?.size ?? null,
              type: blob?.type ?? null,
            });
          } catch (err) {
            window.__pdfProbeErrors.push(String(err));
          }
          return origCreate(blob);
        };

        const button = document.querySelector('button[title*="multi-page PDF"]') || document.querySelector('[data-format="pdf"]');
        if (!button) {
          return { clicked: false, reason: 'No PDF button in phase C' };
        }

        button.click();
        return { clicked: true };
      }`,
    }, { retries: 2 });

    const clickPhaseC = parseJsonBlock(clickPhaseCText);

    await sleep(3500);

    const finalPhaseCText = await callToolWithRetry(client, 'evaluate_script', {
      function: `() => {
        const notice = document.getElementById('export-task-notice');
        const msg = document.getElementById('export-task-notice-message');
        return {
          noticeVisible: notice?.getAttribute('aria-hidden') === 'false',
          noticeText: msg?.textContent?.trim() || null,
          downloadCount: window.__pdfDownloads?.length || 0,
          latestDownload: window.__pdfDownloads?.slice(-1)[0] || null,
          probeErrors: window.__pdfProbeErrors || [],
        };
      }`,
    }, { retries: 2 });

    const finalPhaseC = parseJsonBlock(finalPhaseCText);

    const summary = {
      ok: true,
      example: 'example1-pdf',
      extId,
      convId,
      targetPageId: targetPage.pageId,
      phaseB: {
        clicked: clickPhaseB?.clicked === true,
        post: postPhaseB,
      },
      phaseC: {
        clicked: clickPhaseC?.clicked === true,
        final: finalPhaseC,
      },
      notes: [
        'downloadCount=0 does not always mean export failure; verify browser Downloads when needed.',
      ],
    };

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await client.close();
  }
})().catch((error) => {
  fail('Unexpected failure in example1-pdf-oneclick.', {
    error: String(error?.stack || error?.message || error),
  });
});
