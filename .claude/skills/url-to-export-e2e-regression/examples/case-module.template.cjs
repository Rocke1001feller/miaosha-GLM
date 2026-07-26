module.exports = {
  id: '<platform>-<resource>-<endpoint>',
  kind: 'full-url-to-export',
  sourceUrl: '<real source URL>',
  platform: '<platform-id>',
  resource: '<one-of-12-resource-ids>',
  endpoint: {
    kind: 'export',
    format: '<json|markdown|copy-markdown|text|pdf|docx|image|copy|notion>',
  },
  extension: {
    envId: 'EXT_ID',
    reloadBeforeRun: false,
  },
  download: {
    // false = auto-download (recommended for local automation), true = ask where to save for each file
    manualDownload: false,
  },
  source: {
    probe: `() => ({ url: location.href, title: document.title })`,
    assert(result, assert) {
      assert(result?.url?.startsWith('http'), 'source URL should be loaded', result);
    },
  },
  chatSelection: {
    waitMs: 1000,
    probe: `() => ({
      url: location.href,
      title: document.title,
      messageCount: document.querySelectorAll('[data-message-id], .message-card, .message').length,
      // Replace these with selectors for the selected resource.
      resourceCount: document.querySelectorAll('<resource-selector>').length,
    })`,
    assert(result, assert) {
      assert(result?.url?.includes('/chat-selection.html?id='), 'chat-selection page should be loaded', result);
      assert(result?.resourceCount > 0, 'selected resource should render in chat-selection', result);
    },
  },
  export: {
    waitMs: 3500,
    probeKind: 'blob-create-object-url',
    assert(result, assert) {
      const latest = result?.blobs?.at(-1);
      assert(latest, 'expected at least one exported blob', result);
      assert(latest.size > 0, 'expected non-empty exported blob', latest);
      // Replace with resource-specific content checks.
      // Text-like exports expose latest.text; binary exports expose latest.firstBytesHex.
    },
  },
};
