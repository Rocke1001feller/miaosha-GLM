# 百度千帆 Token Plan 抢购（第四平台）设计文档

**日期**: 2026-07-18
**状态**: 设计已确认，待实现
**前置**: 与阿里百炼平台（`2026-07-17-bailian-codingplan-seckill-design.md`）同构的 overlay 架构

---

## 1. 背景与目标

- 购买页: `https://console.bce.baidu.com/qianfan/resource/token-plan`（百度智能云千帆控制台 SPA，微前端 `aip-static.cdn.bcebos.com/mb-static/resource/`）
- 商品: Token Plan 个人版四档——Mini ¥4.9/月、Lite ¥19.9/月、Pro ¥99.9/月、Max ¥299.9/月（均为首购活动价）；单月购买/连续包月两种模式（autoRenew）
- 限售机制: 部分档位"暂时售罄"（实测 Lite/Pro 售罄、Mini/Max 可购），**每日 10:00 (UTC+8) 补货**（接口 `times:["10:00"]`）

目标：在购买页注入 MAIN world overlay，实现"库存轮询 → 补货窗口升频 → 翻转/到点自动下单 → 引导手动支付"。

### 范围

- ✅ 本期：`src/bce-main/` overlay、content script 注入、manifest 权限、popup 入口卡片（含开售时间）、background 成功角标、单元测试
- ❌ 本期不做：支付自动化；background 提醒体系接入

---

## 2. 实证协议摘要（2026-07-18 抓包 + bundle 静态分析 + 签名矩阵验证）

**API 形态**: 控制台统一前缀 `/api/qianfan/`，读接口 GET、写接口 POST，均 `credentials:'include'` cookie 鉴权

| 端点 | 方法 | 用途 | 关键响应 |
|---|---|---|---|
| `/api/qianfan/charge/tokenPlanPersonal/firstPurchaseConfig` | GET | **库存真相 + 开售时间** | `{items:[{planType,campaignName}], available:{mini,lite,pro,max}, times:["10:00"]}` |
| `/api/price/v3/order` | POST | 定价 | 每档 `{price, catalogPrice, skuId, priceName}` |
| `/api/qianfan/charge/order/new` | POST | **创建订单** | 成功 → orderId → 跳收银台 |
| `/api/qianfan/charge/tokenPlanPersonal/resource` | GET | 用户已购资源（空=未购） | — |

**库存语义**: `available[planType]: boolean` 翻转即为补货（实测 `{mini:true, lite:false, pro:false, max:true}` 与页面售罄标记一致）。`times:["10:00"]` 为每日开售时刻（本地时间语义）。

**下单请求体**（bundle 还原）:
```json
{
  "serviceType": "WENXINFACTORY",
  "productType": "tokenPlanPersonal",
  "autoRenew": false,
  "items": [{ "config": { "planType": "lite" } }]
}
```
`planType ∈ {mini, lite, pro, max}`；`autoRenew` 区分连续包月/单月。

**风控（签名矩阵已实证）**:
- **写接口必须带 `csrftoken` 请求头**，值 = cookie `bce-user-info`（URL 解码 + 去引号，形如 `2026-07-18T03:16:27Z|<32位hex>`）
- 不带 → `{success:false, message:"登录凭证已过期，请重新登录"}`；带 → 200 成功
- cookie 值会轮换 → 每次请求现取，不缓存
- 读接口（GET）无需签名（实测裸 fetch 成功）
- `x-bce-jt` 头存在但实测非必需

**下单后流转**: 拿 orderId → `window.location.href = /finance/pay?serviceType=WENXINFACTORY&fromService=CODE_PLAN&orderType=NEW&orderId=<id>`（收银台，手动支付）。购买前有欠费/资格校验（`verifyRedeemUserEligibility`）。

**错误响应形态**（2026-07-18 实战实证）: 失败时 `message` 可能是字符串，也可能是 `{global:<数字业务码>}` 且人类文案在 `message_raw` 字段；已确认 `global:4004` = "有未支付的同类订单"（服务端幂等：重复下单被拒，应视为已抢到并引导支付既有订单）。注意 `tokenPlanPersonal/resource` 只返回已生效订阅，**未支付订单不可见于该接口**。分类器必须同时解析 `message` 与 `message_raw`。

