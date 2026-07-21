# 阿里百炼 Coding Plan 抢购（第三平台）设计文档

**日期**: 2026-07-17
**状态**: 设计已确认，待实现
**作者**: 与用户协作设计（brainstorming → 实证抓包 → 设计确认）

---

## 1. 背景与目标

扩展已支持智谱（bigmodel.cn，bm-main 重火力模式）与火山引擎（volcengine.com，volc-main 轻量模式）两个平台的 Coding Plan 抢购。阿里百炼 Coding Plan（popup 中当前为"敬请期待"卡片）是第三个平台：

- 购买页: `https://common-buy.aliyun.com/coding-plan`（阿里云统一购买页，React SPA）
- 商品: 仅 Pro 高级套餐 ¥200/月，单账号限 1 个活跃订阅，仅月付，不可退款
- 限售机制: **每日 09:30:00 (UTC+8) 放库存，先到先得**，售完按钮变为"暂时售罄，MM月DD日 09:30 补货"

目标：在购买页注入 MAIN world overlay，实现**库存轮询 → 补货倒计时 → 到点自动下单（createOrder）→ 引导用户手动支付**的完整抢购链路。

### 范围

- ✅ 本期：`src/ali-main/` overlay、content script 注入、manifest 权限、popup 入口卡片、background 成功角标、单元测试
- ❌ 本期不做：per-platform 开售时间配置（background 闹钟/通知/badge 接入百炼 09:30）；支付自动化（createOrder 之后的付款动作由用户手动完成）

---

## 2. 实证协议摘要（2026-07-17 抓包 + bundle 静态分析）

> 原始证据存于 `.tmp/bailian/`（gitignored，含敏感值）；以下为脱敏后的协议事实。

**API base**: `https://buy-api.aliyun.com`（跨子域，`credentials:"include"` cookie 鉴权）
**商品码**: `sfm_codingplan_public_cn`；SKU: `subscription_type=pro`，时长 1 个月，数量 1

| 端点 | 方法 | 用途 | 关键响应 |
|---|---|---|---|
| `/commodity/getCommodity.json` | GET | 商品组件描述 | 单 SKU 确认（pro/1 Month/1） |
| `/order/buildSecurityParam.json` | POST | 取 `data.submitref`（下单令牌） | body: `{commodityCode, skuId:"pro"}` |
| `/commodity/checkInventoryDetail.json` | POST | **库存真相** | `data:[{inventoryNum, restockingTimeStamp, success, buyAmount}]` |
| `/price/getPrice.json` | POST | 价格/售罄态 | 售罄: `{code:"OutOfStock", standardErrorCode:"B6000000571", message:"今日已售罄，明日9:30补货"}` |
| `/getCsrfToken.json` | GET | CSRF token（批量 createOrders 路径用） | `data` string |
| `/order/createOrder.json` | POST | **创建订单** | `data:{orderId, payStatus, elementSession}` |
| `/common/getUserLoginInfo.json` | GET | 登录态 | — |

**createOrder 请求体**（bundle 内 `pe()` 函数已完整还原）= `{configuration: {...页面标准 configuration 对象, orderIndex: 0}, couponNum, umidToken, collina, channel:"commonbuy", "bx-umidtoken":umidToken, submitref, linkage}` + 可选 `pid/paymentType`；请求头带 **`X-XSRF-TOKEN`**（每次下单前 `GET /getCsrfToken.json` 现取）。`linkage` 算法已还原：对 `JSON.stringify({itemId:[commodityCode]})` 逐字符取 charCode 转 hex 拼接（bundle 内 `le(de(ue))` 函数链），为常量可离线复算。`autoRenew` 字段区分连续包月/单月（页面加载默认请求体中为 `false`）。

**风控要素**（全部可在 MAIN world 直接获取，已实测）:
- `umidToken` = `window.getUmidToken()` ✔
- `collina` = `window.getUA()` ✔
- `submitref` = buildSecurityParam 接口返回 ✔
- `cna` = `document.cookie` 中的 `cna` ✔
- 读接口（checkInventoryDetail/getPrice/buildSecurityParam）请求头无 CSRF token；**写接口 createOrder 必须带 `X-XSRF-TOKEN` 头**（值取自 `GET /getCsrfToken.json` 的 `data`，每次下单现取）
- 页面挂载 AWSC 全家桶（collina/fireye/baxia/et）+ `free.aliyun.com/smarter-engine` 验证码 iframe → **下单瞬间可能触发滑块**（未实测，需兜底）

**库存语义**:
- `inventoryNum > 0` 且条目 `success:true` → 可买
- `restockingTimeStamp` = 下次补货绝对时间戳（实测 `1784338200000` = 2026-07-18 09:30:00 UTC+8）
- **M6 重放已验证**: MAIN world 裸 fetch + `credentials:'include'` 调 checkInventoryDetail 成功（http 200, code "200"），无需 background/ISOLATED 代理，无需 bm-early 式抢注脚本
- 响应无 `Date` header → 时钟对齐以 `restockingTimeStamp` + `performance.now()` 为锚

