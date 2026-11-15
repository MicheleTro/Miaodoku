# Miaodoku — Raccolta requisiti (bozza v0.1)

> Documento di lavoro da discutere. Le voci marcate **[DA DECIDERE]** sono domande aperte.
> Obiettivo: un puzzle game mobile **originale** nel genere "piazzamento in regioni colorate"
> (lo stesso genere di Meowdoku / Queens), con nome, grafica, personaggi e contenuti propri.

---

## 1. Visione

- Puzzle di logica rilassante, a tema gatti, partite brevi (1–5 minuti).
- Ogni livello ha **una sola soluzione**, raggiungibile **solo con la logica** (niente tentativi a caso).
- Pubblico: giocatori casual di puzzle (Sudoku, Nonogram, Campo Minato), 16+ anni, IT/EN.

**[DA DECIDERE]** Nome definitivo: "Miaodoku" è molto vicino a "Meowdoku" (ne è la traduzione) → rischio di
confusione/contestazione sul marchio e rifiuto negli store. Proposta: scegliere un nome distinto.

---

## 2. Regole del puzzle (core)

| # | Regola |
|---|--------|
| R1 | Griglia N×N divisa in N regioni colorate contigue. |
| R2 | Bisogna piazzare esattamente N gatti. |
| R3 | Un solo gatto per **riga**. |
| R4 | Un solo gatto per **colonna**. |
| R5 | Un solo gatto per **regione colorata**. |
| R6 | Due gatti non possono toccarsi, **nemmeno in diagonale**. |
| R7 | Il livello è risolto quando tutte le regole sono soddisfatte. |

**[DA DECIDERE]**
- Dimensioni griglia supportate (proposta: da 5×5 a 10×10).
- Varianti future per dare identità propria: 2 gatti per riga/colonna/regione, celle bloccate (cuscini/ostacoli),
  regioni "speciali", griglie non quadrate, gatti di tipo diverso con regole proprie.

---

## 3. Generazione e validazione dei livelli

- **G1 – Generatore**: crea una disposizione valida di N gatti (R3, R4, R6), poi fa crescere N regioni
  partendo da ciascun gatto (flood-fill casuale) fino a coprire la griglia.
- **G2 – Solutore**: verifica che la soluzione sia **unica** (backtracking con vincoli); altrimenti scarta o modifica.
- **G3 – Valutazione difficoltà**: un solutore "umano" applica tecniche logiche in ordine di difficoltà
  (casella forzata, regione chiusa in una riga/colonna, esclusione per adiacenza, coppie/terne di regioni…);
  la difficoltà dipende da quali tecniche servono e quanti passaggi.
- **G4 – Pipeline**: livelli pre-generati offline e inclusi nell'app (sicuri e testati) + eventuale generazione al volo
  per sfide extra.

**[DA DECIDERE]** Quanti livelli al lancio (proposta MVP: 300–500 divisi per difficoltà).

---

## 4. Interazione e UX di gioco

- **U1** Tocco su cella: ciclo *vuota → X (esclusa) → gatto → vuota*.
- **U2** Trascinamento: segna più celle con X in un gesto.
- **U3** Auto-X (opzionale): piazzando un gatto, marca automaticamente riga, colonna, regione e celle vicine.
- **U4** Annulla / Ripeti, Cancella tutto.
- **U5** Evidenziazione conflitti (opzionale, attivabile nelle impostazioni).
- **U6** Suggerimenti: mostra la prossima deduzione logica spiegandola (non solo "la risposta").
- **U7** Timer, contatore mosse, schermata di vittoria con animazione.
- **U8** Tutorial interattivo per le regole al primo avvio.
- **U9** Salvataggio automatico della partita in corso.

---

## 5. Contenuti e progressione

- **P1** Livelli organizzati per difficoltà (Facile → Esperto) o per "mondi" tematici.
- **P2** Sfida giornaliera (uguale per tutti) con calendario/serie di giorni consecutivi.
- **P3** Statistiche: livelli risolti, tempo medio/migliore, serie.
- **P4** Collezione cosmetica: sbloccare gatti, temi, sfondi giocando.
- **P5** Obiettivi/achievement (Game Center / Google Play Games). **[DA DECIDERE]**
- **P6** Classifiche per la sfida giornaliera. **[DA DECIDERE]** (richiede backend)

