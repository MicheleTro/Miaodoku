<script lang="ts">
  import type { CategoryId } from '@bradoku/core';
  import { api, storage, type GameStart } from '../lib/api.js';
  import { ui, startPlaying, LAST_SETUP } from '../lib/state.svelte.js';
  import Modal from './Modal.svelte';
  import Sloth from './Sloth.svelte';
  import Icon from './Icon.svelte';

  const DIFFS: { id: CategoryId; name: string; hint: string }[] = [
    { id: 'facile', name: 'Facile', hint: 'Ultima casella e Allineamento' },
    { id: 'medio', name: 'Medio', hint: 'Serve anche il Vicinato' },
    { id: 'difficile', name: 'Difficile', hint: 'Serve almeno una Coppia' },
    { id: 'esperto', name: 'Esperto', hint: 'Terne e Quaterne' },
    { id: 'diabolico', name: 'Diabolico', hint: 'Bisogna ragionare per ipotesi' },
  ];
  const saved = (() => {
    try {
      return JSON.parse(storage.get(LAST_SETUP) ?? '{}') as { n?: number; difficulty?: CategoryId };
    } catch {
      return {};
    }
  })();
  let n = $state(saved.n ?? 6);
  let difficulty = $state<CategoryId>(saved.difficulty ?? 'facile');
  let busy = $state(false);
  let error = $state('');

  async function play() {
    busy = true;
    error = '';
    storage.set(LAST_SETUP, JSON.stringify({ n, difficulty }));
    try {
      startPlaying(await api<GameStart>('POST', '/games', { n, difficulty }));
    } catch (e) {
      error = (e as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<Modal onclose={() => !busy && (ui.newGameOpen = false)} label="Nuova partita">
  <div class="row">
    <h2 class="grow">Nuova partita</h2>
    <button class="icon-btn" onclick={() => (ui.newGameOpen = false)} aria-label="Chiudi"><Icon name="close" /></button>
  </div>
  <div class="stack">
    <h3>Griglia</h3>
    <div class="seg">
      {#each [5, 6, 7, 8, 9, 10] as s (s)}
        <button aria-pressed={n === s} onclick={() => (n = s)}>{s}×{s}</button>
      {/each}
    </div>
    <h3>Difficoltà</h3>
    <div class="diffs">
      {#each DIFFS as d (d.id)}
        <button class="diff" aria-pressed={difficulty === d.id} onclick={() => (difficulty = d.id)}>
          <span class="chip {d.id}">{d.name}</span><span class="muted">{d.hint}</span>
        </button>
      {/each}
    </div>
  </div>
  {#if error}<p class="error" role="alert">{error}</p>{/if}
  <button class="btn btn-sun btn-big btn-block" onclick={play} disabled={busy}>
    {#if busy}<span class="mini"><Sloth variant={3} mood="sleepy" /></span> Preparo la griglia…{:else}<Icon name="play" /> Gioca{/if}
  </button>
</Modal>

<style>
  h3 { font-size: 1.1rem; }
  .diffs { display: flex; flex-direction: column; gap: 8px; }
  .diff {
    display: flex; align-items: center; gap: 10px; text-align: left; border: 2.5px solid var(--ink); border-radius: 14px;
    background: #fff; padding: 8px 10px; box-shadow: 0 3px 0 var(--ink); font-weight: 700;
  }
  .diff[aria-pressed='true'] { background: var(--sun-l); outline: 3px solid var(--sun-d); outline-offset: -1px; }
  .mini { width: 34px; height: 34px; display: inline-block; animation: bob 0.8s ease-in-out infinite; }
</style>
