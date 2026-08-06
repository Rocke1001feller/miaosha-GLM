<script lang="ts">
  import { tick } from 'svelte';
  import type { NewsDensity, NewsItem } from '../../../../lib/news';
  import NewsCard from './NewsCard.svelte';

  let {
    items,
    density,
    initialScrollTop = 0,
    isNew,
    isRead,
    onOpenItem,
    onScrollTop,
  }: {
    items: NewsItem[];
    density: NewsDensity;
    initialScrollTop?: number;
    isNew: (item: NewsItem) => boolean;
    isRead: (item: NewsItem) => boolean;
    onOpenItem: (item: NewsItem) => void;
    onScrollTop?: (top: number) => void;
  } = $props();

  const BATCH = 20;

  let visibleCount = $state(BATCH);
  let container = $state<HTMLDivElement | null>(null);
  let sentinel = $state<HTMLDivElement | null>(null);
  let scrollRestored = false;

  const visibleItems = $derived(items.slice(0, visibleCount));
  const allLoaded = $derived(visibleCount >= items.length);

  // Reset the window when the result set identity changes (filter/search/site).
  let lastResetKey = '';
  $effect(() => {
    const key = `${items[0]?.id ?? ''}:${items.length}`;
    if (key !== lastResetKey) {
      lastResetKey = key;
      visibleCount = BATCH;
    }
  });

  // Infinite scroll: grow the window when the sentinel approaches the bottom.
  $effect(() => {
    if (!container || !sentinel) return;
    if (typeof IntersectionObserver === 'undefined') return; // e.g. happy-dom tests
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          visibleCount = Math.min(visibleCount + BATCH, items.length);
        }
      },
      { root: container, rootMargin: '160px' },
    );
    io.observe(sentinel);
    return () => io.disconnect();
  });

  // Restore the previous session's scroll position exactly once, after the
  // first batch has rendered.
  $effect(() => {
    if (scrollRestored || !container || visibleItems.length === 0) return;
    scrollRestored = true;
    tick().then(() => {
      if (container) container.scrollTop = initialScrollTop;
    });
  });
</script>

<div
  class="list"
  class:compact={density === 'compact'}
  bind:this={container}
  onscroll={(e) => onScrollTop?.(e.currentTarget.scrollTop)}
>
  {#each visibleItems as item (item.id)}
    <NewsCard {item} {density} {isNew} {isRead} {onOpenItem} />
  {/each}

  {#if !allLoaded}
    <div class="tail" bind:this={sentinel}>
      <span class="tail-text">下拉加载 · 已显示 {visibleItems.length} / {items.length} 条</span>
    </div>
  {:else if items.length > BATCH}
    <div class="tail">
      <span class="tail-text">已加载全部 {items.length} 条</span>
    </div>
  {/if}
</div>

<style>
  .list {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow-y: auto;
    padding-right: 2px;
  }

  .list.compact {
    gap: 5px;
  }

  .list::-webkit-scrollbar {
    width: 4px;
  }

  .list::-webkit-scrollbar-thumb {
    background: rgba(12, 18, 36, 0.2);
    border-radius: 99px;
  }

  .tail {
    display: flex;
    justify-content: center;
    padding: 6px 0 2px;
  }

  .tail-text {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    color: #6a7496;
  }
</style>
