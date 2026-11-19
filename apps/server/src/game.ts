/**
 * Logica di gioco lato server: il server genera i livelli, misura il tempo,
 * verifica la soluzione e assegna punti, XP, serie, Lumi, medaglie e accessori.
 */
import { and, eq, or, desc, inArray } from 'drizzle-orm';
import {
  createBoard, isValidSolution, levelFromSeed, computePoints, levelFromXp, rankFor, updateStreak, isHard,
  visibleStreak, dayKey, earnedMedals, unlockedAccessories, compareResults, parTimeMs, TECHNIQUES,
  type RatedLevel, type PlayerStats, type Want,
} from '@bradoku/core';
import type { DB } from './db/index.js';
import type { Friend } from './portal.js';
import { users, games, challenges, pathLevels, type User, type Game, type Challenge } from './db/schema.js';
import { generate } from './levels.js';

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const randomSeed = (): number => Math.floor(Math.random() * 2 ** 31);

/** Cache dei livelli: rigenerare un 12×12 dal seme richiede qualche centinaio di ms. */
const levelCache = new Map<string, RatedLevel>();
function remember(lv: RatedLevel): RatedLevel {
  if (levelCache.size > 500) levelCache.clear();
  levelCache.set(`${lv.n}:${lv.seed}`, lv);
  return lv;
}
export function levelFor(n: number, seed: number): RatedLevel {
  const lv = levelCache.get(`${n}:${seed}`);
  if (lv) return lv;
  const fresh = levelFromSeed(n, seed);
  if (!fresh) throw new HttpError(500, 'Livello non risolvibile');
  return remember(fresh);
}

/** Livello nuovo per una sfida (generato nel worker: può richiedere qualche secondo). */
export async function newLevel(n: number, want: Want): Promise<RatedLevel> {
  return remember(await generate({ kind: 'want', n, seed: randomSeed(), want }));
}

// ---- Percorso: quadri uguali per tutti, generati una volta sola e salvati

const pathInFlight = new Map<number, Promise<RatedLevel>>();

export function pathLevelFor(db: DB, k: number): Promise<RatedLevel> {
  let p = pathInFlight.get(k);
  if (p) return p;
  p = (async () => {
    const [row] = await db.select().from(pathLevels).where(eq(pathLevels.k, k));
    if (row) return levelFor(row.n, row.seed);
    const lv = remember(await generate({ kind: 'path', k }));
    await db.insert(pathLevels).values({ k, n: lv.n, seed: lv.seed, category: lv.rating.category }).onConflictDoNothing();
    return lv;
  })().finally(() => pathInFlight.delete(k));
  pathInFlight.set(k, p);
  return p;
}

/** Prepara in anticipo il quadro k, così quando arriva il giocatore è già pronto. */
export function prefetchPath(db: DB, k: number): void {
  pathLevelFor(db, k).catch((e) => console.warn(`Livello ${k} non preparato: ${(e as Error).message}`));
}

export async function pathInfo(db: DB, u: User) {
  const k = u.pathDone + 1;
  const lv = await pathLevelFor(db, k);
  prefetchPath(db, k + 1);
  const [playing] = await db.select({ id: games.id }).from(games).where(and(eq(games.userId, u.id), eq(games.pathK, k), eq(games.status, 'playing')));
  return { done: u.pathDone, next: { k, n: lv.n, seed: lv.seed, hard: isHard(lv.rating.category) }, playingGameId: playing?.id ?? null };
}

/** Gioca il prossimo quadro del Percorso (riprende la partita se è già iniziata). */
export async function playPath(db: DB, u: User) {
  const k = u.pathDone + 1;
  const [playing] = await db.select().from(games).where(and(eq(games.userId, u.id), eq(games.pathK, k), eq(games.status, 'playing')));
  if (playing) return resumeGame(db, u, playing.id);
  const lv = await pathLevelFor(db, k);
  prefetchPath(db, k + 1);
  const [g] = await db.insert(games).values({ userId: u.id, pathK: k, n: lv.n, difficulty: lv.rating.category, seed: lv.seed }).returning();
  return gamePayload(u, g!, lv);
}

