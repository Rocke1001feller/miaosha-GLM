import { describe, expect, it } from 'vitest';
import { loadAliMainModules } from './_harness';

describe('ali-main 10-shared', () => {
  it('ali_linkage 与页面 bundle 算法一致（charCode hex 拼接）', () => {
    const s = loadAliMainModules(['00-config', '10-shared']);
    const expected = JSON.stringify({ itemId: ['sfm_codingplan_public_cn'] })
      .split('')
      .map((c) => c.charCodeAt(0).toString(16))
      .join('');
    expect(s.ali_linkage('sfm_codingplan_public_cn')).toBe(expected);
    expect((s.ali_linkage('sfm_codingplan_public_cn') as string).startsWith('7b22')).toBe(true);
  });

  it('ali_getCna 从 cookie 串中解析 cna', () => {
    const s = loadAliMainModules(['00-config', '10-shared'], {
      document: { cookie: 'foo=1; cna=abcDEF123; bar=2' },
    });
    expect(s.ali_getCna()).toBe('abcDEF123');
  });

  it('ali_serverNow 应用服务器时钟偏移', () => {
    const s = loadAliMainModules(['00-config', '10-shared']);
    (s.aliClock as any).offsetMs = 5000;
    const now = Date.now();
    const serverNow = s.ali_serverNow() as number;
    expect(serverNow).toBeGreaterThanOrEqual(now + 4999);
    expect(serverNow).toBeLessThanOrEqual(now + 5100);
  });

  it('ali_postCmd 发送 __ali_cmd 信封', () => {
    const posted: any[] = [];
    const s = loadAliMainModules(['00-config', '10-shared'], {
      window: { postMessage: (m: any) => posted.push(m), addEventListener: () => {}, removeEventListener: () => {} },
    });
    s.ali_postCmd('ALI_PURCHASE_SUCCESS', { orderId: 'o1', plan: '阿里百炼 Coding Plan' });
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ __ali_cmd: true, type: 'ALI_PURCHASE_SUCCESS', orderId: 'o1' });
  });
});
