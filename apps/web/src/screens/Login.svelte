<script lang="ts">
  import { api, setToken, type Profile } from '../lib/api.js';
  import { ui, go } from '../lib/state.svelte.js';
  import Scene from '../components/Scene.svelte';

  let mode = $state<'login' | 'register'>('login');
  let username = $state('');
  let password = $state('');
  let error = $state('');
  let busy = $state(false);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    busy = true;
    try {
      const r = await api<{ token: string; profile: Profile }>('POST', mode === 'login' ? '/auth/login' : '/auth/register', { username, password });
      setToken(r.token);
      ui.profile = r.profile;
      go('home');
    } catch (err) {
      error = (err as Error).message;
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

  <form class="card stack rise" onsubmit={submit}>
    <div class="seg tabs">
      <button type="button" aria-pressed={mode === 'login'} onclick={() => (mode = 'login')}>Entra</button>
      <button type="button" aria-pressed={mode === 'register'} onclick={() => (mode = 'register')}>Crea profilo</button>
    </div>
    <label class="field">Nome
      <input id="username" autocomplete="username" bind:value={username} required minlength="3" maxlength="20" placeholder="es. ramo_lento" />
    </label>
    <label class="field">Password
      <input id="password" type="password" autocomplete={mode === 'login' ? 'current-password' : 'new-password'} bind:value={password} required minlength="6" />
    </label>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <button class="btn btn-sun btn-big btn-block" disabled={busy}>{mode === 'login' ? 'Entra' : 'Crea e gioca'}</button>
    <p class="muted small">Più avanti il profilo arriverà dal portale whoru.</p>
  </form>
</main>

<style>
  .title { font-size: 3.6rem; letter-spacing: 0.02em; }
  .tag { color: #fff; font-weight: 800; font-size: 1.1rem; text-shadow: 0 2px 0 rgba(0, 0, 0, 0.3); margin-top: 4px; }
  .tabs button { flex: 1; }
  .small { font-size: 0.85rem; text-align: center; }
</style>
