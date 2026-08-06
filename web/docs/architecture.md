# 智能Coding Plan助手 — 代码库架构与基本原理

**版本**: 基于 2026-05-30 代码状态  
**构建工具**: WXT 0.20.26 · Vite · TypeScript · Svelte 5  
**扩展类型**: Chrome MV3 (Manifest V3)

---

## 1. 产品目标

智谱 AI（bigmodel.cn）定期举办"秒杀"活动：在固定时间点（默认 09:54:59.999 上海时区）开放限量套餐购买，额度极其有限，需要抢购。

本扩展的核心目标：**让用户在秒杀开始前做好准备、在秒杀瞬间以最快速度完成下单**。

扩展同时支持火山引擎（volc-main）、阿里百炼（ali-main）与百度千帆（bce-main）三个平台的 Coding Plan 抢购；本文为智谱主链路架构，其他平台为同构 overlay 变体。

popup 另设"秒杀 | 用量"底部 tab，用量视图经 M6 重放（扩展上下文直连）聚合 MiniMax / Kimi / 小米 MiMo / 火山引擎四平台套餐用量（`lib/usage/`，协议细节见 `docs/superpowers/specs/2026-07-18-usage-tab-design.md`）。

用量会话自愈（2026-07-21 两轮实证）：MiMo 的 `api-platform_*` 与火山的 `csrfToken`/`digest` 均为会话级凭证，浏览器退出即失效；Kimi 的 access_token 存于 kimi.com localStorage（跨重启存活），但扩展侧缓存可能因重装丢失。统一经 `healViaTab` 标签页自愈：MiMo 401、火山 NotLogin、Kimi 无缓存 token 时，自动打开/刷新对应控制台标签页，借平台 SSO 或页面 localStorage 重铸/捕获凭证后重试；自建标签页用后即关。火山另有双提交 CSRF 校验，缺失时合成随机 `csrfToken` 补齐 cookie + header 两端即可。

功能按需求编号（R1–R4）组织：

| 需求 | 功能 | 载体 |
|------|------|------|
| R1 | 系统通知倒计时提醒（60/30/15 分钟前，T-5 后停止） | Background service worker |
| R2 | 验证码预取（Tencent CAPTCHA ticket 池） | bm-capture content script + bm-main |
| R3 | bigmodel.cn 标签页内视觉+音频提醒 | bm-capture content script |
| R4 | 扩展图标角标倒计时 | Background service worker |
| NEWS | AI 聚合新闻阅读（读取 rocke1001feller.github.io 静态 JSON） | Popup「AI 新闻」面板 |
| PROD | 平台秒杀入口导航 + 各平台额度用量 | Popup「抢购秒杀」「Token 用量」面板 |

---

## 2. 整体架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      Chrome Extension (MV3)                      │
│                                                                   │
│  ┌──────────────┐   ┌──────────────────────────────────────────┐ │
│  │   Background  │   │              bigmodel.cn Tab              │ │
│  │ Service Worker│   │                                           │ │
│  │               │   │  ┌─────────────┐    ┌─────────────────┐  │ │
│  │ • Alarms API  │   │  │ bm-capture  │    │   bm-main.js    │  │ │
│  │ • Badge 角标  │   │  │ (ISOLATED)  │◄──►│  (MAIN world)   │  │ │
│  │ • 通知推送    │   │  │             │    │                  │  │ │
│  │               │   │  │ • 倒计时UI  │    │ • XHR 拦截      │  │ │
│  └───────┬───────┘   │  │ • Auth抓取  │    │ • 验证码监听     │  │ │
│          │           │  │ • Storage桥 │    │ • 秒杀火力控制   │  │ │
│  ┌───────▼───────┐   │  └─────────────┘    └─────────────────┘  │ │
│  │    Popup       │   │                                           │ │
│  │                │   └──────────────────────────────────────────┘ │
│  │  ┌──────────┐  │                                                 │
│  │  │ Header:  │  │   chrome.storage.local ◄──── 所有组件共享存储  │
│  │  │ AI 新闻 / │  │                                                 │
│  │  │ Token 用量│  │                                                 │
│  │  └──────────┘  │                                                 │
│  │  ┌──────────┐  │                                                 │
│  │  │ Footer:  │  │                                                 │
│  │  │ 设置/买家秀│  │                                                 │
│  │  │ 秒杀/    │  │                                                 │
│  │  │ 拼团转让  │  │                                                 │
│  │  └──────────┘  │                                                 │
│  └────────────────┘                                                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Entrypoints（入口点）

