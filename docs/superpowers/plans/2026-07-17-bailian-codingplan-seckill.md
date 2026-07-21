# 阿里百炼 Coding Plan 抢购（第三平台）实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为扩展新增第三个平台——阿里百炼 Coding Plan（common-buy.aliyun.com/coding-plan）的定时抢购 overlay，实现"库存轮询 → 补货倒计时 → 到点自动 createOrder → 引导手动支付"。

**Architecture:** volc 式自包含 MAIN world overlay（`src/ali-main/` 7 个 vanilla-JS 模块，构建脚本自动打包为 `public/ali-main.js`）+ 薄 ISOLATED content script 注入 + 成功消息转发 background 角标。所有 buy-api 请求在 MAIN world 直接 `fetch` + `credentials:'include'`（页面同等能力，已实证无 WAF 拦截），不经 background/ISOLATED 代理。

**Tech Stack:** WXT 0.20 (Chrome MV3) · TypeScript · Svelte 5 · vitest 4 + Node vm 沙箱（`tests/unit/_vm-harness.ts`）· pnpm 10.33

**Spec:** `docs/superpowers/specs/2026-07-17-bailian-codingplan-seckill-design.md`（含实证协议摘要）

## Global Constraints

- overlay 源码为无模块 vanilla JS，`src/ali-main/*.js` 按文件名序拼接进 IIFE，跨文件共享一律用顶层 `var` / `function` 声明（`const` 在 vm 沙箱测试中不可枚举）。
- 协议常量：`apiBase=https://buy-api.aliyun.com`、`commodityCode=sfm_codingplan_public_cn`、`skuId=pro`。
- createOrder 必须带 `X-XSRF-TOKEN` 头（`GET /getCsrfToken.json` 现取）+ body 内 `umidToken/collina/bx-umidtoken/submitref/linkage`。
- 绝不自动支付；`ORDER.INST_HAS_UNPAID_ORDER` 视为抢购成功并停手。
- 测试约定：测试 `src/*-main/*.js` 源文件（非 `public/` 生成物）；禁止真实 fetch；组件测试文件以 `.svelte.test.ts` 命名。
- 构建链：`pnpm build` = `build:overlay` → `wxt build` → `verify-no-minifier-collision`；`public/ali-main.js` 为生成物但入库。
- 包管理一律 `pnpm`；测试命令 `pnpm vitest run <path>`。
- 提交信息遵循仓库现有风格（参考 `git log --oneline`，如 `feat(volc-main): ...`）。

---

### Task 1: 测试基建 + `00-config.js` + `10-shared.js`

**Files:**
- Create: `src/ali-main/00-config.js`
- Create: `src/ali-main/10-shared.js`
- Test: `tests/unit/ali-main/_harness.ts`
- Test: `tests/unit/ali-main/shared.test.ts`

**Interfaces:**
- Consumes: 无（基础层）
- Produces: `ALI_VERSION`、`ALI_CONFIG`（轮询/火力参数）、`ali_postCmd(type, data)`、`ali_getCookies()`、`ali_getCna()`、`aliClock`、`ali_syncClock()`、`ali_serverNow()`、`ali_linkage(commodityCode)`、`ali_playBeeps(n)`

- [ ] **Step 1: 写 vm harness 与失败测试**

`tests/unit/ali-main/_harness.ts`:

```ts
/**
 * ali-main test harness — thin wrapper over the shared vm sandbox factory
 * (tests/unit/_vm-harness.ts).
 *
 * Usage:
 *   const scope = loadAliMainModules(['00-config', '10-shared']);
 */

import { resolve } from 'path';
import { createVmHarness, type VmScope } from '../_vm-harness';

export type AliMainScope = VmScope;

export const loadAliMainModules = createVmHarness<AliMainScope>({
  srcDir: resolve(__dirname, '../../../src/ali-main'),
  globals: {
    // Real timers: fire/stock loops use real delays in tests.
    setTimeout: (fn: Function, ms?: number) => setTimeout(fn, ms),
    clearTimeout: (id: unknown) => clearTimeout(id as number),
    Math,
    Date,
  },
});
```

`tests/unit/ali-main/shared.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadAliMainModules } from './_harness';

describe('ali-main 10-shared', () => {
  it('ali_linkage 与页面 bundle 算法一致（charCode hex 拼接）', () => {
    const s = loadAliMainModules(['00-config', '10-shared']);
    const expected = JSON.stringify({ itemId: ['sfm_codingplan_public_cn'] })
      .split('')
      .map((c) => c.charCodeAt(0).toString(16))
      .join('');
    expect(s.ali_linkage('sfm_codingplan_public_cn')).toBe(expected);
    expect((s.ali_linkage('sfm_codingplan_public_cn') as string).startsWith('7b22')).toBe(true);
  });

  it('ali_getCna 从 cookie 串中解析 cna', () => {
    const s = loadAliMainModules(['00-config', '10-shared'], {
      document: { cookie: 'foo=1; cna=abcDEF123; bar=2' },
    });
    expect(s.ali_getCna()).toBe('abcDEF123');
  });

  it('ali_serverNow 应用服务器时钟偏移', () => {
    const s = loadAliMainModules(['00-config', '10-shared']);
    (s.aliClock as any).offsetMs = 5000;
    const now = Date.now();
    const serverNow = s.ali_serverNow() as number;
    expect(serverNow).toBeGreaterThanOrEqual(now + 4999);
    expect(serverNow).toBeLessThanOrEqual(now + 5100);
  });

  it('ali_postCmd 发送 __ali_cmd 信封', () => {
    const posted: any[] = [];
    const s = loadAliMainModules(['00-config', '10-shared'], {
      window: { postMessage: (m: any) => posted.push(m), addEventListener: () => {}, removeEventListener: () => {} },
    });
    s.ali_postCmd('ALI_PURCHASE_SUCCESS', { orderId: 'o1', plan: '阿里百炼 Coding Plan' });
    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ __ali_cmd: true, type: 'ALI_PURCHASE_SUCCESS', orderId: 'o1' });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/unit/ali-main/shared.test.ts`
Expected: FAIL（`src/ali-main/00-config.js` 不存在，readFileSync 抛错）

- [ ] **Step 3: 实现 `src/ali-main/00-config.js`**

```js
// Platform constants for the Aliyun Bailian Coding Plan MAIN-world overlay.
// The page itself calls buy-api.aliyun.com with plain fetch + credentials:'include',
// so this overlay does the same from the MAIN world (probed 2026-07-17).
var ALI_VERSION =
  (typeof document !== 'undefined' &&
    document.currentScript &&
    document.currentScript.dataset &&
    document.currentScript.dataset.version) ||
  '1.4.2';

var ALI_CONFIG = {
  platform: 'bailian-codingplan',
  title: '阿里百炼 Coding Plan',
  apiBase: 'https://buy-api.aliyun.com',
  commodityCode: 'sfm_codingplan_public_cn',
  skuId: 'pro',
  consoleUrl: 'https://bailian.console.aliyun.com/?tab=coding-plan#/efm/coding-plan-detail',
  idlePollMs: 2000,
  armedPollMs: 500,
  armedLeadMs: 60000,
  fireIntervalMs: 300,
  fireBackoffMs: 1500,
  maxFireAttempts: 100,
  tokenReadyRetries: 10,
  tokenReadyDelayMs: 500,
};
```

- [ ] **Step 4: 实现 `src/ali-main/10-shared.js`**

