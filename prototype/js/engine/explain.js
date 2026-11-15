// Spiegazioni in italiano delle deduzioni del risolutore logico (usate dai suggerimenti).

import { TECHNIQUES } from './logic.js';

export const REGION_NAMES = ['rosa', 'pesca', 'gialla', 'verde', 'menta', 'azzurra', 'lavanda', 'lilla', 'sabbia', 'grigia'];

const PLURAL = { row: 'righe', col: 'colonne', region: 'regioni' };
const SINGULAR = { row: 'riga', col: 'colonna', region: 'regione' };

function label(board, u) {
  const { type, index } = board.units[u];
  return type === 'region' ? REGION_NAMES[index] : String(index + 1);
}

export function unitName(board, u) {
  return `${SINGULAR[board.units[u].type]} ${label(board, u)}`;
}

function joinIt(parts) {
  return parts.length <= 1 ? parts.join('') : `${parts.slice(0, -1).join(', ')} e ${parts.at(-1)}`;
}

/** "la regione rosa" / "le regioni rosa e verde" / "le righe 2 e 3" */
export function unitsName(board, units, withArticle = true) {
  const type = board.units[units[0]].type;
  const labels = units.map((u) => label(board, u));
  if (units.length === 1) return `${withArticle ? 'la ' : ''}${SINGULAR[type]} ${labels[0]}`;
  return `${withArticle ? 'le ' : ''}${PLURAL[type]} ${joinIt(labels)}`;
}

export function explainDeduction(board, d) {
  const tech = TECHNIQUES.find((t) => t.id === d.tech)?.name ?? d.tech;
  let text;
  switch (d.tech) {
    case 'single':
      text = `Nella ${unitName(board, d.units[0])} resta una sola casella libera: il gatto va lì.`;
      break;
    case 'confine1': {
      const a = unitName(board, d.units[0]);
      const b = unitName(board, d.targets[0]);
      text = `Tutte le caselle libere della ${a} sono nella ${b}. Quindi il gatto della ${b} sarà per forza quello della ${a}: le altre caselle della ${b} si possono escludere.`;
      break;
    }
    case 'attack':
      text = `Se ci fosse un gatto nella casella evidenziata, la ${unitName(board, d.units[0])} non avrebbe più caselle libere. Quindi lì il gatto non può stare.`;
      break;
    case 'confine2':
    case 'confine3':
    case 'confine4': {
      const A = unitsName(board, d.units);
      const B = unitsName(board, d.targets);
      const bType = PLURAL[board.units[d.targets[0]].type];
      text = `${A[0].toUpperCase() + A.slice(1)} hanno tutte le caselle libere dentro ${B}. Sono ${d.k} gatti per ${d.k} ${bType}: li occupano tutte, quindi le altre caselle di quelle ${bType} si possono escludere.`;
      break;
    }
    case 'contradiction':
      text = `Prova a immaginare un gatto nella casella evidenziata: seguendo solo le deduzioni semplici, dopo ${d.chain} passaggi la ${unitName(board, d.units[0])} resterebbe senza caselle libere (o con due gatti). Quindi lì il gatto non può stare.`;
      break;
    default:
      text = 'Deduzione.';
  }
  return { title: tech, text };
}
