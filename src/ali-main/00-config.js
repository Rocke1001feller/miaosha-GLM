// Platform constants for the Aliyun Bailian Coding Plan MAIN-world overlay.
// The page itself calls buy-api.aliyun.com with plain fetch + credentials:'include',
// so this overlay does the same from the MAIN world (probed 2026-07-17).
var ALI_VERSION =
  (typeof document !== 'undefined' &&
    document.currentScript &&
    document.currentScript.dataset &&
    document.currentScript.dataset.version) ||
  '2.0.0';

var ALI_CONFIG = {
  platform: 'bailian-codingplan',
  title: '阿里百炼 Coding Plan',
  apiBase: 'https://buy-api.aliyun.com',
  commodityCode: 'sfm_codingplan_public_cn',
  skuId: 'pro',
  consoleUrl: 'https://bailian.console.aliyun.com/?tab=coding-plan#/efm/coding-plan-detail',
  idlePollMs: 2000,
  armedPollMs: 500,
  armedLeadMs: 60000,
  fireIntervalMs: 300,
  fireBackoffMs: 1500,
  maxFireAttempts: 100,
  tokenReadyRetries: 10,
  tokenReadyDelayMs: 500,
};
