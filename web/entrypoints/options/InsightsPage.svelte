<script lang="ts">
  const EXPERIMENTS = [
    {
      interval: '400 ms',
      busy: '未测（推断 >90%）',
      soldout: '—',
      note: '远低于滑动窗口，绝大多数请求被限流。',
      highlight: false,
    },
    {
      interval: '2000 ms',
      busy: '9 / 20（45%）',
      soldout: '11 / 20（55%）',
      note: '间隔等于窗口大小，约一半请求因抖动落入同一窗口被限。',
      highlight: false,
    },
    {
      interval: '2100 ms',
      busy: '0 / 20（0%）',
      soldout: '20 / 20（100%）',
      note: '实测最优：略大于 2 秒窗口，100% 避开 555。',
      highlight: true,
    },
    {
      interval: '3000 ms',
      busy: '0 / 20（0%）',
      soldout: '20 / 20（100%）',
      note: '同样 0% 555，但每秒只有 0.33 请求，浪费 33% 可用窗口。',
      highlight: false,
    },
  ];

  const INSIGHTS = [
    {
      title: 'preview 限流：2 秒滑动窗口，阈值 1',
      detail: '判定依据是「过去约 2 秒内同一用户是否已发出过 1 次 preview」。555 的平均 RTT（~177ms）明显低于 soldout（~215ms），说明 555 在网关层就被返回，没走到库存查询。',
    },
    {
      title: 'preview WAF：累计约 15 发即 405 封锁',
      detail: '两次实测：preview 累计 ~15 发（不分成功/失败）后收到 HTTP 405，封锁持续 30-60 分钟。这是每场预算封顶 8 发、遇 405 立即停火的原因。',
    },
    {
      title: '票的生命周期：300s TTL，售出才核销',
      detail: '腾讯验证码 ticket 300 秒过期；soldOut / 555 响应不会核销票，只有库存门放行时才核销。所以票可以复用，新鲜度远比数量重要。',
    },
    {
      title: 'batch-preview 是独立的限流桶',
      detail: 'batch-preview 与 preview 分桶（约 1 次接受 / 4s，2.2s 间隔呈 200/555 棋盘格），且 preview 桶不按商品细分。因此用 batch-preview 做库存探针零 preview 成本。',
    },
    {
      title: '本地时钟比服务器快 ~343ms',
      detail: '用 batch-preview 响应的 Date 头 + RTT/2 估算偏差（秒级精度，±0.5s）。自动开火按服务器时刻 T-0 前 10ms 触发，而不是本地时刻。',
    },
    {
      title: '结构性优势：官方页面不会自己重试',
      detail: '官方页面 10:00 后不自动刷新，preview 失败也不重试。手动用户发现补货必然晚于我们的定时开火 + 翻转侦测。支付不是瓶颈——订单创建后有 30 分钟支付窗口，稀缺的只有建单瞬间。',
    },
  ];

  const RECOMMENDATIONS = [
    {
      title: '首选配置',
      items: [
        '触发：Auto（自动开火）',
        'Strike Interval：2100 ms',
        'Pay：ALI（直连收银台）',
      ],
    },
    {
      title: '开火纪律',
      items: [
        '第一枪没有滑动窗口包袱，务必让它携带最新鲜的 ticket——开售前 5 分钟内录入最有效。',
        '不要在开售前手动点 FIRE，浪费首枪优势。',
        '一场打完就停：预算 8 发封顶，继续乱打只会触发 405 封锁 30-60 分钟。',
      ],
    },
    {
      title: '避免的错误',
      items: [
        '不要用 <2000ms 间隔，必吃 555。',
        '不要指望多商品并发绕过限流：限流按用户维度计算，不同商品同时请求互相触发 555。',
        '票不在多而在新鲜：300 秒 TTL，提前 10 分钟录的票到点已过期。',
      ],
    },
  ];
</script>

