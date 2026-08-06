// ISOLATED world content script for www.volcengine.com/activity/{agentplan,codingplan}
// Injects the merged Volcengine MAIN-world overlay and forwards purchase
// success notifications to the background worker.
export default defineContentScript({
  matches: [
    '*://www.volcengine.com/activity/agentplan*',
    '*://www.volcengine.com/activity/codingplan*',
  ],
  runAt: 'document_idle',

  main() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('/volc-main.js');
    script.dataset.version = chrome.runtime.getManifest().version;
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);

    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data?.__volc_cmd) return;

      if (data.type === 'VOLC_PURCHASE_SUCCESS' && data.orderId) {
        try {
          chrome.runtime.sendMessage({
            type: 'VOLC_PURCHASE_SUCCESS',
            orderId: data.orderId,
            productId: data.productId,
            productName: data.productName,
            payUrl: data.payUrl,
          });
        } catch (e: any) {
          console.log('[volc-capture] purchase success forward failed', e?.message || String(e));
        }
      }
    });
  },
});
