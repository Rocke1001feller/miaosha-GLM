/**
 * Unit tests: lib/news/read-state.ts
 */

import { describe, it, expect } from 'vitest';
import { newsReadState } from '../../../../lib/news/read-state';

describe('newsReadState', () => {
  it('returns empty state when storage is empty', async () => {
    expect(await newsReadState.get()).toEqual({ lastSeenAt: null, readIds: [] });
  });

  it('persists the lastSeenAt high-water mark', async () => {
    await newsReadState.setLastSeenAt('2026-07-17T00:00:00.000Z');
    expect((await newsReadState.get()).lastSeenAt).toBe('2026-07-17T00:00:00.000Z');
  });

  it('appends read ids and keeps lastSeenAt intact', async () => {
    await newsReadState.setLastSeenAt('2026-07-17T00:00:00.000Z');
    await newsReadState.markRead('a');
    const ids = await newsReadState.markRead('b');

    expect(ids).toEqual(['a', 'b']);
    const state = await newsReadState.get();
    expect(state.readIds).toEqual(['a', 'b']);
    expect(state.lastSeenAt).toBe('2026-07-17T00:00:00.000Z');
  });

  it('does not duplicate ids', async () => {
    await newsReadState.markRead('a');
    const ids = await newsReadState.markRead('a');
    expect(ids).toEqual(['a']);
  });
});
