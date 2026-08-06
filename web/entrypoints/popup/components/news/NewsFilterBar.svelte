<script lang="ts">
  import type { NewsDensity, NewsWindow, SiteStat } from '../../../../lib/news';

  let {
    window,
    sites,
    selectedSiteId,
    searchQuery,
    loading,
    generatedAt,
    density,
    onWindowChange,
    onSiteChange,
    onSearch,
    onRefresh,
    onDensityChange,
  }: {
    window: NewsWindow;
    sites: SiteStat[];
    selectedSiteId: string;
    searchQuery: string;
    loading: boolean;
    generatedAt: string | null;
    density: NewsDensity;
    onWindowChange: (w: NewsWindow) => void;
    onSiteChange: (siteId: string) => void;
    onSearch: (q: string) => void;
    onRefresh: () => void;
    onDensityChange: (d: NewsDensity) => void;
  } = $props();

  function formatTime(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
</script>

<div class="bar">
  <div class="row">
    <div class="window-toggle">
      <button
        class="win-btn"
        class:active={window === '24h'}
        onclick={() => onWindowChange('24h')}
      >
        24h
      </button>
      <button
        class="win-btn"
        class:active={window === '7d'}
        onclick={() => onWindowChange('7d')}
      >
        7d
      </button>
    </div>

    <select
      class="site-select"
      value={selectedSiteId}
      onchange={(e) => onSiteChange(e.currentTarget.value)}
    >
      <option value="all">全部平台</option>
      {#each sites as site (site.site_id)}
        <option value={site.site_id}>{site.site_name} ({site.count})</option>
      {/each}
    </select>

    <button
      class="icon-btn"
      onclick={() => onDensityChange(density === 'cozy' ? 'compact' : 'cozy')}
      aria-label="切换列表密度"
      title={density === 'cozy' ? '切换为紧凑模式' : '切换为舒适模式'}
    >
      {density === 'cozy' ? '☰' : '▦'}
    </button>

    <button
      class="icon-btn"
      class:spinning={loading}
      onclick={onRefresh}
      aria-label="刷新"
      title="刷新"
    >
      ↻
    </button>
  </div>

  <input
    class="search-input"
    type="text"
    placeholder="搜索标题 / 来源..."
    value={searchQuery}
    oninput={(e) => onSearch(e.currentTarget.value)}
  />

  {#if generatedAt}
    <div class="freshness">
      更新于 {formatTime(generatedAt)}
    </div>
  {/if}
</div>

<style>
  .bar {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 14px;
    border-bottom: 1.5px dashed rgba(12, 18, 36, 0.2);
    background: #ffffff;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .window-toggle {
    display: flex;
    border: 1.5px solid #0c1224;
    border-radius: 6px;
    padding: 2px;
  }

  .win-btn {
    padding: 3px 9px;
    border: 0;
    background: transparent;
    border-radius: 4px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    font-weight: 700;
    color: #6a7496;
    cursor: pointer;
  }

  .win-btn.active {
    background: #0c1224;
    color: #f5f3ee;
  }

  .site-select {
    flex: 1;
    min-width: 0;
    padding: 4px 7px;
    border: 1.5px solid #0c1224;
    border-radius: 6px;
    background: #ffffff;
    font-family: 'Inter', sans-serif;
    font-size: 11px;
    color: #0c1224;
    cursor: pointer;
  }

  .icon-btn {
    flex-shrink: 0;
    width: 26px;
    height: 26px;
    display: grid;
    place-items: center;
    border: 1.5px solid #0c1224;
    border-radius: 6px;
    background: #ffffff;
    color: #0c1224;
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    cursor: pointer;
    transition: transform 0.1s ease;
  }

  .icon-btn:hover:not(:disabled) {
    transform: translate(-1px, -1px);
    box-shadow: 2px 2px 0 0 #0c1224;
  }

  .icon-btn.spinning {
    animation: spin 1s linear infinite;
  }

  .search-input {
    width: 100%;
    padding: 6px 9px;
    border: 1.5px solid #0c1224;
    border-radius: 6px;
    background: #fafaf7;
    font-family: 'Inter', sans-serif;
    font-size: 12px;
    color: #0c1224;
    outline: none;
  }

  .search-input::placeholder {
    color: #6a7496;
  }

  .freshness {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    color: #6a7496;
    text-align: right;
    margin-top: -2px;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
