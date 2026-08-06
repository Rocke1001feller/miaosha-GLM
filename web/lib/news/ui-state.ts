/**
 * News reader UI state (popup session continuity).
 *
 * The popup is destroyed every time it loses focus, so we persist the user's
 * viewing context (window / filters / density / scroll position) and restore
 * it on the next open — "继续上次阅读".
 */

import { storage } from '#imports';
import type { NewsWindow } from './types';

export type NewsDensity = 'cozy' | 'compact';

export interface NewsUiState {
  window: NewsWindow;
  selectedSiteId: string;
  searchQuery: string;
  density: NewsDensity;
  scrollTop: number;
}

const NEWS_UI_STATE_KEY = 'local:newsUiState';

const DEFAULTS: NewsUiState = {
  window: '24h',
  selectedSiteId: 'all',
  searchQuery: '',
  density: 'cozy',
  scrollTop: 0,
};

export const newsUiState = {
  async get(): Promise<NewsUiState> {
    const value = await storage.getItem<Partial<NewsUiState>>(NEWS_UI_STATE_KEY);
    return { ...DEFAULTS, ...(value ?? {}) };
  },

  /** Partial merge update — callers patch only what changed. */
  async set(patch: Partial<NewsUiState>): Promise<void> {
    const current = await newsUiState.get();
    await storage.setItem(NEWS_UI_STATE_KEY, { ...current, ...patch });
  },
};