<div class="page-stack">
  <section class="section-card">
    <div class="section-heading">
      <span class="accent-bar" style="background: linear-gradient(180deg, var(--violet), var(--primary)); box-shadow: 0 0 14px rgba(99,102,241,0.35);"></span>
      <h3>关键洞察</h3>
    </div>
    <p class="section-note">
      全部来自真实浏览器实验：限流窗口、WAF 封锁线、票核销时机、时钟偏差。策略的每一条规则都对应这里的一个事实。
    </p>

    <div class="insights-panel">
      <!-- Algorithm -->
      <div class="doc-hero">
        <span class="doc-badge">ALGORITHM</span>
        <h4>两道闸门：限流 555 与 WAF 405</h4>
        <p>
          第一道是业务限流：2 秒滑动窗口，阈值 1，间隔 ≥2100ms 可稳定绕过。
          第二道是 WAF：preview 累计约 15 发直接 <code>HTTP 405</code> 封锁 30-60 分钟。
          策略因此是「慢而少」：串行、≥2100ms、每场 ≤8 发。
        </p>
      </div>

      <!-- Experiment table -->
      <div class="doc-hero doc-hero-secondary">
        <span class="doc-badge">EXPERIMENTS</span>
        <h4>四组间隔实验对比</h4>
        <p>单用户串行 preview、同一商品、20 张有效 ticket 实测。</p>
      </div>
      <div class="usage-table-wrap">
        <table class="usage-table">
          <thead>
            <tr>
              <th>间隔</th>
              <th>555 / 限流</th>
              <th>200 soldout</th>
              <th>结论</th>
            </tr>
          </thead>
          <tbody>
            {#each EXPERIMENTS as row}
              <tr class:highlight={row.highlight}>
                <td class="u-name">{row.interval}</td>
                <td class="u-meaning">{row.busy}</td>
                <td class="u-meaning">{row.soldout}</td>
                <td class="u-desc">{row.note}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>

      <!-- Insights -->
      <div class="doc-hero">
        <span class="doc-badge">INSIGHTS</span>
        <h4>我们掌握了什么</h4>
      </div>
      <div class="insights-grid">
        {#each INSIGHTS as item}
          <article class="insight-card">
            <h5>{item.title}</h5>
            <p>{item.detail}</p>
          </article>
        {/each}
      </div>

      <!-- Recommendations -->
      <div class="doc-hero doc-hero-secondary">
        <span class="doc-badge">RECOMMENDATIONS</span>
        <h4>单用户最优实践</h4>
      </div>
      <div class="recommendation-list">
        {#each RECOMMENDATIONS as rec}
          <article class="recommendation-card">
            <h5>{rec.title}</h5>
            <ul>
              {#each rec.items as item}
                <li>{item}</li>
              {/each}
            </ul>
          </article>
        {/each}
      </div>

      <div class="usage-summary">
        <strong>一句话总结：</strong>单用户的物理上限是「每 2 秒 1 发、全场约 15 发」。赢面不在火力密度，而在时机（服务器 T-0 前 10ms + 翻转侦测）与纪律（串行、预算、405 即停、create-sign 直连）。
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

  .insights-panel { display: flex; flex-direction: column; gap: 20px; position: relative; z-index: 1; }

  .doc-hero { padding: 22px 24px; border-radius: 22px; border: 1px solid rgba(99,102,241,0.18); background: linear-gradient(135deg, rgba(99,102,241,0.12), rgba(16,185,129,0.08)); }
  .doc-hero-secondary { border-color: rgba(16,185,129,0.18); background: linear-gradient(135deg, rgba(16,185,129,0.12), rgba(14,165,233,0.08)); }
  .doc-badge { display: inline-flex; align-self: flex-start; padding: 4px 10px; border-radius: 999px; background: rgba(255,255,255,0.58); border: 1px solid rgba(255,255,255,0.72); color: var(--violet); font-size: 10px; font-weight: 800; letter-spacing: 0.14em; text-transform: uppercase; }
  .doc-hero h4 { margin: 10px 0 8px; font-size: 1.35rem; font-weight: 800; color: var(--text-strong); letter-spacing: -0.03em; }
  .doc-hero p { margin: 0; color: var(--text-main); font-size: 14px; line-height: 1.7; }
  .doc-hero code {
    font-family: 'SF Mono', monospace;
    font-size: 12px;
    padding: 2px 6px;
    border-radius: 6px;
    background: rgba(15,23,42,0.08);
    color: var(--text-strong);
  }

  .usage-table-wrap { overflow-x: auto; border-radius: 18px; border: 1px solid var(--panel-border-soft); background: rgba(255,255,255,0.35); }
  @media (prefers-color-scheme: dark) { .usage-table-wrap { background: rgba(15,23,42,0.35); } }
  .usage-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .usage-table th { text-align: left; padding: 12px 16px; font-weight: 800; color: var(--text-strong); background: rgba(255,255,255,0.25); border-bottom: 1px solid var(--panel-border-soft); }
  @media (prefers-color-scheme: dark) { .usage-table th { background: rgba(15,23,42,0.25); } }
  .usage-table td { padding: 12px 16px; border-bottom: 1px solid rgba(188,200,214,0.12); vertical-align: top; line-height: 1.6; color: var(--text-main); }
  .usage-table tr:last-child td { border-bottom: 0; }
  .usage-table tr.highlight { background: rgba(16,185,129,0.08); }
  .u-name { font-weight: 800; color: var(--text-strong); white-space: nowrap; font-family: 'SF Mono', monospace; font-size: 12px; }
  .u-meaning { font-weight: 700; color: var(--violet); white-space: nowrap; }
  .u-desc { color: var(--text-muted); }

  .insights-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
  .insight-card {
    padding: 20px;
    border-radius: 20px;
    border: 1px solid var(--panel-border-soft);
    background: rgba(255,255,255,0.4);
    box-shadow: 0 12px 28px rgba(118,136,158,0.1);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  @media (prefers-color-scheme: dark) { .insight-card { background: rgba(15,23,42,0.42); } }
  .insight-card h5 { margin: 0; color: var(--text-strong); font-weight: 800; letter-spacing: -0.02em; font-size: 1rem; }
  .insight-card p { margin: 0; color: var(--text-muted); font-size: 13px; line-height: 1.7; }

  .recommendation-list { display: flex; flex-direction: column; gap: 14px; }
  .recommendation-card {
    display: grid;
    grid-template-columns: 160px minmax(0, 1fr);
    gap: 16px;
    padding: 18px 20px;
    border-radius: 20px;
    border: 1px solid var(--panel-border-soft);
    background: rgba(255,255,255,0.4);
    box-shadow: 0 12px 28px rgba(118,136,158,0.1);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    align-items: start;
  }
  @media (prefers-color-scheme: dark) { .recommendation-card { background: rgba(15,23,42,0.42); } }
  .recommendation-card h5 {
    margin: 0;
    color: var(--text-strong);
    font-weight: 800;
    letter-spacing: -0.02em;
    font-size: 1rem;
  }
  .recommendation-card ul {
    margin: 0;
    padding-left: 18px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    color: var(--text-muted);
    font-size: 13px;
    line-height: 1.7;
  }
  .recommendation-card li { margin: 0; }

  .usage-summary {
    padding: 18px 20px;
    border-radius: 18px;
    border: 1px solid rgba(16,185,129,0.2);
    background: linear-gradient(135deg, rgba(16,185,129,0.1), rgba(99,102,241,0.06));
    color: var(--text-main);
    font-size: 14px;
    line-height: 1.7;
  }
  .usage-summary strong { color: var(--text-strong); }

  @media (max-width: 960px) {
    .insights-grid { grid-template-columns: 1fr; }
    .recommendation-card { grid-template-columns: 1fr; }
  }
</style>
