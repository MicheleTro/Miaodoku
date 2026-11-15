/** Accessori per i bradipi: si ottengono salendo di livello e con le medaglie delle tecniche. */
export interface Accessory {
  id: string;
  name: string;
  unlock: { level: number } | { medal: string };
}
export const ACCESSORIES: Accessory[] = [
  { id: 'nessuno', name: 'Al naturale', unlock: { level: 1 } },
  { id: 'foglia', name: 'Foglia', unlock: { level: 1 } },
  { id: 'fiore', name: 'Fiore', unlock: { level: 3 } },
  { id: 'berretto', name: 'Berretto', unlock: { level: 5 } },
  { id: 'occhiali', name: 'Occhiali', unlock: { level: 10 } },
  { id: 'cuffie', name: 'Cuffie', unlock: { level: 15 } },
  { id: 'alloro', name: 'Alloro', unlock: { level: 20 } },
  { id: 'bacche', name: 'Bacche', unlock: { medal: 'buon-vicino' } },
  { id: 'sciarpa', name: 'Sciarpa', unlock: { medal: 'coppia' } },
  { id: 'stella', name: 'Stella', unlock: { medal: 'terna' } },
  { id: 'farfalla', name: 'Farfalla', unlock: { medal: 'quaterna' } },
  { id: 'mago', name: 'Cappello da mago', unlock: { medal: 'e-se' } },
  { id: 'corona', name: 'Corona', unlock: { medal: 'gigante-pulito' } },
];

export function unlockedAccessories(level: number, medals: string[]): string[] {
  return ACCESSORIES.filter((a) => ('level' in a.unlock ? level >= a.unlock.level : medals.includes(a.unlock.medal))).map((a) => a.id);
}
