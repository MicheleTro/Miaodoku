// Crea una versione a file singolo del gioco (dist/gattile.html), utile per pubblicarla
// come pagina su claude.ai o aprirla senza server. Uso: node scripts/build-artifact.mjs

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const stripModules = (src) =>
  src
    .replace(/^import\s*\{[^}]*\}\s*from\s*'[^']*';\s*$/gms, '')
    .replace(/^export \* from .*$/gm, '')
    .replace(/^export (?=(const|function|class|let)\b)/gm, '');

const ENGINE = ['rng', 'board', 'solver', 'logic', 'difficulty', 'explain', 'generator'];
const engine = ENGINE.map((m) => `// ---- ${m}.js\n${stripModules(read(`js/engine/${m}.js`))}`).join('\n');

const workerHandler = `
self.onmessage = (e) => {
  const { id, n, seed, difficulty } = e.data;
  const t0 = performance.now();
  try {
    const level = generateRated(n, seed, { difficulty, maxTries: difficulty ? 400 : 1 });
    self.postMessage({ id, level, ms: Math.round(performance.now() - t0) });
  } catch (err) { self.postMessage({ id, error: String(err) }); }
};`;

let app = stripModules(read('js/app.js')).replace(
  /function createWorker\(\) \{[\s\S]*?\n\}/,
  `function createWorker() {
  const src = document.getElementById('engine').textContent + ${JSON.stringify(workerHandler)};
  return new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
}`
);

const html = read('index.html');
const body = html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>')).replace(/<script type="module"[^>]*><\/script>/, '');
const out = `<title>Gattile</title>
<meta name="claude:viewport-fit-sides" content="cover">
<meta name="description" content="Prototipo di un puzzle logico a tema gatti">
<style>
${read('css/style.css')}
</style>
${body}
<script id="engine">
${engine}
</script>
<script>
(() => {
${app}
})();
</script>
`;
mkdirSync(new URL('../dist/', import.meta.url), { recursive: true });
writeFileSync(new URL('../dist/gattile.html', import.meta.url), out);
console.log(`dist/gattile.html (${(out.length / 1024).toFixed(0)} KB)`);
