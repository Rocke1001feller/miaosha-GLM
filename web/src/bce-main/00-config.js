// Platform constants for the Baidu Qianfan Token Plan MAIN-world overlay.
// Reads are plain GETs; writes POST with a csrftoken header taken fresh from
// the bce-user-info cookie (probed 2026-07-18).
var BCE_VERSION =
  (typeof document !== 'undefined' &&
    document.currentScript &&
    document.currentScript.dataset &&
    document.currentScript.dataset.version) ||
  '1.4.2';

var BCE_CONFIG = {
  platform: 'baidu-tokenplan',
  title: '百度千帆 Token Plan',
  products: [
    { planType: 'mini', name: 'Mini', price: '¥4.9/月' },
    { planType: 'lite', name: 'Lite', price: '¥19.9/月' },
    { planType: 'pro', name: 'Pro', price: '¥99.9/月' },
    { planType: 'max', name: 'Max', price: '¥299.9/月' },
  ],
  defaultSelected: ['lite', 'pro'],
  maxSelections: 3,
  idlePollMs: 2000,
  armedPollMs: 500,
  armedLeadMs: 300000,
  fireIntervalMs: 800,
  fireBackoffMs: 2000,
  maxFireAttempts: 60,
};
