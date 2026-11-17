# Bradoku

Puzzle logico: **un bradipo per riga, per colonna e per regione colorata; due bradipi non si toccano, nemmeno in diagonale.**
Ogni livello ha una sola soluzione, raggiungibile con la logica. Si gioca nel **Percorso** (livelli uguali per tutti) o in **sfida** con gli amici.

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
In locale, senza portale: `DEV_LOGIN=true pnpm dev` e poi `http://localhost:5173/api/auth/dev?user=mario`
(gli utenti `dev-…` sono tutti amici tra loro). Il database PGlite della versione con account propri non è
compatibile: se il server lo segnala, cancella `apps/server/.data/`.

## Accesso: whoru

Bradoku non ha account propri: l'identità arriva dal portale **whoru** (`slothymic.com`), come per il Paroliere
(decisioni whoru #24, #27, #28).

1. Senza sessione, il gioco manda a `<PORTAL_URL>/launch/bradoku`; il portale fa entrare il giocatore e lo
   rimanda a `/api/auth/callback?token=…` con un token **EdDSA** di 60 secondi.
2. Il server verifica firma (chiave in `<PORTAL_URL>/.well-known/jwks.json`), emittente, destinatario
   (`SERVICE_ID`), scadenza e che il token non sia già stato usato, poi apre una sessione propria in un cookie
   `HttpOnly` (`__Host-bradoku_session`, 8 ore). Nessun token in JavaScript.
3. Gli utenti hanno come chiave il `sub` di whoru; il nome serve solo per mostrarlo.
4. Si sfidano **solo gli amici del portale**: il server li legge dall'API del portale con `PORTAL_SERVICE_TOKEN`
   e controlla l'amicizia a ogni sfida e rivincita.
5. Il browser chiede ogni minuto al portale chi è entrato (`/api/session`): se il giocatore è uscito o è
   cambiato, il gioco chiude la sessione, ma mai durante una partita.

Variabili d'ambiente del server:

| Variabile | Cosa | Predefinito |
|---|---|---|
| `SESSION_SECRET` | Firma del cookie di sessione, almeno 32 caratteri | **obbligatoria** in produzione |
| `PORTAL_URL` | Indirizzo del portale whoru | `https://slothymic.com` |
| `SERVICE_ID` | Id nel registro del portale (= `aud` del token) | `bradoku` |
| `PORTAL_SERVICE_TOKEN` | Token per l'API amici, = `SERVICE_TOKEN_BRADOKU` sul portale | senza, niente sfide |
| `DATABASE_URL` | Postgres; se assente, PGlite in `PGLITE_DIR` | — |
| `DEV_LOGIN` | `true` = accesso di sviluppo senza portale (ignorato in produzione) | — |
| `PORT`, `STATIC_DIR`, `CORS_ORIGIN` | Porta, frontend compilato, origini esterne ammesse (di norma nessuna) | `3000` |

## Controlli

```bash
pnpm test        # core (generatore, risolutore, punteggio, serie, medaglie) + API end-to-end su PGlite
pnpm typecheck   # TypeScript su core e server, svelte-check sul frontend
```

## Deploy

### Coolify

Il `Dockerfile` nella radice costruisce un'unica immagine (API + frontend) che ascolta sulla porta 3000.

1. In Coolify: **New Resource → Public/Private Repository**, repository `micheletro/miaodoku`, branch `bradoku`.
2. Build Pack: **Dockerfile** (percorso `/Dockerfile`), porta esposta **3000**.
3. Variabili d'ambiente: `SESSION_SECRET`, `PORTAL_URL`, `PORTAL_SERVICE_TOKEN` (vedi sopra) e i dati:
   - **Postgres** (consigliato): un database e un ruolo nell'istanza condivisa di whoru (decisione whoru #25),
     `DATABASE_URL` con la connection string interna;
   - **PGlite**: senza `DATABASE_URL` i dati vanno in `/data/pglite`; serve un **Persistent Storage** su `/data`.
4. Health check: quello dell'immagine (`wget` su `127.0.0.1:3000/api/health`), oppure in Coolify `GET /api/health`
   con host `127.0.0.1` (non `localhost`: nelle immagini Alpine punta a `::1`).
5. Nel portale whoru, Bradoku deve essere nel registro delle risorse (id `bradoku`, callback `/api/auth/callback`)
   con lo stesso token in `SERVICE_TOKEN_BRADOKU`.

Il container gira come utente `node`, senza privilegi.

## Regole di gioco implementate

- **Comandi**: un tocco mette la X; doppio tocco mette il bradipo; un tocco (dopo una pausa) su una X la toglie,
  su un bradipo lo toglie. Trascinando dopo aver messo una X se ne mettono altre; trascinando dopo averne tolta una
  si tolgono a catena tutte quelle toccate. Niente X automatiche.
- **Percorso** (al posto della partita libera): una sequenza di livelli uguale per tutti. Griglia (da 8×8 a 12×12),
  difficoltà e seme dipendono solo dal numero del livello (`packages/core/src/path.ts`); griglia e difficoltà si vedono
  prima di giocare, il seme resta interno.
  I primi 10 livelli salgono piano (8×8 facili → primo difficile al 10); poi ondate di 6–7 livelli misti e uno
  difficile. Il 12×12 compare dal livello 46 (11×11 dal 26). La stella in alto conta i livelli completati.
  Ogni livello si genera una volta sola, in un worker thread, e si salva nella tabella `path_levels`; il successivo
  si prepara in anticipo.
- **Etichetta «Difficile»**: solo per i livelli Esperto o Diabolico (Terne, Quaterne, Ipotesi); gli altri non hanno
  etichetta. Vale anche nelle sfide, dove si sceglie griglia 8–12 e Normale/Difficile.
- **Punteggio**: `Velocità V = round(D × T × R)`, `Punti = round((D + V) × (1 + 0,2·E) × A)` — D difficoltà
  dell'engine; T rapidità (0 al tempo di riferimento, 1 a metà; riferimento = 15 s per passo del risolutore);
  R = 0,5, oppure 1 nei livelli difficili (la velocità conta doppio); E partita pulita; A suggerimenti
  (×1,5 senza; −0,25 ciascuno, minimo ×0,4). Il server misura il tempo, rigenera il livello dal seme e verifica la soluzione.
- **XP e gradi**: ogni punto è un XP (la «banca punti»); per salire dal grado n servono 60 × n^1,4 XP. Ranghi: Germoglio, Ramo, Chioma, Foresta.
- **Serie di presenza**: una partita al giorno (ora di Roma); ogni 10 giorni di fila +2 **Lumi** (suggerimenti completi senza penalità, solo in partita libera).
  I Lumi per ora sono **nascosti** nell'interfaccia (`LUMI_ENABLED` in `apps/web/src/lib/features.ts`): il server li conta comunque.
- **Suoni**: un effetto per ogni azione (bottoni, X, bradipo, conflitto, aiuto, vittoria, conteggio dei punti, grado,
  livello, medaglie, esito della sfida), sintetizzati con Web Audio in `apps/web/src/lib/sound.ts` (nessun file audio).
  Si spengono dal pulsante con l'altoparlante in Home; la scelta resta nel browser.
- **Aiuto a due passi**: prima la zona dove guardare, poi la spiegazione della tecnica. Gli errori si segnalano prima di tutto.
- **Sfide** (aperte da subito): sullo stesso seme, ognuno quando vuole; vince il punteggio, poi meno suggerimenti, poi il tempo.
  Si può sfidare un amico sul livello appena risolto; rivincita con un tocco; bilancio con ogni amico. I Lumi non valgono.
- **18 medaglie** (Base, Tecniche, Sfide, Serie) e **13 accessori** per i bradipi, sbloccati con gradi e medaglie.

Il profilo è quello di whoru: nome e gruppi arrivano dal portale (vedi *Accesso*).
