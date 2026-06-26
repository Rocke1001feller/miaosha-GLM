/**
 * Unit tests: lib/api/strike-reservation.ts
 */

import { describe, expect, it } from 'vitest';
import {
  removeStrikeReservations,
  restoreUnusedStrikeReservations,
  strikeTicketKey,
  type StrikeReservationTicket,
} from '../../../../lib/api/strike-reservation';

function ticket(id: string, createdAt: number): StrikeReservationTicket {
  return { ticket: `tk-${id}`, randstr: `rs-${id}`, createdAt };
}

describe('strike reservation helpers', () => {
  it('removes only the reserved tickets from the live pool', () => {
    const pool = [ticket('old', 100), ticket('queued', 200), ticket('new', 300)];
    const remaining = removeStrikeReservations(pool, [ticket('queued', 200)]);

    expect(remaining).toEqual([ticket('old', 100), ticket('new', 300)]);
  });

  it('restores queued tickets that were reserved but not spent', () => {
    const queued1 = ticket('queued-1', 200);
    const fired = ticket('fired', 300);
    const queued2 = ticket('queued-2', 400);
    const spentKeys = new Set([strikeTicketKey(fired)]);

    const result = restoreUnusedStrikeReservations({
      pool: [ticket('fresh', 500)],
      reserved: [queued1, fired, queued2],
      spentKeys,
      now: 600,
      ticketTtlMs: 1000,
      maxPoolSize: 10,
    });

    expect(result.restoredCount).toBe(2);
    expect(result.pool).toEqual([queued1, queued2, ticket('fresh', 500)]);
  });

  it('does not duplicate tickets that are already back in the pool', () => {
    const queued = ticket('queued', 200);

    const result = restoreUnusedStrikeReservations({
      pool: [queued],
      reserved: [queued],
      spentKeys: new Set(),
      now: 300,
      ticketTtlMs: 1000,
      maxPoolSize: 10,
    });

    expect(result.restoredCount).toBe(0);
    expect(result.pool).toEqual([queued]);
  });

  it('skips expired reservations and trims the oldest tickets when over capacity', () => {
    const result = restoreUnusedStrikeReservations({
      pool: [ticket('pool-old', 100), ticket('pool-new', 500)],
      reserved: [ticket('expired', 50), ticket('queued', 400)],
      spentKeys: new Set(),
      now: 700,
      ticketTtlMs: 600,
      maxPoolSize: 2,
    });

    expect(result.restoredCount).toBe(1);
    expect(result.pool).toEqual([ticket('queued', 400), ticket('pool-new', 500)]);
  });
});
