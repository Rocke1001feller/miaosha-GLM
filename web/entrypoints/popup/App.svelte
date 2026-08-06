<script lang="ts">
  import { onMount } from 'svelte';
  import { DEFAULT_TAB, type PopupTab } from './tabs';
  import Topbar from './components/Topbar.svelte';
  import Footer from './components/Footer.svelte';
  import NewsContent from './components/news/NewsContent.svelte';
  import PlatformEntryGrid from './components/PlatformEntryGrid.svelte';
  import UsageView from './components/UsageView.svelte';
  import PlaceholderPanel from './components/PlaceholderPanel.svelte';

  // 单一激活 tab：header 与 footer 的全部面板互斥，点击即切换。
  // 每次打开 popup 默认显示 Token 用量。
  let tab = $state<PopupTab>(DEFAULT_TAB);

  // 买家秀面板：内嵌 any-comments vendored popup（public/buyer-show/）。
  // 设计稿 420×580，按面板可用空间等比缩小并居中（超出部分对称裁剪）。
  let frameW = $state(0);
  let frameH = $state(0);
  const buyerScale = $derived(
    frameW > 0 && frameH > 0 ? Math.min(frameW / 420, frameH / 580, 1) : 1,
  );

  onMount(() => {
    // Acknowledge a transient purchase-success or countdown badge when the user
    // opens the popup. This gives the user a manual escape hatch if an alarm
    // was missed and the badge got stuck (e.g. 60 still showing at T-30).
    chrome.action.getBadgeText({}).then((text) => {
      if (text === 'OK' || /^(60|30|15|10|5!|🔥)$/.test(text)) {
        chrome.action.setBadgeText({ text: '' });
        chrome.action.setTitle({ title: '' });
      }
    });
  });
</script>

<div class="shell">
  <Topbar {tab} ontabchange={(t) => (tab = t)} />

  {#if tab === 'news'}
    <NewsContent />
  {:else if tab === 'usage'}
    <UsageView />
  {:else if tab === 'seckill'}
    <PlatformEntryGrid />
  {:else if tab === 'buyer-show'}
    <div class="buyer-show-frame" bind:clientWidth={frameW} bind:clientHeight={frameH}>
      <iframe
        src="/buyer-show/popup.html"
        title="买家秀 · Coding Plan 吐槽大会"
        style:transform="scale({buyerScale})"
      ></iframe>
    </div>
  {:else}
    <PlaceholderPanel
      title="拼团转让交易"
      description="加群拼团套餐 · 转让 / 交易闲置套餐"
    />
  {/if}

  <Footer {tab} ontabchange={(t) => (tab = t)} />
</div>

<style>
  :global(*) {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  :global(body) {
    font-family: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    color: #0c1224;
    background: #f5f3ee;
    width: 380px;
    min-height: 520px;
    overflow: hidden;
    /* 工程蓝图网格底纹 */
    background-image:
      linear-gradient(rgba(12, 18, 36, 0.04) 1px, transparent 1px),
      linear-gradient(90deg, rgba(12, 18, 36, 0.04) 1px, transparent 1px);
    background-size: 18px 18px;
  }

  .shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
    background: #ffffff;
  }

  .buyer-show-frame {
    flex: 1;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    background: #ffffff;
  }

  .buyer-show-frame iframe {
    flex: none;
    width: 420px;
    height: 580px;
    border: 0;
    transform-origin: center center;
  }
</style>
