/** Shared contracts for the popup usage tab (four platforms, M6 replay). */

export type UsagePlatform = 'minimax' | 'kimi' | 'mimo' | 'volcengine';

export interface UsageBar {
  label: string;
  /** 0-1 usage ratio. */
  percent: number;
  /** Raw counter text, e.g. '8,162,846,607 / 49,200,000,000'. */
  usedText?: string;
  /** Epoch ms when the quota resets; undefined when unknown/not applicable. */
  resetAt?: number;
}

export type UsageStatus = 'ok' | 'needs_login' | 'no_subscription' | 'error';

export interface UsageCardData {
  platform: UsagePlatform;
  displayName: string;
  consoleUrl: string;
  planName?: string;
  status: UsageStatus;
  bars: UsageBar[];
  note?: string;
  fetchedAt: number;
  errorMessage?: string;
}

export type UsageCache = Partial<Record<UsagePlatform, UsageCardData>>;
