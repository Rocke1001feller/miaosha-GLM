// ISOLATED world content script for bigmodel.cn
// Injects MAIN world XHR interceptor and relays payment/ticket data to WXT storage
// Also implements R3: Tab Audio+Visual reminder when user is on bigmodel.cn
import { storage } from '#imports';
import {
  nextDecision,
  SMART_FIRE_BUDGET_DEFAULT,
  SMART_FIRE_MIN_INTERVAL_MS,
  type FireEvent,
  type FireShot,
  type SmartFireState,
} from '../lib/api/smart-fire-plan';
import { type StrikeTarget } from '../lib/api/strike-plan';
import { fireStore, FIRE_CONFIG_DEFAULT, type FireConfig } from '../lib/settings/fire';
import { SALE_ALARM_MINUTES, SALE_TIME_DEFAULT, getNextSaleTime, saleTimeStore, type SaleTimeConfig } from '../lib/settings/sale-time';
import { captchaStore } from '../lib/settings/captcha';
import { bigmodelAdapter } from '../lib/platform';
import type { PlatformAuth } from '../lib/platform';
import { createAuthStore } from '../lib/platform/shared/stores';
import { classifyNetworkError, classifyPreviewError, type ClassifiedShotResult } from '../lib/platform/adapters/bigmodel/order-pipeline';
import { xhrRequest } from '../lib/platform/adapters/bigmodel/request';

const TICKET_TTL_MS = 5 * 60 * 1000; // alpha: 5 minutes per-ticket lifecycle
let TICKET_POOL_MAX = 100; // synced with captchaConfig.batchSessionLimit (single source of truth)
const REMINDER_PHASE_MINUTES_ASC = [...SALE_ALARM_MINUTES].sort((a, b) => a - b);

const BANNER_AUTO_DISMISS_MS = 3 * 60 * 1000; // R3 flash banner auto-dismiss after 3 min

let bannerDismissTimer: number | null = null;

const PHASE_BEEPS: Record<number, number> = {
  60: 1,
  30: 1,
  15: 1,
  10: 3,
   5: 4,
};

// ── Shot classification lives in the bigmodel order pipeline (single source ──
// ── of truth); this helper only resolves it for already-finished runs. ──
type OrderRunResult = Awaited<ReturnType<typeof bigmodelAdapter.orderPipeline.run>>;

function resolveShotClassification(result: OrderRunResult): ClassifiedShotResult {
  const classified = result.metadata?.classified as ClassifiedShotResult | undefined;
  if (classified?.responsibility) return classified;
  const raw = result.metadata?.raw as { code?: number; msg?: string } | undefined;
  if (raw) return classifyPreviewError(raw);
  return {
    outcome: classified?.outcome || 'error',
    code: classified?.code || 500,
    serverMsg: result.error || 'unknown error',
    rawServerMsg: result.error || 'unknown error',
    responsibility: { subject: '智谱/网络', target: '插件', cause: '未知服务端错误' },
  };
}

// ── In-memory ticket pool, backed by page sessionStorage ──
let _ticketPool: any[] = [];
let _ticketStoreReadyPromise: Promise<void> | null = null;

function ensureTicketStoreReady(): Promise<void> {
  if (_ticketStoreReadyPromise) return _ticketStoreReadyPromise;
  _ticketStoreReadyPromise = (async () => {
    try {
      const stored: any[] = await readPageTicketStore();
      const now = Date.now();
      _ticketPool = stored
        .filter((t: any) => now - t.createdAt < TICKET_TTL_MS)
        .sort((a: any, b: any) => a.createdAt - b.createdAt);
      if (_ticketPool.length > TICKET_POOL_MAX) {
        _ticketPool.splice(0, _ticketPool.length - TICKET_POOL_MAX);
      }
      writePageTicketStore();
    } catch {
      _ticketPool = [];
    }
  })();
  return _ticketStoreReadyPromise;
}

function readPageTicketStore(): Promise<any[]> {
  return new Promise((resolve) => {
    const reqId = Math.random().toString(36).slice(2);
    function handler(ev: MessageEvent) {
      if (ev.source !== window || !ev.data?.__miaosha || ev.data.type !== 'TICKET_STORE_DATA' || ev.data.reqId !== reqId) return;
      window.removeEventListener('message', handler);
      resolve(ev.data.list || []);
    }
    window.addEventListener('message', handler);
    window.postMessage({ __miaosha_cmd: true, type: 'READ_TICKET_STORE', reqId }, '*');
    setTimeout(() => {
      window.removeEventListener('message', handler);
      resolve([]);
    }, 800);
  });
}

function writePageTicketStore() {
  window.postMessage({ __miaosha_cmd: true, type: 'WRITE_TICKET_STORE', list: _ticketPool }, '*');
}

function clearPageTicketStore() {
  _ticketPool = [];
  window.postMessage({ __miaosha_cmd: true, type: 'CLEAR_TICKET_STORE' }, '*');
}

function isExtensionContextValid(): boolean {
  try {
    return !!(
      (chrome?.runtime?.id && chrome?.storage?.local) ||
      ((globalThis as any)?.browser?.runtime?.id && (globalThis as any)?.browser?.storage?.local)
    );
  } catch {
    return false;
  }
}

