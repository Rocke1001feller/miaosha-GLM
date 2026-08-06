/**
 * M6 usage providers — run in the background worker context.
 * MiniMax: plain credentialed fetch（持久 cookie，重启后仍有效）。
 * Kimi: Bearer token（localStorage 跨重启存活）；无缓存且无 kimi 标签页时自动
 *       开后台标签页捕获，无需用户交互。
 * MiMo: cookie 鉴权，但 api-platform_* 是「会话级」cookie，浏览器退出即失效；
 *       401 时通过标签页触发小米 SSO 重铸会话（与页面自愈同路径），随后重试。
 * Volc: cookies (incl. CHIPS partitions) injected via a declarativeNetRequest rule；
 *       csrfToken 同为会话级 cookie，缺失时合成随机值（火山为双提交校验，cookie
 *       与 x-csrf-token 相等即通过，2026-07-21 实证）；NotLogin（digest 失效）
 *       时经标签页 SSO 自愈后重试。
 * 标签页自愈统一走 healViaTab：打开/刷新控制台页，轮询凭证恢复，自建页用后即关。
 */

import { buildVolcDnrRule, parseKimi, parseMimo, parseMinimax, parseVolc } from './parsers';
import { kimiTokenStore, usageCacheStore } from './store';
import type { UsageCache, UsageCardData, UsagePlatform } from './types';

const CONSOLE_URLS: Record<UsagePlatform, string> = {
  minimax: 'https://platform.minimaxi.com/console/usage',
  kimi: 'https://www.kimi.com/code/console',
  mimo: 'https://platform.xiaomimimo.com/console/plan-manage',
  volcengine: 'https://console.volcengine.com/ark/region:cn-beijing/subscription/agent-plan',
};

const DISPLAY_NAMES: Record<UsagePlatform, string> = {
  minimax: 'MiniMax',
  kimi: 'Kimi Code',
  mimo: '小米 MiMo',
  volcengine: '火山引擎',
};

function card(platform: UsagePlatform, partial: Partial<UsageCardData>): UsageCardData {
  return {
    platform,
    displayName: DISPLAY_NAMES[platform],
    consoleUrl: CONSOLE_URLS[platform],
    status: 'ok',
    bars: [],
    fetchedAt: Date.now(),
    ...partial,
  };
}

function isAuthFailure(status: number, bodyText: string): boolean {
  if (status === 401 || status === 403) return true;
  return /unauthenticated|notlogin|not logged in|登录凭证已过期|重新登录|授权不存在/i.test(bodyText);
}

interface JsonResult {
  status: number;
  json: any;
  text: string;
}

async function fetchJson(url: string, init?: RequestInit): Promise<JsonResult> {
  const res = await fetch(url, { credentials: 'include', ...init });
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, json, text };
}

export async function fetchMinimax(): Promise<UsageCardData> {
  try {
    const { status, json, text } = await fetchJson(
      'https://www.minimaxi.com/backend/account/token_plan/remains_percent',
    );
    if (status !== 200 || !json || json?.base_resp?.status_code !== 0) {
      return card('minimax', {
        status: isAuthFailure(status, text) ? 'needs_login' : 'error',
        errorMessage: `HTTP ${status}`,
      });
    }
    return card('minimax', { status: 'ok', ...parseMinimax(json) });
  } catch (e: any) {
    return card('minimax', { status: 'error', errorMessage: String(e?.message || e) });
  }
}

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

const MIMO_JAR_URL = 'https://platform.xiaomimimo.com/';
const MIMO_SESSION_COOKIE = 'api-platform_serviceToken';

/** 自愈参数为可变对象，测试可调小超时。 */
export const sessionHealConfig = { timeoutMs: 15000, pollMs: 500 };

/**
 * 标签页会话自愈：会话级 cookie/token 随浏览器退出失效后，打开（或刷新已有的）
 * 平台控制台标签页，让页面自己走 SSO 重铸凭证（与页面自愈同路径，2026-07-21
 * 实证 MiMo 可行；火山控制台访问后 digest 自动重铸亦有实机证据）。轮询 probe
 * 确认凭证恢复后返回。自建的标签页用后即关；同平台并发调用共享同一次自愈。
 */
