import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { storage } from '#imports';
import UsageView from '../../../entrypoints/popup/components/UsageView.svelte';
import type { UsageCache } from '../../../lib/usage/types';

const CACHE: UsageCache = {
  minimax: {
    platform: 'minimax',
    displayName: 'MiniMax',
    consoleUrl: 'https://platform.minimaxi.com/console/usage',
    status: 'ok',
    bars: [{ label: '5h 限额', percent: 0.42, resetAt: Date.now() + 3600000 }],
    fetchedAt: Date.now(),
  },
  kimi: {
    platform: 'kimi',
    displayName: 'Kimi Code',
    consoleUrl: 'https://www.kimi.com/code/console',
    status: 'needs_login',
    bars: [],
    fetchedAt: Date.now(),
    errorMessage: 'access_token 已过期，请打开一次 Kimi 控制台',
  },
};

describe('UsageView', () => {
  beforeEach(async () => {
    await storage.removeItem('local:usageCache');
    vi.spyOn(chrome.runtime, 'sendMessage').mockResolvedValue({ ok: true } as any);
  });

  it('渲染 ok 卡（进度条 + 百分比 + 重置倒计时）与 needs_login 卡（打开控制台）', async () => {
    await storage.setItem('local:usageCache', CACHE);
    render(UsageView);
    expect(await screen.findByText('MiniMax')).toBeTruthy();
    expect(screen.getByText('5h 限额')).toBeTruthy();
    expect(screen.getByText('42.0%')).toBeTruthy();
    expect(screen.getByText(/后重置/)).toBeTruthy();
    expect(screen.getByText('Kimi Code')).toBeTruthy();
    expect(screen.getByText(/打开一次 Kimi 控制台/)).toBeTruthy();
  });

  it('空缓存 → 显示等待提示', async () => {
    render(UsageView);
    expect(await screen.findByText(/暂无数据/)).toBeTruthy();
  });

  it('storage 写入后 UI 自动更新（storage.watch 路径）', async () => {
    render(UsageView);
    // 初始为空：4 张卡均显示「等待数据…」（findByText 遇多匹配会抛错，故用 findAllByText）
    await screen.findAllByText(/暂无数据|等待数据/);
    await storage.setItem('local:usageCache', {
      volcengine: {
        platform: 'volcengine',
        displayName: '火山引擎',
        consoleUrl: 'https://console.volcengine.com/ark/region:cn-beijing/subscription/agent-plan',
        status: 'no_subscription',
        bars: [],
        note: 'Coding Plan 未订阅（已回收）',
        fetchedAt: Date.now(),
      },
    });
    expect(await screen.findByText('火山引擎')).toBeTruthy();
    expect(await screen.findByText('未订阅')).toBeTruthy();
  });
});
