/**
 * Unit tests: lib/news/links.ts + lib/news/sanitize.ts
 */

import { describe, it, expect } from 'vitest';
import { articleJsonUrl, cardHref } from '../../../../lib/news/links';
import { sanitizeArticleHtml } from '../../../../lib/news/sanitize';
import type { NewsItem } from '../../../../lib/news/types';

const baseItem: NewsItem = {
  id: 'abc123',
  site_id: 's',
  site_name: 'S',
  source: 'src',
  title: 't',
  url: 'https://example.com/a',
  published_at: null,
  first_seen_at: '2026-07-19T00:00:00Z',
  last_seen_at: '2026-07-19T00:00:00Z',
  title_original: 't',
  title_en: null,
  title_zh: null,
  title_bilingual: 't',
};

describe('links', () => {
  it('builds the article json url on the pages host', () => {
    expect(articleJsonUrl('abc123')).toBe(
      'https://rocke1001feller.github.io/ai-news/data/articles/abc123.json',
    );
  });

  it('routes snapshot items to the in-extension reader page', () => {
    const href = cardHref({ ...baseItem, has_snapshot: true });
    expect(href).toContain('reader.html');
    expect(href).toContain('id=abc123');
  });

  it('routes non-snapshot items to the original url directly', () => {
    expect(cardHref(baseItem)).toBe('https://example.com/a');
    expect(cardHref({ ...baseItem, has_snapshot: false })).toBe('https://example.com/a');
  });
});

describe('sanitizeArticleHtml', () => {
  it('strips scripts and event handlers but keeps article markup', () => {
    const dirty =
      '<p onclick="x()">Hello <b>world</b></p><script>alert(1)</script><iframe src="x"></iframe>';
    const clean = sanitizeArticleHtml(dirty);
    expect(clean).toContain('<b>world</b>');
    expect(clean).not.toContain('script');
    expect(clean).not.toContain('iframe');
    expect(clean).not.toContain('onclick');
  });

  it('neutralises javascript: urls', () => {
    const clean = sanitizeArticleHtml('<a href="javascript:alert(1)">x</a>');
    expect(clean).not.toContain('javascript:');
  });
});
