/**
 * Unit tests: lib/news/provider.ts
 */

import { describe, it, expect } from 'vitest';
import {
  newsProviderRegistry,
  getDefaultNewsProvider,
  registerNewsProvider,
} from '../../../../lib/news/provider';
import type { NewsData, NewsProvider } from '../../../../lib/news/types';

const mockProvider: NewsProvider = {
  id: 'gh-pages',
  name: 'Mock GitHub Pages',
  fetchFeed: async () => ({ generated_at: '' } as NewsData),
};

describe('newsProviderRegistry', () => {
  it('returns undefined for an unregistered provider', () => {
    expect(newsProviderRegistry.get('missing')).toBeUndefined();
  });

  it('registers and retrieves a provider', () => {
    registerNewsProvider(mockProvider);
    expect(newsProviderRegistry.get('gh-pages')).toBe(mockProvider);
  });

  it('lists all registered providers', () => {
    expect(newsProviderRegistry.list().some((p) => p.id === 'gh-pages')).toBe(true);
  });

  it('keeps multiple providers in the registry', () => {
    const other: NewsProvider = {
      id: 'other',
      name: 'Other',
      fetchFeed: async () => ({ generated_at: '' } as NewsData),
    };
    registerNewsProvider(other);
    expect(newsProviderRegistry.list().some((p) => p.id === 'other')).toBe(true);
  });

  it('returns the default provider when gh-pages is registered', () => {
    expect(getDefaultNewsProvider()).toBe(mockProvider);
  });
});
