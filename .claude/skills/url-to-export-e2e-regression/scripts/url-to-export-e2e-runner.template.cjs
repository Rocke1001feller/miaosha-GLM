#!/usr/bin/env node

const path = require('node:path');
const {
  callToolWithRetry,
  createPatchedClient,
  extractChatSelectionFromDesc,
  parseJsonBlock,
  parsePageLines,
  sleep,
} = require('../../patched-mcp-chrome-devtools/examples/scripts/mcp-common.cjs');

const TRUE_BOOL_TOKENS = new Set(['1', 'true', 'yes', 'on']);
const FALSE_BOOL_TOKENS = new Set(['0', 'false', 'no', 'off']);

function fail(message, details = {}) {
  console.error(JSON.stringify({ ok: false, message, details }, null, 2));
  process.exit(2);
}

function assert(condition, message, details = {}) {
  if (!condition) {
    fail(message, details);
  }
}

function parseBooleanToken(rawValue) {
  if (typeof rawValue !== 'string') return null;
  const normalized = rawValue.trim().toLowerCase();
  if (TRUE_BOOL_TOKENS.has(normalized)) return true;
  if (FALSE_BOOL_TOKENS.has(normalized)) return false;
  return null;
}

function loadCaseModule() {
  const modulePath = process.env.CASE_MODULE;
  if (!modulePath) {
    fail('Missing CASE_MODULE env var.', {
      usage: 'CASE_MODULE=tests/e2e-cases/<case>.case.cjs node scripts/e2e/<runner>.cjs',
    });
  }
  return require(path.resolve(process.cwd(), modulePath));
}

function validateCase(testCase) {
  assert(testCase && typeof testCase === 'object', 'Case module must export an object.');
  assert(typeof testCase.id === 'string' && testCase.id, 'Case id is required.');
  assert(typeof testCase.platform === 'string' && testCase.platform, 'Case platform is required.');
  assert(typeof testCase.resource === 'string' && testCase.resource, 'Case resource is required.');
  assert(testCase.endpoint?.kind === 'chat-selection' || testCase.endpoint?.kind === 'export', 'endpoint.kind must be chat-selection or export.');
  if (testCase.kind !== 'endpoint-only') {
    assert(typeof testCase.sourceUrl === 'string' && testCase.sourceUrl.startsWith('http'), 'sourceUrl is required for non endpoint-only cases.');
  }
  if (testCase.endpoint.kind === 'export') {
    assert(typeof testCase.endpoint.format === 'string' && testCase.endpoint.format, 'endpoint.format is required for export cases.');
    assert(testCase.export?.assert, 'export.assert is required for export cases.');
  }
  if (typeof testCase.download?.manualDownload !== 'undefined') {
    assert(typeof testCase.download.manualDownload === 'boolean', 'download.manualDownload must be boolean when provided.');
  }
  assert(testCase.chatSelection?.probe, 'chatSelection.probe is required.');
  assert(testCase.chatSelection?.assert, 'chatSelection.assert is required.');
}

function resolveManualDownloadMode(testCase) {
  if (typeof testCase?.download?.manualDownload === 'boolean') {
    return {
      manualDownload: testCase.download.manualDownload,
      source: 'case.download.manualDownload',
    };
  }

  if (typeof process.env.E2E_MANUAL_DOWNLOAD === 'string' && process.env.E2E_MANUAL_DOWNLOAD.trim() !== '') {
    const parsed = parseBooleanToken(process.env.E2E_MANUAL_DOWNLOAD);
    assert(parsed !== null, 'Invalid E2E_MANUAL_DOWNLOAD value.', {
      value: process.env.E2E_MANUAL_DOWNLOAD,
    });
    return {
      manualDownload: parsed,
      source: 'env:E2E_MANUAL_DOWNLOAD',
    };
  }

  // Local E2E defaults to auto-download to avoid native save dialogs blocking automation.
  return {
    manualDownload: false,
    source: 'default:auto-download-for-local-e2e',
  };
}

