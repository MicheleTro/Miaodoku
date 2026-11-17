import { pgTable, serial, text, integer, boolean, timestamp, jsonb, bigint } from 'drizzle-orm/pg-core';

// Utenti: chiave = `sub` di whoru (decisione whoru #25: mai username o email come chiave).
// Il nome serve solo per mostrarlo e si aggiorna a ogni accesso; nessuna password qui.
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  username: text('username').notNull(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  xp: integer('xp').notNull().default(0),
  streak: integer('streak').notNull().default(0),
  lastPlayDay: text('last_play_day'),
  cycles: integer('cycles').notNull().default(0),
  lumi: integer('lumi').notNull().default(0),
  solved: integer('solved').notNull().default(0),
  noHintSolved: integer('no_hint_solved').notNull().default(0),
  challengesPlayed: integer('challenges_played').notNull().default(0),
  challengesWon: integer('challenges_won').notNull().default(0),
  winStreak: integer('win_streak').notNull().default(0),
  rematchWins: integer('rematch_wins').notNull().default(0),
  medals: jsonb('medals').$type<string[]>().notNull().default([]),
  techniques: jsonb('techniques').$type<Record<string, number>>().notNull().default({}),
  seenTechniques: jsonb('seen_techniques').$type<string[]>().notNull().default([]),
  accessory: text('accessory').notNull().default('foglia'),
  /** quadri del Percorso completati */
  pathDone: integer('path_done').notNull().default(0),
});

// Quadri del Percorso già generati: uguali per tutti, si generano una volta sola.
export const pathLevels = pgTable('path_levels', {
  k: integer('k').primaryKey(),
  n: integer('n').notNull(),
  seed: bigint('seed', { mode: 'number' }).notNull(),
  category: text('category').notNull(),
});

export const challenges = pgTable('challenges', {
  id: serial('id').primaryKey(),
  creatorId: text('creator_id').notNull(),
  opponentId: text('opponent_id').notNull(),
  n: integer('n').notNull(),
  difficulty: text('difficulty').notNull(),
  seed: bigint('seed', { mode: 'number' }).notNull(),
  status: text('status').notNull().default('open'),
  winnerId: text('winner_id'),
  rematchOf: integer('rematch_of'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  completedAt: timestamp('completed_at', { withTimezone: true }),
});

export const games = pgTable('games', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  challengeId: integer('challenge_id'),
  n: integer('n').notNull(),
  difficulty: text('difficulty').notNull(),
  seed: bigint('seed', { mode: 'number' }).notNull(),
  status: text('status').notNull().default('playing'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  durationMs: integer('duration_ms'),
  hints: integer('hints'),
  lumi: boolean('lumi'),
  clean: boolean('clean'),
  points: integer('points'),
  /** numero del quadro del Percorso (null per le sfide) */
  pathK: integer('path_k'),
});

export type User = typeof users.$inferSelect;
export type Game = typeof games.$inferSelect;
export type Challenge = typeof challenges.$inferSelect;

export const MIGRATION = `
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  username text NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  xp integer NOT NULL DEFAULT 0,
  streak integer NOT NULL DEFAULT 0,
  last_play_day text,
  cycles integer NOT NULL DEFAULT 0,
  lumi integer NOT NULL DEFAULT 0,
  solved integer NOT NULL DEFAULT 0,
  no_hint_solved integer NOT NULL DEFAULT 0,
  challenges_played integer NOT NULL DEFAULT 0,
  challenges_won integer NOT NULL DEFAULT 0,
  win_streak integer NOT NULL DEFAULT 0,
  rematch_wins integer NOT NULL DEFAULT 0,
  medals jsonb NOT NULL DEFAULT '[]',
  techniques jsonb NOT NULL DEFAULT '{}',
  seen_techniques jsonb NOT NULL DEFAULT '[]',
  accessory text NOT NULL DEFAULT 'foglia'
);
CREATE TABLE IF NOT EXISTS challenges (
  id serial PRIMARY KEY,
  creator_id text NOT NULL REFERENCES users(id),
  opponent_id text NOT NULL REFERENCES users(id),
  n integer NOT NULL,
  difficulty text NOT NULL,
  seed bigint NOT NULL,
  status text NOT NULL DEFAULT 'open',
  winner_id text,
  rematch_of integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
CREATE TABLE IF NOT EXISTS games (
  id serial PRIMARY KEY,
  user_id text NOT NULL REFERENCES users(id),
  challenge_id integer REFERENCES challenges(id),
  n integer NOT NULL,
  difficulty text NOT NULL,
  seed bigint NOT NULL,
  status text NOT NULL DEFAULT 'playing',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  hints integer,
  lumi boolean,
  clean boolean,
  points integer
);
ALTER TABLE users ADD COLUMN IF NOT EXISTS path_done integer NOT NULL DEFAULT 0;
ALTER TABLE games ADD COLUMN IF NOT EXISTS path_k integer;
CREATE TABLE IF NOT EXISTS path_levels (
  k integer PRIMARY KEY,
  n integer NOT NULL,
  seed bigint NOT NULL,
  category text NOT NULL
);
CREATE INDEX IF NOT EXISTS games_user_idx ON games(user_id);
CREATE INDEX IF NOT EXISTS games_challenge_idx ON games(challenge_id);
CREATE INDEX IF NOT EXISTS challenges_creator_idx ON challenges(creator_id);
CREATE INDEX IF NOT EXISTS challenges_opponent_idx ON challenges(opponent_id);
`;
