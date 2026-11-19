import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MAX_SIZE } from '@bradoku/core';

// Ogni regione prende il colore --r<indice>: un indice senza colore lascia vedere il fondo nero.
describe('palette delle regioni', () => {
  it('c’è un colore per ogni regione, fino alla griglia più grande', () => {
    const css = readFileSync(new URL('../src/app.css', import.meta.url), 'utf8');
    for (let r = 0; r < MAX_SIZE; r++) expect(css, `manca --r${r}`).toMatch(new RegExp(`--r${r}:\\s*#[0-9a-f]{6}`, 'i'));
  });
});
