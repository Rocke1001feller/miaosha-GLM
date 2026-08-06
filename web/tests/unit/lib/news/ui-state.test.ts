/**
 * Unit tests: lib/news/ui-state.ts
 */

import { describe, it, expect } from 'vitest';
import { newsUiState } from '../../../../lib/news/ui-state';

describe('newsUiState', () => {
  it('returns defaults when storage is empty', async () => {
    expect(await newsUiState.get()).toEqual({
      window: '24h',
      selectedSiteId: 'all',
      searchQuery: '',
      density: 'cozy',
      scrollTop: 0,
    });
  });

  it('merges partial patches without clobbering other fields', async () => {
    await newsUiState.set({ selectedSiteId: 'buzzing' });
    await newsUiState.set({ density: 'compact' });

    const state = await newsUiState.get();
    expect(state.selectedSiteId).toBe('buzzing');
    expect(state.density).toBe('compact');
    expect(state.window).toBe('24h');
    expect(state.searchQuery).toBe('');
  });

  it('persists scroll position', async () => {
    await newsUiState.set({ scrollTop: 420 });
    expect((await newsUiState.get()).scrollTop).toBe(420);
  });
});