// ── Safe storage wrapper (module-scope so reminder helpers can use it) ────────
async function safeGet<T>(key: string): Promise<T | null> {
  if (!isExtensionContextValid()) return null;
  try { return await storage.getItem<T>(key); } catch { return null; }
}
async function safeSet(key: string, value: any): Promise<void> {
  if (!isExtensionContextValid()) return;
  try { await storage.setItem(key, value); } catch {}
}

// ── Platform adapter shared seams ────────────────────────────────────────────
const authStore = createAuthStore(true);

async function getFreshAuth(): Promise<PlatformAuth | null> {
  const captured = await bigmodelAdapter.authProbe.capture();
  if (captured && (await bigmodelAdapter.authProbe.isAuthenticated(captured))) {
    await authStore.set(captured);
    return captured;
  }
  const cached = authStore.get();
  if (cached && (await bigmodelAdapter.authProbe.isAuthenticated(cached))) {
    return cached;
  }
  return null;
}

// ── R3: Flash Sale Reminder ──────────────────────────────────────────────────

interface ReminderState {
  reminded: Record<string, boolean>;
  saleEpoch?: number;
}

async function getSaleConfig(): Promise<SaleTimeConfig> {
  try {
    if (!isExtensionContextValid()) return { ...SALE_TIME_DEFAULT };
    return await saleTimeStore.get();
  } catch {
    return { ...SALE_TIME_DEFAULT };
  }
}

async function syncCaptchaConfig(pushToOverlay = false) {
  if (!isExtensionContextValid()) return;
  try {
    const cfg = await captchaStore.get();
    const limit = Number(cfg.batchSessionLimit);
    if (limit > 0 && isFinite(limit)) {
      TICKET_POOL_MAX = Math.max(1, Math.round(limit));
      if (pushToOverlay) {
        postToOverlay({ type: 'CAPTCHA_CONFIG', data: { batchSessionLimit: TICKET_POOL_MAX } });
      }
    }
  } catch {
    // Extension context may have been invalidated; ignore.
  }
}

function getSalePhase(config: SaleTimeConfig): number | null {
  const now = Date.now();
  const sale = getNextSaleTime(config);
  const remaining = sale - now;
  if (remaining <= 0) return null;
  for (const minutesBefore of REMINDER_PHASE_MINUTES_ASC) {
    if (remaining <= minutesBefore * 60 * 1000) return minutesBefore;
  }
  return null;
}

function removeBanner() {
  const existing = document.getElementById('miaosha-flash-overlay');
  if (existing) existing.remove();
  if (bannerDismissTimer) {
    clearTimeout(bannerDismissTimer);
    bannerDismissTimer = null;
  }
}

