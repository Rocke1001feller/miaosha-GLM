import type { PlatformAuth } from '../../types';
import { MemoryStore } from './base';
import { ChromeStorageStore } from './storage-base';

export class MemoryAuthStore extends MemoryStore<PlatformAuth> {}

export class ChromeAuthStore extends ChromeStorageStore<PlatformAuth> {}

/**
 * Auth store is the only shared store still in use — consumed solely by
 * the bm-capture content script (`local:platformAuth`).
 */
export function createAuthStore(useChrome = true): ChromeAuthStore | MemoryAuthStore {
  return useChrome ? new ChromeAuthStore('local:platformAuth') : new MemoryAuthStore();
}
