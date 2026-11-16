<script lang="ts">
  import type { CategoryId } from '@bradoku/core';
  import { api, type ChallengeView, type Friend } from '../lib/api.js';
  import { auth } from '../lib/auth.svelte.js';
  import { ui, go, toast } from '../lib/state.svelte.js';
  import Modal from './Modal.svelte';
  import Icon from './Icon.svelte';

  const from = ui.challengeFrom!;
  // Si sfidano solo gli amici del portale whoru (decisione whoru #28): l'elenco arriva dal server.
  let friends = $state<Friend[] | null>(null);
  let opponent = $state<Friend | null>(null);
  let n = $state(7);
  let difficulty = $state<CategoryId>('medio');
  let busy = $state(false);
  let error = $state('');

  api<Friend[]>('GET', '/friends')
    .then((list) => (friends = list))
    .catch((err) => {
      friends = [];
      error = (err as Error).message;
    });

  async function send(e: SubmitEvent) {
    e.preventDefault();
    if (!opponent) return;
    busy = true;
    error = '';
    try {
      const body = from.gameId ? { opponent: opponent.id, fromGameId: from.gameId } : { opponent: opponent.id, n, difficulty };
      await api<ChallengeView>('POST', '/challenges', body);
      ui.challengeFrom = null;
      toast(`Sfida inviata a ${opponent.username}!`);
      go('challenges');
    } catch (err) {
      error = (err as Error).message;
    } finally {
      busy = false;
    }
  }
</script>

<Modal onclose={() => !busy && (ui.challengeFrom = null)} label="Nuova sfida">
  <form class="stack" onsubmit={send}>
    <div class="row">
      <h2 class="grow">{from.gameId ? 'Sfida su questo livello' : 'Nuova sfida'}</h2>
      <button type="button" class="icon-btn" onclick={() => (ui.challengeFrom = null)} aria-label="Chiudi"><Icon name="close" /></button>
    </div>
    <p class="muted">
      {from.gameId ? 'Il tuo risultato è già registrato: il tuo amico giocherà lo stesso identico livello.' : 'Giocate lo stesso livello, ognuno quando vuole. Vince chi fa più punti.'}
    </p>
    <h3>Chi sfidi?</h3>
    {#if friends === null}
      <p class="muted">Carico i tuoi amici…</p>
    {:else if friends.length}
      <div class="seg">
        {#each friends as f (f.id)}
          <button type="button" aria-pressed={opponent?.id === f.id} onclick={() => (opponent = f)}>{f.username}</button>
        {/each}
      </div>
    {:else if !error}
      <p class="muted">
        Non hai ancora amici. Aggiungili dal
        {#if auth.user}<a href={auth.user.portalUrl}>portale</a>{:else}portale{/if}: poi potrai sfidarli qui.
      </p>
    {/if}
    {#if !from.gameId}
      <h3>Griglia</h3>
      <div class="seg">
        {#each [5, 6, 7, 8, 9, 10] as s (s)}<button type="button" aria-pressed={n === s} onclick={() => (n = s)}>{s}×{s}</button>{/each}
      </div>
      <h3>Difficoltà</h3>
      <div class="seg">
        {#each [['facile', 'Facile'], ['medio', 'Medio'], ['difficile', 'Difficile'], ['esperto', 'Esperto'], ['diabolico', 'Diabolico']] as [id, name] (id)}
          <button type="button" aria-pressed={difficulty === id} onclick={() => (difficulty = id as CategoryId)}>{name}</button>
        {/each}
      </div>
    {/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <button class="btn btn-berry btn-big btn-block" disabled={busy || !opponent}><Icon name="swords" /> Lancia la sfida</button>
  </form>
</Modal>

<style>
  h3 { font-size: 1.05rem; }
</style>
