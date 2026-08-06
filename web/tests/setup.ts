/**
 * Global Vitest setup — runs before every test file.
 *
 * 1. Extends Vitest's expect with @testing-library/jest-dom matchers
 *    (toBeInTheDocument, toHaveTextContent, etc.)
 * 2. Resets the WXT fakeBrowser in-memory state before each test so
 *    chrome.storage, chrome.tabs etc. are clean.
 */

import '@testing-library/jest-dom/vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { beforeEach } from 'vitest';

beforeEach(() => {
  /**
   * Reset all in-memory browser state (storage, tabs, alarms, …).
   * See: https://webext-core.aklinker1.io/fake-browser/reseting-state
   */
  fakeBrowser.reset();
});
