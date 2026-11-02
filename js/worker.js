// Genera i livelli in un thread separato, così l'interfaccia non si blocca.
import { generateRated } from './engine/generator.js';

self.onmessage = (e) => {
  const { id, n, seed, difficulty } = e.data;
  const t0 = performance.now();
  try {
    const level = generateRated(n, seed, { difficulty, maxTries: difficulty ? 400 : 1 });
    self.postMessage({ id, level, ms: Math.round(performance.now() - t0) });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
