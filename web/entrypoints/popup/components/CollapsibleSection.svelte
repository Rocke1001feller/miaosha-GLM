<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    label,
    defaultOpen = false,
    preview = '',
    children,
  }: {
    label: string;
    defaultOpen?: boolean;
    preview?: string;
    children: Snippet;
  } = $props();

  let isOpen = $state(false);
  let initialized = false;

  $effect(() => {
    if (!initialized) {
      isOpen = defaultOpen;
      initialized = true;
    }
  });
</script>

<div class="collapsible">
  <button class="collapsible-header" onclick={() => isOpen = !isOpen}>
    <span class="chevron" class:open={isOpen}>&#9656;</span>
    <span class="label">{label}</span>
    {#if !isOpen && preview}
      <span class="preview">{preview}</span>
    {/if}
  </button>
  {#if isOpen}
    <div class="collapsible-body">
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .collapsible {
    margin-top: 6px;
  }

  .collapsible-header {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 6px 0;
    border: 0;
    background: transparent;
    cursor: pointer;
    font-family: inherit;
    font-size: 9px;
    font-weight: 700;
    color: #94a3b8;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    text-align: left;
  }

  .chevron {
    font-size: 10px;
    transition: transform 0.15s ease;
    flex-shrink: 0;
  }

  .chevron.open {
    transform: rotate(90deg);
  }

  .label {
    flex-shrink: 0;
  }

  .preview {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
    text-transform: none;
    letter-spacing: normal;
    color: #64748b;
  }

  .collapsible-body {
    padding: 0;
  }
</style>
