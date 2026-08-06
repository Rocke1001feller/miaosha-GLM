/**
 * Tests: src/volc-main/00-config.js runtime platform detection.
 *
 * The merged overlay serves both Volcengine activity pages. 00-config picks
 * the platform config at runtime from location.pathname; each activity page
 * must resolve to its own platform constants.
 */

import { describe, it, expect } from 'vitest';
import vm from 'vm';
import { loadVolcMainModules } from './_harness';

function configFor(pathname: string): Record<string, any> {
  const S = loadVolcMainModules(['00-config'], { location: { pathname } });
  // `config` is a top-level const, so it lives in the context's lexical
  // environment rather than on the sandbox object — read it via vm.
  return vm.runInContext('config', S) as Record<string, any>;
}

describe('00-config platform detection', () => {
  it('selects the Agent Plan config on /activity/agentplan', () => {
    const config = configFor('/activity/agentplan');
    expect(config.platform).toBe('volcengine-agentplan');
    expect(config.title).toBe('火山引擎 Agent Plan');
    expect(config.productCode).toBe('ark_subscription');
    expect(config.globalName).toBe('__activity__agentplan__');
    expect(config.payPath).toBe('agentplan');
    expect(config.defaultProductId).toBe('Agent_Plan_Small_monthly|duration:1');
    expect(Object.keys(config.displayNames)).toHaveLength(4);
  });

  it('selects the Coding Plan config on /activity/codingplan', () => {
    const config = configFor('/activity/codingplan');
    expect(config.platform).toBe('volcengine-codingplan');
    expect(config.title).toBe('火山引擎 Coding Plan');
    expect(config.productCode).toBe('ark_bd');
    expect(config.globalName).toBe('__activity__codingplan__');
    expect(config.payPath).toBe('codingplan');
    expect(config.defaultProductId).toBe('Coding_Plan_Lite_monthly|duration:1');
    expect(Object.keys(config.displayNames)).toHaveLength(2);
  });
});
