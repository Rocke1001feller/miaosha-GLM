# 隐私政策

> **智能Coding Plan助手** — Chrome MV3 浏览器扩展
> 最后更新：2026-08-06

本扩展以 **ISC 许可证**开源发布。除「买家秀」中你主动发表的评论等内容会写入集成方自部署的 any-comments Worker（见下文「第三方服务」）外，本项目**不运营任何收集用户数据的后端**：没有分析、没有遥测、没有错误上报、无广告，也不向任何人出售数据。

扩展的四大功能（多平台套餐秒杀、Token 用量监控、买家秀 UGC 社区、AI 聚合新闻）所涉及的凭证、配置与缓存全部保存在你的本机，仅在为提供对应功能时才与相应平台的服务器通信——这与你在浏览器里亲自访问该平台等价。

---

## 本地处理与存储

以下数据只存在于你的设备上（`chrome.storage.local`、页面 `sessionStorage` 或 `IndexedDB`），不会离开本机，除非本节或「第三方服务」一节明确说明：

| 数据 | 用途 | 保留期 |
|------|------|--------|
| 秒杀配置（开售时间、Fire 策略、商品优先级） | 驱动倒计时与自动开火 | 持久，用户可改 |
| 智谱验证码 `ticket` / `randstr` 票池 | 开售时跳过验证码 | 存于页面 sessionStorage，5 分钟过期自动清除 |
| 智谱下单凭证（从 `bigmodel.cn` 页面请求中捕获的请求头） | 以你的会话代为发起下单请求 | 直至清除存储或卸载 |
| 四平台用量缓存（额度百分比、窗口、重置时间） | Popup 用量页展示与本地桥推送 | 持久，随刷新覆盖 |
| Kimi `access_token`（从 kimi.com 标签页 localStorage 读取） | 调用 Kimi 用量接口 | 持久缓存于扩展存储，过期后自动重新捕获 |
| 本地桥配对配置（开关、端口、令牌） | 向本机 macOS 应用推送用量 | 持久，默认关闭 |
| 新闻已读状态与缓存 | 已读标记、离线阅读 | 持久 |
| 买家秀身份（Ed25519 密钥种子、可选昵称） | 评论签名与署名 | 存于 IndexedDB（`any-comments-keystore`），仅本机；私钥不上传 |

---

## 网络请求目的地清单

扩展只与以下域名通信（对应 `manifest` 的 `host_permissions`）。除特别说明外，请求均携带**你自己在该平台的登录会话**，用途与你亲自打开该平台页面相同：

| 域名 | 用途 |
|------|------|
| `*.bigmodel.cn` | 智谱 GLM 秒杀（验证码预取、批次预览、下单）及定价页/文档站买家秀现场层 |
| `*.volcengine.com` | 火山引擎秒杀，及 Agent Plan / Coding Plan 用量接口（`console.volcengine.com`） |
| `*.aliyun.com` | 阿里百炼购买页（`common-buy.aliyun.com`）与下单接口（`buy-api.aliyun.com`，由页面 MAIN world 以同源方式调用） |
| `*.bce.baidu.com` | 百度千帆 Token Plan 用量读取与下单（`console.bce.baidu.com`） |
| `*.minimaxi.com` | MiniMax 用量接口及订阅页/文档站买家秀现场层 |
| `*.kimi.com` | Kimi Code 用量接口（Bearer `access_token`）及定价页/文档站买家秀现场层 |
| `*.xiaomimimo.com` | 小米 MiMo 用量接口及定价页/文档站买家秀现场层 |
| `rocke1001feller.github.io` | AI 聚合新闻静态 JSON（只读 GET，上游每 2 小时发布；不携带任何用户数据） |
| `ai-news.poorhub.store` | 上述新闻源的国内反代（回退链第二级，只读 GET） |
| `xiaocha.online` | 新闻过渡镜像 + 买家秀 API 国内反代（`ac-api.xiaocha.online`） |
| `any-comments-worker.poorhub.workers.dev` | 买家秀 UGC 后端（any-comments Worker），聚合数据拉取与评论写入 |
| `ac-api.poorhub.store` | 买家秀 API 现行反代域 |
| `fonts.googleapis.com` | Popup / Options 界面加载 Google Fonts 字体样式表（仅样式资源，不含业务数据） |
| `http://127.0.0.1` | 本地桥（见下节），仅本机回环 |

扩展**不**联系任何分析/遥测服务、广告网络、远程配置服务器或 AI/LLM API。

---

## 本地桥（127.0.0.1，仅本机）

若你在选项页手动启用「Coding Plan Assistant 桥配对」并粘贴令牌（**默认关闭**），扩展会把四平台用量快照（额度百分比、窗口、重置时间、状态）以 `POST http://127.0.0.1:<端口>/v1/usage`（默认端口 17389，Bearer 令牌鉴权）推送到你本机运行的 macOS 菜单栏应用（本仓 `desktop/`）。推送为基础每 60 秒一次、临近额度重置窗口加速到 30 秒；接收方不在运行时推送静默失败。令牌只存于本机扩展存储，数据不出你的电脑。

