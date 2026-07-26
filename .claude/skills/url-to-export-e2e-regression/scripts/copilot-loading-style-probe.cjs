#!/usr/bin/env node
'use strict';

const {
  callToolWithRetry,
  createPatchedClient,
  parseJsonBlock,
  parsePageLines,
} = require('../../patched-mcp-chrome-devtools/examples/scripts/mcp-common.cjs');

const DEFAULT_SOURCE_URL = 'https://copilot.microsoft.com/chats/JGKawoHekkBgb4wz7kPoa';
const HOST_INNERHTML = '__copilot_loading_style_probe_innerhtml';
const HOST_STYLE_NODE = '__copilot_loading_style_probe_stylenode';

function fail(message, details = {}) {
  console.error(JSON.stringify({ ok: false, message, details }, null, 2));
  process.exit(2);
}

function assert(condition, message, details = {}) {
  if (!condition) {
    fail(message, details);
  }
}

function parseJsonLoose(text) {
  const parsed = parseJsonBlock(text);
  if (typeof parsed !== 'undefined' && parsed !== null) {
    if (typeof parsed === 'string') {
      try {
        return JSON.parse(parsed);
      } catch {
        return { raw: parsed };
      }
    }
    return parsed;
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: String(text) };
  }
}

async function listPages(client) {
  const text = await callToolWithRetry(client, 'list_pages', {}, { retries: 3 });
  return parsePageLines(text);
}

async function ensureSourcePage(client, sourceUrl) {
  let pages = await listPages(client);
  let source = pages.find((page) => page.desc.includes(sourceUrl)) || null;

  if (!source) {
    await callToolWithRetry(client, 'new_page', { url: sourceUrl }, { retries: 2 });
    pages = await listPages(client);
    source = pages.find((page) => page.desc.includes(sourceUrl)) || null;
  }

  assert(source, 'Source page not found.', { sourceUrl });
  await callToolWithRetry(client, 'select_page', { pageId: source.pageId, bringToFront: true }, { retries: 2 });
  return source;
}

async function runMechanismProbe(client, mode) {
  const hostId = mode === 'innerhtml' ? HOST_INNERHTML : HOST_STYLE_NODE;
  const resultText = await callToolWithRetry(client, 'evaluate_script', {
    function: `() => {
      const mode = ${JSON.stringify(mode)};
      const hostId = ${JSON.stringify(hostId)};
      const hostInnerId = ${JSON.stringify(HOST_INNERHTML)};
      const hostStyleNodeId = ${JSON.stringify(HOST_STYLE_NODE)};

      document.getElementById(hostInnerId)?.remove();
      document.getElementById(hostStyleNodeId)?.remove();

      const host = document.createElement('div');
      host.id = hostId;
      host.style.cssText = 'position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
      const shadow = host.attachShadow({ mode: 'open' });

      let container = null;
      let tag = null;

      if (mode === 'innerhtml') {
        shadow.innerHTML = '<style>.container{position:absolute;inset:0;background:rgba(0,0,0,.2)} .tag{font-size:40px;color:red}</style><div class="container"><span class="tag">Probe</span></div>';
        container = shadow.querySelector('.container');
        tag = shadow.querySelector('.tag');
      } else {
        const style = document.createElement('style');
        style.textContent = '.container{position:absolute;inset:0;background:rgba(0,0,0,.2)} .tag{font-size:40px;color:red}';
        container = document.createElement('div');
        container.className = 'container';
        tag = document.createElement('span');
        tag.className = 'tag';
        tag.textContent = 'Probe';
        container.appendChild(tag);
        shadow.append(style, container);
      }

      document.body.appendChild(host);

      const containerStyle = container ? getComputedStyle(container) : null;
      const tagStyle = tag ? getComputedStyle(tag) : null;

      const result = {
        mode,
        hostId,
        present: !!host,
        hasShadowRoot: !!shadow,
        hasContainer: !!container,
        hasTag: !!tag,
        containerPosition: containerStyle?.position || null,
        containerBackground: containerStyle?.backgroundColor || null,
        tagColor: tagStyle?.color || null,
        tagFontSize: tagStyle?.fontSize || null,
      };

      host.remove();
      return JSON.stringify(result);
    }`,
  }, { retries: 2 });

  return parseJsonLoose(resultText);
}

function evaluateStyleHealth(result) {
  const bg = String(result?.containerBackground || '');
  return {
    styled: result?.containerPosition === 'absolute' && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'rgba(0,0,0,0)',
    reason: {
      position: result?.containerPosition || null,
      background: result?.containerBackground || null,
      tagColor: result?.tagColor || null,
      tagFontSize: result?.tagFontSize || null,
    },
  };
}

async function main() {
  const sourceUrl = process.env.SOURCE_URL || DEFAULT_SOURCE_URL;
  const client = await createPatchedClient('copilot-loading-style-probe');

  try {
    const sourcePage = await ensureSourcePage(client, sourceUrl);
    const innerhtml = await runMechanismProbe(client, 'innerhtml');
    const styleNode = await runMechanismProbe(client, 'style-node');

    const innerhtmlHealth = evaluateStyleHealth(innerhtml);
    const styleNodeHealth = evaluateStyleHealth(styleNode);

    const report = {
      ok: true,
      sourceUrl,
      sourcePage,
      probes: {
        innerhtml,
        styleNode,
      },
      verdict: {
        innerhtmlStyled: innerhtmlHealth.styled,
        styleNodeStyled: styleNodeHealth.styled,
        summary:
          innerhtmlHealth.styled === false && styleNodeHealth.styled === true
            ? 'Copilot style-loss pattern detected: avoid shadow.innerHTML style injection and use style-node append.'
            : 'No style-loss split detected by this probe run.',
      },
    };

    console.log(JSON.stringify(report, null, 2));
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  fail('Probe execution failed.', { error: String(error?.message || error) });
});
