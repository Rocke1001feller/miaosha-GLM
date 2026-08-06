<script lang="ts">
  import GeneralPage from './GeneralPage.svelte';
  import UsagePage from './UsagePage.svelte';
  import ArchitecturePage from './ArchitecturePage.svelte';
  import InsightsPage from './InsightsPage.svelte';
  import ReleaseLogPage from './ReleaseLogPage.svelte';
  import { version } from '../../package.json';

  let currentPage = $state<'general' | 'usage' | 'architecture' | 'insights' | 'release-log'>('general');

  const PAGE_META: Record<string, { kicker: string; title: string; subtitle: string }> = {
    general:     { kicker: 'Settings',      title: 'General Settings', subtitle: '管理运行模式、秒杀时间与验证码录入限制。' },
    usage:       { kicker: 'Documentation', title: '使用说明',         subtitle: 'Fire 面板四控件含义、4 种组合与 Preload → Strike → Commit 完整链路。' },
    architecture:{ kicker: 'Documentation', title: '软件架构',         subtitle: 'architecture.md 的网页版摘要：整体架构、入口点、同源代理、auth 与 ticket 系统。' },
    insights:    { kicker: 'Documentation', title: '关键洞察',         subtitle: '通过真实实验推断的智谱后端限流算法与单用户最优发射节奏。' },
    'release-log': { kicker: 'Release Notes', title: 'v2.0.0 更新日志', subtitle: '品牌升级为《智能Coding Plan助手》：买家秀 UGC 上线（popup 聚合 + 营销页现场层）、Token 用量四平台监控、AI 新闻国内镜像回退、全线国内直连可达。' },
  };
</script>