WXT 的 `entrypoints/` 目录中每个文件/目录对应一个扩展入口点，编译后各自独立打包。

### 3.1 `entrypoints/background.ts` — 后台 Service Worker

**职责**: R1（system notifications）+ R4（badge 角标）

Chrome MV3 的 service worker 在浏览器关闭时会被停止，`chrome.alarms` 是唯一可以在 SW 停止后仍能触发回调的机制。

**关键设计约束**：`chrome.alarms.onAlarm.addListener` **必须**在顶层注册（不能在 async 函数内），否则 SW 被唤醒后会错过事件。

工作流：
```
popup/options 写入 saleTimeConfig
        ↓
background.ts 读取配置 → 计算下次秒杀时间
        ↓
setTimeout 设定 60/30/15 分钟前触发
        ↓
触发时: chrome.notifications.create + chrome.action.setBadgeText
```

### 3.2 `entrypoints/bm-capture.content.ts` — bigmodel.cn 页面内 Content Script

**职责**: R2（验证码中继）+ R3（页面内提醒）+ Auth 捕获

运行在 **ISOLATED world**，可以访问 `chrome.*` API 和 WXT `storage`，但不能访问页面的 JS 变量。

两个职责需要和 `bm-main.js`（MAIN world）协作：

```
bm-main.js (MAIN world)          bm-capture (ISOLATED world)
────────────────────────          ───────────────────────────
XHR 拦截到验证码响应               监听 window message
→ window.postMessage(ticket)  →   → storage.setItem('local:ticketPool', ...)
                                  → 累积 ticket 池

倒计时提醒 UI 按钮点击              监听 UI 事件
→ window.postMessage(FIRE) →       → 读取 ticketPool + auth
                                  → 发起批量 fetch 请求
```

**Auth 捕获**：`captureFromTab()` 在 MAIN world 执行 `extractAuthFromPage()`，从 `document.cookie`（JWT）和 `localStorage`（org/project）读取当前 session 凭证，写回 `local:authHeaders`。

### 3.3 `entrypoints/popup/` — Popup 页面

Svelte 5 应用，380×520px。单一激活 tab 模型（`tabs.ts`）：header 与 footer 共 6 个按钮互斥切换，同一时刻只渲染一个面板；每次打开默认显示「Token 用量」。

```
App.svelte
├── tabs.ts                ← PopupTab 类型 + 默认 tab + 按钮元数据（单一事实源）
├── Topbar.svelte          ← Header 两 tab：AI 新闻 / Token 用量（高频功能）
├── NewsContent.svelte     ← AI 新闻面板：AI 聚合新闻阅读
│   ├── NewsFilterBar      ← 窗口 / 平台 / 搜索
│   ├── NewsList           ← 分页新闻列表
│   └── NewsCard           ← 单条新闻卡片
├── UsageView.svelte       ← Token 用量面板（默认）：各平台 Coding Plan 额度用量
├── PlatformEntryGrid.svelte ← 抢购秒杀面板：平台入口卡片（智谱 / 火山引擎 / 阿里百炼 / 百度千帆）
├── PlaceholderPanel.svelte ← 占位面板（买家秀 UGC 点评 / 拼团转让交易，敬请期待）
└── Footer.svelte          ← 底部等宽分段控件：设置（打开选项页）+ 买家秀 / 秒杀 / 拼团转让
```

### 3.4 `entrypoints/options/` — 选项页

秒杀时间配置（小时/分钟/时区），写入 `local:saleTimeConfig`。

---

## 4. 核心机制：同源请求代理

### 为什么需要代理？

bigmodel.cn 的 API 检查请求来源：

| 请求来源 | 服务端响应 |
|----------|-----------|
| bigmodel.cn 页面（同源） | 完整 JSON body（正常） |
| `chrome-extension://` origin | `content-length: 0`（body 被服务端拒绝） |

### 解决方案：`executeScript` + `world: 'MAIN'`

`lib/api/client.ts` 的 `fetchFromBigmodelPage()` 函数：

