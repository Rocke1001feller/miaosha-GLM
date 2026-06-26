// ISOLATED world content script for bigmodel.cn
// Injects MAIN world XHR interceptor and relays payment/ticket data to WXT storage
// Also implements R3: Tab Audio+Visual reminder when user is on bigmodel.cn
import { storage } from '#imports';
import { buildAutoFirePlan, type AutoFirePlanShot } from '../lib/api/fire-plan';
import { buildStrikeQueue, type StrikeShot, type StrikeTarget } from '../lib/api/strike-plan';
import {
  removeStrikeReservations,
  restoreUnusedStrikeReservations,
  strikeTicketKey,
  type StrikeReservationTicket,
} from '../lib/api/strike-reservation';
import { calibrate } from '../lib/api/runtime-calibration';
import { fireStore, FIRE_CONFIG_DEFAULT, type FireConfig } from '../lib/settings/fire';
import { SALE_ALARM_MINUTES, SALE_TIME_DEFAULT, getNextSaleTime, saleTimeStore, type SaleTimeConfig } from '../lib/settings/sale-time';
import { captchaStore } from '../lib/settings/captcha';
import { bigmodelAdapter } from '../lib/platform';
import type { PlatformAuth } from '../lib/platform';
import { createAuthStore } from '../lib/platform/shared/stores';
import { xhrRequest } from '../lib/platform/adapters/bigmodel/request';

const RUNTIME_CALIBRATION_KEY = 'local:runtimeCalibration';
const TICKET_TTL_MS = 5 * 60 * 1000; // alpha: 5 minutes per-ticket lifecycle
let TICKET_POOL_MAX = 100; // synced with captchaConfig.batchSessionLimit (single source of truth)
const REMINDER_PHASE_MINUTES_ASC = [...SALE_ALARM_MINUTES].sort((a, b) => a - b);

const CALIBRATION_FAST_WINDOW_MS = 10 * 60 * 1000;
const CALIBRATION_NORMAL_WINDOW_MS = 60 * 60 * 1000;
const CALIBRATION_FAST_INTERVAL_MS = 60 * 1000;
const CALIBRATION_NORMAL_INTERVAL_MS = 3 * 60 * 1000;
const CALIBRATION_IDLE_INTERVAL_MS = 10 * 60 * 1000;
const EARLY_FIRE_BOUNDARY_MS = 5 * 60 * 1000; // T-5 hard stop for sold-out watcher / early-fire
const BANNER_AUTO_DISMISS_MS = 3 * 60 * 1000; // R3 flash banner auto-dismiss after 3 min

let bannerDismissTimer: number | null = null;

interface RuntimeCalibrationSnapshot {
  latencyMs: number;
  clockOffsetMs: number;
  sampleCount: number;
  calibratedAt: number;
  reason: string;
}

const PHASE_BEEPS: Record<number, number> = {
  60: 1,
  30: 1,
  15: 1,
  10: 3,
   5: 4,
};

// ── /pay/preview response classification: subject -> target -> cause ──
interface ErrorResponsibility {
  subject: string;
  target: string;
  cause: string;
}

interface ClassifiedShotResult {
  outcome:
    | 'success'
    | 'soldout'
    | 'busy'
    | 'error'
    | 'neterr'
    | 'captchaService'
    | 'captchaInvalid'
    | 'captchaRisk';
  code: number;
  serverMsg: string;
  rawServerMsg: string;
  responsibility: ErrorResponsibility;
}

function classifyPreviewError(body: { code?: number; msg?: string }): ClassifiedShotResult {
  const code = body.code ?? 500;
  const raw = body.msg || '';

  if (code === 500 && raw.includes('验证码校验服务异常')) {
    return {
      outcome: 'captchaService',
      code,
      serverMsg: '【智谱 --> 腾讯验证码核销：超过了《每秒并发请求量（QPS）限制》】' + raw,
      rawServerMsg: raw,
      responsibility: { subject: '智谱', target: '腾讯验证码核销', cause: '超过了《每秒并发请求量（QPS）限制》' },
    };
  }
  if (code === 500 && raw.includes('验证码Ticket不合法')) {
    return {
      outcome: 'captchaInvalid',
      code,
      serverMsg: '【插件/用户 --> 腾讯验证码核销：ticket 无效或已过期】' + raw,
      rawServerMsg: raw,
      responsibility: { subject: '插件/用户', target: '腾讯验证码核销', cause: 'ticket 无效或已过期' },
    };
  }
  if (code === 500 && raw.includes('验证存在安全风险')) {
    return {
      outcome: 'captchaRisk',
      code,
      serverMsg: '【腾讯验证码风控 --> 当前请求：环境存在安全风险】' + raw,
      rawServerMsg: raw,
      responsibility: { subject: '腾讯验证码风控', target: '当前请求', cause: '环境存在安全风险' },
    };
  }
  if (code === 555 || raw.toLowerCase().includes('system busy')) {
    return {
      outcome: 'busy',
      code,
      serverMsg: '【智谱 --> 当前用户：2 秒滑动窗口限流】' + raw,
      rawServerMsg: raw,
      responsibility: { subject: '智谱', target: '当前用户', cause: '2 秒滑动窗口限流' },
    };
  }
  return {
    outcome: 'error',
    code,
    serverMsg: '【智谱/网络 --> 插件：未知服务端错误】' + raw,
    rawServerMsg: raw,
    responsibility: { subject: '智谱/网络', target: '插件', cause: '未知服务端错误' },
  };
}

