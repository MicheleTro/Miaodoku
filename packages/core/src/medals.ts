/** Le 18 medaglie: famiglie Base, Tecniche, Sfide, Serie. */
import type { Rating } from './difficulty.js';

export type MedalFamily = 'base' | 'tecniche' | 'sfide' | 'serie';
export interface MedalDef {
  id: string;
  family: MedalFamily;
  name: string;
  desc: string;
  glyph: string;
}

export const MEDALS: MedalDef[] = [
  { id: 'prima-partita', family: 'base', name: 'Prima partita', desc: 'Risolvi il primo livello.', glyph: '1' },
  { id: 'mente-lucida', family: 'base', name: 'Mente lucida', desc: '10 livelli senza suggerimenti.', glyph: '10' },
  { id: 'cento', family: 'base', name: 'Cento livelli', desc: 'Risolvi 100 livelli.', glyph: '100' },
  { id: 'mille', family: 'base', name: 'Mille livelli', desc: 'Risolvi 1.000 livelli.', glyph: '1k' },
  { id: 'livello-10', family: 'base', name: 'Livello 10', desc: 'Raggiungi il livello 10.', glyph: 'L10' },
  { id: 'lampo', family: 'base', name: 'Lampo', desc: 'Risolvi un Difficile (o più) in metà del tempo di riferimento.', glyph: '⚡' },
  { id: 'buon-vicino', family: 'tecniche', name: 'Buon vicino', desc: 'Senza suggerimenti, un livello che richiede Vicinato.', glyph: 'V' },
  { id: 'coppia', family: 'tecniche', name: 'Coppia', desc: 'Senza suggerimenti, un livello che richiede una Coppia.', glyph: '2' },
  { id: 'terna', family: 'tecniche', name: 'Terna', desc: 'Senza suggerimenti, un livello che richiede una Terna.', glyph: '3' },
  { id: 'quaterna', family: 'tecniche', name: 'Quaterna', desc: 'Senza suggerimenti, un livello che richiede una Quaterna.', glyph: '4' },
  { id: 'e-se', family: 'tecniche', name: 'E se…?', desc: 'Senza suggerimenti, un livello Diabolico (Ipotesi).', glyph: '?' },
  { id: 'gigante-pulito', family: 'tecniche', name: 'Gigante pulito', desc: 'Un 10×10 senza errori né suggerimenti.', glyph: '10²' },
  { id: 'prima-sfida', family: 'sfide', name: 'Prima sfida', desc: 'Gioca la tua prima sfida.', glyph: 'S' },
  { id: 'prima-vittoria', family: 'sfide', name: 'Prima vittoria', desc: 'Vinci una sfida.', glyph: 'V1' },
  { id: 'rivincita', family: 'sfide', name: 'Rivincita', desc: 'Vinci la rivincita di una sfida persa.', glyph: '↺' },
  { id: 'cinque-di-fila', family: 'sfide', name: 'Cinque di fila', desc: 'Vinci 5 sfide consecutive.', glyph: '5' },
  { id: 'ciclo', family: 'serie', name: 'Ciclo completo', desc: 'Completa una serie di 10 giorni.', glyph: '10g' },
  { id: 'tre-cicli', family: 'serie', name: 'Tre cicli', desc: 'Completa tre serie di 10 giorni.', glyph: '30g' },
];

export interface PlayerStats {
  solved: number;
  noHintSolved: number;
  level: number;
  cycles: number;
  challengesPlayed: number;
  challengesWon: number;
  winStreak: number;
  rematchWins: number;
}
export interface GameContext {
  n: number;
  rating: Pick<Rating, 'tier' | 'counts'>;
  hints: number;
  lumi: boolean;
  clean: boolean;
  durationMs: number;
  parMs: number;
}

/** Medaglie meritate in base alle statistiche (e all'ultima partita, se c'è). */
export function earnedMedals(stats: PlayerStats, game?: GameContext): string[] {
  const out: string[] = [];
  if (stats.solved >= 1) out.push('prima-partita');
  if (stats.noHintSolved >= 10) out.push('mente-lucida');
  if (stats.solved >= 100) out.push('cento');
  if (stats.solved >= 1000) out.push('mille');
  if (stats.level >= 10) out.push('livello-10');
  if (stats.challengesPlayed >= 1) out.push('prima-sfida');
  if (stats.challengesWon >= 1) out.push('prima-vittoria');
  if (stats.rematchWins >= 1) out.push('rivincita');
  if (stats.winStreak >= 5) out.push('cinque-di-fila');
  if (stats.cycles >= 1) out.push('ciclo');
  if (stats.cycles >= 3) out.push('tre-cicli');
  if (game) {
    const pure = game.hints === 0 && !game.lumi;
    if (game.rating.tier >= 2 && game.durationMs <= game.parMs / 2) out.push('lampo');
    if (pure) {
      const c = game.rating.counts;
      if (c.attack > 0) out.push('buon-vicino');
      if (c.confine2 > 0) out.push('coppia');
      if (c.confine3 > 0) out.push('terna');
      if (c.confine4 > 0) out.push('quaterna');
      if (c.contradiction > 0) out.push('e-se');
      if (game.n === 10 && game.clean) out.push('gigante-pulito');
    }
  }
  return out;
}
