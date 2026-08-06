<script lang="ts">
  import {
    getDefaultNewsProvider,
    newsCache,
    newsUiState,
    newsReadState,
    type NewsData,
    type NewsDensity,
    type NewsItem,
    type NewsWindow,
  } from '../../../../lib/news';
  import NewsFilterBar from './NewsFilterBar.svelte';
  import NewsList from './NewsList.svelte';

  let window = $state<NewsWindow>('24h');
  let density = $state<NewsDensity>('cozy');
  let data = $state<NewsData | null>(null);
  let loading = $state(true);
  let error = $state<string | null>(null);
  let selectedSiteId = $state('all');
  let searchQuery = $state('');
  let uiReady = $state(false);
  let seenBefore = $state<string | null>(null);
  let readIds = $state<ReadonlySet<string>>(new Set());

  let restoredScrollTop = $state(0);
  let seenCommitted = false;

  const provider = getDefaultNewsProvider();

  async function load(silent = false) {
    if (!silent) loading = true;
    error = null;

    try {
      const fresh = await provider.fetchFeed(window);
      data = fresh;
      await newsCache.set(window, fresh);
    } catch (e) {
      error = e instanceof Error ? e.message : '加载失败';
      if (!data) {
        const cached = await newsCache.get(window);
        if (cached) {
          data = cached.payload;
        }
      }
    } finally {
      loading = false;
      // Commit the session's NEW baseline exactly once per popup open.
      if (!seenCommitted) {
        seenCommitted = true;
        await newsReadState.setLastSeenAt(new Date().toISOString());
      }
    }
  }

  // Restore UI preferences + read state before any fetch happens.
  $effect(() => {
    (async () => {
      const [ui, rs] = await Promise.all([newsUiState.get(), newsReadState.get()]);
      window = ui.window;
      selectedSiteId = ui.selectedSiteId;
      searchQuery = ui.searchQuery;
      density = ui.density;
      restoredScrollTop = ui.scrollTop;
      seenBefore = rs.lastSeenAt;
      readIds = new Set(rs.readIds);
      uiReady = true;
    })();
  });

  // Load data once preferences are known (and whenever the window flips).
  $effect(() => {
    if (!uiReady) return;
    const currentWindow = window;
    (async () => {
      loading = true;
      const cached = await newsCache.get(currentWindow);
      if (cached) {
        data = cached.payload;
      }
      await load(!!cached);
    })();
  });

  // Persist filter/density changes (debounced) for the next popup open.
  $effect(() => {
    if (!uiReady) return;
    const snapshot = { window, selectedSiteId, searchQuery, density };
    const timer = setTimeout(() => newsUiState.set(snapshot), 300);
    return () => clearTimeout(timer);
  });

  function hasUsableTitle(item: NewsItem): boolean {
    return [item.title_zh, item.title_en, item.title_bilingual, item.title_original, item.title]
      .some((t) => typeof t === 'string' && t.trim().length > 0);
  }

  const filteredItems = $derived<NewsItem[]>(
    (() => {
      if (!data) return [];
      const q = searchQuery.trim().toLowerCase();
      return data.items.filter((item) => {
        if (!hasUsableTitle(item)) return false;
        if (selectedSiteId !== 'all' && item.site_id !== selectedSiteId) return false;
        if (!q) return true;
        const haystack = [
          item.title_zh,
          item.title_en,
          item.title_bilingual,
          item.title_original,
          item.title,
          item.source,
          item.site_name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(q);
      });
    })(),
  );

  const isNew = (item: NewsItem) =>
    seenBefore !== null && item.first_seen_at > seenBefore;

  const isRead = (item: NewsItem) => readIds.has(item.id);

  function handleOpenItem(item: NewsItem) {
    if (readIds.has(item.id)) return;
    readIds = new Set(readIds).add(item.id);
    void newsReadState.markRead(item.id);
  }

  let scrollSaveTimer: ReturnType<typeof setTimeout> | undefined;
  function handleScrollTop(top: number) {
    clearTimeout(scrollSaveTimer);
    scrollSaveTimer = setTimeout(() => newsUiState.set({ scrollTop: top }), 400);
  }
</script>

<div class="news-content">
  <NewsFilterBar
    {window}
    sites={data?.site_stats ?? []}
    {selectedSiteId}
    {searchQuery}
    {loading}
    generatedAt={data?.generated_at ?? null}
    {density}
    onWindowChange={(w) => (window = w)}
    onSiteChange={(id) => (selectedSiteId = id)}
    onSearch={(q) => (searchQuery = q)}
    onRefresh={() => load(false)}
    onDensityChange={(d) => (density = d)}
  />

  <div class="body">
    {#if error && !data}
      <div class="state error">
        <div class="state-title">加载失败</div>
        <div class="state-desc">{error}</div>
        <button class="retry-btn" onclick={() => load(false)}>重试</button>
      </div>
    {:else if !data && loading}
      <div class="state loading">
        <div class="spinner"></div>
        <div class="state-desc">正在聚合 AI 新闻...</div>
      </div>
    {:else if filteredItems.length === 0}
      <div class="state empty">
        <div class="state-title">暂无内容</div>
        <div class="state-desc">换个筛选条件试试</div>
      </div>
    {:else}
      <NewsList
        items={filteredItems}
        {density}
        initialScrollTop={restoredScrollTop}
        {isNew}
        {isRead}
        onOpenItem={handleOpenItem}
        onScrollTop={handleScrollTop}
      />
    {/if}
  </div>
</div>

<style>
  .news-content {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    background: #f5f3ee;
  }

  .body {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-height: 0;
    padding: 8px 14px 10px;
    overflow: hidden;
  }

  .state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-align: center;
  }

  .state-title {
    font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
    font-size: 14px;
    font-weight: 700;
    color: #0c1224;
  }

  .state-desc {
    font-size: 12px;
    color: #6a7496;
    max-width: 240px;
    line-height: 1.5;
  }

  .error .state-title {
    color: #ef4444;
  }

  .retry-btn {
    margin-top: 6px;
    padding: 6px 14px;
    border: 1.5px solid #0c1224;
    border-radius: 6px;
    background: #0c1224;
    color: #f5f3ee;
    font-family: 'Inter', sans-serif;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
  }

  .spinner {
    width: 22px;
    height: 22px;
    border: 2px solid #0c1224;
    border-top-color: transparent;
    border-radius: 50%;
    animation: spin 0.7s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
