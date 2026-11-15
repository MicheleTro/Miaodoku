<script lang="ts">
  import type { Snippet } from 'svelte';
  let { onclose, children, label = 'Finestra' }: { onclose?: () => void; children: Snippet; label?: string } = $props();
</script>

<div class="scrim" role="presentation" onclick={(e) => e.target === e.currentTarget && onclose?.()}>
  <div class="sheet" role="dialog" aria-modal="true" aria-label={label}>
    {@render children()}
  </div>
</div>

<style>
  .scrim {
    position: fixed; inset: 0; z-index: 50; background: rgba(15, 30, 20, 0.55);
    display: flex; align-items: flex-end; justify-content: center;
    padding-left: max(0px, env(safe-area-inset-left, 0px)); padding-right: max(0px, env(safe-area-inset-right, 0px));
  }
  .sheet {
    width: 100%; max-width: 520px; max-height: 92dvh; overflow: auto;
    background: var(--paper); border: 4px solid var(--ink); border-bottom: 0; border-radius: 30px 30px 0 0;
    padding: 18px 16px calc(20px + env(safe-area-inset-bottom, 0px));
    display: flex; flex-direction: column; gap: 14px;
    animation: up 0.28s cubic-bezier(0.2, 0.9, 0.3, 1.1);
  }
  @media (min-width: 560px) {
    .scrim { align-items: center; }
    .sheet { border: 4px solid var(--ink); border-radius: 30px; box-shadow: 0 8px 0 rgba(0, 0, 0, 0.35); }
  }
  @keyframes up { from { transform: translateY(40px); opacity: 0; } }
</style>
