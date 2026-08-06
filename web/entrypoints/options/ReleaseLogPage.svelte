<script lang="ts">
  import { version } from '../../package.json';

  interface LogItem {
    category: 'feature' | 'improvement' | 'fix' | 'cleanup';
    title: string;
    body: string;
  }

  const CATEGORIES: Record<LogItem['category'], { label: string; color: string }> = {
    feature:     { label: '新增', color: '#10b981' },
    improvement: { label: '优化', color: '#6366f1' },
    fix:         { label: '修复', color: '#f59e0b' },
    cleanup:     { label: '清理', color: '#64748b' },
  };

  const LOGS: LogItem[] = [
    {
      category: 'feature',
      title: 'P0 智能开火策略（smart-fire-plan）',
      body: '开火改由纯函数状态机驱动：每场 preview 预算 8 发、串行间隔 ≥2100ms、555/soldout 不消耗 ticket 可复用、收到 WAF 405 立即停火。首发时机为服务器时刻 T-0 前 10ms，或 batch-preview 侦测到 soldOut 翻转的瞬间，先到先得。',
    },
    {
      category: 'feature',
      title: '库存观察员（06-stock-watch）',
      body: 'T-90s 起以 4.3s 周期在 MAIN world 轮询 batch-preview：用响应 Date 头估算本地与服务器时钟差、侦测所选商品 soldOut 翻转并触发提前开火；同时预取 customerNumber 供支付直连使用。',
    },
    {
      category: 'feature',
      title: 'P3 ALI 支付直连收银台',
      body: 'preview 成功拿到 bizId 后，payType=ALI 时在 MAIN world 直接调用 /api/biz/pay/create-sign 拿收银台 URL，chrome.tabs.create 新标签打开，跳过官方桌面端的二维码弹窗。create-sign 失败或 WE_CHAT 时回退原生弹窗扫码。',
    },
    {
      category: 'improvement',
      title: '开火请求指纹与官方页面完全一致',
      body: 'preview / create-sign 统一经 PAGE_FETCH_REQUEST 中继，在 MAIN world 用页面 window.fetch 发送；preview 请求体补上 invitationCode 字段，与官方四字段对齐。',
    },
    {
      category: 'cleanup',
      title: '删除 BURST 并发模式',
      body: '200ms 并发齐射在 2 秒滑动窗口下限流必吃 555，且快速烧穿 preview 的 WAF 预算（约 15 发即 405 封锁 30-60 分钟）。已移除 BURST 按钮、fire-plan.ts 及全部并发调度代码。',
    },
    {
      category: 'improvement',
      title: 'Strike Interval 下限锁定 2100ms',
      body: 'fireStore、Options 与页面浮层三处统一 clamp ≥2100ms，间隔配置重新接入开火状态机；低于 2 秒的设置不再可能把票浪费在 555 上。',
    },
    {
      category: 'fix',
      title: 'stock-watch 消息频道接线修复',
      body: '修复 06-stock-watch 监听错误消息频道导致轮询不启动的问题（SALE_TIME_CONFIG 走 __miaosha_overlay 频道），时钟校准与翻转侦测恢复可用。',
    },
    {
      category: 'cleanup',
      title: 'Options 文档页事实校对',
      body: '使用说明、软件架构、关键洞察、更新日志四页全部按当前代码重写，删除 Mode/BURST/错峰配比等已不存在功能的描述，补齐 WAF 405、票核销时机、时钟校准等实测事实。',
    },
    {
      category: 'feature',
      title: '火山引擎覆盖层登录态守卫与一键登录',
      body: '未登录时「开始刷新库存」按钮变为「请先登录」，点击后直接触发页面登录弹窗或跳转登录页；刷新过程中如果登录态失效会自动停止，避免无意义空转。',
    },
    {
      category: 'feature',
      title: '火山引擎动态定价与订单索引自愈',
      body: '价格改为实时调用 calculatePriceV5 获取；解析 bundle 时收集同一 (ConfigurationCode, Duration) 的所有候选 IndexKey，遇到 InvalidParameter.Configuration 自动重试下一个索引。',
    },
    {
      category: 'improvement',
      title: '测试基线：15 个文件 112 例全绿',
      body: '新增 smart-fire-plan 状态机 14 个用例（首发时机、预算耗尽、405 停火、票复用、翻转触发等），并在重构过程中持续更新测试期望。',
    },
  ];

  const STATS = [
    { label: '单测用例', value: '112' },
    { label: '每场 preview 预算', value: '8 发' },
    { label: '最小发射间隔', value: '2100ms' },
    { label: 'Options 文档页', value: '4' },
  ];
</script>

