<script lang="ts">
  const TRIGGER_ROWS = [
    { name: 'Auto', meaning: '自动开火', behavior: '按 Options 设置的秒杀时间，在服务器时刻 T-0 前 10ms 触发；本地与服务器时钟差由 batch-preview 响应的 Date 头实时校准。' },
    { name: 'Stock Flip', meaning: '翻转触发', behavior: 'T-90s 起每 4.3s 轮询 batch-preview，一旦所选商品 soldOut 从 true 翻为 false，立即开枪，不等倒计时。' },
    { name: 'Manual', meaning: '手动开火', behavior: '点击 FIRE 串行立即按同一策略开打，用于补枪或测试。' },
  ];

  const FIELD_ROWS = [
    { field: 'Strike Interval', desc: '串行发射的最小间隔，下限 2100ms，默认 2100ms。' },
    { field: 'Pay', desc: 'create-sign 的支付方式：ALI 直连收银台；WE_CHAT 走原生弹窗二维码。' },
    { field: 'FIRE 串行 (n)', desc: 'n 为当前有效票数；为 0 时按钮禁用。' },
    { field: 'Auth: pending', desc: '授权头状态；登录并刷新页面后变绿。' },
    { field: 'Auto: waiting…', desc: 'Auto 倒计时 / 开火结果 / 停火原因。' },
    { field: 'Budget', desc: '每场 preview 预算 8 发，打满即停（WAF 自保），遇 405 立即停火。' },
  ];

  const ERROR_ROWS = [
    { outcome: '成功', code: '200 + bizId', subject: '智谱', target: '插件', cause: '锁单成功，返回 bizId', note: 'ALI 直连收银台新标签打开；WE_CHAT 弹原生二维码。' },
    { outcome: '售罄', code: '200 sold-out', subject: '智谱', target: '插件', cause: '库存门未放行', note: '不核销票，状态机按间隔继续补枪。' },
    { outcome: '限流', code: '555', subject: '智谱', target: '当前用户', cause: '2 秒滑动窗口限流（阈值=1）', note: '不核销票；保持间隔 ≥2100ms 即可避免。' },
    { outcome: 'WAF 封锁', code: 'HTTP 405', subject: '智谱 WAF', target: '当前用户', cause: 'preview 累计发送过多（约 15 发）', note: '立即停火；封锁持续 30-60 分钟。' },
    { outcome: '验证码繁忙', code: '500', subject: '智谱', target: '腾讯验证码核销', cause: '超过《每秒并发请求量（QPS）限制》', note: '秒杀瞬间腾讯云核销拥堵，非插件 bug。' },
    { outcome: '验证码失效', code: '500', subject: '插件/用户', target: '腾讯验证码核销', cause: 'ticket 无效或已过期', note: '票 TTL 300 秒，换最新票重试。' },
    { outcome: '验证码风控', code: '500', subject: '腾讯验证码风控', target: '当前请求', cause: '环境存在安全风险', note: '刷新页面或更换浏览器环境。' },
    { outcome: '网络错误', code: '0 / network', subject: '插件/网络', target: '智谱', cause: '请求未到达服务端或连接超时', note: '检查网络后重试。' },
    { outcome: '错误', code: '其他 500', subject: '智谱/网络', target: '插件', cause: '未知服务端错误', note: '查看 raw serverMsg 并反馈。' },
  ];

  const FLOW = [
    {
      phase: 'Preload',
      title: '准备阶段',
      items: [
        '录入验证码 ticket，写入当前 tab 的 sessionStorage（__bm_tickets），每张 300 秒有效，最新优先。',
        'Target Products 最多选 3 个商品，顺序即优先级 P1 / P2 / P3。',
        '06-stock-watch 预取 customerNumber（create-sign 需要），并从 T-90s 起轮询 batch-preview 估算时钟偏差、侦测 soldOut 翻转。',
      ],
    },
    {
      phase: 'Strike',
      title: '开火阶段',
      items: [
        'smart-fire-plan 状态机驱动：首发在服务器 T-0 前 10ms，或 batch-preview 侦测到翻转的瞬间，先到先得。',
        '之后按 Strike Interval 串行补枪；555 / soldout 不核销票，下枪可复用同一张 ticket。',
        '每场 preview 预算 8 发封顶；收到 HTTP 405（WAF）立即全局停火，避免 30-60 分钟封锁。',
      ],
    },
    {
      phase: 'Commit',
      title: '锁单 + 支付阶段',
      items: [
        'preview 成功拿到 bizId → ALI：MAIN world 直接调 /api/biz/pay/create-sign，拿收银台 URL 用 chrome.tabs.create 新标签打开。',
        'create-sign 失败或 WE_CHAT：回退到官方原生支付弹窗，扫码完成支付。',
        '同时 pollPayCheck() 以 1.5s 间隔轮询 /api/biz/pay/check?bizId=，最多 5 分钟，同步支付成功 / 过期 / 超时状态。',
      ],
    },
  ];
