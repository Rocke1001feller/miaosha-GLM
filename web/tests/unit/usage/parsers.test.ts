import { describe, expect, it } from 'vitest';
import { buildVolcDnrRule, parseKimi, parseMimo, parseMinimax, parseVolc } from '../../../lib/usage/parsers';

// 2026-07-18 真实抓包（脱敏）
const MINIMAX_RESP = {
  model_remains: [
    {
      model_name: 'general',
      start_time: 1784358000000,
      end_time: 1784376000000,
      remains_time: 7666791,
      current_interval_used_percent: '0%',
      weekly_start_time: 1783872000000,
      weekly_end_time: 1784476800000,
      current_weekly_used_percent: '4%',
    },
    { model_name: 'video', current_interval_used_percent: '0%', current_weekly_used_percent: '0%' },
  ],
  base_resp: { status_code: 0, status_msg: 'success' },
};

const KIMI_RESP = {
  ratelimitCode5h: { ratio: 0.1042, enabled: true, resetTime: '2026-07-18T11:38:58.274128371Z' },
  ratelimitCode7d: { ratio: 0.4058, enabled: true, resetTime: '2026-07-20T06:38:58.274128371Z' },
  subscriptionBalance: { amountUsedRatio: 0.0851 },
};

const MIMO_USAGE_RESP = {
  code: 0,
  message: '',
  data: {
    monthUsage: { percent: 0.1659, items: [{ name: 'month_total_token', used: 8162846607, limit: 49200000000, percent: 0.1659 }] },
    usage: { percent: 0.17, items: [{ name: 'plan_total_token', used: 8162846607, limit: 49200000000, percent: 0.17 }] },
  },
};

const MIMO_DETAIL_RESP = {
  code: 0,
  data: { planCode: 'lite:year', planName: 'Lite', currentPeriodEnd: '2027-05-28 23:59:59', expired: false },
};

const VOLC_AFP_RESP = {
  ResponseMetadata: { RequestId: 'req-1' },
  Result: {
    PlanType: 'small',
    AFPFiveHour: { Quota: 2000, Used: 0, SubscribeTime: -1, ResetTime: -1 },
    AFPWeekly: { Quota: 7000, Used: 0, SubscribeTime: 1783872000000, ResetTime: 1784476800000 },
    AFPMonthly: { Quota: 20000, Used: 900.8545, SubscribeTime: 1782277157000, ResetTime: 1784908799000 },
  },
};

const VOLC_CODING_RESP = { Result: { Status: 'Reclaimed', UpdateTimestamp: 1784369760 } };

describe('parseMinimax', () => {
  it('取 general 模型的 5h/周两条 bar，percent 字符串转 0-1，end_time→resetAt', () => {
    const { bars } = parseMinimax(MINIMAX_RESP);
    expect(bars).toHaveLength(2);
    expect(bars[0]).toEqual({ label: '5h 限额', percent: 0, resetAt: 1784376000000 });
    expect(bars[1]).toEqual({ label: '周限额', percent: 0.04, resetAt: 1784476800000 });
  });

  it('无 general 条目 → 空 bars', () => {
    expect(parseMinimax({ model_remains: [] }).bars).toEqual([]);
    expect(parseMinimax(null).bars).toEqual([]);
  });
});

describe('parseKimi', () => {
  it('ratelimitCode5h/7d → 两条 bar，resetTime ISO→ms', () => {
    const { bars } = parseKimi(KIMI_RESP);
    expect(bars).toHaveLength(2);
    expect(bars[0].label).toBe('频限明细（5h）');
    expect(bars[0].percent).toBeCloseTo(0.1042);
    expect(bars[0].resetAt).toBe(Date.parse('2026-07-18T11:38:58.274128371Z'));
    expect(bars[1].label).toBe('本周用量');
    expect(bars[1].percent).toBeCloseTo(0.4058);
  });

  it('字段缺失 → 空 bars', () => {
    expect(parseKimi({}).bars).toEqual([]);
  });
});

describe('parseMimo', () => {
  it('套餐用量 + 月用量（含 used/limit 文本），planName/note 来自 detail', () => {
    const r = parseMimo(MIMO_USAGE_RESP, MIMO_DETAIL_RESP);
    expect(r.bars).toHaveLength(2);
    expect(r.bars[0].label).toBe('套餐用量');
    expect(r.bars[0].percent).toBeCloseTo(0.17);
    expect(r.bars[0].usedText).toBe('8,162,846,607 / 49,200,000,000');
    expect(r.bars[1].label).toBe('月用量');
    expect(r.planName).toBe('Lite');
    expect(r.note).toContain('2027-05-28');
  });

  it('detail 缺失 → 无 planName/note', () => {
    const r = parseMimo(MIMO_USAGE_RESP, null);
    expect(r.bars).toHaveLength(2);
    expect(r.planName).toBeUndefined();
  });
});

describe('parseVolc', () => {
  it('AFP 三段 bar（Used/Quota、resetAt>0 才有），Coding Reclaimed → note', () => {
    const r = parseVolc(VOLC_AFP_RESP, VOLC_CODING_RESP);
    expect(r.planName).toBe('Agent Plan Small');
    expect(r.bars).toHaveLength(3);
    expect(r.bars[0].label).toBe('近5小时');
    expect(r.bars[0].percent).toBe(0);
    expect(r.bars[0].resetAt).toBeUndefined(); // ResetTime=-1 → undefined
    expect(r.bars[1].resetAt).toBe(1784476800000);
    expect(r.bars[2].percent).toBeCloseTo(900.8545 / 20000);
    expect(r.bars[2].usedText).toBe('900.9 / 20,000');
    expect(r.note).toContain('未订阅');
  });
});

describe('buildVolcDnrRule', () => {
  it('规则形状：modifyHeaders 注入 Cookie + x-csrf-token，限定 ark 前缀', () => {
    const rule = buildVolcDnrRule('a=1; b=2', 'csrf-x');
    expect(rule).toEqual({
      id: 9101,
      priority: 1,
      action: {
        type: 'modifyHeaders',
        requestHeaders: [
          { header: 'Cookie', operation: 'set', value: 'a=1; b=2' },
          { header: 'x-csrf-token', operation: 'set', value: 'csrf-x' },
        ],
      },
      condition: { urlFilter: '||console.volcengine.com/api/top/ark/', resourceTypes: ['xmlhttprequest'] },
    });
  });
});
