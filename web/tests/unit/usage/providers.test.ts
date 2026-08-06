import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { storage } from '#imports';
import {
  fetchKimi,
  fetchMimo,
  fetchVolc,
  sessionHealConfig,
  refreshUsageCache,
  USAGE_PROVIDERS,
} from '../../../lib/usage/providers';
import type { UsageCardData, UsagePlatform } from '../../../lib/usage/types';

function fakeCard(platform: UsagePlatform, status: UsageCardData['status']): UsageCardData {
  return {
    platform,
    displayName: platform,
    consoleUrl: 'https://example.com',
    status,
    bars: [],
    fetchedAt: Date.now(),
  };
}

describe('refreshUsageCache', () => {
  it('并发执行全部 provider 并写入 usageCache（异常 provider 降级不阻塞）', async () => {
    await storage.removeItem('local:usageCache');
    const stub: typeof USAGE_PROVIDERS = {
      minimax: async () => fakeCard('minimax', 'ok'),
      kimi: async () => fakeCard('kimi', 'needs_login'),
      mimo: async () => fakeCard('mimo', 'ok'),
      volcengine: async () => fakeCard('volcengine', 'error'),
    };
    const cache = await refreshUsageCache(stub);
    expect(Object.keys(cache).sort()).toEqual(['kimi', 'mimo', 'minimax', 'volcengine']);
    expect(cache.kimi?.status).toBe('needs_login');
    const persisted = await storage.getItem<any>('local:usageCache');
    expect(persisted.mimo.status).toBe('ok');
  });

  it('provider 意外 throw → 该平台降级 error 卡，整体仍返回并写缓存', async () => {
    await storage.removeItem('local:usageCache');
    const stub: typeof USAGE_PROVIDERS = {
      minimax: async () => fakeCard('minimax', 'ok'),
      kimi: async () => {
        throw new Error('boom');
      },
      mimo: async () => fakeCard('mimo', 'ok'),
      volcengine: async () => fakeCard('volcengine', 'ok'),
    };
    const cache = await refreshUsageCache(stub);
    expect(cache.kimi?.status).toBe('error');
    expect(cache.kimi?.errorMessage).toContain('boom');
    expect(cache.minimax?.status).toBe('ok');
    expect(Object.keys(cache)).toHaveLength(4);
  });
});

/**
 * 回归：浏览器重启后会话级 cookie 失效的两个根因修复（2026-07-21 实证）
 * - MiMo：api-platform_* 会话 cookie 死亡 → 后台标签页 SSO 自愈后重试
 * - Volc：csrfToken 会话 cookie 死亡 → 合成随机值补齐双提交校验
 */
