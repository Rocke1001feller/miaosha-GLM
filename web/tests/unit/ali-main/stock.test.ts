import { describe, expect, it } from 'vitest';
import { loadAliMainModules } from './_harness';

function load() {
  return loadAliMainModules(['00-config', '10-shared', '30-stock']);
}

describe('ali_nextPhase', () => {
  it('终态保持不变（FIRING/SUCCESS/FAIL）', () => {
    const s = load();
    for (const p of ['FIRING', 'SUCCESS', 'FAIL']) {
      expect(s.ali_nextPhase(p, { inStock: true, restockTs: null }, 0, 60000)).toBe(p);
    }
  });

  it('有货 → IN_STOCK', () => {
    const s = load();
    expect(s.ali_nextPhase('SOLD_OUT', { inStock: true, restockTs: null }, 0, 60000)).toBe('IN_STOCK');
    expect(s.ali_nextPhase('ARMED', { inStock: true, restockTs: null }, 0, 60000)).toBe('IN_STOCK');
  });

  it('restock 进入提前量窗口 → ARMED，窗口外 → SOLD_OUT', () => {
    const s = load();
    const now = 1000000;
    const ts = now + 30000; // 30s 后，lead=60s
    expect(s.ali_nextPhase('SOLD_OUT', { inStock: false, restockTs: ts }, now, 60000)).toBe('ARMED');
    const far = now + 120000; // 120s 后
    expect(s.ali_nextPhase('SOLD_OUT', { inStock: false, restockTs: far }, now, 60000)).toBe('SOLD_OUT');
  });

  it('无 restock 信息 → SOLD_OUT', () => {
    const s = load();
    expect(s.ali_nextPhase('INIT', { inStock: false, restockTs: null }, 0, 60000)).toBe('SOLD_OUT');
  });
});

describe('ali_log / ali_setPhase', () => {
  it('日志累积并截断到 50 条；阶段变化触发 UI hook（若存在）', () => {
    const calls: string[] = [];
    const s = load();
    (s as any).ali_uiSetPhase = (p: string) => calls.push(p);
    s.ali_setPhase('SOLD_OUT');
    s.ali_setPhase('SOLD_OUT'); // 同态不重复触发
    s.ali_setPhase('ARMED');
    expect(calls).toEqual(['SOLD_OUT', 'ARMED']);
    for (let i = 0; i < 60; i++) s.ali_log('line ' + i);
    expect((s.aliLogs as string[]).length).toBe(50);
  });
});
