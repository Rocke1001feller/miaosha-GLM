/**
 * Regression tests: src/bm-main product loading orchestration
 *
 * These tests protect against the recurring bug where the Target Products
 * card stays in "No products loaded" because a content-script proxy for
 * /api/biz/pay/batch-preview is blocked by Alibaba WAF. Product loading now
 * fetches directly from the MAIN world using the page's current fetch (which
 * includes Sentry instrumentation headers that avoid WAF/rate-limit 555).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadBmMainModules, type BmMainScope } from './_harness';

const FIXTURE_PRODUCT_LIST = [
  { productId: 'y-pro', monthlyPayAmount: '119', payAmount: '1428', renewAmount: '1428', soldOut: false, campaignDiscountDetails: [] },
  { productId: 'q-pro', monthlyPayAmount: '139', payAmount: '417', renewAmount: '417', soldOut: false, campaignDiscountDetails: [] },
  { productId: 'm-pro', monthlyPayAmount: '159', payAmount: '159', renewAmount: '159', soldOut: false, campaignDiscountDetails: [] },
];

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function captureTimeouts(S: BmMainScope) {
  const captured: Array<{ fn: Function; ms: number }> = [];
  S.setTimeout = ((fn: Function, ms?: number) => {
    captured.push({ fn, ms: ms || 0 });
    return captured.length;
  }) as any;
  S.clearTimeout = () => {};
  return captured;
}

function makeAuthSandbox(S: BmMainScope) {
  S.document.cookie = 'bigmodel_token_production=eyJhbGci.test.token';
  (S.localStorage as any).getItem = (key: string) => {
    if (key === 'Bigmodel-Organization') return 'org-test';
    if (key === 'Bigmodel-Project') return 'proj-test';
    return null;
  };
}

describe('loadProducts', () => {
  let S: BmMainScope;

  beforeEach(() => {
    S = loadBmMainModules(['01-utils', '02-state', '05-product']);
    makeAuthSandbox(S);
  });

  it('fetches batch-preview via window.fetch with page-mimicking headers', async () => {
    const postMessage = vi.fn();
    (S.window as any).postMessage = postMessage;
    const fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ code: 200, data: { productList: FIXTURE_PRODUCT_LIST } }),
    });
    (S.window as any).fetch = fetch;

    const captured = captureTimeouts(S);
    (S.loadProducts as () => void)();
    await flushPromises();

    // The first attempt is deferred by BACKOFF_MS[0].
    expect(captured.length).toBe(1);
    expect(captured[0].ms).toBe(2500);

    captured[0].fn();
    await flushPromises();

    // Product loading must stay in the MAIN world: no command is posted to
    // the content script (a content-script proxy would be blocked by WAF).
    expect(postMessage).not.toHaveBeenCalledWith(
      expect.objectContaining({ __miaosha_cmd: true }),
      '*',
    );
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      'https://bigmodel.cn/api/biz/pay/batch-preview',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: expect.objectContaining({
          authorization: 'eyJhbGci.test.token',
          'bigmodel-organization': 'org-test',
          'bigmodel-project': 'proj-test',
          accept: 'application/json, text/plain, */*',
          'set-language': 'zh',
        }),
        body: '{"invitationCode":""}',
      }),
    );
    expect((S._productLoadStatus as any).status).toBe('loaded');
    expect(((S._productMatrix as any).yearly || []).length).toBe(1);
  });

  it('reuses cached page fetch data when available', async () => {
    const fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ code: 200, data: { productList: FIXTURE_PRODUCT_LIST } }),
    });
    (S.window as any).fetch = fetch;
    (S.window as any).__bm_batchPreviewData = FIXTURE_PRODUCT_LIST;

    (S.loadProducts as () => void)();
    await flushPromises();

    expect(fetch).not.toHaveBeenCalled();
    expect((S._productLoadStatus as any).status).toBe('loaded');
  });

  it('ignores automatic re-fetch when products are already loaded', async () => {
    const fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ code: 200, data: { productList: FIXTURE_PRODUCT_LIST } }),
    });
    (S.window as any).fetch = fetch;

    const captured = captureTimeouts(S);
    (S.loadProducts as () => void)();
    await flushPromises();
    captured[0].fn();
    await flushPromises();

    expect(fetch).toHaveBeenCalledTimes(1);
    expect((S._productLoadStatus as any).status).toBe('loaded');

    fetch.mockClear();
    (S.loadProducts as () => void)();
    await flushPromises();

    expect(fetch).not.toHaveBeenCalled();
    expect((S._productLoadStatus as any).status).toBe('loaded');
  });

  it('does not overwrite loaded products with a transient server error on forced refresh', async () => {
    const captured: Array<{ fn: Function; ms: number }> = [];
    S.setTimeout = ((fn: Function, ms?: number) => {
      captured.push({ fn, ms: ms || 0 });
      return captured.length;
    }) as any;
    S.clearTimeout = () => {};

    const fetch = vi.fn().mockResolvedValueOnce({
      json: () => Promise.resolve({ code: 200, data: { productList: FIXTURE_PRODUCT_LIST } }),
    }).mockResolvedValue({
      json: () => Promise.resolve({ code: 555, msg: 'System busy' }),
    });
    (S.window as any).fetch = fetch;

    // Initial load.
    (S.loadProducts as () => void)();
    await flushPromises();
    captured.shift()?.fn();
    await flushPromises();

    expect((S._productLoadStatus as any).status).toBe('loaded');
    expect(((S._productMatrix as any).yearly || []).length).toBe(1);

    // Force refresh: run all three deferred attempts; final failure should not
    // overwrite the already-loaded matrix.
    (S.loadProducts as (force: boolean) => void)(true);
    await flushPromises();

    for (let i = 0; i < 3 && captured.length > 0; i++) {
      captured.shift()?.fn();
      await flushPromises();
    }

    expect(fetch).toHaveBeenCalledTimes(4); // 1 initial + 3 forced retries
    expect((S._productLoadStatus as any).status).toBe('loaded');
    expect(((S._productMatrix as any).yearly || []).length).toBe(1);
  });

  it('renders auth error when the server returns code 1001', async () => {
    const fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ code: 1001, msg: 'unauthorized' }),
    });
    (S.window as any).fetch = fetch;

    const captured = captureTimeouts(S);
    (S.loadProducts as () => void)();
    await flushPromises();
    captured[0].fn();
    await flushPromises();

    expect((S._productLoadStatus as any).status).toBe('error');
    expect((S._authFailed as any)).toBe(true);
  });

  it('renders error after retries when the server returns a non-auth error', async () => {
    const captured: Array<{ fn: Function; ms: number }> = [];
    S.setTimeout = ((fn: Function, ms?: number) => {
      captured.push({ fn, ms: ms || 0 });
      return captured.length;
    }) as any;
    S.clearTimeout = () => {};

    const fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ code: 500, msg: 'server error' }),
    });
    (S.window as any).fetch = fetch;

    (S.loadProducts as () => void)();
    await flushPromises();

    expect(captured.length).toBe(1);
    // Trigger all three attempts; the last one should surface the error.
    for (let i = 0; i < 3 && captured.length > 0; i++) {
      captured.shift()?.fn();
      await flushPromises();
    }

    expect(fetch).toHaveBeenCalledTimes(3);
    expect((S._productLoadStatus as any).status).toBe('error');
  });

  it('renders error after retries when the network request fails', async () => {
    const captured: Array<{ fn: Function; ms: number }> = [];
    S.setTimeout = ((fn: Function, ms?: number) => {
      captured.push({ fn, ms: ms || 0 });
      return captured.length;
    }) as any;
    S.clearTimeout = () => {};

    const fetch = vi.fn().mockRejectedValue(new Error('network failure'));
    (S.window as any).fetch = fetch;

    (S.loadProducts as () => void)();
    await flushPromises();

    // Trigger all three attempts; the last one should surface the error.
    for (let i = 0; i < 3 && captured.length > 0; i++) {
      captured.shift()?.fn();
      await flushPromises();
    }

    expect(fetch).toHaveBeenCalledTimes(3);
    expect((S._productLoadStatus as any).status).toBe('error');
  });

  it('shows auth error when no auth headers are available', () => {
    S.document.cookie = '';
    (S.localStorage as any).getItem = () => null;

    (S.loadProducts as () => void)();

    expect((S._productLoadStatus as any).status).toBe('error');
    expect((S._productLoadStatus as any).error).toBe('auth-missing');
  });
});

