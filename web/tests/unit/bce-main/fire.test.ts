import { describe, expect, it } from 'vitest';
import { loadBceMainModules } from './_harness';

function load(posted: any[]) {
  const s = loadBceMainModules(['00-config', '10-shared', '20-api', '30-stock', '50-fire'], {
    window: {
      postMessage: (m: any) => posted.push(m),
      addEventListener: () => {},
      removeEventListener: () => {},
    },
    location: { origin: 'https://console.bce.baidu.com', assign: () => {} },
  });
  (s.BCE_CONFIG as any).fireIntervalMs = 1;
  (s.BCE_CONFIG as any).fireBackoffMs = 1;
  (s.BCE_CONFIG as any).maxFireAttempts = 6;
  return s;
}

describe('bce_startFire', () => {
  it('按优先级逐档尝试：lite 售罄 → pro 成功，postCmd 带 orderId 与收银台 URL', async () => {
    const posted: any[] = [];
    const s = load(posted);
    const tried: string[] = [];
    (s as any).bce_createOrder = async (planType: string) => {
      tried.push(planType);
      return planType === 'pro' ? { kind: 'success', orderId: 'ord-66' } : { kind: 'out_of_stock' };
    };
    await s.bce_startFire('test');
    expect(tried).toEqual(['lite', 'pro']);
    expect(s.bceState.phase).toBe('SUCCESS');
    const msg = posted.find((m) => m.type === 'BCE_PURCHASE_SUCCESS');
    expect(msg.__bce_cmd).toBe(true);
    expect(msg.orderId).toBe('ord-66');
    expect(msg.productName).toBe('Pro');
    expect(msg.payUrl).toContain('/finance/pay?');
    expect(msg.payUrl).toContain('orderId=ord-66');
  });

  it('unpaid_exists → 视为成功且不带 orderId（不跳收银台）', async () => {
    const posted: any[] = [];
    const s = load(posted);
    (s as any).bce_createOrder = async () => ({ kind: 'unpaid_exists', message: '存在未支付订单' });
    await s.bce_startFire('test');
    expect(s.bceState.phase).toBe('SUCCESS');
    const msg = posted.find((m) => m.type === 'BCE_PURCHASE_SUCCESS');
    expect(msg.orderId).toBe('');
  });

  it('auth 失败 → FAIL 且立即停手（不重试、不换档）', async () => {
    const posted: any[] = [];
    const s = load(posted);
    let n = 0;
    (s as any).bce_createOrder = async () => {
      n++;
      return { kind: 'auth', message: '登录凭证已过期' };
    };
    await s.bce_startFire('test');
    expect(n).toBe(1);
    expect(s.bceState.phase).toBe('FAIL');
  });

  it('全部售罄 → 达到 maxFireAttempts 后 FAIL(exhausted)', async () => {
    const posted: any[] = [];
    const s = load(posted);
    let n = 0;
    (s as any).bce_createOrder = async () => {
      n++;
      return { kind: 'out_of_stock' };
    };
    await s.bce_startFire('test');
    expect(n).toBe(6);
    expect(s.bceState.phase).toBe('FAIL');
  });

  it('未勾选商品 → 不开火，仅提示', async () => {
    const posted: any[] = [];
    const s = load(posted);
    (s.bceState as any).selected = [];
    let n = 0;
    (s as any).bce_createOrder = async () => {
      n++;
      return { kind: 'success', orderId: 'x' };
    };
    await s.bce_startFire('manual');
    expect(n).toBe(0);
    expect(s.bceState.phase).not.toBe('FIRING');
    expect((s.bceLogs as string[]).some((l) => l.includes('请先勾选'))).toBe(true);
  });

  it('createOrder 抛异常 → internal → FAIL 而非卡死', async () => {
    const posted: any[] = [];
    const s = load(posted);
    (s as any).bce_createOrder = async () => {
      throw new Error('boom');
    };
    await s.bce_startFire('test');
    expect(s.bceState.phase).toBe('FAIL');
    expect(s.bceState.attempts).toBe(1);
  });
});

describe('bce_failHint', () => {
  it('按 kind 给出中文提示', () => {
    const s = load([]);
    expect(s.bce_failHint({ kind: 'auth' })).toContain('登录');
    expect(s.bce_failHint({ kind: 'http_error', status: 403 })).toContain('风控');
    expect(s.bce_failHint({ kind: 'exhausted' })).toContain('最大尝试次数');
  });
});
