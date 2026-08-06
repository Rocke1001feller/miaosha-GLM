import type { PlatformEntryInfo } from './types';

export * from './types';
export { bigmodelAdapter } from './adapters/bigmodel';

/**
 * Static platform entry metadata for the popup entry grid.
 * bigmodel is the hero entry; the two volcengine entries share a host root
 * and are grouped into one card by the UI.
 */
export const PLATFORMS: PlatformEntryInfo[] = [
  {
    id: 'bigmodel',
    displayName: '智谱 Coding Plan',
    hostPatterns: ['*://*.bigmodel.cn/*'],
    entryUrl: 'https://bigmodel.cn/glm-coding?plantype=personal',
    hero: true,
  },
  {
    id: 'volcengine-agentplan',
    displayName: '火山引擎 Agent Plan',
    hostPatterns: ['*://*.volcengine.com/*'],
    entryUrl: 'https://www.volcengine.com/activity/agentplan',
  },
  {
    id: 'volcengine-codingplan',
    displayName: '火山引擎 Coding Plan',
    hostPatterns: ['*://*.volcengine.com/*'],
    entryUrl: 'https://www.volcengine.com/activity/codingplan',
  },
  {
    id: 'bailian-codingplan',
    displayName: '阿里百炼 Coding Plan',
    hostPatterns: ['*://*.aliyun.com/*'],
    entryUrl: 'https://common-buy.aliyun.com/coding-plan',
  },
  {
    id: 'baidu-tokenplan',
    displayName: '百度千帆 Token Plan',
    hostPatterns: ['*://*.bce.baidu.com/*'],
    entryUrl: 'https://console.bce.baidu.com/qianfan/resource/token-plan',
  },
];