function stats(u: User): PlayerStats {
  return {
    solved: u.solved,
    noHintSolved: u.noHintSolved,
    level: levelFromXp(u.xp).level,
    cycles: u.cycles,
    challengesPlayed: u.challengesPlayed,
    challengesWon: u.challengesWon,
    winStreak: u.winStreak,
    rematchWins: u.rematchWins,
  };
}

export async function getUser(db: DB, id: string): Promise<User> {
  const [u] = await db.select().from(users).where(eq(users.id, id));
  if (!u) throw new HttpError(401, 'Utente non trovato');
  return u;
}

export async function profile(db: DB, u: User) {
  const lv = levelFromXp(u.xp);
  const today = dayKey(new Date());
  const mine = await db.select().from(challenges).where(and(eq(challenges.status, 'open'), or(eq(challenges.creatorId, u.id), eq(challenges.opponentId, u.id))));
  let myTurn = 0;
  if (mine.length) {
    const played = await db.select({ c: games.challengeId }).from(games).where(and(eq(games.userId, u.id), eq(games.status, 'done'), inArray(games.challengeId, mine.map((c) => c.id))));
    const done = new Set(played.map((p) => p.c));
    myTurn = mine.filter((c) => !done.has(c.id)).length;
  }
  return {
    id: u.id,
    username: u.username,
    xp: u.xp,
    level: lv.level,
    xpInto: lv.xpInto,
    xpNeed: lv.need,
    rank: rankFor(lv.level).name,
    streak: visibleStreak(u.streak, u.lastPlayDay, today),
    playedToday: u.lastPlayDay === today,
    lumi: u.lumi,
    medals: u.medals,
    techniques: u.techniques,
    seenTechniques: u.seenTechniques,
    accessory: u.accessory,
    accessories: unlockedAccessories(lv.level, u.medals),
    pathDone: u.pathDone,
    stats: stats(u),
    challengesToPlay: myTurn,
  };
}

export function publicLevel(lv: RatedLevel) {
  return {
    n: lv.n,
    seed: lv.seed,
    regions: lv.regions,
    rating: {
      category: lv.rating.category,
      categoryName: lv.rating.categoryName,
      hard: isHard(lv.rating.category),
      score: lv.rating.score,
      steps: lv.rating.steps,
      counts: lv.rating.counts,
      hardestTechnique: lv.rating.hardestTechnique,
    },
    parMs: parTimeMs(lv.rating),
  };
}

/** Tempo di gioco: dall'inizio, meno le pause (solo il Percorso si mette in pausa). */
export function elapsedMs(g: Pick<Game, 'startedAt' | 'pausedAt' | 'pausedMs'>, now = new Date()): number {
  const end = g.pausedAt ?? now;
  return Math.max(0, end.getTime() - g.startedAt.getTime() - g.pausedMs);
}

function gamePayload(u: User, g: Game, lv: RatedLevel) {
  return {
    gameId: g.id, challengeId: g.challengeId, pathK: g.pathK, startedAt: g.startedAt.toISOString(), serverNow: new Date().toISOString(),
    elapsedMs: elapsedMs(g), paused: g.pausedAt !== null,
    level: publicLevel(lv), lumiAvailable: g.challengeId ? 0 : u.lumi,
  };
}

async function ownPlayingGame(db: DB, userId: string, gameId: number): Promise<Game> {
  const [g] = await db.select().from(games).where(and(eq(games.id, gameId), eq(games.userId, userId)));
  if (!g) throw new HttpError(404, 'Partita non trovata');
  if (g.status !== 'playing') throw new HttpError(409, 'Partita già conclusa');
  return g;
}

/**
 * Il giocatore esce dal livello (o l'app va in secondo piano): nel Percorso il tempo si ferma.
 * Nelle sfide il tempo scorre comunque, per equità tra i due giocatori.
 */