async function configureManualDownloadMode(client, extId, manualDownload) {
  const optionsUrl = `chrome-extension://${extId}/options.html`;
  await callToolWithRetry(client, 'new_page', { url: optionsUrl }, { retries: 2 });
  await sleep(900);

  const resultText = await callToolWithRetry(client, 'evaluate_script', {
    function: `() => new Promise((resolve) => {
      const desiredManualDownload = ${manualDownload ? 'true' : 'false'};
      const timeoutMs = 12000;
      const started = Date.now();
      const loop = () => {
        const checkbox = document.getElementById('manual-download');
        if (!(checkbox instanceof HTMLInputElement)) {
          if (Date.now() - started > timeoutMs) {
            resolve({ ok: false, reason: 'manual-download checkbox not found', url: location.href });
            return;
          }
          setTimeout(loop, 250);
          return;
        }

        if (checkbox.disabled) {
          if (Date.now() - started > timeoutMs) {
            resolve({
              ok: false,
              reason: 'manual-download checkbox remained disabled',
              url: location.href,
              checked: checkbox.checked,
            });
            return;
          }
          setTimeout(loop, 250);
          return;
        }

        const beforeChecked = checkbox.checked;
        if (beforeChecked !== desiredManualDownload) {
          checkbox.checked = desiredManualDownload;
          checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        }

        setTimeout(() => {
          resolve({
            ok: true,
            url: location.href,
            beforeChecked,
            finalChecked: checkbox.checked,
            changed: beforeChecked !== checkbox.checked,
          });
        }, 700);
      };
      loop();
    })`,
  }, { retries: 2 });

  const result = parseJsonBlock(resultText) || {};
  return {
    desiredManualDownload: manualDownload,
    optionsUrl,
    ...result,
  };
}

function pickPageByUrl(pages, url) {
  return pages.find((page) => page.desc.includes(url)) || null;
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
    if (page.desc.includes(`chrome-extension://${extId}/chat-selection.html?id=`)) {
      ids.add(page.pageId);
    }
  }
  return ids;
}

function pickExtensionId(testCase, pages) {
  const envName = testCase.extension?.envId || 'EXT_ID';
  if (process.env[envName]) {
    return process.env[envName];
  }
  if (testCase.extension?.id) {
    return testCase.extension.id;
  }
  for (const page of pages) {
    const parsed = extractChatSelectionFromDesc(page.desc);
    if (parsed?.extId) {
      return parsed.extId;
    }
  }
  return null;
}

function parseExportButton(snapshotText) {
  const candidates = [];
  for (const line of snapshotText.split(/\r?\n/)) {
    const match = line.match(/uid=(\S+)\s+button\s+"([^"]*)"(.*)$/i);
    if (!match) continue;
    const uid = match[1];
    const label = match[2];
    const suffix = (match[3] || '').toLowerCase();
    const lower = label.toLowerCase();
    if (!lower.includes('export') && !lower.includes('导出')) continue;
    candidates.push({ uid, label, disabled: suffix.includes('disabled') });
  }
  return candidates.find((item) => item.label.toLowerCase().includes('export now') && !item.disabled)
    || candidates.find((item) => !item.disabled)
    || null;
}

async function openSourcePage(client, testCase) {
  if (testCase.kind === 'endpoint-only') {
    return null;
  }

  let pages = parsePageLines(await callToolWithRetry(client, 'list_pages', {}, { retries: 3 }));
  let sourcePage = pickPageByUrl(pages, testCase.sourceUrl);
  if (!sourcePage) {
    await callToolWithRetry(client, 'new_page', { url: testCase.sourceUrl }, { retries: 2 });
    pages = parsePageLines(await callToolWithRetry(client, 'list_pages', {}, { retries: 3 }));
    sourcePage = pickPageByUrl(pages, testCase.sourceUrl);
  }
  assert(sourcePage, 'Source page did not open.', { sourceUrl: testCase.sourceUrl });

  await callToolWithRetry(client, 'select_page', { pageId: sourcePage.pageId, bringToFront: true }, { retries: 3 });

  if (testCase.source?.probe) {
    const sourceText = await callToolWithRetry(client, 'evaluate_script', { function: testCase.source.probe }, { retries: 2 });
    const sourceProbe = parseJsonBlock(sourceText);
    testCase.source.assert?.(sourceProbe, assert);
  }

  return sourcePage;
}

