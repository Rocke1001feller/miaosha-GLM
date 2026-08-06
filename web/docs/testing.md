# 智能Coding Plan助手 — 测试架构指南

> **适用版本**: WXT 0.20.26 · Svelte 5 · Vitest 4 · 构建日期 2026-05  
> **状态**: ✅ 101 个测试全部通过 (`pnpm test`)

---

## 目录

1. [测试原则](#1-测试原则)  
2. [文件拓扑结构](#2-文件拓扑结构)  
3. [测试分层模型](#3-测试分层模型)  
4. [工具链与配置](#4-工具链与配置)  
5. [各层测试写法详解](#5-各层测试写法详解)  
   - 5.1 纯逻辑单元测试（无浏览器 API）  
   - 5.2 WXT 存储层测试（fakeBrowser）  
   - 5.3 bm-main 原生 JS 模块测试（vm 沙箱）  
   - 5.4 Svelte 5 组件测试（@testing-library/svelte）  
   - 5.5 集成测试（chrome.* mock）  
   - 5.6 E2E 回归门（Playwright，已嵌入 build 流水线）
   - 5.7 手动测试原生支付弹窗  
6. [运行测试](#6-运行测试)  
7. [扩展现有测试套件](#7-扩展现有测试套件)  
8. [禁止事项与反模式](#8-禁止事项与反模式)  
9. [依赖版本锁定](#9-依赖版本锁定)

---

## 1. 测试原则

### 原则 1：链式优先（Chain-First）

本项目的核心是 **数据链**，不是孤立的函数：

```
batch-preview API → auth 捕获 → 产品矩阵构建 → 产品卡片 UI → 下单 Fire
```

**发现 bug 先定位链路，再定位层次，最后写测试。**  
不要因为 UI 显示不正确就只测 UI，要追溯到数据在链路上的哪一层失真。

### 原则 2：分层测试，按层选择工具

| 层 | 代码 | 测试工具 | 速度 |
|----|------|----------|------|
| 纯逻辑 | `lib/api/catalog.ts`, `01-utils.js` | Vitest (无环境) | 极快 |
| 存储层 | `lib/api/auth-store.ts`, `lib/settings/*.ts` | Vitest + fakeBrowser | 快 |
| bm-main JS | `src/bm-main/*.js` | Vitest + vm 沙箱 | 快 |
| Svelte 组件 | `entrypoints/popup/**/*.svelte` | @testing-library/svelte | 中 |
| Chrome API 集成 | `lib/api/auth-store.captureFromTab` | Vitest + vi.mock | 中 |
| E2E 回归 | — | 已删除 | — |

### 原则 3：测试行为，不测实现

测试函数对 **输入 → 输出** 的契约，不要 `expect(internalVar).toBe(...)` 或 `.spy()` 内部调用顺序。  
> ✅ `expect(await authStore.isReady()).toBe(true)`  
> ❌ `expect(storageSetItem).toHaveBeenCalledWith('...')`

### 原则 4：每个测试独立，fakeBrowser 每次重置

`tests/setup.ts` 全局调用 `fakeBrowser.reset()`，保证各测试看到干净的 `chrome.storage`。  
**不要在测试之间共享状态。**

### 原则 5：bm-main 模块必须包含依赖链

`src/bm-main/*.js` 按数字顺序设计，后者依赖前者的全局变量：

```
01-utils → inferBillingFromPreview, formatAmount ...
02-state → _planOrder, _productMatrix, _billing ...
05-product → buildProductMatrix (uses both 01 and 02)
```

加载时 **必须按顺序包含所有依赖文件**，否则会出现 `ReferenceError: _planOrder is not defined`。

### 原则 6：永不手动编辑生成文件

`public/bm-main.js` 和 `output/chrome-mv3/bm-main.js` 是自动生成的。  
测试 `src/bm-main/*.js` 原始源文件，不测生成产物。

---

## 2. 文件拓扑结构

```
miaosha-GLM/
├── vitest.config.ts                 ← Vitest 主配置（WxtVitest + Svelte 插件）
│
├── tests/
│   ├── setup.ts                     ← 全局 setup：jest-dom matchers + fakeBrowser.reset()
│   │
│   ├── unit/                        ← 纯单元测试（不需要真实浏览器）
│   │   ├── _vm-harness.ts               ← 公共 vm 沙箱工厂（非测试文件）
│   │   ├── lib/
│   │   │   ├── api/
│   │   │   │   ├── catalog.test.ts          ← API_CATALOG 结构契约
│   │   │   │   ├── fire-plan.test.ts        ← buildAutoFirePlan 时序/ticket 分配
│   │   │   │   └── strike-plan.test.ts      ← buildStrikeQueue 加权轮询
│   │   │   ├── platform/
│   │   │   │   └── classify-preview-error.test.ts ← 错误分类单源契约
│   │   │   └── settings/
│   │   │       ├── sale-time.test.ts        ← saleTimeStore + 默认值合并
│   │   │       ├── fire.test.ts             ← fireStore 默认值/非法值回退
│   │   │       └── dev.test.ts              ← devEnvironment 标量偏好存储
│   │   │
│   │   ├── entrypoints/
│   │   │   ├── background.test.ts           ← alarm/badge 调度 + getNextSaleTime
│   │   │   └── bm-capture-scope.test.ts     ← bm-capture 模块作用域静态检查
│   │   │
│   │   ├── bm-main/
│   │   │   ├── _harness.ts                  ← vm 沙箱薄封装（非测试文件）
│   │   │   ├── product.test.ts              ← 05-product.js buildProductMatrix
│   │   │   ├── product-loading.test.ts      ← loadProducts 编排/重试/WAF 规避
│   │   │   └── header-injection.test.ts     ← 10-header.js L1 注入竞态回归
│   │   │
│   │   └── volc-main/
│   │       ├── _harness.ts                  ← vm 沙箱薄封装（非测试文件）
│   │       ├── pricing.test.ts              ← calculatePriceV5 重试/退避
│   │       └── config.test.ts               ← 00-config 运行时平台探测
│   │
│   ├── component/                   ← Svelte 组件测试
│   │   └── popup/
│   │       └── Topbar.svelte.test.ts        ← DEV/PROD 切换 + 回调
│   │
└── scripts/                         ← 构建与打包辅助脚本
    ├── build-overlay.js             ← 拼接 src/*-main → public/*.js
    ├── verify-no-minifier-collision.mjs ← 构建产物标识符冲突检查
    └── zip-prepare.mjs              ← 为 wxt zip 做前置准备
```

> **命名约定**  
> - TypeScript/JS 单元测试：`*.test.ts` / `*.test.js`  
> - Svelte 组件测试：`*.svelte.test.ts`（必须含 `.svelte` 以启用 runes 处理）  
> - 工具/辅助文件：`_harness.ts`（下划线前缀，不被 Vitest 自动收集）

---

## 3. 测试分层模型

```
┌─────────────────────────────────────────────────────────────────┐
│  L4 — Svelte 组件测试（@testing-library/svelte + happy-dom）     │
│       渲染 + 交互 + prop 传递 + 事件回调                         │
├─────────────────────────────────────────────────────────────────┤
│  L2 — WXT 存储单元测试（Vitest + fakeBrowser）                   │
│       authStore, saleTimeStore …                                │
├─────────────────────────────────────────────────────────────────┤
│  L1 — 纯逻辑单元测试（Vitest, 无浏览器依赖）                     │
│       catalog, 01-utils, buildProductMatrix, getNextSaleTime … │
└─────────────────────────────────────────────────────────────────┘
```

**规则**：尽量在最低层发现问题。L1/L2 快且不依赖环境，能覆盖核心逻辑。  
只有确实需要浏览器交互或 DOM 的代码才升到 L4。  
原 E2E 回归门（Playwright + Node.js 静态门）与 L3 集成测试层目前均已移除/暂无。

---

## 4. 工具链与配置

### 4.1 已安装 devDependencies

```json
{
  "devDependencies": {
    "@sveltejs/vite-plugin-svelte": "^7.1.2",
    "@testing-library/jest-dom": "^6.x",
    "@testing-library/svelte": "^5.x",
    "@testing-library/user-event": "^14.x",
    "@vitest/ui": "^4.x",
    "happy-dom": "^20.x",
    "vitest": "^4.x"
  }
}
```

### 4.2 vitest.config.ts 关键配置说明

```typescript
import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';
import { svelte } from '@sveltejs/vite-plugin-svelte';

export default defineConfig({
  plugins: [
    WxtVitest(),  // ① 自动 polyfill browser API + 配置 #imports + fakeBrowser
    svelte(),     // ② 让 Vite 能解析 .svelte 文件（WxtVitest 不自动包含）
  ],
  resolve: {
    conditions: ['browser'], // ③ 让 Svelte 5 使用客户端运行时而非 SSR 运行时
  },
  test: {
    environment: 'happy-dom',       // DOM 模拟（Svelte 组件挂载需要 document）
    setupFiles: ['./tests/setup.ts'], // 全局 setup
    globals: true,
  },
});
```

> **① WxtVitest**：自动配置 `wxt/*` 虚拟模块别名（如 `#imports`）、`fakeBrowser` 自动注入、WXT 构建配置。  
> **② svelte()**：WXT 在 build 流水线中通过 `@wxt-dev/module-svelte` 注册 Svelte 插件，但该模块不自动在 `WxtVitest()` 中生效，需要显式添加。  
> **③ conditions: ['browser']**：Svelte 5 的包入口有两条路径——`browser` 条件导向 `svelte/internal/client`（客户端），否则导向 `svelte/internal/server`（SSR）。在 happy-dom 中不显式设置此条件会导致 `lifecycle_function_unavailable: mount() is not available on the server` 错误。

### 4.3 tests/setup.ts

```typescript
import '@testing-library/jest-dom/vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { beforeEach } from 'vitest';

beforeEach(() => {
  fakeBrowser.reset(); // 每个测试前清空内存中的 chrome.storage, tabs, alarms 等
});
```

---

## 5. 各层测试写法详解

### 5.1 纯逻辑单元测试

**适用**：`lib/api/catalog.ts`, `lib/api/fire-plan.ts`, `lib/api/strike-plan.ts`, `src/bm-main/01-utils.js`（通过 harness）

无需任何 mock，直接 import 函数测试。

```typescript
// tests/unit/lib/api/catalog.test.ts
import { API_CATALOG } from '../../../../lib/api/catalog';

it('batch-preview endpoint uses POST', () => {
  const ep = API_CATALOG.find(e => e.id === 'batch-preview');
  expect(ep?.method).toBe('POST');
});
```

**背景函数提取**：`background.ts` 导出的是 `defineBackground()` 回调，不直接可测。  
对其中的纯逻辑（如 `getNextSaleTime`），在测试文件中**复制函数体**，保持算法同步，单独测试：

```typescript
// tests/unit/entrypoints/background.test.ts
// 复制 getNextSaleTime 函数并测试其时区算法
```

> 当 `background.ts` 中的算法更新时，对应测试会失败，提醒同步更新。

---

### 5.2 WXT 存储层测试（fakeBrowser）

**适用**：`lib/api/auth-store.ts`, `lib/settings/*.ts`

`WxtVitest` 插件自动将 `wxt/browser` 替换为 `fakeBrowser` 内存实现。

```typescript
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { authStore } from '../../../../lib/api/auth-store';

// setup.ts 的 beforeEach 已自动调用 fakeBrowser.reset()

it('reports not ready when storage is empty', async () => {
  expect(await authStore.isReady()).toBe(false);
});
```

**直接种入存储数据**（测试边缘情况如过期、空值）：

```typescript
// WXT storage key 'local:foo' 存入 chrome.storage.local 时去掉前缀 → key 是 'foo'
await fakeBrowser.storage.local.set({ ticketPool: [...] });
```

---

### 5.3 bm-main 原生 JS 模块测试

**适用**：`src/bm-main/01-utils.js`, `02-state.js`, `05-product.js` 等

这些文件是无模块系统的 vanilla JS，通过 Node `vm` 模块在隔离沙箱中执行。  
`tests/unit/bm-main/_harness.ts` 提供 `loadBmMainModules()` 工具：

```typescript
import { loadBmMainModules } from './_harness';

let S: ReturnType<typeof loadBmMainModules>;

beforeAll(() => {
  // 按依赖顺序加载：01-utils → 02-state → 05-product
  S = loadBmMainModules(['01-utils', '02-state', '05-product']);
});

it('buildProductMatrix 返回 monthly/quarterly/yearly 分组', () => {
  const matrix = (S.buildProductMatrix as Function)(productList);
  expect(matrix.monthly).toHaveLength(3);
});
```

**关键规则**：
- 始终按数字顺序包含依赖文件
- 沙箱提供最小 DOM stub（`document.getElementById` 等），按需扩展
- `vm.runInContext` 的 sandbox 共享，后加载的文件可访问前一个文件声明的函数/变量

---

### 5.4 Svelte 5 组件测试

**适用**：`entrypoints/popup/**/*.svelte`, `entrypoints/options/**/*.svelte`

使用 `@testing-library/svelte`（语义化查询）+ `userEvent`（用户交互模拟）。

```typescript
// 文件名必须包含 .svelte → Topbar.svelte.test.ts
import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import Topbar from '../../../entrypoints/popup/components/Topbar.svelte';

it('点击 PROD 触发 onmodechange("production")', async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  render(Topbar, { props: { mode: 'development', onmodechange: onChange } });
  await user.click(screen.getByRole('button', { name: 'PROD' }));
  expect(onChange).toHaveBeenCalledWith('production');
});
```

**Svelte 5 Runes 测试**（含 `$state`、`$effect`）：

```typescript
// 测试文件名必须包含 .svelte 扩展名，Vitest 才会以 Svelte compiler 处理 runes
// multiplier.svelte.test.ts
import { flushSync } from 'svelte';
let count = $state(0);
count = 5;
flushSync(); // 强制同步刷新 reactive 更新
```

**低层 mount API**（不依赖 Testing Library 时）：

```typescript
import { mount, unmount, flushSync } from 'svelte';
const component = mount(Component, { target: document.body, props: { value: 0 } });
document.querySelector('button')?.click();
flushSync();
expect(document.body.innerHTML).toContain('1');
unmount(component);
```

---

### 5.5 集成测试（chrome.tabs / chrome.scripting mock）

**当前状态**：`tests/integration/` 目录不存在，暂无集成测试。

**适用场景**：`lib/api/auth-store.captureFromTab()`, `lib/api/client.ts`

这些函数调用 `chrome.tabs.query` 和 `chrome.scripting.executeScript`，无法用 fakeBrowser 内存实现（fakeBrowser 不包含 scripting API 的真实行为）。如需补充，使用 `vi.mock` 显式模拟：

```typescript
// tests/integration/auth-capture.test.ts
import { vi, it, expect } from 'vitest';
import { authStore } from '../../lib/api/auth-store';

vi.mock('wxt/browser', async (importOriginal) => {
  const real = await importOriginal<typeof import('wxt/browser')>();
  return {
    ...real,
    browser: {
      ...real.browser,
      tabs: {
        query: vi.fn().mockResolvedValue([{ id: 123 }]),
      },
      scripting: {
        executeScript: vi.fn().mockResolvedValue([{
          result: { authorization: 'Bearer t', bigmodelOrganization: 'org', bigmodelProject: 'proj' }
        }]),
      },
    },
  };
});

it('captureFromTab 从 tab 获取 auth 并写入 storage', async () => {
  const result = await authStore.captureFromTab();
  expect(result?.authorization).toBe('Bearer t');
  expect(await authStore.isReady()).toBe(true);
});
```

---

### 5.6 E2E 回归门（已移除）

原先嵌入 `npm run build` 的 L5/L6 E2E 回归门（`scripts/regression-target-products.js` 与 `scripts/regression-target-products-e2e.js`）已删除。构建流程现在只保留 `build-overlay.js` 与 `wxt build` 两步，回归验证由 Vitest 单元/组件测试覆盖。

---

### 5.7 手动测试原生支付弹窗

在真实秒杀前，建议先验证插件能否正常拉起 bigmodel.cn 的原生支付弹窗，避免抢购成功后因支付链路问题功亏一篑。

#### 方法一：点击 L1 信息条上的 Test Pay 按钮

1. 打开 https://bigmodel.cn/glm-coding，确保插件已注入。
2. 页面顶部 L1 信息条右侧会出现一个绿色 🔄 图标按钮（tooltip：「模拟抢购成功，提前验证原生支付弹窗能否正常拉起」）。
3. 点击该按钮。
4. 预期：bigmodel.cn 原生支付弹窗出现。
5. 如果弹窗内出现二次腾讯点选验证码，完成或关闭它；弹窗仍应保持打开。
6. 点击原生弹窗右上角的 X，弹窗关闭。

#### 方法二：使用 DevTools Console 脚本

```bash
node scripts/test-native-pay-dialog.mjs
```

按脚本输出的说明，将代码片段粘贴到 bigmodel.cn/glm-coding 页面的 DevTools Console 中执行，效果与方法一相同。

#### 注意事项

- 测试模式使用模拟的 `TEST-*` bizId，不会真正扣款或锁单。
- 测试模式下只有点击原生弹窗右上角 X 才能关闭；ESC、点击遮罩、后端自动关闭均会被拦截。
- 真实 `BURST_FIRE_SUCCESS` 路径不会进入测试模式，正常抢购流程不受影响。

---

## 6. 运行测试

```bash
# 运行所有 vitest 测试（单次）
pnpm test

# 监听模式（开发时用）
pnpm test:watch

# 带 UI 的交互式界面
pnpm test:ui

# 带覆盖率报告
pnpm test:coverage

# 完整 build（仅 build-overlay + wxt build，无 E2E 回归门）
pnpm build
```

---

## 7. 扩展现有测试套件

### 新增 lib/ 模块的测试

1. 在 `tests/unit/lib/<area>/` 下创建 `<module>.test.ts`
2. 如果模块用 WXT storage：直接测（fakeBrowser 自动工作）
3. 如果模块调用 `chrome.tabs`/`scripting`：在 `tests/integration/` 下，用 `vi.mock('wxt/browser',...)`

### 新增 bm-main JS 模块的测试

1. 在 `tests/unit/bm-main/` 下创建 `<name>.test.ts`
2. 用 `loadBmMainModules([...])` 按依赖顺序加载模块
3. 通过 `S.<functionName> as Function` 调用被测函数
4. 如需 DOM，扩展 `_harness.ts` 的 `makeSandbox()` stub

### 新增 Svelte 组件测试

1. 文件名必须是 `*.svelte.test.ts`
2. 用 `render(Component, { props: {...} })` 挂载
3. 用 `screen.getByRole/Text/...` 查询（无障碍语义优先）
4. 用 `userEvent.setup()` 模拟用户交互
5. 如组件依赖 chrome.storage，fakeBrowser 已自动生效；如依赖 chrome.tabs，用 `vi.mock`

### 新增 bm-main 模块功能时

1. 在对应源文件（`src/bm-main/XX-name.js`）中添加功能
2. 在对应测试文件中补充测试用例
3. 运行 `pnpm test` 确认所有测试通过
4. 运行 `pnpm build` 确认 E2E 门通过

---

## 8. 禁止事项与反模式

| ❌ 不要这样做 | ✅ 替代方案 |
|---|---|
| 直接 import `entrypoints/background.ts` | 提取纯函数在测试文件中复制测试 |
| 在测试中调用真实 `fetch()` | 用 `vi.spyOn(global, 'fetch')` 或测试不依赖网络的纯逻辑 |
| 测试 `public/bm-main.js` | 测试 `src/bm-main/*.js` 原始源文件 |
| 在多个测试间共享 `storageState` | 依赖 `fakeBrowser.reset()` 每次重置 |
| 在 Svelte 组件测试中用 `.svelte.test.js` | 必须用 `.svelte.test.ts`（类型支持）|
| 用 `vi.mock('../../../lib/api/auth-store')` 规避 storage | 让 fakeBrowser 自然工作 |
| 用 `page.waitForTimeout(500)` 等待 UI | 用 `flushSync()` 或 `waitFor()` |

---

## 9. 依赖版本锁定

| 包 | 版本 | 用途 |
|----|------|------|
| `vitest` | ^4.1.7 | 测试运行器 |
| `@vitest/ui` | ^4.1.7 | 可视化 UI |
| `happy-dom` | ^20.x | DOM 模拟环境 |
| `@sveltejs/vite-plugin-svelte` | ^7.1.2 | Svelte 文件 Vite 转换 |
| `@testing-library/svelte` | ^5.3.1 | Svelte 组件测试工具 |
| `@testing-library/jest-dom` | ^6.9.1 | DOM 断言扩展 |
| `@testing-library/user-event` | ^14.6.1 | 用户交互模拟 |

> Vitest 4.x 与 WXT 0.20.26 配合已验证可用。升级 WXT 主版本前先运行 `pnpm test` 确认兼容性。