export async function pauseGame(db: DB, userId: string, gameId: number) {
  const g = await ownPlayingGame(db, userId, gameId);
  if (g.pathK === null || g.pausedAt) return { elapsedMs: elapsedMs(g), paused: g.pausedAt !== null };
  const now = new Date();
  await db.update(games).set({ pausedAt: now }).where(eq(games.id, g.id));
  return { elapsedMs: elapsedMs({ ...g, pausedAt: now }), paused: true };
}

/** Il giocatore rientra nel livello: il tempo riparte da dove si era fermato. */
export async function unpauseGame(db: DB, userId: string, gameId: number) {
  const g = await ownPlayingGame(db, userId, gameId);
  if (!g.pausedAt) return { elapsedMs: elapsedMs(g), paused: false };
  const now = new Date();
  const pausedMs = g.pausedMs + Math.max(0, now.getTime() - g.pausedAt.getTime());
  await db.update(games).set({ pausedAt: null, pausedMs }).where(eq(games.id, g.id));
  return { elapsedMs: elapsedMs({ ...g, pausedAt: null, pausedMs }, now), paused: false };
}

async function startChallengeGame(db: DB, u: User, c: Challenge) {
  const lv = levelFor(c.n, c.seed);
  const [g] = await db.insert(games).values({ userId: u.id, challengeId: c.id, n: lv.n, difficulty: c.difficulty, seed: lv.seed }).returning();
  return gamePayload(u, g!, lv);
}

export async function resumeGame(db: DB, u: User, gameId: number) {
  const [g] = await db.select().from(games).where(and(eq(games.id, gameId), eq(games.userId, u.id)));
  if (!g) throw new HttpError(404, 'Partita non trovata');
  if (g.status !== 'playing') throw new HttpError(409, 'Partita già conclusa');
  return gamePayload(u, g, levelFor(g.n, g.seed));
}

export interface FinishInput {
  pieces: number[];
  hints: number;
  lumi: boolean;
  clean: boolean;
}

