/**
 * In-memory observable store for surfaces that cannot access chrome.storage,
 * primarily the MAIN world overlay scripts.
 */
export class MemoryStore<T> {
  protected value: T | null = null;
  private readonly listeners = new Set<(value: T | null) => void>();

  get(): T | null {
    return this.value;
  }

  watch(callback: (value: T | null) => void): () => void {
    this.listeners.add(callback);
    if (this.value !== null) {
      try {
        callback(this.value);
      } catch {
        // ignore listener errors
      }
    }
    return () => {
      this.listeners.delete(callback);
    };
  }

  async set(value: T): Promise<void> {
    this.value = value;
    this.notify();
  }

  async clear(): Promise<void> {
    this.value = null;
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