describe('会话 cookie 失效自愈', () => {
  const res = (status: number, body: any) => ({ status, text: async () => JSON.stringify(body) });
  const MIMO_USAGE_OK = {
    code: 0,
    data: {
      usage: { items: [{ name: 'plan_total_token', percent: 0.5, used: 100, limit: 200 }] },
      monthUsage: { items: [{ percent: 0.25, used: 50, limit: 200 }] },
    },
  };
  const MIMO_DETAIL_OK = { code: 0, data: { planName: 'Lite', currentPeriodEnd: '2027-05-28' } };
  const VOLC_AFP_OK = {
    Result: {
      PlanType: 'small',
      AFPFiveHour: { Quota: 2000, Used: 100, ResetTime: 0 },
      AFPWeekly: { Quota: 7000, Used: 0, ResetTime: 0 },
      AFPMonthly: { Quota: 20000, Used: 900, ResetTime: 0 },
    },
  };
  const VOLC_CODING_OK = { Result: { Status: 'Reclaimed' } };

  let cookiesGetAll: ReturnType<typeof vi.fn>;
  let dnrUpdate: ReturnType<typeof vi.fn>;
  let tabsQuery: ReturnType<typeof vi.fn>;
  let tabsCreate: ReturnType<typeof vi.fn>;
  let tabsRemove: ReturnType<typeof vi.fn>;
  let tabsReload: ReturnType<typeof vi.fn>;
  const origConfig = { ...sessionHealConfig };

  beforeEach(() => {
    cookiesGetAll = vi.fn();
    dnrUpdate = vi.fn().mockResolvedValue(undefined);
    tabsQuery = vi.fn().mockResolvedValue([]);
    tabsCreate = vi.fn().mockResolvedValue({ id: 42 });
    tabsRemove = vi.fn().mockResolvedValue(undefined);
    tabsReload = vi.fn().mockResolvedValue(undefined);
    (chrome as any).cookies = { getAll: cookiesGetAll };
    (chrome as any).declarativeNetRequest = { updateDynamicRules: dnrUpdate };
    (chrome as any).tabs = {
      ...chrome.tabs,
      query: tabsQuery,
      create: tabsCreate,
      remove: tabsRemove,
      reload: tabsReload,
    };
    sessionHealConfig.timeoutMs = 50;
    sessionHealConfig.pollMs = 1;
  });

  afterEach(() => {
    // 注意：不要 vi.unstubAllGlobals() —— WxtVitest 注入的全局 chrome 会被一并撤掉
    Object.assign(sessionHealConfig, origConfig);
  });

  it('MiMo 401 → 后台标签页 SSO 自愈 → 重试成功（标签页用后即关）', async () => {
    let usageCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('tokenPlan/usage')) {
          usageCalls += 1;
          return usageCalls === 1 ? res(401, {}) : res(200, MIMO_USAGE_OK);
        }
        return res(200, MIMO_DETAIL_OK);
      }),
    );
    // 自愈轮询第一次就看到会话 cookie 被 SSO 重铸
    cookiesGetAll.mockResolvedValue([{ name: 'api-platform_serviceToken', value: 'x' }]);

    const result = await fetchMimo();
    expect(result.status).toBe('ok');
    expect(result.bars).toHaveLength(2);
    expect(tabsCreate).toHaveBeenCalledOnce();
    expect(tabsRemove).toHaveBeenCalledWith(42);
    expect(usageCalls).toBe(2);
  });

  it('MiMo 自愈失败（SSO 未登录）→ needs_login 且提示明确', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('tokenPlan/usage') ? res(401, {}) : res(200, MIMO_DETAIL_OK),
      ),
    );
    cookiesGetAll.mockResolvedValue([]); // 会话 cookie 始终未被重铸

    const result = await fetchMimo();
    expect(result.status).toBe('needs_login');
    expect(result.errorMessage).toContain('自动登录失败');
    expect(tabsRemove).toHaveBeenCalledWith(42);
  });

  it('Volc 缺失 csrfToken → 合成随机值，cookie 与 x-csrf-token 双提交一致', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('GetAgentPlanAFPUsage') ? res(200, VOLC_AFP_OK) : res(200, VOLC_CODING_OK),
      ),
    );
    // jar 里只有 digest（持久 HttpOnly），没有 csrfToken
    cookiesGetAll.mockImplementation(async (details: any) =>
      details?.partitionKey ? [] : [{ name: 'digest', value: 'D', httpOnly: true }],
    );

    const result = await fetchVolc();
    expect(result.status).toBe('ok');
    expect(result.bars.length).toBeGreaterThan(0);

    const rule = dnrUpdate.mock.calls[0][0].addRules[0];
    const headers = Object.fromEntries(
      rule.action.requestHeaders.map((h: any) => [h.header, h.value]),
    );
    expect(headers['x-csrf-token']).toMatch(/^[0-9a-f]{32}$/);
    expect(headers['Cookie']).toContain(`csrfToken=${headers['x-csrf-token']}`);
  });

  it('Volc jar 中已有 csrfToken → 使用真实值，不合成', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('GetAgentPlanAFPUsage') ? res(200, VOLC_AFP_OK) : res(200, VOLC_CODING_OK),
      ),
    );
    cookiesGetAll.mockImplementation(async (details: any) =>
      details?.partitionKey
        ? []
        : [
            { name: 'digest', value: 'D', httpOnly: true },
            { name: 'csrfToken', value: 'REAL_CSRF', session: true },
          ],
    );

    await fetchVolc();
    const rule = dnrUpdate.mock.calls[0][0].addRules[0];
    const headers = Object.fromEntries(
      rule.action.requestHeaders.map((h: any) => [h.header, h.value]),
    );
    expect(headers['x-csrf-token']).toBe('REAL_CSRF');
  });
});

