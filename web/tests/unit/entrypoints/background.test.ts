/**
 * Unit tests: sale time baseline + background alarm rescheduling.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { rescheduleSaleAlarms, computeBadgeAlarmPlan, getCurrentBadgePhase, scheduleBadgeAlerts, getBadgeStateForTime } from '../../../entrypoints/background';
import {
  SALE_TIME_DEFAULT,
  createSaleAlarmStatusSnapshot,
  getNextSaleTime,
  saleTimeStore,
  type SaleTimeConfig,
} from '../../../lib/settings/sale-time';

const DEFAULT_CONFIG: SaleTimeConfig = SALE_TIME_DEFAULT;

function shanghaiParts(epochMs: number): Record<string, number> {
  const parts: Record<string, number> = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Shanghai',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
    fractionalSecondDigits: 3,
    hour12: false,
  }).formatToParts(new Date(epochMs))
    .forEach((x) => { if (x.type !== 'literal') parts[x.type] = Number(x.value); });
  return parts;
}

function atUtc(iso: string): number {
  return new Date(iso).getTime();
}

afterEach(() => {
  vi.useRealTimers();
});

describe('getNextSaleTime', () => {
  it('returns a future timestamp', () => {
    const now = Date.now();
    const sale = getNextSaleTime(DEFAULT_CONFIG, now);
    expect(sale).toBeGreaterThan(now);
  });

  it('result is within the next 24h', () => {
    const now = Date.now();
    const sale = getNextSaleTime(DEFAULT_CONFIG, now);
    expect(sale - now).toBeLessThanOrEqual(86_400_000);
  });

  it('the sale epoch has the correct 10:00:00.000 wall-clock time in UTC+8', () => {
    const now = atUtc('2026-05-31T00:00:00.000Z');
    const sale = getNextSaleTime(DEFAULT_CONFIG, now);
    const parts = shanghaiParts(sale);

    expect(parts.hour % 24).toBe(10);
    expect(parts.minute).toBe(0);
    expect(parts.second).toBe(0);
    expect(parts.fractionalSecond).toBe(0);
  });

  it('advances by exactly one day when now is past today\'s sale time', () => {
    const refSale = getNextSaleTime(DEFAULT_CONFIG, atUtc('2026-05-31T00:00:00.000Z'));
    const afterSale = refSale + 60_000;
    const nextSale = getNextSaleTime(DEFAULT_CONFIG, afterSale);
    expect(nextSale - refSale).toBeCloseTo(86_400_000, -3);
  });
});

describe('createSaleAlarmStatusSnapshot', () => {
  it('marks every alarm interval pending when all notification times are still future', () => {
    const now = atUtc('2026-05-31T00:30:00.000Z'); // 08:30 UTC+8, before T-60
    const status = createSaleAlarmStatusSnapshot(DEFAULT_CONFIG, now, 'unit-test');

    expect(status.items.map((item) => item.name)).toEqual(['flash-60', 'flash-30', 'flash-15', 'flash-10', 'flash-5']);
    expect(status.pendingCount).toBe(5);
    expect(status.expiredCount).toBe(0);
    expect(status.items.every((item) => item.status === 'pending')).toBe(true);
  });

  it('marks elapsed notification points expired while keeping later intervals pending', () => {
    const now = atUtc('2026-05-31T01:32:00.000Z'); // 09:32 UTC+8, after T-60/T-30, before T-15
    const status = createSaleAlarmStatusSnapshot(DEFAULT_CONFIG, now, 'unit-test');

    expect(status.items.find((item) => item.name === 'flash-60')?.status).toBe('expired');
    expect(status.items.find((item) => item.name === 'flash-30')?.status).toBe('expired');
    expect(status.items.find((item) => item.name === 'flash-15')?.status).toBe('pending');
    expect(status.items.find((item) => item.name === 'flash-10')?.status).toBe('pending');
    expect(status.items.find((item) => item.name === 'flash-5')?.status).toBe('pending');
    expect(status.pendingCount).toBe(3);
    expect(status.expiredCount).toBe(2);
  });
});

describe('rescheduleSaleAlarms', () => {
  it('clears stale flash alarms, schedules only pending intervals, and persists the status snapshot', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 09:47 UTC+8: T-60/T-30/T-15 have passed, T-10 (09:50:00) and T-5 (09:55:00) are still future
    vi.setSystemTime(atUtc('2026-05-31T01:47:00.000Z'));

    chrome.alarms.create('flash-60', { when: atUtc('2026-05-30T00:00:00.000Z') });
    chrome.alarms.create('flash-30', { when: atUtc('2026-05-30T00:00:00.000Z') });
    await saleTimeStore.set(DEFAULT_CONFIG);

    const status = await rescheduleSaleAlarms('unit-test');
    const alarms = await fakeBrowser.alarms.getAll();

    expect(alarms.map((alarm) => alarm.name).sort()).toEqual(['flash-10', 'flash-5']);
    expect(status.items.find((item) => item.name === 'flash-60')?.status).toBe('expired');
    expect(status.items.find((item) => item.name === 'flash-30')?.status).toBe('expired');
    expect(status.items.find((item) => item.name === 'flash-15')?.status).toBe('expired');
    expect(status.items.find((item) => item.name === 'flash-10')?.status).toBe('pending');
    expect(status.items.find((item) => item.name === 'flash-5')?.status).toBe('pending');
    await expect(saleTimeStore.getAlarmStatus()).resolves.toEqual(status);
  });
});

describe('computeBadgeAlarmPlan', () => {
  it('schedules show/hide pairs for every phase and the fire badge when all are future', () => {
    // 08:30 UTC+8, before T-60 (09:00)
    const now = atUtc('2026-05-31T00:30:00.000Z');
    const saleTime = getNextSaleTime(DEFAULT_CONFIG, now);
    const { show, hide } = computeBadgeAlarmPlan(saleTime, now);

    expect(show.map((a) => a.name).sort()).toEqual([
      'badge-fire',
      'badge-show-10',
      'badge-show-15',
      'badge-show-30',
      'badge-show-5',
      'badge-show-60',
    ]);
    expect(hide.map((a) => a.name).sort()).toEqual([
      'badge-fire-hide',
      'badge-hide-10',
      'badge-hide-15',
      'badge-hide-30',
      'badge-hide-5',
      'badge-hide-60',
    ]);

    // Each show/hide pair is exactly one minute apart.
    for (const min of [60, 30, 15, 10, 5]) {
      const showAlarm = show.find((a) => a.name === `badge-show-${min}`);
      const hideAlarm = hide.find((a) => a.name === `badge-hide-${min}`);
      expect(showAlarm).toBeDefined();
      expect(hideAlarm).toBeDefined();
      expect(hideAlarm!.when - showAlarm!.when).toBe(60_000);
    }

    // Fire badge also hides one minute after sale time.
    const fireShow = show.find((a) => a.name === 'badge-fire');
    const fireHide = hide.find((a) => a.name === 'badge-fire-hide');
    expect(fireShow).toBeDefined();
    expect(fireHide).toBeDefined();
    expect(fireHide!.when - fireShow!.when).toBe(60_000);
  });

  it('skips alarms whose show/hide times are already past', () => {
    // 09:32 UTC+8: T-60 (09:00) and T-30 (09:30) have passed, T-15 is at 09:45.
    const now = atUtc('2026-05-31T01:32:00.000Z');
    const saleTime = getNextSaleTime(DEFAULT_CONFIG, now);
    const { show, hide } = computeBadgeAlarmPlan(saleTime, now);

    expect(show.map((a) => a.name).sort()).toEqual([
      'badge-fire',
      'badge-show-10',
      'badge-show-15',
      'badge-show-5',
    ]);
    expect(hide.map((a) => a.name).sort()).toEqual([
      'badge-fire-hide',
      'badge-hide-10',
      'badge-hide-15',
      'badge-hide-5',
    ]);
  });

  it('skips the fire badge alarms once the one-minute fire window has passed', () => {
    const saleTime = atUtc('2026-05-31T02:00:00.000Z'); // 10:00 UTC+8
    const now = saleTime + 90_000; // 10:01:30 UTC+8, fire window over
    const { show, hide } = computeBadgeAlarmPlan(saleTime, now);

    expect(show.some((a) => a.name === 'badge-fire')).toBe(false);
    expect(hide.some((a) => a.name === 'badge-fire-hide')).toBe(false);
  });
});

describe('getCurrentBadgePhase', () => {
  it('returns the phase only during its one-minute window', () => {
    const now = atUtc('2026-05-31T00:00:00.000Z');
    const saleTime = getNextSaleTime(DEFAULT_CONFIG, now);

    expect(getCurrentBadgePhase(saleTime, saleTime - 60 * 60_000)).toBe(60); // exactly T-60
    expect(getCurrentBadgePhase(saleTime, saleTime - 60 * 60_000 + 30_000)).toBe(60); // T-60 + 30s
    expect(getCurrentBadgePhase(saleTime, saleTime - 60 * 60_000 + 60_000)).toBeNull(); // T-59, cleared

    expect(getCurrentBadgePhase(saleTime, saleTime - 30 * 60_000)).toBe(30);
    expect(getCurrentBadgePhase(saleTime, saleTime - 30 * 60_000 + 30_000)).toBe(30);
    expect(getCurrentBadgePhase(saleTime, saleTime - 30 * 60_000 + 60_000)).toBeNull();

    expect(getCurrentBadgePhase(saleTime, saleTime - 5 * 60_000)).toBe(5);
    expect(getCurrentBadgePhase(saleTime, saleTime - 5 * 60_000 + 30_000)).toBe(5);
    expect(getCurrentBadgePhase(saleTime, saleTime - 5 * 60_000 + 60_000)).toBeNull();

    expect(getCurrentBadgePhase(saleTime, saleTime)).toBeNull();
  });
});

describe('getBadgeStateForTime', () => {
  it('returns 60 badge at exactly T-60', () => {
    const saleTime = atUtc('2026-05-31T02:00:00.000Z');
    const state = getBadgeStateForTime(saleTime, saleTime - 60 * 60_000);
    expect(state).toEqual({ text: '60', color: '#0ea5e9', title: '距秒杀 60 分钟' });
  });

  it('returns null in the gap between T-60 and T-30 windows', () => {
    const saleTime = atUtc('2026-05-31T02:00:00.000Z');
    const state = getBadgeStateForTime(saleTime, saleTime - 59 * 60_000);
    expect(state).toBeNull();
  });

  it('returns 30 badge inside the T-30 window', () => {
    const saleTime = atUtc('2026-05-31T02:00:00.000Z');
    const state = getBadgeStateForTime(saleTime, saleTime - 30 * 60_000 + 30_000);
    expect(state).toEqual({ text: '30', color: '#6366f1', title: '距秒杀 30 分钟' });
  });

  it('returns fire badge during the T-0 window', () => {
    const saleTime = atUtc('2026-05-31T02:00:00.000Z');
    const state = getBadgeStateForTime(saleTime, saleTime + 30_000);
    expect(state).toEqual({ text: '🔥', color: '#dc2626', title: '秒杀进行中！' });
  });

  it('returns null after the fire window ends', () => {
    const saleTime = atUtc('2026-05-31T02:00:00.000Z');
    const state = getBadgeStateForTime(saleTime, saleTime + 90_000);
    expect(state).toBeNull();
  });
});

describe('scheduleBadgeAlerts', () => {
  it('creates countdown badge alarms plus a periodic calibration alarm', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 08:30 UTC+8, before T-60 (09:00)
    vi.setSystemTime(atUtc('2026-05-31T00:30:00.000Z'));
    await saleTimeStore.set(DEFAULT_CONFIG);

    await scheduleBadgeAlerts();

    const alarms = await fakeBrowser.alarms.getAll();
    const names = alarms.map((a) => a.name).sort();
    expect(names).toEqual([
      'badge-calibrate',
      'badge-fire',
      'badge-fire-hide',
      'badge-hide-10',
      'badge-hide-15',
      'badge-hide-30',
      'badge-hide-5',
      'badge-hide-60',
      'badge-show-10',
      'badge-show-15',
      'badge-show-30',
      'badge-show-5',
      'badge-show-60',
    ]);
  });

  it('recovers and re-creates countdown alarms when they are missing (service worker restart fallback)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    // 09:32 UTC+8: T-60/T-30 have passed, T-15 (09:45) and later are still future.
    vi.setSystemTime(atUtc('2026-05-31T01:32:00.000Z'));
    await saleTimeStore.set(DEFAULT_CONFIG);

    // Initial scheduling.
    await scheduleBadgeAlerts();
    let alarms = await fakeBrowser.alarms.getAll();
    expect(alarms.some((a) => a.name === 'badge-show-15')).toBe(true);

    // Simulate a service-worker restart that lost all countdown alarms but
    // left the calibration alarm behind.
    await Promise.all(
      alarms
        .filter(
          (a) =>
            a.name.startsWith('badge-show-') ||
            a.name.startsWith('badge-hide-') ||
            a.name === 'badge-fire' ||
            a.name === 'badge-fire-hide',
        )
        .map((a) => fakeBrowser.alarms.clear(a.name)),
    );

    // Recovery path: scheduleBadgeAlerts re-creates the missing alarms.
    await scheduleBadgeAlerts();

    alarms = await fakeBrowser.alarms.getAll();
    expect(alarms.some((a) => a.name === 'badge-show-15')).toBe(true);
    expect(alarms.some((a) => a.name === 'badge-show-10')).toBe(true);
    expect(alarms.some((a) => a.name === 'badge-show-5')).toBe(true);
    expect(alarms.some((a) => a.name === 'badge-fire')).toBe(true);
    expect(alarms.some((a) => a.name === 'badge-calibrate')).toBe(true);
  });

  it('sets the visible badge when called inside a countdown window', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    await saleTimeStore.set(DEFAULT_CONFIG);
    const saleTime = getNextSaleTime(DEFAULT_CONFIG, Date.now());
    // T-30 + 30s: inside the 30-minute badge window.
    vi.setSystemTime(saleTime - 30 * 60_000 + 30_000);

    await scheduleBadgeAlerts();

    const text = await fakeBrowser.action.getBadgeText({});
    expect(text).toBe('30');
  });

  it('clears the visible badge when called outside any countdown window', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    await saleTimeStore.set(DEFAULT_CONFIG);
    const saleTime = getNextSaleTime(DEFAULT_CONFIG, Date.now());
    // Set a stale badge first.
    await fakeBrowser.action.setBadgeText({ text: '60' });
    // T-59: outside any badge window.
    vi.setSystemTime(saleTime - 59 * 60_000);

    await scheduleBadgeAlerts();

    const text = await fakeBrowser.action.getBadgeText({});
    expect(text).toBe('');
  });
});