1. 找到一个已打开的 bigmodel.cn 标签页 ID
2. 用 `chrome.scripting.executeScript` 将 async fetch 函数注入到该 tab 的 **MAIN world**
3. 注入函数在页面 JS 上下文中执行，fetch 的来源是 `https://bigmodel.cn`（同源）
4. 结果通过 `results[0].result` 返回给 popup

```
Popup Context                    bigmodel.cn Tab (MAIN world)
─────────────────                ─────────────────────────────
chrome.scripting.executeScript
  target: { tabId }
  world: 'MAIN'
  args: [url, method, headers, body]
  func: async (url, ...) => {
    const r = await fetch(url, ...)  ← 同源 fetch，服务端正常响应
    return { status, headers, bodyText }
  }
         ──────────────────────────►
                                   fetch('https://bigmodel.cn/api/...')
                                   ← 完整 response body
         ◄──────────────────────────
  results[0].result.bodyText     返回 4860B JSON
```

**权限要求**：
- `permissions: ['scripting', 'tabs']`
- `host_permissions: ['*://*.bigmodel.cn/*']`（缺少此项则 executeScript 失败）

---

## 5. Auth 系统

### 凭证结构

```typescript
interface AuthHeaders {
  authorization: string;        // "Bearer eyJhbGciOiJIUzUxMiJ9..."
  bigmodelOrganization: string; // "org-7369f0B6C8DA44C0B70ee373c986bf81"
  bigmodelProject: string;      // "proj_015E67feC12A4605932AeD380dA2cb88"
}
```

### 存储

WXT storage key: `local:authHeaders`（对应 `chrome.storage.local['local:authHeaders']`）

### 获取路径

```
captureFromTab() (bm-capture.content.ts)
  └→ executeScript(bigmodel.cn tab, MAIN world)
       └→ 读 document.cookie['bigmodel_token_production']  → authorization
       └→ 读 localStorage['Bigmodel-Organization']         → bigmodelOrganization
       └→ 读 localStorage['Bigmodel-Project']              → bigmodelProject
       └→ 返回 AuthHeaders 对象
  └→ 写入 chrome.storage.local['local:authHeaders']
  └→ return captured
```

### 生命周期与刷新策略

**重要**：bigmodel.cn 的 JWT 在用户重新登录时会轮换。缓存的 auth 可能随时失效。

`DevContent.svelte` 的 `$effect` 在 popup 每次打开时：
1. **首先** 调用 `captureFromTab()` 抓取 tab 当前有效 token
2. **兜底** 在无 bigmodel.cn tab 时，使用 `authStore.get()` 读缓存

这确保了 DEV 调试面板永远使用有效 token。

---

## 6. Ticket（验证码）系统

Tencent CAPTCHA 每次使用后失效，且有效期 5 分钟（错误码 8 即 ticket expired）。

### Ticket 池设计

```typescript
// local:ticketPool 条目结构
interface Ticket {
  ticket: string;   // Tencent CAPTCHA ticket
  randstr: string;  // 配套 randstr
  createdAt: number;
}
```

- 最多存 20 个 ticket（`MAX_POOL_SIZE = 20`）
- 每次读取前自动清除超过 5 分钟的过期 ticket
- 去重：相同 `ticket` 字符串不重复入池

### 获取流程

```
用户在 bigmodel.cn 通过 CAPTCHA
  ↓
bm-main.js (XHR 拦截) 捕获到 ticket + randstr
  ↓
window.postMessage → bm-capture.content.ts
  ↓
写入 chrome.storage.local['local:ticketPool']
```

### 使用流程（秒杀触发）

```
用户点击"开火"按钮（popup 抢购秒杀面板或 bm-main 覆盖层）
  ↓
bm-capture.content.ts 读取 local:ticketPool
  ↓
buildAutoFirePlan() 按优先级与过期紧迫度分配 ticket
  ↓
对每个 (ticket × productId) 发起 /api/biz/pay/preview 请求
```

---

## 7. Storage 架构

所有状态通过 `chrome.storage.local` 在扩展各组件间共享：

