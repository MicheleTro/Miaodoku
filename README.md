# Gattile (nome provvisorio) — prototipo web

Puzzle logico a tema gatti: **un gatto per riga, per colonna e per regione colorata; due gatti non si toccano, nemmeno in diagonale.**
Ogni livello ha una sola soluzione, raggiungibile con la logica.

## Avvio

```bash
npm start          # oppure: python3 -m http.server 8000
# apri http://localhost:8000
```
Nessuna dipendenza da installare: HTML + JavaScript (moduli ES).

## Struttura

| File | Ruolo |
|------|-------|
| `js/engine/board.js` | Modello della griglia: righe, colonne, regioni ("unità"), vicini |
| `js/engine/solver.js` | Risolutore esatto (backtracking): conta le soluzioni, garantisce l'unicità |
| `js/engine/generator.js` | Generatore di livelli |
| `js/engine/logic.js` | Risolutore "umano" a tecniche: base di suggerimenti e difficoltà |
| `js/engine/difficulty.js` | Stima della difficoltà (categoria + punteggio) |
| `js/engine/explain.js` | Spiegazioni in italiano delle deduzioni |
| `js/app.js`, `js/worker.js` | Interfaccia di gioco; la generazione gira in un Web Worker |
| `scripts/genera.mjs` | Statistiche sulle difficoltà e creazione di pacchetti di livelli |
| `test/` | Test dell'engine (`npm test`) |

## Come nasce un livello

1. **Soluzione prima di tutto**: si piazzano N gatti a caso rispettando righe, colonne e distanza.
2. **Crescita delle regioni**: ogni gatto è il seme di una regione che cresce a caso
   (parametri: *compattezza* = blocchetti o serpentine, *varianza* = regioni grandi e piccole).
3. **Riparazione dell'unicità**: il risolutore esatto cerca una seconda soluzione. Se c'è, si sposta in una regione
   confinante una casella dove quella soluzione mette un gatto (più il percorso minimo per raggiungere il bordo, se la
   casella è interna). La soluzione alternativa diventa impossibile, quella vera resta valida. Tra più modifiche
   possibili si sceglie quella che lascia meno soluzioni. Si ripete finché la soluzione è unica.
4. **Valutazione**: il risolutore umano risolve il livello; se non ci riesce, il livello viene scartato.

Lo stesso **seme** produce sempre lo stesso livello (riproducibile, condivisibile, sfida del giorno).

## Come si stima la difficoltà

Il risolutore umano applica sempre la tecnica più semplice disponibile:

| # | Tecnica | Idea | Peso |
|---|---------|------|------|
| 1 | Ultima casella | un'unità ha una sola casella libera | 1 |
| 2 | Allineamento | le caselle libere di una regione stanno in una sola riga/colonna (o viceversa) → escludi il resto | 2 |
| 3 | Vicinato | un gatto qui svuoterebbe un'altra unità → escludi | 3 |
| 4 | Coppia | 2 regioni chiuse in 2 righe/colonne (o viceversa) → escludi il resto | 6 |
| 5 | Terna | come sopra con 3 | 10 |
| 6 | Quaterna+ | come sopra con 4 o più | 14 |
| 7 | Ipotesi | provando un gatto qui, le tecniche 1–2 portano a una contraddizione | 20 |

- **Categoria** = la tecnica più difficile necessaria: Facile (1–2), Medio (3), Difficile (4), Esperto (5–6), Diabolico (7).
- **Punteggio** = Σ peso × (1 + 1/opzioni), dove *opzioni* sono le deduzioni di quel livello disponibili in quel momento:
  un passo con una sola via d'uscita è più difficile da trovare.
- **Colli di bottiglia** = passi senza deduzioni facili e con una sola opzione.

Pesi e soglie sono da tarare con i tempi reali dei giocatori.

```bash
npm run stats                                         # distribuzione delle difficoltà per dimensione
node scripts/genera.mjs --pack --n 8 --per-category 20  # pacchetto di livelli in levels/8.json
```

Il pannello **“Analisi del livello”** nell'app mostra la valutazione e permette di rivedere sulla griglia, passo per passo,
il percorso del risolutore.