---

## 3. 架构设计

### 3.1 形态（与百炼同构的 volc/ali 混合骨架）

```
console.bce.baidu.com/qianfan/resource/token-plan tab
┌────────────────────────────────────────────────┐
│ bce-main.js (MAIN world, <script> 注入)          │
│  00-config → 10-shared → 20-api → 30-stock      │
│           → 40-ui → 50-fire → 60-boot           │
│        │ 直接 fetch /api/qianfan（页面同等能力）   │
│        │ window.postMessage(__bce_cmd)           │
├──────────┼─────────────────────────────────────┤
│ bce-capture.content.ts (ISOLATED, ~35行)          │
│  注入 overlay；转发 BCE_PURCHASE_SUCCESS ─────────┼──► background.ts（绿 OK badge）
└────────────────────────────────────────────────┘
```

### 3.2 overlay 模块（`src/bce-main/`，构建脚本自动打包）

| 文件 | 职责 |
|---|---|
| `00-config.js` | `BCE_VERSION`、`BCE_CONFIG`：四档商品定义（planType/name/价格文案）、轮询参数（2s/500ms/提前 5min 升频）、火力参数（间隔/上限/最多 3 选） |
| `10-shared.js` | `bce_postCmd`（`__bce_cmd`）、cookie 工具、`bce_readCsrf`（bce-user-info → csrftoken）、蜂鸣器、`bce_nextArmedMs`（times → 下次升窗时刻，纯函数） |
| `20-api.js` | `bce_checkStock`（GET firstPurchaseConfig）、`bce_createOrder`（POST order/new + csrftoken 头）；纯函数 `bce_parseStock` / `bce_buildOrderBody` / `bce_classifyOrderResult` |
| `30-stock.js` | `bceState` + 日志/阶段核心 + 轮询状态机：SOLD_OUT(2s) → ARMED(500ms，开售窗口) → IN_STOCK/FIRING → SUCCESS/FAIL |
| `40-ui.js` | volc/ali 式 UI：四档商品卡多选（默认 Lite+Pro，最多 3）、单月/连续包月切换、到点自动开火（默认开）、"开始刷新库存"合并大按钮、覆盖式状态行、结果横幅、登录态 |
| `50-fire.js` | 开火引擎：按勾选优先级逐档 createOrder 循环 + 错误分类；成功 → 拼 `/finance/pay` URL 引导 |
| `60-boot.js` | 启动编排：建 UI → 首轮库存轮询 |

### 3.3 开火时序

```
注入 → 首轮 firstPurchaseConfig
常态   → 低频轮询（2s）
开售窗口（每日 10:00 前 5min 起）→ ARMED：升频 500ms
任一勾选档 available 翻转 → FIRING：按优先级逐档 createOrder
成功（或检出已有订单语义）→ 停手：蜂鸣 ×3 + postCmd + 收银台引导（手动支付）
```

手动模式：点"开始刷新库存"即进入同一 FIRING 流程；再点停止。

### 3.4 错误处理与风控兜底

| 情况 | 判定 | 动作 |
|---|---|---|
| 售罄 | message 含 售罄/库存/抢光/售完/无货 | 换下一勾选档，循环结束后继续轮询 |
| 凭证过期 | message 含 登录凭证已过期 / 重新登录 | 停手，提示重新登录 |
| 已有未支付订单 | message 含 未支付/待支付 | 停手，视为抢到，引导收银台 |
| 限流 | HTTP 429 | 指数退避降频 |
| 网络瞬断 | fetch throw | `{kind:'network'}` 退避重试 |
| 未知响应 | 其他 | **立即停手**，提示改点页面原生订阅按钮（DOM 兜底语义） |

- 火力上限：最大尝试次数 + 间隔下限（默认 800ms），对付费端点保持克制
- 阶段标签日志：`[STOCK_FAIL]` / `[FIRE_FAIL]`；覆盖式单条状态行
- 安全边界：只创建待支付订单，绝不自动支付；异常一律停手交人工

### 3.5 注册点改动清单

