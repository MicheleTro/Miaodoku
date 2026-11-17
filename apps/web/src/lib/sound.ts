/**
 * Effetti sonori, sintetizzati con Web Audio: nessun file da scaricare, nessuna licenza.
 * Ogni suono è breve e morbido; si possono spegnere (preferenza salvata nel browser).
 * Il browser permette l'audio solo dopo un gesto dell'utente: il contesto si crea al primo tocco e si
 * rifà al primo tocco dopo che la pagina è stata in secondo piano (telefono bloccato, cambio di app).
 */
import { storage } from './api.js';

const MUTE_KEY = 'bradoku.muted';
let muted = storage.get(MUTE_KEY) === '1';
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuf: AudioBuffer | null = null;
/**
 * Il contesto va rifatto al prossimo tocco: la pagina è stata in secondo piano, o il sistema l'ha
 * interrotto (iOS: stato «interrupted», a volte resta muto anche se dice «running»).
 */
let stale = false;
const last = new Map<string, number>();

type AC = typeof AudioContext;
const AudioCtor = (): AC | undefined =>
  window.AudioContext ?? (window as unknown as { webkitAudioContext?: AC }).webkitAudioContext;

function create(): AudioContext | null {
  const Ctor = AudioCtor();
  if (!Ctor) return null;
  if (ctx) void ctx.close().catch(() => {});
  const c = new Ctor();
  master = c.createGain();
  master.gain.value = 0.5;
  master.connect(c.destination);
  noiseBuf = null;
  c.addEventListener('statechange', () => {
    if ((c.state as string) === 'interrupted') stale = true;
  });
  ctx = c;
  stale = false;
  return c;
}

/**
 * Da chiamare dentro un gesto dell'utente (tocco, tasto): è l'unico momento in cui il browser
 * lascia accendere o riaccendere l'audio.
 */
function unlock(): void {
  if (muted) return;
  try {
    const c = !ctx || stale || ctx.state === 'closed' ? create() : ctx;
    if (!c) return;
    if (c.state !== 'running') void c.resume().catch(() => {});
    // iOS: un suono vuoto durante il gesto sblocca davvero l'uscita
    const src = c.createBufferSource();
    src.buffer = c.createBuffer(1, 1, c.sampleRate);
    src.connect(c.destination);
    src.start();
  } catch {
    /* audio non disponibile */
  }
}

/**
 * Suona appena l'audio è pronto. Se il contesto si sta ancora riaccendendo aspetta un attimo;
 * se non si riaccende in tempo il suono si salta (meglio niente che un suono in ritardo).
 */
function play(draw: (c: AudioContext, out: GainNode) => void): void {
  if (muted) return;
  const c = ctx && !stale && ctx.state !== 'closed' ? ctx : null;
  if (!c || !master) return;
  const out = master;
  if (c.state === 'running') return draw(c, out);
  const asked = performance.now();
  c.resume()
    .then(() => {
      if (c === ctx && c.state === 'running' && performance.now() - asked < 400) draw(c, out);
    })
    .catch(() => {});
}

/** Evita che lo stesso suono si ripeta troppo fitto (es. trascinando tante X). */
function throttled(name: string, ms: number): boolean {
  const now = performance.now();
  if (now - (last.get(name) ?? -Infinity) < ms) return true;
  last.set(name, now);
  return false;
}

interface ToneOpts {
  type?: OscillatorType;
  gain?: number;
  /** frequenza finale (scivolata) */
  to?: number;
  attack?: number;
}

function tone(freq: number, at: number, dur: number, o: ToneOpts = {}): void {
  play((c, out) => {
    const t = c.currentTime + at;
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    const peak = o.gain ?? 0.25;
    const attack = o.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  });
}

/** Fruscio filtrato: il segno della matita. */
function noise(at: number, dur: number, freq: number, gain: number): void {
  play((c, out) => {
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate * 0.5, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = c.currentTime + at;
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    f.Q.value = 1.2;
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out);
    src.start(t);
    src.stop(t + dur + 0.02);
  });
}

/** Note a scala (Do maggiore) per arpeggi e conteggio punti. */
const C5 = 523.25, E5 = 659.25, G5 = 783.99, A5 = 880, C6 = 1046.5, E6 = 1318.5, G6 = 1568, C7 = 2093;

