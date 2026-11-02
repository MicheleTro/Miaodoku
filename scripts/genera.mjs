// Strumento a riga di comando per l'engine.
//
//   node scripts/genera.mjs --stats [--count 200] [--sizes 5,6,7,8,9,10]
//        Genera tanti livelli e mostra la distribuzione delle difficoltà per ogni dimensione.
//
//   node scripts/genera.mjs --pack --n 8 --per-category 20 [--out levels/8.json]
//        Crea un pacchetto di livelli ordinati per difficoltà.

import { writeFileSync, mkdirSync } from 'node:fs';
import { generateRated, CATEGORIES, TECHNIQUES } from '../js/engine/index.js';

const args = process.argv.slice(2);
const opt = (name, def) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : def;
};

if (args.includes('--stats')) {
  const count = Number(opt('count', 200));
  const sizes = opt('sizes', '5,6,7,8,9,10').split(',').map(Number);
  console.log(`Distribuzione su ${count} livelli casuali per dimensione\n`);
  const header = ['N', 'ms/livello', ...CATEGORIES.map((c) => c.name), 'scartati'];
  console.log(header.map((h) => h.padEnd(11)).join(''));
  const scoreRows = [];
  for (const n of sizes) {
    const byCat = Object.fromEntries(CATEGORIES.map((c) => [c.id, []]));
    let rejected = 0;
    const t0 = performance.now();
    for (let s = 1; s <= count; s++) {
      const lv = generateRated(n, n * 100000 + s, { maxTries: 1 });
      if (!lv) rejected++;
      else byCat[lv.rating.category].push(lv.rating);
    }
    const ms = ((performance.now() - t0) / count).toFixed(1);
    const pct = (k) => `${((byCat[k].length / count) * 100).toFixed(0)}%`;
    console.log([n, ms, ...CATEGORIES.map((c) => pct(c.id)), rejected].map((x) => String(x).padEnd(11)).join(''));
    scoreRows.push([n, byCat]);
  }
  console.log('\nPunteggio medio (min–max) per categoria');
  for (const [n, byCat] of scoreRows) {
    const cells = CATEGORIES.map((c) => {
      const s = byCat[c.id].map((r) => r.score);
      if (!s.length) return '—';
      return `${(s.reduce((a, b) => a + b, 0) / s.length).toFixed(0)} (${Math.min(...s).toFixed(0)}–${Math.max(...s).toFixed(0)})`;
    });
    console.log([n, ...cells].map((x) => String(x).padEnd(16)).join(''));
  }
  console.log('\nTecniche: ' + TECHNIQUES.map((t) => `${t.name}=${t.weight}`).join(', '));
} else if (args.includes('--pack')) {
  const n = Number(opt('n', 8));
  const per = Number(opt('per-category', 20));
  const out = opt('out', `levels/${n}.json`);
  const levels = [];
  for (const cat of CATEGORIES) {
    let found = 0;
    for (let s = 1; found < per && s < per * 400; s++) {
      const lv = generateRated(n, (n * 7_000_000 + cat.tier * 1_000_000 + s) >>> 0, { maxTries: 1 });
      if (!lv || lv.rating.category !== cat.id) continue;
      levels.push({ seed: lv.seed, regions: lv.regions, solution: lv.solution, rating: lv.rating });
      found++;
    }
    console.log(`${cat.name}: ${found}`);
  }
  levels.sort((a, b) => a.rating.tier - b.rating.tier || a.rating.score - b.rating.score);
  mkdirSync(out.split('/').slice(0, -1).join('/') || '.', { recursive: true });
  writeFileSync(out, JSON.stringify({ n, levels }));
  console.log(`Scritti ${levels.length} livelli in ${out}`);
} else {
  console.log('Uso: --stats oppure --pack (vedi commento in cima al file)');
}