function createOverlay(min: number) {
  removeBanner();

  const reminderText = min <= 5
    ? `🔥 距智谱秒杀还有 ${min} 分钟！请立刻录入验证码，越多越好`
    : `🔥 距智谱秒杀还有 ${min} 分钟`;
  const actionText = min <= 5 ? '去录入验证码' : '立即准备';

  const overlay = document.createElement('div');
  overlay.id = 'miaosha-flash-overlay';
  overlay.innerHTML = `
    <div style="
      position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
      background: linear-gradient(135deg, #dc2626, #ef4444);
      color: #fff; padding: 12px 20px; font-size: 15px;
      font-weight: 800; text-align: center;
      display: flex; align-items: center; justify-content: center; gap: 12px;
      box-shadow: 0 4px 20px rgba(220,38,38,0.4);
      animation: miaoshaPulse 1s ease-in-out infinite alternate;
      cursor: pointer; font-family: system-ui, -apple-system, sans-serif;
    ">
      <span>${reminderText}</span>
      <button id="miaosha-open-btn" style="
        background: #fff; color: #dc2626; border: none;
        padding: 5px 14px; border-radius: 20px; font-weight: 700;
        cursor: pointer; font-size: 13px;
      ">${actionText}</button>
    </div>
    <style>
      @keyframes miaoshaPulse {
        from { opacity: 0.85; transform: scale(1); }
        to { opacity: 1; transform: scale(1.01); }
      }
    </style>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).id === 'miaosha-open-btn') return;
    removeBanner();
  });
  document.getElementById('miaosha-open-btn')?.addEventListener('click', () => {
    removeBanner();
  });

  bannerDismissTimer = window.setTimeout(removeBanner, BANNER_AUTO_DISMISS_MS);
}

function playBeeps(count: number) {
  if (count <= 0) return;
  for (let i = 0; i < count; i++) {
    setTimeout(() => playBeep(), i * 350);
  }
}

function playBeep() {
  try {
    const audioCtx = new AudioContext();
    if (audioCtx.state === 'suspended') {
      audioCtx.close();
      return;
    }
    const buf = audioCtx.createBuffer(1, 44100, 44100);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.sin(2 * Math.PI * 880 * i / 44100) * 0.25;
    }
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx.destination);
    src.start();
    setTimeout(() => { src.stop(); audioCtx.close(); }, 200);
  } catch {}
}

function createReminderState(saleEpoch: number): ReminderState {
  return {
    reminded: Object.fromEntries(SALE_ALARM_MINUTES.map((minutesBefore) => [String(minutesBefore), false])),
    saleEpoch,
  };
}

async function loadReminderState(saleEpoch: number): Promise<ReminderState> {
  const defaultState = createReminderState(saleEpoch);
  const stored = await safeGet<ReminderState>('local:reminderState');
  if (!stored || stored.saleEpoch !== saleEpoch) return defaultState;
  return {
    ...defaultState,
    ...stored,
    reminded: {
      ...defaultState.reminded,
      ...(stored.reminded ?? {}),
    },
  };
}

async function saveReminderState(state: ReminderState) {
  await safeSet('local:reminderState', state);
}

async function checkAndRemind() {
  const config = await getSaleConfig();
  const saleEpoch = getNextSaleTime(config);
  const phase = getSalePhase(config);
  if (!phase) return;

  const state = await loadReminderState(saleEpoch);
  const key = String(phase);
  if (state.reminded[key]) return;

  createOverlay(phase);
  if (config.soundEnabled) {
    playBeeps(PHASE_BEEPS[phase] ?? 1);
  }

  state.reminded[key] = true;
  await saveReminderState(state);
}

async function initReminderLoop() {
  setInterval(checkAndRemind, 60_000);
  await checkAndRemind();
}
// ── End R3 ─────────────────────────────────────────────────────────────────

// ── Force-Stop Banner (shown during batch captcha mode) ────────────────────

function createForceStopBanner(options?: {
  getTicketCount?: () => Promise<number>;
  onFire?: () => void;
}) {
  removeForceStopBanner();
  const el = document.createElement('div');
  el.id = 'miaosha-force-stop-banner';
  el.innerHTML = `
    <div style="
      position: fixed; top: 0; left: 0; right: 0; z-index: 2147483647;
      background: linear-gradient(135deg, #dc2626, #ef4444);
      color: #fff; padding: 10px 20px; font-size: 14px;
      font-weight: 800; text-align: center;
      display: flex; align-items: center; justify-content: center; gap: 10px;
      box-shadow: 0 4px 20px rgba(220,38,38,0.4);
      animation: miaoshaPulse 1s ease-in-out infinite alternate;
      font-family: system-ui, -apple-system, sans-serif;
    ">
      <span style="
        font-size: 10px; font-weight: 800; color: #fff;
        background: rgba(0,0,0,0.35); padding: 2px 8px;
        border-radius: 999px; line-height: 1;
        border: 1px solid rgba(255,255,255,0.4);
      ">v${chrome.runtime.getManifest().version}</span>
      <span id="miaosha-banner-wave" style="
        font-size: 12px; font-weight: 800; color: #fff; background: #6366f1;
        padding: 3px 10px; border-radius: 999px; line-height: 1;
      ">Wave 1</span>
      <span>&#9632; Batch Mode Active — solving captchas</span>
      <button id="miaosha-batch-fire-btn" style="
        display: inline-flex; align-items: center; gap: 5px;
        padding: 5px 12px; border: 2px solid #3f6212;
        background: #a3e635; color: #14532d; border-radius: 6px;
        font-size: 13px; font-weight: 900; cursor: pointer; line-height: 1;
        box-shadow: 0 0 0 2px rgba(163,230,53,.45), 0 4px 10px rgba(0,0,0,.2);
        animation: fvBtnPulse 1.2s ease-in-out infinite alternate;
      " disabled title="串行模式：按 Strike Interval 顺序发射，遇到 555 自动等待，节奏稳。">
        &#9889; Fire 串行 (<span id="miaosha-batch-fire-count">0</span>)
      </button>
      <kbd style="
        padding: 2px 8px; background: rgba(255,255,255,0.25);
        border: 1px solid rgba(255,255,255,0.5); border-radius: 4px;
        font-size: 12px; font-weight: 700; font-family: monospace;
      ">Esc</kbd>
      <span>to force stop</span>
    </div>
    <style>
      @keyframes miaoshaPulse {
        from { opacity: 0.85; transform: scale(1); }
        to { opacity: 1; transform: scale(1.01); }
      }
      @keyframes fvBtnPulse {
        from { box-shadow: 0 0 0 2px rgba(163,230,53,.45), 0 4px 10px rgba(0,0,0,.2); }
        to { box-shadow: 0 0 0 6px rgba(163,230,53,.65), 0 6px 14px rgba(0,0,0,.25); }
      }
    </style>
  `;
  document.body.appendChild(el);

  bannerWaveCount = 0;
  updateBannerWaveBadge();

  const fireBtn = document.getElementById('miaosha-batch-fire-btn') as HTMLButtonElement | null;
  const fireCountEl = document.getElementById('miaosha-batch-fire-count');

  if (options?.onFire && fireBtn) {
    fireBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      options.onFire!();
    });
  }

  if (options?.getTicketCount && fireCountEl && fireBtn) {
    async function updateCount() {
      try {
        const count = await options.getTicketCount!();
        fireCountEl.textContent = String(count);
        const disabled = count === 0;
        fireBtn.disabled = disabled;
        fireBtn.style.cursor = disabled ? 'not-allowed' : 'pointer';
        fireBtn.style.opacity = disabled ? '0.55' : '1';
        fireBtn.style.animation = disabled ? 'none' : '';
      } catch {
        fireCountEl.textContent = '0';
        fireBtn.disabled = true;
        fireBtn.style.cursor = 'not-allowed';
        fireBtn.style.opacity = '0.55';
        fireBtn.style.animation = 'none';
      }
    }
    updateCount();
    const timer = window.setInterval(updateCount, 1000);
    el.dataset.countTimer = String(timer);
  }
}

function removeForceStopBanner() {
  const el = document.getElementById('miaosha-force-stop-banner');
  if (el) {
    const timer = Number(el.dataset.countTimer);
    if (timer) clearInterval(timer);
    el.remove();
  }
}

let bannerWaveCount = 0;

function updateBannerWaveBadge() {
  const badge = document.getElementById('miaosha-banner-wave');
  if (badge) badge.textContent = 'Wave ' + bannerWaveCount;
}

function postToOverlay(msg: any) {
  window.postMessage({ __miaosha_overlay: true, ...msg }, '*');
}

function tokenSuffix(authz: string | undefined): string {
  if (!authz || typeof authz !== 'string') return '';
  const raw = authz.replace(/^Bearer\s+/i, '');
  return raw.slice(-6);
}

function maskTicket(ticket: string): string {
  if (!ticket || typeof ticket !== 'string') return '';
  if (ticket.length <= 8) return ticket;
  return 'tk_…' + ticket.slice(-4);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default defineContentScript({
  matches: ['*://*.bigmodel.cn/*'],
  runAt: 'document_idle',

  async main() {
    // Inject MAIN world script
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('/bm-main.js');
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);

    async function getPrefireAuthStatus(): Promise<
      | { ok: false; reason: string }
      | {
          ok: true;
          auth: PlatformAuth;
          source: string;
          capturedAt: number;
          ageMs: number;
          org: string;
          project: string;
          tokenSuffix: string;
        }
    > {
      const auth = await getFreshAuth();
      if (!auth || !(await bigmodelAdapter.authProbe.isAuthenticated(auth))) {
        return {
          ok: false,
          reason: 'missing-auth',
        };
      }

      const capturedAt = typeof auth.capturedAt === 'number' ? auth.capturedAt : Date.now();
      const source = (auth.metadata?.source as string) || 'cache';
      return {
        ok: true,
        auth,
        source: source === 'live-page' ? 'live-page' : 'storage-fallback',
        capturedAt,
        ageMs: Math.max(0, Date.now() - capturedAt),
        org: auth.headers['bigmodel-organization'],
        project: auth.headers['bigmodel-project'],
        tokenSuffix: tokenSuffix(auth.headers.authorization),
      };
    }

    // NOTE: batch-preview is intentionally fetched only from the MAIN world
    // using the page's original uninstrumented fetch. The content script no
    // longer requests this endpoint because Alibaba WAF blocks any request
    // originating from the extension's isolated world.

    chrome.storage.onChanged.addListener(async (changes, area) => {
      if (area === 'local' && changes['captchaConfig']) {
        syncCaptchaConfig(true);
      }
    });

    // ── Helper: get current valid ticket count / list ──
    async function getTicketInfo() {
      await ensureTicketStoreReady();
      const now = Date.now();
      _ticketPool = _ticketPool.filter((t: any) => now - t.createdAt < TICKET_TTL_MS);
      const tickets = _ticketPool.map((t: any) => {
        const remainingMs = Math.max(0, TICKET_TTL_MS - (now - t.createdAt));
        return {
          ticket: t.ticket,
          randstr: t.randstr,
          createdAt: t.createdAt,
          remainingMs,
          expired: false,
        };
      });
      return { count: tickets.length, tickets };
    }

    async function getLaunchSnapshot() {
      await ensureTicketStoreReady();
      const now = Date.now();
      const valid = _ticketPool.filter((t: any) => now - t.createdAt < TICKET_TTL_MS);
      const selData = await safeGet<any>('local:selectedProducts');
      const targets: StrikeTarget[] = (selData?.priorityList || [])
        .filter((item: any) => item && item.productId)
        .slice(0, 3)
        .map((item: any, idx: number) => ({ productId: String(item.productId), priority: idx + 1 }));
      let fireConfig: FireConfig;
      try {
        fireConfig = isExtensionContextValid() ? await fireStore.get() : { ...FIRE_CONFIG_DEFAULT };
      } catch {
        fireConfig = { ...FIRE_CONFIG_DEFAULT };
      }
      return { valid, targets, fireConfig };
    }

    async function getAutoFireSnapshot() {
      await ensureTicketStoreReady();
      const now = Date.now();
      const valid = _ticketPool.filter((t: any) => now - t.createdAt < TICKET_TTL_MS);
      const selData = await safeGet<any>('local:selectedProducts');
      const selectedIds: string[] = (selData?.priorityList || [])
        .filter((item: any) => item && item.productId)
        .slice(0, 3)
        .map((item: any) => String(item.productId));
      return { valid, selectedIds };
    }

    // ── Poll payment status ──
    async function pollPayCheck(
      auth: PlatformAuth,
      bizId: string,
      onUpdate: (status: 'SUCCESS' | 'EXPIRE' | 'timeout') => void,
    ) {
      const authorization = auth.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
      const MAX_MS = 5 * 60 * 1000;
      const INTERVAL_MS = 1500;
      const start = Date.now();
      while (Date.now() - start < MAX_MS) {
        try {
          const res = await xhrRequest<{ code?: number; data?: { status?: string } | string }>({
            method: 'GET',
            url: `https://bigmodel.cn/api/biz/pay/check?bizId=${encodeURIComponent(bizId)}`,
            withCredentials: true,
            headers: {
              Accept: 'application/json, text/plain, */*',
              Authorization: authorization,
              'Bigmodel-Organization': auth.headers['bigmodel-organization'],
              'Bigmodel-Project': auth.headers['bigmodel-project'],
            },
          });
          const data = res.data;
          const status = data?.data?.status ?? data?.data;
          if (status === 'SUCCESS' || status === 'success' || status === true || data?.code === 200) {
            onUpdate('SUCCESS');
            return;
          }
          if (status === 'EXPIRE' || status === 'expire' || status === 'FAILED' || status === 'failed') {
            onUpdate('EXPIRE');
            return;
          }
        } catch {}
        await sleep(INTERVAL_MS);
      }
      onUpdate('timeout');
    }

    // In-memory only: the overlay consumes PAYMENT_STATE via postMessage;
    // no persisted copy is read anywhere.
    let lastPaymentState: any = null;
    function updatePaymentState(patch: any) {
      lastPaymentState = { ...(lastPaymentState || {}), ...patch, updatedAt: Date.now() };
      postToOverlay({ type: 'PAYMENT_STATE', data: lastPaymentState });
    }

    // ── Smart Fire Controller ────────────────────────────────────────────────
    let currentSmartFire: {
      evaluate: (event: FireEvent) => void;
      stop: () => void;
    } | null = null;

    const pendingPageFetches: Record<
      string,
      { resolve: (value: any) => void; reject: (reason?: any) => void }
    > = {};

    function pageFetch<T = unknown>(opts: {
      method?: string;
      url: string;
      headers?: Record<string, string>;
      body?: string;
    }): Promise<{ status: number; statusText: string; headers: Record<string, string>; data: T }> {
      return new Promise((resolve, reject) => {
        const reqId = Math.random().toString(36).slice(2);
        pendingPageFetches[reqId] = { resolve, reject };
        window.postMessage(
          {
            __miaosha_cmd: true,
            type: 'PAGE_FETCH_REQUEST',
            reqId,
            method: opts.method || 'GET',
            url: opts.url,
            headers: opts.headers || {},
            body: opts.body || null,
          },
          '*',
        );
        setTimeout(() => {
          if (pendingPageFetches[reqId]) {
            delete pendingPageFetches[reqId];
            reject(new Error('page fetch timeout'));
          }
        }, 15000);
      });
    }

    async function runSmartFire(startMs: number, reason: string, auth: PlatformAuth) {
      const { valid, targets, fireConfig } = await getLaunchSnapshot();
      if (valid.length === 0) {
        postToOverlay({ type: 'FIRE_RESULT', line: '> No valid tickets' });
        return;
      }
      if (targets.length === 0) {
        postToOverlay({ type: 'FIRE_RESULT', line: '> No products selected' });
        return;
      }

      const mode: 'auto' | 'manual' = reason === 'auto' ? 'auto' : 'manual';
      let nextSaleTime = startMs + 10;
      if (mode === 'auto') {
        try {
          const cfg = await getSaleConfig();
          nextSaleTime = getNextSaleTime(cfg);
        } catch {
          // keep fallback
        }
      }

      const selectedIds = targets
        .slice()
        .sort((a: StrikeTarget, b: StrikeTarget) => a.priority - b.priority)
        .map((t: StrikeTarget) => t.productId);

      const serverOffsetMs = (typeof window !== 'undefined' && (window as any).__bm_serverOffset) || 0;
      const minIntervalMs = Math.max(
        SMART_FIRE_MIN_INTERVAL_MS,
        Math.round(Number(fireConfig.burstIntervalMs)) || SMART_FIRE_MIN_INTERVAL_MS,
      );

      let state: SmartFireState = {
        tickets: valid.map((t: any) => ({
          ticket: String(t.ticket),
          randstr: String(t.randstr || ''),
          provider: 'tencent-captcha',
          createdAt: Number(t.createdAt),
        })),
        selectedIds,
        budgetLeft: SMART_FIRE_BUDGET_DEFAULT,
        shotsFired: 0,
        lastShotAt: 0,
        stockOpen: false,
        serverOffsetMs,
        nextSaleTime,
        minIntervalMs,
        mode,
      };

      postToOverlay({
        type: 'FIRE_RESULT',
        line: `> Smart fire ${mode} · budget=${state.budgetLeft} · offset=${serverOffsetMs}ms`,
      });
      postToOverlay({
        type: 'FIRE_BATCH_START',
        data: {
          queue: [],
          totalShots: state.budgetLeft,
          startMs: Date.now(),
          mode,
          burstIntervalMs: minIntervalMs,
        },
      });

      let timer: ReturnType<typeof setTimeout> | null = null;
      let stopped = false;

      function stop(reason: string) {
        if (stopped) return;
        stopped = true;
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        if (currentSmartFire === controller) {
          currentSmartFire = null;
        }
        postToOverlay({ type: 'FIRE_RESULT', line: '> Smart fire stopped: ' + reason });
        postToOverlay({ type: 'BURST_FIRE_DEPLETED', data: { total: state.shotsFired } });
      }

      function removeTicketFromPool(ticket: { ticket: string; randstr?: string; createdAt: number }) {
        _ticketPool = _ticketPool.filter(
          (t: any) => !(t.ticket === ticket.ticket && t.randstr === ticket.randstr && t.createdAt === ticket.createdAt),
        );
        writePageTicketStore();
      }

      async function executeShot(shot: FireShot) {
        const idx = state.shotsFired;
        const tag = '>[#' + (idx + 1) + '][P1] ' + shot.productId.slice(-6);
        const t1 = Date.now();

        try {
          const res = await pageFetch<{
            code: number;
            msg?: string;
            data?: {
              bizId?: string;
              productId?: string;
              thirdPartyAmount?: number;
              payAmount?: number;
              qrCode?: string;
              soldOut?: boolean;
            };
          }>({
            method: 'POST',
            url: 'https://bigmodel.cn/api/biz/pay/preview',
            headers: {
              Accept: 'application/json, text/plain, */*',
              'Content-Type': 'application/json;charset=utf-8',
            },
            body: JSON.stringify({
              productId: shot.productId,
              invitationCode: '',
              ticket: shot.ticket.ticket,
              randstr: shot.ticket.randstr || '',
            }),
          });
          const rtt = Date.now() - t1;
          const body = res.data;

          if (res.status === 405) {
            postToOverlay({ type: 'FIRE_RESULT', line: tag + ': WAF 405 BLOCKED (' + rtt + 'ms)' });
            postToOverlay({ type: 'FIRE_SHOT_RESULT', data: { shotIdx: idx, productId: shot.productId, priority: 1, outcome: 'waf405', code: 405, rtt, sentAt: t1, ticketMask: maskTicket(shot.ticket.ticket), serverMsg: 'WAF block' } });
            evaluate({ kind: 'RESULT', outcome: 'waf405', now: Date.now() });
            return;
          }

          if (body?.code === 200 && body.data && !body.data.soldOut && body.data.bizId) {
            const session = body.data;
            const ps = {
              bizId: String(session.bizId),
              amount: session.thirdPartyAmount ?? session.payAmount ?? 0,
              productId: String(session.productId || shot.productId),
              qrCode: session.qrCode || null,
              payType: fireConfig.payType,
              status: 'pending' as const,
              updatedAt: Date.now(),
            };
            removeTicketFromPool(shot.ticket);
            updatePaymentState(ps);
            postToOverlay({ type: 'BURST_FIRE_SUCCESS', data: ps });
            postToOverlay({ type: 'FIRE_RESULT', line: tag + ': ORDER bizId=' + ps.bizId + ' (' + rtt + 'ms)' });
            postToOverlay({ type: 'FIRE_SHOT_RESULT', data: { shotIdx: idx, productId: shot.productId, priority: 1, outcome: 'success', code: 200, rtt, sentAt: t1, bizId: ps.bizId, ticketMask: maskTicket(shot.ticket.ticket), serverMsg: '' } });
            void pollPayCheck(auth, ps.bizId, (status) => {
              if (status === 'SUCCESS') {
                updatePaymentState({ status: 'success' });
                postToOverlay({ type: 'STRIKE_PAYMENT_SUCCESS', data: { bizId: ps.bizId, orderId: ps.bizId } });
                postToOverlay({ type: 'FIRE_RESULT', line: '> Payment confirmed bizId=' + ps.bizId.slice(-8) });
              } else if (status === 'EXPIRE') {
                updatePaymentState({ status: 'expired' });
                postToOverlay({ type: 'STRIKE_PAYMENT_EXPIRED', data: { bizId: ps.bizId, orderId: ps.bizId } });
                postToOverlay({ type: 'FIRE_RESULT', line: '> Payment expired bizId=' + ps.bizId.slice(-8) });
              } else {
                updatePaymentState({ status: 'timeout' });
                postToOverlay({ type: 'STRIKE_PAYMENT_TIMEOUT', data: { bizId: ps.bizId, orderId: ps.bizId } });
                postToOverlay({ type: 'FIRE_RESULT', line: '> Payment status timeout bizId=' + ps.bizId.slice(-8) });
              }
            });
            evaluate({ kind: 'RESULT', outcome: 'success', now: Date.now() });
            return;
          }

          if (body?.code === 200 && body.data?.soldOut) {
            postToOverlay({ type: 'FIRE_RESULT', line: tag + ': sold-out today (' + rtt + 'ms)' });
            postToOverlay({ type: 'FIRE_SHOT_RESULT', data: { shotIdx: idx, productId: shot.productId, priority: 1, outcome: 'soldout', code: 200, rtt, sentAt: t1, ticketMask: maskTicket(shot.ticket.ticket), serverMsg: body.msg || 'sold out' } });
            evaluate({ kind: 'RESULT', outcome: 'soldout', now: Date.now() });
            return;
          }

          const classified = classifyPreviewError(body || { code: res.status });
          if (classified.outcome === 'busy') {
            postToOverlay({ type: 'FIRE_RESULT', line: tag + ': server-busy-555 (' + rtt + 'ms)' });
            postToOverlay({ type: 'FIRE_SHOT_RESULT', data: { shotIdx: idx, productId: shot.productId, priority: 1, outcome: 'busy', code: classified.code, rtt, sentAt: t1, ticketMask: maskTicket(shot.ticket.ticket), serverMsg: classified.serverMsg } });
            evaluate({ kind: 'RESULT', outcome: 'busy', now: Date.now() });
            return;
          }
          if (classified.outcome === 'captchaInvalid') {
            postToOverlay({ type: 'FIRE_RESULT', line: tag + ': captcha-invalid (' + rtt + 'ms)' });
            postToOverlay({ type: 'FIRE_SHOT_RESULT', data: { shotIdx: idx, productId: shot.productId, priority: 1, outcome: 'captchaInvalid', code: classified.code, rtt, sentAt: t1, ticketMask: maskTicket(shot.ticket.ticket), serverMsg: classified.serverMsg } });
            evaluate({ kind: 'RESULT', outcome: 'captchaInvalid', now: Date.now() });
            return;
          }

          postToOverlay({ type: 'FIRE_RESULT', line: tag + ': ' + classified.outcome + ' (' + rtt + 'ms)' });
          postToOverlay({ type: 'FIRE_SHOT_RESULT', data: { shotIdx: idx, productId: shot.productId, priority: 1, outcome: classified.outcome, code: classified.code, rtt, sentAt: t1, ticketMask: maskTicket(shot.ticket.ticket), serverMsg: classified.serverMsg, rawServerMsg: classified.rawServerMsg, responsibility: classified.responsibility } });
          evaluate({ kind: 'RESULT', outcome: 'error', now: Date.now() });
        } catch (e: any) {
          const cls = classifyNetworkError(e?.message || 'unknown');
          const rtt = Date.now() - t1;
          postToOverlay({ type: 'FIRE_RESULT', line: tag + ': net-err: ' + cls.rawServerMsg });
          postToOverlay({ type: 'FIRE_SHOT_RESULT', data: { shotIdx: idx, productId: shot.productId, priority: 1, outcome: cls.outcome, code: cls.code, rtt, sentAt: t1, ticketMask: maskTicket(shot.ticket.ticket), serverMsg: cls.serverMsg, rawServerMsg: cls.rawServerMsg, responsibility: cls.responsibility } });
          evaluate({ kind: 'RESULT', outcome: 'error', now: Date.now() });
        }
      }

      function scheduleEvaluate(at: number) {
        if (stopped) return;
        const delay = Math.max(0, at - Date.now());
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => {
          timer = null;
          evaluate({ kind: 'TICK', now: Date.now() });
        }, delay);
      }

      function evaluate(event: FireEvent) {
        if (stopped) return;
        const decision = nextDecision(state, event);
        state = decision.nextState;

        if (decision.action === 'stop') {
          stop(decision.reason);
          return;
        }

        if (decision.action === 'fire' && decision.shot) {
          void executeShot(decision.shot);
          return;
        }

        let nextAt = Date.now() + 100;
        const minInterval = state.minIntervalMs ?? SMART_FIRE_MIN_INTERVAL_MS;
        if (state.mode === 'auto') {
          const fireAt = state.nextSaleTime - state.serverOffsetMs - 10;
          if (!state.stockOpen && fireAt > Date.now()) {
            nextAt = fireAt;
          } else if (state.shotsFired > 0) {
            nextAt = state.lastShotAt + minInterval;
          }
        } else {
          if (state.shotsFired > 0) {
            nextAt = state.lastShotAt + minInterval;
          }
        }
        scheduleEvaluate(nextAt);
      }

      const controller = { evaluate, stop };
      currentSmartFire = controller;
      evaluate({ kind: 'TICK', now: Date.now() });
    }

    async function prefireAndBurst(startMs: number, reason: string) {
      const authStatus = await getPrefireAuthStatus();
      if (!authStatus.ok) {
        postToOverlay({ type: 'PREFIRE_STATUS', data: { ok: false, reason: authStatus.reason, fireReason: reason } });
        postToOverlay({ type: 'FIRE_RESULT', line: '> Prefire blocked: auth unavailable' });
        return;
      }

      postToOverlay({
        type: 'PREFIRE_STATUS',
        data: {
          ok: true,
          source: authStatus.source,
          capturedAt: authStatus.capturedAt,
          ageMs: authStatus.ageMs,
          tokenSuffix: authStatus.tokenSuffix,
          org: authStatus.org,
          project: authStatus.project,
          fireReason: reason,
        },
      });

      bannerWaveCount++;
      updateBannerWaveBadge();

      // All non-auto triggers use the same smart-fire path; the old BURST 200ms mode is removed.
      await runSmartFire(startMs, reason === 'auto' ? 'auto' : 'manual', authStatus.auth);
    }

    // ── Listen for messages from MAIN world script ──
    window.addEventListener('message', async (event) => {
      if (event.source !== window) return;

      // From overlay (MAIN world) — commands
      if (event.data?.__miaosha_cmd) {
        if (event.data.type === 'GET_TICKET_COUNT') {
          const info = await getTicketInfo();
          postToOverlay({ type: 'TICKET_COUNT', count: info.count, tickets: info.tickets });
        }
        if (event.data.type === 'PREFIRE_FIRE') {
          const startMs: number = (event.data.data?.startMs) ?? Date.now();
          const reason: string = event.data.data?.reason ?? 'prefire-fire';
          prefireAndBurst(startMs, reason);
        }
        if (event.data.type === 'GET_SALE_TIME') {
          const cfg = await getSaleConfig();
          const nst = getNextSaleTime(cfg);
          postToOverlay({ type: 'SALE_TIME_CONFIG', data: { config: cfg, nextSaleTime: nst } });
        }
        if (event.data.type === 'GET_FIRE_CONFIG') {
          try {
            const cfg = isExtensionContextValid() ? await fireStore.get() : { ...FIRE_CONFIG_DEFAULT };
            postToOverlay({ type: 'FIRE_CONFIG', data: cfg });
          } catch {
            postToOverlay({ type: 'FIRE_CONFIG', data: { ...FIRE_CONFIG_DEFAULT } });
          }
        }
        if (event.data.type === 'SET_FIRE_CONFIG' && event.data.data) {
          const incoming = event.data.data;
          let current: FireConfig;
          try {
            current = isExtensionContextValid() ? await fireStore.get() : { ...FIRE_CONFIG_DEFAULT };
          } catch {
            current = { ...FIRE_CONFIG_DEFAULT };
          }
          const next: FireConfig = {
            payType: incoming.payType === 'WE_CHAT' ? 'WE_CHAT' : 'ALI',
            burstIntervalMs: Number.isFinite(Number(incoming.burstIntervalMs))
              ? Math.max(2100, Math.round(Number(incoming.burstIntervalMs)))
              : current.burstIntervalMs,
          };
          try {
            if (isExtensionContextValid()) await fireStore.set(next);
          } catch {}
          postToOverlay({ type: 'FIRE_CONFIG', data: next });
        }
        if (event.data.type === 'OPEN_OPTIONS_PAGE') {
          try { chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS_PAGE' }); } catch {}
        }
        if (event.data.type === 'CLEAR_TICKET_POOL') {
          clearPageTicketStore();
          const info = await getTicketInfo();
          postToOverlay({ type: 'TICKET_COUNT', count: info.count, tickets: info.tickets });
        }
        if (event.data.type === 'PAGE_FETCH_RESPONSE' && event.data.reqId) {
          const pending = pendingPageFetches[event.data.reqId];
          if (pending) {
            delete pendingPageFetches[event.data.reqId];
            if (event.data.ok === false) {
              pending.reject(new Error(event.data.error || 'page fetch failed'));
            } else {
              pending.resolve({
                status: event.data.status,
                statusText: event.data.statusText,
                headers: event.data.headers || {},
                data: (() => {
                  try {
                    return JSON.parse(event.data.bodyText);
                  } catch {
                    return event.data.bodyText;
                  }
                })(),
              });
            }
          }
        }
      }

      // From XHR interceptor (MAIN world) — events
      if (!event.data?.__miaosha) return;
      const { type, payload } = event.data;

      if (type === 'PRODUCT_SELECTION_CHANGED' && payload) {
        await safeSet('local:selectedProducts', payload);
      }

      if (type === 'CAPTCHA_PRODUCED' && payload?.ticket) {
        await ensureTicketStoreReady();
        if (!_ticketPool.some((t: any) => t.ticket === payload.ticket)) {
          const now = Date.now();
          _ticketPool.push({ ticket: payload.ticket, randstr: payload.randstr, createdAt: now });
          _ticketPool = _ticketPool
            .filter((t: any) => now - t.createdAt < TICKET_TTL_MS)
            .sort((a: any, b: any) => a.createdAt - b.createdAt);
          if (_ticketPool.length > TICKET_POOL_MAX) {
            _ticketPool.splice(0, _ticketPool.length - TICKET_POOL_MAX);
          }
          writePageTicketStore();
        }
        const info = await getTicketInfo();
        postToOverlay({ type: 'TICKET_COUNT', count: info.count, tickets: info.tickets });
      }

      if (type === 'CAPTCHA_ERROR' && payload) {
        postToOverlay({ type: 'FIRE_RESULT', line: '> Captcha error: ' + payload.msg });
      }

      if (type === 'STOCK_FLIP' && payload?.productIds?.length) {
        if (currentSmartFire) {
          currentSmartFire.evaluate({
            kind: 'STOCK_FLIP',
            now: payload.localNowMs || Date.now(),
          });
        }
      }

      if (type === 'BATCH_MODE_STATUS') {
        if (payload?.active) {
          createForceStopBanner({
            getTicketCount: async () => (await getTicketInfo()).count,
            onFire: () => prefireAndBurst(Date.now(), 'batch-banner'),
          });
        } else {
          removeForceStopBanner();
        }
      }
    });

    // Initial overlay sync
    setTimeout(async () => {
      try {
        const info = await getTicketInfo();
        postToOverlay({ type: 'TICKET_COUNT', count: info.count, tickets: info.tickets });
        const cfg = await getSaleConfig();
        const nst = getNextSaleTime(cfg);
        postToOverlay({ type: 'SALE_TIME_CONFIG', data: { config: cfg, nextSaleTime: nst } });
        await syncCaptchaConfig(true);
      } catch {}
    }, 2000);

    // R3: Start flash sale reminder loop
    initReminderLoop();
  },
});
