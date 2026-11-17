<script lang="ts">
  import { onDestroy } from 'svelte';
  import {
    createBoard, findSolutions, emptyState, placePiece, nextDeduction, explainDeduction, hintZone,
    UNKNOWN, CROSS, PIECE, type Deduction,
  } from '@bradoku/core';
  import { api, storage, type FinishResult } from '../lib/api.js';
  import { ui, go, setCurrentGame, refreshProfile } from '../lib/state.svelte.js';
  import Board, { type DragMode } from '../components/Board.svelte';
  import Icon from '../components/Icon.svelte';
  import Sloth from '../components/Sloth.svelte';

  const g = ui.game!;
  const { n, regions } = g.level;
  const board = createBoard(n, regions);
  const solution = new Set(findSolutions(n, regions, 1)[0] ?? []);
  const accessory = ui.profile?.accessory ?? 'foglia';
  const isChallenge = !!g.challengeId;

  const MARKS_KEY = `bradoku.marks.${g.gameId}`;
  const restored = (() => {
    try {
      return JSON.parse(storage.get(MARKS_KEY) ?? 'null') as { marks: number[]; hints: number; lumi: boolean; clean: boolean } | null;
    } catch {
      return null;
    }
  })();

  let marks = $state<number[]>(restored?.marks ?? new Array(n * n).fill(UNKNOWN));
  let hints = $state(restored?.hints ?? 0);
  let lumiUsed = $state(restored?.lumi ?? false);
  let clean = $state(restored?.clean ?? true);
  let undoStack: number[][] = [];
  let canUndo = $state(false);
  let finishing = $state(false);
  let solved = $state(false);
  let error = $state('');

  type Hint = { stage: 'error' | 'obvious' | 'zone' | 'explain'; title: string; text: string; d?: Deduction; cells?: number[] };
  let hint = $state<Hint | null>(null);

  // ---- tempo (misurato dal server; qui solo mostrato)
  const offset = Date.now() - Date.parse(g.serverNow);
  const started = Date.parse(g.startedAt);
  let now = $state(Date.now());
  const tick = setInterval(() => (now = Date.now()), 500);
  onDestroy(() => clearInterval(tick));
  const elapsed = $derived(Math.max(0, now - offset - started));
  const fmt = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
  const underPar = $derived(elapsed < g.level.parMs);

  function save() {
    storage.set(MARKS_KEY, JSON.stringify({ marks, hints, lumi: lumiUsed, clean }));
  }

  // ---- conflitti
  const analysis = $derived.by(() => {
    const bad = new Set<number>();
    const empty = new Set<number>();
    const pieces: number[] = [];
    marks.forEach((m, i) => m === PIECE && pieces.push(i));
    for (const i of pieces) for (const j of board.sees[i]!) if (marks[j] === PIECE) bad.add(i);
    for (const u of board.units) if (u.cells.every((i) => marks[i] === CROSS)) u.cells.forEach((i) => empty.add(i));
    return { bad, empty, pieces: pieces.length };
  });

  function pushUndo() {
    undoStack.push(marks.slice());
    if (undoStack.length > 300) undoStack.shift();
    canUndo = true;
  }

  function setPiece(i: number) {
    marks[i] = PIECE;
    if (!solution.has(i)) clean = false;
  }

  function changed() {
    if (hint && hint.stage !== 'explain') hint = null;
    if (hint?.stage === 'explain') hint = null;
    save();
    checkWin();
  }

  /**
   * Un tocco: vuota → X (e trascinando si mettono altre X); X → vuota (e trascinando si tolgono a catena);
   * bradipo → vuota. Doppio tocco: bradipo. Il doppio tocco completa il primo tocco, quindi un solo «Annulla».
   */
  let firstTapRemovedPiece = false;
  function onpress(i: number, double: boolean): DragMode {
    if (finishing || solved) return null;
    if (double && !firstTapRemovedPiece) {
      setPiece(i);
      changed();
      return null;
    }
    pushUndo();
    const old = marks[i];
    firstTapRemovedPiece = old === PIECE;
    marks[i] = old === UNKNOWN ? CROSS : UNKNOWN;
    changed();
    return old === UNKNOWN ? 'add' : old === CROSS ? 'remove' : null;
  }
  function ondrag(i: number, mode: 'add' | 'remove') {
    if (finishing || solved) return;
    if (mode === 'add' && marks[i] === UNKNOWN) marks[i] = CROSS;
    else if (mode === 'remove' && marks[i] === CROSS) marks[i] = UNKNOWN;
    else return;
    save();
  }
  function undo() {
    const prev = undoStack.pop();
    if (prev) marks = prev;
    canUndo = undoStack.length > 0;
    hint = null;
    save();
  }
  function reset() {
    if (!marks.some((m) => m)) return;
    pushUndo();
    marks = new Array(n * n).fill(UNKNOWN);
    hint = null;
    save();
  }

  // ---- suggerimenti
  function logicState() {
    const st = emptyState(board);
    marks.forEach((m, i) => m === CROSS && (st[i] = CROSS));
    marks.forEach((m, i) => m === PIECE && placePiece(board, st, i));
    return st;
  }
  function wrongCells() {
    const w: number[] = [];
    marks.forEach((m, i) => {
      if ((m === PIECE && !solution.has(i)) || (m === CROSS && solution.has(i))) w.push(i);
    });
    return w;
  }

  function askHint() {
    if (hint?.stage === 'zone' && hint.d) {
      const ex = explainDeduction(board, hint.d);
      hint = { stage: 'explain', title: ex.title, text: ex.text, d: hint.d };
      return;
    }
    const wrong = wrongCells();
    if (wrong.length) {
      hints++;
      hint = { stage: 'error', title: 'Qualcosa non torna', text: wrong.length === 1 ? 'La casella evidenziata è sbagliata.' : `Ci sono ${wrong.length} caselle sbagliate, evidenziate.`, cells: wrong };
      save();
      return;
    }
    const st = logicState();
    const obvious: number[] = [];
    st.forEach((v, i) => v === CROSS && marks[i] === UNKNOWN && obvious.push(i));
    if (obvious.length) {
      hint = { stage: 'obvious', title: 'Intorno ai bradipi', text: 'Ogni bradipo esclude la sua riga, la sua colonna, la sua regione e le 8 caselle intorno. Queste si possono segnare con una X (gratis).', cells: obvious };
      return;
    }
    const d = nextDeduction(board, st);
    if (!d) return;
    hints++;
    hint = { stage: 'zone', title: 'Dove guardare', text: hintZone(board, d), d };
    save();
  }

  function applyHint() {
    if (!hint) return;
    pushUndo();
    if (hint.stage === 'error') for (const i of hint.cells ?? []) marks[i] = UNKNOWN;
    else if (hint.stage === 'obvious') for (const i of hint.cells ?? []) marks[i] = CROSS;
    else if (hint.d) {
      if (hint.d.place !== undefined) setPiece(hint.d.place);
      for (const i of hint.d.eliminate) if (marks[i] === UNKNOWN) marks[i] = CROSS;
    }
    hint = null;
    save();
    checkWin();
  }

  function useLume() {
    if (lumiUsed || isChallenge || g.lumiAvailable < 1) return;
    pushUndo();
    for (const i of wrongCells()) marks[i] = UNKNOWN;
    const d = nextDeduction(board, logicState());
    lumiUsed = true;
    if (d) {
      const ex = explainDeduction(board, d);
      if (d.place !== undefined) setPiece(d.place);
      for (const i of d.eliminate) if (marks[i] === UNKNOWN) marks[i] = CROSS;
      hint = { stage: 'explain', title: `Lume · ${ex.title}`, text: ex.text, d };
    }
    save();
    checkWin();
  }

  const highlight = $derived.by(() => {
    if (!hint) return {};
    if (hint.stage === 'error') return { error: new Set(hint.cells) };
    if (hint.stage === 'obvious') return { elim: new Set(hint.cells) };
    const d = hint.d!;
    const unitCells = new Set<number>();
    const us = hint.stage === 'zone' ? d.units.slice(0, 1) : [...d.units, ...(d.targets ?? [])];
    for (const u of us) for (const i of board.units[u]!.cells) unitCells.add(i);
    if (hint.stage === 'zone') return { unit: unitCells };
    return {
      unit: unitCells,
      focus: new Set(d.cell !== undefined ? [d.cell] : d.focus),
      elim: new Set(d.eliminate.filter((i) => marks[i] === UNKNOWN)),
      place: new Set(d.place !== undefined && marks[d.place] !== PIECE ? [d.place] : []),
    };
  });

  // ---- vittoria
  async function checkWin() {
    if (solved || analysis.pieces !== n || analysis.bad.size) return;
    solved = true;
    finishing = true;
    const pieces = marks.flatMap((m, i) => (m === PIECE ? [i] : []));
    await new Promise((r) => setTimeout(r, 1300));
    try {
      const res = await api<FinishResult>('POST', `/games/${g.gameId}/finish`, { pieces, hints, lumi: lumiUsed, clean });
      storage.set(MARKS_KEY, null);
      setCurrentGame(null);
      ui.result = res;
      refreshProfile().catch(() => {});
      go('result');
    } catch (e) {
      error = (e as Error).message;
      finishing = false;
    }
  }

