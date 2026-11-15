<script lang="ts">
  import { MEDALS } from '@bradoku/core';
  let { id, earned = true, big = false }: { id: string; earned?: boolean; big?: boolean } = $props();
  const m = $derived(MEDALS.find((x) => x.id === id));
</script>

{#if m}
  <div class="medal" class:big title="{m.name}: {m.desc}">
    <span class="disc {m.family}" class:off={!earned}>{m.glyph}</span>
    <span class="name">{m.name}</span>
  </div>
{/if}

<style>
  .medal { display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; min-width: 0; }
  .disc {
    width: 56px; height: 56px; border-radius: 50%; border: 3px solid var(--ink); box-shadow: 0 3px 0 var(--ink);
    display: grid; place-items: center; font-family: var(--f-display); font-weight: 800; font-size: 1rem;
    background: radial-gradient(circle at 35% 30%, #ffe9a0, var(--sun));
  }
  .tecniche { background: radial-gradient(circle at 35% 30%, #d8f5cf, var(--leaf)); color: #fff; text-shadow: 0 2px 0 var(--ink); }
  .sfide { background: radial-gradient(circle at 35% 30%, #ffc7cd, var(--berry)); color: #fff; text-shadow: 0 2px 0 var(--ink); }
  .serie { background: radial-gradient(circle at 35% 30%, #d6f0fb, #5aa9d6); color: #fff; text-shadow: 0 2px 0 var(--ink); }
  .off { background: var(--grey); color: #8b9285; text-shadow: none; border-color: #8b9285; box-shadow: 0 3px 0 #8b9285; }
  .name { font-size: 0.7rem; line-height: 1.1; font-weight: 800; max-width: 72px; }
  .big .disc { width: 92px; height: 92px; font-size: 1.6rem; animation: pop 0.6s cubic-bezier(0.2, 1.5, 0.4, 1); }
  .big .name { font-size: 0.95rem; max-width: 120px; }
</style>
