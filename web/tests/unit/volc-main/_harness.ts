/**
 * volc-main test harness — thin wrapper over the shared vm sandbox factory
 * (tests/unit/_vm-harness.ts).
 *
 * Usage:
 *   const scope = loadVolcMainModules(['10-shared', '20-pricing']);
 */

import { resolve } from 'path';
import { createVmHarness, type VmScope } from '../_vm-harness';

export type VolcMainScope = VmScope;

export const loadVolcMainModules = createVmHarness<VolcMainScope>({
  srcDir: resolve(__dirname, '../../../src/volc-main'),
  globals: {
    // Real timers: pricing tests exercise retry backoff with actual delays.
    setTimeout: (fn: Function, ms?: number) => setTimeout(fn, ms),
    clearTimeout: (id: unknown) => clearTimeout(id as number),
    Math,
    Date,
  },
});