---

## 第三方服务：any-comments Worker（买家秀）

买家秀社区由集成方自部署的 [any-comments](https://github.com/Rocke1001feller/any-comments) Cloudflare Worker 驱动（前端为 vendored 进 `public/buyer-show/` 的构建）。Popup 内的买家秀聚合页**只读**拉取聚合数据；写入只发生在各平台定价页/文档站的「现场层」以及你主动操作时。

**你主动发表时写入 Worker 的数据**：

- 评论正文（Markdown）；
- 评分（正负分）与标签（预设标签 + 你自填的自由标签）；
- 被评论页面的标识：规范化页面 URL 的 16 位散列（规范化会剔除 `utm_*`、`fbclid`、`gclid`、`ref` 等追踪参数），以及用于在页面上定位评论位置的文字锚点；
- 客户端时间戳；
- 你的匿名身份：本地生成的 **Ed25519 公钥**（密钥种子只存于本机 IndexedDB，从不上传）；每次写操作附签名；
- 你可选设置的昵称（可随时修改或清空；不设则匿名）；
- 你的点赞、举报等操作。

公开项目的评论先进入待审核状态，通过后对外展示。这些数据对访问同一评论区的其他用户可见——**请勿在评论中填写个人敏感信息或各平台账号凭证**。

---

## Cookie 与令牌的使用

- `cookies` 权限仅用于读取 `minimaxi.com`、`xiaomimimo.com`、`volcengine.com` 域下**你自己已登录的会话 cookie**，供对应用量接口鉴权（与你浏览器自己访问控制台等价）。火山引擎通道通过 `declarativeNetRequest` 动态规则在请求瞬间注入 cookie 与 CSRF 头，请求完成后立即删除该规则。
- 会话过期自愈：当平台会话 cookie 失效时，扩展会自动打开（或刷新已有的）对应平台控制台的后台标签页，让页面自身走 SSO 重新登录；扩展自建的标签页用后自动关闭。
- Kimi Code：通过 `scripting` 在 kimi.com 标签页读取 `localStorage` 中的 `access_token` 并缓存于扩展存储，随后以 Bearer 头调用用量接口；没有打开的 kimi 标签页时会自动开一个后台标签页完成捕获。
- 秒杀下单：智谱凭证从页面请求中捕获后仅存本机；阿里、火山、百度的覆盖层在页面 MAIN world 以同源请求直接携带页面自身会话下单（百度千帆的 `csrftoken` 头取自 `bce-user-info` cookie，现读现用）。
- 上述所有 cookie 与令牌**只发送给它们所属的平台**，不会被发往任何第三方服务器（包括 any-comments Worker 与新闻源）。

---

## 数据共享

- 不出售、不出租任何数据；无广告；无数据经纪人。
- 无分析、无遥测、无崩溃上报、无使用统计回传。
- 唯一会离开本机并对外发布的数据，是你在买家秀中**主动发表**的评论、评分、标签与昵称（见「第三方服务」）。

---

## 用户控制权

- **本地桥默认关闭**：不启用、不配令牌，扩展不会向 127.0.0.1 发送任何数据。
- **昵称可改可清**：买家秀昵称随时可在现场层界面修改或清空，清空后恢复匿名（公钥署名）。
- **卸载即删除**：在 `chrome://extensions` 移除本扩展，Chrome 会一并清除其 `chrome.storage` 数据与 IndexedDB（含秒杀配置、用量缓存、Kimi token 缓存、桥令牌、买家秀密钥与昵称）。页面 sessionStorage 中的票池随标签页关闭即消失。
- **平台凭证由你掌控**：各平台 cookie 由浏览器管理；退出平台登录或清除对应站点数据后，扩展即无法再调用该平台接口。
- 已发表到 any-comments Worker 的评论内容，其修改/删除能力以买家秀界面提供的功能为准。

---

## 儿童隐私

本扩展不面向 13 岁以下儿童，也不会有意识地收集任何用户（含未成年人）的数据。

---

## 政策变更

实质性变更会更新顶部「最后更新」日期并体现在 Git 提交历史中。变更后继续使用本扩展即视为接受更新后的政策。

---

## 联系我们

- **Issues:** https://github.com/Rocke1001feller/coding-plan-assistant/issues
- **Discussions:** https://github.com/Rocke1001feller/coding-plan-assistant/discussions

本扩展与智谱 AI、火山引擎、阿里云、百度智能云、MiniMax、月之暗面（Kimi）、小米**均无隶属或授权关系**。所有商标与服务标记归各自所有者所有。
