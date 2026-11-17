/**
 * Generazione dei livelli fuori dal thread principale: un worker thread dedicato, con una coda.
 * Se il worker non parte (o è disattivato, come nei test), si genera sul posto.
 */
import { Worker } from 'node:worker_threads';
import { generateWanted, pathLevel, type RatedLevel, type Want } from '@bradoku/core';

export type GenJob = { kind: 'path'; k: number } | { kind: 'want'; n: number; seed: number; want: Want };

let inline = false;
let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, { job: GenJob; resolve: (lv: RatedLevel) => void; reject: (e: Error) => void }>();

const runInline = (job: GenJob): RatedLevel => (job.kind === 'path' ? pathLevel(job.k) : generateWanted(job.n, job.seed, job.want));

/** Da qui in poi si genera sul thread principale (test, o worker non disponibile). */
export function useInlineGeneration(): void {
  inline = true;
  void stopGenerator();
}

function fallBack(reason: string): void {
  console.warn(`Generazione dei livelli sul thread principale: ${reason}`);
  inline = true;
  worker = null;
  for (const [id, p] of pending) {
    pending.delete(id);
    try {
      p.resolve(runInline(p.job));
    } catch (e) {
      p.reject(e as Error);
    }
  }
}

function getWorker(): Worker {
  if (worker) return worker;
  const w = new Worker(new URL('./gen-worker.ts', import.meta.url));
  w.unref();
  w.on('message', (m: { id: number; level?: RatedLevel; error?: string }) => {
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    if (m.level) p.resolve(m.level);
    else p.reject(new Error(m.error ?? 'Generazione fallita'));
  });
  w.on('error', (e) => fallBack(e.message));
  w.on('exit', (code) => {
    if (worker === w && code !== 0) fallBack(`worker uscito (${code})`);
  });
  worker = w;
  return w;
}

export function generate(job: GenJob): Promise<RatedLevel> {
  if (inline) {
    try {
      return Promise.resolve(runInline(job));
    } catch (e) {
      return Promise.reject(e as Error);
    }
  }
  return new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { job, resolve, reject });
    getWorker().postMessage({ id, job });
  });
}

export async function stopGenerator(): Promise<void> {
  const w = worker;
  worker = null;
  if (w) await w.terminate();
}
