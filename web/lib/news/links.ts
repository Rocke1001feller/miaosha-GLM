/**
 * Link helpers: where a news card click should land.
 *
 * - Snapshot available → in-extension reader page (full text, offline-friendly)
 * - Otherwise → the original URL directly (user's own network decides)
 */

import type { NewsItem } from './types';
import { BASE_URL } from './providers/gh-pages';

export function articleJsonUrl(id: string): string {
  return `${BASE_URL}/data/articles/${id}.json`;
}

/** The href a news card should point to. */
export function cardHref(item: NewsItem): string {
  if (item.has_snapshot) {
    const params = new URLSearchParams({ id: item.id, url: item.url });
    return `${chrome.runtime.getURL('reader.html')}?${params.toString()}`;
  }
  return item.url;
}
