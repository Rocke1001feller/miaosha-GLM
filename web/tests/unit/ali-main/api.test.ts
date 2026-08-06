import { describe, expect, it } from 'vitest';
import { loadAliMainModules } from './_harness';

// 2026-07-17 真实抓包（脱敏）——售罄态
const SOLD_OUT_RESP = {
  code: '200',
  data: [
    {
      buyAmount: 1,
      commodityCode: 'sfm_codingplan_public_cn',
      inventoryNum: 0,
      restockingTimeStamp: 1784338200000,
      success: false,
      uniqLabel: '9a7c3384-0000-4000-8000-000000000000',
    },
  ],
  requestId: 'req-1',
  success: true,
};

const IN_STOCK_RESP = {
  code: '200',
  data: [
    {
      buyAmount: 1,
      commodityCode: 'sfm_codingplan_public_cn',
      inventoryNum: 5,
      restockingTimeStamp: 1784338200000,
      success: true,
      uniqLabel: '9a7c3384-0000-4000-8000-000000000001',
    },
  ],
  requestId: 'req-2',
  success: true,
};

const TOKENS = { umidToken: 'um-x', collina: 'col-y' };

function load() {
  return loadAliMainModules(['00-config', '10-shared', '20-api'], {
    document: { cookie: 'cna=cna-z' },
    location: { href: 'https://common-buy.aliyun.com/coding-plan', origin: 'https://common-buy.aliyun.com' },
    navigator: { userAgent: 'UA-TEST' },
  });
}

describe('ali_parseInventory', () => {
  it('售罄：inventoryNum=0 → inStock=false 且提取 restockTs', () => {
    const s = load();
    expect(s.ali_parseInventory(SOLD_OUT_RESP)).toEqual({
      inStock: false,
      restockTs: 1784338200000,
      buyAmount: 1,
    });
  });

  it('有货：inventoryNum>0 且 success → inStock=true，restockTs=null', () => {
    const s = load();
    expect(s.ali_parseInventory(IN_STOCK_RESP)).toEqual({
      inStock: true,
      restockTs: null,
      buyAmount: 1,
    });
  });

  it('data 为空数组或非数组 → 保守判无货且无 restock', () => {
    const s = load();
    expect(s.ali_parseInventory({ code: '200', data: [] })).toEqual({
      inStock: false,
      restockTs: null,
      buyAmount: null,
    });
    expect(s.ali_parseInventory(null)).toEqual({
      inStock: false,
      restockTs: null,
      buyAmount: null,
    });
  });
});

describe('ali_buildOrderBody', () => {
  it('body 形状与页面 pe() 一致：嵌套 configuration + 风控字段', () => {
    const s = load();
    const body = s.ali_buildOrderBody(false, 'subref-1', TOKENS) as any;
    expect(body.configuration.orderIndex).toBe(0);
    expect(body.configuration.commodityCode).toBe('sfm_codingplan_public_cn');
    expect(body.configuration.autoRenew).toBe(false);
    expect(body.configuration.orderParams.umidToken).toBe('um-x');
    expect(body.configuration.orderParams.cna).toBe('cna-z');
    expect(body.configuration.components[0].instanceProperty[0].value).toBe('pro');
    expect(body.couponNum).toBe('default');
    expect(body.umidToken).toBe('um-x');
    expect(body.collina).toBe('col-y');
    expect(body['bx-umidtoken']).toBe('um-x');
    expect(body.channel).toBe('commonbuy');
    expect(body.submitref).toBe('subref-1');
    expect(typeof body.linkage).toBe('string');
    expect(body.linkage.length).toBeGreaterThan(0);
  });

  it('autoRenew=true 时 configuration.autoRenew 透传', () => {
    const s = load();
    const body = s.ali_buildOrderBody(true, 'subref-1', TOKENS) as any;
    expect(body.configuration.autoRenew).toBe(true);
  });
});

describe('ali_classifyOrderResult', () => {
  const s = load();

  it('成功：code 200 + data.orderId', () => {
    expect(
      s.ali_classifyOrderResult(200, { code: '200', data: { orderId: 'ord-9' }, success: true }),
    ).toMatchObject({ kind: 'success', orderId: 'ord-9' });
  });

  it('售罄：OutOfStock / B6000000571 / 售罄文案', () => {
    expect(s.ali_classifyOrderResult(200, { code: 'OutOfStock', message: '今日已售罄，明日9:30补货', success: false })).toMatchObject({ kind: 'out_of_stock' });
    expect(s.ali_classifyOrderResult(200, { code: '200', standardErrorCode: 'B6000000571', success: false })).toMatchObject({ kind: 'out_of_stock' });
  });

  it('已有未支付订单 → unpaid_exists（视为抢到）', () => {
    expect(
      s.ali_classifyOrderResult(200, { code: 'ORDER.INST_HAS_UNPAID_ORDER', message: '存在未支付订单' }),
    ).toMatchObject({ kind: 'unpaid_exists' });
  });

  it('429 → rate_limited；401 → auth；500 无 JSON → http_error', () => {
    expect(s.ali_classifyOrderResult(429, null)).toMatchObject({ kind: 'rate_limited' });
    expect(s.ali_classifyOrderResult(401, null)).toMatchObject({ kind: 'auth' });
    expect(s.ali_classifyOrderResult(500, null)).toMatchObject({ kind: 'http_error', status: 500 });
  });

  it('其他业务码 → unknown', () => {
    expect(s.ali_classifyOrderResult(200, { code: 'SOME_BIZ_ERROR', message: 'x' })).toMatchObject({
      kind: 'unknown',
      code: 'SOME_BIZ_ERROR',
    });
  });

  it('message 为非字符串时不抛 TypeError → unknown', () => {
    expect(() => s.ali_classifyOrderResult(200, { code: 'BIZ_X', message: 12345 })).not.toThrow();
    expect(s.ali_classifyOrderResult(200, { code: 'BIZ_X', message: 12345 })).toMatchObject({
      kind: 'unknown',
      code: 'BIZ_X',
    });
  });
});
