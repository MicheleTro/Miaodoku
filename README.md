# Bradoku

Puzzle logico: **un bradipo per riga, per colonna e per regione colorata; due bradipi non si toccano, nemmeno in diagonale.**
Ogni livello ha una sola soluzione, raggiungibile con la logica. Si gioca in **partita libera** o in **sfida** con gli amici.

Monorepo pnpm con la stessa struttura del Paroliere:

| Cartella | Cosa contiene |
|---|---|
| `packages/core` | Logica pura in TypeScript, nessuna dipendenza: generatore di livelli, risolutore esatto, risolutore "umano" a 7 tecniche, difficoltà, punteggio, livelli e serie, medaglie, accessori |
| `apps/server` | API Fastify + Drizzle. Postgres se c'è `DATABASE_URL`, altrimenti PGlite (Postgres incorporato) in `apps/server/.data/` |
| `apps/web` | Frontend Svelte 5 + Vite. In produzione lo serve lo stesso server |
| `prototype/` | Il primo prototipo in JavaScript (gattini), tenuto come riferimento |
| `docs/` | Requisiti iniziali |

## Avvio in locale

```bash
pnpm install
pnpm build          # compila il frontend in apps/web/dist
pnpm start          # server su http://localhost:3000 (API + frontend)
```

Per sviluppare con ricarica automatica: `pnpm dev` (server su :3000, Vite su :5173 con proxy verso `/api`).

Variabili d'ambiente del server: `PORT` (3000), `DATABASE_URL` (Postgres; se assente usa PGlite),
`PGLITE_DIR` (cartella dati di PGlite), `JWT_SECRET` (obbligatorio in produzione), `CORS_ORIGIN`, `STATIC_DIR`.
Per il frontend servito da un'altra origine: `VITE_API_URL`.

## Controlli

```bash
pnpm test        # core (generatore, risolutore, punteggio, serie, medaglie) + API end-to-end su PGlite
pnpm typecheck   # TypeScript su core e server, svelte-check sul frontend
```

## Deploy

`render.yaml` crea su Render un servizio Node (API + frontend) e un database Postgres: su Render basta
"New → Blueprint" puntando a questo repository e al branch `bradoku`.

### Coolify

Il `Dockerfile` nella radice costruisce un'unica immagine (API + frontend) che ascolta sulla porta 3000.

1. In Coolify: **New Resource → Public/Private Repository**, repository `micheletro/miaodoku`, branch `bradoku`.
2. Build Pack: **Dockerfile** (percorso `/Dockerfile`), porta esposta **3000**.
3. Variabili d'ambiente: `JWT_SECRET` (una stringa lunga e casuale, obbligatoria).
   Per i dati scegli una delle due:
   - **Postgres** (consigliato): crea un database Postgres in Coolify e imposta `DATABASE_URL` con la sua connection string interna;
   - **PGlite**: senza `DATABASE_URL` i dati vanno in `/data/pglite`; aggiungi in Coolify un **Persistent Storage** montato su `/data`, altrimenti si perdono a ogni deploy.
4. Health check: `GET /api/health`.

## Regole di gioco implementate

- **Punteggio**: `Punti = round(D × (1 + 0,3·T) × (1 + 0,2·E) × A)` — D difficoltà dell'engine, T bonus tempo
  (tempo di riferimento = 15 s per passo del risolutore), E partita pulita, A suggerimenti (×1,5 senza; −0,25 ciascuno, minimo ×0,4).
  Il server misura il tempo, rigenera il livello dal seme e verifica la soluzione.
- **XP e livelli**: ogni punto è un XP; per salire dal livello n servono 60 × n^1,4 XP. Ranghi: Germoglio, Ramo, Chioma, Foresta.
- **Serie di presenza**: una partita al giorno (ora di Roma); ogni 10 giorni di fila +2 **Lumi** (suggerimenti completi senza penalità, solo in partita libera).
- **Aiuto a due passi**: prima la zona dove guardare, poi la spiegazione della tecnica. Gli errori si segnalano prima di tutto.
- **Coach**: la prima volta che un livello richiede una tecnica nuova, il bradipo la presenta.
- **Sfide** (aperte da subito): sullo stesso seme, ognuno quando vuole; vince il punteggio, poi meno suggerimenti, poi il tempo.
  Si può sfidare un amico sul livello appena risolto; rivincita con un tocco; bilancio con ogni amico. I Lumi non valgono.
- **18 medaglie** (Base, Tecniche, Sfide, Serie) e **13 accessori** per i bradipi, sbloccati con livelli e medaglie.

Il profilo per ora è locale (nome e password); più avanti arriverà dal portale whoru.
