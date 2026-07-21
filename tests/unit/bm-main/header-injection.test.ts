/**
 * Regression tests for the L1 header injection race in 10-header.js.
 *
 * Root cause of the original bug: `_h1_injectHeader` was scheduled via a
 * one-shot `setTimeout(..., 1500)`, but the mount host
 * (.pc-header-nav-left) is rendered asynchronously by bigmodel.cn's SPA.
 * When the host was not in the DOM at that instant, the injection silently
 * returned and never retried — the L1 bar was permanently missing
 * (confirmed live via MutationObserver timeline capture).
 *
 * These tests pin the fixed behavior: fast bounded retries until the host
 * appears, plus a slow watch that resurrects the bar if the SPA wipes it,
 * without duplicating one-time registrations.
 */

import { describe, expect, it } from 'vitest';
import { loadBmMainModules } from './_harness';

type TimerCb = () => void;

function makeDom(pathname = '/glm-coding') {
  const byId = new Map<string, any>();
  let hostAppears = false;
  let host: any = null;

  function makeEl(tag: string): any {
    const el: any = {
      tagName: tag.toUpperCase(),
      id: '',
      className: '',
      style: {},
      children: [] as any[],
      innerHTML: '',
      textContent: '',
      title: '',
      setAttribute: () => {},
      addEventListener: () => {},
      get firstChild() {
        return el.children[0] ?? null;
      },
      insertBefore(child: any) {
        el.children.unshift(child);
        if (child.id) byId.set(child.id, child);
      },
      appendChild(child: any) {
        el.children.push(child);
        if (child.id) byId.set(child.id, child);
        return child;
      },
    };
    return el;
  }

  const document = {
    getElementById: (id: string) => byId.get(id) ?? null,
    querySelector: (sel: string) => {
      if (sel === '.pc-header-nav-left') {
        if (!hostAppears) return null;
        if (!host) host = makeEl('div');
        return host;
      }
      return null;
    },
    createElement: (tag: string) => makeEl(tag),
    createDocumentFragment: () => makeEl('#fragment'),
    head: makeEl('head'),
    documentElement: makeEl('html'),
    body: makeEl('body'),
    cookie: '',
    addEventListener: () => {},
  };

  return {
    document,
    byId,
    location: { pathname },
    hostAppearsNow() {
      hostAppears = true;
    },
    wipeH1() {
      byId.delete('__bm_h1');
    },
  };
}

function makeSandboxExtras(dom: ReturnType<typeof makeDom>) {
  const timeouts: Array<{ fn: TimerCb; delay: number }> = [];
  const intervals: Array<{ fn: TimerCb; delay: number }> = [];
  const windowListeners: Array<{ type: string; fn: TimerCb }> = [];

  return {
    timeouts,
    intervals,
    windowListeners,
    sandbox: {
      document: dom.document,
      location: dom.location,
      window: {
        postMessage: () => {},
        addEventListener: (type: string, fn: TimerCb) => {
          windowListeners.push({ type, fn });
        },
        removeEventListener: () => {},
      },
      setTimeout: (fn: TimerCb, delay: number) => {
        timeouts.push({ fn, delay });
        return timeouts.length;
      },
      clearTimeout: () => {},
      setInterval: (fn: TimerCb, delay: number) => {
        intervals.push({ fn, delay });
        return 1000 + intervals.length;
      },
      clearInterval: () => {},
    },
  };
}

function load(dom: ReturnType<typeof makeDom>) {
  const extras = makeSandboxExtras(dom);
  loadBmMainModules(['10-header'], extras.sandbox);
  return extras;
}

function flushNext(timeouts: Array<{ fn: TimerCb; delay: number }>) {
  const next = timeouts.shift();
  if (next) next.fn();
  return !!next;
}

describe('10-header L1 injection scheduling', () => {
  it('retries until the SPA-rendered mount host appears, then injects', () => {
    const dom = makeDom();
    const { timeouts } = load(dom);

    // Boot attempt + 4 retries: host absent, nothing injected
    for (let i = 0; i < 5; i++) {
      expect(flushNext(timeouts)).toBe(true);
      expect(dom.byId.has('__bm_h1')).toBe(false);
    }

    // SPA finishes rendering the header: next retry must succeed
    dom.hostAppearsNow();
    expect(flushNext(timeouts)).toBe(true);
    expect(dom.byId.has('__bm_h1')).toBe(true);

    // After success no further RETRY timeouts are scheduled — the only
    // remaining one is the one-time GET_SALE_TIME request (800ms)
    expect(timeouts.filter((t) => t.delay === 500)).toHaveLength(0);
    expect(timeouts.filter((t) => t.delay === 800)).toHaveLength(1);
  });

  it('gives up after a bounded number of retries when the host never appears', () => {
    const dom = makeDom();
    const { timeouts, windowListeners } = load(dom);

    // boot (attempt 0) + 59 retries = 60 attempts, then stop
    for (let i = 0; i < 60; i++) {
      expect(flushNext(timeouts)).toBe(true);
    }
    expect(timeouts).toHaveLength(0); // no unbounded rescheduling
    expect(dom.byId.has('__bm_h1')).toBe(false);
    expect(windowListeners).toHaveLength(0); // never injected, nothing registered
  });

  it('resurrects the bar via the slow watch after an SPA wipe, without duplicate registrations', () => {
    const dom = makeDom();
    dom.hostAppearsNow();
    const { timeouts, intervals, windowListeners } = load(dom);

    flushNext(timeouts); // boot attempt injects immediately
    expect(dom.byId.has('__bm_h1')).toBe(true);
    expect(windowListeners.filter((l) => l.type === 'message')).toHaveLength(1);
    // watch(5000) + updateAuth(3000) + updateTimeTick(100)
    expect(intervals).toHaveLength(3);

    // SPA re-renders the header and wipes the injected bar
    dom.wipeH1();
    expect(dom.byId.has('__bm_h1')).toBe(false);

    // The slow watch re-injects it
    const watch = intervals.find((i) => i.delay === 5000);
    expect(watch).toBeDefined();
    watch!.fn();
    expect(dom.byId.has('__bm_h1')).toBe(true);

    // One-time registrations are not duplicated by the re-injection
    expect(windowListeners.filter((l) => l.type === 'message')).toHaveLength(1);
    expect(intervals).toHaveLength(3);
  });

  it('never injects outside /glm-coding', () => {
    const dom = makeDom('/');
    dom.hostAppearsNow();
    const { timeouts } = load(dom);

    for (let i = 0; i < 60; i++) flushNext(timeouts);
    expect(dom.byId.has('__bm_h1')).toBe(false);
  });
});