</script>

<div class="page-stack">
  <section class="section-card">
    <div class="section-heading">
      <span class="accent-bar" style="background: linear-gradient(180deg, var(--violet), var(--primary)); box-shadow: 0 0 14px rgba(99,102,241,0.35);"></span>
      <h3>使用说明</h3>
    </div>
    <p class="section-note">开火由三种触发方式驱动，策略只有一个：低预算、串行、翻转优先。支付走 create-sign 直连（ALI）或原生二维码（WE_CHAT）。</p>

    <div class="usage-panel">
      <!-- Trigger -->
      <div class="doc-hero">
        <span class="doc-badge">PART A</span>
        <h4>三种触发方式</h4>
        <p>无论哪种触发，进入的都是同一个 smart-fire-plan 状态机。</p>
      </div>
      <div class="usage-table-wrap">
        <table class="usage-table">
          <thead>
            <tr><th>触发</th><th>含义</th><th>行为</th></tr>
          </thead>
          <tbody>
            {#each TRIGGER_ROWS as row}
              <tr><td class="u-name">{row.name}</td><td class="u-meaning">{row.meaning}</td><td class="u-desc">{row.behavior}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Strike Interval -->
      <div class="doc-hero doc-hero-secondary">
        <span class="doc-badge">PART B</span>
        <h4>Strike Interval：唯一节奏旋钮</h4>
        <p>智谱 preview 端点为约 2 秒滑动窗口限流（阈值=1）：间隔 &lt;2s 必 555，≥2100ms 稳定 0% 555。下限已锁定 2100ms；网络抖动大或 RTT 偏高时建议 2300ms 以上。</p>
      </div>

      <!-- Flow -->
      <div class="doc-hero">
        <span class="doc-badge">PART C</span>
        <h4>完整链路：Preload → Strike → Commit</h4>
      </div>
      <div class="flow-list">
        {#each FLOW as step}
          <article class="flow-card">
            <div class="flow-phase">{step.phase}</div>
            <div class="flow-content">
              <h5>{step.title}</h5>
              <ul>
                {#each step.items as item}
                  <li>{item}</li>
                {/each}
              </ul>
            </div>
          </article>
        {/each}
      </div>

      <!-- UI fields -->
      <div class="doc-hero">
        <span class="doc-badge">PART D</span>
        <h4>UI 各字段含义</h4>
      </div>
      <div class="usage-table-wrap">
        <table class="usage-table">
          <thead>
            <tr><th style="width:140px">字段</th><th>说明</th></tr>
          </thead>
          <tbody>
            {#each FIELD_ROWS as row}
              <tr><td class="u-name">{row.field}</td><td class="u-desc">{row.desc}</td></tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Error codes -->
      <div class="doc-hero doc-hero-secondary">
        <span class="doc-badge">PART E</span>
        <h4>Fire Matrix 结果与责任主体</h4>
        <p>每个结果都标明【责任主体 --&gt; 被调用方：原因】，方便判断是插件问题、网络问题，还是智谱/腾讯侧服务繁忙。</p>
      </div>
      <div class="usage-table-wrap">
        <table class="usage-table">
          <thead>
            <tr><th>结果</th><th>HTTP/code</th><th>责任链路</th><th>说明</th></tr>
          </thead>
          <tbody>
            {#each ERROR_ROWS as row}
              <tr>
                <td class="u-name">{row.outcome}</td>
                <td class="u-meaning">{row.code}</td>
                <td class="u-desc">【{row.subject} --&gt; {row.target}：{row.cause}】</td>
                <td class="u-desc">{row.note}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <div class="usage-summary">
        <strong>一句话总结：</strong>票管弹药（300s TTL，555/soldout 不核销），预算管安全（每场 ≤8 发、405 即停），翻转管时机（batch-preview 侦测 + 服务器时钟校准），create-sign 管支付（ALI 直连、WE_CHAT 二维码）。
      </div>
    </div>
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
  .section-card::before {
    content: '';
    position: absolute;
    inset: -80px auto auto -80px;
    width: 200px; height: 200px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(16,185,129,0.09), transparent 68%);
    pointer-events: none;
  }

  .section-heading { display: flex; align-items: center; gap: 12px; margin: 0 0 8px; position: relative; z-index: 1; }
  .accent-bar { width: 6px; height: 26px; border-radius: 999px; background: var(--primary); box-shadow: 0 0 14px rgba(16,185,129,0.35); flex: 0 0 auto; }
  .section-heading h3 { margin: 0; font-size: 1.1rem; font-weight: 800; color: var(--text-strong); letter-spacing: -0.02em; }
  .section-note { margin: 0 0 24px 18px; color: var(--text-muted); font-size: 13px; line-height: 1.6; position: relative; z-index: 1; }

  .usage-panel { display: flex; flex-direction: column; gap: 20px; position: relative; z-index: 1; }

  .doc-hero { padding: 22px 24px; border-radius: 22px; border: 1px solid rgba(99,102,241,0.18); background: linear-gradient(135deg, rgba(99,102,241,0.12), rgba(16,185,129,0.08)); }
  .doc-hero-secondary { border-color: rgba(16,185,129,0.18); background: linear-gradient(135deg, rgba(16,185,129,0.12), rgba(14,165,233,0.08)); }
  .doc-badge { display: inline-flex; align-self: flex-start; padding: 4px 10px; border-radius: 999px; background: rgba(255,255,255,0.58); border: 1px solid rgba(255,255,255,0.72); color: var(--violet); font-size: 10px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; }
  .doc-hero h4 { margin: 10px 0 8px; font-size: 1.35rem; font-weight: 800; color: var(--text-strong); letter-spacing: -0.03em; }
  .doc-hero p { margin: 0; color: var(--text-main); font-size: 14px; line-height: 1.7; }

  .usage-table-wrap { overflow-x: auto; border-radius: 18px; border: 1px solid var(--panel-border-soft); background: rgba(255,255,255,0.35); }
  @media (prefers-color-scheme: dark) { .usage-table-wrap { background: rgba(15,23,42,0.35); } }
  .usage-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .usage-table th { text-align: left; padding: 12px 16px; font-weight: 800; color: var(--text-strong); background: rgba(255,255,255,0.25); border-bottom: 1px solid var(--panel-border-soft); }
  @media (prefers-color-scheme: dark) { .usage-table th { background: rgba(15,23,42,0.25); } }
  .usage-table td { padding: 12px 16px; border-bottom: 1px solid rgba(188,200,214,0.12); vertical-align: top; line-height: 1.6; color: var(--text-main); }
  .usage-table tr:last-child td { border-bottom: 0; }
  .u-name { font-weight: 800; color: var(--text-strong); white-space: nowrap; font-family: 'SF Mono', monospace; font-size: 12px; }
  .u-meaning { font-weight: 700; color: var(--violet); white-space: nowrap; }
  .u-desc { color: var(--text-muted); }

  .flow-list { display: flex; flex-direction: column; gap: 14px; }
  .flow-card { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: 16px; padding: 18px 20px; border-radius: 20px; border: 1px solid var(--panel-border-soft); background: rgba(255,255,255,0.4); box-shadow: 0 12px 28px rgba(118,136,158,0.1); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
  @media (prefers-color-scheme: dark) { .flow-card { background: rgba(15,23,42,0.42); } }
  .flow-phase { display: inline-flex; align-items: center; justify-content: center; min-height: 42px; padding: 8px 12px; border-radius: 14px; background: linear-gradient(135deg, rgba(99,102,241,0.16), rgba(14,165,233,0.12)); color: var(--violet); font-size: 12px; font-weight: 800; letter-spacing: 0.12em; }
  .flow-content { display: flex; flex-direction: column; gap: 10px; }
  .flow-content h5 { margin: 0; color: var(--text-strong); font-weight: 800; letter-spacing: -0.02em; font-size: 1rem; }
  .flow-content ul { margin: 0; padding-left: 18px; display: flex; flex-direction: column; gap: 6px; color: var(--text-muted); font-size: 13px; line-height: 1.7; }

  .usage-summary { padding: 18px 20px; border-radius: 18px; border: 1px solid rgba(16,185,129,0.2); background: linear-gradient(135deg, rgba(16,185,129,0.1), rgba(99,102,241,0.06)); color: var(--text-main); font-size: 14px; line-height: 1.7; }
  .usage-summary strong { color: var(--text-strong); }

  @media (max-width: 960px) {
    .flow-card { grid-template-columns: 1fr; }
    .flow-phase { justify-self: start; min-width: 92px; }
  }
</style>
