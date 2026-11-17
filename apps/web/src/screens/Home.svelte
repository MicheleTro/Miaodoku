<script lang="ts">
  import { onMount } from 'svelte';
  import { api, type GameStart, type PathInfo } from '../lib/api.js';
  import { ui, go, refreshProfile, currentGameId, setCurrentGame, startPlaying, playPath, toast } from '../lib/state.svelte.js';
  import Scene from '../components/Scene.svelte';
  import Sloth from '../components/Sloth.svelte';
  import Icon from '../components/Icon.svelte';

  const p = $derived(ui.profile!);
  let resume = $state<GameStart | null>(null);
  let path = $state<PathInfo | null>(null);
  let pathError = $state('');

  async function loadPath() {
    pathError = '';
    try {
      path = await api<PathInfo>('GET', '/path');
    } catch (e) {
      pathError = (e as Error).message;
    }
  }

  onMount(async () => {
    refreshProfile().catch(() => {});
    loadPath();
    const id = currentGameId();
    if (id) {
      try {
        resume = await api<GameStart>('GET', `/games/${id}`);
      } catch {
        setCurrentGame(null);
      }
    }
  });

  const greeting = $derived(
    p.playedToday ? 'Bella partita! Un\'altra?' : p.streak > 0 ? `Serie di ${p.streak} ${p.streak === 1 ? 'giorno' : 'giorni'}: non fermarti oggi!` : 'Pronto a far dormire qualche bradipo?',
  );
</script>

