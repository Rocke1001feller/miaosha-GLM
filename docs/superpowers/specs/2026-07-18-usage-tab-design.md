# Popup 用量 Tab（四平台套餐用量）设计文档

**日期**: 2026-07-18
**状态**: 设计已确认，待实现
**数据流路线**: M6（带 cookie/凭证的 API 重放，零页面依赖）——用户指定

---

## 1. 背景与目标

popup 底部新增"秒杀 | 用量"tab 栏，用量视图聚合展示用户四个平台的套餐用量：

| 平台 | 展示内容（实证字段） |
|---|---|
| MiniMax（platform.minimaxi.com/console/usage） | 5h 限额 % + 重置倒计时；周限额 % + 重置倒计时（general 模型） |
| Kimi（www.kimi.com/code/console） | 频限明细(5h) % + 重置倒计时；本周用量 % + 重置倒计时 |
| 小米 MiMo（platform.xiaomimimo.com/console/plan-manage） | 套餐用量 used/limit %；月用量 %；套餐名 + 有效期 |
| 火山引擎（console.volcengine.com） | Agent Plan：近5小时/近一周/近一月 AFP 用量；Coding Plan：订阅状态（当前为已回收） |

### 范围

- ✅ 本期：`lib/usage/`（types/parsers/store/providers）、background `USAGE_FETCH` 刷新分支、popup 底部 tab 栏 + UsageView（4 卡三态）、kimi token 捕获缓存、单元/组件测试
- ❌ 本期不做：alarms 定时自动刷新、用量历史图表、更多平台、用量超阈值告警

---

## 2. 实证协议摘要（2026-07-18 WebBridge + MCP 验证，全部真实重放通过）

### MiniMax
- `GET https://www.minimaxi.com/backend/account/token_plan/remains_percent`，**扩展上下文 `credentials:'include'` 直发即可（200）**
- 响应 `model_remains[]`（取 `model_name==='general'`）：
  - 5h：`current_interval_used_percent`（"0%" 字符串）、`end_time`（ms）、`remains_time`（ms）
  - 周：`current_weekly_used_percent`（"4%"）、`weekly_end_time`（ms）

### Kimi
- `POST https://www.kimi.com/apiv2/kimi.gateway.membership.v2.MembershipService/GetSubscriptionStats`，body `{}`，**必须 `Authorization: Bearer <localStorage access_token>`**（cookie 无效）
- token 捕获：kimi.com 页面打开时 executeScript 读 `localStorage.access_token`（563 字符 JWT）→ 缓存 `local:kimiAccessToken`，此后扩展上下文直接重放（200，实测 ratio 与页面一致）
- 响应：`ratelimitCode5h {ratio, resetTime}`、`ratelimitCode7d {ratio, resetTime}`、`subscriptionBalance {amountUsedRatio, expireTime}`

### 小米 MiMo
- `GET /api/v1/tokenPlan/usage` 与 `GET /api/v1/tokenPlan/detail`（同源 cookie），**扩展上下文直发即可（200）**
- usage：`usage {percent, items:[{name, used, limit, percent}]}`、`monthUsage {percent, items}`
- detail：`planName`、`currentPeriodEnd`、`expired`

### 火山引擎
- `POST https://console.volcengine.com/api/top/ark/cn-beijing/2024-01-01/GetAgentPlanAFPUsage` + `GetCodingPlanUsage`
- **关键约束（实证）**：火山会话 cookie 是 HttpOnly + CHIPS 分区（`__sptiho/digest` 等），fetch/XHR 手动 `Cookie` 头会被浏览器丢弃 → 必须 **`declarativeNetRequest` 动态规则注入头部**：
  - `chrome.cookies.getAll({url, partitionKey:{topLevelSite:'https://console.volcengine.com'}})` 读分区 cookie + 普通 cookie → 拼 Cookie 串
  - DNR rule（id 9101）：对 `||console.volcengine.com/api/top/ark/` 注入 `Cookie` + `x-csrf-token`（csrfToken cookie）
  - 实测 200，字段与页面一致
- AFP 响应：`PlanType`（small）、`AFPFiveHour/AFPWeekly/AFPMonthly/AFPDaily {Quota, Used, SubscribeTime, ResetTime}`（ResetTime=-1 表示无重置）
- Coding Plan：`GetCodingPlanUsage → {Status:'Reclaimed', UpdateTimestamp}`（已回收=无活跃订阅）

### 已落地的 manifest 变更（调研期完成）
- `host_permissions` + `*://*.minimaxi.com/*`、`*://*.kimi.com/*`、`*://*.xiaomimimo.com/*`
- `permissions` + `cookies`、`declarativeNetRequest`

---

## 3. 架构设计

### 3.1 数据流

