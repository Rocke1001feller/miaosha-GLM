/**
 * Unit tests: src/bm-main/05-product.js — buildProductMatrix + priority helpers
 *
 * Requires 01-utils (inferBillingFromPreview, formatAmount, getPromoTag,
 * getRenewLabel) which 05-product calls internally.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { loadBmMainModules, type BmMainScope } from './_harness';

// Fixture: 9 products — 3 per billing cycle (monthly/quarterly/yearly),
// each representing Lite/Pro/Max tiers sorted by price.
const FIXTURE_PRODUCT_LIST = [
  // Yearly
  { productId: 'y-lite', monthlyPayAmount: '59',  payAmount: '708',  renewAmount: '708',  soldOut: false, campaignDiscountDetails: [] },
  { productId: 'y-pro',  monthlyPayAmount: '119', payAmount: '1428', renewAmount: '1428', soldOut: false, campaignDiscountDetails: [] },
  { productId: 'y-max',  monthlyPayAmount: '239', payAmount: '2868', renewAmount: '2868', soldOut: true,  campaignDiscountDetails: [] },
  // Quarterly
  { productId: 'q-lite', monthlyPayAmount: '69',  payAmount: '207',  renewAmount: '207',  soldOut: false, campaignDiscountDetails: [] },
  { productId: 'q-pro',  monthlyPayAmount: '139', payAmount: '417',  renewAmount: '417',  soldOut: false, campaignDiscountDetails: [] },
  { productId: 'q-max',  monthlyPayAmount: '279', payAmount: '837',  renewAmount: '837',  soldOut: false, campaignDiscountDetails: [] },
  // Monthly
  { productId: 'm-lite', monthlyPayAmount: '79',  payAmount: '79',   renewAmount: '79',   soldOut: false, campaignDiscountDetails: [] },
  { productId: 'm-pro',  monthlyPayAmount: '159', payAmount: '159',  renewAmount: '159',  soldOut: false, campaignDiscountDetails: [] },
  { productId: 'm-max',  monthlyPayAmount: '319', payAmount: '319',  renewAmount: '319',  soldOut: false, campaignDiscountDetails: [] },
];

let S: BmMainScope;

beforeAll(() => {
  // 02-state defines _planOrder, _productMatrix, _billing, _priorityList
  // which buildProductMatrix and helpers rely on. 01-utils provides inferBillingFromPreview.
  S = loadBmMainModules(['01-utils', '02-state', '05-product']);
});

describe('buildProductMatrix', () => {
  const buildMatrix = () =>
    (S.buildProductMatrix as (list: unknown[]) => unknown)(FIXTURE_PRODUCT_LIST);

  it('returns an object with monthly/quarterly/yearly keys', () => {
    const matrix = buildMatrix() as Record<string, unknown[]>;
    expect(matrix).toHaveProperty('monthly');
    expect(matrix).toHaveProperty('quarterly');
    expect(matrix).toHaveProperty('yearly');
  });

  it('puts exactly 3 products in each billing group', () => {
    const matrix = buildMatrix() as Record<string, unknown[]>;
    expect(matrix.monthly).toHaveLength(3);
    expect(matrix.quarterly).toHaveLength(3);
    expect(matrix.yearly).toHaveLength(3);
  });

  it('assigns Lite/Pro/Max names in price-ascending order', () => {
    const matrix = buildMatrix() as Record<string, Array<{ name: string }>>;
    expect(matrix.monthly[0].name).toBe('Lite');
    expect(matrix.monthly[1].name).toBe('Pro');
    expect(matrix.monthly[2].name).toBe('Max');
  });

  it('preserves productId in each entry', () => {
    const matrix = buildMatrix() as Record<string, Array<{ id: string }>>;
    const monthlyIds = matrix.monthly.map((p) => p.id);
    expect(monthlyIds).toContain('m-lite');
  });

  it('marks soldOut correctly', () => {
    const matrix = buildMatrix() as Record<string, Array<{ soldOut: boolean }>>;
    const yearlyMax = matrix.yearly.find((_, i) => i === 2);
    expect(yearlyMax?.soldOut).toBe(true);
  });

  it('handles empty productList gracefully', () => {
    const matrix = (S.buildProductMatrix as (list: unknown[]) => Record<string, unknown[]>)([]);
    expect(matrix.monthly).toHaveLength(0);
    expect(matrix.quarterly).toHaveLength(0);
    expect(matrix.yearly).toHaveLength(0);
  });
});

describe('getSelectionSummary with priority list', () => {
  it('counts selected products from _priorityList', () => {
    S._priorityList = [
      { productId: 'p1' },
      { productId: 'p2' },
    ];
    S._ticketCount = 5;
    const summary = (S.getSelectionSummary as () => Record<string, number>)();
    expect(summary.selected).toBe(2);
    expect(summary.launchable).toBe(5);
    expect(summary.tickets).toBe(5);
  });

  it('is not launchable when no products are selected', () => {
    S._priorityList = [];
    S._ticketCount = 5;
    const summary = (S.getSelectionSummary as () => Record<string, number>)();
    expect(summary.selected).toBe(0);
    expect(summary.launchable).toBe(0);
    expect(summary.tickets).toBe(5);
  });
});

describe('restoreSelectedProducts', () => {
  it('defaults to yearly Pro when no saved state exists', () => {
    S._productMatrix = (S.buildProductMatrix as (list: unknown[]) => Record<string, unknown[]>)(FIXTURE_PRODUCT_LIST);
    S.sessionStorage = { getItem: () => null, setItem: () => {} };
    (S.restoreSelectedProducts as () => void)();
    expect((S._priorityList as unknown[])).toHaveLength(1);
    expect((S._priorityList as Array<{ productId: string }>)[0].productId).toBe('y-pro');
  });
});
