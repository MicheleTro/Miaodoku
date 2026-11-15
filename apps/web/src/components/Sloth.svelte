<script lang="ts">
  /**
   * Il bradipo di Bradoku (personaggio originale).
   * variant: colore del pelo e forma della testa; mood: espressione; accessory: accessorio della collezione.
   */
  let { variant = 0, accessory = 'nessuno', mood = 'sleepy', class: cls = '' }: { variant?: number; accessory?: string; mood?: 'sleepy' | 'happy' | 'oops'; class?: string } = $props();

  const FUR = ['#a47551', '#8d6e63', '#c19a6b', '#7b5e57', '#d4a373', '#9c7a5b', '#b08968', '#6f4e37', '#c8a27c', '#a1887f'];
  const SHAPES = [
    { rx: 40, ry: 37, cy: 55 },
    { rx: 35, ry: 41, cy: 54 },
    { rx: 43, ry: 34, cy: 57 },
  ];
  const v = $derived(((variant % 10) + 10) % 10);
  const fur = $derived(FUR[v]!);
  const shape = $derived(SHAPES[v % 3]!);
  const ink = '#22301f';
  const dark = '#4a3426';
  const top = $derived(shape.cy - shape.ry);
</script>

<svg class="sloth {cls}" viewBox="0 0 100 100" aria-hidden="true">
  <!-- ciuffo -->
  {#if v % 2 === 0}
    <path d="M44 {top + 4} q2 -9 7 -10 M52 {top + 3} q4 -8 9 -7" stroke={ink} stroke-width="3" fill="none" stroke-linecap="round" />
  {:else}
    <path d="M47 {top + 4} q3 -8 8 -8" stroke={ink} stroke-width="3" fill="none" stroke-linecap="round" />
  {/if}
  {#if accessory === 'cuffie'}
    <path d="M14 {shape.cy} Q14 {top - 6} 50 {top - 6} Q86 {top - 6} 86 {shape.cy}" stroke="#3b3f6b" stroke-width="6" fill="none" />
  {/if}
  <!-- testa -->
  <ellipse cx="50" cy={shape.cy} rx={shape.rx} ry={shape.ry} fill={fur} stroke={ink} stroke-width="4" />
  <!-- muso chiaro -->
  <ellipse cx="50" cy={shape.cy + 4} rx={shape.rx * 0.7} ry={shape.ry * 0.6} fill="#f3e3c8" />
  <!-- macchie degli occhi -->
  <ellipse cx="36" cy={shape.cy} rx="10" ry="6.5" transform="rotate(-22 36 {shape.cy})" fill={dark} />
  <ellipse cx="64" cy={shape.cy} rx="10" ry="6.5" transform="rotate(22 64 {shape.cy})" fill={dark} />
  {#if mood === 'sleepy'}
    <path d="M31 {shape.cy} q5 4 10 0 M59 {shape.cy} q5 4 10 0" stroke="#fff6e5" stroke-width="2.6" fill="none" stroke-linecap="round" />
  {:else if mood === 'happy'}
    <circle cx="37" cy={shape.cy} r="3.6" fill="#fff6e5" /><circle cx="63" cy={shape.cy} r="3.6" fill="#fff6e5" />
    <circle cx="37.8" cy={shape.cy - 0.8} r="1.6" fill={ink} /><circle cx="63.8" cy={shape.cy - 0.8} r="1.6" fill={ink} />
  {:else}
    <path d="M33 {shape.cy - 3} l7 6 M40 {shape.cy - 3} l-7 6 M60 {shape.cy - 3} l7 6 M67 {shape.cy - 3} l-7 6" stroke="#fff6e5" stroke-width="2.4" stroke-linecap="round" />
  {/if}
  <!-- naso e bocca -->
  <ellipse cx="50" cy={shape.cy + 9} rx="5.5" ry="3.8" fill="#3a2a1f" />
  {#if mood === 'oops'}
    <path d="M45 {shape.cy + 18} q5 -4 10 0" stroke="#3a2a1f" stroke-width="2.6" fill="none" stroke-linecap="round" />
  {:else}
    <path d="M44 {shape.cy + 15} q6 5 12 0" stroke="#3a2a1f" stroke-width="2.6" fill="none" stroke-linecap="round" />
  {/if}
  <ellipse cx="29" cy={shape.cy + 13} rx="5" ry="3" fill="#ef8f8f" opacity="0.45" />
  <ellipse cx="71" cy={shape.cy + 13} rx="5" ry="3" fill="#ef8f8f" opacity="0.45" />

  <!-- accessori -->
  {#if accessory === 'foglia'}
    <g transform="rotate(-25 56 {top})"><path d="M52 {top + 2} q4 -16 18 -14 q-2 14 -18 14z" fill="#5bb46a" stroke={ink} stroke-width="2.5" /><path d="M53 {top + 1} q6 -6 13 -11" stroke={ink} stroke-width="1.6" fill="none" /></g>
  {:else if accessory === 'fiore'}
    <g transform="translate(72 {top + 8})">
      {#each [0, 72, 144, 216, 288] as a (a)}<ellipse cx="0" cy="-6" rx="4.5" ry="6" transform="rotate({a})" fill="#ff9fc0" stroke={ink} stroke-width="1.8" />{/each}
      <circle r="3.6" fill="#ffc93c" stroke={ink} stroke-width="1.8" />
    </g>
  {:else if accessory === 'berretto'}
    <path d="M{50 - shape.rx * 0.82} {top + 12} Q50 {top - 18} {50 + shape.rx * 0.82} {top + 12} Z" fill="#ef5b6b" stroke={ink} stroke-width="3" />
    <rect x={50 - shape.rx * 0.86} y={top + 8} width={shape.rx * 1.72} height="8" rx="4" fill="#fff6e5" stroke={ink} stroke-width="2.5" />
    <circle cx="50" cy={top - 7} r="5" fill="#fff6e5" stroke={ink} stroke-width="2.5" />
  {:else if accessory === 'occhiali'}
    <circle cx="36" cy={shape.cy} r="10" fill="rgba(180,220,255,0.25)" stroke={ink} stroke-width="3" />
    <circle cx="64" cy={shape.cy} r="10" fill="rgba(180,220,255,0.25)" stroke={ink} stroke-width="3" />
    <path d="M46 {shape.cy - 1} q4 -3 8 0" stroke={ink} stroke-width="3" fill="none" />
  {:else if accessory === 'cuffie'}
    <rect x="7" y={shape.cy - 9} width="12" height="20" rx="5" fill="#6b6fb8" stroke={ink} stroke-width="2.5" />
    <rect x="81" y={shape.cy - 9} width="12" height="20" rx="5" fill="#6b6fb8" stroke={ink} stroke-width="2.5" />
  {:else if accessory === 'alloro'}
    {#each [-1, 1] as s (s)}
      {#each [0, 1, 2, 3] as k (k)}
        <ellipse cx={50 + s * (12 + k * 8)} cy={top + 2 + k * 5} rx="5" ry="2.6" transform="rotate({s * (20 + k * 18)} {50 + s * (12 + k * 8)} {top + 2 + k * 5})" fill="#7cc36b" stroke={ink} stroke-width="1.5" />
      {/each}
    {/each}
  {:else if accessory === 'bacche'}
    <circle cx="30" cy={top + 6} r="5" fill="#c43546" stroke={ink} stroke-width="2" />
    <circle cx="38" cy={top + 2} r="5" fill="#ef5b6b" stroke={ink} stroke-width="2" />
    <circle cx="35" cy={top + 10} r="4.5" fill="#7e3aa1" stroke={ink} stroke-width="2" />
    <path d="M38 {top - 3} q4 -5 9 -4" stroke="#3f8f4e" stroke-width="2.5" fill="none" />
  {:else if accessory === 'sciarpa'}
    <path d="M22 {shape.cy + shape.ry - 8} Q50 {shape.cy + shape.ry + 6} 78 {shape.cy + shape.ry - 8} L80 {shape.cy + shape.ry + 2} Q50 {shape.cy + shape.ry + 16} 20 {shape.cy + shape.ry + 2} Z" fill="#3a8fd6" stroke={ink} stroke-width="2.5" />
    <rect x="62" y={shape.cy + shape.ry} width="9" height="14" rx="3" fill="#3a8fd6" stroke={ink} stroke-width="2.5" />
  {:else if accessory === 'stella'}
    <path d="M73 {top - 2} l3.5 7.5 8 1 -6 5.5 1.6 8 -7.1 -4 -7.1 4 1.6 -8 -6 -5.5 8 -1z" fill="#ffc93c" stroke={ink} stroke-width="2.2" stroke-linejoin="round" />
  {:else if accessory === 'farfalla'}
    <g transform="translate(66 {top + 4}) rotate(15)">
      <ellipse cx="-6" cy="-3" rx="6" ry="5" fill="#ff9e3d" stroke={ink} stroke-width="1.8" />
      <ellipse cx="6" cy="-3" rx="6" ry="5" fill="#ff9e3d" stroke={ink} stroke-width="1.8" />
      <ellipse cx="-4" cy="4" rx="4" ry="3.4" fill="#ffd166" stroke={ink} stroke-width="1.8" />
      <ellipse cx="4" cy="4" rx="4" ry="3.4" fill="#ffd166" stroke={ink} stroke-width="1.8" />
      <rect x="-1.2" y="-6" width="2.4" height="13" rx="1.2" fill={ink} />
    </g>
  {:else if accessory === 'mago'}
    <path d="M30 {top + 10} L54 {top - 26} L72 {top + 10} Z" fill="#6c4bb8" stroke={ink} stroke-width="3" stroke-linejoin="round" />
    <ellipse cx="51" cy={top + 10} rx="26" ry="5" fill="#6c4bb8" stroke={ink} stroke-width="3" />
    <circle cx="52" cy={top - 6} r="2.4" fill="#ffc93c" /><circle cx="60" cy={top + 2} r="1.8" fill="#ffc93c" />
  {:else if accessory === 'corona'}
    <path d="M32 {top + 10} L34 {top - 8} L42 {top + 1} L50 {top - 12} L58 {top + 1} L66 {top - 8} L68 {top + 10} Z" fill="#ffc93c" stroke={ink} stroke-width="3" stroke-linejoin="round" />
    <circle cx="50" cy={top + 4} r="2.6" fill="#ef5b6b" />
  {/if}
</svg>

<style>
  .sloth { display: block; width: 100%; height: 100%; overflow: visible; }
</style>
