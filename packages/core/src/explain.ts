/** Spiegazioni in italiano delle deduzioni (suggerimenti e coach). */
import type { Board, UnitType } from './board.js';
import { TECHNIQUES, type Deduction } from './logic.js';

export const REGION_NAMES = ['rosa', 'pesca', 'gialla', 'verde', 'menta', 'azzurra', 'lavanda', 'lilla', 'sabbia', 'grigia'];
const PLURAL: Record<UnitType, string> = { row: 'righe', col: 'colonne', region: 'regioni' };
const SINGULAR: Record<UnitType, string> = { row: 'riga', col: 'colonna', region: 'regione' };

const label = (b: Board, u: number): string => {
  const unit = b.units[u]!;
  return unit.type === 'region' ? REGION_NAMES[unit.index] ?? String(unit.index) : String(unit.index + 1);
};
export const unitName = (b: Board, u: number): string => `${SINGULAR[b.units[u]!.type]} ${label(b, u)}`;
const joinIt = (p: string[]): string => (p.length <= 1 ? p.join('') : `${p.slice(0, -1).join(', ')} e ${p.at(-1)}`);
function unitsName(b: Board, units: number[]): string {
  const type = b.units[units[0]!]!.type;
  const labels = units.map((u) => label(b, u));
  return units.length === 1 ? `la ${SINGULAR[type]} ${labels[0]}` : `le ${PLURAL[type]} ${joinIt(labels)}`;
}

/** Primo livello di aiuto: solo la zona in cui guardare. */
export function hintZone(b: Board, d: Deduction): string {
  const u = d.units[0]!;
  return `Guarda la ${unitName(b, u)}: lì c'è qualcosa da dedurre.`;
}

export function explainDeduction(b: Board, d: Deduction): { title: string; text: string } {
  const title = TECHNIQUES.find((t) => t.id === d.tech)?.name ?? d.tech;
  let text: string;
  switch (d.tech) {
    case 'single':
      text = `Nella ${unitName(b, d.units[0]!)} resta una sola casella libera: il bradipo va lì.`;
      break;
    case 'confine1': {
      const a = unitName(b, d.units[0]!);
      const t = unitName(b, d.targets![0]!);
      text = `Tutte le caselle libere della ${a} sono nella ${t}. Il bradipo della ${t} sarà per forza quello della ${a}: le altre caselle della ${t} si escludono.`;
      break;
    }
    case 'attack':
      text = `Un bradipo nella casella evidenziata lascerebbe la ${unitName(b, d.units[0]!)} senza posto. Quindi lì non può stare.`;
      break;
    case 'contradiction':
      text = `Immagina un bradipo nella casella evidenziata: con le deduzioni semplici, dopo ${d.chain} passaggi la ${unitName(b, d.units[0]!)} resterebbe senza posto. Quindi lì non va.`;
      break;
    default: {
      const A = unitsName(b, d.units);
      const B = unitsName(b, d.targets!);
      const bt = PLURAL[b.units[d.targets![0]!]!.type];
      text = `${A[0]!.toUpperCase()}${A.slice(1)} hanno tutte le caselle libere dentro ${B}. Sono ${d.k} bradipi per ${d.k} ${bt}: le occupano tutte, quindi il resto di quelle ${bt} si esclude.`;
    }
  }
  return { title, text };
}