| WXT Key | 实际 Storage Key | 类型 | 写入者 | 读取者 |
|---------|-----------------|------|--------|--------|
| `local:authHeaders` | `local:authHeaders` | `AuthHeaders` | bm-capture | bm-capture |
| `local:ticketPool` | `local:ticketPool` | `Ticket[]` | bm-capture | bm-capture (开火时) |
| `local:saleTimeConfig` | `local:saleTimeConfig` | `SaleTimeConfig` | options 页 | background, bm-capture |
| `local:newsCache` | `local:newsCache` | `NewsCacheEntry` | NewsContent | NewsContent |
| `local:selectedProducts` | `local:selectedProducts` | `{priorityList: Array<{productId, percentage}>, count, version}` | bm-main 覆盖层 | bm-capture (开火时) |

**WXT storage 命名约定**: `local:` 前缀表示 `chrome.storage.local`（区别于 `session:` 和 `sync:`）。WXT 的 `storage.setItem('local:foo', v)` 等价于 `chrome.storage.local.set({'local:foo': v})`——key 是字面量，不做前缀 strip。

---

## 8. MAIN World 注入脚本（bm-main.js）

`public/bm-main.js` 作为 `web_accessible_resources` 注册，由 bm-capture 动态注入到 bigmodel.cn 页面：

```typescript
// bm-capture.content.ts
const script = document.createElement('script');
script.src = chrome.runtime.getURL('/bm-main.js');
document.head.appendChild(script);
```

在 MAIN world 运行意味着它可以：
- 拦截原生 `XMLHttpRequest`（通过 prototype 覆盖）
- 访问页面 React/Vue 的全局状态（如有）
- 读写 `document.cookie` 和 `localStorage`
- 与 ISOLATED world 通过 `window.postMessage` / `window.addEventListener('message')` 通信

**bm-main.js 的主要功能**：
1. XHR 拦截 → 捕获 `/api/biz/pay/batch-preview` 返回的商品列表
2. XHR 拦截 → 捕获 Tencent CAPTCHA 验证成功返回的 ticket
3. 渲染秒杀覆盖层 UI（拖拽、商品选择、ticket 计数、一键开火）
4. 监听覆盖层 UI 事件 → `window.postMessage` → bm-capture

`ali-main.js`（阿里百炼）：轮询 `buy-api.aliyun.com/commodity/checkInventoryDetail.json` 获取库存与 `restockingTimeStamp`，补货时刻自动 `POST /order/createOrder.json`（带 `X-XSRF-TOKEN`、`umidToken/collina/submitref/linkage` 风控字段），成功或出现未支付订单即停手并引导用户手动支付。协议细节见 `docs/superpowers/specs/2026-07-17-bailian-codingplan-seckill-design.md`。

`bce-main.js`（百度千帆）：轮询 `/api/qianfan/charge/tokenPlanPersonal/firstPurchaseConfig` 获取四档 `available` 与 `times` 开售时刻，补货翻转后按勾选优先级 `POST /api/qianfan/charge/order/new`（带 `csrftoken` 头，取自 `bce-user-info` cookie），成功即跳 `/finance/pay` 收银台由用户手动支付。协议细节见 `docs/superpowers/specs/2026-07-18-baidu-tokenplan-seckill-design.md`。

---

## 9. 构建与开发

### 目录结构

