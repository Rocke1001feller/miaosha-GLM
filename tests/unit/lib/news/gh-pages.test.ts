/**
 * Unit tests: lib/news/providers/gh-pages.ts — mainland mirror fallback.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  ghPagesNewsProvider,
  BASE_URL,
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

  it('falls back to the mainland mirror when the origin throws', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(okResponse(feed));
    vi.stubGlobal('fetch', fetchMock);

    const data = await ghPagesNewsProvider.fetchFeed('7d');

    expect(data).toEqual(feed);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe(`${FALLBACK_BASE_URL}/data/latest-7d.json`);
  });

  it('falls back to the mainland mirror when the origin answers !ok', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('nope', { status: 503, statusText: 'Service Unavailable' }))
      .mockResolvedValueOnce(okResponse(feed));
    vi.stubGlobal('fetch', fetchMock);

    const data = await ghPagesNewsProvider.fetchFeed('24h');

    expect(data).toEqual(feed);
    expect(fetchMock.mock.calls[1][0]).toBe(`${FALLBACK_BASE_URL}/data/latest-24h.json`);
  });

  it('throws with the mirror status when both endpoints fail', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(new Response('gone', { status: 502, statusText: 'Bad Gateway' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(ghPagesNewsProvider.fetchFeed('24h')).rejects.toThrow('News feed failed: 502');
  });
});
