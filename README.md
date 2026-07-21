# 智能Coding Plan助手

> **智能 Coding Plan 助手** — Chrome MV3 浏览器扩展：多平台 Coding Plan 秒杀抢购 + 买家秀 UGC 社区 + Token 用量监控 + AI 聚合新闻，一站式覆盖 AI 编程套餐的「抢、看、评、读」。

**当前版本：v2.0.0**（前身「智谱秒杀助手」）。秒杀网站的防护策略持续升级，成功率动态变化，欢迎社区贡献代码、反馈问题、分享经验。

---

## 免责声明

- 本项目仅供学习交流，不保证每次都能抢到。成功率受网络环境、服务器防护、验证码策略等多重因素影响。
- 各平台防护机制会不定期更新，某些版本的扩展可能在某个时间点失效。**请自行 fork 本仓库，根据实际情况调整策略。**
- 如果你找到了更优的方案，**欢迎提交 PR**，让更多人受益。

---

## 功能总览

### 一、多平台套餐秒杀（覆盖层 Overlay）

四大平台各自适配专属 Overlay UI，注入在对应购买页上：

| 平台 | 页面 | 覆盖层要点 |
|------|------|-----------|
| 智谱 GLM | `bigmodel.cn/glm-coding` | 验证码预取票池、NTP 校时、L1 顶栏信息条、智能开火（首枪偏移 + 错峰抖动 + 动态退避）、Fire Matrix 可视化、商品优先级与动态切换 |
| 火山引擎 | `console.volcengine.com/ark/.../activity/codingplan` 与 `agentplan` | 双活动页共用覆盖层、登录态守卫、Wave 轮询 |
| 阿里百炼 | `common-buy.aliyun.com/coding-plan` | 批次预览拦截、MAIN world 直连下单 |
| 百度千帆 | `console.bce.baidu.com/qianfan/resource/token-plan` | Token Plan 购买覆盖层 |

共同机制：MAIN world 注入绕过 CORS（平台服务端拒绝 `chrome-extension://` origin 的请求）、ISOLATED 内容脚本做 Fire 调度与存储桥、系统通知 + 角标倒计时（T-60/30/15/10/5 五段提醒）。

### 二、Token 用量监控（Popup 默认页）

打开 popup 即见四个平台的订阅用量，不用逐个登录控制台：

- **MiniMax**：5 小时窗口 + 周限额
- **Kimi Code**：5 小时窗口 + 周限额
- **小米 MiMo**：Token Plan 用量
- **火山引擎**：Agent Plan / Coding Plan 双订阅（近 5 小时 / 近一周 / 近一月三窗口）

### 三、买家秀 UGC 社区

