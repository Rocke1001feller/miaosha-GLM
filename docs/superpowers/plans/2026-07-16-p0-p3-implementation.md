# P0 开火策略重写 + P3 支付链直连实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 bigmodel.cn 抢购插件的开火策略替换为低预算、翻转触发、时钟校准的精准模式，并在 ALI 支付时绕过 PayComponent 弹窗直接跳转收银台。

**Architecture:** 纯函数状态机 `smart-fire-plan` 驱动 ISOLATED world 的射击节奏；MAIN world 的 `06-stock-watch.js` 负责 batch-preview 轮询、时钟偏移估算和客户号预取；`10-native-pay-trigger.js` 改为支付分发器，ALI 成功时直接 create-sign 并新标签打开收银台，失败回退原生弹窗。

**Tech Stack:** TypeScript, WXT (Chrome MV3), vanilla JS 页面脚本拼接，Vitest。

## Global Constraints

- 不新增第三方依赖。
- preview 全局预算默认 8，最小间隔 2100ms。
- 所有 /api/biz/pay/* 的关键请求在 MAIN world 用 `window.fetch` 发送，保持与页面同源指纹。
- WE_CHAT 保持原生弹窗二维码链路。
- 任何 create-sign 失败必须回退到原生弹窗，不能中断支付。
- 修改后必须通过 `pnpm test`、`node scripts/build-overlay.js`、`pnpm build`。

---

## Task 1: 公共认证头工具

**Files:**
- Modify: `src/bm-main/01-utils.js`

**Interfaces:**
- Produces: `function getLocalAuthHeaders(): { authorization: string; bigmodelOrganization: string; bigmodelProject: string } | null`

- [ ] **Step 1: 实现 `getLocalAuthHeaders()`**
  从 `document.cookie` 解析 `bigmodel_token_production`，从 `localStorage` 读取 `Bigmodel-Organization` 和 `Bigmodel-Project`，返回带 `Bearer ` 前缀的认证头对象。缺失任一返回 `null`。

- [ ] **Step 2: 构建验证**
  Run: `node scripts/build-overlay.js`
  Expected: 成功生成 `public/bm-main.js`，无语法错误。

---

## Task 2: P0 核心状态机 + 单测

**Files:**
- Create: `lib/api/smart-fire-plan.ts`
- Create: `tests/unit/lib/api/smart-fire-plan.test.ts`

**Interfaces:**
- Produces:
  - `interface SmartFireState`
  - `type FireEvent`
  - `interface FireDecision`
  - `function nextDecision(state: SmartFireState, event: FireEvent): FireDecision`

- [ ] **Step 1: 写失败单测**
  在 `tests/unit/lib/api/smart-fire-plan.test.ts` 中先 import 不存在的 `nextDecision`，运行 `pnpm test` 确认失败。

- [ ] **Step 2: 实现状态机**
  在 `lib/api/smart-fire-plan.ts` 中实现：
  - 停止条件：budget <= 0、waf405、captchaInvalid、ticket TTL 耗尽、success。
  - 首发：自动模式在 `nextSaleTime - serverOffsetMs - 10`；手动模式立即；STOCK_FLIP 立即。
  - 补发：间隔 2200ms，复用未消耗 ticket。
  - 目标：默认 `selectedIds[0]`。

- [ ] **Step 3: 补全覆盖单测**
  - 自动模式 TICK 首发时机。
  - STOCK_FLIP 立即触发。
  - 555/soldOut 不消耗 ticket。
  - budget 耗尽停止。
  - 405 停止。
  - 手动模式立即发射。

- [ ] **Step 4: 运行测试**
  Run: `pnpm test`
  Expected: 新增用例与基线全部通过。

---

## Task 3: preview body 字段对齐

**Files:**
- Modify: `lib/platform/adapters/bigmodel/order-pipeline.ts`

- [ ] **Step 1: 补上 `invitationCode: ''`**
  在 preview POST body 中加入 `invitationCode: ''`，与官方四字段对齐。

- [ ] **Step 2: 运行测试**
  Run: `pnpm test`
  Expected: 通过。

---

## Task 4: MAIN world 请求中继

**Files:**
- Modify: `src/bm-main/02-state.js`

**Interfaces:**
- Consumes: `getLocalAuthHeaders()` from Task 1
- Produces: `PAGE_FETCH_REQUEST` / `PAGE_FETCH_RESPONSE` 消息协议

- [ ] **Step 1: 监听 `PAGE_FETCH_REQUEST`**
  在 `02-state.js` 的 message listener 中处理：
  - `reqId`, `url`, `method`, `headers`, `body`
  - 用 `window.fetch` 执行，返回 `{ __miaosha_cmd: true, type: 'PAGE_FETCH_RESPONSE', reqId, status, headers, bodyText }`
  - 如认证头缺失，用 `getLocalAuthHeaders()` 补全。

- [ ] **Step 2: 构建验证**
  Run: `node scripts/build-overlay.js`
  Expected: 成功。

---

## Task 5: MAIN world 库存观察与客户号预取

**Files:**
- Create: `src/bm-main/06-stock-watch.js`

**Interfaces:**
- Consumes: `getLocalAuthHeaders()` from Task 1
- Produces:
  - `window.__bm_customerInfo`
  - `window.__bm_serverOffset`
  - `window.__bm_stockState`
  - `STOCK_FLIP` postMessage event

- [ ] **Step 1: 预取 customerInfo**
  页面加载后 500ms 调用 `GET /api/biz/customer/getCustomerInfo`，成功后写入 `window.__bm_customerInfo`。

- [ ] **Step 2: 启动 batch-preview 轮询**
  从 `nextSaleTime - 90000` 开始，周期 4300ms，调用 `POST /api/biz/pay/batch-preview`。

- [ ] **Step 3: 计算 serverOffsetMs**
  每次成功响应：
  - `rtt = Date.now() - requestStart`
  - `serverDate = new Date(resHeaders.date).getTime()`
  - `offset = serverDate + rtt/2 - localNow`
  - 取运行最小值写入 `window.__bm_serverOffset`。

- [ ] **Step 4: 检测 soldOut 翻转**
  比较本次与上次 `productList` 中 selected product 的 soldOut；发现 `true -> false` 时发送 `STOCK_FLIP`。

- [ ] **Step 5: 构建验证**
  Run: `node scripts/build-overlay.js`
  Expected: 成功。

---

## Task 6: 改造 ISOLATED world 开火编排

**Files:**
- Modify: `entrypoints/bm-capture.content.ts`

**Interfaces:**
- Consumes:
  - `nextDecision` from Task 2
  - `PAGE_FETCH_RESPONSE` from Task 4
  - `STOCK_FLIP` from Task 5
- Produces: `BURST_FIRE_SUCCESS`（不变）

- [ ] **Step 1: 删除旧代码**
  移除 `runAutoFirePlan`、`burstStrike`、`buildAutoFirePlan` 导入。

- [ ] **Step 2: 接入 smart-fire-plan**
  - 维护 `SmartFireState`。
  - 监听 `STOCK_FLIP` 并调用 `nextDecision`。
  - 自动/手动入口均进入统一状态机。

- [ ] **Step 3: 实现 MAIN-world preview 发射**
  - 通过 `PAGE_FETCH_REQUEST` 发送 preview。
  - 计数预算，解析响应分类：success / soldout / busy / waf405 / captchaInvalid / error。
  - 根据分类更新状态机，调度下一发或停止。

- [ ] **Step 4: 手动模式约束**
  `fireConfig.burstIntervalMs` 下限强制 2100ms。

- [ ] **Step 5: 运行测试**
  Run: `pnpm test`
  Expected: 通过（可能需要更新旧测试）。

---

## Task 7: 校准 auto-fire 触发点

**Files:**
- Modify: `src/bm-main/07-auto-fire.js`

- [ ] **Step 1: 读取 serverOffsetMs**
  在 `dispatchAutoFire` 时读取 `window.__bm_serverOffset`，触发点改为：
  `startMs = _rt.nextSaleTime - (window.__bm_serverOffset || 0) - 10`

- [ ] **Step 2: 构建验证**
  Run: `node scripts/build-overlay.js`
  Expected: 成功。

---

## Task 8: 删除 BURST UI

**Files:**
- Modify: `src/bm-main/08-overlay.js`
- Modify: `src/bm-main/09-fire-viz.js`

- [ ] **Step 1: 08-overlay.js 删除 BURST 按钮**
  移除 `_fbb` 按钮创建、事件监听、以及 batch mode banner 中的 BURST 入口。

- [ ] **Step 2: 09-fire-viz.js 清理 BURST 渲染**
  移除仅用于 BURST 并发模式的状态/进度条/按钮，保留 `BURST_FIRE_SUCCESS` 事件处理（用于 P3）。

- [ ] **Step 3: 构建验证**
  Run: `node scripts/build-overlay.js`
  Expected: 成功。

---

## Task 9: P3 支付分发器

**Files:**
- Modify: `src/bm-main/10-native-pay-trigger.js`

**Interfaces:**
- Consumes:
  - `getLocalAuthHeaders()` from Task 1
  - `window.__bm_customerInfo` from Task 5
- Produces: `OPEN_PAY_TAB` runtime message

- [ ] **Step 1: 收到 BURST_FIRE_SUCCESS 后分支**
  - 若 `ps.payType === 'ALI'` 且 `window.__bm_customerInfo.customerNumber` 存在，走 `directCreateSign`。
  - 否则走 `openNativePaymentDialog(ps)`。

- [ ] **Step 2: 实现 directCreateSign**
  - POST `https://bigmodel.cn/api/biz/pay/create-sign`
  - body: `{ payType:'ALI', productId, customerId, bizId, ...(ic?{invitationCode:ic}:{}) }`
  - 200 + `data.sign` → `chrome.runtime.sendMessage({ type:'OPEN_PAY_TAB', url: data.sign })` + 通知 overlay
  - 任何失败 → `openNativePaymentDialog(ps)`

- [ ] **Step 3: 构建验证**
  Run: `node scripts/build-overlay.js`
  Expected: 成功。

---

## Task 10: Background 新增 OPEN_PAY_TAB

**Files:**
- Modify: `entrypoints/background.ts`

- [ ] **Step 1: 处理 OPEN_PAY_TAB**
  在 `onMessage` 中增加分支：
  ```ts
  if (msg.type === 'OPEN_PAY_TAB') {
    chrome.tabs.create({ url: msg.url })
      .then(() => sendResponse({ ok: true }))
      .catch(err => sendResponse({ ok: false, error: String(err) }));
    return true;
  }
  ```

- [ ] **Step 2: 运行测试**
  Run: `pnpm test`
  Expected: 通过。

---

## Task 11: fireStore 间隔下限

**Files:**
- Modify: `lib/settings/fire.ts`

- [ ] **Step 1: clamp 最小 2100ms**
  将 `clampInterval` 下限从 50 改为 2100，并同步 `FIRE_CONFIG_DEFAULT.burstIntervalMs` 为 2100。

- [ ] **Step 2: 运行测试**
  Run: `pnpm test`
  Expected: 通过。

---

## Task 12: 回归测试与构建

- [ ] **Step 1: 全量单测**
  Run: `pnpm test`
  Expected: 全部通过。

- [ ] **Step 2: Overlay 构建**
  Run: `node scripts/build-overlay.js`
  Expected: 成功生成 `public/bm-main.js`。

- [ ] **Step 3: WXT 构建**
  Run: `pnpm build`
  Expected: 成功生成 `output/chrome-mv3/`。

- [ ] **Step 4: Smoke 检查清单**
  - 重新打开 `https://bigmodel.cn/glm-coding?plantype=personal`。
  - 打开 DevTools，确认 `window.__bm_customerInfo` 与 `window.__bm_serverOffset` 被设置。
  - 确认 4300ms 一次的 batch-preview 请求正常返回 200。
  - 在非抢购时段点击 Fire，确认走的是 2100ms 间隔的单发模式且 budget 计数正常。
  - 使用 header test 按钮验证 `create-sign` fallback 能打开原生弹窗（test 模式金额 159 不触发真实支付）。

---

## Spec Coverage Check

| Spec 要求 | 对应任务 |
|---|---|
| 默认 preview 预算 8 | Task 2, Task 6 |
| 最小间隔 2100ms | Task 2, Task 6, Task 11 |
| batch-preview 轮询 4300ms + 翻转检测 | Task 5 |
| serverOffsetMs 校准 auto-fire | Task 5, Task 7 |
| MAIN-world fetch 中继 | Task 4 |
| ALI create-sign 直连 | Task 9, Task 10 |
| WE_CHAT / 失败回退原生弹窗 | Task 9 |
| 删除 BURST | Task 8 |
| preview body 补 invitationCode | Task 3 |
| customerNumber 预取 | Task 5 |
