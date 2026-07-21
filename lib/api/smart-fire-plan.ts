import type { Ticket } from '../platform/types';

export const SMART_FIRE_BUDGET_DEFAULT = 8;
export const SMART_FIRE_MIN_INTERVAL_MS = 2200;
export const SMART_FIRE_EARLY_MS = 10;
export const SMART_FIRE_TICKET_TTL_MS = 5 * 60 * 1000;

export interface SmartFireState {
  /** Tickets sorted by createdAt ascending (freshest at the end). */
  tickets: Ticket[];
  /** Priority-ordered product ids. */
  selectedIds: string[];
  /** Remaining preview budget. */
  budgetLeft: number;
  /** Shots already fired. */
  shotsFired: number;
  /** Local timestamp of the last shot (ms). */
  lastShotAt: number;
  /** True once batch-preview has seen a selected product flip from soldOut to available. */
  stockOpen: boolean;
  /** Local time minus server time (ms). Positive means local clock is ahead. */
  serverOffsetMs: number;
  /** Configured sale epoch in local time (ms). */
  nextSaleTime: number;
  /** Minimum delay between shots (ms). Defaults to SMART_FIRE_MIN_INTERVAL_MS. */
  minIntervalMs?: number;
  mode: 'auto' | 'manual';
}

export type FireEvent =
  | { kind: 'TICK'; now: number }
  | { kind: 'STOCK_FLIP'; now: number }
  | {
      kind: 'RESULT';
      outcome: 'success' | 'soldout' | 'busy' | 'waf405' | 'captchaInvalid' | 'error';
      now: number;
    };

export interface FireShot {
  productId: string;
  ticket: Ticket;
  scheduledAt: number;
}

export interface FireDecision {
  action: 'fire' | 'wait' | 'stop';
  shot?: FireShot;
  nextState: SmartFireState;
  reason: string;
}

function cloneState(state: SmartFireState): SmartFireState {
  return {
    ...state,
    tickets: state.tickets.slice(),
    selectedIds: state.selectedIds.slice(),
  };
}

function validTicketsAt(state: SmartFireState, now: number): Ticket[] {
  return state.tickets.filter((t) => now - t.createdAt < SMART_FIRE_TICKET_TTL_MS);
}

function pickTicket(state: SmartFireState, now: number): Ticket | null {
  const valid = validTicketsAt(state, now);
  return valid.length > 0 ? valid[valid.length - 1] : null;
}

function isStopForced(state: SmartFireState, event: FireEvent): { stop: false } | { stop: true; reason: string } {
  if (event.kind === 'RESULT' && event.outcome === 'success') {
    return { stop: true, reason: 'order created' };
  }
  if (event.kind === 'RESULT' && event.outcome === 'waf405') {
    return { stop: true, reason: 'WAF 405 block' };
  }
  if (event.kind === 'RESULT' && event.outcome === 'captchaInvalid') {
    return { stop: true, reason: 'captcha ticket invalid' };
  }
  return { stop: false };
}

/**
 * Pure state machine for the bigmodel seckill firing strategy.
 *
 * Rules:
 * - Stop on success, WAF 405, invalid captcha, depleted budget, or expired tickets.
 * - Fire immediately on STOCK_FLIP.
 * - Auto mode fires at `nextSaleTime - serverOffsetMs - EARLY_MS` if stock hasn't flipped earlier.
 * - Manual mode fires immediately on the first trigger, then obeys the min interval.
 * - 555 / soldOut / generic errors consume budget but do NOT consume the ticket (it can be reused).
 * - Minimum 2.2s between shots.
 */
export function nextDecision(state: SmartFireState, event: FireEvent): FireDecision {
  const now = event.now;
  const forced = isStopForced(state, event);
  if (forced.stop) {
    return { action: 'stop', nextState: cloneState(state), reason: forced.reason };
  }

  let nextState = cloneState(state);

  if (event.kind === 'STOCK_FLIP') {
    nextState.stockOpen = true;
  }

  if (event.kind === 'RESULT') {
    nextState.lastShotAt = now;
    if (event.outcome === 'soldout' || event.outcome === 'busy' || event.outcome === 'error') {
      nextState.budgetLeft -= 1;
      nextState.shotsFired += 1;
    }
  }

  if (nextState.budgetLeft <= 0) {
    return { action: 'stop', nextState, reason: 'preview budget depleted' };
  }

  const ticket = pickTicket(nextState, now);
  if (!ticket) {
    return { action: 'stop', nextState, reason: 'all tickets expired' };
  }

  const productId = nextState.selectedIds[0];
  if (!productId) {
    return { action: 'stop', nextState, reason: 'no target product selected' };
  }

  let shouldFireNow = false;
  let reason = 'waiting for trigger or interval';
  const minInterval = nextState.minIntervalMs ?? SMART_FIRE_MIN_INTERVAL_MS;

  if (event.kind === 'STOCK_FLIP') {
    shouldFireNow = true;
    reason = 'stock flipped';
  } else if (nextState.mode === 'manual') {
    if (nextState.shotsFired === 0 || now >= nextState.lastShotAt + minInterval) {
      shouldFireNow = true;
      reason = 'manual fire';
    }
  } else {
    // auto
    const fireAt = nextState.nextSaleTime - nextState.serverOffsetMs - SMART_FIRE_EARLY_MS;
    if ((nextState.stockOpen || now >= fireAt) &&
        (nextState.shotsFired === 0 || now >= nextState.lastShotAt + minInterval)) {
      shouldFireNow = true;
      reason = nextState.stockOpen ? 'stock flipped' : 'sale time reached';
    }
  }

  if (shouldFireNow) {
    return {
      action: 'fire',
      shot: { productId, ticket, scheduledAt: now },
      nextState: { ...nextState, lastShotAt: now },
      reason,
    };
  }

  return { action: 'wait', nextState, reason };
}
