import { describe, it, expect } from 'vitest';
import {
  nextDecision,
  SMART_FIRE_BUDGET_DEFAULT,
  SMART_FIRE_MIN_INTERVAL_MS,
  SMART_FIRE_EARLY_MS,
  SMART_FIRE_TICKET_TTL_MS,
  type SmartFireState,
  type FireEvent,
} from '../../../../lib/api/smart-fire-plan';

function baseState(overrides: Partial<SmartFireState> = {}): SmartFireState {
  const now = Date.now();
  return {
    tickets: [
      { ticket: 'old-ticket', randstr: 'old-rand', provider: 'tencent-captcha', createdAt: now - 60_000 },
      { ticket: 'new-ticket', randstr: 'new-rand', provider: 'tencent-captcha', createdAt: now - 10_000 },
    ],
    selectedIds: ['product-yearly-pro'],
    budgetLeft: SMART_FIRE_BUDGET_DEFAULT,
    shotsFired: 0,
    lastShotAt: 0,
    stockOpen: false,
    serverOffsetMs: 0,
    nextSaleTime: now + 60_000,
    mode: 'auto',
    ...overrides,
  };
}

describe('smart-fire-plan', () => {
  it('waits before sale time in auto mode', () => {
    const now = Date.now();
    const state = baseState({ nextSaleTime: now + 60_000 });
    const decision = nextDecision(state, { kind: 'TICK', now });
    expect(decision.action).toBe('wait');
    expect(decision.nextState.shotsFired).toBe(0);
  });

  it('fires at sale time minus offset and early margin in auto mode', () => {
    const now = Date.now();
    const state = baseState({
      nextSaleTime: now + 100,
      serverOffsetMs: 50, // local is 50ms ahead of server
    });
    // Sale (server) = now + 100. Local fire at = (now + 100) - 50 - 10 = now + 40.
    const decision = nextDecision(state, { kind: 'TICK', now: now + 40 });
    expect(decision.action).toBe('fire');
    expect(decision.shot?.productId).toBe('product-yearly-pro');
    expect(decision.shot?.ticket.ticket).toBe('new-ticket');
    expect(decision.reason).toBe('sale time reached');
  });

  it('fires immediately on STOCK_FLIP', () => {
    const now = Date.now();
    const state = baseState({ nextSaleTime: now + 60_000 });
    const decision = nextDecision(state, { kind: 'STOCK_FLIP', now });
    expect(decision.action).toBe('fire');
    expect(decision.reason).toBe('stock flipped');
    expect(decision.nextState.stockOpen).toBe(true);
  });

  it('fires immediately on first manual trigger', () => {
    const now = Date.now();
    const state = baseState({ mode: 'manual', nextSaleTime: now + 60_000 });
    const decision = nextDecision(state, { kind: 'TICK', now });
    expect(decision.action).toBe('fire');
    expect(decision.reason).toBe('manual fire');
  });

  it('waits if min interval has not passed since last shot', () => {
    const now = Date.now();
    const state = baseState({
      mode: 'manual',
      shotsFired: 1,
      lastShotAt: now - 100,
    });
    const decision = nextDecision(state, { kind: 'TICK', now });
    expect(decision.action).toBe('wait');
  });

  it('fires again once min interval has passed', () => {
    const now = Date.now();
    const state = baseState({
      mode: 'manual',
      shotsFired: 1,
      lastShotAt: now - SMART_FIRE_MIN_INTERVAL_MS,
    });
    const decision = nextDecision(state, { kind: 'TICK', now });
    expect(decision.action).toBe('fire');
  });

  it('does not consume ticket on 555/busy result and reuses it', () => {
    const now = Date.now();
    let state = baseState({ mode: 'manual' });
    let decision = nextDecision(state, { kind: 'TICK', now });
    expect(decision.action).toBe('fire');
    expect(decision.shot?.ticket.ticket).toBe('new-ticket');

    state = decision.nextState;
    decision = nextDecision(state, { kind: 'RESULT', outcome: 'busy', now: now + 100 });
    expect(decision.action).toBe('wait');
    expect(decision.nextState.budgetLeft).toBe(SMART_FIRE_BUDGET_DEFAULT - 1);

    decision = nextDecision(decision.nextState, { kind: 'TICK', now: now + SMART_FIRE_MIN_INTERVAL_MS + 200 });
    expect(decision.action).toBe('fire');
    expect(decision.shot?.ticket.ticket).toBe('new-ticket');
  });

  it('does not consume ticket on soldout result', () => {
    const now = Date.now();
    const state = baseState({ mode: 'manual' });
    const fired = nextDecision(state, { kind: 'TICK', now });
    const afterSoldout = nextDecision(fired.nextState, { kind: 'RESULT', outcome: 'soldout', now: now + 100 });
    expect(afterSoldout.nextState.budgetLeft).toBe(SMART_FIRE_BUDGET_DEFAULT - 1);
    const next = nextDecision(afterSoldout.nextState, { kind: 'TICK', now: now + SMART_FIRE_MIN_INTERVAL_MS + 200 });
    expect(next.action).toBe('fire');
  });

  it('stops when budget is depleted', () => {
    const now = Date.now();
    const state = baseState({ budgetLeft: 1, shotsFired: 0, mode: 'manual' });
    const fired = nextDecision(state, { kind: 'TICK', now });
    const afterBusy = nextDecision(fired.nextState, { kind: 'RESULT', outcome: 'busy', now: now + 100 });
    expect(afterBusy.action).toBe('stop');
    expect(afterBusy.reason).toBe('preview budget depleted');
  });

  it('stops on WAF 405', () => {
    const now = Date.now();
    const state = baseState({ mode: 'manual' });
    const fired = nextDecision(state, { kind: 'TICK', now });
    const after405 = nextDecision(fired.nextState, { kind: 'RESULT', outcome: 'waf405', now: now + 100 });
    expect(after405.action).toBe('stop');
    expect(after405.reason).toBe('WAF 405 block');
  });

  it('stops on invalid captcha ticket', () => {
    const now = Date.now();
    const state = baseState({ mode: 'manual' });
    const fired = nextDecision(state, { kind: 'TICK', now });
    const afterInvalid = nextDecision(fired.nextState, { kind: 'RESULT', outcome: 'captchaInvalid', now: now + 100 });
    expect(afterInvalid.action).toBe('stop');
    expect(afterInvalid.reason).toBe('captcha ticket invalid');
  });

  it('stops when all tickets expired', () => {
    const now = Date.now();
    const state = baseState({
      tickets: [
        { ticket: 'expired', randstr: 'x', provider: 'tencent-captcha', createdAt: now - SMART_FIRE_TICKET_TTL_MS - 1 },
      ],
    });
    const decision = nextDecision(state, { kind: 'STOCK_FLIP', now });
    expect(decision.action).toBe('stop');
    expect(decision.reason).toBe('all tickets expired');
  });

  it('stops when no product is selected', () => {
    const now = Date.now();
    const state = baseState({ selectedIds: [] });
    const decision = nextDecision(state, { kind: 'STOCK_FLIP', now });
    expect(decision.action).toBe('stop');
    expect(decision.reason).toBe('no target product selected');
  });

  it('stops on success', () => {
    const now = Date.now();
    const state = baseState({ mode: 'manual' });
    const fired = nextDecision(state, { kind: 'TICK', now });
    const afterSuccess = nextDecision(fired.nextState, { kind: 'RESULT', outcome: 'success', now: now + 100 });
    expect(afterSuccess.action).toBe('stop');
    expect(afterSuccess.reason).toBe('order created');
  });
});