由自部署的 [any-comments](https://github.com/Rocke1001feller/any-comments) Worker 驱动，匿名写入、Ed25519 签名：

- **Popup 聚合页**：四厂商买家秀大卡轮播，只读聚合，无需注册
- **营销页 / 文档站现场层**：在小米 MiMo、MiniMax、智谱、Kimi 的定价页与文档站内嵌「评分 · 标签 · 评论」覆盖层，随写随刷新
- 数据存在集成方自部署的 Worker 里，两个入口（站点页 / 扩展）共享同一套评论区

### 四、AI 聚合新闻

读取 ai-news-aggregator 每 2 小时发布的静态 JSON：平台筛选、搜索、无限滚动、NEW/已读标记、卡片摘要（中文优先）、全文快照阅读页（双语·句 / 双语·段 / 中文 / EN 四态）。

### 五、拼团转让（敬请期待）

拼团套餐转让 / 闲置交易，飞书群试运营中（Popup → 拼团转让 扫码加群）。

---

## 中国大陆网络可达设计

`*.workers.dev` 与 `*.github.io` 在大陆不可直连，本项目通过自运维的 Nginx 反代（`xiaocha.online`）做了全链路分流：

| 流量 | 默认路径 | 国内可达路径 |
|------|---------|-------------|
| AI 新闻 JSON | `rocke1001feller.github.io/ai-news` | 失败自动回退 `xiaocha.online/ai-news`（字节级一致、带缓存） |
| 买家秀 API | `any-comments-worker.poorhub.workers.dev` | `ac-api.xiaocha.online`（扩展 CN 构建默认走反代） |
| 买家秀站点页 | `coding-plan.poorhub.workers.dev` | `plan.xiaocha.online` |

秒杀覆盖层直连各平台国内站点，本身不依赖境外域名。

---

## 安装

### 方式一：下载预编译包（推荐）

1. 下载 zip：[miaosha-glm-2.0.0-chrome.zip](https://github.com/Rocke1001feller/miaosha-GLM/releases/download/v2.0.0/miaosha-glm-2.0.0-chrome.zip)
2. 解压（macOS 双击；Windows 右键「全部解压缩」；Linux `unzip miaosha-glm-2.0.0-chrome.zip`）
3. 打开 `chrome://extensions`，开启右上角「开发者模式」
4. 点击「加载已解压的扩展程序」，选择解压后的文件夹

### 方式二：从源码构建

```bash
git clone https://github.com/Rocke1001feller/miaosha-GLM.git
cd miaosha-GLM
pnpm install
pnpm build        # 产物在 output/chrome-mv3/
```

---

## 使用

**秒杀**：打开目标平台购买页并登录 → 覆盖层自动出现 → 配置秒杀时间与目标商品 → 扩展自动预取凭证、校准时钟 → 到点自动开火（或手动「开火」）。

**Token 用量**：点扩展图标，默认即用量页；数据来自各平台控制台会话，会话过期时按提示打开对应控制台页面即可恢复。

**买家秀**：Popup → 买家秀 看聚合评分墙；浏览各平台定价页 / 文档页时，页面右下角会出现评分挂件，可直接写评论。

**AI 新闻**：Popup → AI 新闻，点卡片进阅读页看双语全文快照。

---

## 项目结构

```
├── entrypoints/
│   ├── background.ts            # Service Worker：通知 + 角标倒计时 + 用量桥
│   ├── bm-capture.content.ts    # 智谱 ISOLATED 捕获/Fire 调度（另有 volc/ali/bce 三平台 capture）
│   ├── bm-early.content.ts      # 智谱早期注入引导
│   ├── popup/                   # Popup（Svelte 5）：AI 新闻 / Token 用量 / 秒杀 / 买家秀 / 拼团转让
│   ├── options/                 # 选项页（Svelte 5）：通用 / 使用 / 架构 / 洞察 / 更新日志
│   └── reader/                  # 新闻全文快照阅读页
├── lib/
│   ├── api/                     # Fire 计划（票分配 + 自动开火）、Auth 存储
│   ├── news/                    # 新闻 provider（gh-pages + 国内镜像回退）、双语、阅读状态
│   ├── platform/                # 四平台秒杀适配器（拦截 / 下单管线）
│   ├── settings/                # 秒杀时间、验证码、Fire 策略配置
│   └── usage/                   # 四平台用量 provider 与解析器
├── src/                         # 四平台 MAIN world 覆盖层源码（bm/volc/ali/bce-main）
├── public/                      # 构建产物：覆盖层 IIFE + buyer-show（vendored any-comments popup/field）
├── scripts/                     # overlay 构建、zip 打包、压缩器碰撞校验
├── tests/                       # 单元 / 组件测试（Vitest）
└── docs/                        # 架构文档、测试指南
```

---

## 开发

```bash
pnpm dev          # 开发模式（HMR，扩展自动重载）
pnpm build        # 生产构建（overlay + wxt + 压缩器碰撞校验）
pnpm test         # 全部测试（单元 + 组件）
pnpm zip          # 构建并打包 output/miaosha-glm-<version>-chrome.zip
```

测试分 5 层：纯逻辑 → 存储层 → MAIN world JS → Svelte 组件 → Chrome API 集成，详见 `docs/testing.md`。

---

## 贡献

欢迎任何形式的贡献：适配平台新防护策略、优化开火时序与并发、接入新平台、修复 bug、补充测试与文档。

流程：Fork → 特性分支 → `pnpm test` 与 `pnpm build` 全绿 → PR。问题反馈请走 Issues，附浏览器版本、扩展版本、复现步骤与控制台报错截图。

---

## 技术栈

| 技术 | 用途 |
|------|------|
| [WXT](https://wxt.dev) 0.20.x | Chrome MV3 扩展框架 |
| [Svelte](https://svelte.dev) 5.x | Popup / Options / Reader UI |
| [Vitest](https://vitest.dev) 4.x | 测试框架 |
| TypeScript +  vanilla JS（MAIN world） | 类型安全 + 零依赖注入脚本 |
| [any-comments](https://github.com/Rocke1001feller/any-comments)（Cloudflare Worker + D1） | 买家秀 UGC 后端 |

---

## 相关文档

- [架构与原理](docs/architecture.md) — 整体架构、核心机制、设计决策
- [测试指南](docs/testing.md) — 测试分层、工具链、扩展测试套件
- [隐私政策](PRIVACY.md) — 数据收集与权限说明

---

## 社区交流

扫码加入 **飞书用户交流群**：

<p align="center">
  <img src="docs/feishu-community-qr.png" alt="飞书用户交流群二维码" width="220" />
</p>

- 🚀 **秒杀前**：确认配置、分享当天策略、查看最新防护应对
- 🛠 **遇到问题**：覆盖层失效、票池异常、用量不刷新时实时求助
- 💡 **想贡献代码**：先同步方案思路，避免重复造轮子
- 📢 **获取更新**：新版本发布、重大防护变更群里先通知

> 群内讨论与 GitHub Issues 互补 — 简单/即时问题优先群里反馈，bug 报告与功能建议请走 Issues 以便追踪。

---

## 许可证

ISC
