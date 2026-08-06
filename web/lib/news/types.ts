/**
 * AI News Aggregator data types.
 *
 * Mirrored from ai-news-aggregator-main/web/src/types/index.ts
 * to decouple the extension UI from the upstream web codebase.
 */

export interface NewsItem {
  id: string;
  site_id: string;
  site_name: string;
  source: string;
  title: string;
  url: string;
  published_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  title_original: string;
  title_en: string | null;
  title_zh: string | null;
  title_bilingual: string;
  /** Pipeline-generated extractive summary (absent on items without one). */
  summary?: string;
  /** zh-CN translation of summary (build-time, google gtx). */
  summary_zh?: string;
  /** True when data/articles/<id>.json exists on the Pages host. */
  has_snapshot?: boolean;
}

/** Full-text snapshot produced by the pipeline's snapshot step. */
export interface ArticleSnapshot {
  id: string;
  url: string;
  title: string;
  site_name: string;
  source: string;
  byline: string | null;
  excerpt: string | null;
  content_html: string;
  /** zh-CN mirror of content_html (identical structure, text translated). */
  content_html_zh?: string;
  /** Whether content_html_zh has any translated blocks. */
  translated?: boolean;
  /**
   * Sentence-level bilingual pairs per block (contract v2).
   * Alignment is guaranteed by the pipeline; blocks with empty `sentences`
   * are non-English/raw blocks to render as-is.
   */
  blocks?: SnapshotBlock[];
  content_text: string;
  fetched_at: string;
  ok: boolean;
  error?: string;
}

/** One block-level element in the sentence-level bilingual contract. */
export interface SnapshotBlock {
  /** The block's original HTML (markup preserved). */
  html_en: string;
  sentences: Array<{ en: string; zh: string | null }>;
}

export interface SiteStat {
  site_id: string;
  site_name: string;
  count: number;
  raw_count: number;
}

export interface NewsData {
  generated_at: string;
  window_hours: number;
  total_items: number;
  total_items_ai_raw: number;
  total_items_raw: number;
  total_items_all_mode: number;
  topic_filter: string;
  archive_total: number;
  site_count: number;
  source_count: number;
  site_stats: SiteStat[];
  items: NewsItem[];
}

export interface SiteStatus {
  site_id: string;
  site_name: string;
  ok: boolean;
  item_count: number;
  duration_ms: number;
  error: string | null;
}

export interface SourceStatus {
  generated_at: string;
  sites: SiteStatus[];
  successful_sites: number;
  failed_sites: string[];
  zero_item_sites: string[];
  fetched_raw_items: number;
  items_before_topic_filter: number;
  items_in_24h: number;
}

export type NewsWindow = '24h' | '7d';

export interface NewsProvider {
  readonly id: string;
  readonly name: string;
  fetchFeed(window: NewsWindow): Promise<NewsData>;
}
