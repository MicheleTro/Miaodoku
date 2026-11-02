import {
  createBoard, UNKNOWN, CROSS, CAT, emptyState, placeCat, nextDeduction,
  solveLogically, applyDeduction, hashString, TECHNIQUES,
} from './engine/index.js';
import { explainDeduction } from './engine/explain.js';

const $ = (s) => document.querySelector(s);
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage non disponibile */ } },
};

const S = {
  level: null,
  board: null,
  marks: null,
  undo: [],
  redo: [],
  elapsed: 0,
  lastTick: 0,
  won: false,
  hints: 0,
  hint: null,
  drag: null,
  replay: { on: false, steps: [], states: [], index: 0 },
  settings: { autoX: false, showConflicts: true, ...store.get('settings', {}) },
};

// ------------------------------------------------------------ generazione (worker)

const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
const pending = new Map();
let reqId = 0;
worker.onmessage = (e) => {
  const p = pending.get(e.data.id);
  if (!p) return;
  pending.delete(e.data.id);
  e.data.error ? p.reject(new Error(e.data.error)) : p.resolve(e.data);
};
function generate(n, seed, difficulty) {
  const id = ++reqId;
  worker.postMessage({ id, n, seed, difficulty });
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function newLevel({ n = +$('#size').value, difficulty = $('#difficulty').value || null, seed, daily = false } = {}) {
  seed ??= (Math.random() * 2 ** 32) >>> 0;
  $('#loading').hidden = false;
  try {
    const { level, ms } = await generate(n, seed, difficulty);
    if (!level) throw new Error('Nessun livello trovato');
    level.genMs = ms;
    level.daily = daily;
    level.requested = difficulty;
    startLevel(level);
  } catch (err) {
    alert('Errore nella generazione: ' + err.message);
  } finally {
    $('#loading').hidden = true;
  }
}

// ------------------------------------------------------------ partita

function startLevel(level, saved = null) {
  S.level = level;
  S.board = createBoard(level.n, level.regions);
  S.marks = saved ? Uint8Array.from(saved.marks) : new Uint8Array(level.n * level.n);
  S.undo = [];
  S.redo = [];
  S.elapsed = saved?.elapsed ?? 0;
  S.hints = saved?.hints ?? 0;
  S.won = false;
  S.hint = null;
  $('#hint').hidden = true;
  $('#win').hidden = true;
  $('#size').value = String(level.n);
  buildBoard();
  buildAnalysis();
  render();
  save();
}

function save() {
  if (!S.level) return;
  store.set('game', { level: S.level, marks: [...S.marks], elapsed: S.elapsed, hints: S.hints, won: S.won });
}

function pushUndo() {
  S.undo.push(S.marks.slice());
  if (S.undo.length > 300) S.undo.shift();
  S.redo = [];
}

function setMark(i, v) {
  S.marks[i] = v;
  if (v === CAT && S.settings.autoX) {
    for (const j of S.board.sees[i]) if (S.marks[j] === UNKNOWN) S.marks[j] = CROSS;
  }
}

function afterChange() {
  clearHint();
  render();
  checkWin();
  save();
}

function conflicts() {
  const { board, marks } = S;
  const bad = new Set();
  const emptyUnits = new Set();
  const cats = [];
  marks.forEach((m, i) => m === CAT && cats.push(i));
  for (let a = 0; a < cats.length; a++) {
    for (let b = a + 1; b < cats.length; b++) {
      const i = cats[a];
      const j = cats[b];
      if (board.sees[i].includes(j)) { bad.add(i); bad.add(j); }
    }
  }
  board.units.forEach((u) => {
    if (u.cells.every((i) => marks[i] === CROSS)) u.cells.forEach((i) => emptyUnits.add(i));
  });
  return { bad, emptyUnits, cats: cats.length };
}

function checkWin() {
  if (S.won) return;
  const { bad, cats } = conflicts();
  if (cats === S.level.n && bad.size === 0) {
    S.won = true;
    save();
    const r = S.level.rating;
    $('#win-text').textContent =
      `Tempo ${fmtTime(S.elapsed)} · ${r.categoryName} (${r.score} punti)` + (S.hints ? ` · ${S.hints} suggeriment${S.hints === 1 ? 'o' : 'i'}` : '');
    setTimeout(() => ($('#win').hidden = false), 250);
  }
}

// ------------------------------------------------------------ disegno

function buildBoard() {
  const { n, regions } = S.level;
  const el = $('#board');
  el.style.setProperty('--n', n);
  el.innerHTML = '';
  for (let i = 0; i < n * n; i++) {
    const r = Math.floor(i / n);
    const c = i % n;
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.i = i;
    cell.setAttribute('role', 'gridcell');
    cell.style.setProperty('--rc', `var(--r${regions[i]})`);
    const thick = '3px';
    if (r > 0 && regions[i - n] !== regions[i]) cell.style.borderTopWidth = thick;
    if (c > 0 && regions[i - 1] !== regions[i]) cell.style.borderLeftWidth = thick;
    cell.innerHTML = '<svg class="cat" aria-hidden="true"><use href="#cat"/></svg>';
    el.appendChild(cell);
  }
}

function render() {
  const el = $('#board');
  const replay = S.replay.on;
  const marks = replay ? S.replay.states[S.replay.index] : S.marks;
  const { bad, emptyUnits } = replay ? { bad: new Set(), emptyUnits: new Set() } : conflicts();
  const hl = replay ? replayHighlight() : S.hint?.highlight ?? {};
  el.classList.toggle('replay', replay);
  const cells = el.children;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    c.dataset.s = marks[i];
    c.classList.toggle('conflict', S.settings.showConflicts && bad.has(i));
    c.classList.toggle('empty-unit', S.settings.showConflicts && emptyUnits.has(i));
    for (const k of ['focus', 'unit', 'elim', 'place', 'error']) c.classList.toggle(`hl-${k}`, !!hl[k]?.has(i));
    const r = Math.floor(i / S.level.n) + 1;
    const col = (i % S.level.n) + 1;
    c.setAttribute('aria-label', `riga ${r} colonna ${col}: ${['vuota', 'esclusa', 'gatto'][marks[i]]}`);
  }
  const cats = S.marks.reduce((a, m) => a + (m === CAT), 0);
  $('#cats-count').textContent = `${cats}/${S.level.n} 🐾`;
  const badge = $('#badge');
  badge.className = `badge ${S.level.rating.category}`;
  badge.textContent = `${S.level.daily ? 'Sfida del giorno · ' : ''}${S.level.rating.categoryName} · ${S.level.n}×${S.level.n}`;
  $('#btn-undo').disabled = !S.undo.length || replay;
  $('#btn-redo').disabled = !S.redo.length || replay;
  $('#timer').textContent = fmtTime(S.elapsed);
}

function fmtTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ------------------------------------------------------------ input

const boardEl = $('#board');
const cellAt = (x, y) => document.elementFromPoint(x, y)?.closest?.('.cell');

boardEl.addEventListener('pointerdown', (e) => {
  const cell = e.target.closest('.cell');
  if (!cell || S.won || S.replay.on) return;
  e.preventDefault();
  const i = +cell.dataset.i;
  const old = S.marks[i];
  const next = old === UNKNOWN ? CROSS : old === CROSS ? CAT : UNKNOWN;
  pushUndo();
  setMark(i, next);
  S.drag = next === CROSS ? { pointer: e.pointerId } : null;
  afterChange();
});
boardEl.addEventListener('pointermove', (e) => {
  if (!S.drag || S.drag.pointer !== e.pointerId) return;
  const cell = cellAt(e.clientX, e.clientY);
  if (!cell) return;
  const i = +cell.dataset.i;
  if (S.marks[i] === UNKNOWN) {
    S.marks[i] = CROSS;
    afterChange();
  }
});
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) boardEl.addEventListener(ev, () => (S.drag = null));

$('#btn-undo').onclick = () => {
  if (!S.undo.length) return;
  S.redo.push(S.marks.slice());
  S.marks = S.undo.pop();
  S.won = false;
  afterChange();
};
$('#btn-redo').onclick = () => {
  if (!S.redo.length) return;
  S.undo.push(S.marks.slice());
  S.marks = S.redo.pop();
  afterChange();
};
$('#btn-reset').onclick = () => {
  if (!S.marks.some((m) => m)) return;
  pushUndo();
  S.marks.fill(0);
  S.won = false;
  afterChange();
};
$('#btn-new').onclick = () => newLevel();
$('#win-next').onclick = () => { $('#win').hidden = true; newLevel({ difficulty: S.level.requested ?? null }); };
$('#win-close').onclick = () => ($('#win').hidden = true);
$('#btn-daily').onclick = () => {
  const today = new Date().toISOString().slice(0, 10);
  newLevel({ n: 8, difficulty: 'medio', seed: hashString(today), daily: true });
};
$('#btn-seed').onclick = () => {
  const seed = parseInt($('#seed-input').value, 10);
  if (Number.isFinite(seed)) newLevel({ seed: seed >>> 0, difficulty: null });
};

