/**
 * bce-main test harness — thin wrapper over the shared vm sandbox factory
 * (tests/unit/_vm-harness.ts).
 *
 * Usage:
 *   const scope = loadBceMainModules(['00-config', '10-shared']);
 */

import { resolve } from 'path';
import { createVmHarness, type VmScope } from '../_vm-harness';

export type BceMainScope = VmScope;

export const loadBceMainModules = createVmHarness<BceMainScope>({
  srcDir: resolve(__dirname, '../../../src/bce-main'),
  globals: {
    // Real timers: fire/stock loops use real delays in tests.
    setTimeout: (fn: Function, ms?: number) => setTimeout(fn, ms),
    clearTimeout: (id: unknown) => clearTimeout(id as number),
    Math,
    Date,
  },
});