interface TabHealSpec {
  platform: UsagePlatform;
  tabUrlPattern: string;
  consoleUrl: string;
  /** 凭证是否已恢复（如 jar 中出现指定 cookie / 页面 localStorage 可读 token） */
  probe: () => Promise<boolean>;
}

const healInFlight = new Map<UsagePlatform, Promise<boolean>>();

async function healViaTab(spec: TabHealSpec): Promise<boolean> {
  const inFlight = healInFlight.get(spec.platform);
  if (inFlight) return inFlight;
  const p = (async () => {
    let createdId: number | undefined;
    try {
      const existing = await chrome.tabs.query({ url: spec.tabUrlPattern });
      const existingId = existing.find((t) => t.id != null)?.id;
      if (existingId != null) {
        // 已有标签页：刷新以重新触发 SSO 之舞（该页本会话已失效，刷新无副作用）
        await chrome.tabs.reload(existingId).catch(() => undefined);
      } else {
        const t = await chrome.tabs.create({ url: spec.consoleUrl, active: false });
        createdId = t.id;
      }
      const deadline = Date.now() + sessionHealConfig.timeoutMs;
      while (Date.now() < deadline) {
        const ok = await spec.probe().catch(() => false);
        if (ok) return true;
        await new Promise((r) => setTimeout(r, sessionHealConfig.pollMs));
      }
      return false;
    } catch {
      return false;
    } finally {
      if (createdId != null) chrome.tabs.remove(createdId).catch(() => undefined);
      healInFlight.delete(spec.platform);
    }
  })();
  healInFlight.set(spec.platform, p);
  return p;
}

/** MiMo 会话自愈：api-platform_* 会话 cookie 随浏览器退出失效后由小米 SSO 重铸。 */
export async function healMimoSession(): Promise<boolean> {
  return healViaTab({
    platform: 'mimo',
    tabUrlPattern: '*://platform.xiaomimimo.com/*',
    consoleUrl: CONSOLE_URLS.mimo,
    probe: async () => {
      const cs = await chrome.cookies.getAll({ url: MIMO_JAR_URL });
      return cs.some((c) => c.name === MIMO_SESSION_COOKIE);
    },
  });
}

async function fetchMimoPair(): Promise<[JsonResult, JsonResult]> {
  return Promise.all([
    fetchJson('https://platform.xiaomimimo.com/api/v1/tokenPlan/usage'),
    fetchJson('https://platform.xiaomimimo.com/api/v1/tokenPlan/detail'),
  ]) as Promise<[JsonResult, JsonResult]>;
}

export async function fetchMimo(): Promise<UsageCardData> {
  try {
    let [usage, detail] = await fetchMimoPair();
    if (usage.status === 401) {
      // 会话 cookie 已失效（典型：浏览器重启后）→ SSO 自愈后重试一次
      const healed = await healMimoSession();
      if (healed) [usage, detail] = await fetchMimoPair();
    }
    if (usage.status !== 200 || !usage.json || usage.json?.code !== 0) {
      return card('mimo', {
        status: isAuthFailure(usage.status, usage.text) ? 'needs_login' : 'error',
        errorMessage:
          usage.status === 401 ? '会话已过期且自动登录失败，请打开控制台登录' : `HTTP ${usage.status}`,
      });
    }
    return card('mimo', { status: 'ok', ...parseMimo(usage.json, detail.json) });
  } catch (e: any) {
    return card('mimo', { status: 'error', errorMessage: String(e?.message || e) });
  }
}

const KIMI_STATS_URL =
  'https://www.kimi.com/apiv2/kimi.gateway.membership.v2.MembershipService/GetSubscriptionStats';

async function readKimiTokenFromTab(tabId: number): Promise<string> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func: () => localStorage.getItem('access_token') || '',
  });
  return typeof results?.[0]?.result === 'string' ? results[0].result : '';
}

