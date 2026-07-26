const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createRequire } = require('node:module');

function getBuildEntry() {
  return process.env.BUILD_ENTRY || path.join(
    os.homedir(),
    'tools',
    'chrome-devtools-mcp-extension-inspect',
    'build',
    'src',
    'bin',
    'chrome-devtools-mcp.js',
  );
}

function ensureBuildEntryExists(buildEntry) {
  if (!fs.existsSync(buildEntry)) {
    throw new Error(`Patched MCP build entry not found: ${buildEntry}`);
  }
}

function textFrom(result) {
  return (result?.content || [])
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('\n');
}

function parseJsonBlock(text) {
  const match = text.match(/```json\n([\s\S]*?)\n```/i);
  if (!match || !match[1]) {
    return null;
  }
  try {
    return JSON.parse(match[1]);
  } catch {
    return null;
  }
}

function parsePageLines(listPagesText) {
  const lines = [];
  for (const line of listPagesText.split(/\r?\n/)) {
    const match = line.match(/^(\d+):\s+(.*)$/);
    if (!match) {
      continue;
    }
    lines.push({
      pageId: Number(match[1]),
      desc: match[2],
    });
  }
  return lines;
}

function parseNetworkRows(listText) {
  const rows = [];
  for (const line of listText.split(/\r?\n/)) {
    const match = line.match(/^reqid=(\S+)\s+(\S+)\s+(\S+)\s+(.+)$/);
    if (!match) {
      continue;
    }
    rows.push({
      reqid: Number(match[1]),
      method: match[2],
      url: match[3],
      status: match[4],
    });
  }
  return rows;
}

function extractChatSelectionFromDesc(desc) {
  const match = desc.match(/^chrome-extension:\/\/(\w+)\/chat-selection\.html\?id=([^\s]+)/);
  if (!match) {
    return null;
  }
  return {
    extId: match[1],
    convId: match[2],
  };
}

function isTimeoutError(error) {
  const message = String(error?.message || error || '');
  return message.includes('Request timed out') || message.includes('MCP error -32001');
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function callToolWithRetry(client, name, args = {}, options = {}) {
  const retries = options.retries == null ? 2 : options.retries;
  const retryDelayMs = options.retryDelayMs == null ? 1200 : options.retryDelayMs;

  let attempt = 0;
  while (true) {
    try {
      const result = await client.callTool({ name, arguments: args });
      return textFrom(result);
    } catch (error) {
      if (attempt >= retries || !isTimeoutError(error)) {
        throw error;
      }
      attempt += 1;
      await sleep(retryDelayMs * attempt);
    }
  }
}

async function createPatchedClient(clientName = 'patched-mcp-script') {
  const buildEntry = getBuildEntry();
  ensureBuildEntryExists(buildEntry);

  const buildRequire = createRequire(buildEntry);
  const [{ Client }, { StdioClientTransport }] = await Promise.all([
    import(pathToFileURL(buildRequire.resolve('@modelcontextprotocol/sdk/client/index.js')).href),
    import(pathToFileURL(buildRequire.resolve('@modelcontextprotocol/sdk/client/stdio.js')).href),
  ]);

  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [
      buildEntry,
      '--autoConnect',
      '--categoryExtensions',
      '--no-usage-statistics',
      '--no-performance-crux',
    ],
    stderr: 'pipe',
  });

  const client = new Client({ name: clientName, version: '1.0.0' });
  await client.connect(transport);
  return client;
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

module.exports = {
  callToolWithRetry,
  createPatchedClient,
  ensureDir,
  extractChatSelectionFromDesc,
  getBuildEntry,
  parseJsonBlock,
  parseNetworkRows,
  parsePageLines,
  sleep,
};
