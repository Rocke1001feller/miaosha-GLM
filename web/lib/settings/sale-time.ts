import { storage } from '#imports';

export interface SaleTimeConfig {
  hour: number;      // 0-23
  minute: number;    // 0-59
  second: number;    // 0-59
  ms: number;        // 0-999
  timezone: string;  // IANA timezone, e.g. 'Asia/Shanghai'
  soundEnabled: boolean; // master toggle for alarm beeps
}

export type SaleAlarmStatus = 'expired' | 'pending';

export interface SaleAlarmPlanItem {
  name: string;
  minutesBefore: number;
  notificationTime: number;
  status: SaleAlarmStatus;
  msUntilNotification: number;
}

export interface SaleAlarmStatusSnapshot {
  config: SaleTimeConfig;
  nextSaleTime: number;
  calculatedAt: number;
  updatedAt: number;
  reason: string;
  pendingCount: number;
  expiredCount: number;
  items: SaleAlarmPlanItem[];
}

export const SALE_TIME_DEFAULT: SaleTimeConfig = {
  hour: 10,
  minute: 0,
  second: 0,
  ms: 0,
  timezone: 'Asia/Shanghai',
  soundEnabled: true,
};

export const SALE_ALARM_MINUTES = [60, 30, 15, 10, 5] as const;

const STORAGE_KEY = 'local:saleTimeConfig';
const ALARM_STATUS_STORAGE_KEY = 'local:saleAlarmStatus';

function tzOffsetMs(tz: string, ref: number): number {
  const d = new Date(ref);
  const p: Record<string, number> = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric', hour12: false,
  }).formatToParts(d).forEach((x) => { if (x.type !== 'literal') p[x.type] = Number(x.value); });
  return Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, p.second, d.getUTCMilliseconds()) - ref;
}

export function getNextSaleTime(config: SaleTimeConfig, now: number = Date.now()): number {
  const { hour, minute, second, ms: msVal, timezone } = config;
  const td: Record<string, number> = {};
  new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: 'numeric', day: 'numeric', hour12: false,
  }).formatToParts(new Date(now)).forEach((x) => { if (x.type !== 'literal') td[x.type] = Number(x.value); });
  const wallAsUtc = Date.UTC(td.year, td.month - 1, td.day, hour, minute, second, msVal);
  let saleUtc = wallAsUtc - tzOffsetMs(timezone, now);
  if (saleUtc <= now) saleUtc += 86_400_000;
  return saleUtc;
}

export function createSaleAlarmStatusSnapshot(
  config: SaleTimeConfig,
  now: number = Date.now(),
  reason = 'preview',
): SaleAlarmStatusSnapshot {
  const nextSaleTime = getNextSaleTime(config, now);
  const items = SALE_ALARM_MINUTES.map((minutesBefore) => {
    const notificationTime = nextSaleTime - minutesBefore * 60_000;
    const msUntilNotification = notificationTime - now;
    const status: SaleAlarmStatus = msUntilNotification > 0 ? 'pending' : 'expired';
    return {
      name: `flash-${minutesBefore}`,
      minutesBefore,
      notificationTime,
      status,
      msUntilNotification,
    };
  });

  return {
    config,
    nextSaleTime,
    calculatedAt: now,
    updatedAt: now,
    reason,
    pendingCount: items.filter((item) => item.status === 'pending').length,
    expiredCount: items.filter((item) => item.status === 'expired').length,
    items,
  };
}

export const saleTimeStore = {
  async get(): Promise<SaleTimeConfig> {
    try {
      const stored = await storage.getItem<Partial<SaleTimeConfig>>(STORAGE_KEY);
      if (!stored) return { ...SALE_TIME_DEFAULT };
      return { ...SALE_TIME_DEFAULT, ...stored };
    } catch {
      return { ...SALE_TIME_DEFAULT };
    }
  },

  async set(config: SaleTimeConfig): Promise<void> {
    await storage.setItem<SaleTimeConfig>(STORAGE_KEY, config);
  },

  async getAlarmStatus(): Promise<SaleAlarmStatusSnapshot | null> {
    return await storage.getItem<SaleAlarmStatusSnapshot>(ALARM_STATUS_STORAGE_KEY);
  },

  async setAlarmStatus(status: SaleAlarmStatusSnapshot): Promise<void> {
    await storage.setItem<SaleAlarmStatusSnapshot>(ALARM_STATUS_STORAGE_KEY, status);
  },
};