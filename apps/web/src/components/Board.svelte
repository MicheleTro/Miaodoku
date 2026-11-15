<script lang="ts">
  import Sloth from './Sloth.svelte';

  interface Highlight {
    focus?: Set<number>;
    unit?: Set<number>;
    elim?: Set<number>;
    place?: Set<number>;
    error?: Set<number>;
  }
  let {
    n, regions, marks, conflicts = new Set<number>(), emptyUnits = new Set<number>(), highlight = {}, accessory = 'nessuno',
    disabled = false, celebrate = false, onpress, ondrag,
  }: {
    n: number; regions: number[]; marks: number[]; conflicts?: Set<number>; emptyUnits?: Set<number>; highlight?: Highlight;
    accessory?: string; disabled?: boolean; celebrate?: boolean;
    onpress: (i: number) => 'drag' | null; ondrag: (i: number) => void;
  } = $props();

  let dragging: number | null = null;
  let boardEl: HTMLDivElement;

  function cellFromPoint(x: number, y: number): number | null {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-i]');
    return el && boardEl.contains(el) ? Number(el.dataset.i) : null;
  }
  function down(e: PointerEvent) {
    if (disabled) return;
    const i = cellFromPoint(e.clientX, e.clientY);
    if (i === null) return;
    e.preventDefault();
    dragging = onpress(i) === 'drag' ? e.pointerId : null;
  }
  function move(e: PointerEvent) {
    if (dragging !== e.pointerId) return;
    const i = cellFromPoint(e.clientX, e.clientY);
    if (i !== null) ondrag(i);
  }
  const up = () => (dragging = null);

  const border = (i: number) => {
    const r = Math.floor(i / n);
    const c = i % n;
    const g = regions[i];
    const t = r > 0 && regions[i - n] !== g ? 3 : 0;
    const l = c > 0 && regions[i - 1] !== g ? 3 : 0;
    return `border-top-width:${t}px;border-left-width:${l}px`;
  };
</script>

<div
  class="board"
  class:celebrate
  style="--n:{n}"
  bind:this={boardEl}
  role="grid"
  aria-label="Griglia {n} per {n}"
  tabindex="-1"
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={up}
  onpointerleave={up}
>
  {#each regions as g, i (i)}
    <div
      class="cell"
      data-i={i}
      data-s={marks[i]}
      role="gridcell"
      aria-label="riga {Math.floor(i / n) + 1}, colonna {(i % n) + 1}: {['vuota', 'esclusa', 'bradipo'][marks[i] ?? 0]}"
      style="--rc:var(--r{g});{border(i)};--d:{(Math.floor(i / n) + (i % n)) * 40}ms"
      class:conflict={conflicts.has(i)}
      class:empty-unit={emptyUnits.has(i)}
      class:hl-focus={highlight.focus?.has(i)}
      class:hl-unit={highlight.unit?.has(i)}
      class:hl-elim={highlight.elim?.has(i)}
      class:hl-place={highlight.place?.has(i)}
      class:hl-error={highlight.error?.has(i)}
    >
      {#if marks[i] === 2}
        <div class="piece"><Sloth variant={g} {accessory} mood={conflicts.has(i) ? 'oops' : celebrate ? 'happy' : 'sleepy'} /></div>
      {:else if highlight.place?.has(i)}
        <div class="piece ghost"><Sloth variant={g} {accessory} /></div>
      {:else if marks[i] === 1}
        <span class="x"></span>
      {/if}
    </div>
  {/each}
</div>

<style>
  .board {
    display: grid;
    grid-template-columns: repeat(var(--n), minmax(0, 1fr));
    grid-template-rows: repeat(var(--n), minmax(0, 1fr));
    width: 100%;
    max-width: 100%;
    aspect-ratio: 1;
    border: 4px solid var(--ink);
    border-radius: 18px;
    overflow: hidden;
    background: var(--ink);
    box-shadow: 0 7px 0 var(--ink);
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
  }
  .cell {
    position: relative;
    min-width: 0;
    min-height: 0;
    background: var(--rc);
    border: 0 solid var(--ink);
    box-shadow: inset 0 0 0 0.5px rgba(34, 48, 31, 0.22);
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .piece { position: absolute; inset: 7%; animation: pop 0.25s ease-out; }
  .piece.ghost { opacity: 0.45; animation: none; }
  .x { position: absolute; inset: 0; }
  .x::before, .x::after {
    content: ''; position: absolute; left: 32%; top: calc(50% - 2px); width: 36%; height: 4px;
    border-radius: 2px; background: rgba(34, 48, 31, 0.55);
  }
  .x::before { transform: rotate(45deg); }
  .x::after { transform: rotate(-45deg); }
  .conflict { background-image: radial-gradient(circle, rgba(239, 91, 107, 0.55) 0 55%, transparent 60%); }
  .conflict .piece { animation: shake 0.35s; }
  .empty-unit { background-image: repeating-linear-gradient(45deg, transparent 0 6px, rgba(239, 91, 107, 0.3) 6px 9px); }
  .hl-unit { filter: saturate(1.5) brightness(1.05); }
  .hl-focus { box-shadow: inset 0 0 0 3px var(--sun-d); }
  .hl-elim::after { content: ''; position: absolute; inset: 34%; border-radius: 50%; background: rgba(239, 91, 107, 0.6); }
  .hl-place { box-shadow: inset 0 0 0 3px var(--leaf); }
  .hl-error { box-shadow: inset 0 0 0 4px var(--berry-d); }
  .celebrate .piece { animation: bob 0.6s ease-in-out var(--d) 2; }
</style>
