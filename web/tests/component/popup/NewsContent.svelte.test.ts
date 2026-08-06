/**
 * Component tests: entrypoints/popup/components/news/NewsContent.svelte
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import { newsProviderRegistry } from '~/lib/news';
import { newsReadState } from '~/lib/news/read-state';
import type { NewsData, NewsItem } from '~/lib/news/types';
import NewsContent from '../../../entrypoints/popup/components/news/NewsContent.svelte';

function makeItem(overrides: Partial<NewsItem>): NewsItem {
  return {
    id: 'item-1',
    site_id: 'site-one',
    site_name: 'Site One',
    source: 'Source A',
    title: 'Original title',
    url: 'https://example.com/1',
    published_at: null,
    first_seen_at: '2026-07-16T09:00:00Z',
    last_seen_at: '2026-07-16T09:00:00Z',
    title_original: 'Original title',
    title_en: 'English title',
    title_zh: '中文标题',
    title_bilingual: '中文标题 / English title',
    ...overrides,
  };
}

const mockData: NewsData = {
  generated_at: '2026-07-16T10:00:00Z',
  window_hours: 24,
  total_items: 2,
  total_items_ai_raw: 2,
  total_items_raw: 2,
  total_items_all_mode: 2,
  topic_filter: '',
  archive_total: 0,
  site_count: 1,
  source_count: 1,
  site_stats: [{ site_id: 'site-one', site_name: 'Site One', count: 2, raw_count: 2 }],
  items: [
    makeItem({
      summary: '这是一条测试摘要，概括了文章的核心内容。',
      has_snapshot: true,
    }),
    makeItem({
      id: 'item-empty-title',
      url: 'https://example.com/2',
      title: '',
      title_original: '',
      title_en: null,
      title_zh: null,
      title_bilingual: '',
    }),
  ],
};

beforeAll(() => {
  newsProviderRegistry.register({
    id: 'gh-pages',
    name: 'Mock Provider',
    fetchFeed: vi.fn(async () => mockData),
  });
});

describe('NewsContent', () => {
  it('shows loading state initially', () => {
    render(NewsContent);
    expect(screen.getByText('正在聚合 AI 新闻...')).toBeInTheDocument();
  });

  it('renders the fetched news list', async () => {
    render(NewsContent);
    await waitFor(() => {
      expect(screen.getByText('中文标题')).toBeInTheDocument();
    });
    expect(screen.getByText('Site One · Source A')).toBeInTheDocument();
  });

  it('renders the generated freshness timestamp', async () => {
    render(NewsContent);
    await waitFor(() => {
      expect(screen.getByText(/更新于/)).toBeInTheDocument();
    });
  });

  it('filters out items without any usable title', async () => {
    const { container } = render(NewsContent);
    await waitFor(() => {
      expect(screen.getByText('中文标题')).toBeInTheDocument();
    });
    // The empty-title item must not produce a second card.
    expect(container.querySelectorAll('a.card')).toHaveLength(1);
  });

  it('shows a NEW badge for items first seen after the previous session', async () => {
    await newsReadState.setLastSeenAt('2026-07-16T08:00:00Z');
    render(NewsContent);
    await waitFor(() => {
      expect(screen.getByText('NEW')).toBeInTheDocument();
    });
  });

  it('shows no NEW badge on the very first open (no baseline)', async () => {
    render(NewsContent);
    await waitFor(() => {
      expect(screen.getByText('中文标题')).toBeInTheDocument();
    });
    expect(screen.queryByText('NEW')).not.toBeInTheDocument();
  });

  it('renders the item summary on the card', async () => {
    render(NewsContent);
    await waitFor(() => {
      expect(screen.getByText('这是一条测试摘要，概括了文章的核心内容。')).toBeInTheDocument();
    });
  });

  it('links snapshot items to the in-extension reader page', async () => {
    const { container } = render(NewsContent);
    await waitFor(() => {
      expect(screen.getByText('中文标题')).toBeInTheDocument();
    });
    const card = container.querySelector('a.card');
    expect(card?.getAttribute('href')).toContain('reader.html');
    expect(card?.getAttribute('href')).toContain('id=item-1');
  });
});
