/**
 * Unit tests: lib/api/strike-plan.ts
 */

import { describe, expect, it } from 'vitest';
import { buildStrikeQueue } from '../../../../lib/api/strike-plan';

function tickets(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    ticket: `t${i + 1}`,
    randstr: `r${i + 1}`,
    createdAt: 100 + i,
  }));
}

describe('buildStrikeQueue', () => {
  it('returns empty plan when no tickets or no targets', () => {
    expect(buildStrikeQueue({ tickets: [], targets: [{ productId: 'p1', priority: 1 }] }).shots).toHaveLength(0);
    expect(buildStrikeQueue({ tickets: tickets(2), targets: [] }).shots).toHaveLength(0);
  });

  it('caps targets to 3', () => {
    const targets = [
      { productId: 'p1', priority: 1 },
      { productId: 'p2', priority: 2 },
      { productId: 'p3', priority: 3 },
      { productId: 'p4', priority: 4 },
    ];
    const plan = buildStrikeQueue({ tickets: tickets(3), targets });
    expect(plan.shots.every((s) => ['p1', 'p2', 'p3'].includes(s.productId))).toBe(true);
  });

  it('assigns every ticket to exactly one shot', () => {
    const plan = buildStrikeQueue({
      tickets: tickets(5),
      targets: [{ productId: 'p1', priority: 1 }],
    });
    expect(plan.shots).toHaveLength(5);
    expect(plan.shots.every((s) => s.productId === 'p1' && s.priority === 1)).toBe(true);
  });

  it('front-loads P1 with 2 targets', () => {
    const plan = buildStrikeQueue({
      tickets: tickets(6),
      targets: [
        { productId: 'p1', priority: 1 },
        { productId: 'p2', priority: 2 },
      ],
    });
    const order = plan.shots.map((s) => s.productId);
    // [P1, P1, P2, P1, P2] repeated
    expect(order).toEqual(['p1', 'p1', 'p2', 'p1', 'p2', 'p1']);
  });

  it('front-loads P1 with 3 targets', () => {
    const plan = buildStrikeQueue({
      tickets: tickets(10),
      targets: [
        { productId: 'p1', priority: 1 },
        { productId: 'p2', priority: 2 },
        { productId: 'p3', priority: 3 },
      ],
    });
    const order = plan.shots.map((s) => s.productId);
    // [P1, P1, P2, P1, P3] x2
    expect(order).toEqual([
      'p1', 'p1', 'p2', 'p1', 'p3',
      'p1', 'p1', 'p2', 'p1', 'p3',
    ]);
  });

  it('puts the newest ticket at shot index 0', () => {
    const plan = buildStrikeQueue({
      tickets: [
        { ticket: 'tkA', randstr: 'rsA', createdAt: 100 },
        { ticket: 'tkB', randstr: 'rsB', createdAt: 300 },
        { ticket: 'tkC', randstr: 'rsC', createdAt: 200 },
      ],
      targets: [{ productId: 'p1', priority: 1 }],
    });
    expect(plan.shots[0].ticket).toBe('tkB');
    expect(plan.shots[1].ticket).toBe('tkC');
    expect(plan.shots[2].ticket).toBe('tkA');
  });

  it('includes ticket and randstr in each shot', () => {
    const plan = buildStrikeQueue({
      tickets: [
        { ticket: 'tkA', randstr: 'rsA', createdAt: 100 },
        { ticket: 'tkB', randstr: 'rsB', createdAt: 200 },
      ],
      targets: [{ productId: 'p1', priority: 1 }],
    });
    expect(plan.shots[0]).toEqual({
      productId: 'p1',
      ticket: 'tkB',
      randstr: 'rsB',
      createdAt: 200,
      priority: 1,
    });
    expect(plan.shots[1]).toEqual({
      productId: 'p1',
      ticket: 'tkA',
      randstr: 'rsA',
      createdAt: 100,
      priority: 1,
    });
  });
});
