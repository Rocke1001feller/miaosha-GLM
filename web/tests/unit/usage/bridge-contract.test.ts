/**
 * 桥协议契约测试：消费 UsageBar 仓库的共享夹具 docs/bridge-fixtures/snapshot-v1.json，
 * 验证夹具与 lib/usage/types.ts 的 UsageCache 形状一致、pushUsageToBridge 的传输约定
 * 与 UsageBar/docs/BRIDGE-PROTOCOL.md 一致。两侧仓库独立演进，靠该测试锁住契约。
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pushUsageToBridge } from '../../../lib/usage/bridge-push';
import type { UsageCache, UsagePlatform, UsageStatus } from '../../../lib/usage/types';

// vitest 从扩展仓库根运行；夹具在兄弟仓库 UsageBar 内，相对仓库根定位。
const FIXTURE_PATH = resolve(
  process.cwd(),
  '../UsageBar/docs/bridge-fixtures/snapshot-v1.json',
);

const PLATFORMS: UsagePlatform[] = ['minimax', 'kimi', 'mimo', 'volcengine'];
const STATUSES: UsageStatus[] = ['ok', 'needs_login', 'no_subscription', 'error'];

function loadFixture(): UsageCache {
  return JSON.parse(readFileSync(FIXTURE_PATH, 'utf8')) as UsageCache;
}

describe('bridge-contract（共享夹具 snapshot-v1.json）', () => {
  it('夹具可解析且符合 UsageCache 契约形状', () => {
    const cache = loadFixture();
    expect(Object.keys(cache).sort()).toEqual([...PLATFORMS].sort());
    for (const [key, card] of Object.entries(cache)) {
      // 键必须是合法平台 id；card.platform 与键一致
      expect(PLATFORMS).toContain(key);
      expect(card!.platform).toBe(key);
      expect(typeof card!.displayName).toBe('string');
      expect(typeof card!.consoleUrl).toBe('string');
      expect(STATUSES).toContain(card!.status);
      expect(typeof card!.fetchedAt).toBe('number');
      if (card!.planName !== undefined) expect(typeof card!.planName).toBe('string');
      if (card!.note !== undefined) expect(typeof card!.note).toBe('string');
      if (card!.errorMessage !== undefined) expect(typeof card!.errorMessage).toBe('string');
      expect(Array.isArray(card!.bars)).toBe(true);
      for (const bar of card!.bars) {
        expect(typeof bar.label).toBe('string');
        expect(typeof bar.percent).toBe('number');
        expect(bar.percent).toBeGreaterThanOrEqual(0);
        expect(bar.percent).toBeLessThanOrEqual(1);
        if (bar.usedText !== undefined) expect(typeof bar.usedText).toBe('string');
        if (bar.resetAt !== undefined) expect(typeof bar.resetAt).toBe('number');
      }
    }
    // 夹具覆盖：ok×2、needs_login×1、error×1
    const statuses = Object.values(cache).map((c) => c!.status);
    expect(statuses.filter((s) => s === 'ok')).toHaveLength(2);
    expect(statuses).toContain('needs_login');
    expect(statuses).toContain('error');
  });

  it('JSON 往返保留全部契约字段', () => {
    const cache = loadFixture();
    const roundTripped = JSON.parse(JSON.stringify(cache)) as UsageCache;
    expect(roundTripped).toEqual(cache);
    // 抽查关键可选字段在往返后仍存在
    expect(roundTripped.kimi!.bars[0].resetAt).toBe(1785076200000);
    expect(roundTripped.mimo!.planName).toBe('Pro');
    expect(roundTripped.mimo!.bars[0].usedText).toBe('8,162,846,607 / 49,200,000,000');
    expect(roundTripped.mimo!.note).toBeDefined();
    expect(roundTripped.volcengine!.errorMessage).toBe('NotLogin');
  });

  it('pushUsageToBridge 走 /v1/usage 路径并带 Bearer 头', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true }) as any);
    vi.stubGlobal('fetch', fetchMock);
    const ok = await pushUsageToBridge(
      { enabled: true, port: 17389, token: 'T1' },
      loadFixture(),
    );
    expect(ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('http://127.0.0.1:17389/v1/usage');
    expect(init?.method).toBe('POST');
    expect((init?.headers as any).Authorization).toBe('Bearer T1');
    expect((init?.headers as any)['Content-Type']).toBe('application/json');
    // body 即 UsageCache 序列化结果，与夹具内容一致
    expect(JSON.parse(init?.body as string)).toEqual(loadFixture());
  });
});
