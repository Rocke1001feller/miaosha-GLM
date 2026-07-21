// Background Service Worker — handles R4 Badge + R1 Alarms
// IMPORTANT: chrome.alarms.onAlarm listener MUST be registered at top level (not async)

import {
  SALE_ALARM_MINUTES,
  createSaleAlarmStatusSnapshot,
  getNextSaleTime,
  saleTimeStore,
} from '../lib/settings/sale-time';
import { refreshUsageCache } from '../lib/usage/providers';

const BADGE_STYLES: Record<number, { text: string; color: string; desc: string }> = {
  60: { text: '60', color: '#0ea5e9', desc: '距秒杀 60 分钟' },
  30: { text: '30', color: '#6366f1', desc: '距秒杀 30 分钟' },
  15: { text: '15', color: '#f59e0b', desc: '距秒杀 15 分钟' },
  10: { text: '10', color: '#f97316', desc: '距秒杀 10 分钟' },
   5: { text: '5!', color: '#dc2626', desc: '距秒杀 5 分钟：立即录入验证码！' },
};

const OK_BADGE_TTL_MS = 30 * 60_000;
const BADGE_CALIBRATE_INTERVAL_MIN = 5;

async function showFlashNotification(min: number) {
  const message = min >= 60
    ? `距秒杀开始还有 ${Math.floor(min / 60)} 小时${min % 60 ? min % 60 + ' 分钟' : ''}，数据已刷新`
    : min <= 5
      ? '距秒杀开始还有 5 分钟！请尽快录入验证码，越多越好。'
      : `距秒杀开始还有 ${min} 分钟！`;
  const title = min <= 5 ? '🔥 智谱秒杀提醒 · 验证码冲刺' : '🔥 智谱秒杀提醒';

  try {
    await chrome.notifications.create(`flash-${min}`, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon128.png'),
      title,
      message,
      priority: 2,
      buttons: [
        { title: '立即准备' },
        { title: '稍后提醒' },
      ],
    });
  } catch {
    // Fallback to a smaller icon + no buttons if the platform rejects image/button payload.
    await chrome.notifications.create(`flash-${min}`, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icons/icon16.png'),
      title,
      message,
      priority: 2,
    }).catch(() => undefined);
  }
}

export interface BadgeAlarmPlan {
  name: string;
  when: number;
  min?: number;
}

/**
 * Compute badge alarm times.
 * Each countdown badge (60/30/15/10/5) and the fire badge (T-0) are shown
 * for exactly one minute, then hidden.
 */
export function computeBadgeAlarmPlan(saleTime: number, now: number): { show: BadgeAlarmPlan[]; hide: BadgeAlarmPlan[] } {
  const show: BadgeAlarmPlan[] = [];
  const hide: BadgeAlarmPlan[] = [];

  for (const min of SALE_ALARM_MINUTES) {
    const showTime = saleTime - min * 60_000;
    const hideTime = showTime + 60_000;
    if (showTime > now) {
      show.push({ name: `badge-show-${min}`, when: showTime, min });
    }
    if (hideTime > now) {
      hide.push({ name: `badge-hide-${min}`, when: hideTime });
    }
  }

  if (saleTime > now) {
    show.push({ name: 'badge-fire', when: saleTime });
  }
  if (saleTime + 60_000 > now) {
    hide.push({ name: 'badge-fire-hide', when: saleTime + 60_000 });
  }

  return { show, hide };
}

/**
 * If `now` falls inside a one-minute badge window, return that phase.
 * Otherwise the badge should be blank.
 */
export function getCurrentBadgePhase(saleTime: number, now: number): number | null {
  for (const min of SALE_ALARM_MINUTES) {
    const showTime = saleTime - min * 60_000;
    const hideTime = showTime + 60_000;
    if (now >= showTime && now < hideTime) {
      return min;
    }
  }
  return null;
}

export interface BadgeState {
  text: string;
  color: string;
  title: string;
}

/**
 * Determine the badge that should be visible at a given moment.
 * Returns null when no badge should be shown.
 */
