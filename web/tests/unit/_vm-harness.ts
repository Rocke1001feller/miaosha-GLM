/**
 * Shared vm sandbox factory for MAIN-world vanilla-JS module tests.
 *
 * The src/*-main/*.js modules are vanilla JS scripts designed to be
 * concatenated and injected into a page's MAIN world. They declare functions
 * and vars in the global scope — they have no ES module exports.
 *
 * Strategy: execute each source file via Node's `vm.runInContext`, which
 * runs the script inside an explicitly provided sandbox object. All top-level
 * `var` declarations and `function` declarations are written into the sandbox,
 * making them accessible to tests.
 *
 * Each suite directory wraps this factory with a thin harness that supplies
 * its own source directory and stub differences on top of the shared base
 * sandbox (see tests/unit/bm-main/_harness.ts and tests/unit/volc-main/_harness.ts).
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import vm from 'vm';

export type VmScope = Record<string, unknown>;

export interface VmHarnessOptions {
  /** Absolute path to the directory containing the injectable source modules. */
  srcDir: string;
  /** Suite-specific stubs, merged over the shared base sandbox. */
  globals?: VmScope;
}

/**
 * Minimal browser-API stubs shared by all MAIN-world suites.
 * Only stub what the loaded modules actually call at parse-time or in
 * the specific functions under test. Suite harnesses add their own stubs
 * (richer fetch responses, real timers, AudioContext, ...) via `globals`.
 */
function makeBaseSandbox(): VmScope {
  const doc = {
    getElementById: (_id: string) => null,
    createElement: (_tag: string) => ({
      appendChild: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      style: {},
      innerHTML: '',
      textContent: '',
      className: '',
      id: '',
    }),
    body: { appendChild: () => {} },
    addEventListener: () => {},
    removeEventListener: () => {},
    cookie: '',
  };

  return {
    document: doc,
    window: { postMessage: () => {}, addEventListener: () => {}, removeEventListener: () => {} },
    sessionStorage: { getItem: () => null, setItem: () => {} },
    localStorage: { getItem: () => null, setItem: () => {} },
    performance: { now: () => Date.now() },
    setTimeout: () => 0,
    clearTimeout: () => {},
    setInterval: () => 0,
    clearInterval: () => {},
    fetch: () => Promise.resolve({ json: () => Promise.resolve({ code: 200 }) }),
    console,
  };
}

/**
 * Create a loader that runs one or more source files in a fresh vm sandbox
 * and returns the sandbox so tests can invoke functions by name.
 *
 * `overrides` replaces top-level sandbox globals (e.g. a richer `document`
 * stub) before the modules execute.
 */
export function createVmHarness<TScope extends VmScope = VmScope>(options: VmHarnessOptions) {
  return function loadModules(moduleNames: string[], overrides: VmScope = {}): TScope {
    const sandbox = vm.createContext({ ...makeBaseSandbox(), ...options.globals, ...overrides });

    for (const name of moduleNames) {
      const filePath = resolve(options.srcDir, name.endsWith('.js') ? name : `${name}.js`);
      const code = readFileSync(filePath, 'utf8');
      vm.runInContext(code, sandbox);
    }

    return sandbox as TScope;
  };
}
