/**
 * Component tests: entrypoints/reader/App.svelte
 *
 * Verifies the snapshot-first reader page: fetches the article JSON, renders
 * sanitized content, and falls back to proxy/original links on failure.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/svelte';
import ReaderApp from '../../../entrypoints/reader/App.svelte';
import type { ArticleSnapshot } from '../../../lib/news/types';

const snapshot: ArticleSnapshot = {
  id: 'abc123',
  url: 'https://example.com/a',
  title: '测试文章标题',
  site_name: 'Site One',
  source: 'Source A',
  byline: null,
  excerpt: null,
  content_html: '<div><p>Hello bilingual world</p><script>alert(1)</script></div>',
  content_html_zh: '<div><p>你好，双语世界</p></div>',
  translated: true,
  blocks: [
    {
      html_en: '<p>Hello bilingual world</p>',
      sentences: [{ en: 'Hello bilingual world', zh: '你好，双语世界' }],
    },
  ],
  content_text: 'Hello bilingual world',
  fetched_at: '2026-07-19T05:00:00Z',
  ok: true,
};

function setQuery(search: string) {
  window.history.replaceState({}, '', `/reader.html${search}`);
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/data/articles/missing.json')) {
        return new Response('not found', { status: 404 });
      }
      return new Response(JSON.stringify(snapshot), { status: 200 });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ReaderApp', () => {
  it('renders the snapshot title and sanitized content', async () => {
    setQuery('?id=abc123&url=https%3A%2F%2Fexample.com%2Fa');
    render(ReaderApp);
    await waitFor(() => {
      expect(screen.getByText('测试文章标题')).toBeInTheDocument();
    });
    expect(document.querySelector('script')).toBeNull();
  });

  it('renders sentence-level bilingual pairs by default when blocks exist', async () => {
    setQuery('?id=abc123&url=https%3A%2F%2Fexample.com%2Fa');
    render(ReaderApp);
    await waitFor(() => {
      expect(screen.getByText('Hello bilingual world')).toBeInTheDocument();
      expect(screen.getByText('你好，双语世界')).toBeInTheDocument();
    });
    // 4-mode granularity toggle visible
    expect(screen.getByRole('button', { name: '双语·句' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '双语·段' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '中文' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'EN' })).toBeInTheDocument();
  });

  it('switches to paragraph mode when clicking 双语·段', async () => {
    setQuery('?id=abc123&url=https%3A%2F%2Fexample.com%2Fa');
    const { getByRole, container } = render(ReaderApp);
    await waitFor(() => {
      expect(screen.getByText('你好，双语世界')).toBeInTheDocument();
    });
    getByRole('button', { name: '双语·段' }).click();
    await waitFor(() => {
      expect(container.querySelector('.bilingual .pair')).not.toBeNull();
      expect(screen.getByText('你好，双语世界')).toBeInTheDocument();
    });
  });

  it('switches to zh-only mode when clicking 中文', async () => {
    setQuery('?id=abc123&url=https%3A%2F%2Fexample.com%2Fa');
    const { getByRole } = render(ReaderApp);
    await waitFor(() => {
      expect(screen.getByText('你好，双语世界')).toBeInTheDocument();
    });
    getByRole('button', { name: '中文' }).click();
    await waitFor(() => {
      expect(screen.queryByText('Hello bilingual world')).not.toBeInTheDocument();
      expect(screen.getByText('你好，双语世界')).toBeInTheDocument();
    });
  });

  it('switches to en-only mode when clicking EN', async () => {
    setQuery('?id=abc123&url=https%3A%2F%2Fexample.com%2Fa');
    const { getByRole } = render(ReaderApp);
    await waitFor(() => {
      expect(screen.getByText('你好，双语世界')).toBeInTheDocument();
    });
    getByRole('button', { name: 'EN' }).click();
    await waitFor(() => {
      expect(screen.getByText('Hello bilingual world')).toBeInTheDocument();
      expect(screen.queryByText('你好，双语世界')).not.toBeInTheDocument();
    });
  });

  it('fetches the article json from the pages host', async () => {
    setQuery('?id=abc123&url=https%3A%2F%2Fexample.com%2Fa');
    render(ReaderApp);
    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        'https://rocke1001feller.github.io/ai-news/data/articles/abc123.json',
      );
    });
  });

  it('falls back to the original link when the snapshot is missing', async () => {
    setQuery('?id=missing&url=https%3A%2F%2Fexample.com%2Fa');
    render(ReaderApp);
    await waitFor(() => {
      expect(screen.getByText('快照不可用')).toBeInTheDocument();
    });
    const links = [...document.querySelectorAll('a.btn')].map((a) => a.getAttribute('href'));
    expect(links).toEqual(['https://example.com/a']);
  });
});
