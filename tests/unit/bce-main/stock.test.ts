import { describe, expect, it } from 'vitest';
import { loadBceMainModules } from './_harness';

function load() {
  return loadBceMainModules(['00-config', '10-shared', '30-stock']);
}

describe('bce_nextPhase', () => {
  it('终态保持不变（FIRING/SUCCESS/FAIL）', () => {
    const s = load();
    for (const p of ['FIRING', 'SUCCESS', 'FAIL']) {
      expect(s.bce_nextPhase(p, true, true)).toBe(p);
    }
  });

  it('任一勾选档有货 → IN_STOCK', () => {
    const s = load();
    expect(s.bce_nextPhase('SOLD_OUT', true, false)).toBe('IN_STOCK');
    expect(s.bce_nextPhase('ARMED', true, true)).toBe('IN_STOCK');
  });

  it('无货 + 开售窗口 → ARMED；无货 + 窗口外 → SOLD_OUT', () => {
    const s = load();
    expect(s.bce_nextPhase('SOLD_OUT', false, true)).toBe('ARMED');
    expect(s.bce_nextPhase('SOLD_OUT', false, false)).toBe('SOLD_OUT');
  });
});

describe('bce_log / bce_setPhase', () => {
  it('日志截断到 50 条；阶段变化触发 UI hook（若存在）', () => {
    const calls: string[] = [];
    const s = load();
    (s as any).bce_uiSetPhase = (p: string) => calls.push(p);
    s.bce_setPhase('SOLD_OUT');
    s.bce_setPhase('SOLD_OUT');
    s.bce_setPhase('ARMED');
    expect(calls).toEqual(['SOLD_OUT', 'ARMED']);
    for (let i = 0; i < 60; i++) s.bce_log('line ' + i);
    expect((s.bceLogs as string[]).length).toBe(50);
  });

  it('默认勾选 lite/pro，autoFire 默认开，autoRenew 默认关', () => {
    const s = load();
    expect((s.bceState as any).selected).toEqual(['lite', 'pro']);
    expect((s.bceState as any).autoFire).toBe(true);
    expect((s.bceState as any).autoRenew).toBe(false);
  });
});