/**
 * 从 kimi.com 标签页的 localStorage 捕获 access_token。
 * 没有打开的 kimi 标签页时，自动开一个后台标签页再读——localStorage 跨浏览器
 * 重启存活，因此整过程无需用户交互（与 MiMo/火山 的标签页自愈同模式）。
 * 自建的标签页用后即关。
 */
async function captureKimiToken(): Promise<string> {
  let createdId: number | undefined;
  try {
    const tabs = await chrome.tabs.query({ url: '*://*.kimi.com/*' });
    let tabId = tabs.find((t) => t.id != null)?.id;
    if (!tabId) {
      const t = await chrome.tabs.create({ url: CONSOLE_URLS.kimi, active: false });
      createdId = t.id;
      tabId = t.id;
    }
    if (!tabId) return '';
    // 页面加载期间 executeScript 可能失败或读到空，轮询至超时
    const deadline = Date.now() + sessionHealConfig.timeoutMs;
    let token = '';
    while (Date.now() < deadline) {
      token = await readKimiTokenFromTab(tabId).catch(() => '');
      if (token) break;
      await new Promise((r) => setTimeout(r, sessionHealConfig.pollMs));
    }
    if (token) await kimiTokenStore.set(token);
    return token;
  } catch {
    return '';
  } finally {
    if (createdId != null) chrome.tabs.remove(createdId).catch(() => undefined);
  }
}

function fetchKimiWithToken(token: string): Promise<JsonResult> {
  return fetchJson(KIMI_STATS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: '{}',
  });
}

export async function fetchKimi(): Promise<UsageCardData> {
  try {
    let token = await kimiTokenStore.get();
    if (!token) token = await captureKimiToken();
    if (!token) {
      return card('kimi', {
        status: 'needs_login',
        errorMessage: '未捕获到 access_token，请打开一次 Kimi 控制台',
      });
    }
    let result = await fetchKimiWithToken(token);
    if (result.status === 401) {
      token = await captureKimiToken();
      if (!token) {
        return card('kimi', {
          status: 'needs_login',
          errorMessage: 'access_token 已过期，请打开一次 Kimi 控制台',
        });
      }
      result = await fetchKimiWithToken(token);
    }
    if (result.status !== 200 || !result.json || result.json.code) {
      return card('kimi', {
        status: isAuthFailure(result.status, result.text) ? 'needs_login' : 'error',
        errorMessage: `HTTP ${result.status}`,
      });
    }
    return card('kimi', { status: 'ok', ...parseKimi(result.json) });
  } catch (e: any) {
    return card('kimi', { status: 'error', errorMessage: String(e?.message || e) });
  }
}

const VOLC_ARK_BASE = 'https://console.volcengine.com/api/top/ark/cn-beijing/2024-01-01';
const VOLC_COOKIE_URL = 'https://console.volcengine.com/';

async function volcJar(): Promise<{ plain: chrome.cookies.Cookie[]; partitioned: chrome.cookies.Cookie[] }> {
  const getAllDetails = { url: VOLC_COOKIE_URL };
  const [plain, partitioned] = await Promise.all([
    chrome.cookies.getAll(getAllDetails),
    // CHIPS-partitioned session cookies (__sptiho / digest) — TS types lack partitionKey.
    chrome.cookies.getAll({
      ...getAllDetails,
      partitionKey: { topLevelSite: 'https://console.volcengine.com' },
    } as any) as Promise<chrome.cookies.Cookie[]>,
  ]);
  return { plain, partitioned };
}

/** 火山会话自愈：digest 失效后打开/刷新控制台标签页，等待页面 SSO 重铸。 */
export async function healVolcSession(): Promise<boolean> {
  return healViaTab({
    platform: 'volcengine',
    tabUrlPattern: '*://console.volcengine.com/*',
    consoleUrl: CONSOLE_URLS.volcengine,
    probe: async () => {
      const { plain, partitioned } = await volcJar();
      return plain.concat(partitioned).some((c) => c.name === 'digest' && c.value.length > 0);
    },
  });
}

