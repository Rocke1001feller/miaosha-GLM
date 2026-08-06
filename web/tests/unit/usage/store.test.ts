import { beforeEach, describe, expect, it } from 'vitest';
import { storage } from '#imports';
import { kimiTokenStore, usageCacheStore } from '../../../lib/usage/store';

describe('usageCacheStore / kimiTokenStore', () => {
  beforeEach(async () => {
    await storage.removeItem('local:usageCache');
    await storage.removeItem('local:kimiAccessToken');
  });

  it('空缓存 → {} / 空 token → 空串', async () => {
    expect(await usageCacheStore.get()).toEqual({});
    expect(await kimiTokenStore.get()).toBe('');
  });

  it('写入后可读回', async () => {
    await usageCacheStore.set({
      minimax: {
        platform: 'minimax',
        displayName: 'MiniMax',
        consoleUrl: 'https://platform.minimaxi.com/console/usage',
        status: 'ok',
        bars: [{ label: '5h 限额', percent: 0.5 }],
        fetchedAt: 1784300000000,
      },
    });
    const cache = await usageCacheStore.get();
    expect(cache.minimax?.bars[0].percent).toBe(0.5);
    await kimiTokenStore.set('jwt-x');
    expect(await kimiTokenStore.get()).toBe('jwt-x');
  });
});