**下单后流转**（bundle 静态分析）:
- `payStatus==="success"` → 3s 后跳控制台 `bailian.console.aliyun.com/?tab=coding-plan#/efm/coding-plan-detail`
- `elementSession` → 页面内嵌收银组件
- 错误码例: `ORDER.INST_HAS_UNPAID_ORDER`（存在未支付订单 → 视为已抢到）

---

## 3. 架构设计

### 3.1 总体形态（volc 式自包含 overlay）

```
common-buy.aliyun.com/coding-plan tab
┌────────────────────────────────────────────────┐
│ ali-main.js (MAIN world, <script> 注入)          │
│  00-config → 10-shared → 20-api → 30-stock      │
│           → 40-ui → 50-fire                     │
│        │ 直接 fetch buy-api（页面同等能力）        │
│        │ window.postMessage(__ali_cmd)           │
├──────────┼─────────────────────────────────────┤
│ ali-capture.content.ts (ISOLATED, ~40行)          │
│  注入 overlay；转发 ALI_PURCHASE_SUCCESS ─────────┼──► background.ts（绿 OK badge）
└────────────────────────────────────────────────┘
```

### 3.2 overlay 模块（`src/ali-main/`，构建脚本自动打包为 `public/ali-main.js`）

| 文件 | 职责 |
|---|---|
| `00-config.js` | 常量（commodityCode、skuId、API base、轮询/火力参数默认值）；读 `document.currentScript.dataset.version` |
| `10-shared.js` | `postCmd`（`__ali_cmd` envelope）、cookie 工具（cna）、蜂鸣器、时钟锚定（restockingTimeStamp + performance.now） |
| `20-api.js` | 协议层：`getCommodity` / `buildSecurityParam` / `checkInventory` / `getPrice` / `createOrder`；token 获取器 `getUmidToken()` / `getUA()`（脚本未就绪时重试）；统一 `credentials:'include'` |
| `30-stock.js` | 库存轮询循环 + 状态机：`SOLD_OUT → ARMED(T-60s) → FIRING → SUCCESS / FAIL` |
| `40-ui.js` | overlay UI（以 volc overlay 为风格基准）：双商品卡（单月购买/连续包月两种商品，默认选中单月购买，映射 autoRenew 字段）、库存灯、到点自动开火开关（默认勾选）、开火/停止合并单按钮（volc 式大红按钮，文案"开始刷新库存"/FIRING 时"停止刷新库存"）、覆盖式单条状态行（不保留滚动日志）、结果横幅、登录态提示。不显示倒计时——restockingTimeStamp 仅内部驱动 ARMED/FIRING |
| `50-fire.js` | 开火引擎：刷新 submitref → createOrder 循环（默认 300ms 间隔、最大尝试上限，均可调）+ 错误分类 |

**单 SKU 简化**：无商品矩阵、无 tab 分组、无多选——UI 比 bm/volc 都小。

### 3.3 开火时序

```
注入 → getCommodity + checkInventory
售罄   → restockingTimeStamp 内部锚定（无倒计时显示），低频轮询（2s）
T-60s  → ARMED：升频轮询（500ms），预刷 submitref / umidToken / collina
T-0    → FIRING：直接 createOrder 循环（不等库存接口二次确认）
成功 或 ORDER.INST_HAS_UNPAID_ORDER
       → 停手：蜂鸣 ×3 + postCmd(ALI_PURCHASE_SUCCESS) + 支付引导横幅（跳控制台/订单中心）
```

手动模式：用户点"立即抢"即进入同一 FIRING 流程（不等倒计时）。

### 3.4 错误处理与风控兜底

| 情况 | 判定 | 动作 |
|---|---|---|
| 售罄 | `OutOfStock` / `B6000000571` / inventoryNum=0 | 继续循环至窗口结束 |
| 已有未支付订单 | `ORDER.INST_HAS_UNPAID_ORDER` | 停手，视为抢到，引导支付 |
| 登录失效 | 401 / 跳登录 / code 特定值 | 停手，提示重新登录 |
| 滑块/风控 | 非预期 JSON / 403 / 风控 code | **立即停手**，高亮提示用户手动点页面原生按钮 |
| 网络瞬断 | TypeError / 5xx | 指数退避 ×3 |
| 限流 | 429 / 特定 code | 退避并降频 |

- 火力上限：最大尝试次数 + 间隔下限（默认 300ms），防无谓限流
- 阶段标签日志：`[STOCK_FAIL]` / `[FIRE_FAIL]` / `[PAY_FAIL]`（沿用 four-phase 可观测性约定）
- 安全边界：createOrder 仅创建待支付订单，**绝不自动支付**；`ORDER.INST_HAS_UNPAID_ORDER` 语义防止重复下单