// ------------------------------------------------------------ suggerimenti

function computeHint() {
  const { board, marks, level } = S;
  const sol = new Set(level.solution);
  const wrong = [];
  marks.forEach((m, i) => {
    if ((m === CAT && !sol.has(i)) || (m === CROSS && sol.has(i))) wrong.push(i);
  });
  if (wrong.length) {
    return {
      title: 'C\'è un errore',
      text: `${wrong.length === 1 ? 'La casella evidenziata è sbagliata' : `Ci sono ${wrong.length} caselle sbagliate (evidenziate)`}: un gatto non va lì, oppure lì c'è una X dove serve un gatto.`,
      highlight: { error: new Set(wrong) },
      apply: () => wrong.forEach((i) => (S.marks[i] = UNKNOWN)),
      applyLabel: 'Correggi',
    };
  }
  const st = emptyState(board);
  marks.forEach((m, i) => m === CROSS && (st[i] = CROSS));
  marks.forEach((m, i) => m === CAT && placeCat(board, st, i));
  const obvious = [];
  st.forEach((v, i) => v === CROSS && marks[i] === UNKNOWN && obvious.push(i));
  if (obvious.length) {
    const cats = new Set();
    for (const i of obvious) for (const j of board.sees[i]) if (marks[j] === CAT) cats.add(j);
    return {
      title: 'Intorno ai gatti',
      text: 'Ogni gatto esclude la sua riga, la sua colonna, la sua regione e le 8 caselle intorno. Puoi segnare con una X le caselle evidenziate.',
      highlight: { focus: cats, elim: new Set(obvious) },
      apply: () => obvious.forEach((i) => (S.marks[i] = CROSS)),
    };
  }
  const d = nextDeduction(board, st);
  if (!d) return { title: 'Nessun suggerimento', text: 'Non trovo una deduzione da qui.', highlight: {} };
  const { title, text } = explainDeduction(board, d);
  return {
    title: `${title}`,
    text,
    highlight: deductionHighlight(d),
    apply: () => {
      if (d.place !== undefined) setMark(d.place, CAT);
      for (const i of d.eliminate) if (S.marks[i] === UNKNOWN) S.marks[i] = CROSS;
    },
  };
}

function deductionHighlight(d) {
  const units = new Set();
  for (const u of [...(d.units ?? []), ...(d.targets ?? [])]) for (const i of S.board.units[u].cells) units.add(i);
  const focus = new Set(d.cell !== undefined ? [d.cell] : d.focus ?? []);
  return {
    unit: units,
    focus,
    elim: new Set(d.eliminate),
    place: new Set(d.place !== undefined ? [d.place] : []),
  };
}

function clearHint() {
  S.hint = null;
  $('#hint').hidden = true;
}

$('#btn-hint').onclick = () => {
  if (S.won || S.replay.on) return;
  S.hint = computeHint();
  S.hints++;
  $('#hint-title').textContent = S.hint.title;
  $('#hint-text').textContent = S.hint.text;
  $('#hint-apply').hidden = !S.hint.apply;
  $('#hint-apply').textContent = S.hint.applyLabel ?? 'Applica';
  $('#hint').hidden = false;
  render();
  save();
};
$('#hint-apply').onclick = () => {
  if (!S.hint?.apply) return;
  pushUndo();
  S.hint.apply();
  afterChange();
};
$('#hint-close').onclick = () => { clearHint(); render(); };

// ------------------------------------------------------------ analisi del livello

