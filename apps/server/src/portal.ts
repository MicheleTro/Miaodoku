/**
 * Amici: stanno nel portale whoru (decisione whoru #28). Il gioco li legge da server a server con il
 * token del servizio (stesso valore di SERVICE_TOKEN_BRADOKU sul portale) e non si fida mai di ciò che
 * dice il browser. Si sfidano solo gli amici.
 * In sviluppo, senza token e con DEV_LOGIN, gli utenti "dev-..." sono tutti amici tra loro.
 */
import { and, eq, like, ne } from 'drizzle-orm';
import type { DB } from './db/index.js';
import { users } from './db/schema.js';

export interface Friend {
  sub: string;
  username: string;
}

export interface Portal {
  friends(sub: string): Promise<Friend[]>;
  /** Se `other` è amico di `sub`, restituisce nome e id come li conosce il portale. */
  check(sub: string, other: string): Promise<Friend | null>;
}

export class PortalUnavailableError extends Error {}

export function httpPortal(portalUrl: string, serviceToken: string): Portal {
  async function get<T>(path: string): Promise<T> {
    try {
      const res = await fetch(`${portalUrl}${path}`, {
        headers: { Authorization: `Bearer ${serviceToken}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new PortalUnavailableError(`Portale: ${res.status}`);
      return (await res.json()) as T;
    } catch (error) {
      if (error instanceof PortalUnavailableError) throw error;
      throw new PortalUnavailableError('Portale non raggiungibile');
    }
  }
  return {
    friends: async (sub) =>
      (await get<{ friends: Friend[] }>(`/api/internal/friends?sub=${encodeURIComponent(sub)}`)).friends ?? [],
    check: async (sub, other) => {
      const r = await get<{ friends: boolean; other?: Friend | null }>(
        `/api/internal/friends/check?sub=${encodeURIComponent(sub)}&other=${encodeURIComponent(other)}`,
      );
      return r.friends && r.other ? r.other : null;
    },
  };
}

export function devPortal(db: DB): Portal {
  return {
    friends: (sub) =>
      db.select({ sub: users.id, username: users.username }).from(users).where(and(like(users.id, 'dev-%'), ne(users.id, sub))),
    check: async (sub, other) => {
      if (!sub.startsWith('dev-') || !other.startsWith('dev-') || sub === other) return null;
      const [row] = await db.select({ sub: users.id, username: users.username }).from(users).where(eq(users.id, other));
      return row ?? null;
    },
  };
}

/** Senza token e fuori sviluppo: il portale non è configurato, le sfide non si possono lanciare. */
export function missingPortal(): Portal {
  const fail = async (): Promise<never> => {
    throw new PortalUnavailableError('Collegamento con il portale non configurato (PORTAL_SERVICE_TOKEN)');
  };
  return { friends: fail, check: fail };
}
