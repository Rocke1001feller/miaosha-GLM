<script lang="ts">
  import { cardHref, type NewsDensity, type NewsItem } from '../../../../lib/news';

  let {
    item,
    density,
    isNew,
    isRead,
    onOpenItem,
  }: {
    item: NewsItem;
    density: NewsDensity;
    isNew: (item: NewsItem) => boolean;
    isRead: (item: NewsItem) => boolean;
    onOpenItem: (item: NewsItem) => void;
  } = $props();

  const displayTitle = $derived(
    item.title_zh ?? item.title_en ?? item.title_bilingual ?? item.title_original ?? item.title,
  );

  const displaySource = $derived(`${item.site_name} · ${item.source}`);

  const href = $derived(cardHref(item));

  function formatAgo(iso: string | null): string {
    if (!iso) return '';
    const then = new Date(iso).getTime();
    const diff = Date.now() - then;
    if (Number.isNaN(diff) || diff < 0) return '';
    const minutes = Math.floor(diff / 60000);
    if (minutes < 60) return `${minutes} 分钟前`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} 小时前`;
    const days = Math.floor(hours / 24);
    return `${days} 天前`;
  }

  const ago = $derived(formatAgo(item.first_seen_at));
</script>

<a
  class="card"
  class:compact={density === 'compact'}
  class:read={isRead(item)}
  {href}
  target="_blank"
  rel="noopener noreferrer"
  onclick={() => onOpenItem(item)}
>
  <div class="title">{displayTitle}</div>
  {#if (item.summary_zh ?? item.summary) && density === 'cozy'}
    <p class="summary">{item.summary_zh ?? item.summary}</p>
  {/if}
  <div class="footer">
    <span class="source-wrap">
      {#if isNew(item)}
        <span class="new-badge">NEW</span>
      {/if}
      <span class="source">{displaySource}</span>
    </span>
    {#if ago}
      <span class="time">{ago}</span>
    {/if}
  </div>
</a>

<style>
  .card {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 10px 12px;
    background: #ffffff;
    border: 1.5px solid #0c1224;
    border-radius: 10px;
    box-shadow: 2px 2px 0 0 #0c1224;
    text-decoration: none;
    color: inherit;
    transition: transform 0.1s ease, box-shadow 0.1s ease, opacity 0.15s ease;
  }

  .card:hover {
    transform: translate(-1px, -1px);
    box-shadow: 3px 3px 0 0 #0c1224;
  }

  .card:active {
    transform: translate(1px, 1px);
    box-shadow: 1px 1px 0 0 #0c1224;
  }

  .card.read {
    opacity: 0.55;
  }

  .card.read:hover {
    opacity: 0.8;
  }

  .card.compact {
    gap: 3px;
    padding: 6px 10px;
    border-radius: 8px;
    box-shadow: 1.5px 1.5px 0 0 #0c1224;
  }

  .title {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 12px;
    font-weight: 600;
    line-height: 1.45;
    color: #0c1224;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .card.compact .title {
    -webkit-line-clamp: 1;
    font-size: 11px;
  }

  .summary {
    font-family: 'Inter', system-ui, sans-serif;
    font-size: 11px;
    line-height: 1.5;
    color: #4a5570;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .source-wrap {
    display: flex;
    align-items: center;
    gap: 5px;
    min-width: 0;
  }

  .new-badge {
    flex-shrink: 0;
    padding: 1px 5px;
    border: 1px solid #0c1224;
    border-radius: 4px;
    background: #ef4444;
    color: #ffffff;
    font-family: 'JetBrains Mono', monospace;
    font-size: 8px;
    font-weight: 700;
    letter-spacing: 0.06em;
    line-height: 1.4;
  }

  .source {
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    color: #6a7496;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .time {
    flex-shrink: 0;
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    color: #6a7496;
  }
</style>