export function getBadgeStateForTime(saleTime: number, now: number): BadgeState | null {
  const phase = getCurrentBadgePhase(saleTime, now);
  if (phase) {
    const style = BADGE_STYLES[phase];
    return { text: style.text, color: style.color, title: style.desc };
  }
  if (now >= saleTime && now < saleTime + 60_000) {
    return { text: '🔥', color: '#dc2626', title: '秒杀进行中！' };
  }
  return null;
}

export async function rescheduleSaleAlarms(reason = 'runtime') {
  const config = await saleTimeStore.get();
  const snapshot = createSaleAlarmStatusSnapshot(config, Date.now(), reason);

  await Promise.all(
    SALE_ALARM_MINUTES.map((minutesBefore) => chrome.alarms.clear(`flash-${minutesBefore}`)),
  );

  snapshot.items.forEach((item) => {
    if (item.status === 'pending') {
      chrome.alarms.create(item.name, { when: item.notificationTime });
    }
  });

  await saleTimeStore.setAlarmStatus(snapshot);
  return snapshot;
}

/**
 * Schedule all countdown badge alarms and synchronize the visible badge.
 * Called on install/startup and after sale-time changes.
 */
export async function scheduleBadgeAlerts({ preserveBadge = false } = {}) {
  if (!preserveBadge) {
    chrome.action.setBadgeText({ text: '' });
    chrome.action.setTitle({ title: '' });
  }
  const config = await saleTimeStore.get();
  const saleTime = getNextSaleTime(config);
  const now = Date.now();

  // Clear stale badge alarms and re-schedule.
  await Promise.all([
    ...SALE_ALARM_MINUTES.map((min) => chrome.alarms.clear(`badge-show-${min}`)),
    ...SALE_ALARM_MINUTES.map((min) => chrome.alarms.clear(`badge-hide-${min}`)),
    chrome.alarms.clear('badge-fire'),
    chrome.alarms.clear('badge-fire-hide'),
    chrome.alarms.clear('badge-ok-clear'),
    chrome.alarms.clear('badge-calibrate'),
  ]);

  const { show, hide } = computeBadgeAlarmPlan(saleTime, now);
  for (const alarm of [...show, ...hide]) {
    chrome.alarms.create(alarm.name, { when: alarm.when });
  }

  // Periodic calibration alarm: re-sync the visible badge in case a
  // service-worker restart caused an alarm to be missed.
  chrome.alarms.create('badge-calibrate', { periodInMinutes: BADGE_CALIBRATE_INTERVAL_MIN });

  // If we wake up inside a one-minute badge window, show it now.
  const state = getBadgeStateForTime(saleTime, now);
  if (state) {
    chrome.action.setBadgeText({ text: state.text });
    chrome.action.setBadgeBackgroundColor({ color: state.color });
    chrome.action.setTitle({ title: state.title });
  } else if (!preserveBadge) {
    // Already cleared above; keep badge blank.
  }
}

