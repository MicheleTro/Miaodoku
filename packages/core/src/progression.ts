/** Livelli del giocatore (stessa curva del Paroliere), ranghi e serie di presenza. */
export const xpNeed = (level: number): number => Math.round(60 * Math.pow(level, 1.4));

export function levelFromXp(totalXp: number): { level: number; xpInto: number; need: number } {
  let level = 1;
  let rest = Math.max(0, Math.floor(totalXp));
  while (rest >= xpNeed(level)) {
    rest -= xpNeed(level);
    level++;
  }
  return { level, xpInto: rest, need: xpNeed(level) };
}

export const RANKS = [
  { id: 'germoglio', name: 'Germoglio', from: 1 },
  { id: 'ramo', name: 'Ramo', from: 5 },
  { id: 'chioma', name: 'Chioma', from: 10 },
  { id: 'foresta', name: 'Foresta', from: 15 },
] as const;
export const rankFor = (level: number): (typeof RANKS)[number] => [...RANKS].reverse().find((r) => level >= r.from) ?? RANKS[0];

/** Giorno di calendario a Roma, "AAAA-MM-GG". */
export function dayKey(date: Date, timeZone = 'Europe/Rome'): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

export const LUMI_PER_CYCLE = 2;
export const STREAK_CYCLE = 10;

/**
 * Aggiorna la serie di presenza dopo una partita giocata nel giorno `today`.
 * Ogni 10 giorni consecutivi: +2 Lumi.
 */
export function updateStreak(
  s: { streak: number; lastPlayDay: string | null; cycles: number },
  today: string,
): { streak: number; lastPlayDay: string; cycles: number; lumiGained: number; firstToday: boolean } {
  if (s.lastPlayDay === today) return { ...s, lastPlayDay: today, lumiGained: 0, firstToday: false };
  const gap = s.lastPlayDay ? daysBetween(s.lastPlayDay, today) : Infinity;
  const streak = gap === 1 ? s.streak + 1 : 1;
  const completed = streak % STREAK_CYCLE === 0;
  return {
    streak,
    lastPlayDay: today,
    cycles: s.cycles + (completed ? 1 : 0),
    lumiGained: completed ? LUMI_PER_CYCLE : 0,
    firstToday: true,
  };
}

/** Serie mostrata: si azzera se ieri non si è giocato. */
export function visibleStreak(streak: number, lastPlayDay: string | null, today: string): number {
  if (!lastPlayDay) return 0;
  return daysBetween(lastPlayDay, today) <= 1 ? streak : 0;
}
