/**
 * Stale-while-revalidate cache for the news feed.
 *
 * Stores the last fetched payload in chrome.storage.local so the popup can
 * render immediately on open, then refresh in the background.
 */

import { storage } from '#imports';
import type { NewsData, NewsWindow } from './types';

const NEWS_CACHE_KEY = 'local:newsCache';

export interface NewsCacheEntry {
  fetchedAt: string;
  window: NewsWindow;
  payload: NewsData;
}

export const newsCache = {
  async get(window: NewsWindow): Promise<NewsCacheEntry | null> {
    const entry = await storage.getItem<NewsCacheEntry>(NEWS_CACHE_KEY);
    if (!entry || entry.window !== window) {
      return null;
    }
    return entry;
  },

  async set(window: NewsWindow, payload: NewsData): Promise<void> {
    const entry: NewsCacheEntry = {
      fetchedAt: new Date().toISOString(),
      window,
      payload,
    };
    await storage.setItem(NEWS_CACHE_KEY, entry);
  },

  async clear(): Promise<void> {
    await storage.removeItem(NEWS_CACHE_KEY);
  },
};