```js
// Mechanical helpers shared by the Bailian MAIN-world overlay.

function ali_postCmd(type, data) {
  var envelope = { __ali_cmd: true, type: type };
  if (data && typeof data === 'object') {
    for (var key in data) {
      if (Object.prototype.hasOwnProperty.call(data, key)) envelope[key] = data[key];
    }
  }
  window.postMessage(envelope, '*');
}

function ali_getCookies() {
  return document.cookie.split(';').reduce(function (acc, c) {
    var parts = c.trim().split('=');
    acc[parts[0]] = parts.slice(1).join('=');
    return acc;
  }, {});
}

function ali_getCna() {
  return ali_getCookies()['cna'] || '';
}

// Server-clock sync. buy-api responses do not expose a Date header through
// CORS, so the anchor comes from the same-origin page document instead.
var aliClock = { offsetMs: 0, synced: false };

async function ali_syncClock() {
  try {
    var t0 = Date.now();
    var res = await fetch(location.origin + '/coding-plan', {
      method: 'HEAD',
      credentials: 'omit',
      cache: 'no-store',
    });
    var t1 = Date.now();
    var dateHdr = res.headers.get('date');
    if (!dateHdr) return false;
    var serverMs = new Date(dateHdr).getTime();
    if (!isFinite(serverMs)) return false;
    aliClock.offsetMs = serverMs - Math.round((t0 + t1) / 2);
    aliClock.synced = true;
    return true;
  } catch (e) {
    return false;
  }
}

function ali_serverNow() {
  return Date.now() + aliClock.offsetMs;
}

// Page-bundle compatible linkage: charCode-hex of
// JSON.stringify({itemId:[commodityCode]}) (the site's own ue/de/le chain).
function ali_linkage(commodityCode) {
  var s = JSON.stringify({ itemId: [commodityCode] });
  var out = '';
  for (var i = 0; i < s.length; i++) out += s.charCodeAt(i).toString(16);
  return out;
}

function ali_playBeeps(count) {
  for (var i = 0; i < count; i++) setTimeout(ali_playBeep, i * 350);
}

function ali_playBeep() {
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

Run: `pnpm vitest run tests/unit/ali-main/shared.test.ts`
Expected: PASS（4 个用例）

Run: `pnpm build:overlay`
Expected: 输出包含 `Built .../public/ali-main.js from 2 modules`

- [ ] **Step 6: Commit**

```bash
git add src/ali-main tests/unit/ali-main public/ali-main.js
git commit -m "feat(ali-main): add config + shared helpers (clock sync, linkage, postCmd)"
```

---

### Task 2: `20-api.js` 协议层

**Files:**
- Create: `src/ali-main/20-api.js`
- Test: `tests/unit/ali-main/api.test.ts`

**Interfaces:**
- Consumes: `ALI_CONFIG`、`ali_getCna()`、`ali_linkage()`（Task 1）
- Produces: `ali_readTokens()`、`ali_waitTokens(retries, delayMs)`、`ali_getCsrfToken()`、`ali_buildSecurityParam()`、`ali_buildConfiguration(autoRenew, tokens)`、`ali_parseInventory(json)`、`ali_checkInventory(autoRenew, tokens)`、`ali_buildOrderBody(autoRenew, submitref, tokens)`、`ali_classifyOrderResult(status, json)`、`ali_createOrder(autoRenew, submitref, tokens)`

- [ ] **Step 1: 写失败测试**

`tests/unit/ali-main/api.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadAliMainModules } from './_harness';

// 2026-07-17 真实抓包（脱敏）——售罄态
const SOLD_OUT_RESP = {
  code: '200',
  data: [
    {
      buyAmount: 1,
      commodityCode: 'sfm_codingplan_public_cn',
      inventoryNum: 0,
      restockingTimeStamp: 1784338200000,
      success: false,
      uniqLabel: '9a7c3384-0000-4000-8000-000000000000',
    },
  ],
  requestId: 'req-1',
  success: true,
};

const IN_STOCK_RESP = {
  code: '200',
  data: [
    {
      buyAmount: 1,
      commodityCode: 'sfm_codingplan_public_cn',
      inventoryNum: 5,
      restockingTimeStamp: 1784338200000,
      success: true,
      uniqLabel: '9a7c3384-0000-4000-8000-000000000001',
    },
  ],
  requestId: 'req-2',
  success: true,
};

const TOKENS = { umidToken: 'um-x', collina: 'col-y' };

function load() {
  return loadAliMainModules(['00-config', '10-shared', '20-api'], {
    document: { cookie: 'cna=cna-z' },
    location: { href: 'https://common-buy.aliyun.com/coding-plan', origin: 'https://common-buy.aliyun.com' },
    navigator: { userAgent: 'UA-TEST' },
  });
}

describe('ali_parseInventory', () => {
  it('售罄：inventoryNum=0 → inStock=false 且提取 restockTs', () => {
    const s = load();
    expect(s.ali_parseInventory(SOLD_OUT_RESP)).toEqual({
      inStock: false,
      restockTs: 1784338200000,
      buyAmount: 1,
    });
  });

  it('有货：inventoryNum>0 且 success → inStock=true，restockTs=null', () => {
    const s = load();
    expect(s.ali_parseInventory(IN_STOCK_RESP)).toEqual({
      inStock: true,
      restockTs: null,
      buyAmount: 1,
    });
  });

  it('data 为空数组或非数组 → 保守判无货且无 restock', () => {
    const s = load();
    expect(s.ali_parseInventory({ code: '200', data: [] })).toEqual({
      inStock: false,
      restockTs: null,
      buyAmount: null,
    });
    expect(s.ali_parseInventory(null)).toEqual({
      inStock: false,
      restockTs: null,
      buyAmount: null,
    });
  });
});

describe('ali_buildOrderBody', () => {
  it('body 形状与页面 pe() 一致：嵌套 configuration + 风控字段', () => {
    const s = load();
    const body = s.ali_buildOrderBody(false, 'subref-1', TOKENS) as any;
    expect(body.configuration.orderIndex).toBe(0);
    expect(body.configuration.commodityCode).toBe('sfm_codingplan_public_cn');
    expect(body.configuration.autoRenew).toBe(false);
    expect(body.configuration.orderParams.umidToken).toBe('um-x');
    expect(body.configuration.orderParams.cna).toBe('cna-z');
    expect(body.configuration.components[0].instanceProperty[0].value).toBe('pro');
    expect(body.couponNum).toBe('default');
    expect(body.umidToken).toBe('um-x');
    expect(body.collina).toBe('col-y');
    expect(body['bx-umidtoken']).toBe('um-x');
    expect(body.channel).toBe('commonbuy');
    expect(body.submitref).toBe('subref-1');
    expect(typeof body.linkage).toBe('string');
    expect(body.linkage.length).toBeGreaterThan(0);
  });

  it('autoRenew=true 时 configuration.autoRenew 透传', () => {
    const s = load();
    const body = s.ali_buildOrderBody(true, 'subref-1', TOKENS) as any;
    expect(body.configuration.autoRenew).toBe(true);
  });
});