function buildAnalysis() {
  const { level, board } = S;
  const r = level.rating;
  const res = solveLogically(board);
  const states = [emptyState(board)];
  for (const step of res.steps) {
    const st = states.at(-1).slice();
    applyDeduction(board, st, step);
    states.push(st);
  }
  S.replay.steps = res.steps;
  S.replay.states = states;
  S.replay.index = 0;
  $('#replay-slider').max = res.steps.length;
  $('#replay-slider').value = 0;

  const maxCount = Math.max(1, ...Object.values(r.counts));
  const rows = TECHNIQUES.map((t) => {
    const c = r.counts[t.id];
    const w = Math.round((c / maxCount) * 80);
    return `<tr><td>${t.name} <span class="muted">(peso ${t.weight})</span></td><td><span class="bar" style="width:${w}px"></span>${c}</td></tr>`;
  }).join('');
  $('#analysis-body').innerHTML = `
    <table>
      <tr><td>Categoria</td><td><b>${r.categoryName}</b></td></tr>
      <tr><td>Punteggio</td><td><b>${r.score}</b></td></tr>
      <tr><td>Tecnica più difficile necessaria</td><td>${TECHNIQUES.find((t) => t.id === r.hardestTechnique).name}</td></tr>
      <tr><td>Passi del risolutore</td><td>${r.steps}</td></tr>
      <tr><td>Colli di bottiglia</td><td>${r.bottlenecks}</td></tr>
    </table>
    <table>${rows}</table>
    <p class="muted">Seme ${level.seed} · ${level.tries ?? 1} tentativ${(level.tries ?? 1) === 1 ? 'o' : 'i'} · ${level.repairs} riparazioni dell'unicità · generato in ${level.genMs ?? '?'} ms${level.fallback ? ' · categoria richiesta non trovata, mostrato il livello più vicino' : ''}</p>`;
  $('#seed-input').value = level.seed;
}

function replayHighlight() {
  const step = S.replay.steps[S.replay.index];
  return step ? deductionHighlight(step) : {};
}

function renderReplayText() {
  const { steps, index } = S.replay;
  const step = steps[index];
  if (!step) {
    $('#replay-text').textContent = `Risolto in ${steps.length} passi.`;
    return;
  }
  const { title, text } = explainDeduction(S.board, step);
  $('#replay-text').innerHTML = `<b>Passo ${index + 1}/${steps.length} – ${title}</b> <span class="muted">(${step.options} alternativ${step.options === 1 ? 'a' : 'e'} di questo livello)</span><br>${text}`;
}

function setReplay(on) {
  S.replay.on = on;
  $('#replay').hidden = !on;
  $('#opt-replay').checked = on;
  if (on) { clearHint(); renderReplayText(); }
  render();
}
$('#opt-replay').onchange = (e) => setReplay(e.target.checked);
$('#analysis').addEventListener('toggle', (e) => { if (!e.target.open && S.replay.on) setReplay(false); });
function goReplay(i) {
  S.replay.index = Math.max(0, Math.min(S.replay.steps.length, i));
  $('#replay-slider').value = S.replay.index;
  renderReplayText();
  render();
}
$('#replay-slider').oninput = (e) => goReplay(+e.target.value);
$('#replay-prev').onclick = () => goReplay(S.replay.index - 1);
$('#replay-next').onclick = () => goReplay(S.replay.index + 1);

// ------------------------------------------------------------ impostazioni e timer

$('#opt-autox').checked = S.settings.autoX;
$('#opt-conflicts').checked = S.settings.showConflicts;
$('#opt-autox').onchange = (e) => { S.settings.autoX = e.target.checked; store.set('settings', S.settings); };
$('#opt-conflicts').onchange = (e) => { S.settings.showConflicts = e.target.checked; store.set('settings', S.settings); render(); };

setInterval(() => {
  const now = performance.now();
  if (S.level && !S.won && !document.hidden && S.lastTick) {
    S.elapsed += now - S.lastTick;
    $('#timer').textContent = fmtTime(S.elapsed);
  }
  S.lastTick = now;
}, 500);
setInterval(save, 5000);

// ------------------------------------------------------------ avvio

const saved = store.get('game', null);
if (saved?.level?.rating && !saved.won) startLevel(saved.level, saved);
else newLevel({ n: 6, difficulty: 'facile' });
