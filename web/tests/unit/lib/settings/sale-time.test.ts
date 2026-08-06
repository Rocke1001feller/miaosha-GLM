/**
 * Unit tests: lib/settings/sale-time.ts
 */

import { describe, it, expect } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import {
  SALE_TIME_DEFAULT,
  createSaleAlarmStatusSnapshot,
  saleTimeStore,
} from '../../../../lib/settings/sale-time';

describe('SALE_TIME_DEFAULT', () => {
  it('points to 10:00:00.000 Asia/Shanghai (UTC+8)', () => {
    expect(SALE_TIME_DEFAULT.hour).toBe(10);
    expect(SALE_TIME_DEFAULT.minute).toBe(0);
    expect(SALE_TIME_DEFAULT.second).toBe(0);
    expect(SALE_TIME_DEFAULT.ms).toBe(0);
    expect(SALE_TIME_DEFAULT.timezone).toBe('Asia/Shanghai');
  });
});

describe('saleTimeStore', () => {
  describe('get (empty state)', () => {
    it('returns default config when nothing is stored', async () => {
      const cfg = await saleTimeStore.get();
      expect(cfg).toEqual(SALE_TIME_DEFAULT);
    });
  });

  describe('set / get roundtrip', () => {
    it('persists a custom config', async () => {
      const custom = { hour: 9, minute: 59, second: 59, ms: 999, timezone: 'Asia/Tokyo' };
      await saleTimeStore.set(custom);
      const retrieved = await saleTimeStore.get();
      expect(retrieved.hour).toBe(9);
      expect(retrieved.timezone).toBe('Asia/Tokyo');
    });
  });

  describe('alarm status', () => {
    it('persists the latest alarm calibration snapshot', async () => {
      const status = createSaleAlarmStatusSnapshot(
        SALE_TIME_DEFAULT,
        Date.UTC(2026, 4, 31, 1, 0, 0, 0),
        'unit-test',
      );

      await saleTimeStore.setAlarmStatus(status);
      await expect(saleTimeStore.getAlarmStatus()).resolves.toEqual(status);
    });
  });

  describe('partial override merging', () => {
    it('fills missing fields from defaults', async () => {
      // Manually seed partial config (simulates legacy/corrupted storage)
      // WXT storage strips the 'local:' prefix → actual chrome.storage.local key is 'saleTimeConfig'
      await fakeBrowser.storage.local.set({ saleTimeConfig: { hour: 12 } });

      const cfg = await saleTimeStore.get();
      expect(cfg.hour).toBe(12);
      // Other fields fall back to defaults
      expect(cfg.minute).toBe(SALE_TIME_DEFAULT.minute);
      expect(cfg.timezone).toBe(SALE_TIME_DEFAULT.timezone);
    });
  });
});