export async function finishGame(db: DB, userId: string, gameId: number, input: FinishInput) {
  const before = await getUser(db, userId);
  const [g] = await db.select().from(games).where(and(eq(games.id, gameId), eq(games.userId, userId)));
  if (!g) throw new HttpError(404, 'Partita non trovata');
  if (g.status !== 'playing') throw new HttpError(409, 'Partita già conclusa');
  const lv = levelFor(g.n, g.seed);
  if (!isValidSolution(createBoard(lv.n, lv.regions), input.pieces)) throw new HttpError(400, 'La soluzione non è corretta');
  if (input.lumi && g.challengeId) throw new HttpError(400, 'Nelle sfide i Lumi non si possono usare');
  const lumiUsed = input.lumi && before.lumi > 0;

  const now = new Date();
  const durationMs = Math.max(1000, elapsedMs(g, now));
  const score = computePoints({ rating: lv.rating, durationMs, hints: input.hints, clean: input.clean, hard: isHard(lv.rating.category) });
  const pathAdvanced = g.pathK !== null && g.pathK === before.pathDone + 1;
  const pure = input.hints === 0 && !lumiUsed;
  const streak = updateStreak({ streak: before.streak, lastPlayDay: before.lastPlayDay, cycles: before.cycles }, dayKey(now));

  const techniques = { ...before.techniques };
  if (pure) for (const t of TECHNIQUES) if (lv.rating.counts[t.id] > 0) techniques[t.id] = (techniques[t.id] ?? 0) + lv.rating.counts[t.id];

  const after: User = {
    ...before,
    xp: before.xp + score.points,
    solved: before.solved + 1,
    noHintSolved: before.noHintSolved + (pure ? 1 : 0),
    streak: streak.streak,
    lastPlayDay: streak.lastPlayDay,
    cycles: streak.cycles,
    lumi: before.lumi - (lumiUsed ? 1 : 0) + streak.lumiGained,
    challengesPlayed: before.challengesPlayed + (g.challengeId ? 1 : 0),
    techniques,
    pathDone: before.pathDone + (pathAdvanced ? 1 : 0),
  };
  const ctx = { n: lv.n, rating: lv.rating, hints: input.hints, lumi: lumiUsed, clean: input.clean, durationMs, parMs: score.parMs };
  const newMedals = earnedMedals(stats(after), ctx).filter((m) => !before.medals.includes(m));
  after.medals = [...before.medals, ...newMedals];

  await db.update(games).set({ status: 'done', finishedAt: now, durationMs, hints: input.hints, lumi: lumiUsed, clean: input.clean, points: score.points }).where(eq(games.id, g.id));
  await db
    .update(users)
    .set({
      xp: after.xp, solved: after.solved, noHintSolved: after.noHintSolved, streak: after.streak, lastPlayDay: after.lastPlayDay,
      cycles: after.cycles, lumi: after.lumi, challengesPlayed: after.challengesPlayed, techniques: after.techniques, medals: after.medals,
      pathDone: after.pathDone,
    })
    .where(eq(users.id, userId));

  const lvBefore = levelFromXp(before.xp);
  const lvAfter = levelFromXp(after.xp);
  const accBefore = unlockedAccessories(lvBefore.level, before.medals);
  const challenge = g.challengeId ? await resolveChallenge(db, g.challengeId) : null;
  const finalUser = await getUser(db, userId);
  const accAfter = unlockedAccessories(levelFromXp(finalUser.xp).level, finalUser.medals);
  const challengeMedals = finalUser.medals.filter((m) => !after.medals.includes(m));
  if (pathAdvanced) prefetchPath(db, after.pathDone + 2);

  return {
    score: { ...score, durationMs },
    xp: { before: before.xp, after: after.xp, levelBefore: lvBefore.level, levelAfter: lvAfter.level, xpInto: lvAfter.xpInto, xpNeed: lvAfter.need, rank: rankFor(lvAfter.level).name },
    streak: { value: streak.streak, firstToday: streak.firstToday, lumiGained: streak.lumiGained },
    lumi: finalUser.lumi,
    newMedals: [...newMedals, ...challengeMedals],
    newAccessories: accAfter.filter((a) => !accBefore.includes(a)),
    challenge: challenge ? await challengeView(db, userId, challenge) : null,
    level: { n: lv.n, seed: lv.seed, category: lv.rating.category, categoryName: lv.rating.categoryName, hard: isHard(lv.rating.category) },
    path: g.pathK !== null ? { k: g.pathK, advanced: pathAdvanced, done: after.pathDone } : null,
    gameId: g.id,
  };
}

/** Se entrambi hanno giocato, chiude la sfida e aggiorna vittorie e medaglie. */
async function resolveChallenge(db: DB, challengeId: number): Promise<Challenge> {
  const [c] = await db.select().from(challenges).where(eq(challenges.id, challengeId));
  if (!c) throw new HttpError(404, 'Sfida non trovata');
  if (c.status !== 'open') return c;
  const results = await db.select().from(games).where(and(eq(games.challengeId, c.id), eq(games.status, 'done')));
  const a = results.find((r) => r.userId === c.creatorId);
  const b = results.find((r) => r.userId === c.opponentId);
  if (!a || !b) return c;
  const cmp = compareResults(
    { points: a.points ?? 0, hints: a.hints ?? 0, durationMs: a.durationMs ?? 0 },
    { points: b.points ?? 0, hints: b.hints ?? 0, durationMs: b.durationMs ?? 0 },
  );
  const winnerId = cmp > 0 ? c.creatorId : cmp < 0 ? c.opponentId : null;
  const [done] = await db.update(challenges).set({ status: 'completed', winnerId, completedAt: new Date() }).where(eq(challenges.id, c.id)).returning();

  let lostOriginal = new Set<string>();
  if (c.rematchOf) {
    const [orig] = await db.select().from(challenges).where(eq(challenges.id, c.rematchOf));
    if (orig?.winnerId) lostOriginal = new Set([orig.creatorId, orig.opponentId].filter((id) => id !== orig.winnerId));
  }
  for (const id of [c.creatorId, c.opponentId]) {
    const u = await getUser(db, id);
    const won = winnerId === id;
    const next: User = {
      ...u,
      challengesWon: u.challengesWon + (won ? 1 : 0),
      winStreak: won ? u.winStreak + 1 : 0,
      rematchWins: u.rematchWins + (won && lostOriginal.has(id) ? 1 : 0),
    };
    const medals = [...new Set([...u.medals, ...earnedMedals(stats(next))])];
    await db.update(users).set({ challengesWon: next.challengesWon, winStreak: next.winStreak, rematchWins: next.rematchWins, medals }).where(eq(users.id, id));
  }
  return done!;
}