<div class="app-shell">
  <aside class="sidebar">
    <div class="sidebar-top">
      <div class="logo-orb"><div class="logo-icon">Z</div></div>
      <div class="brand-lockup">
        <span class="brand-zhipu">智能</span>
        <span class="brand-miaosha">Coding Plan助手</span>
      </div>
      <span class="alpha-badge">Beta</span>
    </div>

    <div class="sidebar-scroll">
      <section>
        <h2 class="sidebar-group-title">Settings</h2>
        <div class="nav-list">
          <button class="nav-item" class:is-active={currentPage === 'general'} type="button" onclick={() => currentPage = 'general'}>
            <span class="nav-icon">&#9881;</span>
            <span class="nav-label">General</span>
          </button>
        </div>
      </section>

      <section>
        <h2 class="sidebar-group-title">Documentation</h2>
        <div class="nav-list">
          <button class="nav-item" class:is-active={currentPage === 'usage'} type="button" onclick={() => currentPage = 'usage'}>
            <span class="nav-icon">&#128214;</span>
            <span class="nav-label">使用说明</span>
          </button>
          <button class="nav-item" class:is-active={currentPage === 'architecture'} type="button" onclick={() => currentPage = 'architecture'}>
            <span class="nav-icon">&#128736;</span>
            <span class="nav-label">软件架构</span>
          </button>
          <button class="nav-item" class:is-active={currentPage === 'insights'} type="button" onclick={() => currentPage = 'insights'}>
            <span class="nav-icon">&#128161;</span>
            <span class="nav-label">关键洞察</span>
          </button>
          <button class="nav-item" class:is-active={currentPage === 'release-log'} type="button" onclick={() => currentPage = 'release-log'}>
            <span class="nav-icon">&#128220;</span>
            <span class="nav-label">更新日志</span>
          </button>
        </div>
      </section>
    </div>

    <div class="sidebar-footer">v{version}</div>
  </aside>

  <main class="main-pane">
    <header class="page-header">
      <span class="page-kicker">{PAGE_META[currentPage].kicker}</span>
      <h1 class="page-title">{PAGE_META[currentPage].title}</h1>
      <p class="page-subtitle">{PAGE_META[currentPage].subtitle}</p>
    </header>

    {#if currentPage === 'general'}
      <GeneralPage />
    {:else if currentPage === 'usage'}
      <UsagePage />
    {:else if currentPage === 'insights'}
      <InsightsPage />
    {:else if currentPage === 'release-log'}
      <ReleaseLogPage />
    {:else}
      <ArchitecturePage />
    {/if}
  </main>
</div>

<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

  :global(*) { box-sizing: border-box; margin: 0; padding: 0; }

  :global(body) {
    font-family: 'Inter', system-ui, sans-serif;
    min-height: 100vh;
    color: var(--text-main);
    background:
      radial-gradient(circle at 12% 14%, rgba(52,211,153,0.12), transparent 18%),
      radial-gradient(circle at 84% 8%, rgba(99,102,241,0.16), transparent 24%),
      radial-gradient(circle at 76% 82%, rgba(14,165,233,0.1), transparent 20%),
      linear-gradient(180deg, var(--bg-base) 0%, var(--bg-secondary) 100%);
    overflow-x: hidden;
  }

  :root {
    color-scheme: light;
    --bg-base: #f4f7fb; --bg-secondary: #edf3f8;
    --panel-surface: rgba(255,255,255,0.58); --panel-surface-strong: rgba(255,255,255,0.74);
    --panel-border: rgba(255,255,255,0.72); --panel-border-soft: rgba(215,225,236,0.82);
    --panel-shadow: 0 22px 50px rgba(96,118,146,0.14); --card-shadow: 0 16px 36px rgba(118,136,158,0.14);
    --text-main: #2c374a; --text-strong: #1d293d; --text-muted: #6d7c91; --text-subtle: #98a5b7;
    --primary: #10b981; --primary-strong: #0f9d71; --primary-soft: rgba(16,185,129,0.14);
    --violet: #6366f1; --violet-soft: rgba(99,102,241,0.14);
    --amber: #d97706; --amber-soft: rgba(251,191,36,0.16);
    --rose: #e11d48; --rose-soft: rgba(244,63,94,0.14);
    --line-soft: rgba(188,200,214,0.54);
    --radius-xl: 28px; --radius-lg: 22px; --radius-md: 18px;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      color-scheme: dark;
      --bg-base: #08101d; --bg-secondary: #0b1524;
      --panel-surface: rgba(15,23,42,0.62); --panel-surface-strong: rgba(15,23,42,0.78);
      --panel-border: rgba(255,255,255,0.12); --panel-border-soft: rgba(71,85,105,0.72);
      --panel-shadow: 0 22px 50px rgba(0,0,0,0.38); --card-shadow: 0 18px 42px rgba(0,0,0,0.26);
      --text-main: #dbe5f2; --text-strong: #f8fafc; --text-muted: #94a3b8; --text-subtle: #6b7b93;
      --primary-soft: rgba(16,185,129,0.18); --violet-soft: rgba(99,102,241,0.2);
      --amber-soft: rgba(251,191,36,0.12); --rose-soft: rgba(244,63,94,0.12);
      --line-soft: rgba(71,85,105,0.52);
    }
  }

  .app-shell { display: flex; gap: 24px; width: min(calc(100vw - 32px), 1200px); min-height: calc(100vh - 32px); margin: 16px auto; }

  /* ── Sidebar ── */
  .sidebar { width: 260px; flex: 0 0 260px; border-radius: var(--radius-xl); background: linear-gradient(180deg, var(--panel-surface-strong) 0%, var(--panel-surface) 100%); border: 1px solid var(--panel-border); box-shadow: var(--panel-shadow); display: flex; flex-direction: column; min-height: calc(100vh - 32px); overflow: hidden; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); }
  .sidebar-top { padding: 32px 28px 18px; display: flex; flex-direction: column; align-items: center; text-align: center; }
  .logo-orb { position: relative; width: 80px; height: 80px; display: grid; place-items: center; margin-bottom: 16px; }
  .logo-orb::before { content: ''; position: absolute; inset: 4px; border-radius: 22px; background: linear-gradient(135deg, rgba(99,102,241,0.28), rgba(14,165,233,0.2), rgba(16,185,129,0.22)); filter: blur(12px); opacity: 0.9; }
  .logo-icon { position: relative; width: 68px; height: 68px; border-radius: 20px; background: linear-gradient(135deg, var(--violet), #818cf8); display: grid; place-items: center; font-size: 28px; font-weight: 800; color: white; box-shadow: 0 14px 32px rgba(79,70,229,0.18); }
  .brand-lockup { display: flex; flex-wrap: wrap; justify-content: center; gap: 6px; font-size: 1.25rem; font-weight: 800; line-height: 1.1; letter-spacing: -0.03em; }
  .brand-zhipu { background: linear-gradient(135deg, var(--primary), #14b8a6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .brand-miaosha { background: linear-gradient(135deg, #818cf8, #a855f7); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .alpha-badge { margin-top: 10px; display: inline-flex; padding: 4px 10px; border-radius: 999px; border: 1px solid rgba(99,102,241,0.28); background: linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08)); color: var(--violet); font-size: 10px; font-weight: 800; letter-spacing: 0.16em; text-transform: uppercase; }
  .sidebar-scroll { flex: 1; padding: 10px 18px 24px; overflow: auto; display: flex; flex-direction: column; gap: 28px; }
  .sidebar-group-title { margin: 0 0 12px 14px; color: var(--text-subtle); font-size: 11px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; }
  .nav-list { display: flex; flex-direction: column; gap: 8px; }
  .nav-item { display: flex; align-items: center; gap: 12px; width: 100%; padding: 14px 16px; border-radius: 18px; border: 1px solid transparent; background: transparent; color: var(--text-main); cursor: pointer; transition: transform 180ms ease, background 180ms ease, border-color 180ms ease; font-family: inherit; font-size: 14px; }
  .nav-item:hover { transform: translateY(-1px); background: rgba(255,255,255,0.34); border-color: var(--panel-border-soft); }
  .nav-item.is-active { background: linear-gradient(90deg, var(--primary-soft) 0%, rgba(255,255,255,0.18) 100%); border-color: rgba(16,185,129,0.24); color: var(--primary-strong); box-shadow: 0 0 0 1px rgba(16,185,129,0.06), 0 0 20px rgba(16,185,129,0.16); }
  .nav-icon { font-size: 18px; }
  .nav-label { font-weight: 600; }
  .sidebar-footer { padding: 20px 18px; text-align: center; color: var(--text-subtle); font-size: 12px; border-top: 1px solid var(--line-soft); }

  /* ── Main Pane ── */
  .main-pane { flex: 1; min-width: 0; min-height: calc(100vh - 32px); overflow: auto; padding: 18px 10px 28px 2px; }
  .page-header { padding: 6px 4px 12px; margin-bottom: 16px; }
  .page-title { margin: 0; font-size: clamp(2rem, 3vw, 2.35rem); font-weight: 800; letter-spacing: -0.04em; background: linear-gradient(135deg, var(--text-strong), var(--text-muted)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
  .page-kicker { display: inline-flex; margin-bottom: 8px; color: var(--text-subtle); font-size: 11px; font-weight: 800; letter-spacing: 0.18em; text-transform: uppercase; }
  .page-subtitle { margin: 10px 0 0; max-width: 760px; color: var(--text-muted); font-size: 14px; line-height: 1.65; }

  /* ── Responsive ── */
  @media (max-width: 860px) {
    .app-shell { flex-direction: column; width: min(calc(100vw - 24px), 1200px); margin: 12px auto; }
    .sidebar { width: 100%; flex-basis: auto; min-height: auto; }
    .main-pane { padding: 8px 4px 20px; }
  }
</style>