---

## 6. Grafica, audio, stile

- **A1** Gatti, illustrazioni, icona, palette **originali** (da disegnare/commissionare).
- **A2** Stile: **[DA DECIDERE]** (es. flat/kawaii, acquerello, pixel art).
- **A3** Musica rilassante + effetti sonori (miao, fusa), disattivabili; vibrazione aptica.
- **A4** Tema chiaro/scuro.
- **A5** Accessibilità colori: le regioni devono distinguersi anche **senza colore**
  (pattern/texture o bordi spessi) per daltonici.

---

## 7. Monetizzazione **[DA DECIDERE]**

Opzioni:
1. **Gratis con pubblicità** (banner/interstiziali) + acquisto "rimuovi pubblicità".
2. **Freemium**: pubblicità solo con premio (rewarded: suggerimenti, cosmetici) — meno invasiva.
3. **A pagamento** (prezzo unico, niente pubblicità).
4. **Abbonamento** (livelli/sfide extra).

Nota: le recensioni del genere criticano spesso l'eccesso di pubblicità → possibile punto di differenziazione.

---

## 8. Piattaforme e tecnologia **[DA DECIDERE]**

| Opzione | Pro | Contro |
|---------|-----|--------|
| Flutter | iOS + Android da un codice, ottime animazioni | Dart |
| React Native (Expo) | iOS + Android, ecosistema JS/TS | animazioni complesse più laboriose |
| PWA / web (TypeScript) | prototipo velocissimo, giocabile da browser | presenza sugli store più complicata |
| Unity | potente per giochi | eccessivo per un puzzle 2D, build pesanti |

Proposta: logica di gioco (generatore, solutore, validatore) in un **modulo separato e testato**,
indipendente dalla UI; prototipo web per validare il gameplay, poi app mobile.

---

## 9. Requisiti non funzionali

- **NF1** Funziona **offline** (tranne pubblicità/classifiche).
- **NF2** Avvio < 2 s, 60 fps nelle animazioni, app leggera (< 50 MB).
- **NF3** Lingue: italiano e inglese al lancio; testi esternalizzati per tradurre facilmente.
- **NF4** Privacy/GDPR: consenso per pubblicità personalizzate (CMP), informativa privacy, App Tracking Transparency su iOS.
- **NF5** Conformità linee guida App Store / Google Play; classificazione età.
- **NF6** Salvataggio locale; sincronizzazione cloud tra dispositivi **[DA DECIDERE]**.
- **NF7** Analytics minimi (livelli abbandonati, tempi) per bilanciare la difficoltà **[DA DECIDERE]**.
- **NF8** Test automatici su generatore e solutore (unicità soluzione garantita per ogni livello incluso).

---

## 10. Aspetti legali / proprietà intellettuale

- Le regole di gioco in sé non sono proteggibili, ma **nome, logo, grafica, personaggi, testi e suoni** sì:
  vanno tutti creati da zero.
- Verificare disponibilità del nome (marchi, store, dominio, social).
- Licenze di font, musica e asset di terze parti.

---

## 11. Proposta di fasi

1. **Prototipo** (1–2 settimane): motore di gioco + generatore/solutore + UI minima giocabile.
2. **MVP**: livelli per difficoltà, tutorial, undo, suggerimenti, salvataggio, grafica base, IT/EN.
3. **v1.0 store**: sfida giornaliera, statistiche, cosmetici, monetizzazione, privacy/consenso.
4. **Dopo il lancio**: varianti di regole, classifiche, eventi stagionali.

---

## 12. Domande aperte da discutere

1. Nome definitivo e identità del gioco (cosa lo rende diverso?).
2. Piattaforma/tecnologia: prima web o direttamente mobile? iOS, Android o entrambi?
3. Modello di monetizzazione.
4. Stile grafico e chi produce gli asset.
5. Funzioni online (classifiche, sync cloud) sì/no nell'MVP?
6. Dimensioni griglia e numero livelli al lancio.
7. Budget e tempi indicativi; sviluppo solo tuo o in team?
