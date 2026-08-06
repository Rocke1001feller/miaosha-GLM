import { describe, expect, it } from 'vitest';
import { loadBceMainModules } from './_harness';

describe('bce_readCsrf', () => {
  it('从 bce-user-info cookie 读出 csrftoken（URL 解码 + 去引号）', () => {
    const s = loadBceMainModules(['00-config', '10-shared'], {
      document: { cookie: 'a=1; bce-user-info=%222026-07-18T03%3A16%3A27Z%7Cabc123def%22; b=2' },
    });
    expect(s.bce_readCsrf()).toBe('2026-07-18T03:16:27Z|abc123def');
  });

  it('cookie 缺失时返回空串', () => {
    const s = loadBceMainModules(['00-config', '10-shared'], {
      document: { cookie: 'a=1' },
    });
    expect(s.bce_readCsrf()).toBe('');
  });

  it('未编码的原始值也能兼容', () => {
    const s = loadBceMainModules(['00-config', '10-shared'], {
      document: { cookie: 'bce-user-info="2026-07-18T03:16:27Z|xyz"' },
    });
    expect(s.bce_readCsrf()).toBe('2026-07-18T03:16:27Z|xyz');
  });
});

describe('bce_nextArmedMs', () => {
  const LEAD = 5 * 60000;
  const at = (h: number, m: number, day = 18) => new Date(2026, 6, day, h, m, 0, 0).getTime();

  it('窗口前：返回今日开售时刻 - leadMs', () => {
    const s = loadBceMainModules(['00-config', '10-shared']);
    expect(s.bce_nextArmedMs(['10:00'], at(9, 0), LEAD)).toBe(at(9, 55));
  });

  it('窗口中（已过 armedStart 未到 grace 结束）：返回过去的 armedStart（调用方视为已开窗）', () => {
    const s = loadBceMainModules(['00-config', '10-shared']);
    expect(s.bce_nextArmedMs(['10:00'], at(10, 5), LEAD)).toBe(at(9, 55));
  });

  it('grace 过后（10:30 后）：返回明日 armedStart', () => {
    const s = loadBceMainModules(['00-config', '10-shared']);
    expect(s.bce_nextArmedMs(['10:00'], at(10, 31), LEAD)).toBe(at(9, 55, 19));
  });

  it('times 缺失时按 10:00 默认', () => {
    const s = loadBceMainModules(['00-config', '10-shared']);
    expect(s.bce_nextArmedMs([], at(9, 0), LEAD)).toBe(at(9, 55));
    expect(s.bce_nextArmedMs(null, at(9, 0), LEAD)).toBe(at(9, 55));
  });
});

describe('bce_postCmd', () => {
  it('发送 __bce_cmd 信封', () => {
    const posted: any[] = [];
    const s = loadBceMainModules(['00-config', '10-shared'], {
      window: { postMessage: (m: any) => posted.push(m), addEventListener: () => {}, removeEventListener: () => {} },
    });
    s.bce_postCmd('BCE_PURCHASE_SUCCESS', { orderId: 'o1' });
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ __bce_cmd: true, type: 'BCE_PURCHASE_SUCCESS', orderId: 'o1' });
  });
});

describe('BCE_CONFIG', () => {
  it('四档商品 + 默认勾选 lite/pro + 最多 3 选', () => {
    const s = loadBceMainModules(['00-config', '10-shared']);
    const cfg = s.BCE_CONFIG as any;
    expect(cfg.products.map((p: any) => p.planType)).toEqual(['mini', 'lite', 'pro', 'max']);
    expect(cfg.defaultSelected).toEqual(['lite', 'pro']);
    expect(cfg.maxSelections).toBe(3);
  });
});
