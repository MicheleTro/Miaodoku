/** Worker thread: genera i livelli lontano dal thread del server (un 12×12 difficile può richiedere secondi). */
import { parentPort } from 'node:worker_threads';
import { generateWanted, pathLevel } from '@bradoku/core';
import type { GenJob } from './levels.js';

parentPort!.on('message', ({ id, job }: { id: number; job: GenJob }) => {
  try {
    const level = job.kind === 'path' ? pathLevel(job.k) : generateWanted(job.n, job.seed, job.want);
    parentPort!.postMessage({ id, level });
  } catch (e) {
    parentPort!.postMessage({ id, error: (e as Error).message });
  }
});
