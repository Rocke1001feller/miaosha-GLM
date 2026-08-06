<script lang="ts">
  import { onMount } from 'svelte';
  import { PLATFORMS, type PlatformEntryInfo } from '../../../lib/platform';
  import { saleTimeStore } from '../../../lib/settings/sale-time';

  function openEntry(url: string) {
    chrome.tabs.create({ url });
  }

  type SubEntry = {
    id: string;
    name: string;
    entryUrl: string;
    hostHint: string;
    note?: string;
    saleTime?: string;
  };

  const ENTRY_NOTES: Record<string, string> = {
    'volcengine-agentplan': '无需抢购，音乐/视频可用，但用户普遍反馈较差',
    'volcengine-codingplan': '不定时释放库存，需刷新库存',
    'bailian-codingplan': 'UTC+8 09:30 开售 · 200 元起 · 略贵',
    'baidu-tokenplan': '每日 10:00 补货 · Lite/Pro 常售罄 · 4.9 元起',
  };

  /** 各平台抢购开始时间（带时区）；bigmodel 由用户配置，onMount 动态读取。 */
  const SALE_TIMES: Record<string, string> = {
    'volcengine-agentplan': '不定时释放库存',
    'volcengine-codingplan': '不定时释放库存',
    'bailian-codingplan': '每日 09:30 (UTC+8) 开售',
    'baidu-tokenplan': '每日 10:00 (UTC+8) 开售',
  };

  let bmSaleTime = $state('');
  onMount(async () => {
    const cfg = await saleTimeStore.get();
    const p2 = (n: number) => String(n).padStart(2, '0');
    bmSaleTime = `每日 ${p2(cfg.hour)}:${p2(cfg.minute)} (${cfg.timezone}) 开售`;
  });

  function saleTimeOf(id: string, bmText: string): string | undefined {
    if (id === 'bigmodel') return bmText || undefined;
    return SALE_TIMES[id];
  }

  type PlatformGroup = {
    id: string;
    name: string;
    hostHint: string;
    hero: boolean;
    subEntries: SubEntry[];
  };

  function commonName(names: string[]): string {
    if (names.length === 1) return names[0];
    let prefix = names[0];
    for (const n of names.slice(1)) {
      while (prefix && !n.startsWith(prefix)) prefix = prefix.slice(0, -1);
    }
    return prefix.trim() || names[0];
  }

  /**
   * Group platform entries by host root so Volcengine Agent Plan + Coding
   * Plan collapse into a single card with multiple sub-rows. Only entries
   * flagged `hero` (bigmodel) render as the big card; everything else is a
   * compact group card with "进入" buttons.
   */
  function groupEntries(entries: readonly PlatformEntryInfo[], bmText: string): PlatformGroup[] {
    const groups = new Map<string, PlatformGroup>();
    for (const a of entries) {
      const hostRoot = (a.hostPatterns[0] ?? '').replace(/^\*:\/\/\*\./, '').replace(/\/\*$/, '');
      const sub: SubEntry = {
        id: a.id,
        name: a.displayName,
        entryUrl: a.entryUrl,
        hostHint: hostRoot,
        note: ENTRY_NOTES[a.id],
        saleTime: saleTimeOf(a.id, bmText),
      };
      const existing = groups.get(hostRoot);
      if (existing) {
        existing.subEntries.push(sub);
        existing.hero = false;
      } else {
        groups.set(hostRoot, {
          id: hostRoot,
          name: '',
          hostHint: hostRoot,
          hero: a.hero === true,
          subEntries: [sub],
        });
      }
    }
    for (const g of groups.values()) {
      g.name = commonName(g.subEntries.map((s) => s.name));
    }
    return Array.from(groups.values());
  }

  const groups = $derived(groupEntries(PLATFORMS, bmSaleTime));
</script>

