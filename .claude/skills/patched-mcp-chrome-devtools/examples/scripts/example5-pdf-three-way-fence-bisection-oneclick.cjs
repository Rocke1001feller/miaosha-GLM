#!/usr/bin/env node

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

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

function parseConversationIdFromSourceUrl(sourceUrl) {
  try {
    const parsed = new URL(sourceUrl);
    const parts = parsed.pathname.split('/').filter(Boolean);
    const chatsIdx = parts.indexOf('chats');
    if (chatsIdx >= 0 && parts[chatsIdx + 1]) {
      return parts[chatsIdx + 1];
    }
  } catch {
    // ignore invalid URL, caller will handle fallback.
  }
  return null;
}

function getDownloadsDir() {
  return process.env.DOWNLOADS_DIR
    ? path.resolve(process.env.DOWNLOADS_DIR)
    : path.join(os.homedir(), 'Downloads');
}

function listPdfFiles() {
  const downloadsDir = getDownloadsDir();
  const filter = String(process.env.PDF_NAME_CONTAINS || '').trim();

  if (!fs.existsSync(downloadsDir)) {
    return [];
  }

  return fs.readdirSync(downloadsDir)
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
}

function getOutDir() {
  const configured = String(process.env.OUT_DIR || '').trim();
  if (configured) {
    const resolved = path.resolve(configured);
    fs.mkdirSync(resolved, { recursive: true });
    return resolved;
  }

  const resolved = path.resolve(
    '.tmp',
    'patched-mcp-chrome-devtools',
    `example5-${Date.now()}`,
  );
  fs.mkdirSync(resolved, { recursive: true });
  return resolved;
}

function parseProbe(text, name) {
  const parsed = parseJsonBlock(text);
  if (parsed) return parsed;

  return {
    __parseFailed: true,
    __name: name,
    __raw: text,
  };
}

function pickSourcePage(pages, sourceUrl, convId) {
  const exact = pages
    .filter((page) => page.desc.includes(sourceUrl))
    .sort((a, b) => b.pageId - a.pageId)[0];
  if (exact) return exact;

  if (!convId) return null;
  return pages
    .filter((page) => page.desc.includes(`/chats/${convId}`) || page.desc.includes(convId))
    .sort((a, b) => b.pageId - a.pageId)[0] || null;
}