<main class="page">
  <header class="hud">
    <button class="lvl" onclick={() => go('profile')} aria-label="{p.pathDone} quadri completati; {p.xpInto} su {p.xpNeed} XP. Apri il profilo">
      <span class="star" title="Quadri del Percorso completati"><svg viewBox="0 0 50 50"><path d="M25 3l6.5 13.5 14.5 2-10.5 10 2.6 14.5L25 36l-13.1 7 2.6-14.5L4 18.5l14.5-2z" fill="#ffc93c" stroke="#22301f" stroke-width="3.5" stroke-linejoin="round" /></svg><b class="num">{p.pathDone}</b></span>
      <span class="xpbar" title="XP verso il prossimo rango"><i style="width:{(p.xpInto / p.xpNeed) * 100}%"></i></span>
    </button>
    <span class="pill" title="Serie di presenza"><span class="ic flame"><Icon name="flame" /></span><span class="num">{p.streak}</span></span>
    <span class="pill" title="Lumi: suggerimenti senza penalità"><span class="ic lume"><Icon name="lume" /></span><span class="num">{p.lumi}</span></span>
  </header>

  <Scene accessory={p.accessory} mood={p.playedToday ? 'happy' : 'sleepy'} />

  <div class="bubble rise">
    <b>Ciao {p.username}!</b> {greeting}
  </div>

  {#if resume?.challengeId}
    <button class="card resume rise" onclick={() => startPlaying(resume!)}>
      <span class="grow"><b>Sfida in corso</b><br /><span class="muted">{resume.level.n}×{resume.level.n}{resume.level.rating.hard ? ' · Difficile' : ''}</span></span>
      <span class="btn btn-sm btn-leaf">Riprendi</span>
    </button>
  {/if}

  <div class="actions">
    <section class="card quadro rise" aria-label="Prossimo quadro del Percorso">
      {#if path}
        <div class="row between">
          <span class="kicker">Percorso</span>
          <span class="muted num small">seme {path.next.seed}</span>
        </div>
        <div class="row">
          <b class="qn outline-text num">Quadro {path.next.k}</b>
          <span class="chip num">{path.next.n}×{path.next.n}</span>
          {#if path.next.hard}<span class="chip hard">Difficile</span>{/if}
        </div>
      {:else if pathError}
        <p class="error">{pathError} <button class="link dark" onclick={loadPath}>Riprova</button></p>
      {:else}
        <p class="muted"><span class="mini"><Sloth variant={3} mood="sleepy" /></span> Preparo il prossimo quadro…</p>
      {/if}
    </section>
    <button class="btn btn-sun btn-big btn-block" onclick={playPath} disabled={ui.pathBusy || !path}>
      {#if ui.pathBusy}<span class="mini"><Sloth variant={3} mood="sleepy" /></span> Preparo la griglia…{:else}<Icon name="play" /> {path?.playingGameId ? 'Riprendi' : 'Gioca'}{/if}
    </button>
    <div class="two">
      <button class="btn btn-berry btn-block sfide" onclick={() => go('challenges')}>
        <Icon name="swords" /> Sfide
        {#if p.challengesToPlay}<span class="badge num">{p.challengesToPlay}</span>{/if}
      </button>
      <button class="btn btn-block" onclick={() => go('profile')}><Icon name="user" /> Profilo</button>
    </div>
  </div>

  <footer class="rank">
    <span class="outline-text">{p.rank}</span> · {p.xpInto}/{p.xpNeed} XP verso il grado {p.level + 1}
    <button class="link" onclick={() => toast('Ogni 10 giorni di fila ricevi 2 Lumi: suggerimenti completi senza penalità.')}>Cos'è un Lume?</button>
  </footer>
</main>

<style>
  .hud { display: flex; align-items: center; gap: 8px; }
  .lvl { display: flex; align-items: center; flex: 1; min-width: 0; background: none; border: 0; padding: 0; }
  .star { position: relative; width: 52px; height: 52px; flex: none; display: grid; place-items: center; z-index: 1; }
  .star svg { position: absolute; inset: 0; }
  .star b { position: relative; font-family: var(--f-display); font-size: 1.2rem; margin-top: 3px; }
  .lvl .xpbar { flex: 1; max-width: 130px; margin-left: -12px; height: 18px; border-radius: 0 10px 10px 0; }
  .ic { width: 24px; height: 24px; display: grid; place-items: center; }
  .ic :global(svg) { width: 20px; height: 20px; }
  .flame { color: var(--berry); }
  .lume { color: var(--sun-d); }
  .bubble {
    position: relative; background: var(--paper); border: 3px solid var(--ink); border-radius: 18px; padding: 10px 14px;
    font-size: 1.05rem; box-shadow: 0 4px 0 rgba(34, 48, 31, 0.45); margin-top: -10px;
  }
  .bubble::before { content: ''; position: absolute; left: 50%; top: -14px; margin-left: -10px; border: 10px solid transparent; border-bottom: 12px solid var(--ink); border-top: 0; }
  .bubble::after { content: ''; position: absolute; left: 50%; top: -9px; margin-left: -7px; border: 7px solid transparent; border-bottom: 9px solid var(--paper); border-top: 0; }
  .resume { display: flex; align-items: center; gap: 10px; text-align: left; }
  .actions { display: flex; flex-direction: column; gap: 14px; margin-top: auto; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .sfide { position: relative; }
  .badge {
    position: absolute; top: -10px; right: -8px; min-width: 26px; height: 26px; padding: 0 6px; border-radius: 13px;
    background: var(--sun); color: var(--ink); border: 3px solid var(--ink); font-size: 0.9rem; display: grid; place-items: center; text-shadow: none;
  }
  .quadro { display: flex; flex-direction: column; gap: 6px; padding: 10px 14px; }
  .quadro .row { gap: 8px; flex-wrap: wrap; }
  .kicker { text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.8rem; color: var(--bark); font-weight: 800; }
  .qn { font-family: var(--f-display); font-size: 1.5rem; margin-right: auto; }
  .small { font-size: 0.85rem; }
  .mini { width: 30px; height: 30px; display: inline-block; vertical-align: middle; animation: bob 0.8s ease-in-out infinite; }
  .link.dark { display: inline; color: inherit; }
  .rank { color: #fff; text-align: center; font-weight: 800; font-size: 0.95rem; }
  .rank .outline-text { font-family: var(--f-display); font-size: 1.1rem; }
  .link { display: block; margin: 4px auto 0; background: none; border: 0; color: var(--sun-l); text-decoration: underline; font-weight: 800; }
</style>
