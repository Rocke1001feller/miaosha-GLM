/**
 * Unit tests: src/bm-main/04-captcha.js
 *
 * Covers the Enter-key captcha confirmation feature:
 *   - _tryCaptchaConfirm: button discovery (text match '确认'/'确定'/'Confirm'),
 *     visibility filtering, return-value contract.
 *   - _handleCaptchaKeydown: preventDefault fires ONLY when a button was actually
 *     clicked (the fix for the "block user Enter for nothing" hazard).
 *
 * Strategy: the captcha module needs a richer DOM than the default _harness
 * sandbox (querySelectorAll / getComputedStyle / getBoundingClientRect). Rather
 * than perturb the shared harness (which 6 other test files depend on), this
 * file builds its own vm sandbox with injectable mock DOM. Only 02-state (for
 * _batchMode / _activeCaptcha / CAPTCHA_APPID / postMsg globals) and
 * 04-captcha are loaded.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import vm from 'vm';

const SRC_DIR = resolve(__dirname, '../../../src/bm-main');

// ── Mock DOM element factory ──────────────────────────────────────────────────
// A candidate button-ish element as _tryCaptchaConfirm would inspect it.
function makeEl(opts: {
  text?: string;
  disabled?: boolean;
  ariaDisabled?: string;
  display?: string;
  visibility?: string;
  opacity?: string;
  width?: number;
  height?: number;
  tagName?: string;
} = {}) {
  const click = vi.fn();
  return {
    tagName: opts.tagName ?? 'BUTTON',
    textContent: opts.text ?? '',
    getAttribute: (attr: string) =>
      attr === 'aria-disabled' ? (opts.ariaDisabled ?? null) : null,
    disabled: opts.disabled ?? false,
    isContentEditable: false,
    style: {},
    click,
    getBoundingClientRect: () => ({ width: opts.width ?? 100, height: opts.height ?? 40 }),
    // _isVisibleAndEnabled reads computed style
    __style: {
      display: opts.display ?? 'block',
      visibility: opts.visibility ?? 'visible',
      opacity: opts.opacity ?? '1',
    },
  };
}

// ── Sandbox factory ───────────────────────────────────────────────────────────
// `containerEls` controls what querySelectorAll returns inside the captcha
// container; `hasContainer` toggles whether a container is found at all.
function makeSandbox(opts: { containerEls: any[]; hasContainer?: boolean } = { containerEls: [] }) {
  const { containerEls } = opts;
  const hasContainer = opts.hasContainer ?? true;

  const container = {
    querySelectorAll: vi.fn(() => containerEls),
  };

  const doc = {
    getElementById: vi.fn(() => (hasContainer ? container : null)),
    querySelector: vi.fn(() => (hasContainer ? container : null)),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  const win = {
    getComputedStyle: vi.fn((el: any) => el.__style || { display: 'block', visibility: 'visible', opacity: '1' }),
    postMessage: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };

  const sandbox = {
    document: doc,
    window: win,
    console,
    setTimeout: () => 0,
    clearTimeout: () => {},
    Date,
  };
  return vm.createContext(sandbox);
}

function loadModules(sandbox: any) {
  // 02-state declares _batchMode, _activeCaptcha, CAPTCHA_APPID, postMsg, etc.
  // 04-captcha uses those and defines the functions under test.
  for (const name of ['02-state', '04-captcha']) {
    const code = readFileSync(resolve(SRC_DIR, `${name}.js`), 'utf8');
    vm.runInContext(code, sandbox);
  }
  return sandbox;
}

describe('_tryCaptchaConfirm — button discovery', () => {
  let S: any;
  beforeEach(() => {
    S = loadModules(makeSandbox({ containerEls: [] }));
  });

  it('clicks a visible "确认" button and returns true', () => {
    const btn = makeEl({ text: '确认' });
    S.document.getElementById.mockReturnValue({ querySelectorAll: () => [btn] });
    expect((S._tryCaptchaConfirm as () => boolean)()).toBe(true);
    expect(btn.click).toHaveBeenCalledTimes(1);
  });

  it('clicks a visible "确定" button and returns true', () => {
    const btn = makeEl({ text: '确定' });
    S.document.getElementById.mockReturnValue({ querySelectorAll: () => [btn] });
    expect((S._tryCaptchaConfirm as () => boolean)()).toBe(true);
    expect(btn.click).toHaveBeenCalledTimes(1);
  });

  it('returns false and clicks NOTHING when no candidate text matches', () => {
    const btn = makeEl({ text: '随机其它按钮' });
    btn.click = vi.fn();
    S.document.getElementById.mockReturnValue({ querySelectorAll: () => [btn] });
    expect((S._tryCaptchaConfirm as () => boolean)()).toBe(false);
    expect(btn.click).not.toHaveBeenCalled();
  });

  it('returns false when all candidates are disabled', () => {
    const btn = makeEl({ text: '确认', disabled: true });
    S.document.getElementById.mockReturnValue({ querySelectorAll: () => [btn] });
    expect((S._tryCaptchaConfirm as () => boolean)()).toBe(false);
    expect(btn.click).not.toHaveBeenCalled();
  });

  it('skips invisible buttons (display:none / opacity:0 / 0x0 rect) and returns false', () => {
    const a = makeEl({ text: '确认', display: 'none' });
    const b = makeEl({ text: '确认', opacity: '0' });
    const c = makeEl({ text: '确认', width: 0, height: 0 });
    S.document.getElementById.mockReturnValue({ querySelectorAll: () => [a, b, c] });
    expect((S._tryCaptchaConfirm as () => boolean)()).toBe(false);
    expect(a.click).not.toHaveBeenCalled();
    expect(b.click).not.toHaveBeenCalled();
    expect(c.click).not.toHaveBeenCalled();
  });

  it('returns false with no exception when no captcha container exists', () => {
    S.document.getElementById.mockReturnValue(null);
    S.document.querySelector.mockReturnValue(null);
    expect((S._tryCaptchaConfirm as () => boolean)()).toBe(false);
  });
});

describe('_handleCaptchaKeydown — Enter preventDefault contract', () => {
  let S: any;
  beforeEach(() => {
    S = loadModules(makeSandbox({ containerEls: [] }));
    // Pretend a captcha is open so the Enter branch runs.
    S._activeCaptcha = { destroy: () => {} };
  });

  function keyEvent(key: string, target: any = { tagName: 'DIV' }) {
    return {
      key,
      target,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
    };
  }

  it('calls preventDefault when Enter confirms a button', () => {
    const btn = makeEl({ text: '确认' });
    S.document.getElementById.mockReturnValue({ querySelectorAll: () => [btn] });
    const e = keyEvent('Enter');
    (S._handleCaptchaKeydown as (e: any) => void)(e);
    expect(e.preventDefault).toHaveBeenCalledTimes(1);
  });

  it('does NOT call preventDefault when no button matches (the core fix)', () => {
    const btn = makeEl({ text: '不匹配的文案' });
    S.document.getElementById.mockReturnValue({ querySelectorAll: () => [btn] });
    const e = keyEvent('Enter');
    (S._handleCaptchaKeydown as (e: any) => void)(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('does NOT confirm or preventDefault when target is an INPUT', () => {
    const btn = makeEl({ text: '确认' });
    S.document.getElementById.mockReturnValue({ querySelectorAll: () => [btn] });
    const e = keyEvent('Enter', { tagName: 'INPUT' });
    (S._handleCaptchaKeydown as (e: any) => void)(e);
    expect(btn.click).not.toHaveBeenCalled();
    expect(e.preventDefault).not.toHaveBeenCalled();
  });

  it('is a no-op on Enter when _activeCaptcha is null', () => {
    S._activeCaptcha = null;
    const e = keyEvent('Enter');
    (S._handleCaptchaKeydown as (e: any) => void)(e);
    expect(e.preventDefault).not.toHaveBeenCalled();
  });
});