<script lang="ts">
  import { onMount } from 'svelte';
  import { MEDALS, ACCESSORIES, TECHNIQUES } from '@bradoku/core';
  import { api, type Profile } from '../lib/api.js';
  import { ui, go, logout, refreshProfile, toast } from '../lib/state.svelte.js';
  import Sloth from '../components/Sloth.svelte';
  import MedalBadge from '../components/MedalBadge.svelte';
  import Icon from '../components/Icon.svelte';
  import { LUMI_ENABLED } from '../lib/features.js';

  const p = $derived(ui.profile!);
  onMount(() => refreshProfile().catch(() => {}));

  const FAMILIES = [
    { id: 'base', name: 'Base' },
    { id: 'tecniche', name: 'Tecniche' },
    { id: 'sfide', name: 'Sfide' },
    { id: 'serie', name: 'Serie' },
  ] as const;

  async function wear(id: string) {
    if (!p.accessories.includes(id)) {
      const a = ACCESSORIES.find((x) => x.id === id)!;
      const how = 'level' in a.unlock ? `Si sblocca al grado ${a.unlock.level}` : `Si sblocca con la medaglia «${MEDALS.find((m) => m.id === (a.unlock as { medal: string }).medal)?.name}»`;
      return toast(how);
    }
    ui.profile = await api<Profile>('PUT', '/me/accessory', { accessory: id });
  }
</script>

<main class="page">
  <header class="row">
    <button class="icon-btn" onclick={() => go('home')} aria-label="Indietro"><Icon name="back" /></button>
    <h1 class="grow center outline-text">Profilo</h1>
    <button class="icon-btn" onclick={logout} aria-label="Esci dal profilo"><Icon name="logout" /></button>
  </header>

  <section class="card hero">
    <span class="me"><Sloth variant={0} accessory={p.accessory} mood="happy" /></span>
    <div class="grow">
      <h2>{p.username}</h2>
      <p class="muted">{p.rank} · grado <b class="num">{p.level}</b> · <b class="num">{p.pathDone}</b> livelli nel Percorso</p>
      <div class="xpbar"><i style="width:{(p.xpInto / p.xpNeed) * 100}%"></i></div>
      <p class="muted small num">{p.xpInto}/{p.xpNeed} XP · {p.xp} XP in tutto</p>
    </div>
  </section>

  <section class="tiles">
    <div class="tile"><b class="num">{p.stats.solved}</b><span>livelli risolti</span></div>
    <div class="tile"><b class="num">{p.stats.noHintSolved}</b><span>senza aiuti</span></div>
    <div class="tile"><b class="num">{p.stats.challengesWon}</b><span>sfide vinte</span></div>
    <div class="tile"><b class="num">{p.streak}</b><span>giorni di serie</span></div>
    {#if LUMI_ENABLED}
      <div class="tile"><b class="num">{p.lumi}</b><span>Lumi</span></div>
    {:else}
      <div class="tile"><b class="num">{p.pathDone}</b><span>Percorso</span></div>
    {/if}
    <div class="tile"><b class="num">{p.medals.length}/{MEDALS.length}</b><span>medaglie</span></div>
  </section>

  <section class="card stack">
    <h2>Il tuo bradipo</h2>
    <p class="muted">L'accessorio scelto lo indossano tutti i bradipi sulla griglia.</p>
    <div class="accs">
      {#each ACCESSORIES as a (a.id)}
        {@const on = p.accessories.includes(a.id)}
        <button class="acc" class:sel={p.accessory === a.id} class:locked={!on} onclick={() => wear(a.id)} aria-pressed={p.accessory === a.id}>
          <span class="pic"><Sloth variant={0} accessory={a.id} mood={on ? 'sleepy' : 'sleepy'} /></span>
          <span class="nm">{on ? a.name : '???'}</span>
        </button>
      {/each}
    </div>
  </section>

  <section class="card stack">
    <h2>Medaglie</h2>
    {#each FAMILIES as f (f.id)}
      <h3>{f.name}</h3>
      <div class="medals">
        {#each MEDALS.filter((m) => m.family === f.id) as m (m.id)}<MedalBadge id={m.id} earned={p.medals.includes(m.id)} />{/each}
      </div>
    {/each}
  </section>

  <section class="card stack">
    <h2>Quaderno delle tecniche</h2>
    <p class="muted">Ogni tecnica si apre la prima volta che un livello la richiede. Il numero conta le volte in cui ti è servita nei livelli risolti senza aiuti.</p>
    {#each TECHNIQUES as t, i (t.id)}
      {@const seen = i < 2 || p.seenTechniques.includes(t.id) || (p.techniques[t.id] ?? 0) > 0}
      <div class="tech" class:locked={!seen}>
        <span class="tn num">{i + 1}</span>
        <div class="grow">
          <b>{seen ? t.name : 'Tecnica da scoprire'}</b>
          <p class="muted small">{seen ? t.short : 'Vai avanti nel Percorso per scoprirla.'}</p>
        </div>
        <span class="cnt num">{p.techniques[t.id] ?? 0}</span>
      </div>
    {/each}
  </section>
</main>

<style>
  h1 { font-size: 2.2rem; }
  h3 { font-size: 1rem; color: var(--bark); text-transform: uppercase; letter-spacing: 0.06em; }
  .hero { display: flex; align-items: center; gap: 14px; }
  .me { width: 96px; height: 96px; flex: none; }
  .hero .xpbar { margin-top: 6px; }
  .small { font-size: 0.85rem; }
  .tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .tile { background: var(--paper); border: 3px solid var(--ink); border-radius: 18px; padding: 8px 6px; text-align: center; box-shadow: 0 4px 0 var(--ink); }
  .tile b { display: block; font-family: var(--f-display); font-size: 1.6rem; line-height: 1.1; }
  .tile span { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--ink-2); font-weight: 800; }
  .accs { display: grid; grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 10px; }
  .acc { display: flex; flex-direction: column; align-items: center; gap: 2px; border: 2.5px solid var(--ink); border-radius: 16px; background: #fff; padding: 6px 4px; box-shadow: 0 3px 0 var(--ink); }
  .acc.sel { background: var(--sun-l); outline: 3px solid var(--sun-d); }
  .acc.locked .pic { filter: grayscale(1) brightness(0.6); opacity: 0.5; }
  .acc .pic { width: 56px; height: 56px; }
  .nm { font-size: 0.72rem; font-weight: 800; }
  .medals { display: grid; grid-template-columns: repeat(auto-fill, minmax(72px, 1fr)); gap: 12px 6px; }
  .tech { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-bottom: 2px dashed var(--bark-l); }
  .tech:last-child { border-bottom: 0; }
  .tech.locked { opacity: 0.6; }
  .tn { width: 34px; height: 34px; border-radius: 10px; border: 2.5px solid var(--ink); background: var(--leaf-l); display: grid; place-items: center; font-family: var(--f-display); font-weight: 800; flex: none; }
  .cnt { font-family: var(--f-display); font-weight: 800; font-size: 1.3rem; min-width: 32px; text-align: right; }
</style>
