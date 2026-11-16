/**
 * Accesso: l'identità sta nel portale whoru (come nel Paroliere). Senza sessione si va lì, e dopo
 * l'accesso il portale riporta qui (/api/auth/callback apre la sessione del gioco nel cookie).
 */
export interface AuthUser {
  id: string;
  username: string;
  isAdmin: boolean;
  loginUrl: string;
  portalUrl: string;
}

export const auth = $state({
  user: null as AuthUser | null,
  /** Dove entrare, se il server l'ha detto (anche quando la pagina non riesce a mandarci da sola). */
  loginUrl: '' as string,
  /** Server non raggiungibile: si mostra un messaggio invece di rimandare al portale. */
  offline: false,
});

/** true se c'è una sessione; altrimenti rimanda al portale (o segnala che il server non risponde). */
export async function checkSession(): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'same-origin' });
    if (res.status === 401) {
      const body = (await res.json().catch(() => ({}))) as { loginUrl?: string };
      auth.user = null;
      auth.loginUrl = body.loginUrl ?? '';
      if (body.loginUrl) window.location.assign(body.loginUrl);
      return false;
    }
    if (!res.ok) throw new Error(String(res.status));
    auth.user = (await res.json()) as AuthUser;
    auth.offline = false;
    return true;
  } catch {
    auth.offline = true;
    return false;
  }
}

/** Esce dal gioco e torna al portale (la sessione del portale resta: da lì si esce del tutto). */
export async function logout(): Promise<void> {
  const portalUrl = auth.user?.portalUrl ?? '/';
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
  auth.user = null;
  window.location.assign(portalUrl);
}

// ---- Controllo della sessione del portale (decisione whoru #27)
// Il gioco ha una sessione sua; se nel frattempo il giocatore esce dal portale (o entra con un altro
// account) il gioco deve accorgersene. Lo chiede il browser, che ha il cookie del portale (stesso sito).
// Non interrompe mai una partita in corso: aspetta la fine.

const CHECK_EVERY_MS = 60_000;

/** true = stessa persona, false = uscita o cambiata, null = non si sa (rete assente): non si fa nulla. */
async function portalMatches(): Promise<boolean | null> {
  const user = auth.user;
  if (!user) return null;
  try {
    const res = await fetch(`${user.portalUrl}/api/session`, { credentials: 'include', cache: 'no-store' });
    if (res.status === 401) return false;
    if (!res.ok) return null;
    const body = (await res.json()) as { sub?: string };
    return body.sub === user.id;
  } catch {
    return null;
  }
}

export function watchPortalSession(isBusy: () => boolean): void {
  let pendingLeave = false;
  let running = false;

  const check = async () => {
    const user = auth.user;
    // Le sessioni di sviluppo (dev-...) non hanno un corrispettivo nel portale
    if (running || !user || user.id.startsWith('dev-')) return;
    running = true;
    try {
      if (!pendingLeave && (await portalMatches()) === false) pendingLeave = true;
      if (pendingLeave && !isBusy()) {
        await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
        auth.user = null;
        window.location.assign(user.loginUrl);
      }
    } finally {
      running = false;
    }
  };

  setInterval(() => void check(), CHECK_EVERY_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void check();
  });
  window.addEventListener('focus', () => void check());
}
