/**
 * News module public API.
 *
 * Importing this module registers the default GitHub Pages provider.
 */

export * from './types';
export { newsProviderRegistry, registerNewsProvider, getDefaultNewsProvider } from './provider';
export { newsCache, type NewsCacheEntry } from './cache';
export { newsUiState, type NewsUiState, type NewsDensity } from './ui-state';
export { newsReadState, type NewsReadState } from './read-state';
export { articleJsonUrl, cardHref } from './links';
export { sanitizeArticleHtml } from './sanitize';
export { buildBilingualPairs, buildParagraphPairsFromBlocks, blockZhText, blockZhOnlyText, type BilingualPair } from './bilingual';

import { ghPagesNewsProvider } from './providers/gh-pages';
import { registerNewsProvider } from './provider';

registerNewsProvider(ghPagesNewsProvider);
