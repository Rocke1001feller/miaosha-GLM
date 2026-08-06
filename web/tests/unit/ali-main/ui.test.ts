import { describe, expect, it } from 'vitest';
import { loadAliMainModules } from './_harness';

function load() {
  return loadAliMainModules(['00-config', '10-shared', '30-stock', '40-ui']);
}

describe('ali_fireButtonLabel', () => {
  it('FIRING → 停止刷新库存；SUCCESS → 已抢到；其他 → 开始刷新库存（volc 式措辞）', () => {
    const s = load();
    expect(s.ali_fireButtonLabel('FIRING')).toBe('停止刷新库存');
    expect(s.ali_fireButtonLabel('SUCCESS')).toBe('✅ 已抢到');
    expect(s.ali_fireButtonLabel('SOLD_OUT')).toBe('开始刷新库存');
    expect(s.ali_fireButtonLabel('ARMED')).toBe('开始刷新库存');
    expect(s.ali_fireButtonLabel('FAIL')).toBe('开始刷新库存');
  });
});

describe('ALI_PRODUCTS', () => {
  it('两个商品：单月购买(autoRenew=false) 在前默认，连续包月(autoRenew=true) 在后', () => {
    const s = load();
    const prods = s.ALI_PRODUCTS as any[];
    expect(prods).toHaveLength(2);
    expect(prods[0]).toMatchObject({ id: 'single', autoRenew: false });
    expect(prods[1]).toMatchObject({ id: 'renew', autoRenew: true });
  });
});
