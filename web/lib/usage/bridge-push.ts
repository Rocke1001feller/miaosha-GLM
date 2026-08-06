/**
 * UsageBar macOS 桥推送：把 refreshUsageCache 的结果 POST 到本机 127.0.0.1 的
 * macOS 菜单栏 app。推送失败一律静默（app 未运行属常态）。
 */
import { storage } from '#imports';
import { refreshUsageCache } from './providers';
import type { UsageCache } from './types';

export interface BridgeConfig { enabled: boolean; port: number; token: string }
const KEY = 'local:bridgeConfig';
const DEFAULT_CFG: BridgeConfig = { enabled: false, port: 17389, token: '' };

/** background.ts 初始创建与 tick 动态重排共用的 alarm 名。 */
export const BRIDGE_PUSH_ALARM = 'usage-bridge-push';

export const bridgeConfigStore = {
  async get(): Promise<BridgeConfig> {
    return { ...DEFAULT_CFG, ...(await storage.getItem<Partial<BridgeConfig>>(KEY)) };
  },
  async set(cfg: BridgeConfig): Promise<void> {
    await storage.setItem(KEY, cfg);
  },
};

export function computePushIntervalMs(cache: UsageCache, now = Date.now()): number {
  const WINDOW = 15 * 60_000;
  for (const c of Object.values(cache)) {
    if (c?.status !== 'ok') continue;
    for (const b of c.bars) {
      if (b.resetAt && Math.abs(b.resetAt - now) <= WINDOW) return 30_000;
    }
  }
  return 60_000;
}

export async function pushUsageToBridge(cfg: BridgeConfig, cache: UsageCache): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${cfg.port}/v1/usage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${cfg.token}` },
      body: JSON.stringify(cache),
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function runBridgePushTick(): Promise<void> {
  const cfg = await bridgeConfigStore.get();
  // 门控先行：disabled（默认）或缺 token 时直接返回，不打四平台 API。
  if (!cfg.enabled || !cfg.token) return;
  const cache = await refreshUsageCache();
  await pushUsageToBridge(cfg, cache);
  // 动态节奏：基础 60s；任一 resetAt 落入 ±15min 窗口时加速到 30s。
  const periodInMinutes = computePushIntervalMs(cache) === 30_000 ? 0.5 : 1;
  chrome.alarms.create(BRIDGE_PUSH_ALARM, { periodInMinutes });
}