```
/
├── entrypoints/
│   ├── ali-capture.content.ts   # 阿里百炼 content script (ISOLATED)
│   ├── background.ts            # Service worker
│   ├── bce-capture.content.ts   # 百度千帆 content script (ISOLATED)
│   ├── bm-capture.content.ts    # bigmodel content script (ISOLATED)
│   ├── bm-early.content.ts      # document_start 抢注 bm-early.js
│   ├── volc-capture.content.ts  # 火山双活动页 content script (ISOLATED)
│   ├── popup/                   # Popup 页面 (Svelte 5)
│   └── options/                 # 选项页 (Svelte 5)
├── lib/
│   ├── api/
│   │   ├── smart-fire-plan.ts   # 智能自动开火计划
│   │   └── strike-plan.ts       # 手动/BURST 加权轮询队列
│   ├── news/
│   │   ├── types.ts           # 新闻数据类型（来自 ai-news-aggregator）
│   │   ├── provider.ts        # NewsProvider 注册表
│   │   ├── providers/gh-pages.ts  # 静态 JSON 数据源
│   │   ├── cache.ts           # stale-while-revalidate 缓存
│   │   ├── bilingual.ts       # 双语阅读（句级/段级粒度）
│   │   ├── links.ts           # 原文/快照链接策略
│   │   ├── read-state.ts      # 已读状态管理
│   │   ├── sanitize.ts        # 快照 HTML 清洗
│   │   └── ui-state.ts        # 列表 UI 状态
│   ├── platform/
│   │   ├── types.ts             # 平台契约（领域模型 + IAuthProbe/IOrderPipeline）
│   │   ├── index.ts             # PLATFORMS 静态入口表 + bigmodelAdapter
│   │   ├── adapters/bigmodel/   # auth-probe / order-pipeline / request
│   │   └── shared/stores/       # createAuthStore（chrome.storage / memory）
│   ├── usage/
│   │   ├── types.ts             # 用量数据类型
│   │   ├── parsers.ts           # 各平台用量解析器
│   │   ├── providers.ts         # 用量数据源（M6 providers）
│   │   └── store.ts             # 用量缓存存储
│   └── settings/
│       ├── sale-time.ts         # 秒杀时间配置 + getNextSaleTime
│       ├── fire.ts              # Fire 发射参数
│       └── captcha.ts           # 验证码批量录入配置
├── src/
│   ├── ali-main/                # 阿里百炼 MAIN world 覆盖层源码
│   ├── bce-main/                # 百度千帆 MAIN world 覆盖层源码
│   ├── bm-main/                 # bigmodel MAIN world 覆盖层源码
│   └── volc-main/               # 火山 MAIN world 覆盖层源码（运行时探测平台）
├── public/
│   ├── ali-main.js              # 生成物（scripts/build-overlay.js）
│   ├── bce-main.js              # 生成物（scripts/build-overlay.js）
│   ├── bm-early.js              # 手写：batch-preview 响应缓存（fetch 包装）
│   ├── bm-main.js               # 生成物（scripts/build-overlay.js）
│   └── volc-main.js             # 生成物（scripts/build-overlay.js）
├── output/chrome-mv3/           # 构建产物（不提交 git）
└── wxt.config.ts                # 扩展配置
```

### 命令

```bash
npm run dev      # 开发模式（HMR，扩展自动重载）
npm run build    # 生产构建 → output/chrome-mv3/
```

### 加载扩展

`chrome://extensions` → 开发者模式 → 加载已解压的扩展 → 选择 `output/chrome-mv3/`

---

## 10. 关键设计决策与原理

### D1：为什么选择 MAIN world + executeScript 而非 background fetch

Background service worker 可以发 `fetch`，但请求的 `origin` 是 `chrome-extension://fmjg...`，bigmodel.cn 服务端会对此 origin 返回 `content-length: 0` 的空 body。

直接在 content script（ISOLATED world）发 `fetch` 同样存在此问题。

唯一能以 `https://bigmodel.cn` 为 origin 发请求的方式，是在该页面的 MAIN world 里执行代码。`chrome.scripting.executeScript` + `world: 'MAIN'` 是标准 MV3 实现方案。

### D2：为什么 bm-main.js 是静态文件而非编译产物

`chrome.scripting.executeScript` 的 `func` 参数虽然可以注入函数，但对于复杂 UI（拖拽覆盖层、商品选择）逻辑，用字面量函数传递不现实。

`bm-main.js` 作为 `web_accessible_resources` 静态文件，通过 `<script>` 标签注入，代码可以自由使用任意 DOM API，不受 `args` 序列化限制。

### D3：为什么 Ticket 池需要 TTL

Tencent CAPTCHA 的 ticket 有效期约 5 分钟（超期返回错误码 8）。如果用户提前预取了 ticket 但秒杀推迟，过期的 ticket 会导致下单失败。TTL 自动淘汰确保池中始终只有有效 ticket。

### D4：为什么 popup 新闻模块选择「静态 JSON 即 API」

AI 聚合新闻由 GitHub Actions 每 2 小时生成静态 JSON，部署在 GitHub Pages：
- 零后端服务器成本，扩展不维护数据源；
- 响应头 `access-control-allow-origin: *`，扩展页 fetch 无 CORS 阻碍；
- 使用 stale-while-revalidate 缓存，popup 打开时先读本地缓存秒开，后台静默刷新。

新闻 UI 与数据获取通过 `NewsProvider` 接口解耦，未来可接入其他数据源而无需重写 UI。