describe('Kimi/Volc 标签页自愈（2026-07-21 第二轮根因修复）', () => {
  const res = (status: number, body: any) => ({ status, text: async () => JSON.stringify(body) });
  const KIMI_OK = {
    code: 0,
    ratelimitCode5h: { ratio: 0.3, resetTime: '2026-07-21T05:00:00Z' },
    ratelimitCode7d: { ratio: 0.15, resetTime: '2026-07-28T00:00:00Z' },
  };
  const VOLC_AFP_OK = {
    Result: {
      PlanType: 'small',
      AFPFiveHour: { Quota: 2000, Used: 100, ResetTime: 0 },
      AFPWeekly: { Quota: 7000, Used: 0, ResetTime: 0 },
      AFPMonthly: { Quota: 20000, Used: 900, ResetTime: 0 },
    },
  };
  const VOLC_CODING_OK = { Result: { Status: 'Reclaimed' } };
  const VOLC_NOTLOGIN = { ResponseMetadata: { Error: { Code: 'NotLogin', Message: 'not login' } } };

  let cookiesGetAll: ReturnType<typeof vi.fn>;
  let dnrUpdate: ReturnType<typeof vi.fn>;
  let tabsQuery: ReturnType<typeof vi.fn>;
  let tabsCreate: ReturnType<typeof vi.fn>;
  let tabsRemove: ReturnType<typeof vi.fn>;
  let tabsReload: ReturnType<typeof vi.fn>;
  let executeScript: ReturnType<typeof vi.fn>;
  const origConfig = { ...sessionHealConfig };

  beforeEach(async () => {
    await storage.removeItem('local:kimiAccessToken');
    cookiesGetAll = vi.fn();
    dnrUpdate = vi.fn().mockResolvedValue(undefined);
    tabsQuery = vi.fn().mockResolvedValue([]);
    tabsCreate = vi.fn().mockResolvedValue({ id: 77 });
    tabsRemove = vi.fn().mockResolvedValue(undefined);
    tabsReload = vi.fn().mockResolvedValue(undefined);
    executeScript = vi.fn();
    (chrome as any).cookies = { getAll: cookiesGetAll };
    (chrome as any).declarativeNetRequest = { updateDynamicRules: dnrUpdate };
    (chrome as any).tabs = {
      ...chrome.tabs,
      query: tabsQuery,
      create: tabsCreate,
      remove: tabsRemove,
      reload: tabsReload,
    };
    (chrome as any).scripting = { executeScript };
    sessionHealConfig.timeoutMs = 50;
    sessionHealConfig.pollMs = 1;
  });

  afterEach(() => {
    Object.assign(sessionHealConfig, origConfig);
  });

  it('Kimi 无缓存 token 且无标签页 → 自动开后台页捕获 token，用后即关', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res(200, KIMI_OK)));
    executeScript.mockResolvedValue([{ result: 'TKN-123' }]);

    const result = await fetchKimi();
    expect(result.status).toBe('ok');
    expect(result.bars).toHaveLength(2);
    expect(tabsCreate).toHaveBeenCalledOnce();
    expect(tabsCreate.mock.calls[0][0]).toMatchObject({ active: false });
    expect(tabsRemove).toHaveBeenCalledWith(77);
    // 捕获到的 token 已写入缓存
    expect(await storage.getItem('local:kimiAccessToken')).toBe('TKN-123');
  });

  it('Kimi 已有 kimi.com 标签页 → 直接读 token，不新开标签页', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => res(200, KIMI_OK)));
    tabsQuery.mockResolvedValue([{ id: 9, url: 'https://www.kimi.com/code/console' }]);
    executeScript.mockResolvedValue([{ result: 'TKN-EXISTING' }]);

    const result = await fetchKimi();
    expect(result.status).toBe('ok');
    expect(tabsCreate).not.toHaveBeenCalled();
    expect(executeScript.mock.calls[0][0].target.tabId).toBe(9);
  });

  it('Volc NotLogin（digest 失效）→ 标签页自愈重铸 digest 后重试成功', async () => {
    let healed = false;
    let afpCalls = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('GetAgentPlanAFPUsage')) {
          afpCalls += 1;
          return afpCalls === 1 ? res(200, VOLC_NOTLOGIN) : res(200, VOLC_AFP_OK);
        }
        return res(200, VOLC_CODING_OK);
      }),
    );
    cookiesGetAll.mockImplementation(async (details: any) => {
      // 自愈前 jar 无 digest；probe/重建时在 healed 后出现 digest
      const base = details?.partitionKey ? [] : [{ name: 'userInfo', value: 'U', httpOnly: true }];
      return healed ? base.concat([{ name: 'digest', value: 'D2', httpOnly: true }]) : base;
    });
    tabsCreate.mockImplementation(async () => {
      healed = true; // 模拟控制台页 SSO 重铸
      return { id: 88 };
    });

    const result = await fetchVolc();
    expect(result.status).toBe('ok');
    expect(afpCalls).toBe(2);
    expect(tabsCreate).toHaveBeenCalledOnce();
    expect(tabsRemove).toHaveBeenCalledWith(88);
  });

  it('Volc NotLogin 且自愈失败 → needs_login 并提示自动登录失败', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('GetAgentPlanAFPUsage') ? res(200, VOLC_NOTLOGIN) : res(200, VOLC_CODING_OK),
      ),
    );
    cookiesGetAll.mockResolvedValue([{ name: 'userInfo', value: 'U', httpOnly: true }]);

    const result = await fetchVolc();
    expect(result.status).toBe('needs_login');
    expect(result.errorMessage).toContain('自动登录失败');
  });
});
