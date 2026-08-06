<script lang="ts">
  import {
    articleJsonUrl,
    buildBilingualPairs,
    buildParagraphPairsFromBlocks,
    blockZhOnlyText,
    sanitizeArticleHtml,
    type ArticleSnapshot,
  } from '../../lib/news';

  type DisplayMode = 'sent' | 'para' | 'zh' | 'en';
  const MODE_KEY = 'reader-display-mode';

  const params = new URLSearchParams(location.search);
  const articleId = params.get('id') ?? '';
  const originalUrl = params.get('url') ?? '';

  let article = $state<ArticleSnapshot | null>(null);
  let failed = $state(false);
  let displayMode = $state<DisplayMode>(loadMode());

  function loadMode(): DisplayMode {
    try {
      const v = localStorage.getItem(MODE_KEY);
      if (v === 'sent' || v === 'para' || v === 'zh' || v === 'en') return v;
      if (v === 'both') return 'sent'; // legacy value → sentence view
    } catch {
      /* ignore */
    }
    return 'sent';
  }

  $effect(() => {
    try {
      localStorage.setItem(MODE_KEY, displayMode);
    } catch {
      /* private mode etc. */
    }
  });

  $effect(() => {
    if (!articleId) {
      failed = true;
      return;
    }
    (async () => {
      try {
        const res = await fetch(articleJsonUrl(articleId));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ArticleSnapshot;
        if (!data.ok || !data.content_html) throw new Error(data.error ?? 'empty snapshot');
        article = data;
      } catch {
        failed = true;
      }
    })();
  });

  const hasBlocks = $derived(!!article?.blocks?.length);
  const hasZh = $derived(hasBlocks || !!article?.content_html_zh);

  // Coerce the mode into what the loaded data actually supports.
  $effect(() => {
    if (!article) return;
    if (displayMode === 'sent' && !hasBlocks) displayMode = hasZh ? 'para' : 'en';
    if (displayMode === 'para' && !hasZh) displayMode = 'en';
    if (displayMode === 'zh' && !hasZh) displayMode = 'en';
  });

  const enHtml = $derived(article ? sanitizeArticleHtml(article.content_html) : '');
  const zhHtml = $derived(
    article?.content_html_zh ? sanitizeArticleHtml(article.content_html_zh) : '',
  );

  const paraPairs = $derived(
    article
      ? hasBlocks
        ? buildParagraphPairsFromBlocks(article.blocks!)
        : article.content_html_zh
          ? buildBilingualPairs(article.content_html, article.content_html_zh)
          : []
      : [],
  );

  const modeOptions = $derived<Array<{ id: DisplayMode; label: string }>>(
    hasBlocks
      ? [
          { id: 'sent', label: '双语·句' },
          { id: 'para', label: '双语·段' },
          { id: 'zh', label: '中文' },
          { id: 'en', label: 'EN' },
        ]
      : hasZh
        ? [
            { id: 'para', label: '双语' },
            { id: 'zh', label: '中文' },
            { id: 'en', label: 'EN' },
          ]
        : [],
  );

  function formatTime(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleString('zh-CN', { dateStyle: 'medium', timeStyle: 'short' });
  }
</script>

