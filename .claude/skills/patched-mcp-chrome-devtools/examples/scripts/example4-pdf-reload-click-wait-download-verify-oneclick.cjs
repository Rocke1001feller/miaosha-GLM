#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { pathToFileURL } = require('node:url');

const {
  callToolWithRetry,
  createPatchedClient,
  extractChatSelectionFromDesc,
  parsePageLines,
  sleep,
} = require('./mcp-common.cjs');

function fail(message, details = {}) {
  const payload = { ok: false, message, details };
  console.error(JSON.stringify(payload, null, 2));
  process.exit(2);
}

function parsePagesEnv(value) {
  const source = String(value || '10,11,12,13,17,18').trim();
  const pages = source
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((num) => Number.isInteger(num) && num > 0);
  return pages.length > 0 ? pages : [10, 11, 12, 13, 17, 18];
}

function getDownloadsDir() {
  return process.env.DOWNLOADS_DIR
    ? path.resolve(process.env.DOWNLOADS_DIR)
    : path.join(os.homedir(), 'Downloads');
}

function listPdfFiles() {
  const downloadsDir = getDownloadsDir();
  const filter = (process.env.PDF_NAME_CONTAINS || '').trim();

  const items = fs.readdirSync(downloadsDir)
    .filter((name) => name.toLowerCase().endsWith('.pdf'))
    .filter((name) => (filter ? name.includes(filter) : true))
    .map((name) => {
      const fullPath = path.join(downloadsDir, name);
      const stat = fs.statSync(fullPath);
      return {
        name,
        fullPath,
        mtimeMs: stat.mtimeMs,
        size: stat.size,
      };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  return items;
}

function sha256File(fullPath) {
  const hash = crypto.createHash('sha256');
  const data = fs.readFileSync(fullPath);
  hash.update(data);
  return hash.digest('hex');
}

function getOutDir() {
  const configured = (process.env.OUT_DIR || '').trim();
  if (configured) {
    const resolved = path.resolve(configured);
    fs.mkdirSync(resolved, { recursive: true });
    return resolved;
  }

  const resolved = path.resolve(
    '.tmp',
    'patched-mcp-chrome-devtools',
    `example4-${Date.now()}`,
  );
  fs.mkdirSync(resolved, { recursive: true });
  return resolved;
}

function signatureOf(file) {
  if (!file) return null;
  return `${file.name}|${file.mtimeMs}|${file.size}`;
}

function pickTargetChatSelectionPage(pages, extId, convId) {
  const filtered = pages.filter((page) => {
    const parsed = extractChatSelectionFromDesc(page.desc);
    if (!parsed) return false;
    if (extId && parsed.extId !== extId) return false;
    if (convId && parsed.convId !== convId) return false;
    return true;
  });

  if (!filtered.length) return null;
  return filtered.sort((a, b) => b.pageId - a.pageId)[0];
}

function findUidInSnapshot(snapshotText, patterns) {
  const lines = snapshotText.split(/\r?\n/);
  for (const line of lines) {
    if (!line.includes('uid=')) continue;
    if (!patterns.some((pattern) => pattern.test(line))) continue;
    const uidMatch = line.match(/uid=([^\s]+)/);
    if (uidMatch) return uidMatch[1];
  }
  return null;
}

function findExportPdfButtonInSnapshot(snapshotText) {
  const lines = snapshotText.split(/\r?\n/);
  const candidates = [];

  for (const line of lines) {
    if (!line.includes('uid=')) continue;
    const uidMatch = line.match(/uid=([^\s]+)/);
    if (!uidMatch) continue;

    const uid = uidMatch[1];
    const normalized = line.toLowerCase();
    if (!normalized.includes('button')) continue;

    let score = 0;

    // Highest confidence: exact tooltip/description used by the real export trigger.
    if (/description="Export selected messages as a multi-page PDF"/i.test(line)) score += 120;
    if (/aria-label="Export selected messages as a multi-page PDF"/i.test(line)) score += 120;

    // Strong signals for the correct toolbar control.
    if (/picture_as_pdf/i.test(line)) score += 80;
    if (/\bPDF\b/i.test(line)) score += 30;
    if (/multi-page\s+PDF/i.test(line)) score += 50;

    // Exclude false positives.
    if (/log in to sync exports/i.test(line)) score -= 300;
    if (/disabled/i.test(line)) score -= 120;

    if (score > 0) {
      candidates.push({ uid, score, line });
    }
  }

  if (!candidates.length) {
    return { uid: null, best: null, candidates: [] };
  }

  candidates.sort((a, b) => b.score - a.score);
  return {
    uid: candidates[0].uid,
    best: candidates[0],
    candidates: candidates.slice(0, 5),
  };
}

async function callToolRawWithRetry(client, name, args = {}, retries = 2, retryDelayMs = 1200) {
  let attempt = 0;
  while (true) {
    try {
      return await client.callTool({ name, arguments: args });
    } catch (error) {
      const message = String(error?.message || error || '');
      const retryable = message.includes('Request timed out') || message.includes('MCP error -32001');
      if (!retryable || attempt >= retries) {
        throw error;
      }
      attempt += 1;
      await sleep(retryDelayMs * attempt);
    }
  }
}

(async () => {
  const client = await createPatchedClient('example4-pdf-reload-click-wait-download-verify');
  try {
    const waitSeconds = Number(process.env.WAIT_SECONDS || 540);
    const pollIntervalSeconds = Number(process.env.POLL_INTERVAL_SECONDS || 15);
    const maxPolls = Math.max(1, Math.ceil(waitSeconds / pollIntervalSeconds));
    const verifyPages = parsePagesEnv(process.env.VERIFY_PAGES);
    const outDir = getOutDir();

    const pagesText = await callToolWithRetry(client, 'list_pages', {}, { retries: 3 });
    const pages = parsePageLines(pagesText);

    const seedPage = pickTargetChatSelectionPage(
      pages,
      process.env.EXT_ID || null,
      process.env.CONV_ID || null,
    );

    if (!seedPage) {
      fail('No chat-selection page found before run.', {
        hint: 'Open a chat-selection page first or provide EXT_ID/CONV_ID env overrides.',
      });
    }

    const seedParsed = extractChatSelectionFromDesc(seedPage.desc);
    const extId = seedParsed.extId;
    const convId = seedParsed.convId;

    const beforeFiles = listPdfFiles();
    const beforeTop = beforeFiles[0] || null;
    const beforeSet = new Set(beforeFiles.map(signatureOf));

    const extensionsUrl = `chrome://extensions/?id=${extId}`;
    await callToolWithRetry(client, 'new_page', { url: extensionsUrl }, { retries: 2 });
    await sleep(1200);

    const pagesAfterExtOpen = parsePageLines(await callToolWithRetry(client, 'list_pages', {}, { retries: 3 }));
    const extensionsPage = pagesAfterExtOpen
      .filter((page) => page.desc.includes('chrome://extensions'))
      .sort((a, b) => b.pageId - a.pageId)[0];

    if (!extensionsPage) {
      fail('Unable to locate chrome://extensions page.', { extensionsUrl });
    }

    await callToolWithRetry(client, 'select_page', { pageId: extensionsPage.pageId, bringToFront: true }, { retries: 3 });
    const extensionsSnapshot = await callToolWithRetry(client, 'take_snapshot', {}, { retries: 2 });

    const reloadUid = findUidInSnapshot(extensionsSnapshot, [
      /button\s+"Reload"/i,
    ]);

    if (!reloadUid) {
      fail('Reload button UID not found on chrome://extensions page.', {
        pageId: extensionsPage.pageId,
      });
    }

    await callToolWithRetry(client, 'click', { uid: reloadUid }, { retries: 1 });
    await sleep(2200);

    const chatSelectionUrl = `chrome-extension://${extId}/chat-selection.html?id=${convId}`;
    await callToolWithRetry(client, 'new_page', { url: chatSelectionUrl }, { retries: 2 });
    await sleep(1500);

    const pagesAfterChatOpen = parsePageLines(await callToolWithRetry(client, 'list_pages', {}, { retries: 3 }));
    const chatPage = pickTargetChatSelectionPage(pagesAfterChatOpen, extId, convId);

    if (!chatPage) {
      fail('Chat-selection page missing after extension reload and reopen.', {
        extId,
        convId,
        chatSelectionUrl,
      });
    }

    await callToolWithRetry(client, 'select_page', { pageId: chatPage.pageId, bringToFront: true }, { retries: 3 });
    const chatSnapshot = await callToolWithRetry(client, 'take_snapshot', {}, { retries: 2 });

    const pdfButtonMatch = findExportPdfButtonInSnapshot(chatSnapshot);
    const pdfButtonUid = pdfButtonMatch.uid;

    if (!pdfButtonUid) {
      fail('PDF export button UID not found on chat-selection page.', {
        pageId: chatPage.pageId,
        topCandidates: pdfButtonMatch.candidates,
      });
    }

    await callToolWithRetry(client, 'click', { uid: pdfButtonUid }, { retries: 1 });

    let freshPdf = null;
    let pollCount = 0;
    while (pollCount < maxPolls) {
      await sleep(pollIntervalSeconds * 1000);
      pollCount += 1;

      const nowFiles = listPdfFiles();
      const newEntries = nowFiles.filter((file) => !beforeSet.has(signatureOf(file)));
      if (newEntries.length > 0) {
        freshPdf = newEntries.sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
        break;
      }
    }

    const noticeTextPayload = await callToolWithRetry(client, 'evaluate_script', {
      function: `() => {
        const notice = document.getElementById('export-task-notice');
        const message = document.getElementById('export-task-notice-message');
        return {
          noticeHidden: notice?.getAttribute('aria-hidden') ?? null,
          noticeText: message?.textContent?.trim() || null,
        };
      }`,
    }, { retries: 2 });

    if (!freshPdf) {
      fail('No fresh PDF found in Downloads during wait window.', {
        beforeTop,
        waitSeconds,
        pollIntervalSeconds,
        pollCount,
        noticeTextPayload,
      });
    }

    const freshPdfSha256 = sha256File(freshPdf.fullPath);
    const fileUrl = pathToFileURL(freshPdf.fullPath).href;
    const screenshots = [];

    for (const pageNumber of verifyPages) {
      const targetPdfUrl = `${fileUrl}#page=${pageNumber}&zoom=page-fit`;
      await callToolWithRetry(client, 'new_page', { url: targetPdfUrl }, { retries: 2 });
      await sleep(1200);

      const pdfPages = parsePageLines(await callToolWithRetry(client, 'list_pages', {}, { retries: 3 }));
      const pdfPage = pdfPages
        .filter((page) => page.desc.includes(fileUrl))
        .sort((a, b) => b.pageId - a.pageId)[0];

      if (!pdfPage) {
        fail('Could not find opened PDF tab during page capture.', {
          fileUrl,
          pageNumber,
        });
      }

      await callToolWithRetry(client, 'select_page', { pageId: pdfPage.pageId, bringToFront: true }, { retries: 3 });
      await sleep(900);

      const screenshotResult = await callToolRawWithRetry(client, 'take_screenshot', {}, 2);
      const imagePart = (screenshotResult.content || []).find((part) => part.type === 'image');
      if (!imagePart || !imagePart.data) {
        fail('Screenshot payload missing image data.', {
          pageNumber,
          pageId: pdfPage.pageId,
        });
      }

      const outputPath = path.join(outDir, `pdf-after-reload-page-${String(pageNumber).padStart(2, '0')}.png`);
      fs.writeFileSync(outputPath, Buffer.from(imagePart.data, 'base64'));
      screenshots.push(outputPath);
    }

    const summary = {
      ok: true,
      example: 'example4-pdf-reload-click-wait-download-verify',
      extId,
      convId,
      reloadButtonUid: reloadUid,
      pdfButtonUid,
      pdfButtonMatch: pdfButtonMatch.best,
      waitSeconds,
      pollIntervalSeconds,
      pollsUsed: pollCount,
      beforeTop,
      freshPdf: {
        ...freshPdf,
        sha256: freshPdfSha256,
      },
      noticeTextPayload,
      verifyPages,
      screenshots,
      outDir,
      notes: [
        'This flow intentionally uses MCP click actions for both reload and PDF export; it avoids relying on evaluate_script button.click as a user-gesture substitute.',
        'Heavy-image exports may take several minutes; keep WAIT_SECONDS high enough for your payload size.',
      ],
    };

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await client.close();
  }
})().catch((error) => {
  fail('Unexpected failure in example4-pdf-reload-click-wait-download-verify.', {
    error: String(error?.stack || error?.message || error),
  });
});
