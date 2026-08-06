import { describe, expect, it } from 'vitest';
import { loadBceMainModules } from './_harness';

describe('bce_fireButtonLabel', () => {
  it('FIRING → 停止刷新库存；SUCCESS → 已抢到；其他 → 开始刷新库存', () => {
    const s = loadBceMainModules(['00-config', '10-shared', '30-stock', '40-ui']);
    expect(s.bce_fireButtonLabel('FIRING')).toBe('停止刷新库存');
    expect(s.bce_fireButtonLabel('SUCCESS')).toBe('✅ 已抢到');
    expect(s.bce_fireButtonLabel('SOLD_OUT')).toBe('开始刷新库存');
    expect(s.bce_fireButtonLabel('ARMED')).toBe('开始刷新库存');
  });
});

describe('bce_readLoginName', () => {
  it('有登录 cookie → 返回解码后的昵称；无 → 空串', () => {
    const s = loadBceMainModules(['00-config', '10-shared', '30-stock', '40-ui'], {
      document: {
        cookie: 'bce-login-accountid=915130241; bce-login-display-name=%E5%BC%A0%E4%B8%89',
      },
    });
    expect(s.bce_readLoginName()).toBe('张三');
    const s2 = loadBceMainModules(['00-config', '10-shared', '30-stock', '40-ui'], {
      document: { cookie: 'a=1' },
    });
    expect(s2.bce_readLoginName()).toBe('');
  });

  it('有 accountid 无 display-name → 回退显示 accountid（不误报未登录）', () => {
    const s = loadBceMainModules(['00-config', '10-shared', '30-stock', '40-ui'], {
      document: { cookie: 'bce-login-accountid=915130241' },
    });
    expect(s.bce_readLoginName()).toBe('915130241');
  });
});