async function triggerChatSelectionFromSource(client, testCase, sourcePage, extId, baselineChatPages) {
  if (testCase.kind === 'endpoint-only') {
    // If the case provides a direct URL, navigate there; no popup flow needed.
    if (testCase.chatSelection?.url) {
      let pages = parsePageLines(await callToolWithRetry(client, 'list_pages', {}, { retries: 3 }));
      let target = pickPageByUrl(pages, testCase.chatSelection.url);
      if (!target) {
        await callToolWithRetry(client, 'new_page', { url: testCase.chatSelection.url }, { retries: 2 });
        await sleep(2000);
        pages = parsePageLines(await callToolWithRetry(client, 'list_pages', {}, { retries: 3 }));
        target = pickPageByUrl(pages, testCase.chatSelection.url) || pickLatestChatSelectionPage(pages, extId);
      }
      assert(target, 'Endpoint-only case: could not open chat-selection page.', { chatSelectionUrl: testCase.chatSelection.url });
      return { targetClient: client, targetPage: target, notes: ['endpoint-only: navigated to chatSelection.url'] };
    }

    // Fallback: reuse an already-open chat-selection page.
    const pages = parsePageLines(await callToolWithRetry(client, 'list_pages', {}, { retries: 3 }));
    const target = pickLatestChatSelectionPage(pages, extId);
    assert(target, 'Endpoint-only case requires an already-open chat-selection page or chatSelection.url.', { extId });
    return { targetClient: client, targetPage: target, notes: ['endpoint-only: reused existing chat-selection page'] };
  }

  const notes = [];

  if (testCase.extension?.reloadBeforeRun) {
    try {
      await callToolWithRetry(client, 'reload_extension', { id: extId }, { retries: 2 });
    } catch (error) {
      notes.push(`reload_extension failed, continuing: ${String(error?.message || error)}`);
    }
  }

  await callToolWithRetry(client, 'select_page', { pageId: sourcePage.pageId, bringToFront: true }, { retries: 3 });

  try {
    await callToolWithRetry(client, 'trigger_extension_action', { id: extId }, { retries: 2 });
  } catch (error) {
    notes.push(`trigger_extension_action failed, using popup URL fallback: ${String(error?.message || error)}`);
    await callToolWithRetry(client, 'new_page', { url: `chrome-extension://${extId}/popup.html` }, { retries: 2 });
  }

  const pages = parsePageLines(await callToolWithRetry(client, 'list_pages', {}, { retries: 3 }));
  let popupPage = pickLatestPopupPage(pages, extId);
  if (!popupPage) {
    notes.push('No popup after trigger_extension_action; opening popup URL fallback.');
    await callToolWithRetry(client, 'new_page', { url: `chrome-extension://${extId}/popup.html` }, { retries: 2 });
    const fallbackPages = parsePageLines(await callToolWithRetry(client, 'list_pages', {}, { retries: 3 }));
    popupPage = pickLatestPopupPage(fallbackPages, extId);
  }
  assert(popupPage, 'No extension popup page found.', { extId, notes });

  await callToolWithRetry(client, 'select_page', { pageId: popupPage.pageId, bringToFront: true }, { retries: 3 });
  const popupSnapshot = await callToolWithRetry(client, 'take_snapshot', {}, { retries: 3 });
  const exportButton = parseExportButton(popupSnapshot);
  assert(exportButton, 'No usable Export Now button found in popup.', { popupPage });

  await callToolWithRetry(client, 'click', { uid: exportButton.uid }, { retries: 3 });

  let targetPage = null;
  for (let i = 0; i < 30; i += 1) {
    await sleep(1000);
    const loopPages = parsePageLines(await callToolWithRetry(client, 'list_pages', {}, { retries: 2 }));
    const candidate = pickLatestChatSelectionPage(loopPages, extId);
    if (!candidate) continue;
    targetPage = candidate;
    if (!baselineChatPages.has(candidate.pageId)) break;
  }

  assert(targetPage, 'No chat-selection page discovered after Export Now.', { extId, popupPage, exportButton, notes });
  return { targetClient: client, targetPage, notes };
}

async function runChatSelectionCheckpoint(client, testCase, targetPage) {
  await callToolWithRetry(client, 'select_page', { pageId: targetPage.pageId, bringToFront: true }, { retries: 3 });
  await sleep(testCase.chatSelection.waitMs ?? 1000);

  const probeText = await callToolWithRetry(client, 'evaluate_script', { function: testCase.chatSelection.probe }, { retries: 3 });
  const probe = parseJsonBlock(probeText);
  testCase.chatSelection.assert(probe, assert);
  return probe;
}

function blobProbeInstallScript() {
  return `() => {
    window.__urlToExportE2E = { blobs: [], errors: [] };
    const originalCreateObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = function patchedCreateObjectURL(blob) {
      const entry = {
        at: Date.now(),
        size: blob?.size ?? null,
        type: blob?.type ?? null,
        text: null,
        firstBytesHex: null,
      };
      try {
        window.__urlToExportE2E.blobs.push(entry);
        const type = String(blob?.type || '').toLowerCase();
        if (type.includes('json') || type.includes('markdown') || type.startsWith('text/')) {
          blob.text().then((value) => { entry.text = value.slice(0, 200000); }).catch((err) => {
            window.__urlToExportE2E.errors.push(String(err));
          });
        } else if (blob?.arrayBuffer) {
          blob.arrayBuffer().then((buffer) => {
            const bytes = Array.from(new Uint8Array(buffer).slice(0, 32));
            entry.firstBytesHex = bytes.map((byte) => byte.toString(16).padStart(2, '0')).join('');
          }).catch((err) => {
            window.__urlToExportE2E.errors.push(String(err));
          });
        }
      } catch (err) {
        window.__urlToExportE2E.errors.push(String(err));
      }
      return originalCreateObjectURL(blob);
    };
    return { installed: true };
  }`;
}

