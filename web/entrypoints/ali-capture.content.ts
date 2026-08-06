// ISOLATED world content script for common-buy.aliyun.com/coding-plan
// Injects the Bailian MAIN-world overlay and forwards purchase success
// notifications to the background worker.
export default defineContentScript({
  matches: ['*://common-buy.aliyun.com/coding-plan*'],
  runAt: 'document_idle',

  main() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('/ali-main.js');
    script.dataset.version = chrome.runtime.getManifest().version;
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);

    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data?.__ali_cmd) return;

      if (data.type === 'ALI_PURCHASE_SUCCESS') {
        try {
          chrome.runtime.sendMessage({
            type: 'ALI_PURCHASE_SUCCESS',
            orderId: data.orderId,
            productName: data.productName,
            plan: data.plan,
            payUrl: data.payUrl,
          });
        } catch (e: any) {
          console.log('[ali-capture] purchase success forward failed', e?.message || String(e));
        }
      }
    });
  },
});