function neterrResponsibility(message: string): ClassifiedShotResult {
  return {
    outcome: 'neterr',
    code: 0,
    serverMsg: '【插件/网络 --> 智谱：请求失败】' + message,
    rawServerMsg: message,
    responsibility: { subject: '插件/网络', target: '智谱', cause: '请求失败' },
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

function normalizeAuthHeaders(auth: PlatformAuth | null): any {
  if (!auth) return null;
  const authorization = auth.headers.authorization?.replace(/^Bearer\s+/i, '') || '';
  return {
    authorization,
    bigmodelOrganization: auth.headers['bigmodel-organization'],
    bigmodelProject: auth.headers['bigmodel-project'],
    capturedAt: auth.capturedAt,
    source: (auth.metadata?.source as string) || 'cache',
  };
}

function coerceToPlatformAuth(auth: any): PlatformAuth | null {
  if (!auth) return null;
  if (auth.platform === 'bigmodel' && auth.headers?.authorization) {
    return auth as PlatformAuth;
  }
  if (auth.authorization && auth.bigmodelOrganization && auth.bigmodelProject) {
    return {
      platform: 'bigmodel',
      capturedAt: auth.capturedAt || Date.now(),
      headers: {
        authorization: String(auth.authorization).replace(/^Bearer\s+/i, ''),
        'bigmodel-organization': auth.bigmodelOrganization,
        'bigmodel-project': auth.bigmodelProject,
      },
      metadata: { source: auth.source || 'cache' },
    };
  }
  return null;
}

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
  onBurst?: () => void;
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
      " disabled title="串行模式：按 Strike Interval 顺序发射，遇到 555 自动退避，节奏稳。">
        &#9889; Fire 串行 (<span id="miaosha-batch-fire-count">0</span>)
      </button>
      <button id="miaosha-batch-burst-btn" style="
        display: inline-flex; align-items: center; gap: 5px;
        padding: 5px 12px; border: 2px solid #92400e;
        background: #f59e0b; color: #78350f; border-radius: 6px;
        font-size: 13px; font-weight: 900; cursor: pointer; line-height: 1;
        box-shadow: 0 0 0 2px rgba(245,158,11,.45), 0 4px 10px rgba(0,0,0,.2);
        animation: fvBtnPulseAmber 1.2s ease-in-out infinite alternate;
      " disabled title="并发模式：固定 200ms 间隔快速齐射，忽略 555 退避，火力密度高。">
        &#9889; BURST 并发 (<span id="miaosha-batch-burst-count">0</span>) · 200ms
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
      @keyframes fvBtnPulseAmber {
        from { box-shadow: 0 0 0 2px rgba(245,158,11,.45), 0 4px 10px rgba(0,0,0,.2); }
        to { box-shadow: 0 0 0 6px rgba(245,158,11,.65), 0 6px 14px rgba(0,0,0,.25); }
      }
    </style>
  `;
  document.body.appendChild(el);

  bannerWaveCount = 0;
  updateBannerWaveBadge();

  const fireBtn = document.getElementById('miaosha-batch-fire-btn') as HTMLButtonElement | null;
  const fireCountEl = document.getElementById('miaosha-batch-fire-count');
  const burstBtn = document.getElementById('miaosha-batch-burst-btn') as HTMLButtonElement | null;
  const burstCountEl = document.getElementById('miaosha-batch-burst-count');

  if (options?.onFire && fireBtn) {
    fireBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      options.onFire!();
    });
  }

  if (options?.onBurst && burstBtn) {
    burstBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      options.onBurst!();
    });
  }

  if (options?.getTicketCount && fireCountEl && burstCountEl && fireBtn && burstBtn) {
    async function updateCount() {
      try {
        const count = await options.getTicketCount!();
        fireCountEl.textContent = String(count);
        burstCountEl.textContent = String(count);
        const disabled = count === 0;
        fireBtn.disabled = disabled;
        burstBtn.disabled = disabled;
        [fireBtn, burstBtn].forEach((btn) => {
          btn.style.cursor = disabled ? 'not-allowed' : 'pointer';
          btn.style.opacity = disabled ? '0.55' : '1';
          btn.style.animation = disabled ? 'none' : '';
        });
      } catch {
        fireCountEl.textContent = '0';
        burstCountEl.textContent = '0';
        fireBtn.disabled = true;
        burstBtn.disabled = true;
        [fireBtn, burstBtn].forEach((btn) => {
          btn.style.cursor = 'not-allowed';
          btn.style.opacity = '0.55';
          btn.style.animation = 'none';
        });
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

    async function getPrefireAuthStatus() {
      const auth = await getFreshAuth();
      if (!auth || !(await bigmodelAdapter.authProbe.isAuthenticated(auth))) {
        return {
          ok: false,
          reason: 'missing-auth',
        };
      }

      const legacy = normalizeAuthHeaders(auth);
      const capturedAt = typeof auth.capturedAt === 'number' ? auth.capturedAt : Date.now();
      return {
        ok: true,
        headers: legacy,
        source: legacy.source === 'live-page' ? 'live-page' : 'storage-fallback',
        capturedAt,
        ageMs: Math.max(0, Date.now() - capturedAt),
        org: legacy.bigmodelOrganization,
        project: legacy.bigmodelProject,
        tokenSuffix: tokenSuffix(legacy.authorization),
      };
    }

    // ── Runtime Calibration (1.0.0.alpha) ────────────────────────────────────
    let calibrationInFlight = false;
    let calibrationTimer: ReturnType<typeof setTimeout> | null = null;

    function selectCalibrationInterval(msUntilSale: number): number {
      if (msUntilSale <= CALIBRATION_FAST_WINDOW_MS) return CALIBRATION_FAST_INTERVAL_MS;
      if (msUntilSale <= CALIBRATION_NORMAL_WINDOW_MS) return CALIBRATION_NORMAL_INTERVAL_MS;
      return CALIBRATION_IDLE_INTERVAL_MS;
    }

    async function pushRuntimeCalibrationToOverlay() {
      const cached = await safeGet<RuntimeCalibrationSnapshot>(RUNTIME_CALIBRATION_KEY);
      if (!cached) return false;
      if (!Number.isFinite(cached.latencyMs) || !Number.isFinite(cached.clockOffsetMs)) return false;
      postToOverlay({ type: 'RUNTIME_CALIBRATION', data: cached });
      return true;
    }

    async function runRuntimeCalibration(reason: string) {
      if (calibrationInFlight) return false;
      calibrationInFlight = true;
      try {
        const auth = await getFreshAuth();
        if (!auth || !(await bigmodelAdapter.authProbe.isAuthenticated(auth))) return false;

        const legacy = normalizeAuthHeaders(auth);
        const result = await calibrate({
          authorization: legacy.authorization,
          bigmodelOrganization: legacy.bigmodelOrganization,
          bigmodelProject: legacy.bigmodelProject,
        });

        if (!Number.isFinite(result.latencyMs) || !Number.isFinite(result.clockOffsetMs) || result.probes.length === 0) {
          return false;
        }

        const snapshot: RuntimeCalibrationSnapshot = {
          latencyMs: Math.max(0, Math.round(result.latencyMs)),
          clockOffsetMs: Math.round(result.clockOffsetMs),
          sampleCount: result.probes.length,
          calibratedAt: Date.now(),
          reason,
        };

        await safeSet(RUNTIME_CALIBRATION_KEY, snapshot);
        postToOverlay({ type: 'RUNTIME_CALIBRATION', data: snapshot });
        return true;
      } catch {
        return false;
      } finally {
        calibrationInFlight = false;
      }
    }

    async function scheduleNextRuntimeCalibration() {
      if (calibrationTimer) {
        clearTimeout(calibrationTimer);
        calibrationTimer = null;
      }

      try {
        const cfg = await getSaleConfig();
        const msUntilSale = Math.max(0, getNextSaleTime(cfg) - Date.now());
        const nextDelay = selectCalibrationInterval(msUntilSale);
        calibrationTimer = setTimeout(async () => {
          await runRuntimeCalibration('periodic');
          await scheduleNextRuntimeCalibration();
        }, nextDelay);
      } catch {
        calibrationTimer = setTimeout(async () => {
          await runRuntimeCalibration('periodic-fallback');
          await scheduleNextRuntimeCalibration();
        }, CALIBRATION_NORMAL_INTERVAL_MS);
      }
    }

    async function startRuntimeCalibrationLoop() {
      await pushRuntimeCalibrationToOverlay();
      await runRuntimeCalibration('init');
      await scheduleNextRuntimeCalibration();
    }

    // NOTE: batch-preview is intentionally fetched only from the MAIN world
    // using the page's original uninstrumented fetch. The content script no
    // longer requests this endpoint because Alibaba WAF blocks any request
    // originating from the extension's isolated world.

    chrome.storage.onChanged.addListener(async (changes, area) => {
      if (area === 'local' && changes['local:captchaConfig']) {
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
      authArg: any,
      bizId: string,
      onUpdate: (status: 'SUCCESS' | 'EXPIRE' | 'timeout') => void,
    ) {
      const legacy = normalizeAuthHeaders(coerceToPlatformAuth(authArg));
      if (!legacy) return;
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
              Authorization: legacy.authorization,
              'Bigmodel-Organization': legacy.bigmodelOrganization,
              'Bigmodel-Project': legacy.bigmodelProject,
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

    async function updatePaymentState(patch: any) {
      const current = await safeGet<any>('local:paymentState');
      const next = { ...(current || {}), ...patch, updatedAt: Date.now() };
      await safeSet('local:paymentState', next);
      postToOverlay({ type: 'PAYMENT_STATE', data: next });
    }

    // ── Alpha Auto-Fire execution ────────────────────────────────────────────
    function consumeReservedTickets(pool: any[], reservedTickets: Array<{ ticket: string; createdAt: number }>) {
      if (reservedTickets.length === 0) return pool;
      const reservedKeys = new Set(reservedTickets.map((ticket) => ticket.ticket + ':' + ticket.createdAt));
      return pool.filter((ticket) => !reservedKeys.has(ticket.ticket + ':' + ticket.createdAt));
    }

    function describeShot(shot: AutoFirePlanShot, idx: number, total: number) {
      const waveTag = shot.wave === 'initial' ? 'initial' : 'follow-up';
      return '>[#' + (idx + 1) + '/' + total + '][' + waveTag + '] ' + shot.productId.slice(-6);
    }

    function queueFireTimers(
      shots: AutoFirePlanShot[],
      authArg: any,
      timers: ReturnType<typeof setTimeout>[],
      state: { succeeded: boolean },
    ) {
      const auth = coerceToPlatformAuth(authArg);
      if (!auth) {
        postToOverlay({ type: 'FIRE_RESULT', line: '> No auth headers' });
        return () => {};
      }

      const total = shots.length;

      const cancelAll = () => {
        for (const id of timers) clearTimeout(id);
      };

      const fireOne = async (shot: AutoFirePlanShot, idx: number) => {
        if (state.succeeded) return;
        const t1 = Date.now();
        try {
          const result = await bigmodelAdapter.orderPipeline.run({
            platform: 'bigmodel',
            productId: shot.productId,
            ticket: { ticket: shot.ticket, randstr: shot.randstr, provider: 'tencent-captcha', createdAt: shot.createdAt },
          }, auth);
          const rtt = Date.now() - t1;
          const tag = describeShot(shot, idx, total);

          if (result.success) {
            const session = result.data!;
            state.succeeded = true;
            cancelAll();
            postToOverlay({ type: 'FIRE_RESULT', line: tag + ': ORDER bizId=' + session.bizId + ' (' + rtt + 'ms)' });
            postToOverlay({
              type: 'FIRE_SHOT_RESULT',
              data: {
                shotIdx: idx,
                productId: shot.productId,
                priority: 1,
                wave: shot.wave,
                outcome: 'success',
                code: 200,
                rtt,
                sentAt: t1,
                bizId: session.bizId,
                ticketMask: maskTicket(shot.ticket),
                serverMsg: '',
              },
            });
            const ps = {
              bizId: session.bizId as string,
              amount: session.amount as number,
              productId: session.productId as string,
              status: 'pending' as const,
              updatedAt: Date.now(),
            };
            void updatePaymentState(ps);
            postToOverlay({ type: 'BURST_FIRE_SUCCESS', data: ps });
          } else if (result.metadata?.classified?.outcome === 'soldout') {
            postToOverlay({ type: 'FIRE_RESULT', line: tag + ': sold-out today (' + rtt + 'ms)' });
            postToOverlay({
              type: 'FIRE_SHOT_RESULT',
              data: {
                shotIdx: idx,
                productId: shot.productId,
                priority: 1,
                wave: shot.wave,
                outcome: 'soldout',
                code: 200,
                rtt,
                sentAt: t1,
                ticketMask: maskTicket(shot.ticket),
                serverMsg: (result.metadata?.classified as any)?.serverMsg || 'sold out',
              },
            });
          } else if (result.metadata?.classified?.outcome === 'busy' && (result.metadata?.classified as any)?.code === 555) {
            postToOverlay({ type: 'FIRE_RESULT', line: tag + ': server-busy-555 (' + rtt + 'ms)' });
            postToOverlay({
              type: 'FIRE_SHOT_RESULT',
              data: {
                shotIdx: idx,
                productId: shot.productId,
                priority: 1,
                wave: shot.wave,
                outcome: 'busy',
                code: 555,
                rtt,
                sentAt: t1,
                ticketMask: maskTicket(shot.ticket),
                serverMsg: (result.metadata?.classified as any)?.serverMsg || 'server busy',
              },
            });
          } else {
            const raw = result.metadata?.raw as { code?: number; msg?: string } | undefined;
            const cls = raw ? classifyPreviewError(raw) : {
              outcome: (result.metadata?.classified as any)?.outcome || 'error',
              code: (result.metadata?.classified as any)?.code || 500,
              serverMsg: result.error || 'unknown error',
              rawServerMsg: result.error || 'unknown error',
              responsibility: { subject: '智谱/网络', target: '插件', cause: '未知服务端错误' },
            };
            postToOverlay({ type: 'FIRE_RESULT', line: tag + ': ' + cls.outcome + ' (' + rtt + 'ms)' });
            postToOverlay({
              type: 'FIRE_SHOT_RESULT',
              data: {
                shotIdx: idx,
                productId: shot.productId,
                priority: 1,
                wave: shot.wave,
                outcome: cls.outcome,
                code: cls.code,
                rtt,
                sentAt: t1,
                ticketMask: maskTicket(shot.ticket),
                serverMsg: cls.serverMsg,
                rawServerMsg: cls.rawServerMsg,
                responsibility: cls.responsibility,
              },
            });
          }
        } catch (e: any) {
          const cls = neterrResponsibility(e?.message || 'unknown');
          postToOverlay({ type: 'FIRE_RESULT', line: describeShot(shot, idx, total) + ': net-err: ' + cls.rawServerMsg });
          postToOverlay({
            type: 'FIRE_SHOT_RESULT',
            data: {
              shotIdx: idx,
              productId: shot.productId,
              priority: 1,
              wave: shot.wave,
              outcome: cls.outcome,
              code: cls.code,
              rtt: Date.now() - t1,
              sentAt: t1,
              ticketMask: maskTicket(shot.ticket),
              serverMsg: cls.serverMsg,
              rawServerMsg: cls.rawServerMsg,
              responsibility: cls.responsibility,
            },
          });
        }
      };

      for (let i = 0; i < shots.length; i++) {
        const shot = shots[i];
        const idx = i;
        const delay = Math.max(0, shot.scheduledAt - Date.now());
        timers.push(setTimeout(() => { void fireOne(shot, idx); }, delay));
      }

      return cancelAll;
    }

    async function runAutoFirePlan(startMs: number, authArg: any) {
      const { valid, selectedIds } = await getAutoFireSnapshot();
      if (valid.length === 0) {
        postToOverlay({ type: 'FIRE_RESULT', line: '> No valid tickets' });
        return;
      }
      if (selectedIds.length === 0) {
        postToOverlay({ type: 'FIRE_RESULT', line: '> No products selected' });
        return;
      }

      const plan = buildAutoFirePlan({ tickets: valid, selectedIds, startMs });
      const allShots = [...plan.initialShots, ...plan.followUpShots];
      if (allShots.length === 0) {
        postToOverlay({ type: 'FIRE_RESULT', line: '> Auto-fire plan empty' });
        return;
      }

      const remainingPool = consumeReservedTickets(valid, plan.reservedTickets);
      _ticketPool = remainingPool;
      writePageTicketStore();
      const remainingInfo = await getTicketInfo();
      postToOverlay({ type: 'TICKET_COUNT', count: remainingInfo.count, tickets: remainingInfo.tickets });

      if (valid.length < selectedIds.length) {
        postToOverlay({
          type: 'FIRE_RESULT',
          line: '> Auto initial partial: ' + valid.length + ' tickets for ' + selectedIds.length + ' selected products',
        });
      }

      postToOverlay({
        type: 'FIRE_RESULT',
        line: '> Auto plan: initial ' + plan.initialShots.length + ' concurrent + follow-up ' + plan.followUpShots.length + ' randomized expiry-safe shots',
      });

      postToOverlay({
        type: 'FIRE_BATCH_START',
        data: {
          queue: allShots.map((shot, idx) => ({
            shotIdx: idx,
            productId: shot.productId,
            wave: shot.wave,
            priority: 1,
            scheduledAt: shot.scheduledAt,
            ticketMask: maskTicket(shot.ticket),
          })),
          totalShots: allShots.length,
          startMs,
          initialCount: plan.initialShots.length,
          followUpCount: plan.followUpShots.length,
          mode: 'auto',
          burstIntervalMs: 0,
        },
      });

      const timers: ReturnType<typeof setTimeout>[] = [];
      const state = { succeeded: false };
      const cancelAll = queueFireTimers(allShots, authArg, timers, state);
      const lastScheduledAt = allShots.reduce((latest, shot) => Math.max(latest, shot.scheduledAt), startMs);

      timers.push(setTimeout(() => {
        if (!state.succeeded) {
          cancelAll();
          postToOverlay({ type: 'FIRE_RESULT', line: '> Auto plan complete — ammo depleted (' + allShots.length + ' shots)' });
          postToOverlay({ type: 'BURST_FIRE_DEPLETED', data: { total: allShots.length } });
        }
      }, Math.max(0, lastScheduledAt - Date.now()) + 1000));
    }

    // ── Unified strike sequence: shared by default strike and burst mode ──
    interface StrikeCancelOptions {
      restorePendingTickets?: boolean;
    }

    let currentStrikeCancel: ((options?: StrikeCancelOptions) => void) | null = null;

    interface StrikeSequenceOptions {
      label: string;
      mode: 'manual' | 'burst';
      burstIntervalMs?: number;
      enableBusyBackoff: boolean;
      pollPayment: boolean;
    }

    async function runStrikeSequence(startMs: number, authArg: any, options: StrikeSequenceOptions) {
      const auth = coerceToPlatformAuth(authArg);
      if (!auth) {
        postToOverlay({ type: 'FIRE_RESULT', line: '> No auth headers' });
        return;
      }

      if (currentStrikeCancel) {
        currentStrikeCancel({ restorePendingTickets: true });
      }

      const { valid, targets, fireConfig } = await getLaunchSnapshot();
      if (valid.length === 0) {
        postToOverlay({ type: 'FIRE_RESULT', line: '> No valid tickets' });
        return;
      }
      if (targets.length === 0) {
        postToOverlay({ type: 'FIRE_RESULT', line: '> No products selected' });
        return;
      }

      const plan = buildStrikeQueue({ tickets: valid, targets });
      if (plan.shots.length === 0) {
        postToOverlay({ type: 'FIRE_RESULT', line: '> Strike queue empty' });
        return;
      }

      // Reserve the whole queue up front, but only permanently spend a ticket
      // once its /pay/preview request is actually sent.
      const reservedTickets: StrikeReservationTicket[] = plan.shots.map((s) => ({
        ticket: s.ticket,
        randstr: s.randstr,
        createdAt: s.createdAt,
      }));
      const spentKeys = new Set<string>();
      _ticketPool = removeStrikeReservations(_ticketPool, reservedTickets);
      writePageTicketStore();
      const remainingInfo = await getTicketInfo();
      postToOverlay({ type: 'TICKET_COUNT', count: remainingInfo.count, tickets: remainingInfo.tickets });

      const burstIntervalMs = options.burstIntervalMs ?? Math.max(50, Math.round(fireConfig.burstIntervalMs) || 2100);
      postToOverlay({
        type: 'FIRE_RESULT',
        line: `> ${options.label} ${plan.shots.length} shots · ${burstIntervalMs}ms`,
      });
      postToOverlay({
        type: 'FIRE_BATCH_START',
        data: {
          queue: plan.shots.map((shot, idx) => ({
            shotIdx: idx,
            productId: shot.productId,
            priority: shot.priority,
            ticketMask: maskTicket(shot.ticket),
          })),
          totalShots: plan.shots.length,
          startMs,
          mode: options.mode,
          burstIntervalMs,
        },
      });

      const previewAbortCtrl = new AbortController();
      let cancelled = false;
      const timers: ReturnType<typeof setTimeout>[] = [];

      const cancelAll = (cancelOptions?: StrikeCancelOptions) => {
        if (cancelled) return;
        cancelled = true;
        if (currentStrikeCancel === cancelAll) currentStrikeCancel = null;
        previewAbortCtrl.abort();
        for (const id of timers) clearTimeout(id);
        timers.length = 0;
        if (cancelOptions?.restorePendingTickets) {
          const restored = restoreUnusedStrikeReservations({
            pool: _ticketPool,
            reserved: reservedTickets,
            spentKeys,
            now: Date.now(),
            ticketTtlMs: TICKET_TTL_MS,
            maxPoolSize: TICKET_POOL_MAX,
          });
          _ticketPool = restored.pool;
          writePageTicketStore();
          void getTicketInfo().then((info) => {
            postToOverlay({ type: 'TICKET_COUNT', count: info.count, tickets: info.tickets });
          });
          if (restored.restoredCount > 0) {
            postToOverlay({
              type: 'FIRE_RESULT',
              line: `> Previous ${options.label} cancelled: restored ${restored.restoredCount} queued tickets`,
            });
          }
        }
      };

      currentStrikeCancel = cancelAll;

      const total = plan.shots.length;
      let succeeded = false;

      const fireOne = async (shot: StrikeShot, idx: number): Promise<string> => {
        if (cancelled) return 'cancelled';
        const tag = '>[#' + (idx + 1) + '/' + total + '][P' + shot.priority + '] ' + shot.productId.slice(-6);
        const t1 = Date.now();
        spentKeys.add(strikeTicketKey(shot));
        try {
          const result = await bigmodelAdapter.orderPipeline.run({
            platform: 'bigmodel',
            productId: shot.productId,
            ticket: { ticket: shot.ticket, randstr: shot.randstr, provider: 'tencent-captcha', createdAt: shot.createdAt },
          }, auth);
          if (cancelled) return 'cancelled';
          const rtt = Date.now() - t1;

          if (result.success) {
            const session = result.data!;
            succeeded = true;
            cancelAll();
            const bizId = session.bizId as string;
            const amount = session.amount as number;
            const productId = session.productId as string;
            const ps = {
              bizId,
              amount,
              productId,
              qrCode: session.qrCode || null,
              payType: fireConfig.payType,
              status: 'pending' as const,
              updatedAt: Date.now(),
            };
            await updatePaymentState(ps);
            postToOverlay({ type: 'BURST_FIRE_SUCCESS', data: ps });
            postToOverlay({ type: 'FIRE_RESULT', line: tag + ': ORDER bizId=' + bizId + ' (' + rtt + 'ms)' });
            postToOverlay({
              type: 'FIRE_SHOT_RESULT',
              data: { shotIdx: idx, productId: shot.productId, priority: shot.priority, outcome: 'success', code: 200, rtt, sentAt: t1, bizId, ticketMask: maskTicket(shot.ticket), serverMsg: '' },
            });
            if (options.pollPayment) {
              void pollPayCheck(auth, bizId, (status) => {
                if (status === 'SUCCESS') {
                  void updatePaymentState({ status: 'success' });
                  postToOverlay({ type: 'STRIKE_PAYMENT_SUCCESS', data: { bizId, orderId: bizId } });
                  postToOverlay({ type: 'FIRE_RESULT', line: '> Payment confirmed bizId=' + String(bizId).slice(-8) });
                } else if (status === 'EXPIRE') {
                  void updatePaymentState({ status: 'expired' });
                  postToOverlay({ type: 'STRIKE_PAYMENT_EXPIRED', data: { bizId, orderId: bizId } });
                  postToOverlay({ type: 'FIRE_RESULT', line: '> Payment expired bizId=' + String(bizId).slice(-8) });
                } else {
                  void updatePaymentState({ status: 'timeout' });
                  postToOverlay({ type: 'STRIKE_PAYMENT_TIMEOUT', data: { bizId, orderId: bizId } });
                  postToOverlay({ type: 'FIRE_RESULT', line: '> Payment status timeout bizId=' + String(bizId).slice(-8) });
                }
              });
            }
            return 'success';
          } else if (result.metadata?.classified?.outcome === 'soldout') {
            postToOverlay({ type: 'FIRE_RESULT', line: tag + ': sold-out today (' + rtt + 'ms)' });
            postToOverlay({ type: 'FIRE_SHOT_RESULT', data: { shotIdx: idx, productId: shot.productId, priority: shot.priority, outcome: 'soldout', code: 200, rtt, sentAt: t1, ticketMask: maskTicket(shot.ticket), serverMsg: (result.metadata?.classified as any)?.serverMsg || 'sold out' } });
            return 'soldout';
          } else if (result.metadata?.classified?.outcome === 'busy' && (result.metadata?.classified as any)?.code === 555) {
            postToOverlay({ type: 'FIRE_RESULT', line: tag + ': server-busy-555 (' + rtt + 'ms)' });
            postToOverlay({ type: 'FIRE_SHOT_RESULT', data: { shotIdx: idx, productId: shot.productId, priority: shot.priority, outcome: 'busy', code: 555, rtt, sentAt: t1, ticketMask: maskTicket(shot.ticket), serverMsg: (result.metadata?.classified as any)?.serverMsg || 'server busy' } });
            return 'busy';
          } else {
            const raw = result.metadata?.raw as { code?: number; msg?: string } | undefined;
            const cls = raw ? classifyPreviewError(raw) : {
              outcome: (result.metadata?.classified as any)?.outcome || 'error',
              code: (result.metadata?.classified as any)?.code || 500,
              serverMsg: result.error || 'unknown error',
              rawServerMsg: result.error || 'unknown error',
              responsibility: { subject: '智谱/网络', target: '插件', cause: '未知服务端错误' },
            };
            postToOverlay({ type: 'FIRE_RESULT', line: tag + ': ' + cls.outcome + ' (' + rtt + 'ms)' });
            postToOverlay({
              type: 'FIRE_SHOT_RESULT',
              data: {
                shotIdx: idx,
                productId: shot.productId,
                priority: shot.priority,
                outcome: cls.outcome,
                code: cls.code,
                rtt,
                sentAt: t1,
                ticketMask: maskTicket(shot.ticket),
                serverMsg: cls.serverMsg,
                rawServerMsg: cls.rawServerMsg,
                responsibility: cls.responsibility,
              },
            });
            return cls.outcome;
          }
        } catch (e: any) {
          if (e?.name === 'AbortError' || cancelled) return 'cancelled';
          const cls = neterrResponsibility(e?.message || 'unknown');
          postToOverlay({ type: 'FIRE_RESULT', line: tag + ': net-err: ' + cls.rawServerMsg });
          postToOverlay({
            type: 'FIRE_SHOT_RESULT',
            data: {
              shotIdx: idx,
              productId: shot.productId,
              priority: shot.priority,
              outcome: cls.outcome,
              code: cls.code,
              rtt: Date.now() - t1,
              sentAt: t1,
              ticketMask: maskTicket(shot.ticket),
              serverMsg: cls.serverMsg,
              rawServerMsg: cls.rawServerMsg,
              responsibility: cls.responsibility,
            },
          });
          return cls.outcome;
        }
      };

      const baseDelay = Math.max(0, startMs - Date.now());
      let currentInterval = burstIntervalMs;
      let consecutiveBusy = 0;
      let shotIdx = 0;
      const BUSY_BACKOFF_MS = 200;
      const MAX_INTERVAL_MS = 3000;

      const scheduleNext = () => {
        if (cancelled || succeeded || shotIdx >= total) {
          if (!succeeded && !cancelled) {
            cancelAll();
            postToOverlay({ type: 'FIRE_RESULT', line: `> ${options.label} complete — ammo depleted (${total} shots)` });
            postToOverlay({ type: 'BURST_FIRE_DEPLETED', data: { total } });
          }
          return;
        }

        const shot = plan.shots[shotIdx];
        const idx = shotIdx;
        shotIdx++;
        timers.push(
          setTimeout(async () => {
            const outcome = await fireOne(shot, idx);
            if (options.enableBusyBackoff && outcome === 'busy') {
              consecutiveBusy++;
              if (consecutiveBusy >= 2) {
                currentInterval = Math.min(MAX_INTERVAL_MS, currentInterval + BUSY_BACKOFF_MS);
                postToOverlay({ type: 'FIRE_RESULT', line: `> 555 backoff: interval increased to ${currentInterval}ms` });
              }
            } else {
              consecutiveBusy = 0;
            }

            scheduleNext();
          }, shotIdx === 1 ? baseDelay : currentInterval),
        );
      };

      scheduleNext();
    }

    async function strike(startMs: number, authOverride?: any) {
      const auth = coerceToPlatformAuth(authOverride) || (await getFreshAuth());
      if (!auth || !(await bigmodelAdapter.authProbe.isAuthenticated(auth))) {
        postToOverlay({ type: 'FIRE_RESULT', line: '> No auth headers' });
        return;
      }
      await runStrikeSequence(startMs, auth, {
        label: 'Strike',
        mode: 'manual',
        enableBusyBackoff: true,
        pollPayment: true,
      });
    }

    async function burstStrike(startMs: number, authOverride?: any) {
      const auth = coerceToPlatformAuth(authOverride) || (await getFreshAuth());
      if (!auth || !(await bigmodelAdapter.authProbe.isAuthenticated(auth))) {
        postToOverlay({ type: 'FIRE_RESULT', line: '> No auth headers' });
        return;
      }
      await runStrikeSequence(startMs, auth, {
        label: 'BURST',
        mode: 'burst',
        burstIntervalMs: 200,
        enableBusyBackoff: false,
        pollPayment: true,
      });
    }

    async function prefireAndBurst(startMs: number, reason: string) {
      const authStatus = await getPrefireAuthStatus();
      if (!authStatus.ok) {
        postToOverlay({
          type: 'PREFIRE_STATUS',
          data: {
            ok: false,
            reason: authStatus.reason,
            fireReason: reason,
          },
        });
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

      if (reason === 'auto') {
        await runAutoFirePlan(startMs, authStatus.headers);
        return;
      }

      if (reason === 'burst' || reason === 'batch-burst') {
        await burstStrike(startMs, authStatus.headers);
        return;
      }

      await strike(startMs, authStatus.headers);
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
        if (event.data.type === 'GET_RUNTIME_CALIBRATION') {
          const pushed = await pushRuntimeCalibrationToOverlay();
          if (!pushed) {
            await runRuntimeCalibration('manual-request');
          }
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
              ? Math.max(50, Math.round(Number(incoming.burstIntervalMs)))
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

      if (type === 'BATCH_MODE_STATUS') {
        if (payload?.active) {
          createForceStopBanner({
            getTicketCount: async () => (await getTicketInfo()).count,
            onFire: () => prefireAndBurst(Date.now(), 'batch-banner'),
            onBurst: () => prefireAndBurst(Date.now(), 'batch-burst'),
          });
        } else {
          removeForceStopBanner();
        }
      }
    });

    // ── Listen for commands from popup ──
    chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
      if (msg.type === 'PRODUCE_CAPTCHA') {
        window.postMessage({ __miaosha_cmd: true, type: 'PRODUCE_CAPTCHA' }, '*');
        sendResponse({ ok: true });
      }
      if (msg.type === 'GET_TICKET_COUNT') {
        getTicketInfo().then((info) => sendResponse({ count: info.count }));
        return true;
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

    void startRuntimeCalibrationLoop();

    // R3: Start flash sale reminder loop
    initReminderLoop();
  },
});
