// ISOLATED world content script for console.bce.baidu.com/qianfan/resource/token-plan
// Injects the Qianfan Token Plan MAIN-world overlay and forwards purchase
// success notifications to the background worker.
export default defineContentScript({
  matches: ['*://console.bce.baidu.com/qianfan/resource/token-plan*'],
  runAt: 'document_idle',

  main() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('/bce-main.js');
    script.dataset.version = chrome.runtime.getManifest().version;
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);

    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data?.__bce_cmd) return;

      if (data.type === 'BCE_PURCHASE_SUCCESS') {
        try {
          chrome.runtime.sendMessage({
            type: 'BCE_PURCHASE_SUCCESS',
            orderId: data.orderId,
            productName: data.productName,
            plan: data.plan,
            payUrl: data.payUrl,
          });
        } catch (e: any) {
          console.log('[bce-capture] purchase success forward failed', e?.message || String(e));
        }
      }
    });
  },
});
