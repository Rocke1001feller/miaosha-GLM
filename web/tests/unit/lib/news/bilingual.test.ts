/**
 * Unit tests: lib/news/bilingual.ts
 */

import { describe, it, expect } from 'vitest';
import { buildBilingualPairs } from '../../../../lib/news/bilingual';

const EN = '<div><p>Hello world</p><p>Second paragraph here</p><pre><code>const a=1</code></pre></div>';
const ZH = '<div><p>你好世界</p><p>Second paragraph here</p><pre><code>const a=1</code></pre></div>';

describe('buildBilingualPairs', () => {
  it('pairs top-level blocks by index and marks identical text as untranslated', () => {
    const pairs = buildBilingualPairs(EN, ZH);
    expect(pairs).toHaveLength(3);
    expect(pairs[0].zh).toContain('你好世界');
    expect(pairs[1].zh).toBeNull(); // identical text → no zh twin
    expect(pairs[2].zh).toBeNull(); // code block unchanged
  });

  it('sanitizes both sides', () => {
    const pairs = buildBilingualPairs(
      '<div><p onclick="x()">Hi</p></div>',
      '<div><p onclick="y()">你好</p></div>',
    );
    expect(pairs[0].en).not.toContain('onclick');
    expect(pairs[0].zh).not.toContain('onclick');
  });

  it('handles missing zh blocks gracefully', () => {
    const pairs = buildBilingualPairs('<div><p>One</p><p>Two</p></div>', '<div><p>一</p></div>');
    expect(pairs).toHaveLength(2);
    expect(pairs[1].zh).toBeNull();
  });
});
