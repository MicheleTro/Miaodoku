<script lang="ts">
  import { onMount } from 'svelte';
  import { ACCESSORIES } from '@bradoku/core';
  import { ui, go, playPath } from '../lib/state.svelte.js';
  import Sloth from '../components/Sloth.svelte';
  import MedalBadge from '../components/MedalBadge.svelte';
  import Icon from '../components/Icon.svelte';

  const r = ui.result!;
  const s = r.score;
  const ch = r.challenge;
  const levelUp = r.xp.levelAfter > r.xp.levelBefore;
  let shown = $state(0);
  let barWidth = $state(levelUp ? 0 : Math.max(0, ((r.xp.xpInto - s.points) / r.xp.xpNeed) * 100));

  onMount(() => {
    const t0 = performance.now();
    const dur = 900;
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      shown = Math.round(s.points * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    setTimeout(() => (barWidth = (r.xp.xpInto / r.xp.xpNeed) * 100), 400);
  });

  const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
  const x = (v: number) => `×${v.toFixed(2).replace(/\.?0+$/, '').replace('.', ',')}`;
  const accName = (id: string) => ACCESSORIES.find((a) => a.id === id)?.name ?? id;
</script>

<main class="page">
  <div class="hero rise">
    <div class="burst" aria-hidden="true">
      <svg viewBox="0 0 200 200"><g fill="#ffc93c" stroke="#22301f" stroke-width="4" stroke-linejoin="round"><path d="M100 6 120 46 162 28 154 74 196 88 158 112 180 152 134 148 120 192 100 156 80 192 66 148 20 152 42 112 4 88 46 74 38 28 80 46z" /></g></svg>
      <div class="pts"><b class="num">+{shown}</b><span>punti</span></div>
    </div>
    <h1 class="outline-text">{ch?.status === 'completed' ? (ch.outcome === 'win' ? 'Hai vinto la sfida!' : ch.outcome === 'draw' ? 'Pareggio!' : 'Sfida persa, per poco!') : 'Tutti a nanna!'}</h1>
  </div>

  <section class="card stack">
    <div class="row between"><span>Difficoltà ({r.level.n}×{r.level.n}{r.level.hard ? ' · Difficile' : ''})</span><b class="num">{String(s.base).replace('.', ',')}</b></div>
    <div class="row between">
      <span>Velocità: {fmt(s.durationMs)} su {fmt(s.parMs)}{s.hard && s.speedPoints ? ' · conta doppio' : ''}</span><b class="num">+{s.speedPoints}</b>
    </div>
    <div class="row between"><span>{s.cleanMult > 1 ? 'Partita pulita' : 'Qualche bradipo fuori posto'}</span><b class="num">{x(s.cleanMult)}</b></div>
    <div class="row between"><span>{s.hintMult >= 1.5 ? 'Senza suggerimenti' : 'Suggerimenti usati'}</span><b class="num">{x(s.hintMult)}</b></div>
    <hr />
    <div class="row">
      <span class="lv num">{r.xp.levelAfter}</span>
      <div class="grow">
        <div class="xpbar"><i style="width:{barWidth}%"></i></div>
        <span class="muted small num">{r.xp.xpInto}/{r.xp.xpNeed} XP · {r.xp.rank}</span>
      </div>
    </div>
    {#if levelUp}<p class="banner leaf">Grado {r.xp.levelAfter}! Sei salito di grado.</p>{/if}
    {#if r.path?.advanced}<p class="banner sun">Quadro {r.path.k} completato · {r.path.done} nel Percorso</p>{/if}
    <p class="banner">
      <Icon name="flame" /> Serie: {r.streak.value} {r.streak.value === 1 ? 'giorno' : 'giorni'}
      {#if r.streak.lumiGained}· <b>+{r.streak.lumiGained} Lumi!</b>{:else if r.streak.firstToday}· oggi fatto{/if}
    </p>
  </section>

  {#if ch}
    <section class="card stack">
      <h2>Sfida con {ch.opponent}</h2>
      {#if ch.status === 'completed'}
        <div class="vs">
          <div><b class="num">{ch.me.points}</b><span>Tu</span></div>
          <span class="outline-text">VS</span>
          <div><b class="num">{ch.them.points}</b><span>{ch.opponent}</span></div>
        </div>
      {:else}
        <p>Fatto! Ora tocca a <b>{ch.opponent}</b>: vedrai il risultato appena gioca.</p>
      {/if}
    </section>
  {/if}

  {#if r.newMedals.length || r.newAccessories.length}
    <section class="card stack">
      <h2>Novità per te</h2>
      <div class="news">
        {#each r.newMedals as m (m)}<MedalBadge id={m} big />{/each}
        {#each r.newAccessories as a (a)}
          <div class="acc"><span class="accpic"><Sloth variant={0} accessory={a} mood="happy" /></span><span>{accName(a)}</span></div>
        {/each}
      </div>
    </section>
  {/if}

  <div class="stack">
    {#if !ch}
      <button class="btn btn-berry btn-block" onclick={() => (ui.challengeFrom = { gameId: r.gameId })}><Icon name="swords" /> Sfida un amico su questo quadro</button>
    {/if}
    <div class="two">
      <button class="btn btn-sun btn-block" onclick={playPath} disabled={ui.pathBusy}><Icon name="play" /> {ui.pathBusy ? 'Preparo…' : 'Prossimo quadro'}</button>
      <button class="btn btn-block" onclick={() => go(ch ? 'challenges' : 'home')}>{ch ? 'Sfide' : 'Home'}</button>
    </div>
  </div>
</main>

<style>
  .hero { text-align: center; display: flex; flex-direction: column; align-items: center; gap: 6px; }
  .hero h1 { font-size: 2.1rem; }
  .burst { position: relative; width: 190px; height: 190px; display: grid; place-items: center; }
  .burst svg { position: absolute; inset: 0; animation: spin 24s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .pts { position: relative; display: flex; flex-direction: column; align-items: center; animation: pop 0.6s ease-out; }
  .pts b { font-family: var(--f-display); font-size: 3.4rem; line-height: 1; color: #fff; text-shadow: 0 4px 0 var(--ink), -3px 0 0 var(--ink), 3px 0 0 var(--ink), 0 -3px 0 var(--ink); }
  .pts span { font-family: var(--f-display); font-weight: 800; }
  hr { border: 0; border-top: 2px dashed var(--bark-l); width: 100%; margin: 0; }
  .lv { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; border: 3px solid var(--ink); background: var(--sun); font-family: var(--f-display); font-weight: 800; font-size: 1.2rem; }
  .small { font-size: 0.85rem; }
  .banner { display: flex; align-items: center; gap: 6px; background: var(--berry-l); border: 2.5px solid var(--ink); border-radius: 12px; padding: 6px 10px; font-weight: 800; }
  .banner :global(svg) { width: 18px; height: 18px; color: var(--berry); }
  .banner.sun { background: var(--sun-l); }
  .banner.leaf { background: var(--leaf-l); animation: pop 0.5s ease-out; }
  .vs { display: grid; grid-template-columns: 1fr auto 1fr; align-items: center; text-align: center; }
  .vs b { display: block; font-family: var(--f-display); font-size: 2.4rem; line-height: 1; }
  .vs .outline-text { font-family: var(--f-display); font-size: 1.4rem; }
  .news { display: flex; flex-wrap: wrap; gap: 16px; justify-content: center; }
  .acc { display: flex; flex-direction: column; align-items: center; gap: 4px; font-weight: 800; }
  .accpic { width: 92px; height: 92px; animation: pop 0.6s ease-out; }
  .two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
</style>