async function usernames(db: DB, ids: string[]): Promise<Map<string, string>> {
  if (!ids.length) return new Map();
  const rows = await db.select({ id: users.id, username: users.username, accessory: users.accessory }).from(users).where(inArray(users.id, [...new Set(ids)]));
  return new Map(rows.map((r) => [r.id, r.username]));
}

export async function challengeView(db: DB, me: string, c: Challenge, names?: Map<string, string>, gamesOf?: Game[]) {
  const nm = names ?? (await usernames(db, [c.creatorId, c.opponentId]));
  const gs = gamesOf ?? (await db.select().from(games).where(eq(games.challengeId, c.id)));
  const other = c.creatorId === me ? c.opponentId : c.creatorId;
  const res = (id: string) => {
    const g = gs.find((x) => x.userId === id && x.status === 'done');
    return g ? { played: true, points: g.points ?? 0, hints: g.hints ?? 0, durationMs: g.durationMs ?? 0, clean: !!g.clean } : { played: false };
  };
  const mine = res(me);
  const theirs = res(other);
  const lv = levelFor(c.n, c.seed);
  return {
    id: c.id,
    opponent: nm.get(other) ?? '?',
    opponentId: other,
    iCreated: c.creatorId === me,
    n: c.n,
    difficulty: c.difficulty,
    categoryName: lv.rating.categoryName,
    hard: isHard(lv.rating.category),
    seed: c.seed,
    techniques: lv.rating.counts,
    status: c.status,
    myTurn: c.status === 'open' && !mine.played,
    me: mine,
    them: mine.played || c.status !== 'open' ? theirs : { played: theirs.played },
    outcome: c.status === 'completed' ? (c.winnerId === me ? 'win' : c.winnerId === null ? 'draw' : 'loss') : null,
    rematchOf: c.rematchOf,
    createdAt: c.createdAt.toISOString(),
  };
}

export async function listChallenges(db: DB, me: string) {
  const list = await db.select().from(challenges).where(or(eq(challenges.creatorId, me), eq(challenges.opponentId, me))).orderBy(desc(challenges.createdAt)).limit(60);
  const names = await usernames(db, list.flatMap((c) => [c.creatorId, c.opponentId]));
  const gs = list.length ? await db.select().from(games).where(inArray(games.challengeId, list.map((c) => c.id))) : [];
  return Promise.all(list.map((c) => challengeView(db, me, c, names, gs.filter((g) => g.challengeId === c.id))));
}

/**
 * Nuova sfida verso un amico già verificato dal portale (`opponent` arriva da Portal.check, mai dal
 * browser). L'amico potrebbe non aver mai aperto Bradoku: la sua riga si crea qui.
 */
