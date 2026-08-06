/**
 * Minimal HTML sanitizer for article snapshots.
 *
 * Snapshots come from our own pipeline (Readability output), but the source
 * HTML is third-party — strip anything executable or form-like before
 * injecting via {@html}.
 */

const BLOCK_TAG_PATTERN =
  /<(script|style|iframe|object|embed|form|link|meta|noscript|button|input|select|textarea)[\s\S]*?<\/\1>/gi;
const SELF_CLOSING_BLOCK_PATTERN =
  /<(script|style|iframe|object|embed|form|link|meta|noscript|button|input|select|textarea)[^>]*\/?>/gi;
const EVENT_ATTR_PATTERN = /\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi;
const JS_URL_PATTERN = /(href|src)\s*=\s*(["']?)\s*javascript:[^"'>\s]*\2/gi;

export function sanitizeArticleHtml(html: string): string {
  return html
    .replace(BLOCK_TAG_PATTERN, '')
    .replace(SELF_CLOSING_BLOCK_PATTERN, '')
    .replace(EVENT_ATTR_PATTERN, '')
    .replace(JS_URL_PATTERN, '$1$2#$2');
}