function pickChatSelectionPage(pages, extId, convId) {
  const candidates = pages.filter((page) => {
    const parsed = extractChatSelectionFromDesc(page.desc);
    if (!parsed) return false;
    if (extId && parsed.extId !== extId) return false;
    if (convId && parsed.convId !== convId) return false;
    return true;
  });

  if (!candidates.length) return null;
  return candidates.sort((a, b) => b.pageId - a.pageId)[0];
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

function buildFirstDistortionHint(sourceProbe, chatDomProbe, storageProbe) {
  const sourceHasCode = Array.isArray(sourceProbe?.codeBlocks) && sourceProbe.codeBlocks.length > 0;
  const chatDomHasCode = Array.isArray(chatDomProbe?.codeBlocks) && chatDomProbe.codeBlocks.length > 0;
  const storageHasAssistant = !!storageProbe?.assistantFound;
  const maxFenceLeadingSpaces = Number.isFinite(storageProbe?.maxFenceLeadingSpaces)
    ? storageProbe.maxFenceLeadingSpaces
    : null;

  if (sourceHasCode && chatDomHasCode && storageHasAssistant && maxFenceLeadingSpaces != null && maxFenceLeadingSpaces > 3) {
    return 'Likely markdown-to-pdf fence splitter indentation limit. Source + chat-selection preserve code, storage shows deep-indented fence (>3).';
  }

  if (sourceHasCode && (!chatDomHasCode || !storageHasAssistant)) {
    return 'Likely extraction/parser boundary before chat-selection rendering.';
  }

  if (sourceHasCode && chatDomHasCode && storageHasAssistant) {
    return 'Likely downstream of storage/render (export transformer or PDF generation stage).';
  }

  return 'Insufficient evidence for a single first-distortion-layer guess; inspect probes manually.';
}

(async () => {
  const sourceUrl = String(process.env.SOURCE_URL || 'https://copilot.microsoft.com/chats/JGKawoHekkBgb4wz7kPoa').trim();
  const extId = String(process.env.EXT_ID || 'lhaoppckdeodmjldiciojkeonmgcblha').trim();
  const convId = String(process.env.CONV_ID || parseConversationIdFromSourceUrl(sourceUrl) || '').trim();
  const keyword = String(process.env.KEYWORD || 'terminal.external.osxExec').trim();
  const codeToken = String(process.env.CODE_TOKEN || 'iTerm.app').trim();
  const verifyPage = Number(process.env.VERIFY_PAGE || 1);

  if (!convId) {
    fail('Unable to resolve conversation id. Set CONV_ID or provide SOURCE_URL containing /chats/<id>.', { sourceUrl });
  }

  const outDir = getOutDir();
  const client = await createPatchedClient('example5-pdf-three-way-fence-bisection');

  try {
    const listPagesText = await callToolWithRetry(client, 'list_pages', {}, { retries: 3 });
    const pages = parsePageLines(listPagesText);

    const sourcePage = pickSourcePage(pages, sourceUrl, convId);
    if (!sourcePage) {
      fail('Source page not found. Open the source conversation page in the running Chrome first.', {
        sourceUrl,
        convId,
      });
    }

    const chatSelectionPage = pickChatSelectionPage(pages, extId, convId);
    if (!chatSelectionPage) {
      fail('Chat-selection page not found. Open chat-selection page for this conversation first.', {
        expected: `chrome-extension://${extId}/chat-selection.html?id=${convId}`,
      });
    }

    await callToolWithRetry(client, 'select_page', { pageId: sourcePage.pageId, bringToFront: true }, { retries: 3 });
    const sourceProbeText = await callToolWithRetry(client, 'evaluate_script', {
      function: `() => {
        const key = ${JSON.stringify(keyword)};
        const token = ${JSON.stringify(codeToken)};
        const host = document.querySelector('main') || document.body;
        const text = String((host && host.innerText) || '');
        const index = text.indexOf(key) >= 0 ? text.indexOf(key) : text.indexOf(token);
        const around = index >= 0 ? text.slice(Math.max(0, index - 280), Math.min(text.length, index + 700)) : null;
        const codeBlocks = Array.from(document.querySelectorAll('pre code')).map((node) => {
          const value = String(node.textContent || '');
          return {
            text: value,
            hasKeyword: value.includes(key),
            hasToken: value.includes(token),
            lines: value.split('\\n').length,
          };
        });
        return {
          url: location.href,
          title: document.title,
          around,
          codeBlocks,
          codeBlockCount: codeBlocks.length,
        };
      }`,
    }, { retries: 3 });

    await callToolWithRetry(client, 'select_page', { pageId: chatSelectionPage.pageId, bringToFront: true }, { retries: 3 });
    const chatDomProbeText = await callToolWithRetry(client, 'evaluate_script', {
      function: `() => {
        const key = ${JSON.stringify(keyword)};
        const token = ${JSON.stringify(codeToken)};
        const host = document.querySelector('main') || document.body;
        const text = String((host && host.innerText) || '');
        const index = text.indexOf(key) >= 0 ? text.indexOf(key) : text.indexOf(token);
        const around = index >= 0 ? text.slice(Math.max(0, index - 280), Math.min(text.length, index + 700)) : null;
        const codeBlocks = Array.from(document.querySelectorAll('pre code')).map((node) => {
          const value = String(node.textContent || '');
          return {
            text: value,
            hasKeyword: value.includes(key),
            hasToken: value.includes(token),
            lines: value.split('\\n').length,
          };
        });
        return {
          url: location.href,
          title: document.title,
          around,
          codeBlocks,
          codeBlockCount: codeBlocks.length,
        };
      }`,
    }, { retries: 3 });

    const storageProbeText = await callToolWithRetry(client, 'evaluate_script', {
      function: `() => new Promise((resolve) => {
        const keyName = ${JSON.stringify(`chat_export_${convId}`)};
        const keyword = ${JSON.stringify(keyword)};
        const token = ${JSON.stringify(codeToken)};

        chrome.storage.local.get(keyName, (items) => {
          const wrapped = items && items[keyName];
          const payload = wrapped && typeof wrapped === 'object' && wrapped.data ? wrapped.data : wrapped;
          const messages = Array.isArray(payload && payload.messages) ? payload.messages : [];

          const assistant = messages.find((msg) => {
            if (!msg || msg.role !== 'assistant') return false;
            if (typeof msg.content !== 'string') return false;
            return msg.content.includes(keyword) || msg.content.includes(token);
          }) || null;

          if (!assistant || typeof assistant.content !== 'string') {
            resolve({
              storageKey: keyName,
              payloadFound: !!payload,
              assistantFound: false,
            });
            return;
          }

          const content = assistant.content;
          const focus = content.indexOf(keyword) >= 0 ? content.indexOf(keyword) : content.indexOf(token);
          const snippet = focus >= 0 ? content.slice(Math.max(0, focus - 280), Math.min(content.length, focus + 900)) : null;

          const lines = content.split('\\n');
          const focusLineIndex = lines.findIndex((line) => line.includes(token) || line.includes(keyword));
          const start = focusLineIndex >= 0 ? Math.max(0, focusLineIndex - 12) : 0;
          const end = focusLineIndex >= 0 ? Math.min(lines.length, focusLineIndex + 12) : Math.min(lines.length, 24);
          const windowLines = lines.slice(start, end).map((line, idx) => {
            const leadingSpaces = (() => {
              let count = 0;
              while (count < line.length) {
                const ch = line.charAt(count);
                if (ch === ' ') { count += 1; continue; }
                if (ch === '\\t') { count += 2; continue; }
                break;
              }
              return count;
            })();
            const trimmed = line.trimStart();
            const fenceBacktick = String.fromCharCode(96).repeat(3);
            return {
              idx: start + idx,
              leadingSpaces,
              isFence: trimmed.startsWith(fenceBacktick) || trimmed.startsWith('~~~'),
              line,
            };
          });

          const fenceIndentations = windowLines.filter((line) => line.isFence).map((line) => line.leadingSpaces);
          const maxFenceLeadingSpaces = fenceIndentations.length > 0 ? Math.max(...fenceIndentations) : null;

          resolve({
            storageKey: keyName,
            payloadFound: !!payload,
            assistantFound: true,
            snippet,
            focusLineIndex,
            fenceWindow: windowLines,
            fenceIndentations,
            maxFenceLeadingSpaces,
          });
        });
      })`,
    }, { retries: 3 });

    const sourceProbe = parseProbe(sourceProbeText, 'sourceProbe');
    const chatDomProbe = parseProbe(chatDomProbeText, 'chatDomProbe');
    const storageProbe = parseProbe(storageProbeText, 'storageProbe');

    const latestPdf = listPdfFiles()[0] || null;
    let pdfCapture = null;

    if (latestPdf) {
      const fileUrl = pathToFileURL(latestPdf.fullPath).href;
      const targetPdfUrl = `${fileUrl}#page=${verifyPage}&zoom=page-fit`;
      await callToolWithRetry(client, 'new_page', { url: targetPdfUrl }, { retries: 2 });
      await sleep(1200);

      const pdfPages = parsePageLines(await callToolWithRetry(client, 'list_pages', {}, { retries: 3 }));
      const pdfPage = pdfPages
        .filter((page) => page.desc.includes(fileUrl))
        .sort((a, b) => b.pageId - a.pageId)[0];

      if (!pdfPage) {
        fail('Unable to locate opened PDF page for screenshot capture.', {
          targetPdfUrl,
          latestPdf,
        });
      }

      await callToolWithRetry(client, 'select_page', { pageId: pdfPage.pageId, bringToFront: true }, { retries: 3 });
      await sleep(900);

      const screenshotResult = await callToolRawWithRetry(client, 'take_screenshot', {}, 2);
      const imagePart = (screenshotResult.content || []).find((part) => part.type === 'image');
      if (!imagePart || !imagePart.data) {
        fail('PDF screenshot capture returned no image payload.', {
          pageId: pdfPage.pageId,
          latestPdf,
        });
      }

      const screenshotPath = path.join(outDir, `pdf-latest-page-${String(verifyPage).padStart(2, '0')}.png`);
      fs.writeFileSync(screenshotPath, Buffer.from(imagePart.data, 'base64'));

      pdfCapture = {
        latestPdf,
        verifyPage,
        screenshotPath,
      };
    }

    const firstDistortionHint = buildFirstDistortionHint(sourceProbe, chatDomProbe, storageProbe);

    const summary = {
      ok: true,
      example: 'example5-pdf-three-way-fence-bisection',
      sourceUrl,
      extId,
      convId,
      keyword,
      codeToken,
      sourcePage,
      chatSelectionPage,
      sourceProbe,
      chatDomProbe,
      storageProbe,
      firstDistortionHint,
      pdfCapture,
      outDir,
      notes: [
        'Use this output to decide whether loss first appears before storage, inside markdown-to-pdf transformation, or only in final PDF rendering.',
        'If maxFenceLeadingSpaces > 3 around fenced blocks, verify fence splitter indentation handling in export markdown pipeline.',
      ],
    };

    const outPath = path.join(outDir, 'three-way-bisection-summary.json');
    fs.writeFileSync(outPath, JSON.stringify(summary, null, 2));

    console.log(JSON.stringify({
      ok: true,
      outPath,
      firstDistortionHint,
      sourcePage,
      chatSelectionPage,
      pdfCapture,
    }, null, 2));
  } finally {
    await client.close();
  }
})().catch((error) => {
  fail('Unexpected failure in example5-pdf-three-way-fence-bisection.', {
    error: String(error?.stack || error?.message || error),
  });
});
