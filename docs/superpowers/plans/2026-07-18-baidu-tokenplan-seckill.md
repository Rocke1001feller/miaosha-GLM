# 百度千帆 Token Plan 抢购（第四平台）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为扩展新增第四平台——百度千帆 Token Plan（console.bce.baidu.com/qianfan/resource/token-plan）的抢购 overlay：四档商品卡多选（默认 Lite+Pro）→ 库存轮询 → 开售窗口升频 → 翻转/手动自动下单（charge/order/new）→ 引导手动支付。

**Architecture:** 与百炼同构的自包含 MAIN world overlay（`src/bce-main/` 7 个 vanilla-JS 模块 → `public/bce-main.js`）+ 薄 ISOLATED content script 注入 + 成功消息转发 background 角标。请求全部 MAIN world 直发：GET 免签名（已实证），POST 带 `csrftoken` 头（值 = cookie `bce-user-info`，每次现取——会轮换）。

**Tech Stack:** WXT 0.20 (Chrome MV3) · TypeScript · Svelte 5 · vitest 4 + Node vm 沙箱 · pnpm 10.33

**Spec:** `docs/superpowers/specs/2026-07-18-baidu-tokenplan-seckill-design.md`（含实证协议摘要）

## Global Constraints

- overlay 源码为无模块 vanilla JS，`src/bce-main/*.js` 按文件名序拼接进 IIFE，跨文件共享一律顶层 `var` / `function`（`const` 在 vm 沙箱测试中不可枚举）。
- 协议常量：库存 `GET /api/qianfan/charge/tokenPlanPersonal/firstPurchaseConfig`；下单 `POST /api/qianfan/charge/order/new`，body `{serviceType:'WENXINFACTORY', productType:'tokenPlanPersonal', autoRenew, items:[{config:{planType}}]}`；`planType ∈ {mini, lite, pro, max}`。
- POST 必须带 `csrftoken` 头（= cookie `bce-user-info` URL 解码去引号，**每次请求现取**）；GET 不带。
- 绝不自动支付；成功拿 orderId → `location.assign(/finance/pay?...orderId=)` 收银台；`unpaid_exists` 视为成功停手。
- UI 沿用百炼新风格：商品卡（多选最多 3，默认 lite+pro）、单月/连续包月切换、到点自动开火（默认开）、"开始刷新库存"合并大红按钮、覆盖式单条状态行、无倒计时。
- 测试约定：测 `src/*-main/*.js` 源文件；禁止真实 fetch；组件测试以 `.svelte.test.ts` 命名。
- 构建链：`pnpm build` = `build:overlay` → `wxt build` → `verify-no-minifier-collision`；`public/bce-main.js` 为生成物但入库。
- pnpm 可能因代理坏掉；备用二进制 `/Users/separationofconcerns/Library/pnpm/pnpm`。
- 提交信息遵循仓库现有风格（如 `feat(bce-main): ...`）。

---

### Task 1: 测试基建 + `00-config.js` + `10-shared.js`

**Files:**
- Create: `src/bce-main/00-config.js`
- Create: `src/bce-main/10-shared.js`
- Test: `tests/unit/bce-main/_harness.ts`
- Test: `tests/unit/bce-main/shared.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: `BCE_VERSION`、`BCE_CONFIG`（products/defaultSelected/maxSelections/轮询/火力参数）、`bce_postCmd(type, data)`、`bce_getCookies()`、`bce_readCsrf()`、`bce_nextArmedMs(times, now, leadMs)`、`bce_playBeeps(n)`

- [ ] **Step 1: 写 harness 与失败测试**

`tests/unit/bce-main/_harness.ts`（与 ali-main 同款薄封装）:

```ts
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
```

`tests/unit/bce-main/shared.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadBceMainModules } from './_harness';

describe('bce_readCsrf', () => {
  it('从 bce-user-info cookie 读出 csrftoken（URL 解码 + 去引号）', () => {
    const s = loadBceMainModules(['00-config', '10-shared'], {
      document: { cookie: 'a=1; bce-user-info=%222026-07-18T03%3A16%3A27Z%7Cabc123def%22; b=2' },
    });
    expect(s.bce_readCsrf()).toBe('2026-07-18T03:16:27Z|abc123def');
  });

  it('cookie 缺失时返回空串', () => {
    const s = loadBceMainModules(['00-config', '10-shared'], {
      document: { cookie: 'a=1' },
    });
    expect(s.bce_readCsrf()).toBe('');
  });

  it('未编码的原始值也能兼容', () => {
    const s = loadBceMainModules(['00-config', '10-shared'], {
      document: { cookie: 'bce-user-info="2026-07-18T03:16:27Z|xyz"' },
    });
    expect(s.bce_readCsrf()).toBe('2026-07-18T03:16:27Z|xyz');
  });
});

describe('bce_nextArmedMs', () => {
  const LEAD = 5 * 60000;
  const at = (h: number, m: number, day = 18) => new Date(2026, 6, day, h, m, 0, 0).getTime();

  it('窗口前：返回今日开售时刻 - leadMs', () => {
    const s = loadBceMainModules(['00-config', '10-shared']);
    expect(s.bce_nextArmedMs(['10:00'], at(9, 0), LEAD)).toBe(at(9, 55));
  });

  it('窗口中（已过 armedStart 未到 grace 结束）：返回过去的 armedStart（调用方视为已开窗）', () => {
    const s = loadBceMainModules(['00-config', '10-shared']);
    expect(s.bce_nextArmedMs(['10:00'], at(10, 5), LEAD)).toBe(at(9, 55));
  });

  it('grace 过后（10:30 后）：返回明日 armedStart', () => {
    const s = loadBceMainModules(['00-config', '10-shared']);
    expect(s.bce_nextArmedMs(['10:00'], at(10, 31), LEAD)).toBe(at(9, 55, 19));
  });

  it('times 缺失时按 10:00 默认', () => {
    const s = loadBceMainModules(['00-config', '10-shared']);
    expect(s.bce_nextArmedMs([], at(9, 0), LEAD)).toBe(at(9, 55));
    expect(s.bce_nextArmedMs(null, at(9, 0), LEAD)).toBe(at(9, 55));
  });
});

describe('bce_postCmd', () => {
  it('发送 __bce_cmd 信封', () => {
    const posted: any[] = [];
    const s = loadBceMainModules(['00-config', '10-shared'], {
      window: { postMessage: (m: any) => posted.push(m), addEventListener: () => {}, removeEventListener: () => {} },
    });
    s.bce_postCmd('BCE_PURCHASE_SUCCESS', { orderId: 'o1' });
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ __bce_cmd: true, type: 'BCE_PURCHASE_SUCCESS', orderId: 'o1' });
  });
});