export async function createChallenge(db: DB, me: User, input: { opponent: Friend; n?: number; want?: Want; fromGameId?: number; rematchOf?: number }) {
  if (input.opponent.sub === me.id) throw new HttpError(400, 'Non puoi sfidare te stesso');
  await rememberUser(db, input.opponent);
  const opp = { id: input.opponent.sub };

  if (input.fromGameId) {
    const [g] = await db.select().from(games).where(and(eq(games.id, input.fromGameId), eq(games.userId, me.id)));
    if (!g || g.status !== 'done') throw new HttpError(400, 'Puoi sfidare solo su un livello che hai finito');
    if (g.challengeId) throw new HttpError(400, 'Questa partita fa già parte di una sfida');
    const [c] = await db.insert(challenges).values({ creatorId: me.id, opponentId: opp.id, n: g.n, difficulty: g.difficulty, seed: g.seed }).returning();
    await db.update(games).set({ challengeId: c!.id }).where(eq(games.id, g.id));
    await db.update(users).set({ challengesPlayed: me.challengesPlayed + 1 }).where(eq(users.id, me.id));
    return challengeView(db, me.id, c!);
  }
  const n = input.n ?? 8;
  const want = input.want ?? 'normale';
  const lv = await newLevel(n, want);
  const [c] = await db.insert(challenges).values({ creatorId: me.id, opponentId: opp.id, n, difficulty: want, seed: lv.seed, rematchOf: input.rematchOf ?? null }).returning();
  return challengeView(db, me.id, c!);
}

export async function getChallenge(db: DB, me: string, id: number): Promise<Challenge> {
  const [c] = await db.select().from(challenges).where(eq(challenges.id, id));
  if (!c || (c.creatorId !== me && c.opponentId !== me)) throw new HttpError(404, 'Sfida non trovata');
  return c;
}

export async function playChallenge(db: DB, me: User, id: number) {
  const c = await getChallenge(db, me.id, id);
  if (c.status !== 'open') throw new HttpError(409, 'La sfida è già conclusa');
  const [existing] = await db.select().from(games).where(and(eq(games.challengeId, c.id), eq(games.userId, me.id)));
  if (existing?.status === 'done') throw new HttpError(409, 'Hai già giocato questa sfida');
  if (existing) return resumeGame(db, me, existing.id);
  return startChallengeGame(db, me, c);
}

/** Rivincita: `opponent` è l'altro giocatore della sfida, verificato di nuovo come amico dal chiamante. */
export async function rematch(db: DB, me: User, c: Challenge, opponent: Friend) {
  // stessa griglia e stessa fascia (normale o difficile) della sfida originale
  const want: Want = isHard(levelFor(c.n, c.seed).rating.category) ? 'difficile+' : 'normale';
  return createChallenge(db, me, { opponent, n: c.n, want, rematchOf: c.id });
}

export const otherPlayer = (c: Challenge, me: string): string => (c.creatorId === me ? c.opponentId : c.creatorId);

/** Registra (o aggiorna) la riga dell'utente: chiave `sub`, il nome serve solo per mostrarlo. */
export async function rememberUser(db: DB, who: Friend): Promise<void> {
  await db
    .insert(users)
    .values({ id: who.sub, username: who.username })
    .onConflictDoUpdate({ target: users.id, set: { username: who.username, lastSeenAt: new Date() } });
}

/** Amici del portale con il bilancio delle sfide giocate con ciascuno (anche zero). */
export async function friends(db: DB, me: string, portalFriends: Friend[]) {
  const list = await db.select().from(challenges).where(and(eq(challenges.status, 'completed'), or(eq(challenges.creatorId, me), eq(challenges.opponentId, me))));
  const by = new Map(portalFriends.map((f) => [f.sub, { id: f.sub, username: f.username, wins: 0, losses: 0, draws: 0 }]));
  for (const c of list) {
    const row = by.get(c.creatorId === me ? c.opponentId : c.creatorId);
    if (!row) continue; // non più amici: il bilancio non si mostra
    if (c.winnerId === me) row.wins++;
    else if (c.winnerId === null) row.draws++;
    else row.losses++;
  }
  return [...by.values()].sort(
    (a, b) => b.wins + b.losses + b.draws - (a.wins + a.losses + a.draws) || a.username.localeCompare(b.username, 'it'),
  );
}
