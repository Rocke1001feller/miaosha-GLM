<script lang="ts">
  import { FOOTER_TABS, type PopupTab } from '../tabs';

  let { tab, ontabchange }: { tab: PopupTab; ontabchange: (t: PopupTab) => void } = $props();

  function openOptions() {
    chrome.runtime.openOptionsPage();
  }
</script>

<div class="footer">
  <div class="seg" role="tablist">
    <button class="seg-btn action" title="设置" onclick={openOptions}>设置</button>
    {#each FOOTER_TABS as t (t.id)}
      <button
        class="seg-btn"
        class:active={tab === t.id}
        role="tab"
        aria-selected={tab === t.id}
        onclick={() => ontabchange(t.id)}>{t.label}</button
      >
    {/each}
  </div>
</div>

<style>
  .footer {
    flex: 0 0 auto;
    padding: 8px 12px;
    background: #ffffff;
    border-top: 1.5px solid #0c1224;
  }

  /* 与 Topbar 的 pill-toggle 同一设计语言：等宽分段控件 */
  .seg {
    display: flex;
    width: 100%;
    background: #fafaf7;
    border: 1.5px solid #0c1224;
    border-radius: 8px;
    padding: 2px;
    gap: 2px;
  }

  .seg-btn {
    flex: 1 1 0;
    min-width: 0;
    border: 0;
    background: transparent;
    border-radius: 6px;
    color: #0c1224;
    font-family: 'Plus Jakarta Sans', 'Inter', sans-serif;
    font-size: 11px;
    font-weight: 800;
    padding: 6px 0;
    cursor: pointer;
    text-align: center;
    white-space: nowrap;
    transition: all 0.15s;
  }

  .seg-btn.active {
    background: #0c1224;
    color: #f5f3ee;
  }

  /* 设置是动作按钮（打开选项页），用弱化的配色与 tab 区分，永不高亮 */
  .seg-btn.action {
    color: #6a7496;
  }

  .seg-btn.action:hover {
    background: #0c1224;
    color: #f5f3ee;
  }
</style>
