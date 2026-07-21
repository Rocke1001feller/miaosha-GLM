<script lang="ts">
  import { onMount } from 'svelte';
  import { storage } from '#imports';
  import { usageCacheStore } from '../../../lib/usage/store';
  import type { UsageCache, UsagePlatform } from '../../../lib/usage/types';

  const PLATFORM_ORDER: UsagePlatform[] = ['minimax', 'kimi', 'mimo', 'volcengine'];

  let cache = $state<UsageCache>({});
  let refreshing = $state(false);
  let loaded = $state(false);

  async function loadCache() {
    cache = await usageCacheStore.get();
    loaded = true;
  }

  async function refresh() {
    if (refreshing) return;
    refreshing = true;
    try {
      await chrome.runtime.sendMessage({ type: 'USAGE_FETCH' });
      await loadCache();
    } finally {
      refreshing = false;
    }
  }

  onMount(() => {
    loadCache().then(() => refresh());
    const unwatch = storage.watch<UsageCache>('local:usageCache', (newCache) => {
      if (newCache) cache = newCache;
    });
    return () => unwatch();
  });

  function pct(p: number): string {
    return (Math.min(1, p) * 100).toFixed(1) + '%';
  }

  function resetText(resetAt?: number): string {
    if (!resetAt) return '';
    const ms = resetAt - Date.now();
    if (ms <= 0) return '即将重置';
    const h = Math.floor(ms / 3600000);
    const d = Math.floor(h / 24);
    if (d >= 1) return `${d} 天 ${h % 24} 小时后重置`;
    if (h >= 1) return `${h} 小时后重置`;
    return `${Math.max(1, Math.floor(ms / 60000))} 分钟后重置`;
  }

  function timeText(ts: number): string {
    const d = new Date(ts);
    const p2 = (n: number) => String(n).padStart(2, '0');
    return `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
  }

  function openConsole(url: string) {
    chrome.tabs.create({ url });
  }
</script>

<div class="usage">
  <div class="bar">
    <span class="hint">用量直连各平台控制台（M6）</span>
    <button class="refresh" onclick={refresh} disabled={refreshing}>
      {refreshing ? '刷新中…' : '↻ 刷新'}
    </button>
  </div>

  {#if loaded && PLATFORM_ORDER.every((p) => !cache[p])}
    <div class="empty">暂无数据，正在首次刷新…</div>
  {/if}

  {#each PLATFORM_ORDER as pid (pid)}
    {@const c = cache[pid]}
    <article class="card">
      <header class="head">
        <span class="pname">{c?.displayName ?? pid}</span>
        {#if c?.planName}<span class="plan">{c.planName}</span>{/if}
        <span class="time">{c ? timeText(c.fetchedAt) : '--:--:--'}</span>
      </header>

      {#if !c}
        <div class="row muted">等待数据…</div>
      {:else if c.status === 'needs_login'}
        <div class="row warn">
          {c.errorMessage ?? '未登录'} ·
          <button class="link" onclick={() => openConsole(c.consoleUrl)}>打开控制台 →</button>
        </div>
      {:else if c.status === 'no_subscription'}
        <div class="row muted">未订阅</div>
      {:else if c.status === 'error'}
        <div class="row warn">获取失败：{c.errorMessage ?? 'unknown'}</div>
      {:else}
        {#each c.bars as b (b.label)}
          <div class="urow">
            <div class="ulabel">{b.label}</div>
            <div class="ubar">
              <div class="ufill" class:hot={b.percent >= 0.8} style:width={pct(b.percent)}></div>
            </div>
            <div class="uval">{pct(b.percent)}</div>
          </div>
          {#if b.usedText || b.resetAt}
            <div class="usub">
              {#if b.usedText}<span>{b.usedText}</span>{/if}
              {#if b.resetAt}<span>{resetText(b.resetAt)}</span>{/if}
            </div>
          {/if}
        {/each}
        {#if c.bars.length === 0}
          <div class="row muted">暂无用量数据</div>
        {/if}
        {#if c.note}<div class="row muted small">{c.note}</div>{/if}
      {/if}
    </article>
  {/each}
</div>

<style>
  .usage {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 10px 14px 12px;
    overflow-y: auto;
  }
  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .hint {
    font-size: 9px;
    color: #6a7496;
  }
  .refresh {
    border: 1.5px solid #0c1224;
    border-radius: 8px;
    background: #0c1224;
    color: #f5f3ee;
    font-size: 10px;
    font-weight: 800;
    padding: 5px 10px;
    cursor: pointer;
  }
  .refresh:disabled {
    opacity: 0.6;
    cursor: default;
  }
  .empty {
    text-align: center;
    font-size: 11px;
    color: #6a7496;
    padding: 20px 0;
  }
  .card {
    background: #ffffff;
    border: 1.5px solid #0c1224;
    border-radius: 12px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    box-shadow: 3px 3px 0 0 #0c1224;
  }
  .head {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .pname {
    font-size: 13px;
    font-weight: 800;
  }
  .plan {
    font-size: 9px;
    color: #6a7496;
    border: 1px solid rgba(12, 18, 36, 0.3);
    border-radius: 4px;
    padding: 1px 5px;
  }
  .time {
    margin-left: auto;
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    color: #9aa3b8;
  }
  .row {
    font-size: 11px;
  }
  .muted {
    color: #6a7496;
  }
  .small {
    font-size: 9px;
  }
  .warn {
    color: #b45309;
    font-weight: 600;
  }
  .link {
    border: none;
    background: none;
    color: #0c1224;
    font-weight: 800;
    text-decoration: underline;
    cursor: pointer;
    font-size: 11px;
    padding: 0;
  }
  .urow {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .ulabel {
    flex: 0 0 64px;
    font-size: 10px;
    font-weight: 700;
  }
  .ubar {
    flex: 1;
    height: 8px;
    border: 1px solid #0c1224;
    border-radius: 4px;
    overflow: hidden;
    background: #f5f3ee;
  }
  .ufill {
    height: 100%;
    background: #0c1224;
    transition: width 0.3s;
  }
  .ufill.hot {
    background: #ef4444;
  }
  .uval {
    flex: 0 0 44px;
    text-align: right;
    font-family: 'JetBrains Mono', monospace;
    font-size: 10px;
  }
  .usub {
    display: flex;
    justify-content: space-between;
    padding-left: 72px;
    font-size: 9px;
    color: #6a7496;
  }
</style>