| # | 文件 | 改动 |
|---|---|---|
| 1 | `src/bce-main/*.js` | 新建（7 模块）→ `pnpm build:overlay` 产出 `public/bce-main.js` |
| 2 | `entrypoints/bce-capture.content.ts` | 新建：matches `*://console.bce.baidu.com/qianfan/resource/token-plan*`，注入 + 转发 `BCE_PURCHASE_SUCCESS` |
| 3 | `wxt.config.ts` | `host_permissions` 加 `*://*.bce.baidu.com/*`；`web_accessible_resources` 加 `{resources:['bce-main.js'], matches:['*://*.bce.baidu.com/*']}`；description 补百度千帆 |
| 4 | `lib/platform/index.ts` | `PLATFORMS` 加 `{id:'baidu-tokenplan', displayName:'百度千帆 Token Plan', hostPatterns:['*://*.bce.baidu.com/*'], entryUrl:'https://console.bce.baidu.com/qianfan/resource/token-plan'}` |
| 5 | `entrypoints/popup/components/PlatformEntryGrid.svelte` | `ENTRY_NOTES['baidu-tokenplan']`、`SALE_TIMES['baidu-tokenplan']='每日 10:00 (UTC+8) 开售'`（自动渲染紧凑卡） |
| 6 | `entrypoints/background.ts` | `BCE_PURCHASE_SUCCESS` 分支（绿 OK badge + 30min TTL） |
| 7 | `tests/unit/bce-main/` | 新建 `_harness.ts` + 单测 |
| 8 | `docs/architecture.md` | 补第四平台条目 |

### 3.6 测试策略

- vm 沙箱 harness（复用 `createVmHarness`），fixtures 用今日真实抓包脱敏值
- 单测：`bce_parseStock`（available/times 解析、畸形输入）、`bce_buildOrderBody`（planType/autoRenew/items 形状）、`bce_classifyOrderResult`（成功 orderId/凭证过期/售罄/429/500/未知）、`bce_readCsrf`（cookie 解码/去引号/缺失）、`bce_nextArmedMs`（窗口前/窗口中/隔日）、`bce_nextPhase`（状态迁移）、开火循环（stub createOrder：成功/停手/耗尽）、`bce_fireButtonLabel`、`BCE_CONFIG.products`（4 档 + 默认勾选 Lite+Pro）
- 构建回归：`pnpm build`（overlay + wxt + minifier 守卫）
- 实战验证：每日 10:00 窗口端到端（记录为验收标准，不属本期代码任务）

---

## 4. 风险与未知项

| 风险 | 缓解 |
|---|---|
| `order/new`（写接口）除 csrftoken 外可能还要 `x-bce-jt`（定价接口实测不需要，下单未验证——不能白试，会真下单） | 未知响应一律立即停手 + 提示点原生按钮；首验窗口观察后迭代 |
| 售罄时的确切错误码/文案未知（分类器靠文案匹配） | 匹配不到则落 unknown → 停手（安全方向），不会误重试 |
| `times` 时区语义（按本地时间处理，用户在国内） | 窗口放宽（前 5min + 后 30min），翻转驱动为主、到点为辅 |
| 单账号限购语义（四档可否并存、重复下单报错形态） | 未支付/已购文案检出即停手；创建订单本身不产生扣款 |
| 电平触发开火：勾选当前可购档（如 Mini/Max）+ autoFire 开 → 下轮轮询（≤2s）即真实下单（仅未支付订单，可放弃） | 与 ali/volc 语义一致（打开页面=想买）的设计决策；验证/演示时保持默认勾选售罄档，勿勾选可购档 |

## 5. 决策记录

| 决策 | 结论 |
|---|---|
| 目标商品 | 四档商品卡多选（最多 3），**默认勾选 Lite+Pro**（当前售罄档） |
| 下单自动化 | 自动 createOrder + 手动支付（与前两平台一致） |
| 架构形态 | volc/ali 混合骨架自包含 overlay（MAIN world 直发，无桥接） |
| 风控 | csrftoken 头每次现取（cookie 会轮换）；x-bce-jt 实测非必需 |
| 本期范围 | 仅 overlay + popup 入口 + badge，不动全局提醒体系 |