describe('buildProductMatrix with real-world shapes', () => {
  let S: BmMainScope;

  beforeAll(() => {
    S = loadBmMainModules(['01-utils', '02-state', '05-product']);
  });

  it('handles numeric amounts (not just strings)', () => {
    const matrix = (S.buildProductMatrix as (list: unknown[]) => Record<string, unknown[]>)([
      { productId: 'y-pro', monthlyPayAmount: 119, payAmount: 1428, renewAmount: 1428, soldOut: false, campaignDiscountDetails: [] },
    ]);
    expect(matrix.yearly).toHaveLength(1);
  });

  it('classifies billing via campaignDiscountDetails fallback', () => {
    const matrix = (S.buildProductMatrix as (list: unknown[]) => Record<string, unknown[]>)([
      { productId: 'x-lite', monthlyPayAmount: 0, payAmount: 0, campaignDiscountDetails: [{ campaignName: '连续包年 8 折' }] },
    ]);
    expect(matrix.yearly).toHaveLength(1);
  });

  it('returns empty groups for an empty list without throwing', () => {
    const matrix = (S.buildProductMatrix as (list: unknown[]) => Record<string, unknown[]>)([]);
    expect(matrix.monthly).toHaveLength(0);
    expect(matrix.quarterly).toHaveLength(0);
    expect(matrix.yearly).toHaveLength(0);
  });
});