export async function fetchVolc(): Promise<UsageCardData> {
  /** 单次尝试：读 jar → 构建 DNR 注入（必要时合成 csrf）→ 调接口 → 解析。 */
  async function attempt(): Promise<UsageCardData> {
    const { plain, partitioned } = await volcJar();
    const all = plain.concat(partitioned);
    let cookieHeader = all.map((c) => `${c.name}=${c.value}`).join('; ');
    let csrf = all.find((c) => c.name === 'csrfToken')?.value ?? '';
    if (!csrf) {
      // csrfToken 是会话级 cookie，浏览器重启后缺失。火山引擎对该接口做
      // 双提交 CSRF 校验（cookie 中的 csrfToken 与 x-csrf-token 头相等即放行，
      // 2026-07-21 实证），合成一个随机值补齐两端即可。
      csrf = randomHex(16);
      cookieHeader += `; csrfToken=${csrf}`;
    }
    if (!cookieHeader) {
      return card('volcengine', {
        status: 'needs_login',
        errorMessage: '未读取到火山引擎会话，请登录控制台后刷新',
      });
    }
    const rule = buildVolcDnrRule(cookieHeader, csrf);
    await chrome.declarativeNetRequest.updateDynamicRules({
      removeRuleIds: [rule.id],
      addRules: [rule],
    });
    try {
      const [afp, coding] = await Promise.all([
        fetchJson(`${VOLC_ARK_BASE}/GetAgentPlanAFPUsage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        }),
        fetchJson(`${VOLC_ARK_BASE}/GetCodingPlanUsage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{}',
        }),
      ]);
      const afpErr = afp.json?.ResponseMetadata?.Error;
      if (afp.status !== 200 || afpErr) {
        const code = afpErr?.Code as string | undefined;
        return card('volcengine', {
          status:
            isAuthFailure(afp.status, afp.text) || code === 'NotLogin' ? 'needs_login' : 'error',
          errorMessage: code || `HTTP ${afp.status}`,
        });
      }
      return card('volcengine', { status: 'ok', ...parseVolc(afp.json, coding.json) });
    } finally {
      // The rule must not outlive the fetch: it would otherwise keep injecting
      // stale cookies/CSRF into the user's own console XHR traffic.
      await chrome.declarativeNetRequest
        .updateDynamicRules({ removeRuleIds: [rule.id] })
        .catch(() => undefined);
    }
  }

  try {
    let result = await attempt();
    // NotLogin = digest 会话凭证失效（合成 csrf 救不了鉴权层）→ 标签页 SSO 自愈后重试一次
    if (result.status === 'needs_login' && result.errorMessage === 'NotLogin') {
      const healed = await healVolcSession();
      if (healed) result = await attempt();
      if (result.status === 'needs_login' && result.errorMessage === 'NotLogin') {
        return card('volcengine', {
          status: 'needs_login',
          errorMessage: '会话已过期且自动登录失败，请打开控制台登录',
        });
      }
    }
    return result;
  } catch (e: any) {
    return card('volcengine', { status: 'error', errorMessage: String(e?.message || e) });
  }
}

/** Provider map — mutable so tests can substitute stubs. */
export const USAGE_PROVIDERS: Record<UsagePlatform, () => Promise<UsageCardData>> = {
  minimax: fetchMinimax,
  kimi: fetchKimi,
  mimo: fetchMimo,
  volcengine: fetchVolc,
};

export async function refreshUsageCache(
  providers: Record<UsagePlatform, () => Promise<UsageCardData>> = USAGE_PROVIDERS,
): Promise<UsageCache> {
  const platforms = Object.keys(providers) as UsagePlatform[];
  const results = await Promise.all(
    platforms.map((p) =>
      providers[p]().catch((e: unknown) =>
        card(p, { status: 'error', errorMessage: String((e as any)?.message || e) }),
      ),
    ),
  );
  const cache: UsageCache = {};
  for (const c of results) cache[c.platform] = c;
  await usageCacheStore.set(cache);
  return cache;
}
