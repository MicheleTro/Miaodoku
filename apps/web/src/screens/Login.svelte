<script lang="ts">
  import { auth, checkSession } from '../lib/auth.svelte.js';
  import { go, refreshProfile } from '../lib/state.svelte.js';
  import Scene from '../components/Scene.svelte';

  let busy = $state(false);

  // Si arriva qui solo se il rimando automatico al portale non è partito o il server non risponde.
  async function retry() {
    busy = true;
    try {
      if (await checkSession()) {
        await refreshProfile();
        go('home');
      }
    } finally {
      busy = false;
    }
  }
</script>

<main class="page">
  <Scene accessory="foglia" />
  <div class="center rise">
    <h1 class="title outline-text">Bradoku</h1>
    <p class="tag">Un bradipo per riga, colonna e regione.<br />E nessuno vuole vicini.</p>
  </div>

  <section class="card stack rise">
    {#if auth.offline}
      <p class="error" role="alert">Il server non risponde. Controlla la connessione e riprova.</p>
      <button class="btn btn-sun btn-big btn-block" onclick={retry} disabled={busy}>Riprova</button>
    {:else}
      <p>Si entra con il tuo account di <b>slothymic.com</b>: lo stesso degli altri giochi.</p>
      {#if auth.loginUrl}
        <a class="btn btn-sun btn-big btn-block" href={auth.loginUrl}>Entra</a>
      {:else}
        <button class="btn btn-sun btn-big btn-block" onclick={retry} disabled={busy}>Entra</button>
      {/if}
    {/if}
  </section>
</main>

<style>
  .title { font-size: 3.6rem; letter-spacing: 0.02em; }
  .tag { color: #fff; font-weight: 800; font-size: 1.1rem; text-shadow: 0 2px 0 rgba(0, 0, 0, 0.3); margin-top: 4px; }
  a.btn { text-align: center; text-decoration: none; }
</style>
