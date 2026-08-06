/**
 * Component tests: entrypoints/popup/App.svelte
 *
 * 验证 2+4 按钮 → 面板 的对应关系与互斥切换：
 * - Topbar: AI 新闻 → NewsContent；Token 用量 → UsageView（默认）
 * - Footer: 买家秀 → 内嵌 any-comments iframe；拼团转让 → 占位面板；秒杀 → 平台入口网格
 * - 设置是动作按钮（打开选项页），不参与互斥
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { newsProviderRegistry } from '~/lib/news';
import type { NewsData } from '~/lib/news/types';
import App from '../../../entrypoints/popup/App.svelte';

const NEWS_DATA: NewsData = {
  generated_at: '2026-07-16T10:00:00Z',
  window_hours: 24,
  total_items: 1,
  total_items_ai_raw: 1,
  total_items_raw: 1,
  total_items_all_mode: 1,
  topic_filter: '',
  archive_total: 0,
  site_count: 1,
  source_count: 1,
  site_stats: [{ site_id: 'site-one', site_name: 'Site One', count: 1, raw_count: 1 }],
  items: [
    {
      id: 'item-1',
      site_id: 'site-one',
      site_name: 'Site One',
      source: 'Source A',
      title: '聚合新闻标题',
      url: 'https://example.com/1',
      published_at: null,
      first_seen_at: '2026-07-16T09:00:00Z',
      last_seen_at: '2026-07-16T09:00:00Z',
      title_original: '聚合新闻标题',
      title_en: null,
      title_zh: '聚合新闻标题',
      title_bilingual: '聚合新闻标题',
    },
  ],
};

// 各面板的排他性标记文本
const MARKERS = {
  usage: /暂无数据|等待数据/,
  seckill: '智谱 Coding Plan',
  groupBuy: /加群拼团套餐/,
  news: '聚合新闻标题',
} as const;

// 买家秀面板：vendored any-comments iframe（happy-dom 不加载 iframe 内容，断言元素本身）
const BUYER_SHOW_TITLE = '买家秀 · Coding Plan 吐槽大会';

beforeAll(() => {
  newsProviderRegistry.register({
    id: 'gh-pages',
    name: 'Mock Provider',
    fetchFeed: vi.fn(async () => NEWS_DATA),
  });
});

beforeEach(() => {
  vi.spyOn(chrome.runtime, 'sendMessage').mockResolvedValue({ ok: true } as any);
});

describe('App tab 面板', () => {
  it('默认显示 Token 用量面板，且 Topbar 对应按钮高亮', async () => {
    render(App);
    expect(await screen.findAllByText(MARKERS.usage)).not.toHaveLength(0);
    expect(screen.getByRole('tab', { name: 'Token 用量' })).toHaveClass('active');
    // 其他面板均不渲染
    expect(screen.queryByText(MARKERS.seckill)).not.toBeInTheDocument();
    expect(screen.queryByText(MARKERS.news)).not.toBeInTheDocument();
    expect(screen.queryByText('敬请期待')).not.toBeInTheDocument();
  });

  it('六个按钮依次点击：面板一一对应且互斥（同一时刻只渲染一个）', async () => {
    const user = userEvent.setup();
    render(App);

    // 默认：用量
    expect(await screen.findAllByText(MARKERS.usage)).not.toHaveLength(0);

    // 秒杀 → 平台入口网格
    await user.click(screen.getByRole('tab', { name: '秒杀' }));
    expect(await screen.findByText(MARKERS.seckill)).toBeInTheDocument();
    expect(screen.queryByText(MARKERS.usage)).not.toBeInTheDocument();

    // 买家秀 → 内嵌 any-comments iframe（占位卡已下线，无「敬请期待」）
    await user.click(screen.getByRole('tab', { name: '买家秀' }));
    const frame = await screen.findByTitle(BUYER_SHOW_TITLE);
    expect(frame).toHaveAttribute('src', '/buyer-show/popup.html');
    expect(screen.queryByText('敬请期待')).not.toBeInTheDocument();
    expect(screen.queryByText(MARKERS.seckill)).not.toBeInTheDocument();

    // 拼团转让 → 占位面板（替换买家秀 iframe），含拼团群二维码
    await user.click(screen.getByRole('tab', { name: '拼团转让' }));
    expect(await screen.findByText(MARKERS.groupBuy)).toBeInTheDocument();
    expect(screen.getAllByText('敬请期待')).toHaveLength(1);
    expect(screen.queryByTitle(BUYER_SHOW_TITLE)).not.toBeInTheDocument();
    expect(screen.getByAltText('拼团转让交流群二维码')).toHaveAttribute(
      'src',
      '/group-buy-qr.png',
    );

    // AI 新闻 → 聚合阅读
    await user.click(screen.getByRole('tab', { name: 'AI 新闻' }));
    expect(await screen.findByText(MARKERS.news)).toBeInTheDocument();
    expect(screen.queryByText(MARKERS.groupBuy)).not.toBeInTheDocument();
    expect(screen.queryByText('敬请期待')).not.toBeInTheDocument();

    // Token 用量 → 切回默认面板
    await user.click(screen.getByRole('tab', { name: 'Token 用量' }));
    expect(await screen.findAllByText(MARKERS.usage)).not.toHaveLength(0);
    expect(screen.queryByText(MARKERS.news)).not.toBeInTheDocument();
  });

  it('active 高亮全局唯一：点哪个按钮，就只有哪个按钮亮', async () => {
    const user = userEvent.setup();
    render(App);
    const allTabs = ['AI 新闻', 'Token 用量', '买家秀', '秒杀', '拼团转让'];

    for (const name of allTabs) {
      await user.click(screen.getByRole('tab', { name }));
      for (const other of allTabs) {
        const btn = screen.getByRole('tab', { name: other });
        if (other === name) {
          expect(btn).toHaveClass('active');
        } else {
          expect(btn).not.toHaveClass('active');
        }
      }
    }
  });

  it('设置按钮打开选项页，不切换面板', async () => {
    const user = userEvent.setup();
    const openOptions = vi
      .spyOn(chrome.runtime, 'openOptionsPage')
      .mockImplementation(() => {});

    render(App);
    expect(await screen.findAllByText(MARKERS.usage)).not.toHaveLength(0);

    await user.click(screen.getByRole('button', { name: '设置' }));
    expect(openOptions).toHaveBeenCalledOnce();
    // 面板保持 Token 用量，不被切换
    expect(screen.getByRole('tab', { name: 'Token 用量' })).toHaveClass('active');
    expect(screen.getAllByText(MARKERS.usage)).not.toHaveLength(0);
  });
});