### 3.5 注册点改动清单

| # | 文件 | 改动 |
|---|---|---|
| 1 | `src/ali-main/*.js` | 新建（6 模块）→ `pnpm build:overlay` 产出 `public/ali-main.js`（生成物入库） |
| 2 | `entrypoints/ali-capture.content.ts` | 新建：matches `*://common-buy.aliyun.com/coding-plan*`，注入 overlay（`script.dataset.version`），转发 `ALI_PURCHASE_SUCCESS` |
| 3 | `wxt.config.ts` | `host_permissions` 加 `*://*.aliyun.com/*`；`web_accessible_resources` 加 `{resources:['ali-main.js'], matches:['*://*.aliyun.com/*']}`；description 补阿里百炼 |
| 4 | `lib/platform/index.ts` | `PLATFORMS` 加 `{id:'bailian-codingplan', displayName:'阿里百炼 Coding Plan', hostPatterns:['*://common-buy.aliyun.com/*'], entryUrl:'https://common-buy.aliyun.com/coding-plan'}` |
| 5 | `entrypoints/popup/components/PlatformEntryGrid.svelte` | 删除 `upcoming` 静态卡（含 locked markup），`ENTRY_NOTES['bailian-codingplan']` 文案保留给正式条目；新条目渲染为与火山对齐的紧凑卡（小"进入"按钮），仅 bigmodel 保留 hero 大卡（`hero: true` 标记）；各卡片展示开售时间（bigmodel 读 `saleTimeStore` 动态配置，火山"不定时释放库存"，百炼"每日 09:30 (UTC+8) 开售"） |
| 6 | `entrypoints/background.ts` | 加 `ALI_PURCHASE_SUCCESS` 消息分支（绿 OK badge + 30min TTL，照 volc 模式） |
| 7 | `tests/unit/ali-main/` | 新建 `_harness.ts` + 单测 |
| 8 | `docs/architecture.md` | 补第三平台小节（目录结构、消息协议表） |

### 3.6 测试策略

- `tests/unit/ali-main/_harness.ts`：复用 `createVmHarness`（vm 沙箱加载 `src/ali-main/*.js`）
- fixtures（脱敏，源自今日真实抓包）：
  - `checkInventoryDetail` 售罄态（inventoryNum=0 + restockingTimeStamp）
  - `getPrice` OutOfStock 态
  - `buildSecurityParam` 成功态
- 单测覆盖：
  1. 库存解析：`inventoryNum>0 && success` 判定、restockingTimeStamp 提取
  2. 状态机迁移：SOLD_OUT→ARMED→FIRING→SUCCESS/FAIL 边界
  3. createOrder body 组装：token 注入（umidToken/collina/submitref/bx-umidtoken）、autoRenew 切换
  4. 错误分类：OutOfStock / INST_HAS_UNPAID_ORDER / 风控 / 限流 / 网络瞬断
- 构建回归：`pnpm build`（build:overlay → wxt build → verify-no-minifier-collision）
- 实战验证（手动）：下个 09:30 窗口真实放货时端到端验证（不在本期代码任务内，但作为验收标准记录）

---

## 4. 风险与未知项

| 风险 | 缓解 |
|---|---|
| createOrder 瞬间触发滑块/人机验证（smarter-engine 已挂载，未实测） | 检测到风控特征立即停手 + 提示手动；首日实战前无法完全排除 |
| 高频 createOrder 触发限流 | 默认 300ms 间隔 + 退避降频 + 尝试上限 |
| `restockingTimeStamp` 与真实放货时刻有偏差 | 以接口值为准（非本地配置）；T-0 后即便库存接口未翻转也直接 createOrder 试单 |
| `window.getUmidToken/getUA` 在脚本未就绪时不可用 | 就绪重试（最多 10×500ms，照 volc 启动模式）；失败则禁止开火并提示刷新页面 |
| 阿里云改版导致 API 变化 | 协议层集中在 `20-api.js`，fixtures 锁定当前响应形状，测试可快速发现漂移 |

---

## 5. 决策记录

| 决策 | 选项 | 结论 |
|---|---|---|
| 调研方式 | 实证抓包 / 纯文档 | **实证抓包（停在预览层，不创建订单）** — patched MCP 附着已登录 Chrome |
| 下单自动化 | 全自动 / 半自动 / 纯 UI 点击 | **自动 createOrder + 手动支付**（与智谱/火山一致） |
| 本期范围 | 含 background 提醒改造 / 仅 overlay | **仅 overlay + popup 入口**；restockingTimeStamp 自驱动，不动全局 saleTimeConfig |
| 架构形态 | volc 式自包含 / bm 式桥接 / 渐进 MVP | **volc 式自包含 overlay**（MAIN world 裸 fetch 已实证，无桥接必要） |
