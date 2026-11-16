<script lang="ts">
  import { onMount } from 'svelte';
  import { api, type ChallengeView, type Friend, type GameStart } from '../lib/api.js';
  import { ui, go, startPlaying, toast } from '../lib/state.svelte.js';
  import Sloth from '../components/Sloth.svelte';
  import Icon from '../components/Icon.svelte';

  let list = $state<ChallengeView[] | null>(null);
  let friends = $state<Friend[]>([]);
  let tab = $state<'turn' | 'wait' | 'done'>('turn');
  let busy = $state(0);
  let error = $state('');

  async function load() {
    try {
      [list, friends] = await Promise.all([api<ChallengeView[]>('GET', '/challenges'), api<Friend[]>('GET', '/friends')]);
      if (list && !list.some((c) => c.myTurn) && list.some((c) => c.status === 'open')) tab = 'wait';
    } catch (e) {
      error = (e as Error).message;
    }
  }
  onMount(load);

  const groups = $derived({
    turn: (list ?? []).filter((c) => c.myTurn),
    wait: (list ?? []).filter((c) => c.status === 'open' && !c.myTurn),
    done: (list ?? []).filter((c) => c.status === 'completed'),
  });
  const shown = $derived(groups[tab]);

  async function play(c: ChallengeView) {
    busy = c.id;
    try {
      startPlaying(await api<GameStart>('POST', `/challenges/${c.id}/play`));
    } catch (e) {
      toast((e as Error).message);
    } finally {
      busy = 0;
    }
  }
  async function rematch(c: ChallengeView) {
    busy = c.id;
    try {
      await api<ChallengeView>('POST', `/challenges/${c.id}/rematch`);
      toast(`Rivincita lanciata a ${c.opponent}!`);
      tab = 'turn';
      await load();
    } catch (e) {
      toast((e as Error).message);
    } finally {
      busy = 0;
    }
  }
  const avatar = (name: string) => [...name].reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const fmt = (ms = 0) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
</script>

<main class="page">
  <header class="row">
    <button class="icon-btn" onclick={() => go('home')} aria-label="Indietro"><Icon name="back" /></button>
    <h1 class="grow center outline-text">Sfide</h1>
    <span style="width:46px"></span>
  </header>

  <button class="btn btn-berry btn-big btn-block" onclick={() => (ui.challengeFrom = {})}><Icon name="plus" /> Nuova sfida</button>

  <div class="tabs" role="tablist">
    <button role="tab" aria-selected={tab === 'turn'} onclick={() => (tab = 'turn')}>Tocca a te{groups.turn.length ? ` · ${groups.turn.length}` : ''}</button>
    <button role="tab" aria-selected={tab === 'wait'} onclick={() => (tab = 'wait')}>In attesa</button>
    <button role="tab" aria-selected={tab === 'done'} onclick={() => (tab = 'done')}>Concluse</button>
  </div>

  {#if error}<p class="error">{error}</p>{/if}
  {#if list === null}
    <p class="empty outline-text">Carico…</p>
  {:else if !shown.length}
    <div class="card center emptycard">
      <span class="pic"><Sloth variant={7} mood="sleepy" /></span>
      <p>{tab === 'turn' ? 'Nessuna sfida da giocare. Lanciane una tu!' : tab === 'wait' ? 'Nessuna sfida in attesa degli altri.' : 'Ancora nessuna sfida conclusa.'}</p>
    </div>
  {:else}
    <ul class="list">
      {#each shown as c (c.id)}
        <li class="card ch rise" class:win={c.outcome === 'win'} class:loss={c.outcome === 'loss'}>
          <span class="av"><Sloth variant={avatar(c.opponent)} mood={c.outcome === 'win' ? 'sleepy' : 'happy'} /></span>
          <div class="grow">
            <b class="name">{c.opponent}</b>
            <div class="meta"><span class="chip {c.difficulty}">{c.categoryName}</span> <span class="chip">{c.n}×{c.n}</span>{#if c.rematchOf}<span class="chip">rivincita</span>{/if}</div>
            {#if c.status === 'completed'}
              <p class="score num">Tu {c.me.points} · {c.opponent} {c.them.points}</p>
            {:else if c.myTurn}
              <p class="muted">{c.them.played ? `${c.opponent} ha già giocato: tocca a te!` : 'Ti aspetta un livello nuovo.'}</p>
            {:else}
              <p class="muted num">Hai fatto {c.me.points} punti in {fmt(c.me.durationMs)}. Aspetti {c.opponent}.</p>
            {/if}
          </div>
          {#if c.myTurn}
            <button class="btn btn-sm btn-sun" onclick={() => play(c)} disabled={busy === c.id}>Gioca</button>
          {:else if c.status === 'completed'}
            <div class="end">
              <span class="res {c.outcome}">{c.outcome === 'win' ? 'Vinta' : c.outcome === 'loss' ? 'Persa' : 'Pari'}</span>
              <button class="btn btn-sm" onclick={() => rematch(c)} disabled={busy === c.id}>Rivincita</button>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}

  {#if friends.length}
    <section class="card stack">
      <h2>Bilancio con gli amici</h2>
      {#each friends as f (f.id)}
        <div class="row friend">
          <span class="av sm"><Sloth variant={avatar(f.username)} /></span>
          <b class="grow">{f.username}</b>
          <span class="num"><b class="w">{f.wins}</b> vinte · <b class="l">{f.losses}</b> perse{f.draws ? ` · ${f.draws} pari` : ''}</span>
        </div>
      {/each}
    </section>
  {/if}
</main>

<style>
  h1 { font-size: 2.2rem; }
  .tabs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; background: var(--paper-2); border: 3px solid var(--ink); border-radius: 16px; padding: 4px; }
  .tabs button { border: 0; background: none; border-radius: 11px; padding: 8px 4px; font-family: var(--f-display); font-weight: 800; font-size: 0.98rem; color: var(--ink-2); }
  .tabs button[aria-selected='true'] { background: var(--berry); color: #fff; box-shadow: 0 3px 0 var(--ink); }
  .list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
  .ch { display: flex; align-items: center; gap: 12px; padding: 12px; }
  .ch.win { background: #effae9; }
  .ch.loss { background: #fff1ef; }
  .av { width: 54px; height: 54px; flex: none; }
  .av.sm { width: 36px; height: 36px; }
  .name { font-family: var(--f-display); font-size: 1.2rem; }
  .meta { display: flex; flex-wrap: wrap; gap: 4px; margin: 2px 0 4px; }
  .meta .chip { font-size: 0.8rem; }
  .score { font-weight: 800; }
  .end { display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .res { font-family: var(--f-display); font-weight: 800; }
  .res.win { color: #2c8a3e; }
  .res.loss { color: var(--berry-d); }
  .empty { text-align: center; font-family: var(--f-display); font-size: 1.3rem; }
  .emptycard { display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .pic { width: 90px; height: 90px; }
  .friend { padding: 4px 0; border-bottom: 2px dashed var(--bark-l); }
  .friend:last-child { border-bottom: 0; }
  .w { color: #2c8a3e; }
  .l { color: var(--berry-d); }
</style>
