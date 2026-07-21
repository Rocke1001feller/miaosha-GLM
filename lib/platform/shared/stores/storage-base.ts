import { storage } from '#imports';

/**
 * Chrome-storage-backed observable store for popup, content scripts and background.
 * Keeps a synchronous in-memory cache so get() is non-blocking.
 */
export class ChromeStorageStore<T> {
  protected value: T | null = null;
  private readonly listeners = new Set<(value: T | null) => void>();
  private initialized = false;
  private readonly pendingWatchers = new Set<(value: T | null) => void>();

  constructor(private readonly key: string) {
    this.init();
  }

  private async init(): Promise<void> {
    try {
      const stored = await storage.getItem<T>(this.key);
      this.value = stored ?? null;
    } catch {
      this.value = null;
    }
    this.initialized = true;

    // Replay watchers that registered before init
    this.pendingWatchers.forEach((cb) => this.listeners.add(cb));
    this.pendingWatchers.clear();
    this.notify();
  }

  get(): T | null {
    return this.value;
  }

  watch(callback: (value: T | null) => void): () => void {
    if (!this.initialized) {
      this.pendingWatchers.add(callback);
    } else {
      this.listeners.add(callback);
      if (this.value !== null) {
        try {
          callback(this.value);
        } catch {
          // ignore
        }
      }
    }
    return () => {
      this.pendingWatchers.delete(callback);
      this.listeners.delete(callback);
    };
  }

  async set(value: T): Promise<void> {
    this.value = value;
    try {
      await storage.setItem<T>(this.key, value);
    } catch {
      // ignore write failures
    }
    this.notify();
  }

  async clear(): Promise<void> {
    this.value = null;
    try {
      await storage.removeItem(this.key);
    } catch {
      // ignore
    }
    this.notify();
  }

  protected notify(): void {
    this.listeners.forEach((cb) => {
      try {
        cb(this.value ?? null);
      } catch {
        // isolate listener failures
      }
    });
  }
}