async function runBlobExportEndpoint(client, testCase) {
  const format = testCase.endpoint.format;
  await callToolWithRetry(client, 'evaluate_script', { function: blobProbeInstallScript() }, { retries: 2 });

  const clickText = await callToolWithRetry(client, 'evaluate_script', {
    function: `() => {
      const button = document.querySelector('[data-format="${format}"]') || document.querySelector('[data-export-format="${format}"]');
      if (!button) return { clicked: false, reason: 'No export format button', format: '${format}' };
      if (button.disabled || button.getAttribute('aria-disabled') === 'true') {
        return { clicked: false, reason: 'Export format button disabled', format: '${format}', title: button.getAttribute('title') };
      }
      button.click();
      return { clicked: true, format: '${format}' };
    }`,
  }, { retries: 2 });

  const clickResult = parseJsonBlock(clickText);
  assert(clickResult?.clicked, 'Could not click export format button.', clickResult);

  await sleep(testCase.export?.waitMs ?? 3500);

  const finalText = await callToolWithRetry(client, 'evaluate_script', {
    function: `() => {
      const notice = document.getElementById('export-task-notice');
      const msg = document.getElementById('export-task-notice-message');
      return {
        noticeVisible: notice?.getAttribute('aria-hidden') === 'false',
        noticeText: msg?.textContent?.trim() || null,
        blobs: window.__urlToExportE2E?.blobs || [],
        errors: window.__urlToExportE2E?.errors || [],
      };
    }`,
  }, { retries: 2 });

  const finalProbe = parseJsonBlock(finalText);
  testCase.export.assert(finalProbe, assert);
  return finalProbe;
}

(async () => {
  const testCase = loadCaseModule();
  validateCase(testCase);

  const client = await createPatchedClient(`url-to-export-e2e-${testCase.id}`);
  try {
    const initialPages = parsePageLines(await callToolWithRetry(client, 'list_pages', {}, { retries: 3 }));
    const extId = pickExtensionId(testCase, initialPages);
    assert(extId, 'Could not resolve extension id. Set EXT_ID or open an extension page.', { caseId: testCase.id });

    const downloadMode = resolveManualDownloadMode(testCase);
    const appliedDownloadMode = await configureManualDownloadMode(client, extId, downloadMode.manualDownload);
    assert(appliedDownloadMode?.ok, 'Could not configure download mode before export flow.', {
      caseId: testCase.id,
      downloadMode,
      appliedDownloadMode,
    });
    assert(appliedDownloadMode.finalChecked === downloadMode.manualDownload, 'Download mode did not match desired manualDownload state.', {
      caseId: testCase.id,
      downloadMode,
      appliedDownloadMode,
    });

    const baselineChatPages = captureChatSelectionPageIds(initialPages, extId);
    const sourcePage = await openSourcePage(client, testCase);
    const { targetClient, targetPage, notes } = await triggerChatSelectionFromSource(client, testCase, sourcePage, extId, baselineChatPages);
    const chatSelectionProbe = await runChatSelectionCheckpoint(targetClient, testCase, targetPage);

    let exportProbe = null;
    if (testCase.endpoint.kind === 'export') {
      const probeKind = testCase.export?.probeKind || 'blob-create-object-url';
      assert(probeKind === 'blob-create-object-url', 'Template runner only implements blob-create-object-url. Extend for this probe kind.', { probeKind });
      exportProbe = await runBlobExportEndpoint(targetClient, testCase);
    }

    console.log(JSON.stringify({
      ok: true,
      caseId: testCase.id,
      kind: testCase.kind,
      resource: testCase.resource,
      endpoint: testCase.endpoint,
      extId,
      downloadMode: {
        ...downloadMode,
        applied: appliedDownloadMode,
      },
      targetPage,
      notes,
      chatSelection: chatSelectionProbe,
      export: exportProbe,
    }, null, 2));
  } catch (error) {
    fail('Unexpected runner failure.', {
      caseId: testCase.id,
      message: String(error?.message || error),
      stack: error?.stack,
    });
  } finally {
    await client.close();
  }
})();
