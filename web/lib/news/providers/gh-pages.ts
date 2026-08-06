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
 * 现行国内反代(根路径子域名,与 gh-pages 同源内容,2026-07-26 上线)。
 * 注意:它服务在根路径,feed URL 不带 /ai-news 前缀。
 */
export const STORE_BASE_URL = 'https://ai-news.poorhub.store';

/**
 * 过渡镜像(xiaocha.online 子路径反代,poorhub.store 家族启用前的旧入口;
 * 运维宣布下线后删除,见 any-comments example-showcase/domain-migration.md)。
 */
export const FALLBACK_BASE_URL = 'https://xiaocha.online/ai-news';

/** 依次尝试:gh-pages 源站 → poorhub.store 现行反代 → xiaocha 过渡镜像。 */
const SOURCES = [BASE_URL, STORE_BASE_URL, FALLBACK_BASE_URL] as const;

function feedUrl(base: string, window: NewsWindow): string {
  return `${base}/data/latest-${window}.json`;
}

export const ghPagesNewsProvider: NewsProvider = {
  id: 'gh-pages',
  name: 'AI 聚合新闻',

  async fetchFeed(window: NewsWindow): Promise<NewsData> {
    let lastError: Error = new Error('no news source attempted');
    for (const base of SOURCES) {
      const res = await fetch(feedUrl(base, window)).catch((e: unknown) => {
        lastError = e instanceof Error ? e : new Error(String(e));
        return null;
      });
      if (res?.ok) {
        return (await res.json()) as NewsData;
      }
      if (res) {
        lastError = new Error(`News feed failed: ${res.status} ${res.statusText}`);
      }
    }
    throw lastError;
  },
};