```
popup 打开（view=usage）
  → 读 local:usageCache 立即渲染（每卡带 fetchedAt 时间戳）
  → 发 USAGE_FETCH 给 background
  → background 并发执行 4 个 provider（各自 try/catch 降级为错误卡）
  → 写 local:usageCache
  → popup storage.onChanged 监听 → 更新 UI
手动刷新按钮 → 同一 USAGE_FETCH 流程
```

### 3.2 模块划分

| 文件 | 职责 |
|---|---|
| `lib/usage/types.ts` | `UsageBar {label, percent(0-1), usedText?, resetAt?}`、`UsageCardData {platform, planName?, status, bars, note?, fetchedAt}`、`UsageCache` |
| `lib/usage/parsers.ts` | 4 个纯函数：`parseMinimax` / `parseKimi` / `parseMimo(usage, detail)` / `parseVolc(afp, coding)`；以及 `buildVolcDnrRule(cookieHeader, csrf)` |
| `lib/usage/store.ts` | `usageCacheStore`（`local:usageCache` 读写）、`kimiTokenStore`（`local:kimiAccessToken` 读写） |
| `lib/usage/providers.ts` | 4 个 async provider（background 上下文）：`fetchMinimax` / `fetchMimo` / `fetchKimi` / `fetchVolc`，各自捕获异常 → `status:'error'` 卡片；kimi 401 时先尝试从打开的 kimi.com tab executeScript 捕获 token 重试一次 |
| `entrypoints/background.ts` | `USAGE_FETCH` 消息分支：并发 providers → 写缓存 → sendResponse |
| `entrypoints/popup/components/UsageView.svelte` | 4 卡渲染（三态：ok 数据条 / needs_login / no_subscription / error）+ 刷新按钮 + 时间戳 + 点击卡片打开对应控制台 |
| `entrypoints/popup/components/Footer.svelte` | 底部 `秒杀 | 用量` tab 按钮（齿轮与版本号不动） |
| `entrypoints/popup/App.svelte` | `view` 状态（默认 seckill），PROD 下切换 PlatformEntryGrid / UsageView |

### 3.3 卡片数据与展示映射

- **percent**：统一 0-1，渲染为进度条 + `xx.x%`
- **resetAt**：ms 时间戳，渲染"N 小时/天 后重置"；缺失则不显示倒计时
- **usedText**：原始数字文本（如 `8,162,846,607 / 49,200,000,000`），有则显示
- **status**：`ok` 正常；`needs_login`（401/未捕获到 token）显示"未登录 · 打开控制台"；`no_subscription`（火山 Coding Plan Reclaimed）显示"未订阅"；`error` 显示错误摘要
- **错误兜底**：任何 provider 异常只影响自己的卡，不阻塞其他卡

### 3.4 测试策略

- `tests/unit/usage/parsers.test.ts`：4 平台今日真实响应（脱敏）→ bars/percent/resetAt/planName/边界（MiniMax percent 字符串解析、火山 ResetTime=-1、MiMo 无 resetAt、Kimi ratio 小数值）
- `tests/unit/usage/dnr-rule.test.ts`：`buildVolcDnrRule` 形状
- `tests/unit/usage/store.test.ts`：fakeBrowser 下 usageCache/kimiToken 读写
- `tests/component/popup/UsageView.svelte.test.ts`：ok / needs_login / error 三态渲染 + 刷新按钮 + 时间戳
- 全量回归 `pnpm test` + `pnpm build`

---

## 4. 风险与未知项

| 风险 | 缓解 |
|---|---|
| kimi access_token 过期且 kimi.com 未打开 → 无法取数 | 卡片降级 `needs_login`（"打开一次 Kimi 控制台"），用户开一次即自动重捕 |
| 火山会话 cookie 轮换/登出 → 401 | 卡片降级 `needs_login`；cookie 每次现取 |
| MiniMax/MiMo 未来加 WAF origin 校验（bigmodel 前科） | 卡片降级 error；届时降级为 executeScript 页面代理（模式已存在） |
| DNR 规则残留影响其他请求 | 规则精确匹配 `api/top/ark/` 前缀；每次刷新覆写同 id 规则 |

## 5. 决策记录

| 决策 | 结论 |
|---|---|
| 数据流 | **M6 重放**（用户指定）：MiniMax/MiMo 直发，Kimi 缓存 Bearer，火山 DNR 注入 |
| 刷新触发 | popup 打开（view=usage）+ 手动刷新按钮；不做定时刷新 |
| 入口形态 | 底部 `秒杀 | 用量` tab 栏（用户指定位置），齿轮/版本号不动 |
| 火山 Coding Plan | 展示订阅状态（当前 Reclaimed → "未订阅"），不展示用量条 |