<div class="list">
  {#each groups as group, idx (group.id)}
    {#if group.subEntries.length === 1 && group.hero}
      <!-- 单入口卡 (Hero) -->
      {@const sub = group.subEntries[0]}
      <article class="card hero">
        <header class="hero-head">
          <span class="rocket" aria-hidden="true">🚀</span>
          <div class="meta">
            <h2 class="name">{sub.name}</h2>
            <p class="host">*.{group.hostHint}</p>
            {#if sub.saleTime}
              <p class="sale">⏰ {sub.saleTime}</p>
            {/if}
          </div>
          <span class="num">{String(idx + 1).padStart(2, '0')}</span>
        </header>
        <button class="cta primary" onclick={() => openEntry(sub.entryUrl)}>
          ▶ 一键开始秒杀
        </button>
      </article>
    {:else}
      <!-- 多入口卡 (Group) -->
      <article class="card group">
        <header class="group-head">
          <span class="rocket" aria-hidden="true">🚀</span>
          <div class="meta">
            <h2 class="name">{group.name}</h2>
            <p class="host">*.{group.hostHint}{#if group.subEntries.length > 1} · 多入口{/if}</p>
          </div>
          <span class="num">{String(idx + 1).padStart(2, '0')}</span>
        </header>
        <div class="sub-list">
          {#each group.subEntries as sub (sub.id)}
            <div class="sub-row">
              <div class="sub-meta">
                <div class="sub-name">{sub.name}</div>
                {#if sub.saleTime}
                  <div class="sale">⏰ {sub.saleTime}</div>
                {/if}
                {#if sub.note}
                  <div class="sub-note">{sub.note}</div>
                {/if}
              </div>
              <button class="cta secondary" onclick={() => openEntry(sub.entryUrl)}>
                ▶ 进入
              </button>
            </div>
          {/each}
        </div>
      </article>
    {/if}
  {/each}
</div>

<style>
  .list {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 10px 14px 12px;
    /* 卡片自然高度排布，超出 380×520 弹窗时纵向滚动——保证多入口 group
       卡（火山双入口、未来更多平台）不被裁切。 */
    overflow-y: auto;
  }

  /* ── 卡片基类：黑边 + 硬偏移阴影 + 方角 ── */
  .card {
    position: relative;
    background: #ffffff;
    border: 1.5px solid #0c1224;
    border-radius: 12px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    box-shadow: 3px 3px 0 0 #0c1224;
  }

  /* ── 火箭 + 元信息 ── */
  .rocket {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border: 1.5px solid #0c1224;
    border-radius: 8px;
    display: grid;
    place-items: center;
    font-size: 16px;
    background: #fafaf7;
    line-height: 1;
  }

  .meta {
    flex: 1;
    min-width: 0;
  }
  .name {
    font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
    font-size: 14px;
    font-weight: 700;
    color: #0c1224;
    line-height: 1.25;
    letter-spacing: -0.2px;
  }
  .host {
    margin-top: 2px;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    color: #6a7496;
  }

  /* ── 右上角编号印章（方角、单边框） ── */
  .num {
    flex-shrink: 0;
    align-self: flex-start;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
    font-weight: 700;
    color: #0c1224;
    letter-spacing: 0.1em;
    padding: 2px 6px;
    border: 1px solid #0c1224;
    border-radius: 4px;
    background: #fafaf7;
  }

  /* ── Hero（占视觉中心的大卡） ── */
  .card.hero { flex: 0 0 auto; }
  .hero-head { display: flex; align-items: center; gap: 10px; }
  .card.hero .name { font-size: 16px; font-weight: 800; }

  /* ── Group（中卡，嵌套多个子入口） ── */
  .card.group { flex: 0 0 auto; }
  .group-head {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-bottom: 8px;
    border-bottom: 1px dashed rgba(12, 18, 36, 0.2);
  }
  .sub-list { display: flex; flex-direction: column; gap: 6px; }
  .sub-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 6px 2px;
  }
  .sub-name {
    font-family: 'Inter', sans-serif;
    font-size: 12px;
    font-weight: 700;
    color: #0c1224;
  }
  .sub-note {
    margin-top: 2px;
    font-family: 'Inter', sans-serif;
    font-size: 9px;
    line-height: 1.3;
    color: #6a7496;
  }
  .sale {
    margin-top: 2px;
    font-family: 'Inter', sans-serif;
    font-size: 9px;
    font-weight: 700;
    color: #b45309;
  }

  /* ── CTA：黑底白字 / 米白底黑字（无渐变） ── */
  .cta {
    flex-shrink: 0;
    border: 1.5px solid #0c1224;
    border-radius: 8px;
    font-family: 'Inter', sans-serif;
    font-weight: 800;
    cursor: pointer;
    padding: 8px 14px;
    font-size: 11px;
    background: #0c1224;
    color: #f5f3ee;
    transition: transform 0.12s ease, box-shadow 0.12s ease;
  }
  .cta.primary {
    width: 100%;
    padding: 10px 0;
    font-size: 12px;
  }
  .cta.secondary {
    padding: 6px 12px;
    font-size: 10px;
    background: #fafaf7;
    color: #0c1224;
  }
  .cta:hover:not(:disabled) {
    transform: translate(-1px, -1px);
    box-shadow: 2px 2px 0 0 #0c1224;
  }
</style>