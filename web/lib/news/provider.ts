/**
 * News provider registry.
 *
 * Mirrors the platform adapter registry pattern in lib/platform/registry.ts.
 * Keeps the data source contract abstract so UI and fetch strategy can evolve
 * independently.
 */

import type { NewsProvider } from './types';

class NewsProviderRegistry {
  private readonly providers = new Map<string, NewsProvider>();

  register(provider: NewsProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: string): NewsProvider | undefined {
    return this.providers.get(id);
  }

  list(): readonly NewsProvider[] {
    return Array.from(this.providers.values());
  }
}

export const newsProviderRegistry = new NewsProviderRegistry();

export function registerNewsProvider(provider: NewsProvider): void {
  newsProviderRegistry.register(provider);
}

export function getDefaultNewsProvider(): NewsProvider {
  const provider = newsProviderRegistry.get('gh-pages');
  if (!provider) {
    throw new Error('No default news provider registered');
  }
  return provider;
}
