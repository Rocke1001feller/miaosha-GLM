<script lang="ts">
  import { TOPBAR_TABS, type PopupTab } from '../tabs';
  import { version } from '../../../package.json';

  let { tab, ontabchange }: {
    tab: PopupTab;
    ontabchange: (tab: PopupTab) => void;
  } = $props();
</script>

<div class="topbar">
  <div class="brand">
    <div class="brand-mark">Z</div>
    <div class="brand-text">智能Coding Plan助手</div>
    <span class="ver">v{version}</span>
  </div>
  <div class="pill-toggle" role="tablist">
    {#each TOPBAR_TABS as t (t.id)}
      <button
        class="pill-btn"
        class:active={tab === t.id}
        role="tab"
        aria-selected={tab === t.id}
        onclick={() => ontabchange(t.id)}
      >{t.label}</button>
    {/each}
  </div>
</div>

<style>
  .topbar {
    flex: 0 0 auto;
    padding: 12px 14px 10px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    background: #ffffff;
    border-bottom: 1.5px solid #0c1224;
  }

  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .brand-mark {
    flex: 0 0 auto;
    width: 28px;
    height: 28px;
    border: 1.5px solid #0c1224;
    border-radius: 6px;
    background: #0c1224;
    color: #f5f3ee;
    display: grid;
    place-items: center;
    font-family: 'JetBrains Mono', monospace;
    font-size: 13px;
    font-weight: 700;
    line-height: 1;
  }

  .brand-text {
    font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
    font-size: 13px;
    font-weight: 700;
    color: #0c1224;
    letter-spacing: -0.1px;
    white-space: nowrap;
  }

  .ver {
    flex: 0 0 auto;
    font-family: 'JetBrains Mono', monospace;
    font-size: 9px;
    font-weight: 700;
    color: #0c1224;
    background: #fafaf7;
    padding: 2px 6px;
    border: 1px solid #0c1224;
    border-radius: 4px;
    white-space: nowrap;
  }

  .pill-toggle {
    flex: 0 0 auto;
    display: flex;
    width: 172px;
    background: #fafaf7;
    border: 1.5px solid #0c1224;
    border-radius: 8px;
    padding: 2px;
    gap: 2px;
  }

  .pill-btn {
    flex: 1 1 0;
    min-width: 0;
    padding: 5px 0;
    border: 0;
    background: transparent;
    border-radius: 6px;
    font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
    font-size: 11px;
    font-weight: 800;
    cursor: pointer;
    color: #6a7496;
    text-align: center;
    white-space: nowrap;
    transition: all 0.15s;
  }

  .pill-btn.active {
    background: #0c1224;
    color: #f5f3ee;
  }
</style>