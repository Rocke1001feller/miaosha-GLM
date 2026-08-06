/**
 * Unit tests: lib/news/providers/gh-pages.ts — fallback chain:
 * gh-pages 源站 → ai-news.poorhub.store 现行反代 → xiaocha.online 过渡镜像。
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  ghPagesNewsProvider,
  BASE_URL,
  STORE_BASE_URL,
  FALLBACK_BASE_URL,
} from '../../../../lib/news/providers/gh-pages';
import type { NewsData } from '../../../../lib/news/types';

const feed = { generated_at: '2026-07-21T00:00:00Z' } as unknown as NewsData;

function okResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ghPagesNewsProvider.fetchFeed', () => {
  it('serves from the origin when it responds ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse(feed));
    vi.stubGlobal('fetch', fetchMock);

    const data = await ghPagesNewsProvider.fetchFeed('24h');

    expect(data).toEqual(feed);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE_URL}/data/latest-24h.json`);
  });

  it('falls back to poorhub.store when the origin throws', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(okResponse(feed));
    vi.stubGlobal('fetch', fetchMock);

    const data = await ghPagesNewsProvider.fetchFeed('7d');

    expect(data).toEqual(feed);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(`${STORE_BASE_URL}/data/latest-7d.json`);
  });

  it('poorhub.store feed URL is root-relative (no /ai-news prefix)', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('nope', { status: 503 }))
      .mockResolvedValueOnce(okResponse(feed));
    vi.stubGlobal('fetch', fetchMock);

    await ghPagesNewsProvider.fetchFeed('24h');

    expect(fetchMock.mock.calls[1][0]).toBe('https://ai-news.poorhub.store/data/latest-24h.json');
  });

  it('falls back to the legacy xiaocha mirror when origin and store both fail', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response('gone', { status: 502 }))
      .mockResolvedValueOnce(okResponse(feed));
    vi.stubGlobal('fetch', fetchMock);

    const data = await ghPagesNewsProvider.fetchFeed('24h');

    expect(data).toEqual(feed);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toBe(`${FALLBACK_BASE_URL}/data/latest-24h.json`);
  });

  it('throws with the last endpoint status when all sources fail', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response('gone', { status: 502, statusText: 'Bad Gateway' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(ghPagesNewsProvider.fetchFeed('24h')).rejects.toThrow('News feed failed: 502');
  });
});
