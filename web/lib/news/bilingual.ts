/**
 * Bilingual rendering helpers for the reader page.
 *
 * The pipeline stores content_html + content_html_zh with identical DOM
 * structure (zh is the same tree with text nodes translated). Pair top-level
 * blocks by index; a pair keeps `zh: null` when the block was left
 * untranslated (identical text), so bilingual mode degrades gracefully.
 */

import { sanitizeArticleHtml } from './sanitize';
import type { SnapshotBlock } from './types';

export interface BilingualPair {
  en: string;
  zh: string | null;
}

function topLevelBlocks(body: HTMLElement): Element[] {
  if (body.children.length === 1 && body.children[0].tagName === 'DIV') {
    return Array.from(body.children[0].children);
  }
  return Array.from(body.children);
}

export function buildBilingualPairs(enHtml: string, zhHtml: string): BilingualPair[] {
  const parser = new DOMParser();
  const enBody = parser.parseFromString(enHtml, 'text/html').body;
  const zhBody = parser.parseFromString(zhHtml, 'text/html').body;
  const enBlocks = topLevelBlocks(enBody);
  const zhBlocks = topLevelBlocks(zhBody);

  return enBlocks.map((enEl, i) => {
    const zhEl = zhBlocks[i] ?? null;
    const enText = (enEl.textContent ?? '').trim();
    const zhText = zhEl ? (zhEl.textContent ?? '').trim() : '';
    const zh = zhEl && zhText && zhText !== enText ? sanitizeArticleHtml(zhEl.outerHTML) : null;
    return { en: sanitizeArticleHtml(enEl.outerHTML), zh };
  });
}

/** Join a block's translated sentences into paragraph text (null if none). */
export function blockZhText(block: SnapshotBlock): string | null {
  const parts = block.sentences.map((s) => s.zh).filter((zh): zh is string => !!zh);
  return parts.length > 0 ? parts.join(' ') : null;
}

/**
 * Paragraph-level pairs built from the sentence-level contract:
 * en = the block's original (sanitized) HTML, zh = joined sentence
 * translations. Used by 双语·段 mode.
 */
export function buildParagraphPairsFromBlocks(blocks: SnapshotBlock[]): BilingualPair[] {
  return blocks.map((block) => ({
    en: sanitizeArticleHtml(block.html_en),
    zh: block.sentences.length === 0 ? null : blockZhText(block),
  }));
}

/** Text of a block in zh-only mode: joined zh, else the raw block text. */
export function blockZhOnlyText(block: SnapshotBlock): string {
  const zh = blockZhText(block);
  if (zh) return zh;
  const text = block.html_en.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text;
}
