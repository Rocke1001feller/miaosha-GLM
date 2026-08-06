/**
 * bm-main test harness — thin wrapper over the shared vm sandbox factory
 * (tests/unit/_vm-harness.ts).
 *
 * Usage:
 *   const scope = loadBmMainModules(['01-utils', '05-product']);
 *   const matrix = scope.buildProductMatrix(productList);
 *
 * Always include dependency files before dependents
 * (e.g. '01-utils' before '05-product').
 */

import { resolve } from 'path';
import { createVmHarness, type VmScope } from '../_vm-harness';

export type BmMainScope = VmScope;

export const loadBmMainModules = createVmHarness<BmMainScope>({
  srcDir: resolve(__dirname, '../../../src/bm-main'),
  globals: {
    fetch: () => Promise.resolve({ json: () => Promise.resolve({ code: 200, data: { productList: [] } }) }),
    AudioContext: class {},
    AbortController: class {
      signal = { aborted: false };
      abort() { (this.signal as { aborted: boolean }).aborted = true; }
    },
  },
});
