import { describe, expect, it } from 'vitest';
import { loadBceMainModules } from './_harness';

// 2026-07-18 真实抓包（脱敏）
const STOCK_RESP = {
  success: true,
  result: {
    items: [
      { planType: 'mini', campaignName: 'qianfan_token_plan_mini_personal_new_bm' },
      { planType: 'lite', campaignName: 'qianfan_token_plan_lite_personal_new_bm' },
      { planType: 'pro', campaignName: 'qianfan_token_plan_pro_personal_new_bm' },
      { planType: 'max', campaignName: 'qianfan_token_plan_max_personal_new_bm' },
    ],
    available: { mini: true, lite: false, pro: false, max: true },
    times: ['10:00'],
  },
  log_id: '4111330473',
};

function load() {
  return loadBceMainModules(['00-config', '10-shared', '20-api']);
}

describe('bce_parseStock', () => {
  it('正常响应 → available + times', () => {
    const s = load();
    expect(s.bce_parseStock(STOCK_RESP)).toEqual({
      ok: true,
      available: { mini: true, lite: false, pro: false, max: true },
      times: ['10:00'],
    });
  });

  it('success:false / 缺 available / 空输入 → ok:false', () => {
    const s = load();
    expect(s.bce_parseStock({ success: false, message: 'x' })).toEqual({ ok: false, available: {}, times: [] });
    expect(s.bce_parseStock({ success: true, result: {} })).toEqual({ ok: false, available: {}, times: [] });
    expect(s.bce_parseStock(null)).toEqual({ ok: false, available: {}, times: [] });
  });

  it('times 缺失时给空数组', () => {
    const s = load();
    const r = s.bce_parseStock({ success: true, result: { available: { lite: true } } }) as any;
    expect(r.ok).toBe(true);
    expect(r.times).toEqual([]);
  });
});

describe('bce_buildOrderBody', () => {
  it('body 形状与页面一致（planType/autoRenew/items）', () => {
    const s = load();
    expect(s.bce_buildOrderBody('lite', false)).toEqual({
      serviceType: 'WENXINFACTORY',
      productType: 'tokenPlanPersonal',
      autoRenew: false,
      items: [{ config: { planType: 'lite' } }],
    });
    expect((s.bce_buildOrderBody('pro', true) as any).autoRenew).toBe(true);
  });
});

describe('bce_classifyOrderResult', () => {
  const s = load();

  it('成功：success:true + result.orderId', () => {
    expect(
      s.bce_classifyOrderResult(200, { success: true, result: { orderId: 'ord-9' } }),
    ).toMatchObject({ kind: 'success', orderId: 'ord-9' });
  });

  it('凭证过期（message.global 对象形态）→ auth', () => {
    expect(
      s.bce_classifyOrderResult(200, { success: false, message: { global: '登录凭证已过期，请重新登录' } }),
    ).toMatchObject({ kind: 'auth' });
  });

  it('售罄文案 → out_of_stock；未支付 → unpaid_exists', () => {
    expect(s.bce_classifyOrderResult(200, { success: false, message: '该套餐已售罄' })).toMatchObject({ kind: 'out_of_stock' });
    expect(s.bce_classifyOrderResult(200, { success: false, message: '库存不足' })).toMatchObject({ kind: 'out_of_stock' });
    expect(s.bce_classifyOrderResult(200, { success: false, message: '存在未支付订单，请先支付' })).toMatchObject({ kind: 'unpaid_exists' });
  });

  it('真实抓包：message.global=4004 + message_raw=有未支付的同类订单 → unpaid_exists', () => {
    expect(
      s.bce_classifyOrderResult(200, { success: false, message: { global: 4004 }, message_raw: '有未支付的同类订单' }),
    ).toMatchObject({ kind: 'unpaid_exists', message: '有未支付的同类订单' });
  });

  it('message_raw 兜底匹配（message 为数字码时的 auth/out_of_stock）', () => {
    expect(
      s.bce_classifyOrderResult(200, { success: false, message: { global: 4001 }, message_raw: '登录凭证已过期，请重新登录' }),
    ).toMatchObject({ kind: 'auth' });
    expect(
      s.bce_classifyOrderResult(200, { success: false, message: { global: 4009 }, message_raw: '该商品已售罄' }),
    ).toMatchObject({ kind: 'out_of_stock' });
  });

  it('429 → rate_limited；401 → auth；500 无 JSON → http_error', () => {
    expect(s.bce_classifyOrderResult(429, null)).toMatchObject({ kind: 'rate_limited' });
    expect(s.bce_classifyOrderResult(401, null)).toMatchObject({ kind: 'auth' });
    expect(s.bce_classifyOrderResult(500, null)).toMatchObject({ kind: 'http_error', status: 500 });
  });

  it('其他业务失败 → unknown', () => {
    expect(s.bce_classifyOrderResult(200, { success: false, message: '风控拦截' })).toMatchObject({ kind: 'unknown' });
  });
});
