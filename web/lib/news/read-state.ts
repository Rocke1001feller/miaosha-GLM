/**
 * News read state: what the user has already seen / opened.
 *
 * - lastSeenAt: high-water mark of the previous popup session. Items with
 *   first_seen_at newer than this get a NEW badge on next open.
 * - readIds: items the user clicked through. Capped FIFO to bound storage.
 */

import { storage } from '#imports';

const NEWS_READ_STATE_KEY = 'local:newsReadState';
const MAX_READ_IDS = 2000;

export interface NewsReadState {
  lastSeenAt: string | null;
  readIds: string[];
}

const EMPTY: NewsReadState = { lastSeenAt: null, readIds: [] };

export const newsReadState = {
  async get(): Promise<NewsReadState> {
    const value = await storage.getItem<NewsReadState>(NEWS_READ_STATE_KEY);
    return value ?? EMPTY;
  },

  async setLastSeenAt(iso: string): Promise<void> {
    const state = await newsReadState.get();
    await storage.setItem(NEWS_READ_STATE_KEY, { ...state, lastSeenAt: iso });
  },

  /** Returns the updated id list so callers can refresh in-memory state. */
  async markRead(id: string): Promise<string[]> {
    const state = await newsReadState.get();
    if (state.readIds.includes(id)) {
      return state.readIds;
    }
    const readIds = [...state.readIds, id].slice(-MAX_READ_IDS);
    await storage.setItem(NEWS_READ_STATE_KEY, { ...state, readIds });
    return readIds;
  },
};