export const sfx = {
  /** tocco su un bottone */
  tap() {
    if (throttled('tap', 60)) return;
    tone(520, 0, 0.07, { type: 'triangle', to: 380, gain: 0.18 });
  },
  /** X segnata (anche trascinando) */
  cross() {
    if (throttled('cross', 45)) return;
    noise(0, 0.06, 3200, 0.35);
    tone(1400, 0, 0.03, { type: 'triangle', gain: 0.05 });
  },
  /** X tolta */
  uncross() {
    if (throttled('uncross', 45)) return;
    noise(0, 0.04, 1600, 0.2);
  },
  /** bradipo messo sulla griglia: un «pop» allegro */
  sloth() {
    tone(330, 0, 0.12, { to: 700, gain: 0.3 });
    tone(990, 0.07, 0.12, { type: 'triangle', gain: 0.1 });
  },
  /** bradipo tolto */
  unsloth() {
    tone(620, 0, 0.12, { to: 300, gain: 0.2 });
  },
  /** due bradipi si vedono, o casella sbagliata */
  oops() {
    tone(392, 0, 0.12, { type: 'triangle', gain: 0.22 });
    tone(311, 0.11, 0.2, { type: 'triangle', gain: 0.22, to: 290 });
  },
  undo() {
    tone(560, 0, 0.1, { type: 'triangle', to: 360, gain: 0.18 });
  },
  reset() {
    noise(0, 0.25, 900, 0.25);
    tone(500, 0, 0.25, { to: 200, gain: 0.12 });
  },
  /** suggerimento: campanellino */
  hint() {
    tone(A5, 0, 0.35, { gain: 0.18 });
    tone(C6 * 1.122, 0.09, 0.45, { gain: 0.16 });
  },
  /** suggerimento applicato */
  apply() {
    [E6, G6, C7].forEach((f, i) => tone(f, i * 0.05, 0.18, { gain: 0.1 }));
  },
  /** griglia risolta */
  win() {
    [C5, E5, G5, C6].forEach((f, i) => tone(f, i * 0.11, i === 3 ? 0.6 : 0.18, { type: 'triangle', gain: 0.26 }));
    [E6, G6, C7].forEach((f, i) => tone(f, 0.45 + i * 0.06, 0.25, { gain: 0.08 }));
  },
  /** conteggio dei punti: `k` da 0 a 1, il tono sale */
  tick(k: number) {
    if (throttled('tick', 55)) return;
    tone(500 + 900 * k, 0, 0.04, { type: 'square', gain: 0.05 });
  },
  /** punteggio finale */
  total() {
    tone(C6, 0, 0.7, { gain: 0.22 });
    tone(G6, 0, 0.7, { gain: 0.12 });
    tone(C7, 0.02, 0.5, { gain: 0.06 });
  },
  /** nuovo grado o sfida vinta: fanfara */
  fanfare() {
    const notes = [G5, C6, E6, G6];
    notes.forEach((f, i) => tone(f, i * 0.12, i === 3 ? 0.7 : 0.16, { type: 'square', gain: 0.09 }));
    tone(C6, 0.36, 0.7, { type: 'triangle', gain: 0.18 });
    tone(E6, 0.36, 0.7, { type: 'triangle', gain: 0.12 });
  },
  /** livello del Percorso completato */
  star() {
    [G5, C6, E6].forEach((f, i) => tone(f, i * 0.08, 0.3, { type: 'triangle', gain: 0.18 }));
  },
  /** medaglia o accessorio nuovo: luccichio */
  medal() {
    [G6, C7, E6 * 2, G6 * 2].forEach((f, i) => tone(f, i * 0.07, 0.3, { gain: 0.08 }));
  },
  /** sfida persa: due note che scendono, senza drammi */
  lose() {
    tone(G5, 0, 0.25, { type: 'triangle', gain: 0.18 });
    tone(E5, 0.22, 0.25, { type: 'triangle', gain: 0.18 });
    tone(C5, 0.44, 0.5, { type: 'triangle', gain: 0.18 });
  },
};

export const sound = {
  get muted() {
    return muted;
  },
  setMuted(v: boolean) {
    muted = v;
    storage.set(MUTE_KEY, v ? '1' : null);
    if (!v) {
      unlock();
      sfx.tap();
    }
  },
};

/**
 * Da chiamare una volta all'avvio. Ogni gesto (tocco, tasto) accende o riaccende l'audio; tornando
 * dal secondo piano il contesto si rifà al gesto successivo. Poi un suono a ogni tocco di bottone:
 * quelli con un suono proprio (Annulla, Aiuto…) hanno l'attributo `data-sfx` e qui si saltano.
 */
export function installButtonSounds(): void {
  const gesture = () => unlock();
  for (const type of ['touchend', 'click', 'keydown'] as const) document.addEventListener(type, gesture, { capture: true });
  document.addEventListener(
    'pointerdown',
    (e) => {
      unlock();
      const b = (e.target as Element | null)?.closest?.('button');
      if (b && !b.disabled && !b.hasAttribute('data-sfx')) sfx.tap();
    },
    { capture: true },
  );
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      stale = true;
      void ctx?.suspend().catch(() => {});
    }
  });
  window.addEventListener('pageshow', (e) => {
    if (e.persisted) stale = true;
  });
}
