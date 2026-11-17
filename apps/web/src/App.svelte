<script lang="ts">
  import { onMount } from 'svelte';
  import { ui, go, refreshProfile } from './lib/state.svelte.js';
  import { checkSession, watchPortalSession } from './lib/auth.svelte.js';
  import { installButtonSounds } from './lib/sound.js';
  import Login from './screens/Login.svelte';
  import Home from './screens/Home.svelte';
  import Play from './screens/Play.svelte';
  import Result from './screens/Result.svelte';
  import Challenges from './screens/Challenges.svelte';
  import Profile from './screens/Profile.svelte';
  import NewChallenge from './components/NewChallenge.svelte';
  import Sloth from './components/Sloth.svelte';

  onMount(async () => {
    installButtonSounds();
    // Senza sessione checkSession rimanda al portale whoru; la schermata "login" resta solo se il
    // server non risponde o se il rimando non parte.
    if (!(await checkSession())) return go('login');
    try {
      await refreshProfile();
      go('home');
    } catch {
      return go('login');
    }
    // Uscita dal portale: il gioco se ne accorge, ma non durante una partita
    watchPortalSession(() => ui.screen === 'play');
  });
</script>

{#if ui.screen === 'loading'}
  <div class="loading"><div class="hang"><Sloth variant={0} accessory="foglia" /></div></div>
{:else if ui.screen === 'login'}
  <Login />
{:else if ui.screen === 'home'}
  <Home />
{:else if ui.screen === 'play'}
  {#key ui.game?.gameId}<Play />{/key}
{:else if ui.screen === 'result'}
  <Result />
{:else if ui.screen === 'challenges'}
  <Challenges />
{:else if ui.screen === 'profile'}
  <Profile />
{/if}

{#if ui.challengeFrom}<NewChallenge />{/if}
{#if ui.toast}<div class="toast" role="status">{ui.toast}</div>{/if}

<style>
  .loading { min-height: 100dvh; display: grid; place-items: center; }
  .hang { width: 110px; height: 110px; animation: sway 2.4s ease-in-out infinite; transform-origin: 50% 0; }
  .toast {
    position: fixed; left: 50%; top: calc(16px + env(safe-area-inset-top, 0px)); transform: translateX(-50%); z-index: 80;
    background: var(--paper); border: 3px solid var(--ink); border-radius: 16px; padding: 8px 16px; box-shadow: 0 4px 0 var(--ink);
    font-family: var(--f-display); font-weight: 800; font-size: 1.05rem; max-width: calc(100% - 32px); text-align: center;
    animation: rise 0.25s ease-out;
  }
</style>
