import { describe, expect, it } from 'vitest';
import { loadAliMainModules } from './_harness';

function load(posted: any[]) {
  const s = loadAliMainModules(['00-config', '10-shared', '20-api', '30-stock', '50-fire'], {
    window: {
      postMessage: (m: any) => posted.push(m),
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  });
  // 小火力参数，避免测试拖慢
  (s.ALI_CONFIG as any).fireIntervalMs = 1;
  (s.ALI_CONFIG as any).fireBackoffMs = 1;
  (s.ALI_CONFIG as any).maxFireAttempts = 5;
  return s;
}

describe('ali_startFire', () => {
  it('连续售罄后成功：停手、蜂鸣、postCmd 成功消息带 orderId', async () => {
    const posted: any[] = [];
    const s = load(posted);
    let n = 0;
    (s as any).ali_buildSecurityParam = async () => 'subref-x';
    (s as any).ali_createOrder = async () => {
      n++;
      return n < 3 ? { kind: 'out_of_stock' } : { kind: 'success', orderId: 'ord-77' };
    };
    await s.ali_startFire('test');
    expect(n).toBe(3);
    expect(s.aliState.phase).toBe('SUCCESS');
    const msg = posted.find((m) => m.type === 'ALI_PURCHASE_SUCCESS');
    expect(msg).toBeTruthy();
    expect(msg.__ali_cmd).toBe(true);
    expect(msg.orderId).toBe('ord-77');
  });

  it('ORDER.INST_HAS_UNPAID_ORDER → 视为成功且无 orderId', async () => {
    const posted: any[] = [];
    const s = load(posted);
    (s as any).ali_buildSecurityParam = async () => 'subref-x';
    (s as any).ali_createOrder = async () => ({ kind: 'unpaid_exists', message: '存在未支付订单' });
    await s.ali_startFire('test');
    expect(s.aliState.phase).toBe('SUCCESS');
    const msg = posted.find((m) => m.type === 'ALI_PURCHASE_SUCCESS');
    expect(msg.orderId).toBe('');
  });

  it('auth 失败 → FAIL 且立即停手（不重试）', async () => {
    const posted: any[] = [];
    const s = load(posted);
    let n = 0;
    (s as any).ali_buildSecurityParam = async () => 'subref-x';
    (s as any).ali_createOrder = async () => {
      n++;
      return { kind: 'auth', status: 401 };
    };
    await s.ali_startFire('test');
    expect(n).toBe(1);
    expect(s.aliState.phase).toBe('FAIL');
  });

  it('持续售罄 → 达到 maxFireAttempts 后 FAIL(exhausted)', async () => {
    const posted: any[] = [];
    const s = load(posted);
    let n = 0;
    (s as any).ali_buildSecurityParam = async () => 'subref-x';
    (s as any).ali_createOrder = async () => {
      n++;
      return { kind: 'out_of_stock' };
    };
    await s.ali_startFire('test');
    expect(n).toBe(5);
    expect(s.aliState.phase).toBe('FAIL');
  });

  it('开火入口刷新风控令牌：createOrder 收到的是新令牌而非 boot 旧值', async () => {
    const posted: any[] = [];
    const s = load(posted);
    (s.aliState as any).tokens = { umidToken: 'stale', collina: 'stale' };
    (s as any).ali_readTokens = () => ({ umidToken: 'fresh', collina: 'fresh2' });
    (s as any).ali_buildSecurityParam = async () => 'subref-x';
    let captured: any = null;
    (s as any).ali_createOrder = async (_ar: any, _sr: any, tokens: any) => {
      captured = tokens;
      return { kind: 'success', orderId: 'ord-88' };
    };
    await s.ali_startFire('test');
    expect(captured.umidToken).toBe('fresh');
  });

  it('createOrder 抛异常 → internal → FAIL 而非卡在 FIRING', async () => {
    const posted: any[] = [];
    const s = load(posted);
    (s as any).ali_buildSecurityParam = async () => 'subref-x';
    (s as any).ali_createOrder = async () => {
      throw new Error('boom');
    };
    await s.ali_startFire('test');
    expect(s.aliState.phase).toBe('FAIL');
    expect(s.aliState.attempts).toBe(1);
  });
});

describe('ali_failHint', () => {
  it('按 kind 给出中文提示', () => {
    const s = load([]);
    expect(s.ali_failHint({ kind: 'auth' })).toContain('登录');
    expect(s.ali_failHint({ kind: 'http_error', status: 403 })).toContain('风控');
    expect(s.ali_failHint({ kind: 'exhausted' })).toContain('最大尝试次数');
  });
});