</script>

<main class="page play">
  <header class="top">
    <button class="icon-btn" onclick={() => go(isChallenge ? 'challenges' : 'home')} aria-label="Esci (la partita resta in sospeso)"><Icon name="back" /></button>
    <div class="grow title">
      {#if g.pathK}<span class="chip">Quadro {g.pathK}</span>{/if}
      {#if g.level.rating.hard}<span class="chip hard">Difficile</span>{/if}
      <span class="outline-text size">{n}×{n}</span>
      {#if isChallenge}<span class="chip vs">Sfida</span>{/if}
    </div>
    <span class="pill timer num" class:over={!underPar}>{fmt(elapsed)}</span>
  </header>

  <div class="status row between">
    <span class="count outline-text num">{analysis.pieces}/{n} bradipi</span>
    <span class="seed muted num">seme {g.level.seed}</span>
  </div>

  <div class="board-wrap">
    <Board {n} {regions} {marks} conflicts={analysis.bad} emptyUnits={analysis.empty} {highlight} {accessory} disabled={finishing} celebrate={solved} {onpress} {ondrag} />
  </div>

  {#if hint}
    <section class="card hint rise" aria-live="polite">
      <div class="row">
        <span class="coach"><Sloth variant={5} accessory="occhiali" mood="happy" /></span>
        <div class="grow"><h3>{hint.title}</h3><p>{hint.text}</p></div>
      </div>
      <div class="row">
        {#if hint.stage === 'zone'}<button class="btn btn-sm btn-sun" onclick={askHint}>Spiegami</button>{/if}
        {#if hint.stage !== 'zone'}<button class="btn btn-sm btn-leaf" onclick={applyHint}>{hint.stage === 'error' ? 'Correggi' : 'Applica'}</button>{/if}
        <button class="btn btn-sm" onclick={() => (hint = null)}>Chiudi</button>
      </div>
    </section>
  {/if}
  {#if error}<p class="error" role="alert">{error}</p>{/if}

  <nav class="tools">
    <button class="tool" onclick={undo} disabled={!canUndo || finishing}><Icon name="undo" /><span>Annulla</span></button>
    <button class="tool sun" onclick={askHint} disabled={finishing}><Icon name="bulb" /><span>Aiuto{hints ? ` (${hints})` : ''}</span></button>
    {#if !isChallenge}
      <button class="tool lume" onclick={useLume} disabled={lumiUsed || g.lumiAvailable < 1 || finishing} title="Un suggerimento completo senza penalità">
        <Icon name="lume" /><span>Lume {lumiUsed ? '✓' : g.lumiAvailable}</span>
      </button>
    {/if}
    <button class="tool" onclick={reset} disabled={finishing}><Icon name="reset" /><span>Ricomincia</span></button>
  </nav>
  <p class="help">Tocco: X · doppio tocco: bradipo · tocca una X per toglierla. Trascina per mettere o togliere tante X.</p>
</main>

<style>
  .play { gap: 10px; }
  .top { display: flex; align-items: center; gap: 10px; }
  .title { display: flex; align-items: center; justify-content: center; gap: 8px; flex-wrap: wrap; }
  .size { font-family: var(--f-display); font-size: 1.4rem; }
  .vs { background: var(--berry); color: #fff; }
  .timer { font-size: 1.3rem; padding: 2px 12px; }
  .timer.over { background: var(--paper-2); }
  .count { font-family: var(--f-display); font-size: 1.2rem; }
  .seed { color: #fff; opacity: 0.8; font-size: 0.85rem; font-weight: 700; }
  .board-wrap { width: min(100%, calc(100dvh - 330px)); min-width: min(100%, 300px); margin: 0 auto; }
  .hint { display: flex; flex-direction: column; gap: 10px; padding: 12px; }
  .hint h3 { font-size: 1.1rem; }
  .coach { width: 54px; height: 54px; flex: none; }
  .tools { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; gap: 8px; }
  .tool {
    display: flex; flex-direction: column; align-items: center; gap: 2px; border: 3px solid var(--ink); border-radius: 16px;
    background: var(--paper); box-shadow: 0 4px 0 var(--ink); padding: 6px 2px; font-weight: 800; font-size: 0.82rem;
  }
  .tool :global(svg) { width: 24px; height: 24px; }
  .tool:disabled { opacity: 0.5; }
  .tool.sun { background: var(--sun-l); }
  .tool.lume { background: #fff3cf; color: var(--bark); }
  .help { color: #fff; text-align: center; font-size: 0.85rem; opacity: 0.85; }
</style>