export default defineBackground(() => {
  function clearBadgeAlerts() {
    chrome.action.setBadgeText({ text: '' });
    chrome.action.setTitle({ title: '' });
  }

  function applyBadgeForMin(min: number) {
    const style = BADGE_STYLES[min];
    if (!style) return;
    chrome.action.setBadgeText({ text: style.text });
    chrome.action.setBadgeBackgroundColor({ color: style.color });
    chrome.action.setTitle({ title: style.desc });
  }

  function applyFireBadge() {
    chrome.action.setBadgeText({ text: '🔥' });
    chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
    chrome.action.setTitle({ title: '秒杀进行中！' });
  }

  /**
   * Re-apply the badge that matches the current wall-clock phase without
   * touching alarms. Used as a recovery path when the service worker restarts
   * and we only need to sync the visible badge state.
   */
  async function syncBadgeToCurrentPhase() {
    const config = await saleTimeStore.get();
    const saleTime = getNextSaleTime(config);
    const state = getBadgeStateForTime(saleTime, Date.now());
    if (state) {
      chrome.action.setBadgeText({ text: state.text });
      chrome.action.setBadgeBackgroundColor({ color: state.color });
      chrome.action.setTitle({ title: state.title });
    } else {
      clearBadgeAlerts();
    }
  }

  // R1 / R4: chrome.alarms — TOP LEVEL registration (not inside async function!)
  chrome.alarms.onAlarm.addListener(async (alarm) => {
    const { name } = alarm;

    if (name.startsWith('flash-')) {
      const min = parseInt(name.split('-')[1], 10);
      if (isNaN(min)) return;

      // Product catalog is fetched by the MAIN world script only; the service
      // worker does not call batch-preview because Alibaba WAF blocks it.

      // Show notification at every alarm point.
      await showFlashNotification(min);
      return;
    }

    if (name.startsWith('badge-')) {
      if (name === 'badge-ok-clear') {
        clearBadgeAlerts();
        return;
      }

      if (name === 'badge-fire-hide') {
        clearBadgeAlerts();
        return;
      }

      if (name === 'badge-calibrate') {
        await syncBadgeToCurrentPhase();
        return;
      }

      const parts = name.split('-');
      const kind = parts[1];

      if (kind === 'show' && parts[2]) {
        const min = parseInt(parts[2], 10);
        if (!isNaN(min)) applyBadgeForMin(min);
      } else if (kind === 'hide') {
        clearBadgeAlerts();
      } else if (kind === 'fire') {
        applyFireBadge();
      }
      return;
    }
  });

  // On extension install: schedule both
  chrome.runtime.onInstalled.addListener(() => {
    rescheduleSaleAlarms('installed');
    scheduleBadgeAlerts();
  });

  // On Chrome startup: re-schedule (alarms don't persist across restart)
  chrome.runtime.onStartup.addListener(() => {
    rescheduleSaleAlarms('startup');
    scheduleBadgeAlerts();
  });

  // Insurance: MV3 service workers can be terminated and restarted without
  // firing onInstalled/onStartup. Re-sync badge alarms on every load so a
  // stuck badge (e.g. 60 still showing past its one-minute window) recovers.
  (async () => {
    const existing = await chrome.alarms.getAll();
    const hasCountdownAlarms = existing.some(
      (a) =>
        a.name.startsWith('badge-show-') ||
        a.name.startsWith('badge-hide-') ||
        a.name === 'badge-fire' ||
        a.name === 'badge-fire-hide',
    );
    if (!hasCountdownAlarms) {
      await scheduleBadgeAlerts();
    } else {
      await syncBadgeToCurrentPhase();
    }
  })().catch(() => undefined);

  // Proxy platform API requests from content/popup contexts through the
  // service worker. The MAIN world now fetches /api/biz/pay/batch-preview
  // directly because Alibaba WAF blocks extension-origin requests to that
  // endpoint. This proxy remains available for other platform endpoints.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type === 'BIGMODEL_REQUEST') {
      (async () => {
        const { url, method, headers, body } = msg.payload;
        // Enforce the no-batch-preview-from-extension rule here as a safety net.
        if (url && url.includes('/api/biz/pay/batch-preview')) {
          sendResponse({ ok: false, error: 'batch-preview must be fetched from the MAIN world' });
          return;
        }
        const res = await fetch(url, {
          method: method || 'GET',
          credentials: 'include',
          headers: headers || {},
          body: body ?? undefined,
        });
        const responseHeaders: Record<string, string> = {};
        res.headers.forEach((value, key) => {
          responseHeaders[key.toLowerCase()] = value;
        });
        sendResponse({
          ok: true,
          status: res.status,
          statusText: res.statusText,
          headers: responseHeaders,
          body: await res.text(),
        });
      })().catch((err) => {
        sendResponse({ ok: false, error: err?.message || String(err) });
      });
      return true;
    }

    if (msg.type === 'VOLC_PURCHASE_SUCCESS') {
      (async () => {
        const { orderId, productName, plan } = msg;
        await chrome.action.setBadgeText({ text: 'OK' });
        await chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
        await chrome.action.setTitle({ title: (plan || '火山引擎') + ' 抢购成功 · 订单 ' + orderId + (productName ? ' · ' + productName : '') });
        // OK badge is a transient success indicator; clear it after the payment window.
        await chrome.alarms.clear('badge-ok-clear');
        await chrome.alarms.create('badge-ok-clear', { when: Date.now() + OK_BADGE_TTL_MS });
        sendResponse({ ok: true });
      })().catch((err) => {
        sendResponse({ ok: false, error: err?.message || String(err) });
      });
      return true;
    }

    if (msg.type === 'ALI_PURCHASE_SUCCESS') {
      (async () => {
        const { orderId, productName, plan } = msg;
        await chrome.action.setBadgeText({ text: 'OK' });
        await chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
        await chrome.action.setTitle({
          title:
            (plan || '阿里百炼') +
            ' 抢购成功' +
            (orderId ? ' · 订单 ' + orderId : '') +
            (productName ? ' · ' + productName : ''),
        });
        // OK badge is a transient success indicator; clear it after the payment window.
        await chrome.alarms.clear('badge-ok-clear');
        await chrome.alarms.create('badge-ok-clear', { when: Date.now() + OK_BADGE_TTL_MS });
        sendResponse({ ok: true });
      })().catch((err) => {
        sendResponse({ ok: false, error: err?.message || String(err) });
      });
      return true;
    }

    if (msg.type === 'BCE_PURCHASE_SUCCESS') {
      (async () => {
        const { orderId, productName, plan } = msg;
        await chrome.action.setBadgeText({ text: 'OK' });
        await chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
        await chrome.action.setTitle({
          title:
            (plan || '百度千帆') +
            ' 抢购成功' +
            (orderId ? ' · 订单 ' + orderId : '') +
            (productName ? ' · ' + productName : ''),
        });
        // OK badge is a transient success indicator; clear it after the payment window.
        await chrome.alarms.clear('badge-ok-clear');
        await chrome.alarms.create('badge-ok-clear', { when: Date.now() + OK_BADGE_TTL_MS });
        sendResponse({ ok: true });
      })().catch((err) => {
        sendResponse({ ok: false, error: err?.message || String(err) });
      });
      return true;
    }

    if (msg.type === 'USAGE_FETCH') {
      (async () => {
        const cache = await refreshUsageCache();
        sendResponse({ ok: true, cache });
      })().catch((err) => {
        sendResponse({ ok: false, error: err?.message || String(err) });
      });
      return true;
    }

    if (msg.type === 'SALE_TIME_UPDATED') {
      saleTimeStore.set(msg.config)
        .then(() => rescheduleSaleAlarms('manual-confirm'))
        .then(async (alarmStatus) => {
          await scheduleBadgeAlerts();
          sendResponse({ ok: true, alarmStatus });
        })
        .catch((err) => {
          sendResponse({ ok: false, error: err?.message || String(err) });
        });
      return true;
    }
    if (msg.type === 'OPEN_OPTIONS_PAGE') {
      chrome.runtime.openOptionsPage();
      sendResponse({ ok: true });
      return true;
    }
    if (msg.type === 'OPEN_PAY_TAB') {
      chrome.tabs.create({ url: msg.url })
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: err?.message || String(err) }));
      return true;
    }
  });

  // R1: Handle notification button clicks
  chrome.notifications.onButtonClicked.addListener((notifId, btnIdx) => {
    if (!notifId.startsWith('flash-')) return;
    if (btnIdx === 0) {
      chrome.action.openPopup().catch(() => {
        chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
      });
    }
    chrome.notifications.clear(notifId);
  });

  chrome.notifications.onClicked.addListener((notifId) => {
    if (!notifId.startsWith('flash-')) return;
    chrome.action.openPopup().catch(() => {
      chrome.tabs.create({ url: chrome.runtime.getURL('popup.html') });
    });
    chrome.notifications.clear(notifId);
  });
});