// ISOLATED world content script that runs at document_start.
// Injects a tiny MAIN-world script to save the page's original fetch/XHR
// before the page's Sentry SDK instruments them. The MAIN world overlay later
// uses these references to call /api/biz/pay/batch-preview without triggering
// Alibaba WAF 405 blocks.
//
// This is loaded as an external file (not inline) because bigmodel.cn's CSP
// forbids inline scripts.
export default defineContentScript({
  matches: ['*://*.bigmodel.cn/*'],
  runAt: 'document_start',

  main() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('/bm-early.js');
    script.onload = () => script.remove();
    const root = document.documentElement || document.head;
    if (root) {
      root.appendChild(script);
    }
  },
});
