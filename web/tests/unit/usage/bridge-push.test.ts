import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { storage } from '#imports';
import {
  bridgeConfigStore,
  computePushIntervalMs,
  pushUsageToBridge,
  runBridgePushTick,
} from '../../../lib/usage/bridge-push';
import { sessionHealConfig, USAGE_PROVIDERS } from '../../../lib/usage/providers';
import type { UsageCache, UsageCardData, UsagePlatform } from '../../../lib/usage/types';

const OK_CACHE: UsageCache = {
  kimi: {
    platform: 'kimi', displayName: 'Kimi Code', consoleUrl: '', status: 'ok',
    bars: [{ label: '5h', percent: 0.5, resetAt: Date.now() + 3600_000 }],
    fetchedAt: Date.now(),
  },
};

describe('bridge-push', () => {
  const origHealConfig = { ...sessionHealConfig };

  beforeEach(async () => {
    await storage.removeItem('local:bridgeConfig');
    // fakeBrowser 没有 chrome.scripting，kimi provider 会走标签页轮询直到超时；
    // 按 lib/usage/providers.ts 的可变自愈参数约定把超时调小，让四个 provider 快速失败。
    sessionHealConfig.timeoutMs = 50;
    sessionHealConfig.pollMs = 1;
  });

  afterEach(() => {
    Object.assign(sessionHealConfig, origHealConfig);
  });

  it('默认配置 disabled；读写往返', async () => {
    expect((await bridgeConfigStore.get()).enabled).toBe(false);
    await bridgeConfigStore.set({ enabled: true, port: 17389, token: 'T1' });
    expect((await bridgeConfigStore.get()).token).toBe('T1');
  });

  it('远离重置窗口 60s；±15min 内 30s', () => {
    const far = computePushIntervalMs(OK_CACHE);
    expect(far).toBe(60_000);
    const near: UsageCache = {
      kimi: { ...OK_CACHE.kimi!, bars: [{ label: '5h', percent: 0.9, resetAt: Date.now() + 10 * 60_000 }] },
    };
    expect(computePushIntervalMs(near)).toBe(30_000);
  });

  it('push 带 Bearer 头与 UsageCache body；失败静默 resolve false', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }) as any);
    vi.stubGlobal('fetch', fetchMock);
    const ok = await pushUsageToBridge({ enabled: true, port: 17389, token: 'T1' }, OK_CACHE);
    expect(ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('http://127.0.0.1:17389/v1/usage');
    expect((init?.headers as any).Authorization).toBe('Bearer T1');
    expect(JSON.parse(init?.body as string).kimi.platform).toBe('kimi');

    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('ECONNREFUSED'); }));
    expect(await pushUsageToBridge({ enabled: true, port: 17389, token: 'T1' }, OK_CACHE)).toBe(false);
  });

  it('manifest host_permissions 含 http://127.0.0.1/*（桥推送跨源 preflight 前提）', async () => {
    // defineConfig 为恒等函数，导入 wxt.config.ts 直接拿到原始配置对象
    const { default: wxtConfig } = await import('../../../wxt.config');
    const hostPermissions = (wxtConfig as any).manifest?.host_permissions as string[];
    expect(hostPermissions).toContain('http://127.0.0.1/*');
    // 动态 import wxt.config 经 vite transform 拉起整条 wxt 依赖链，全量套件
    // 并行负载下单测可超过默认 5s 超时（隔离运行已 ~2.5s），故放宽到 20s。
  }, 20000);

  it('runBridgePushTick：disabled 时不发请求', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, text: async () => '{}' }) as any);
    vi.stubGlobal('fetch', fetchMock);
    // 让四个 provider 全部快速失败也不影响 tick
    await runBridgePushTick();
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('127.0.0.1'))).toHaveLength(0);
  });

  describe('runBridgePushTick 门控与动态节奏', () => {
    const origProviders = { ...USAGE_PROVIDERS };

    const errCard = (platform: UsagePlatform): UsageCardData => ({
      platform, displayName: platform, consoleUrl: '', status: 'error', bars: [], fetchedAt: Date.now(),
    });

    /** 全部替换为快速 stub：minimax 返回带指定 resetAt 的 ok 卡，其余直接 error。 */
    function stubProviders(minimaxResetAt: number | null) {
      for (const p of Object.keys(USAGE_PROVIDERS) as UsagePlatform[]) {
        USAGE_PROVIDERS[p] = async (): Promise<UsageCardData> =>
          p === 'minimax' && minimaxResetAt != null
            ? {
                platform: p, displayName: 'MiniMax', consoleUrl: '', status: 'ok',
                bars: [{ label: '5h', percent: 0.5, resetAt: minimaxResetAt }],
                fetchedAt: Date.now(),
              }
            : errCard(p);
      }
    }

    beforeEach(async () => {
      await bridgeConfigStore.set({ enabled: true, port: 17389, token: 'T1' });
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true }) as any));
    });

    afterEach(() => {
      Object.assign(USAGE_PROVIDERS, origProviders);
      vi.restoreAllMocks();
    });

    it('enabled + 远离重置窗口 → tick 后 alarms.create 收到 periodInMinutes: 1', async () => {
      stubProviders(Date.now() + 3600_000);
      const spy = vi.spyOn(chrome.alarms, 'create');
      await runBridgePushTick();
      expect(spy).toHaveBeenCalledWith('usage-bridge-push', { periodInMinutes: 1 });
    });

    it('enabled + resetAt 在 ±15min 内 → tick 后 alarms.create 收到 periodInMinutes: 0.5', async () => {
      stubProviders(Date.now() + 10 * 60_000);
      const spy = vi.spyOn(chrome.alarms, 'create');
      await runBridgePushTick();
      expect(spy).toHaveBeenCalledWith('usage-bridge-push', { periodInMinutes: 0.5 });
    });

    it('disabled → 不 refresh、不发桥请求、不重排 alarm', async () => {
      await bridgeConfigStore.set({ enabled: false, port: 17389, token: '' });
      const fetchMock = vi.fn(async () => ({ ok: true }) as any);
      vi.stubGlobal('fetch', fetchMock);
      const providerSpy = vi.fn(async () => errCard('minimax'));
      USAGE_PROVIDERS.minimax = providerSpy;
      const alarmSpy = vi.spyOn(chrome.alarms, 'create');
      await runBridgePushTick();
      // refreshUsageCache 被调用必然经由 provider 打平台 API——两者都未被触及即未 refresh
      expect(providerSpy).not.toHaveBeenCalled();
      expect(fetchMock).not.toHaveBeenCalled();
      expect(alarmSpy).not.toHaveBeenCalled();
    });
  });
});