<div class="page-stack">
  <section class="section-card">
    <div class="section-heading">
      <span class="accent-bar" style="background: linear-gradient(180deg, var(--primary), var(--violet)); box-shadow: 0 0 14px rgba(16,185,129,0.35);"></span>
      <h3>v{version} 更新日志</h3>
    </div>
    <p class="section-note">
      本次主线：<strong>P0 开火策略重写</strong>（低预算、串行、翻转触发、时钟校准）与 <strong>P3 支付链直连</strong>（ALI 跳过二维码弹窗直达收银台），并清理了 BURST 并发模式与过时文档。
    </p>

    <div class="stats-row">
      {#each STATS as stat}
        <div class="stat-card">
          <span class="stat-value">{stat.value}</span>
          <span class="stat-label">{stat.label}</span>
        </div>
      {/each}
    </div>
  </section>

  <section class="section-card">
    <div class="section-heading">
      <span class="accent-bar" style="background: var(--amber); box-shadow: 0 0 14px rgba(245,158,11,0.35);"></span>
      <h3>变更详情</h3>
    </div>

    <ol class="log-list">
      {#each LOGS as log}
        <li class="log-item">
          <span class="log-badge" style="background: {CATEGORIES[log.category].color}20; color: {CATEGORIES[log.category].color}; border-color: {CATEGORIES[log.category].color}30;">
            {CATEGORIES[log.category].label}
          </span>
          <div class="log-content">
            <h4>{log.title}</h4>
            <p>{log.body}</p>
          </div>
        </li>
      {/each}
    </ol>
  </section>
</div>

<style>
  .page-stack { display: flex; flex-direction: column; gap: 24px; }

  .section-card {
    background: linear-gradient(135deg, rgba(255,255,255,0.72) 0%, rgba(255,255,255,0.24) 100%);
    border: 1px solid var(--panel-border);
    border-top-color: rgba(255,255,255,0.88);
    border-left-color: rgba(255,255,255,0.88);
    box-shadow: var(--card-shadow);
    border-radius: var(--radius-xl);
    padding: 28px 30px;
    position: relative;
    overflow: hidden;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
  }
  @media (prefers-color-scheme: dark) {
    .section-card {
      background: linear-gradient(135deg, rgba(30,41,59,0.78) 0%, rgba(15,23,42,0.52) 100%);
      border-top-color: rgba(255,255,255,0.12);
      border-left-color: rgba(255,255,255,0.12);
    }
  }

  .section-heading { display: flex; align-items: center; gap: 12px; margin: 0 0 8px; position: relative; z-index: 1; }
  .accent-bar { width: 6px; height: 26px; border-radius: 999px; background: var(--primary); box-shadow: 0 0 14px rgba(16,185,129,0.35); flex: 0 0 auto; }
  .section-heading h3 { margin: 0; font-size: 1.1rem; font-weight: 800; color: var(--text-strong); letter-spacing: -0.02em; }
  .section-note { margin: 0 0 24px 18px; color: var(--text-muted); font-size: 13px; line-height: 1.6; position: relative; z-index: 1; }
  .section-note code {
    font-family: 'SF Mono', Monaco, Consolas, monospace;
    font-size: 11px;
    padding: 2px 6px;
    border-radius: 6px;
    background: rgba(99,102,241,0.1);
    color: var(--violet);
  }
  .section-note strong { color: var(--text-strong); }

  .stats-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 14px;
    margin-top: 8px;
  }
  .stat-card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 16px;
    border-radius: 16px;
    background: rgba(255,255,255,0.5);
    border: 1px solid var(--panel-border-soft);
  }
  @media (prefers-color-scheme: dark) {
    .stat-card { background: rgba(15,23,42,0.42); }
  }
  .stat-value { font-size: 26px; font-weight: 800; color: var(--primary-strong); }
  .stat-label { font-size: 11px; color: var(--text-muted); font-weight: 600; }

  .log-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .log-item {
    display: flex;
    gap: 14px;
    align-items: flex-start;
    padding: 16px;
    border-radius: 16px;
    background: rgba(255,255,255,0.42);
    border: 1px solid var(--panel-border-soft);
  }
  @media (prefers-color-scheme: dark) {
    .log-item { background: rgba(15,23,42,0.32); }
  }
  .log-badge {
    flex-shrink: 0;
    font-size: 10px;
    font-weight: 800;
    padding: 4px 10px;
    border-radius: 999px;
    border: 1px solid;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .log-content { display: flex; flex-direction: column; gap: 6px; }
  .log-content h4 { margin: 0; font-size: 14px; font-weight: 800; color: var(--text-strong); }
  .log-content p { margin: 0; font-size: 12px; line-height: 1.65; color: var(--text-muted); }
</style>