describe('ali_classifyOrderResult', () => {
  const s = load();

  it('成功：code 200 + data.orderId', () => {
    expect(
      s.ali_classifyOrderResult(200, { code: '200', data: { orderId: 'ord-9' }, success: true }),
    ).toMatchObject({ kind: 'success', orderId: 'ord-9' });
  });

  it('售罄：OutOfStock / B6000000571 / 售罄文案', () => {
    expect(s.ali_classifyOrderResult(200, { code: 'OutOfStock', message: '今日已售罄，明日9:30补货', success: false })).toMatchObject({ kind: 'out_of_stock' });
    expect(s.ali_classifyOrderResult(200, { code: '200', standardErrorCode: 'B6000000571', success: false })).toMatchObject({ kind: 'out_of_stock' });
  });

  it('已有未支付订单 → unpaid_exists（视为抢到）', () => {
    expect(
      s.ali_classifyOrderResult(200, { code: 'ORDER.INST_HAS_UNPAID_ORDER', message: '存在未支付订单' }),
    ).toMatchObject({ kind: 'unpaid_exists' });
  });

  it('429 → rate_limited；401 → auth；500 无 JSON → http_error', () => {
    expect(s.ali_classifyOrderResult(429, null)).toMatchObject({ kind: 'rate_limited' });
    expect(s.ali_classifyOrderResult(401, null)).toMatchObject({ kind: 'auth' });
    expect(s.ali_classifyOrderResult(500, null)).toMatchObject({ kind: 'http_error', status: 500 });
  });

  it('其他业务码 → unknown', () => {
    expect(s.ali_classifyOrderResult(200, { code: 'SOME_BIZ_ERROR', message: 'x' })).toMatchObject({
      kind: 'unknown',
      code: 'SOME_BIZ_ERROR',
    });
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/unit/ali-main/api.test.ts`
Expected: FAIL（`src/ali-main/20-api.js` 不存在）

- [ ] **Step 3: 实现 `src/ali-main/20-api.js`**

```js
// buy-api.aliyun.com protocol layer (probed 2026-07-17, see spec §2).
// Everything runs in the page's MAIN world with credentials:'include'.

function ali_readTokens() {
  var w = window;
  return {
    umidToken: (typeof w.getUmidToken === 'function' && w.getUmidToken()) || '',
    collina: (typeof w.getUA === 'function' && w.getUA()) || '',
  };
}

async function ali_waitTokens(retries, delayMs) {
  for (var i = 0; i < retries; i++) {
    var t = ali_readTokens();
    if (t.umidToken && t.collina) return t;
    await new Promise(function (r) {
      setTimeout(r, delayMs);
    });
  }
  return ali_readTokens();
}

async function ali_apiPost(path, body) {
  var res = await fetch(ALI_CONFIG.apiBase + path, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  var json = await res.json().catch(function () {
    return null;
  });
  return { status: res.status, json: json };
}

async function ali_getCsrfToken() {
  try {
    var res = await fetch(ALI_CONFIG.apiBase + '/getCsrfToken.json', { credentials: 'include' });
    if (!res.ok) return '';
    var json = await res.json();
    return (json && String(json.code) === '200' && json.data) || '';
  } catch (e) {
    return '';
  }
}

async function ali_buildSecurityParam() {
  try {
    var r = await ali_apiPost('/order/buildSecurityParam.json', {
      commodityCode: ALI_CONFIG.commodityCode,
      skuId: ALI_CONFIG.skuId,
    });
    return (r.json && r.json.data && r.json.data.submitref) || '';
  } catch (e) {
    return '';
  }
}

// Matches the page's configuration payload captured on 2026-07-17.
function ali_buildConfiguration(autoRenew, tokens) {
  return {
    commodityCode: ALI_CONFIG.commodityCode,
    specCode: ALI_CONFIG.commodityCode,
    commodityName: '百炼 Coding Plan 国际站',
    chargeType: 'PREPAY',
    chargeTypeTitle: '预付费',
    autoRenew: !!autoRenew,
    orderType: 'BUY',
    quantity: 1,
    orderParams: {
      fromPage: location.href,
      paidCallBack: ALI_CONFIG.consoleUrl,
      order_created_by: 'lx_commonBuy',
      pricing_trigger_type: 'default',
      init_price_query: 'init',
      has_triggered_error: false,
      umidToken: tokens.umidToken,
      userAgent: navigator.userAgent,
      cna: ali_getCna(),
      needUnavailableCoupon: '1',
      queryGetCouponActivity: false,
    },
    pricingCycle: 'Month',
    duration: '1',
    pricingCycleTitle: '个月',
    config: {
      order_time: { min: 1, max: 12, step: 1, unit: 'Month' },
      supportAutoRenew: true,
      canChannelAutoRenew: true,
      orderType: 'BUY',
      showTilePrice: false,
      order_num: null,
      regionCode: null,
    },
    components: [
      {
        componentCode: 'subscription_type',
        componentName: '订阅套餐',
        instanceProperty: [{ code: 'subscription_type', name: 'Pro', value: ALI_CONFIG.skuId }],
      },
    ],
    isMainDataMode: '',
    couponForSpecItem: true,
    couponNum: 'default',
  };
}

// PURE: inventory response -> { inStock, restockTs, buyAmount }
function ali_parseInventory(json) {
  var list = json && json.data;
  if (!Array.isArray(list) || list.length === 0) {
    return { inStock: false, restockTs: null, buyAmount: null };
  }
  var item = list[0] || {};
  var inStock =
    item.success === true && typeof item.inventoryNum === 'number' && item.inventoryNum > 0;
  var restockTs =
    !inStock && typeof item.restockingTimeStamp === 'number' && item.restockingTimeStamp > 0
      ? item.restockingTimeStamp
      : null;
  return {
    inStock: inStock,
    restockTs: restockTs,
    buyAmount: typeof item.buyAmount === 'number' ? item.buyAmount : null,
  };
}

async function ali_checkInventory(autoRenew, tokens) {
  var r = await ali_apiPost('/commodity/checkInventoryDetail.json', {
    configuration: ali_buildConfiguration(autoRenew, tokens),
    withCreateOrderValidation: true,
    channel: 'commonbuy',
    withAgreement: true,
  });
  return ali_parseInventory(r.json);
}

// PURE: createOrder body, matching the page bundle's pe() shape.
function ali_buildOrderBody(autoRenew, submitref, tokens) {
  var configuration = ali_buildConfiguration(autoRenew, tokens);
  configuration.orderIndex = 0;
  return {
    configuration: configuration,
    couponNum: 'default',
    umidToken: tokens.umidToken,
    collina: tokens.collina,
    channel: 'commonbuy',
    'bx-umidtoken': tokens.umidToken,
    submitref: submitref || '',
    linkage: ali_linkage(ALI_CONFIG.commodityCode),
  };
}

// PURE: classify createOrder outcome.
function ali_classifyOrderResult(httpStatus, json) {
  var code = json && json.code != null ? String(json.code) : '';
  var data = (json && json.data) || {};
  var msg = (json && (json.message || data.message)) || '';
  if (code === '200' && data.orderId) {
    return { kind: 'success', orderId: String(data.orderId), raw: json };
  }
  if (
    code === 'OutOfStock' ||
    code === 'B6000000571' ||
    (json && json.standardErrorCode === 'B6000000571') ||
    msg.indexOf('售罄') >= 0 ||
    msg.indexOf('库存不足') >= 0
  ) {
    return { kind: 'out_of_stock', message: msg, raw: json };
  }
  if (code === 'ORDER.INST_HAS_UNPAID_ORDER' || msg.indexOf('未支付') >= 0) {
    return { kind: 'unpaid_exists', message: msg, raw: json };
  }
  if (httpStatus === 429) return { kind: 'rate_limited', status: httpStatus, raw: json };
  if (httpStatus === 401 || httpStatus === 403 || code === 'LOGIN_REQUIRED' || msg.indexOf('登录') >= 0) {
    return { kind: 'auth', status: httpStatus, message: msg, raw: json };
  }
  if (!json || httpStatus >= 400) return { kind: 'http_error', status: httpStatus, raw: json };
  return { kind: 'unknown', code: code, message: msg, raw: json };
}

async function ali_createOrder(autoRenew, submitref, tokens) {
  var csrf = await ali_getCsrfToken();
  var headers = { 'Content-Type': 'application/json' };
  if (csrf) headers['X-XSRF-TOKEN'] = csrf;
  var res;
  var json = null;
  try {
    res = await fetch(ALI_CONFIG.apiBase + '/order/createOrder.json', {
      method: 'POST',
      credentials: 'include',
      headers: headers,
      body: JSON.stringify(ali_buildOrderBody(autoRenew, submitref, tokens)),
    });
    json = await res.json().catch(function () {
      return null;
    });
  } catch (e) {
    return { kind: 'network', message: String((e && e.message) || e) };
  }
  return ali_classifyOrderResult(res.status, json);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run tests/unit/ali-main`
Expected: PASS（shared 4 + api 11 用例）

- [ ] **Step 5: Commit**

```bash
pnpm build:overlay
git add src/ali-main/20-api.js tests/unit/ali-main/api.test.ts public/ali-main.js
git commit -m "feat(ali-main): add buy-api protocol layer (inventory/order/csrf)"
```

---

### Task 3: `30-stock.js` 库存轮询 + 状态机

**Files:**
- Create: `src/ali-main/30-stock.js`
- Test: `tests/unit/ali-main/stock.test.ts`

**Interfaces:**
- Consumes: `ALI_CONFIG`、`ali_serverNow()`（Task 1）、`ali_checkInventory()`（Task 2）、`ali_startFire()`（Task 4，运行期调用）
- Produces: `aliState`（phase/autoFire/autoRenew/restockTs/attempts/tokens）、`aliLogs`、`ali_log(line)`、`ali_setPhase(phase)`、`ali_nextPhase(phase, inv, serverNow, leadMs)`、`ali_pollTick()`、`ali_schedulePoll(ms)`、`ali_armFireTimer()`、`ali_stopFire()`

- [ ] **Step 1: 写失败测试**

`tests/unit/ali-main/stock.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadAliMainModules } from './_harness';

function load() {
  return loadAliMainModules(['00-config', '10-shared', '30-stock']);
}

describe('ali_nextPhase', () => {
  it('终态保持不变（FIRING/SUCCESS/FAIL）', () => {
    const s = load();
    for (const p of ['FIRING', 'SUCCESS', 'FAIL']) {
      expect(s.ali_nextPhase(p, { inStock: true, restockTs: null }, 0, 60000)).toBe(p);
    }
  });

  it('有货 → IN_STOCK', () => {
    const s = load();
    expect(s.ali_nextPhase('SOLD_OUT', { inStock: true, restockTs: null }, 0, 60000)).toBe('IN_STOCK');
    expect(s.ali_nextPhase('ARMED', { inStock: true, restockTs: null }, 0, 60000)).toBe('IN_STOCK');
  });

  it('restock 进入提前量窗口 → ARMED，窗口外 → SOLD_OUT', () => {
    const s = load();
    const now = 1000000;
    const ts = now + 30000; // 30s 后，lead=60s
    expect(s.ali_nextPhase('SOLD_OUT', { inStock: false, restockTs: ts }, now, 60000)).toBe('ARMED');
    const far = now + 120000; // 120s 后
    expect(s.ali_nextPhase('SOLD_OUT', { inStock: false, restockTs: far }, now, 60000)).toBe('SOLD_OUT');
  });

  it('无 restock 信息 → SOLD_OUT', () => {
    const s = load();
    expect(s.ali_nextPhase('INIT', { inStock: false, restockTs: null }, 0, 60000)).toBe('SOLD_OUT');
  });
});

describe('ali_log / ali_setPhase', () => {
  it('日志累积并截断到 50 条；阶段变化触发 UI hook（若存在）', () => {
    const calls: string[] = [];
    const s = load();
    (s as any).ali_uiSetPhase = (p: string) => calls.push(p);
    s.ali_setPhase('SOLD_OUT');
    s.ali_setPhase('SOLD_OUT'); // 同态不重复触发
    s.ali_setPhase('ARMED');
    expect(calls).toEqual(['SOLD_OUT', 'ARMED']);
    for (let i = 0; i < 60; i++) s.ali_log('line ' + i);
    expect((s.aliLogs as string[]).length).toBe(50);
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/unit/ali-main/stock.test.ts`
Expected: FAIL（`src/ali-main/30-stock.js` 不存在）

- [ ] **Step 3: 实现 `src/ali-main/30-stock.js`**

```js
// Stock polling loop + phase state machine.
// Phases: INIT -> SOLD_OUT -> ARMED -> (FIRING | IN_STOCK) -> SUCCESS | FAIL
var aliState = {
  phase: 'INIT',
  autoFire: true,
  autoRenew: false,
  restockTs: null,
  attempts: 0,
  tokens: { umidToken: '', collina: '' },
  pollTimer: 0,
  fireTimer: 0,
};

var aliLogs = [];

function ali_log(line) {
  aliLogs.push(line);
  if (aliLogs.length > 50) aliLogs.shift();
  if (typeof ali_uiLog === 'function') ali_uiLog(line);
}

function ali_setPhase(phase) {
  if (aliState.phase === phase) return;
  aliState.phase = phase;
  if (typeof ali_uiSetPhase === 'function') ali_uiSetPhase(phase);
}

// PURE: next phase given current phase, inventory, server now and lead window.
function ali_nextPhase(phase, inv, serverNow, leadMs) {
  if (phase === 'FIRING' || phase === 'SUCCESS' || phase === 'FAIL') return phase;
  if (inv.inStock) return 'IN_STOCK';
  if (inv.restockTs && inv.restockTs - serverNow <= leadMs) return 'ARMED';
  return 'SOLD_OUT';
}

function ali_schedulePoll(ms) {
  clearTimeout(aliState.pollTimer);
  aliState.pollTimer = setTimeout(ali_pollTick, ms);
}

async function ali_pollTick() {
  if (aliState.phase === 'FIRING' || aliState.phase === 'SUCCESS' || aliState.phase === 'FAIL') return;
  var inv;
  try {
    inv = await ali_checkInventory(aliState.autoRenew, aliState.tokens);
  } catch (e) {
    ali_log('[STOCK_FAIL] ' + ((e && e.message) || e));
    ali_schedulePoll(ALI_CONFIG.idlePollMs);
    return;
  }
  if (inv.restockTs) aliState.restockTs = inv.restockTs;
  var next = ali_nextPhase(aliState.phase, inv, ali_serverNow(), ALI_CONFIG.armedLeadMs);
  ali_setPhase(next);
  if (next === 'SOLD_OUT') {
    ali_schedulePoll(ALI_CONFIG.idlePollMs);
  } else if (next === 'ARMED') {
    ali_schedulePoll(ALI_CONFIG.armedPollMs);
    ali_armFireTimer();
  } else if (next === 'IN_STOCK') {
    if (aliState.autoFire) ali_startFire('stock');
    else ali_log('检测到库存！（自动开火已关闭，请手动点击「立即开火」）');
  }
}

// Schedule the T-0 fire from the server-anchored restock timestamp.
function ali_armFireTimer() {
  if (aliState.fireTimer || !aliState.restockTs) return;
  var delay = Math.max(0, aliState.restockTs - ali_serverNow());
  aliState.fireTimer = setTimeout(function () {
    aliState.fireTimer = 0;
    if (aliState.autoFire && (aliState.phase === 'ARMED' || aliState.phase === 'SOLD_OUT')) {
      ali_startFire('timer');
    }
  }, delay);
}

function ali_stopFire() {
  if (aliState.phase !== 'FIRING') return;
  aliState.autoFire = false;
  var chk = document.getElementById('__ali_autofire');
  if (chk) chk.checked = false;
  ali_log('已手动停止（第 ' + aliState.attempts + ' 发后），自动开火已关闭');
  ali_setPhase('SOLD_OUT');
  ali_schedulePoll(ALI_CONFIG.idlePollMs);
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run tests/unit/ali-main/stock.test.ts`
Expected: PASS（5 个用例）

- [ ] **Step 5: Commit**

```bash
git add src/ali-main/30-stock.js tests/unit/ali-main/stock.test.ts
pnpm build:overlay && git add public/ali-main.js
git commit -m "feat(ali-main): add stock polling state machine"
```

---

### Task 4: `50-fire.js` 开火引擎

**Files:**
- Create: `src/ali-main/50-fire.js`
- Test: `tests/unit/ali-main/fire.test.ts`

**Interfaces:**
- Consumes: `ALI_CONFIG`、`ali_playBeeps()`、`ali_postCmd()`（Task 1）、`ali_buildSecurityParam()`、`ali_createOrder()`（Task 2）、`aliState`、`ali_log()`、`ali_setPhase()`（Task 3）
- Produces: `ali_sleep(ms)`、`ali_startFire(reason)`、`ali_onFireSuccess(orderId, note)`、`ali_onFireFail(result)`、`ali_failHint(result)`

- [ ] **Step 1: 写失败测试**

利用 vm 沙箱可重赋值全局函数的特性，stub `ali_createOrder` 驱动开火循环：

`tests/unit/ali-main/fire.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadAliMainModules } from './_harness';

function load(posted: any[]) {
  const s = loadAliMainModules(['00-config', '10-shared', '20-api', '30-stock', '50-fire'], {
    window: {
      postMessage: (m: any) => posted.push(m),
      addEventListener: () => {},
      removeEventListener: () => {},
    },
  });
  // 小火力参数，避免测试拖慢
  (s.ALI_CONFIG as any).fireIntervalMs = 1;
  (s.ALI_CONFIG as any).fireBackoffMs = 1;
  (s.ALI_CONFIG as any).maxFireAttempts = 5;
  return s;
}

describe('ali_startFire', () => {
  it('连续售罄后成功：停手、蜂鸣、postCmd 成功消息带 orderId', async () => {
    const posted: any[] = [];
    const s = load(posted);
    let n = 0;
    (s as any).ali_buildSecurityParam = async () => 'subref-x';
    (s as any).ali_createOrder = async () => {
      n++;
      return n < 3 ? { kind: 'out_of_stock' } : { kind: 'success', orderId: 'ord-77' };
    };
    await s.ali_startFire('test');
    expect(n).toBe(3);
    expect(s.aliState.phase).toBe('SUCCESS');
    const msg = posted.find((m) => m.type === 'ALI_PURCHASE_SUCCESS');
    expect(msg).toBeTruthy();
    expect(msg.__ali_cmd).toBe(true);
    expect(msg.orderId).toBe('ord-77');
  });

  it('ORDER.INST_HAS_UNPAID_ORDER → 视为成功且无 orderId', async () => {
    const posted: any[] = [];
    const s = load(posted);
    (s as any).ali_buildSecurityParam = async () => 'subref-x';
    (s as any).ali_createOrder = async () => ({ kind: 'unpaid_exists', message: '存在未支付订单' });
    await s.ali_startFire('test');
    expect(s.aliState.phase).toBe('SUCCESS');
    const msg = posted.find((m) => m.type === 'ALI_PURCHASE_SUCCESS');
    expect(msg.orderId).toBe('');
  });

  it('auth 失败 → FAIL 且立即停手（不重试）', async () => {
    const posted: any[] = [];
    const s = load(posted);
    let n = 0;
    (s as any).ali_buildSecurityParam = async () => 'subref-x';
    (s as any).ali_createOrder = async () => {
      n++;
      return { kind: 'auth', status: 401 };
    };
    await s.ali_startFire('test');
    expect(n).toBe(1);
    expect(s.aliState.phase).toBe('FAIL');
  });

  it('持续售罄 → 达到 maxFireAttempts 后 FAIL(exhausted)', async () => {
    const posted: any[] = [];
    const s = load(posted);
    let n = 0;
    (s as any).ali_buildSecurityParam = async () => 'subref-x';
    (s as any).ali_createOrder = async () => {
      n++;
      return { kind: 'out_of_stock' };
    };
    await s.ali_startFire('test');
    expect(n).toBe(5);
    expect(s.aliState.phase).toBe('FAIL');
  });
});

describe('ali_failHint', () => {
  it('按 kind 给出中文提示', () => {
    const s = load([]);
    expect(s.ali_failHint({ kind: 'auth' })).toContain('登录');
    expect(s.ali_failHint({ kind: 'http_error', status: 403 })).toContain('风控');
    expect(s.ali_failHint({ kind: 'exhausted' })).toContain('最大尝试次数');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/unit/ali-main/fire.test.ts`
Expected: FAIL（`src/ali-main/50-fire.js` 不存在）

- [ ] **Step 3: 实现 `src/ali-main/50-fire.js`**

```js
// Fire engine: createOrder loop with classified error handling.

function ali_sleep(ms) {
  return new Promise(function (r) {
    setTimeout(r, ms);
  });
}

async function ali_startFire(reason) {
  if (aliState.phase === 'FIRING' || aliState.phase === 'SUCCESS') return;
  aliState.attempts = 0;
  ali_setPhase('FIRING');
  clearTimeout(aliState.pollTimer);
  clearTimeout(aliState.fireTimer);
  aliState.fireTimer = 0;
  ali_log('开火（' + reason + '）…');
  var submitref = await ali_buildSecurityParam();
  var backoff = 0;
  while (aliState.phase === 'FIRING' && aliState.attempts < ALI_CONFIG.maxFireAttempts) {
    aliState.attempts++;
    var result = await ali_createOrder(aliState.autoRenew, submitref, aliState.tokens);
    if (result.kind === 'success') {
      ali_onFireSuccess(result.orderId);
      return;
    }
    if (result.kind === 'unpaid_exists') {
      ali_onFireSuccess('', '已存在待支付订单，请直接完成支付');
      return;
    }
    if (result.kind === 'out_of_stock') {
      ali_log('第 ' + aliState.attempts + ' 发：售罄，继续');
      await ali_sleep(ALI_CONFIG.fireIntervalMs);
      continue;
    }
    if (result.kind === 'rate_limited' || result.kind === 'network') {
      backoff = Math.min(backoff + 1, 4);
      ali_log('[FIRE_FAIL] ' + result.kind + '，退避 ×' + backoff);
      await ali_sleep(ALI_CONFIG.fireIntervalMs + backoff * ALI_CONFIG.fireBackoffMs);
      continue;
    }
    // auth / http_error / unknown：可能触发风控，立即停手交人工
    ali_onFireFail(result);
    return;
  }
  if (aliState.phase === 'FIRING') {
    ali_onFireFail({ kind: 'exhausted' });
  }
}

function ali_onFireSuccess(orderId, note) {
  ali_setPhase('SUCCESS');
  ali_playBeeps(3);
  ali_postCmd('ALI_PURCHASE_SUCCESS', {
    orderId: orderId || '',
    productName: ALI_CONFIG.title,
    plan: ALI_CONFIG.title,
    payUrl: ALI_CONFIG.consoleUrl,
  });
  ali_log('✅ 抢购成功' + (orderId ? '，订单 ' + orderId : '') + (note ? '（' + note + '）' : ''));
  if (typeof ali_uiShowResult === 'function') ali_uiShowResult(true, orderId, note || '');
}

function ali_onFireFail(result) {
  ali_setPhase('FAIL');
  ali_playBeeps(1);
  var hint = ali_failHint(result);
  ali_log('[FIRE_FAIL] ' + hint);
  if (typeof ali_uiShowResult === 'function') ali_uiShowResult(false, null, hint);
}

function ali_failHint(result) {
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
      return '未知响应（' + (result.code || 'no-code') + '），已停手；如需继续请手动操作';
    default:
      return '抢购失败：' + ((result && result.message) || (result && result.kind) || 'unknown');
  }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `pnpm vitest run tests/unit/ali-main`
Expected: PASS（shared 4 + api 11 + stock 5 + fire 5 用例）

- [ ] **Step 5: Commit**

```bash
git add src/ali-main/50-fire.js tests/unit/ali-main/fire.test.ts
pnpm build:overlay && git add public/ali-main.js
git commit -m "feat(ali-main): add fire engine with classified error handling"
```

---

### Task 5: `40-ui.js` overlay UI + `60-boot.js` 启动编排

**Files:**
- Create: `src/ali-main/40-ui.js`
- Create: `src/ali-main/60-boot.js`
- Test: `tests/unit/ali-main/ui.test.ts`

**Interfaces:**
- Consumes: `ALI_VERSION`、`ALI_CONFIG`、`ali_postCmd`（Task 1）、`ali_waitTokens`、`ali_readTokens`（Task 2）、`aliState`、`ali_log`、`ali_setPhase`、`ali_pollTick`、`ali_stopFire`（Task 3）、`ali_startFire`（Task 4）、`ali_syncClock`（Task 1）
- Produces: `ali_fmtCountdown(ms)`、`ali_bindDrag(box, handle)`、`ali_buildOverlay()`、`ali_uiSetPhase(phase)`、`ali_uiLog(line)`、`ali_uiShowResult(ok, orderId, message)`、`ali_uiLogin(name)`、`ali_checkLogin()`

- [ ] **Step 1: 写失败测试（仅覆盖纯函数；DOM 行为走手动验证）**

`tests/unit/ali-main/ui.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadAliMainModules } from './_harness';

function load() {
  return loadAliMainModules(['00-config', '10-shared', '30-stock', '40-ui']);
}

describe('ali_fmtCountdown', () => {
  it('格式化 T- 倒计时（含十分位）', () => {
    const s = load();
    expect(s.ali_fmtCountdown(37234567)).toBe('10:20:34.5');
    expect(s.ali_fmtCountdown(0)).toBe('00:00:00.0');
    expect(s.ali_fmtCountdown(-5)).toBe('00:00:00.0');
    expect(s.ali_fmtCountdown(59999)).toBe('00:00:59.9');
  });
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `pnpm vitest run tests/unit/ali-main/ui.test.ts`
Expected: FAIL（`src/ali-main/40-ui.js` 不存在）

- [ ] **Step 3: 实现 `src/ali-main/40-ui.js`**

```js
// Overlay UI: draggable card with countdown, stock lamp, fire controls, log.

function ali_fmtCountdown(ms) {
  if (ms <= 0) return '00:00:00.0';
  var tenths = Math.floor(ms / 100);
  var t = tenths % 10;
  var totalSec = Math.floor(tenths / 10);
  var h = Math.floor(totalSec / 3600);
  var m = Math.floor((totalSec % 3600) / 60);
  var s = totalSec % 60;
  function p2(n) {
    return (n < 10 ? '0' : '') + n;
  }
  return p2(h) + ':' + p2(m) + ':' + p2(s) + '.' + t;
}

function ali_bindDrag(box, handle) {
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

function ali_buildOverlay() {
  if (document.getElementById('__ali_overlay')) return;
  var box = document.createElement('div');
  box.id = '__ali_overlay';
  box.style.cssText =
    'position:fixed;top:72px;right:16px;width:300px;z-index:999999;' +
    'background:#fff;border:1.5px solid #0c1224;border-radius:12px;' +
    'box-shadow:3px 3px 0 0 #0c1224;font:12px/1.5 -apple-system,"PingFang SC",sans-serif;' +
    'color:#0c1224;user-select:none;';
  box.innerHTML =
    '<div id="__ali_hd" style="display:flex;align-items:center;justify-content:space-between;' +
    'padding:8px 10px;border-bottom:1.5px solid #0c1224;cursor:move;font-weight:800;">' +
    '<span>🚀 百炼 Coding Plan 秒杀</span>' +
    '<span style="font:9px monospace;color:#6a7496;">v' + ALI_VERSION + '</span></div>' +
    '<div style="padding:10px;display:flex;flex-direction:column;gap:8px;">' +
    '<div style="display:flex;align-items:center;gap:6px;">' +
    '<span id="__ali_dot" style="width:8px;height:8px;border-radius:50%;background:#9aa3b8;"></span>' +
    '<span id="__ali_phase" style="font-weight:700;">初始化…</span>' +
    '<span id="__ali_login" style="margin-left:auto;font-size:10px;color:#6a7496;"></span></div>' +
    '<div id="__ali_count" style="font:700 22px/1.2 monospace;text-align:center;padding:4px 0;">--:--:--</div>' +
    '<div style="display:flex;gap:10px;font-size:11px;">' +
    '<label><input type="checkbox" id="__ali_autofire" checked> 到点自动开火</label>' +
    '<label><input type="checkbox" id="__ali_autorenew"> 连续包月</label></div>' +
    '<div style="display:flex;gap:6px;">' +
    '<button id="__ali_fire" style="flex:1;padding:7px 0;background:#0c1224;color:#f5f3ee;' +
    'border:1.5px solid #0c1224;border-radius:8px;font-weight:800;cursor:pointer;">▶ 立即开火</button>' +
    '<button id="__ali_stop" style="padding:7px 10px;background:#fafaf7;color:#0c1224;' +
    'border:1.5px solid #0c1224;border-radius:8px;font-weight:800;cursor:pointer;">停止</button></div>' +
    '<div id="__ali_result" style="display:none;padding:8px;border-radius:8px;font-weight:700;"></div>' +
    '<div id="__ali_log" style="max-height:110px;overflow:auto;font:10px/1.5 monospace;' +
    'color:#3a4358;background:#fafaf7;border:1px dashed rgba(12,18,36,.25);border-radius:6px;padding:6px;"></div>' +
    '</div>';
  document.body.appendChild(box);
  ali_bindDrag(box, document.getElementById('__ali_hd'));

  document.getElementById('__ali_autofire').addEventListener('change', function (e) {
    aliState.autoFire = !!e.target.checked;
    ali_log('自动开火 ' + (aliState.autoFire ? '开' : '关'));
  });
  document.getElementById('__ali_autorenew').addEventListener('change', function (e) {
    aliState.autoRenew = !!e.target.checked;
    ali_log(aliState.autoRenew ? '连续包月' : '单月购买');
  });
  document.getElementById('__ali_fire').addEventListener('click', function () {
    ali_startFire('manual');
  });
  document.getElementById('__ali_stop').addEventListener('click', function () {
    ali_stopFire();
  });

  setInterval(function () {
    var el = document.getElementById('__ali_count');
    if (!el) return;
    if (!aliState.restockTs) {
      el.textContent = '读取库存…';
      return;
    }
    var ms = aliState.restockTs - ali_serverNow();
    el.textContent = ms > 0 ? ali_fmtCountdown(ms) : '补货时间到';
  }, 100);
}

var ALI_PHASE_LABELS = {
  INIT: '初始化…',
  SOLD_OUT: '售罄 · 等待补货',
  ARMED: '已锁定补货时刻',
  IN_STOCK: '检测到库存！',
  FIRING: '开火中…',
  SUCCESS: '抢购成功',
  FAIL: '已停手',
};

var ALI_PHASE_COLORS = {
  INIT: '#9aa3b8',
  SOLD_OUT: '#9aa3b8',
  ARMED: '#f59e0b',
  IN_STOCK: '#10b981',
  FIRING: '#ef4444',
  SUCCESS: '#10b981',
  FAIL: '#ef4444',
};

function ali_uiSetPhase(phase) {
  var el = document.getElementById('__ali_phase');
  if (el) el.textContent = ALI_PHASE_LABELS[phase] || phase;
  var dot = document.getElementById('__ali_dot');
  if (dot) dot.style.background = ALI_PHASE_COLORS[phase] || '#9aa3b8';
}

function ali_uiLog(line) {
  var el = document.getElementById('__ali_log');
  if (!el) return;
  var row = document.createElement('div');
  row.textContent = line;
  el.appendChild(row);
  while (el.children.length > 8) el.removeChild(el.firstChild);
  el.scrollTop = el.scrollHeight;
}

function ali_uiShowResult(ok, orderId, message) {
  var el = document.getElementById('__ali_result');
  if (!el) return;
  el.style.display = 'block';
  if (ok) {
    el.style.background = '#d1fae5';
    el.style.color = '#065f46';
    el.innerHTML =
      '✅ ' + (orderId ? '订单 ' + orderId : message || '已抢到') +
      ' · <a href="' + ALI_CONFIG.consoleUrl + '" target="_blank" style="color:#065f46;">去控制台支付 →</a>';
  } else {
    el.style.background = '#fee2e2';
    el.style.color = '#991b1b';
    el.textContent = '⛔ ' + (message || '抢购失败');
  }
}

function ali_uiLogin(name) {
  var el = document.getElementById('__ali_login');
  if (!el) return;
  if (name) {
    el.textContent = '已登录 ' + name;
    el.style.color = '#10b981';
  } else {
    el.textContent = '未登录！';
    el.style.color = '#ef4444';
  }
}

async function ali_checkLogin() {
  try {
    var res = await fetch('https://bridge.aliyun.com/abs/home/queryUserBaseInfo', {
      credentials: 'include',
    });
    var json = await res.json().catch(function () {
      return null;
    });
    var name = json && json.success && json.data && json.data.userNick;
    ali_uiLogin(name || null);
  } catch (e) {
    ali_uiLogin(null);
  }
}
```

- [ ] **Step 4: 实现 `src/ali-main/60-boot.js`**

```js
// Startup orchestration — concatenated last, runs after all modules load.
(async function ali_boot() {
  try {
    ali_buildOverlay();
    ali_log('百炼秒杀 overlay v' + ALI_VERSION + ' 已注入');
    aliState.tokens = await ali_waitTokens(ALI_CONFIG.tokenReadyRetries, ALI_CONFIG.tokenReadyDelayMs);
    if (!aliState.tokens.umidToken) {
      ali_log('[BOOT] 风控令牌未就绪（getUmidToken 缺失），开火可能失败；请刷新页面');
    }
    await ali_syncClock();
    ali_checkLogin();
    ali_pollTick();
  } catch (e) {
    try {
      ali_log('[BOOT_FAIL] ' + ((e && e.message) || e));
    } catch (ignored) {}
  }
})();
```

- [ ] **Step 5: 跑测试确认通过 + overlay 构建冒烟**

Run: `pnpm vitest run tests/unit/ali-main`
Expected: PASS（全部 26 用例）

Run: `pnpm build:overlay`
Expected: `Built .../public/ali-main.js from 7 modules`

- [ ] **Step 6: Commit**

```bash
git add src/ali-main tests/unit/ali-main public/ali-main.js
git commit -m "feat(ali-main): add overlay UI and boot orchestration"
```

---

### Task 6: 接入层（content script + manifest + 注册表 + popup + background）

**Files:**
- Create: `entrypoints/ali-capture.content.ts`
- Modify: `wxt.config.ts`（description、host_permissions、web_accessible_resources）
- Modify: `lib/platform/index.ts`（PLATFORMS +1 条）
- Modify: `entrypoints/popup/components/PlatformEntryGrid.svelte`（删"敬请期待"静态卡）
- Modify: `entrypoints/background.ts`（`ALI_PURCHASE_SUCCESS` 分支，插在 `VOLC_PURCHASE_SUCCESS` 分支之后）

**Interfaces:**
- Consumes: `public/ali-main.js`（Task 1-5 产物）、`window.__ali_cmd` 信封的 `ALI_PURCHASE_SUCCESS` 消息（Task 4 的 `ali_postCmd`）
- Produces: manifest 中 `ali-main.js` 的 WAR 注册 + `*.aliyun.com` host 权限；popup 中百炼 hero 卡（数据源 `PLATFORMS`）；background 的 `ALI_PURCHASE_SUCCESS` badge 处理

- [ ] **Step 1: 新建 `entrypoints/ali-capture.content.ts`**

```ts
// ISOLATED world content script for common-buy.aliyun.com/coding-plan
// Injects the Bailian MAIN-world overlay and forwards purchase success
// notifications to the background worker.
export default defineContentScript({
  matches: ['*://common-buy.aliyun.com/coding-plan*'],
  runAt: 'document_idle',

  main() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('/ali-main.js');
    script.dataset.version = chrome.runtime.getManifest().version;
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);

    window.addEventListener('message', (event) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data?.__ali_cmd) return;

      if (data.type === 'ALI_PURCHASE_SUCCESS') {
        try {
          chrome.runtime.sendMessage({
            type: 'ALI_PURCHASE_SUCCESS',
            orderId: data.orderId,
            productName: data.productName,
            plan: data.plan,
            payUrl: data.payUrl,
          });
        } catch (e: any) {
          console.log('[ali-capture] purchase success forward failed', e?.message || String(e));
        }
      }
    });
  },
});
```

- [ ] **Step 2: 修改 `wxt.config.ts`**

三处改动（其余不动）：

`description` 改为：

```ts
    description: '多平台 Coding Plan 秒杀助手浏览器扩展（智谱 / 火山引擎 / 阿里百炼）',
```

`host_permissions` 改为：

```ts
    host_permissions: ['*://*.bigmodel.cn/*', '*://*.volcengine.com/*', '*://*.aliyun.com/*'],
```

`web_accessible_resources` 数组末尾追加一项：

```ts
      {
        resources: ['ali-main.js'],
        matches: ['*://*.aliyun.com/*'],
      },
```

- [ ] **Step 3: 修改 `lib/platform/index.ts`**

在 `PLATFORMS` 数组末尾（volcengine-codingplan 条目之后）追加：

```ts
  {
    id: 'bailian-codingplan',
    displayName: '阿里百炼 Coding Plan',
    hostPatterns: ['*://*.aliyun.com/*'],
    entryUrl: 'https://common-buy.aliyun.com/coding-plan',
  },
```

注意：`hostPatterns` 用 `*://*.aliyun.com/*` 而非 `*://common-buy.aliyun.com/*`——popup 的 `groupEntries()` 按 `*://*.` 前缀剥域名做卡片分组与展示，带 `*.` 才能正确显示为 `*.aliyun.com` 并保证单条目渲染成 hero 卡。

- [ ] **Step 4: 修改 `entrypoints/popup/components/PlatformEntryGrid.svelte`**

三处删除（百炼卡片现在由 `PLATFORMS` 驱动自动渲染，静态占位卡退役）：

1. 删除 `upcoming` 常量及其注释（`<script>` 内，约 55-64 行）：

```ts
  /**
   * Static "Coming Soon" entry for 阿里百炼 — surfaced even though the
   * platform is not integrated yet. Keeps the layout stable while the
   * platform integration ships.
   */
  const upcoming = {
    name: '阿里百炼 Coding Plan',
    hostHint: 'bailian.com.cn',
    note: ENTRY_NOTES['bailian-codingplan'],
  };
```

2. 删除模板末尾的 Coming-soon 卡片 markup（约 115-124 行）：

```svelte
  <!-- Coming-soon 卡片（整张平台尚未接入） -->
  <div class="card locked" role="group" aria-label="阿里百炼 Coding Plan 敬请期待">
    <span class="rocket muted" aria-hidden="true">🚀</span>
    <div class="meta">
      <h2 class="name">{upcoming.name}</h2>
      <p class="host">*.{upcoming.hostHint} · 敬请期待</p>
      <p class="sub-note">{upcoming.note}</p>
    </div>
    <button class="cta disabled" disabled>通知我</button>
  </div>
```

3. 删除只为 locked 卡服务的 CSS（`.rocket.muted`、`.card.locked` 两条规则、`.cta.disabled, .cta:disabled` 整条规则）：

```css
  .rocket.muted {
    opacity: 0.55;
    border-style: dashed;
  }
```

```css
  /* ── Locked（Coming soon 紧凑卡） ── */
  .card.locked {
    flex: 0 0 auto;
    flex-direction: row;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: #fafaf7;
    border-style: dashed;
    box-shadow: none;
  }
  .card.locked .name { font-size: 12px; color: #6a7496; }
```

```css
  .cta.disabled,
  .cta:disabled {
    background: #fafaf7;
    color: #6a7496;
    border-style: dashed;
    cursor: not-allowed;
  }
```

`ENTRY_NOTES['bailian-codingplan']`（'UTC+8 09:30 开售 · 200 元起 · 略贵'）保留——hero 卡当前不展示 note，但保留键不碍事也不误导。

- [ ] **Step 5: 修改 `entrypoints/background.ts`**

在 `if (msg.type === 'VOLC_PURCHASE_SUCCESS') { ... }` 分支之后、`SALE_TIME_UPDATED` 分支之前插入：

```ts
    if (msg.type === 'ALI_PURCHASE_SUCCESS') {
      (async () => {
        const { orderId, productName, plan } = msg;
        await chrome.action.setBadgeText({ text: 'OK' });
        await chrome.action.setBadgeBackgroundColor({ color: '#10b981' });
        await chrome.action.setTitle({
          title:
            (plan || '阿里百炼') +
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

（`OK_BADGE_TTL_MS` 复用文件顶部已有常量，与 volc 分支同一个 alarm key，后者会覆盖前者——可接受，均为 30 分钟 transient 成功指示。）

- [ ] **Step 6: 全量回归**

Run: `pnpm test`
Expected: 全部测试 PASS（含既有 bm/volc/组件测试 + 新增 ali-main 26 用例）

Run: `pnpm build`
Expected: `build:overlay` 产出 3 个 overlay；`wxt build` 成功；`verify-no-minifier-collision` 通过；`output/chrome-mv3/` 生成

- [ ] **Step 7: 浏览器手动验证（真实页面，只读验证 + 不开火）**

1. `chrome://extensions` 重新加载 `output/chrome-mv3/`
2. 打开 `https://common-buy.aliyun.com/coding-plan`（已登录态）
3. 确认：右上角出现 overlay 卡片；显示版本号、登录昵称、售罄状态灯、"补货倒计时"（数值与页面"07月18日 09:30 补货"一致，约等于 `restockingTimeStamp - now`）；日志区有"已注入"行
4. 确认 DevTools Network 中 overlay 发出的 `checkInventoryDetail.json` 返回 200 且 `inventoryNum: 0`（与页面一致）
5. **不要**点击「立即开火」（售罄期 createOrder 无意义且增加风控曝光）；开售窗口的端到端验证单独安排
6. 打开 popup：百炼卡片已变为可点击 hero 卡（"▶ 一键开始秒杀"），点击新开购买页

- [ ] **Step 8: Commit**

```bash
git add entrypoints/ali-capture.content.ts wxt.config.ts lib/platform/index.ts \
  entrypoints/popup/components/PlatformEntryGrid.svelte entrypoints/background.ts \
  public/ali-main.js
git commit -m "feat(bailian): wire ali-capture content script, manifest, registry, popup card, success badge"
```

（`output/` 按仓库约定不入库，无需添加。）

---

### Task 7: 文档更新

**Files:**
- Modify: `docs/architecture.md`

**Interfaces:**
- Consumes: Task 1-6 的全部落地事实
- Produces: 架构文档反映三平台现状

- [ ] **Step 1: 更新 `docs/architecture.md`**

按需做以下最小修订（保持文档既有风格，只改事实性内容）：

1. 版本行下方的产品目标段：在智谱秒杀目标后补一句——"扩展同时支持火山引擎（volc-main）与阿里百炼（ali-main）两个平台的 Coding Plan 抢购；本文为智谱主链路架构，其他平台为同构 overlay 变体"。
2. §3 Entrypoints 小节的目录结构（§9）：在 `entrypoints/` 下补 `ali-capture.content.ts  # 阿里百炼 content script (ISOLATED)`；`src/` 下补 `ali-main/  # 阿里百炼 MAIN world 覆盖层源码`；`public/` 下补 `ali-main.js  # 生成物（scripts/build-overlay.js）`。
3. §8 MAIN World 注入脚本：补一段——"`ali-main.js`（阿里百炼）：轮询 `buy-api.aliyun.com/commodity/checkInventoryDetail.json` 获取库存与 `restockingTimeStamp`，补货时刻自动 `POST /order/createOrder.json`（带 `X-XSRF-TOKEN`、`umidToken/collina/submitref/linkage` 风控字段），成功或出现未支付订单即停手并引导用户手动支付。协议细节见 `docs/superpowers/specs/2026-07-17-bailian-codingplan-seckill-design.md`。"

- [ ] **Step 2: Commit**

```bash
git add docs/architecture.md
git commit -m "docs: document bailian (ali-main) platform in architecture"
```

---

## 验收清单（Definition of Done）

- [ ] `pnpm test` 全绿（新增 26 个 ali-main 用例 + 既有无回归）
- [ ] `pnpm build` 全链路通过（overlay 构建 + wxt build + minifier 防撞守卫）
- [ ] 真实页面手动验证：overlay 注入、登录态、库存灯、restock 倒计时与页面文案一致
- [ ] popup 百炼卡变为可点击 hero 卡并正确跳转购买页
- [ ] （顺延到下个 09:30 窗口）端到端：到点自动开火 → 成功/未支付订单 → badge OK + 控制台支付引导；若触发滑块/风控，overlay 按设计停手并提示手动
