/**
 * GitHub Pages news provider.
 *
 * Reads the static JSON published by ai-news-aggregator every 2 hours.
 * The upstream site sends `access-control-allow-origin: *`, but we still
 * request host_permissions for `*://rocke1001feller.github.io/*` to keep CORS behavior
 * deterministic under MV3.
 */

import type { NewsData, NewsProvider, NewsWindow } from '../types';

export const BASE_URL = 'https://rocke1001feller.github.io/ai-news';

/**
 * Mainland-China mirror, reverse-proxied to the same GitHub Pages content
 * (byte-identical, nginx-cached). Used when the origin is unreachable.
 */
export const FALLBACK_BASE_URL = 'https://xiaocha.online/ai-news';

function feedUrl(base: string, window: NewsWindow): string {
  return `${base}/data/latest-${window}.json`;
}

export const ghPagesNewsProvider: NewsProvider = {
  id: 'gh-pages',
  name: 'AI 聚合新闻',

  async fetchFeed(window: NewsWindow): Promise<NewsData> {
    const res = await fetch(feedUrl(BASE_URL, window)).catch(() => null);
    if (res?.ok) {
      return (await res.json()) as NewsData;
    }
    const fallback = await fetch(feedUrl(FALLBACK_BASE_URL, window));
    if (!fallback.ok) {
      throw new Error(`News feed failed: ${fallback.status} ${fallback.statusText}`);
    }
    return (await fallback.json()) as NewsData;
  },
};
