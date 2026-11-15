<script lang="ts">
  /** Il ramo con il bradipo appeso: la mascotte della Home e dell'accesso. */
  import Sloth from './Sloth.svelte';
  let { accessory = 'foglia', mood = 'sleepy' }: { accessory?: string; mood?: 'sleepy' | 'happy' } = $props();
</script>

<div class="scene" aria-hidden="true">
  <svg class="branch" viewBox="0 0 400 120" preserveAspectRatio="none">
    <path d="M-10 46 C80 30 150 62 220 48 S340 26 410 40 L410 60 C340 46 290 70 220 68 S80 52 -10 66 Z" fill="#7a4f2e" stroke="#22301f" stroke-width="4" />
    <path d="M60 50 q20 -4 40 2 M250 50 q25 -6 50 -2" stroke="#5e3a20" stroke-width="3" fill="none" stroke-linecap="round" />
    <g fill="#5bb46a" stroke="#22301f" stroke-width="3">
      <path d="M30 52 q-10 26 8 40 q12 -20 -8 -40z" />
      <path d="M330 40 q20 20 8 44 q-18 -14 -8 -44z" />
      <path d="M120 58 q4 22 22 26 q0 -22 -22 -26z" />
    </g>
  </svg>
  <div class="hanger">
    <svg class="body" viewBox="0 0 120 150">
      <path d="M38 6 q-6 22 4 46 M82 6 q6 22 -4 46" stroke="#22301f" stroke-width="14" fill="none" stroke-linecap="round" />
      <path d="M38 6 q-6 22 4 46 M82 6 q6 22 -4 46" stroke="#a47551" stroke-width="8" fill="none" stroke-linecap="round" />
      <ellipse cx="60" cy="96" rx="34" ry="42" fill="#a47551" stroke="#22301f" stroke-width="4" />
      <ellipse cx="60" cy="102" rx="20" ry="26" fill="#c9a27e" />
      <path d="M32 6 l-4 -6 M38 6 l0 -7 M44 6 l4 -6 M76 6 l-4 -6 M82 6 l0 -7 M88 6 l4 -6" stroke="#22301f" stroke-width="3" stroke-linecap="round" />
    </svg>
    <div class="head"><Sloth variant={0} {accessory} {mood} /></div>
  </div>
</div>

<style>
  .scene { position: relative; height: 230px; }
  .branch { position: absolute; left: -16px; right: -16px; top: 0; width: calc(100% + 32px); height: 120px; }
  .hanger {
    position: absolute; left: 50%; top: 44px; width: 120px; margin-left: -60px;
    transform-origin: 50% 0; animation: sway 4.5s ease-in-out infinite;
  }
  .body { width: 120px; height: 150px; display: block; }
  .head { position: absolute; width: 96px; height: 96px; left: 12px; top: 34px; }
</style>