<div class="page">
  <header class="topbar">
    <span class="brand">AI 聚合新闻 · 阅读</span>
    <nav class="actions">
      {#if article && modeOptions.length > 0}
        <div class="mode-toggle" role="group" aria-label="显示语言">
          {#each modeOptions as opt (opt.id)}
            <button
              class="mode-btn"
              class:active={displayMode === opt.id}
              onclick={() => (displayMode = opt.id)}
            >{opt.label}</button>
          {/each}
        </div>
      {/if}
      <a href={originalUrl} target="_blank" rel="noopener noreferrer">原始链接 ↗</a>
    </nav>
  </header>

  <main class="column">
    {#if article}
      <article class="article">
        <h1 class="title">{article.title}</h1>
        <div class="meta">
          <span>{article.site_name} · {article.source}</span>
          {#if article.byline}
            <span class="dot">·</span>
            <span>{article.byline}</span>
          {/if}
          <span class="dot">·</span>
          <span>快照于 {formatTime(article.fetched_at)}</span>
        </div>

        {#if displayMode === 'sent' && hasBlocks}
          <div class="content sentence-mode">
            {#each article.blocks! as block, bi (bi)}
              {#if block.sentences.length === 0}
                <div class="raw-block">{@html sanitizeArticleHtml(block.html_en)}</div>
              {:else}
                <div class="sblock">
                  {#each block.sentences as sent, si (si)}
                    <div class="sent">
                      <span class="en">{sent.en}</span>
                      {#if sent.zh}
                        <span class="zh">{sent.zh}</span>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            {/each}
          </div>
        {:else if displayMode === 'para' && hasZh}
          <div class="content bilingual">
            {#each paraPairs as pair, i (i)}
              <div class="pair">
                <div class="en">{@html pair.en}</div>
                {#if pair.zh}
                  <div class="zh">{@html pair.zh}</div>
                {/if}
              </div>
            {/each}
          </div>
        {:else if displayMode === 'zh' && hasBlocks}
          <div class="content">
            {#each article.blocks! as block, bi (bi)}
              <p>{blockZhOnlyText(block)}</p>
            {/each}
          </div>
        {:else if displayMode === 'zh' && hasZh}
          <div class="content">
            {@html zhHtml}
          </div>
        {:else}
          <div class="content">
            {@html enHtml}
          </div>
        {/if}
      </article>
    {:else if failed}
      <div class="state">
        <h2>快照不可用</h2>
        <p>这篇文章没有生成离线快照（源站反爬或抓取失败）。可以直接打开原始链接阅读：</p>
        <div class="fallback-links">
          <a class="btn primary" href={originalUrl} target="_blank" rel="noopener noreferrer">原始链接 ↗</a>
        </div>
      </div>
    {:else}
      <div class="state">
        <div class="spinner"></div>
        <p>正在加载快照…</p>
      </div>
    {/if}
  </main>
</div>

<style>
  .page {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }

  .topbar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 20px;
    background: #ffffff;
    border-bottom: 1.5px solid #0c1224;
  }

  .brand {
    font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
    font-size: 13px;
    font-weight: 800;
    color: #0c1224;
  }

  .actions {
    display: flex;
    gap: 14px;
  }

  .actions a {
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #0c1224;
    text-decoration: none;
    border-bottom: 1.5px solid #0c1224;
  }

  .actions a:hover {
    background: #0c1224;
    color: #f5f3ee;
  }

  .actions {
    align-items: center;
  }

  .mode-toggle {
    display: flex;
    border: 1.5px solid #0c1224;
    border-radius: 6px;
    padding: 2px;
    background: #fafaf7;
  }

  .mode-btn {
    padding: 3px 10px;
    border: 0;
    background: transparent;
    border-radius: 4px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    color: #6a7496;
    cursor: pointer;
  }

  .mode-btn.active {
    background: #0c1224;
    color: #f5f3ee;
  }

  /* ── bilingual pairs ── */
  .bilingual .pair {
    margin-bottom: 18px;
  }

  .bilingual .zh {
    margin-top: 4px;
    padding-left: 12px;
    border-left: 2.5px solid rgba(12, 18, 36, 0.22);
    color: #55617e;
  }

  .bilingual .zh :global(p) {
    margin: 0;
  }

  /* ── sentence mode (双语·句) ── */
  .sentence-mode .sblock {
    margin-bottom: 18px;
  }

  .sentence-mode .sent {
    display: block;
    margin-bottom: 8px;
  }

  .sentence-mode .sent .en {
    display: block;
    line-height: 1.7;
  }

  .sentence-mode .sent .zh {
    display: block;
    margin-top: 2px;
    padding-left: 12px;
    border-left: 2.5px solid rgba(12, 18, 36, 0.22);
    color: #55617e;
    font-size: 14px;
    line-height: 1.7;
  }

  .sentence-mode .raw-block {
    margin-bottom: 18px;
  }

  .column {
    flex: 1;
    width: 100%;
    max-width: 720px;
    margin: 0 auto;
    padding: 28px 20px 64px;
  }

  .title {
    font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
    font-size: 24px;
    font-weight: 800;
    line-height: 1.35;
    letter-spacing: -0.01em;
    color: #0c1224;
    margin: 0 0 10px;
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 11px;
    color: #6a7496;
    padding-bottom: 16px;
    margin-bottom: 20px;
    border-bottom: 1.5px dashed rgba(12, 18, 36, 0.25);
  }

  .dot {
    opacity: 0.5;
  }

  .content {
    font-family: 'Inter', 'PingFang SC', sans-serif;
    font-size: 15px;
    line-height: 1.85;
    color: #1c2438;
    word-break: break-word;
  }

  .content :global(p) {
    margin: 0 0 1em;
  }

  .content :global(h1),
  .content :global(h2),
  .content :global(h3),
  .content :global(h4) {
    font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
    color: #0c1224;
    line-height: 1.4;
    margin: 1.4em 0 0.5em;
  }

  .content :global(h2) { font-size: 19px; }
  .content :global(h3) { font-size: 16px; }

  .content :global(a) {
    color: #2456c4;
  }

  .content :global(img) {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
  }

  .content :global(blockquote) {
    margin: 1em 0;
    padding: 8px 14px;
    border-left: 3px solid #0c1224;
    background: rgba(12, 18, 36, 0.05);
    color: #3d465e;
  }

  .content :global(pre) {
    overflow-x: auto;
    padding: 12px 14px;
    background: #0c1224;
    color: #dbe2f2;
    border-radius: 8px;
    font-size: 13px;
    line-height: 1.6;
  }

  .content :global(code) {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.9em;
  }

  .content :global(ul),
  .content :global(ol) {
    margin: 0 0 1em;
    padding-left: 1.4em;
  }

  .content :global(li) {
    margin-bottom: 0.35em;
  }

  .content :global(figure) {
    margin: 1em 0;
  }

  .content :global(figcaption) {
    font-size: 12px;
    color: #6a7496;
    text-align: center;
    margin-top: 6px;
  }

  .state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
    padding: 80px 20px;
    text-align: center;
    color: #3d465e;
  }

  .state h2 {
    font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
    color: #0c1224;
    margin: 0;
  }

  .fallback-links {
    display: flex;
    gap: 12px;
    margin-top: 12px;
  }

  .btn {
    padding: 8px 16px;
    border: 1.5px solid #0c1224;
    border-radius: 8px;
    background: #ffffff;
    color: #0c1224;
    font-size: 13px;
    font-weight: 700;
    text-decoration: none;
    box-shadow: 2px 2px 0 0 #0c1224;
  }

  .btn.primary {
    background: #0c1224;
    color: #f5f3ee;
  }

  .btn:hover {
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 0 #0c1224;
  }

  .spinner {
    width: 26px;
    height: 26px;
    border: 2.5px solid #0c1224;
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