describe('BCE_CONFIG', () => {
  it('四档商品 + 默认勾选 lite/pro + 最多 3 选', () => {
    const s = loadBceMainModules(['00-config', '10-shared']);
    const cfg = s.BCE_CONFIG as any;
    expect(cfg.products.map((p: any) => p.planType)).toEqual(['mini', 'lite', 'pro', 'max']);
    expect(cfg.defaultSelected).toEqual(['lite', 'pro']);
    expect(cfg.maxSelections).toBe(3);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/unit/bce-main/shared.test.ts`
Expected: FAIL（`src/bce-main/00-config.js` 不存在，readFileSync ENOENT）

- [ ] **Step 3: 实现 `src/bce-main/00-config.js`**

```js
// Platform constants for the Baidu Qianfan Token Plan MAIN-world overlay.
// Reads are plain GETs; writes POST with a csrftoken header taken fresh from
// the bce-user-info cookie (probed 2026-07-18).
var BCE_VERSION =
  (typeof document !== 'undefined' &&
    document.currentScript &&
    document.currentScript.dataset &&
    document.currentScript.dataset.version) ||
  '1.4.2';

var BCE_CONFIG = {
  platform: 'baidu-tokenplan',
  title: '百度千帆 Token Plan',
  products: [
    { planType: 'mini', name: 'Mini', price: '¥4.9/月' },
    { planType: 'lite', name: 'Lite', price: '¥19.9/月' },
    { planType: 'pro', name: 'Pro', price: '¥99.9/月' },
    { planType: 'max', name: 'Max', price: '¥299.9/月' },
  ],
  defaultSelected: ['lite', 'pro'],
  maxSelections: 3,
  idlePollMs: 2000,
  armedPollMs: 500,
  armedLeadMs: 300000,
  fireIntervalMs: 800,
  fireBackoffMs: 2000,
  maxFireAttempts: 60,
};
```

- [ ] **Step 4: 实现 `src/bce-main/10-shared.js`**

```js
// Mechanical helpers shared by the Qianfan Token Plan MAIN-world overlay.

function bce_postCmd(type, data) {
  var envelope = { __bce_cmd: true, type: type };
  if (data && typeof data === 'object') {
    for (var key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) envelope[key] = data[key];
    }
  }
  window.postMessage(envelope, '*');
}

function bce_getCookies() {
  return document.cookie.split(';').reduce(function (acc, c) {
    var parts = c.trim().split('=');
    acc[parts[0]] = parts.slice(1).join('=');
    return acc;
  }, {});
}

// csrftoken header value = bce-user-info cookie (URL-decoded, quotes stripped).
// The cookie rotates, so read it fresh before every write request.
function bce_readCsrf() {
  var m = document.cookie.match(/bce-user-info=([^;]+)/);
  if (!m) return '';
  var raw = m[1];
  try {
    raw = decodeURIComponent(raw);
  } catch (e) {}
  return raw.replace(/"/g, '');
}

// PURE: next armed-window start (leadMs before the next daily sale time).
// Returns a timestamp that may be in the past (window already open).
// After a 30-minute grace past the sale time, rolls to the next day.
function bce_nextArmedMs(times, now, leadMs) {
  var t = (times && times[0]) || '10:00';
  var parts = String(t).split(':');
  var h = parseInt(parts[0], 10);
  var m = parseInt(parts[1], 10);
  if (!isFinite(h)) h = 10;
  if (!isFinite(m)) m = 0;
  var d = new Date(now);
  d.setHours(h, m, 0, 0);
  var GRACE_MS = 30 * 60000;
  var start = d.getTime() - leadMs;
  if (now >= d.getTime() + GRACE_MS) {
    d.setDate(d.getDate() + 1);
    start = d.getTime() - leadMs;
  }
  return start;
}

function bce_playBeeps(count) {
  for (var i = 0; i < count; i++) setTimeout(bce_playBeep, i * 350);
}

function bce_playBeep() {
  try {
    var AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    var audioCtx = new AudioCtx();
    if (audioCtx.state === 'suspended') {
      audioCtx.close();
      return;
    }
    var buf = audioCtx.createBuffer(1, 44100, 44100);
    var data = buf.getChannelData(0);
    for (var i = 0; i < data.length; i++) {
      data[i] = Math.sin((2 * Math.PI * 880 * i) / 44100) * 0.25;
    }
    var src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx.destination);
    src.start();
    setTimeout(function () {
      src.stop();
      audioCtx.close();
    }, 200);
  } catch (e) {}
}
```

- [ ] **Step 5: 跑测试确认通过 + overlay 构建冒烟**

Run: `pnpm vitest run tests/unit/bce-main/shared.test.ts`
Expected: PASS（9 个用例）

Run: `pnpm build:overlay`
Expected: 输出包含 `Built .../public/bce-main.js from 2 modules`

- [ ] **Step 6: Commit**

```bash
git add src/bce-main tests/unit/bce-main public/bce-main.js
git commit -m "feat(bce-main): add config + shared helpers (csrf, armed window, postCmd)"
```

---

### Task 2: `20-api.js` 协议层

**Files:**
- Create: `src/bce-main/20-api.js`
- Test: `tests/unit/bce-main/api.test.ts`

**Interfaces:**
- Consumes: `BCE_CONFIG`、`bce_readCsrf()`（Task 1）
- Produces: `bce_checkStock()`、`bce_createOrder(planType, autoRenew)`、`bce_parseStock(json)`、`bce_buildOrderBody(planType, autoRenew)`、`bce_classifyOrderResult(status, json)`

- [ ] **Step 1: 写失败测试**

`tests/unit/bce-main/api.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadBceMainModules } from './_harness';

// 2026-07-18 真实抓包（脱敏）
const STOCK_RESP = {
  success: true,
  result: {
    items: [
      { planType: 'mini', campaignName: 'qianfan_token_plan_mini_personal_new_bm' },
      { planType: 'lite', campaignName: 'qianfan_token_plan_lite_personal_new_bm' },
      { planType: 'pro', campaignName: 'qianfan_token_plan_pro_personal_new_bm' },
      { planType: 'max', campaignName: 'qianfan_token_plan_max_personal_new_bm' },
    ],
    available: { mini: true, lite: false, pro: false, max: true },
    times: ['10:00'],
  },
  log_id: '4111330473',
};

function load() {
  return loadBceMainModules(['00-config', '10-shared', '20-api']);
}

describe('bce_parseStock', () => {
  it('正常响应 → available + times', () => {
    const s = load();
    expect(s.bce_parseStock(STOCK_RESP)).toEqual({
      ok: true,
      available: { mini: true, lite: false, pro: false, max: true },
      times: ['10:00'],
    });
  });

  it('success:false / 缺 available / 空输入 → ok:false', () => {
    const s = load();
    expect(s.bce_parseStock({ success: false, message: 'x' })).toEqual({ ok: false, available: {}, times: [] });
    expect(s.bce_parseStock({ success: true, result: {} })).toEqual({ ok: false, available: {}, times: [] });
    expect(s.bce_parseStock(null)).toEqual({ ok: false, available: {}, times: [] });
  });

  it('times 缺失时给空数组', () => {
    const s = load();
    const r = s.bce_parseStock({ success: true, result: { available: { lite: true } } }) as any;
    expect(r.ok).toBe(true);
    expect(r.times).toEqual([]);
  });
});

describe('bce_buildOrderBody', () => {
  it('body 形状与页面一致（planType/autoRenew/items）', () => {
    const s = load();
    expect(s.bce_buildOrderBody('lite', false)).toEqual({
      serviceType: 'WENXINFACTORY',
      productType: 'tokenPlanPersonal',
      autoRenew: false,
      items: [{ config: { planType: 'lite' } }],
    });
    expect((s.bce_buildOrderBody('pro', true) as any).autoRenew).toBe(true);
  });
});

describe('bce_classifyOrderResult', () => {
  const s = load();

  it('成功：success:true + result.orderId', () => {
    expect(
      s.bce_classifyOrderResult(200, { success: true, result: { orderId: 'ord-9' } }),
    ).toMatchObject({ kind: 'success', orderId: 'ord-9' });
  });

  it('凭证过期（message.global 对象形态）→ auth', () => {
    expect(
      s.bce_classifyOrderResult(200, { success: false, message: { global: '登录凭证已过期，请重新登录' } }),
    ).toMatchObject({ kind: 'auth' });
  });

  it('售罄文案 → out_of_stock；未支付 → unpaid_exists', () => {
    expect(s.bce_classifyOrderResult(200, { success: false, message: '该套餐已售罄' })).toMatchObject({ kind: 'out_of_stock' });
    expect(s.bce_classifyOrderResult(200, { success: false, message: '库存不足' })).toMatchObject({ kind: 'out_of_stock' });
    expect(s.bce_classifyOrderResult(200, { success: false, message: '存在未支付订单，请先支付' })).toMatchObject({ kind: 'unpaid_exists' });
  });

  it('429 → rate_limited；401 → auth；500 无 JSON → http_error', () => {
    expect(s.bce_classifyOrderResult(429, null)).toMatchObject({ kind: 'rate_limited' });
    expect(s.bce_classifyOrderResult(401, null)).toMatchObject({ kind: 'auth' });
    expect(s.bce_classifyOrderResult(500, null)).toMatchObject({ kind: 'http_error', status: 500 });
  });

  it('其他业务失败 → unknown', () => {
    expect(s.bce_classifyOrderResult(200, { success: false, message: '风控拦截' })).toMatchObject({ kind: 'unknown' });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/unit/bce-main/api.test.ts`
Expected: FAIL（`src/bce-main/20-api.js` 不存在）

- [ ] **Step 3: 实现 `src/bce-main/20-api.js`**

```js
// /api/qianfan protocol layer (probed 2026-07-18, see spec §2).
// GETs need no signing; POSTs need a fresh csrftoken header per request.

async function bce_checkStock() {
  var res = await fetch('/api/qianfan/charge/tokenPlanPersonal/firstPurchaseConfig', {
    credentials: 'include',
  });
  var json = await res.json().catch(function () {
    return null;
  });
  return bce_parseStock(json);
}

// PURE: normalize firstPurchaseConfig -> { ok, available, times }
function bce_parseStock(json) {
  var result = (json && json.result) || {};
  var available = result.available;
  if (!json || json.success !== true || !available || typeof available !== 'object') {
    return { ok: false, available: {}, times: [] };
  }
  return {
    ok: true,
    available: available,
    times: Array.isArray(result.times) ? result.times : [],
  };
}

// PURE: order body, matching the page bundle's charge/order/new payload.
function bce_buildOrderBody(planType, autoRenew) {
  return {
    serviceType: 'WENXINFACTORY',
    productType: 'tokenPlanPersonal',
    autoRenew: !!autoRenew,
    items: [{ config: { planType: planType } }],
  };
}

// PURE: classify createOrder outcome. message may be a string or {global:string}.
function bce_classifyOrderResult(httpStatus, json) {
  var rawMsg = json && json.message;
  var msg = typeof rawMsg === 'string' ? rawMsg : (rawMsg && rawMsg.global) || '';
  if (typeof msg !== 'string') msg = String(msg);
  var result = json && json.result;
  var orderId = result && (result.orderId || result.order_id || (result.data && result.data.orderId));
  if (json && json.success === true && orderId) {
    return { kind: 'success', orderId: String(orderId), raw: json };
  }
  if (msg.indexOf('未支付') >= 0 || msg.indexOf('待支付') >= 0) {
    return { kind: 'unpaid_exists', message: msg, raw: json };
  }
  if (
    msg.indexOf('售罄') >= 0 ||
    msg.indexOf('库存') >= 0 ||
    msg.indexOf('抢光') >= 0 ||
    msg.indexOf('售完') >= 0 ||
    msg.indexOf('无货') >= 0
  ) {
    return { kind: 'out_of_stock', message: msg, raw: json };
  }
  if (msg.indexOf('登录凭证已过期') >= 0 || msg.indexOf('重新登录') >= 0 || msg.indexOf('未登录') >= 0) {
    return { kind: 'auth', status: httpStatus, message: msg, raw: json };
  }
  if (httpStatus === 429) return { kind: 'rate_limited', status: httpStatus, raw: json };
  if (httpStatus === 401 || httpStatus === 403) {
    return { kind: 'auth', status: httpStatus, message: msg, raw: json };
  }
  if (!json || httpStatus >= 400) return { kind: 'http_error', status: httpStatus, raw: json };
  return { kind: 'unknown', message: msg, raw: json };
}

async function bce_createOrder(planType, autoRenew) {
  var csrf = bce_readCsrf();
  var res;
  var json = null;
  try {
    res = await fetch('/api/qianfan/charge/order/new', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', csrftoken: csrf },
      body: JSON.stringify(bce_buildOrderBody(planType, autoRenew)),
    });
    json = await res.json().catch(function () {
      return null;
    });
  } catch (e) {
    return { kind: 'network', message: String((e && e.message) || e) };
  }
  return bce_classifyOrderResult(res.status, json);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run tests/unit/bce-main`
Expected: PASS（shared 9 + api 9 用例）

- [ ] **Step 5: Commit**

```bash
pnpm build:overlay
git add src/bce-main/20-api.js tests/unit/bce-main/api.test.ts public/bce-main.js
git commit -m "feat(bce-main): add qianfan protocol layer (stock/order/csrf)"
```

---

### Task 3: `30-stock.js` 库存轮询 + 状态机

**Files:**
- Create: `src/bce-main/30-stock.js`
- Test: `tests/unit/bce-main/stock.test.ts`

**Interfaces:**
- Consumes: `BCE_CONFIG`、`bce_nextArmedMs()`（Task 1）、`bce_checkStock()`（Task 2）、`bce_startFire()`（Task 4，运行期）
- Produces: `bceState`（phase/autoFire/autoRenew/selected/pollTimer/attempts/armedStartMs/saleTimes/lastStock）、`bceLogs`、`bce_log(line)`、`bce_setPhase(phase)`、`bce_nextPhase(phase, anyInStock, armedNow)`、`bce_pollTick()`、`bce_schedulePoll(ms)`、`bce_stopFire()`

- [ ] **Step 1: 写失败测试**

`tests/unit/bce-main/stock.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadBceMainModules } from './_harness';

function load() {
  return loadBceMainModules(['00-config', '10-shared', '30-stock']);
}

describe('bce_nextPhase', () => {
  it('终态保持不变（FIRING/SUCCESS/FAIL）', () => {
    const s = load();
    for (const p of ['FIRING', 'SUCCESS', 'FAIL']) {
      expect(s.bce_nextPhase(p, true, true)).toBe(p);
    }
  });

  it('任一勾选档有货 → IN_STOCK', () => {
    const s = load();
    expect(s.bce_nextPhase('SOLD_OUT', true, false)).toBe('IN_STOCK');
    expect(s.bce_nextPhase('ARMED', true, true)).toBe('IN_STOCK');
  });

  it('无货 + 开售窗口 → ARMED；无货 + 窗口外 → SOLD_OUT', () => {
    const s = load();
    expect(s.bce_nextPhase('SOLD_OUT', false, true)).toBe('ARMED');
    expect(s.bce_nextPhase('SOLD_OUT', false, false)).toBe('SOLD_OUT');
  });
});

describe('bce_log / bce_setPhase', () => {
  it('日志截断到 50 条；阶段变化触发 UI hook（若存在）', () => {
    const calls: string[] = [];
    const s = load();
    (s as any).bce_uiSetPhase = (p: string) => calls.push(p);
    s.bce_setPhase('SOLD_OUT');
    s.bce_setPhase('SOLD_OUT');
    s.bce_setPhase('ARMED');
    expect(calls).toEqual(['SOLD_OUT', 'ARMED']);
    for (let i = 0; i < 60; i++) s.bce_log('line ' + i);
    expect((s.bceLogs as string[]).length).toBe(50);
  });

  it('默认勾选 lite/pro，autoFire 默认开，autoRenew 默认关', () => {
    const s = load();
    expect((s.bceState as any).selected).toEqual(['lite', 'pro']);
    expect((s.bceState as any).autoFire).toBe(true);
    expect((s.bceState as any).autoRenew).toBe(false);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/unit/bce-main/stock.test.ts`
Expected: FAIL（`src/bce-main/30-stock.js` 不存在）

- [ ] **Step 3: 实现 `src/bce-main/30-stock.js`**

```js
// Stock polling loop + phase state machine.
// Phases: INIT -> SOLD_OUT -> ARMED -> (IN_STOCK | FIRING) -> SUCCESS | FAIL
var bceState = {
  phase: 'INIT',
  autoFire: true,
  autoRenew: false,
  selected: BCE_CONFIG.defaultSelected.slice(),
  pollTimer: 0,
  attempts: 0,
  armedStartMs: 0,
  saleTimes: ['10:00'],
  lastStock: null,
};

var bceLogs = [];

function bce_log(line) {
  bceLogs.push(line);
  if (bceLogs.length > 50) bceLogs.shift();
  if (typeof bce_uiLog === 'function') bce_uiLog(line);
}

function bce_setPhase(phase) {
  if (bceState.phase === phase) return;
  bceState.phase = phase;
  if (typeof bce_uiSetPhase === 'function') bce_uiSetPhase(phase);
}

// PURE: next phase given current phase, selected-stock flag, armed-window flag.
function bce_nextPhase(phase, anyInStock, armedNow) {
  if (phase === 'FIRING' || phase === 'SUCCESS' || phase === 'FAIL') return phase;
  if (anyInStock) return 'IN_STOCK';
  if (armedNow) return 'ARMED';
  return 'SOLD_OUT';
}

function bce_schedulePoll(ms) {
  clearTimeout(bceState.pollTimer);
  bceState.pollTimer = setTimeout(bce_pollTick, ms);
}

async function bce_pollTick() {
  if (bceState.phase === 'FIRING' || bceState.phase === 'SUCCESS' || bceState.phase === 'FAIL') return;
  var stock;
  try {
    stock = await bce_checkStock();
  } catch (e) {
    bce_log('[STOCK_FAIL] ' + ((e && e.message) || e));
    bce_schedulePoll(BCE_CONFIG.idlePollMs);
    return;
  }
  bceState.lastStock = stock;
  if (stock.ok && stock.times.length) {
    bceState.saleTimes = stock.times;
    bceState.armedStartMs = bce_nextArmedMs(stock.times, Date.now(), BCE_CONFIG.armedLeadMs);
  }
  if (typeof bce_uiStock === 'function') bce_uiStock(stock.available);
  var anyInStock = bceState.selected.some(function (p) {
    return stock.available[p] === true;
  });
  var armedNow = bceState.armedStartMs > 0 && Date.now() >= bceState.armedStartMs;
  var next = bce_nextPhase(bceState.phase, anyInStock, armedNow);
  bce_setPhase(next);
  if (next === 'SOLD_OUT') {
    bce_schedulePoll(BCE_CONFIG.idlePollMs);
  } else if (next === 'ARMED') {
    bce_schedulePoll(BCE_CONFIG.armedPollMs);
  } else if (next === 'IN_STOCK') {
    if (bceState.autoFire) bce_startFire('stock');
    else bce_log('检测到库存！（自动开火已关闭，请手动点击「开始刷新库存」）');
  }
}

function bce_stopFire() {
  if (bceState.phase !== 'FIRING') return;
  bceState.autoFire = false;
  var chk = document.getElementById('__bce_autofire');
  if (chk) chk.checked = false;
  bce_log('已手动停止（第 ' + bceState.attempts + ' 发后），自动开火已关闭');
  bce_setPhase('SOLD_OUT');
  bce_schedulePoll(BCE_CONFIG.idlePollMs);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run tests/unit/bce-main/stock.test.ts`
Expected: PASS（5 个用例）

- [ ] **Step 5: Commit**

```bash
pnpm build:overlay
git add src/bce-main/30-stock.js tests/unit/bce-main/stock.test.ts public/bce-main.js
git commit -m "feat(bce-main): add stock polling state machine"
```

---

### Task 4: `50-fire.js` 开火引擎

**Files:**
- Create: `src/bce-main/50-fire.js`
- Test: `tests/unit/bce-main/fire.test.ts`

**Interfaces:**
- Consumes: `BCE_CONFIG`、`bce_playBeeps()`、`bce_postCmd()`（Task 1）、`bce_createOrder()`（Task 2）、`bceState`、`bce_log()`、`bce_setPhase()`（Task 3）
- Produces: `bce_sleep(ms)`、`bce_startFire(reason)`、`bce_onFireSuccess(orderId, planType, note)`、`bce_onFireFail(result)`、`bce_failHint(result)`、`bce_productName(planType)`、收银台 URL 规则 `location.origin + '/finance/pay?serviceType=WENXINFACTORY&fromService=CODE_PLAN&orderType=NEW&orderId=' + encodeURIComponent(orderId)`

- [ ] **Step 1: 写失败测试**

`tests/unit/bce-main/fire.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadBceMainModules } from './_harness';

function load(posted: any[]) {
  const s = loadBceMainModules(['00-config', '10-shared', '20-api', '30-stock', '50-fire'], {
    window: {
      postMessage: (m: any) => posted.push(m),
      addEventListener: () => {},
      removeEventListener: () => {},
    },
    location: { origin: 'https://console.bce.baidu.com', assign: () => {} },
  });
  (s.BCE_CONFIG as any).fireIntervalMs = 1;
  (s.BCE_CONFIG as any).fireBackoffMs = 1;
  (s.BCE_CONFIG as any).maxFireAttempts = 6;
  return s;
}

describe('bce_startFire', () => {
  it('按优先级逐档尝试：lite 售罄 → pro 成功，postCmd 带 orderId 与收银台 URL', async () => {
    const posted: any[] = [];
    const s = load(posted);
    const tried: string[] = [];
    (s as any).bce_createOrder = async (planType: string) => {
      tried.push(planType);
      return planType === 'pro' ? { kind: 'success', orderId: 'ord-66' } : { kind: 'out_of_stock' };
    };
    await s.bce_startFire('test');
    expect(tried).toEqual(['lite', 'pro']);
    expect(s.bceState.phase).toBe('SUCCESS');
    const msg = posted.find((m) => m.type === 'BCE_PURCHASE_SUCCESS');
    expect(msg.__bce_cmd).toBe(true);
    expect(msg.orderId).toBe('ord-66');
    expect(msg.productName).toBe('Pro');
    expect(msg.payUrl).toContain('/finance/pay?');
    expect(msg.payUrl).toContain('orderId=ord-66');
  });

  it('unpaid_exists → 视为成功且不带 orderId（不跳收银台）', async () => {
    const posted: any[] = [];
    const s = load(posted);
    (s as any).bce_createOrder = async () => ({ kind: 'unpaid_exists', message: '存在未支付订单' });
    await s.bce_startFire('test');
    expect(s.bceState.phase).toBe('SUCCESS');
    const msg = posted.find((m) => m.type === 'BCE_PURCHASE_SUCCESS');
    expect(msg.orderId).toBe('');
  });

  it('auth 失败 → FAIL 且立即停手（不重试、不换档）', async () => {
    const posted: any[] = [];
    const s = load(posted);
    let n = 0;
    (s as any).bce_createOrder = async () => {
      n++;
      return { kind: 'auth', message: '登录凭证已过期' };
    };
    await s.bce_startFire('test');
    expect(n).toBe(1);
    expect(s.bceState.phase).toBe('FAIL');
  });

  it('全部售罄 → 达到 maxFireAttempts 后 FAIL(exhausted)', async () => {
    const posted: any[] = [];
    const s = load(posted);
    let n = 0;
    (s as any).bce_createOrder = async () => {
      n++;
      return { kind: 'out_of_stock' };
    };
    await s.bce_startFire('test');
    expect(n).toBe(6);
    expect(s.bceState.phase).toBe('FAIL');
  });

  it('createOrder 抛异常 → internal → FAIL 而非卡死', async () => {
    const posted: any[] = [];
    const s = load(posted);
    (s as any).bce_createOrder = async () => {
      throw new Error('boom');
    };
    await s.bce_startFire('test');
    expect(s.bceState.phase).toBe('FAIL');
    expect(s.bceState.attempts).toBe(1);
  });
});

describe('bce_failHint', () => {
  it('按 kind 给出中文提示', () => {
    const s = load([]);
    expect(s.bce_failHint({ kind: 'auth' })).toContain('登录');
    expect(s.bce_failHint({ kind: 'http_error', status: 403 })).toContain('风控');
    expect(s.bce_failHint({ kind: 'exhausted' })).toContain('最大尝试次数');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/unit/bce-main/fire.test.ts`
Expected: FAIL（`src/bce-main/50-fire.js` 不存在）

- [ ] **Step 3: 实现 `src/bce-main/50-fire.js`**

```js
// Fire engine: iterate selected plans by priority, createOrder with
// classified error handling. Success -> cashier redirect (manual payment).

function bce_sleep(ms) {
  return new Promise(function (r) {
    setTimeout(r, ms);
  });
}

function bce_productName(planType) {
  var p = BCE_CONFIG.products.find(function (x) {
    return x.planType === planType;
  });
  return p ? p.name : planType;
}

function bce_payUrl(orderId) {
  return (
    location.origin +
    '/finance/pay?serviceType=WENXINFACTORY&fromService=CODE_PLAN&orderType=NEW&orderId=' +
    encodeURIComponent(orderId)
  );
}

async function bce_startFire(reason) {
  if (bceState.phase === 'FIRING' || bceState.phase === 'SUCCESS') return;
  bceState.attempts = 0;
  bce_setPhase('FIRING');
  clearTimeout(bceState.pollTimer);
  bce_log('开火（' + reason + '）…');
  var targets = bceState.selected.slice();
  var backoff = 0;
  while (
    bceState.phase === 'FIRING' &&
    bceState.attempts < BCE_CONFIG.maxFireAttempts
  ) {
    for (
      var i = 0;
      i < targets.length &&
      bceState.phase === 'FIRING' &&
      bceState.attempts < BCE_CONFIG.maxFireAttempts;
      i++
    ) {
      var planType = targets[i];
      bceState.attempts++;
      var result;
      try {
        result = await bce_createOrder(planType, bceState.autoRenew);
      } catch (e) {
        result = { kind: 'internal', message: String((e && e.message) || e) };
      }
      if (bceState.phase !== 'FIRING') return; // 手动停止后丢弃在途结果
      if (result.kind === 'success') {
        bce_onFireSuccess(result.orderId, planType);
        return;
      }
      if (result.kind === 'unpaid_exists') {
        bce_onFireSuccess('', planType, '已存在待支付订单，请直接完成支付');
        return;
      }
      if (result.kind === 'out_of_stock') {
        bce_log('第 ' + bceState.attempts + ' 发（' + bce_productName(planType) + '）：售罄，换下一档');
        continue;
      }
      if (result.kind === 'rate_limited' || result.kind === 'network') {
        backoff = Math.min(backoff + 1, 4);
        bce_log('[FIRE_FAIL] ' + result.kind + '，退避 ×' + backoff);
        await bce_sleep(BCE_CONFIG.fireIntervalMs + backoff * BCE_CONFIG.fireBackoffMs);
        continue;
      }
      // auth / http_error / unknown / internal：立即停手交人工
      bce_onFireFail(result);
      return;
    }
    if (bceState.phase === 'FIRING') await bce_sleep(BCE_CONFIG.fireIntervalMs);
  }
  if (bceState.phase === 'FIRING') {
    bce_onFireFail({ kind: 'exhausted' });
  }
}

function bce_onFireSuccess(orderId, planType, note) {
  bce_setPhase('SUCCESS');
  bce_playBeeps(3);
  var payUrl = orderId ? bce_payUrl(orderId) : '';
  bce_postCmd('BCE_PURCHASE_SUCCESS', {
    orderId: orderId || '',
    productName: bce_productName(planType),
    plan: BCE_CONFIG.title,
    payUrl: payUrl,
  });
  bce_log(
    '✅ 抢购成功（' + bce_productName(planType) + '）' +
      (orderId ? '，订单 ' + orderId : '') +
      (note ? '（' + note + '）' : ''),
  );
  if (typeof bce_uiShowResult === 'function') bce_uiShowResult(true, orderId, note || '', payUrl);
  // 有 orderId 时直接跳收银台（volc 式），由用户手动完成支付
  if (orderId) location.assign(payUrl);
}

function bce_onFireFail(result) {
  bce_setPhase('FAIL');
  bce_playBeeps(1);
  var hint = bce_failHint(result);
  bce_log('[FIRE_FAIL] ' + hint);
  if (typeof bce_uiShowResult === 'function') bce_uiShowResult(false, null, hint, '');
}

function bce_failHint(result) {
  switch (result && result.kind) {
    case 'auth':
      return '登录已失效，请刷新页面重新登录后重试';
    case 'rate_limited':
      return '持续限流，已停手；请稍后再试';
    case 'http_error':
      return '接口异常（HTTP ' + result.status + '），可能被风控拦截；请改用手动点击页面原生按钮';
    case 'exhausted':
      return '已达最大尝试次数仍未抢到；请改用手动点击页面原生按钮';
    case 'unknown':
      return '未知响应，已停手；请改用手动点击页面原生按钮';
    default:
      return '抢购失败：' + ((result && result.message) || (result && result.kind) || 'unknown');
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run tests/unit/bce-main`
Expected: PASS（shared 9 + api 9 + stock 5 + fire 6 用例）

- [ ] **Step 5: Commit**

```bash
pnpm build:overlay
git add src/bce-main/50-fire.js tests/unit/bce-main/fire.test.ts public/bce-main.js
git commit -m "feat(bce-main): add fire engine with per-plan priority and classified errors"
```

---

### Task 5: `40-ui.js` overlay UI + `60-boot.js` 启动编排

**Files:**
- Create: `src/bce-main/40-ui.js`
- Create: `src/bce-main/60-boot.js`
- Test: `tests/unit/bce-main/ui.test.ts`

**Interfaces:**
- Consumes: `BCE_VERSION`、`BCE_CONFIG`（Task 1）、`bceState`、`bce_log`、`bce_setPhase`、`bce_stopFire`（Task 3）、`bce_startFire`（Task 4）、`bce_getCookies`（Task 1）
- Produces: `bce_fireButtonLabel(phase)`、`bce_readLoginName()`、`bce_buildOverlay()`、`bce_uiSetPhase(phase)`、`bce_uiLog(line)`、`bce_uiStock(available)`、`bce_uiShowResult(ok, orderId, message, payUrl)`、`bce_uiLogin(name)`

- [ ] **Step 1: 写失败测试（纯函数；DOM 行为走浏览器验证）**

`tests/unit/bce-main/ui.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadBceMainModules } from './_harness';

describe('bce_fireButtonLabel', () => {
  it('FIRING → 停止刷新库存；SUCCESS → 已抢到；其他 → 开始刷新库存', () => {
    const s = loadBceMainModules(['00-config', '10-shared', '30-stock', '40-ui']);
    expect(s.bce_fireButtonLabel('FIRING')).toBe('停止刷新库存');
    expect(s.bce_fireButtonLabel('SUCCESS')).toBe('✅ 已抢到');
    expect(s.bce_fireButtonLabel('SOLD_OUT')).toBe('开始刷新库存');
    expect(s.bce_fireButtonLabel('ARMED')).toBe('开始刷新库存');
  });
});

describe('bce_readLoginName', () => {
  it('有登录 cookie → 返回解码后的昵称；无 → 空串', () => {
    const s = loadBceMainModules(['00-config', '10-shared', '30-stock', '40-ui'], {
      document: {
        cookie: 'bce-login-accountid=915130241; bce-login-display-name=%E5%BC%A0%E4%B8%89',
      },
    });
    expect(s.bce_readLoginName()).toBe('张三');
    const s2 = loadBceMainModules(['00-config', '10-shared', '30-stock', '40-ui'], {
      document: { cookie: 'a=1' },
    });
    expect(s2.bce_readLoginName()).toBe('');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/unit/bce-main/ui.test.ts`
Expected: FAIL（`src/bce-main/40-ui.js` 不存在）

- [ ] **Step 3: 实现 `src/bce-main/40-ui.js`**

```js
// Overlay UI: draggable card with phase lamp, multi-select product cards,
// fire toggle button, overwrite status line. Volc/ali style benchmark.

// PURE: merged fire/stop button label by phase.
function bce_fireButtonLabel(phase) {
  if (phase === 'FIRING') return '停止刷新库存';
  if (phase === 'SUCCESS') return '✅ 已抢到';
  return '开始刷新库存';
}

// PURE: read login display name from bce-login cookies.
function bce_readLoginName() {
  var cookies = bce_getCookies();
  if (!cookies['bce-login-accountid']) return '';
  var name = cookies['bce-login-display-name'] || '';
  try {
    return decodeURIComponent(name);
  } catch (e) {
    return name;
  }
}

function bce_bindDrag(box, handle) {
  var sx = 0;
  var sy = 0;
  var ox = 0;
  var oy = 0;
  var dragging = false;
  handle.addEventListener('mousedown', function (e) {
    dragging = true;
    sx = e.clientX;
    sy = e.clientY;
    var r = box.getBoundingClientRect();
    ox = r.left;
    oy = r.top;
    e.preventDefault();
  });
  document.addEventListener('mousemove', function (e) {
    if (!dragging) return;
    box.style.left = ox + e.clientX - sx + 'px';
    box.style.top = oy + e.clientY - sy + 'px';
    box.style.right = 'auto';
  });
  document.addEventListener('mouseup', function () {
    dragging = false;
  });
}

function bce_productCardHtml(p, selected, soldOut) {
  return (
    '<div class="__bce_prod" data-pt="' + p.planType + '" style="display:flex;align-items:center;gap:8px;' +
    'padding:8px 10px;border:1.5px solid ' + (selected ? '#f53f3f' : 'rgba(12,18,36,.25)') + ';' +
    'border-radius:8px;cursor:pointer;background:' + (selected ? '#fff5f5' : '#fff') + ';">' +
    '<span class="__bce_prod_dot" style="width:10px;height:10px;border-radius:50%;flex-shrink:0;' +
    'border:1.5px solid ' + (selected ? '#f53f3f' : 'rgba(12,18,36,.35)') + ';' +
    'background:' + (selected ? '#f53f3f' : '#fff') + ';"></span>' +
    '<span style="font-weight:700;">' + p.name + '</span>' +
    '<span style="font-size:10px;color:#6a7496;">' + p.price + '</span>' +
    '<span class="__bce_soldout" style="margin-left:auto;font-size:10px;color:#9aa3b8;' +
    (soldOut ? '' : 'display:none;') + '">售罄</span></div>'
  );
}

function bce_buildOverlay() {
  if (document.getElementById('__bce_overlay')) return;
  var box = document.createElement('div');
  box.id = '__bce_overlay';
  box.style.cssText =
    'position:fixed;top:72px;right:16px;width:300px;z-index:999999;' +
    'background:#fff;border:1.5px solid #0c1224;border-radius:12px;' +
    'box-shadow:3px 3px 0 0 #0c1224;font:12px/1.5 -apple-system,"PingFang SC",sans-serif;' +
    'color:#0c1224;user-select:none;';
  var cardsHtml = '';
  for (var i = 0; i < BCE_CONFIG.products.length; i++) {
    var p = BCE_CONFIG.products[i];
    cardsHtml += bce_productCardHtml(p, bceState.selected.indexOf(p.planType) >= 0, false);
  }
  box.innerHTML =
    '<div id="__bce_hd" style="display:flex;align-items:center;justify-content:space-between;' +
    'padding:8px 10px;border-bottom:1.5px solid #0c1224;cursor:move;font-weight:800;">' +
    '<span>🚀 千帆 Token Plan 秒杀</span>' +
    '<span style="font:9px monospace;color:#6a7496;">v' + BCE_VERSION + '</span></div>' +
    '<div style="padding:10px;display:flex;flex-direction:column;gap:8px;">' +
    '<div style="display:flex;align-items:center;gap:6px;">' +
    '<span id="__bce_dot" style="width:8px;height:8px;border-radius:50%;background:#9aa3b8;"></span>' +
    '<span id="__bce_phase" style="font-weight:700;">初始化…</span>' +
    '<span id="__bce_login" style="margin-left:auto;font-size:10px;color:#6a7496;"></span></div>' +
    cardsHtml +
    '<div style="display:flex;gap:10px;font-size:11px;">' +
    '<label><input type="checkbox" id="__bce_autofire" checked> 到点自动开火</label>' +
    '<label><input type="checkbox" id="__bce_autorenew"> 连续包月</label></div>' +
    '<button id="__bce_fire" style="width:100%;padding:10px 0;background:#f53f3f;color:#fff;' +
    'border:1.5px solid #f53f3f;border-radius:8px;font-weight:800;font-size:13px;cursor:pointer;">开始刷新库存</button>' +
    '<div id="__bce_result" style="display:none;padding:8px;border-radius:8px;font-weight:700;"></div>' +
    '<div id="__bce_status" style="font:10px/1.5 monospace;color:#3a4358;min-height:15px;' +
    'background:#fafaf7;border:1px dashed rgba(12,18,36,.25);border-radius:6px;padding:4px 6px;' +
    'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"></div>' +
    '</div>';
  document.body.appendChild(box);
  bce_bindDrag(box, document.getElementById('__bce_hd'));

  var cards = box.querySelectorAll('.__bce_prod');
  for (var j = 0; j < cards.length; j++) {
    cards[j].addEventListener('click', function () {
      bce_toggleProduct(this.getAttribute('data-pt'));
    });
  }
  document.getElementById('__bce_autofire').addEventListener('change', function (e) {
    bceState.autoFire = !!e.target.checked;
    bce_log('自动开火 ' + (bceState.autoFire ? '开' : '关'));
  });
  document.getElementById('__bce_autorenew').addEventListener('change', function (e) {
    bceState.autoRenew = !!e.target.checked;
    bce_log(bceState.autoRenew ? '连续包月' : '单月购买');
  });
  document.getElementById('__bce_fire').addEventListener('click', function () {
    if (bceState.phase === 'FIRING') bce_stopFire();
    else bce_startFire('manual');
  });
}

function bce_toggleProduct(planType) {
  var idx = bceState.selected.indexOf(planType);
  if (idx >= 0) {
    bceState.selected.splice(idx, 1);
  } else {
    if (bceState.selected.length >= BCE_CONFIG.maxSelections) {
      bce_log('最多选 ' + BCE_CONFIG.maxSelections + ' 个');
      return;
    }
    bceState.selected.push(planType);
  }
  // 重绘卡片选中态
  var cards = document.querySelectorAll('#__bce_overlay .__bce_prod');
  for (var i = 0; i < cards.length; i++) {
    var on = bceState.selected.indexOf(cards[i].getAttribute('data-pt')) >= 0;
    cards[i].style.border = '1.5px solid ' + (on ? '#f53f3f' : 'rgba(12,18,36,.25)');
    cards[i].style.background = on ? '#fff5f5' : '#fff';
    var dot = cards[i].querySelector('.__bce_prod_dot');
    if (dot) {
      dot.style.border = '1.5px solid ' + (on ? '#f53f3f' : 'rgba(12,18,36,.35)');
      dot.style.background = on ? '#f53f3f' : '#fff';
    }
  }
}

var BCE_PHASE_LABELS = {
  INIT: '初始化…',
  SOLD_OUT: '售罄 · 等待补货',
  ARMED: '开售窗口 · 高频刷新中',
  IN_STOCK: '检测到库存！',
  FIRING: '开火中…',
  SUCCESS: '抢购成功',
  FAIL: '已停手',
};

var BCE_PHASE_COLORS = {
  INIT: '#9aa3b8',
  SOLD_OUT: '#9aa3b8',
  ARMED: '#f59e0b',
  IN_STOCK: '#10b981',
  FIRING: '#ef4444',
  SUCCESS: '#10b981',
  FAIL: '#ef4444',
};

function bce_uiSetPhase(phase) {
  var el = document.getElementById('__bce_phase');
  if (el) el.textContent = BCE_PHASE_LABELS[phase] || phase;
  var dot = document.getElementById('__bce_dot');
  if (dot) dot.style.background = BCE_PHASE_COLORS[phase] || '#9aa3b8';
  var btn = document.getElementById('__bce_fire');
  if (btn) {
    btn.textContent = bce_fireButtonLabel(phase);
    var bg = phase === 'FIRING' ? '#0c1224' : phase === 'SUCCESS' ? '#10b981' : '#f53f3f';
    btn.style.background = bg;
    btn.style.borderColor = bg;
  }
}

// 覆盖式单条状态：只保留最新消息。
function bce_uiLog(line) {
  var el = document.getElementById('__bce_status');
  if (el) el.textContent = line;
}

// 售罄角标：库存接口返回后刷新各卡的「售罄」标记
function bce_uiStock(available) {
  if (!available) return;
  var cards = document.querySelectorAll('#__bce_overlay .__bce_prod');
  for (var i = 0; i < cards.length; i++) {
    var pt = cards[i].getAttribute('data-pt');
    var tag = cards[i].querySelector('.__bce_soldout');
    if (tag) tag.style.display = available[pt] === false ? '' : 'none';
  }
}

function bce_uiShowResult(ok, orderId, message, payUrl) {
  var el = document.getElementById('__bce_result');
  if (!el) return;
  el.style.display = 'block';
  if (ok) {
    el.style.background = '#d1fae5';
    el.style.color = '#065f46';
    el.innerHTML =
      '✅ ' + (orderId ? '订单 ' + orderId : message || '已抢到') +
      (payUrl
        ? ' · <a href="' + payUrl + '" target="_blank" style="color:#065f46;">去收银台支付 →</a>'
        : '');
  } else {
    el.style.background = '#fee2e2';
    el.style.color = '#991b1b';
    el.textContent = '⛔ ' + (message || '抢购失败');
  }
}

function bce_uiLogin(name) {
  var el = document.getElementById('__bce_login');
  if (!el) return;
  if (name) {
    el.textContent = '已登录 ' + name;
    el.style.color = '#10b981';
  } else {
    el.textContent = '未登录！';
    el.style.color = '#ef4444';
  }
}
```

- [ ] **Step 4: 实现 `src/bce-main/60-boot.js`**

```js
// Startup orchestration — concatenated last, runs after all modules load.
(async function bce_boot() {
  try {
    bce_buildOverlay();
    bce_log('千帆 Token Plan 秒杀 overlay v' + BCE_VERSION + ' 已注入');
    bce_uiLogin(bce_readLoginName());
    bce_pollTick();
  } catch (e) {
    try {
      bce_log('[BOOT_FAIL] ' + ((e && e.message) || e));
    } catch (ignored) {}
  }
})();
```

- [ ] **Step 5: 跑测试确认通过 + overlay 构建冒烟**

Run: `pnpm vitest run tests/unit/bce-main`
Expected: PASS（全部 31 用例）

Run: `pnpm build:overlay`
Expected: `Built .../public/bce-main.js from 7 modules`

- [ ] **Step 6: Commit**

```bash
git add src/bce-main tests/unit/bce-main public/bce-main.js
git commit -m "feat(bce-main): add overlay UI and boot orchestration"
```

---

### Task 6: 接入层 + 文档

**Files:**
- Create: `entrypoints/bce-capture.content.ts`
- Modify: `wxt.config.ts`（description、host_permissions、web_accessible_resources）
- Modify: `lib/platform/index.ts`（PLATFORMS +1 条）
- Modify: `entrypoints/popup/components/PlatformEntryGrid.svelte`（ENTRY_NOTES + SALE_TIMES 各 +1 行）
- Modify: `entrypoints/background.ts`（`BCE_PURCHASE_SUCCESS` 分支，插在 `ALI_PURCHASE_SUCCESS` 分支之后）
- Modify: `docs/architecture.md`（补第四平台条目）

**Interfaces:**
- Consumes: `public/bce-main.js`（Task 1-5 产物）、`__bce_cmd` 信封的 `BCE_PURCHASE_SUCCESS`（Task 4 的 `bce_postCmd`）
- Produces: manifest 注册 + popup 第四张紧凑卡（`每日 10:00 (UTC+8) 开售`）+ background badge 处理

- [ ] **Step 1: 新建 `entrypoints/bce-capture.content.ts`**

```ts
// ISOLATED world content script for console.bce.baidu.com/qianfan/resource/token-plan
// Injects the Qianfan Token Plan MAIN-world overlay and forwards purchase
// success notifications to the background worker.
export default defineContentScript({
  matches: ['*://console.bce.baidu.com/qianfan/resource/token-plan*'],
  runAt: 'document_idle',

  main() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('/bce-main.js');
    script.dataset.version = chrome.runtime.getManifest().version;
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);

    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data?.__bce_cmd) return;

      if (data.type === 'BCE_PURCHASE_SUCCESS') {
        try {
          chrome.runtime.sendMessage({
            type: 'BCE_PURCHASE_SUCCESS',
            orderId: data.orderId,
            productName: data.productName,
            plan: data.plan,
            payUrl: data.payUrl,
          });
        } catch (e: any) {
          console.log('[bce-capture] purchase success forward failed', e?.message || String(e));
        }
      }
    });
  },
});
```

- [ ] **Step 2: 修改 `wxt.config.ts`**

`description` 改为：

```ts
    description: '多平台 Coding Plan 秒杀助手浏览器扩展（智谱 / 火山引擎 / 阿里百炼 / 百度千帆）',
```

`host_permissions` 改为：

```ts
    host_permissions: ['*://*.bigmodel.cn/*', '*://*.volcengine.com/*', '*://*.aliyun.com/*', '*://*.bce.baidu.com/*'],
```

`web_accessible_resources` 数组末尾追加：

```ts
      {
        resources: ['bce-main.js'],
        matches: ['*://*.bce.baidu.com/*'],
      },
```

- [ ] **Step 3: 修改 `lib/platform/index.ts`**

`PLATFORMS` 数组末尾（bailian-codingplan 之后）追加：

```ts
  {
    id: 'baidu-tokenplan',
    displayName: '百度千帆 Token Plan',
    hostPatterns: ['*://*.bce.baidu.com/*'],
    entryUrl: 'https://console.bce.baidu.com/qianfan/resource/token-plan',
  },
```

- [ ] **Step 4: 修改 `entrypoints/popup/components/PlatformEntryGrid.svelte`**

`ENTRY_NOTES` 加一行：

```ts
    'baidu-tokenplan': '每日 10:00 补货 · Lite/Pro 常售罄 · 4.9 元起',
```

`SALE_TIMES` 加一行：

```ts
    'baidu-tokenplan': '每日 10:00 (UTC+8) 开售',
```

（渲染逻辑无需改——新条目自动成为紧凑 group 卡 + "进入"按钮。）

- [ ] **Step 5: 修改 `entrypoints/background.ts`**

在 `ALI_PURCHASE_SUCCESS` 分支之后、`SALE_TIME_UPDATED` 分支之前插入：

```ts
    if (msg.type === 'BCE_PURCHASE_SUCCESS') {
      (async () => {
        const { orderId, productName, plan } = msg;
        await chrome.action.setBadgeText({ text: 'OK' });
        await chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
        await chrome.action.setTitle({
          title:
            (plan || '百度千帆') +
            ' 抢购成功' +
            (orderId ? ' · 订单 ' + orderId : '') +
            (productName ? ' · ' + productName : ''),
        });
        // OK badge is a transient success indicator; clear it after the payment window.
        await chrome.alarms.clear('badge-ok-clear');
        await chrome.alarms.create('badge-ok-clear', { when: Date.now() + OK_BADGE_TTL_MS });
        sendResponse({ ok: true });
      })().catch((err) => {
        sendResponse({ ok: false, error: err?.message || String(err) });
      });
      return true;
    }
```

- [ ] **Step 6: 修改 `docs/architecture.md`**

沿用 Task 7（百炼）的最小修订方式：

1. §1 产品目标补充句中的平台列表改为"火山引擎（volc-main）、阿里百炼（ali-main）与百度千帆（bce-main）"。
2. §9 目录结构：`entrypoints/` 下补 `bce-capture.content.ts  # 百度千帆 content script (ISOLATED)`；`src/` 下补 `bce-main/  # 百度千帆 MAIN world 覆盖层源码`；`public/` 下补 `bce-main.js  # 生成物（scripts/build-overlay.js）`。
3. §8 MAIN World 注入脚本：补一段——"`bce-main.js`（百度千帆）：轮询 `/api/qianfan/charge/tokenPlanPersonal/firstPurchaseConfig` 获取四档 `available` 与 `times` 开售时刻，补货翻转后按勾选优先级 `POST /api/qianfan/charge/order/new`（带 `csrftoken` 头，取自 `bce-user-info` cookie），成功即跳 `/finance/pay` 收银台由用户手动支付。协议细节见 `docs/superpowers/specs/2026-07-18-baidu-tokenplan-seckill-design.md`。"

- [ ] **Step 7: 全量回归**

Run: `pnpm test`
Expected: 全部 PASS（既有 141 + 新增 bce-main 31 = 172）

Run: `pnpm build`
Expected: 4 个 overlay 产出；wxt build 成功；minifier 守卫通过

- [ ] **Step 8: 浏览器手动验证（控制器执行，只读 + 不开火）**

1. `chrome://extensions` 重新加载 `output/chrome-mv3/`
2. 打开 `https://console.bce.baidu.com/qianfan/resource/token-plan`
3. 确认：overlay 出现；登录昵称；四档商品卡（Lite/Pro 默认勾选红框、Lite/Pro 卡带"售罄"角标）；阶段灯"售罄 · 等待补货"或"开售窗口"（视时间）；状态行"已注入"
4. 确认 DevTools Network 中 overlay 轮询 `firstPurchaseConfig` 返回 200
5. popup：第四张卡"百度千帆 Token Plan · ⏰ 每日 10:00 (UTC+8) 开售 · ▶ 进入"
6. **不要**点"开始刷新库存"，也**不要勾选 Mini/Max**（两档当前可购）。注意本实现为电平触发：任一勾选档 `available=true` 且自动开火开启时，下一轮轮询（≤2s）即真实下单（产生未支付订单，可在收银台放弃）。验证只读行为时保持默认勾选（Lite/Pro 售罄档）即可。

- [ ] **Step 9: Commit**

```bash
git add entrypoints/bce-capture.content.ts wxt.config.ts lib/platform/index.ts \
  entrypoints/popup/components/PlatformEntryGrid.svelte entrypoints/background.ts \
  docs/architecture.md
git commit -m "feat(baidu): wire bce-capture content script, manifest, registry, popup card, success badge, docs"
```

---

## 验收清单（Definition of Done）

- [ ] `pnpm test` 全绿（新增 31 个 bce-main 用例，累计 172）
- [ ] `pnpm build` 全链路通过
- [ ] 真实页面手动验证：overlay 注入、四档卡片、售罄角标、登录态、轮询 200
- [ ] popup 第四张紧凑卡（开售时间带时区 + 进入按钮）
- [ ] （顺延到下个 10:00 窗口）端到端：翻转开火 → 成功/停手 → badge OK + 收银台跳转；若遇未知响应按设计停手并提示手动
