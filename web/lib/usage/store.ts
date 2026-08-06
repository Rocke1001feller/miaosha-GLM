import { storage } from '#imports';
import type { UsageCache } from './types';

const USAGE_CACHE_KEY = 'local:usageCache';
const KIMI_TOKEN_KEY = 'local:kimiAccessToken';

export const usageCacheStore = {
  async get(): Promise<UsageCache> {
    try {
      return (await storage.getItem<UsageCache>(USAGE_CACHE_KEY)) ?? {};
    } catch {
      return {};
    }
  },
  async set(cache: UsageCache): Promise<void> {
    await storage.setItem(USAGE_CACHE_KEY, cache);
  },
};

export const kimiTokenStore = {
  async get(): Promise<string> {
    try {
      return (await storage.getItem<string>(KIMI_TOKEN_KEY)) ?? '';
    } catch {
      return '';
    }
  },
  async set(token: string): Promise<void> {
    await storage.setItem(KIMI_TOKEN_KEY, token);
  },
};
