/**
 * Identità da whoru (decisione whoru #24, come il Paroliere): il gioco non conosce password.
 * Il portale emette un token breve firmato (EdDSA, chiave pubblica in /.well-known/jwks.json);
 * qui si verifica e si apre una sessione propria in un cookie HttpOnly (JWT HS256).
 * Limite noto, come nel portale: nessuna revoca lato server durante la sessione.
 */
import { createRemoteJWKSet, jwtVerify, SignJWT, type JWTVerifyGetKey } from 'jose';

export interface PlayerSession {
  sub: string;
  username: string;
  groups: string[];
}

export const SESSION_TTL_SECONDS = 8 * 60 * 60;
export const ADMIN_GROUP = 'admin';

export function sessions(secret: string) {
  const key = new TextEncoder().encode(secret);
  return {
    sign: (s: PlayerSession): Promise<string> =>
      new SignJWT({ username: s.username, groups: s.groups })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(s.sub)
        .setIssuedAt()
        .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
        .sign(key),
    verify: async (token: string): Promise<PlayerSession | null> => {
      try {
        const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
        if (typeof payload.sub !== 'string' || typeof payload.username !== 'string' || !Array.isArray(payload.groups)) return null;
        return { sub: payload.sub, username: payload.username, groups: payload.groups.filter((g): g is string => typeof g === 'string') };
      } catch {
        return null;
      }
    },
  };
}

// ---- cookie della sessione

export function cookieName(production: boolean): string {
  // __Host-: solo HTTPS, nessun Domain, Path=/ (il cookie non si condivide con altri sottodomini)
  return production ? '__Host-bradoku_session' : 'bradoku_session';
}

export function sessionCookie(name: string, token: string, production: boolean): string {
  return [`${name}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${SESSION_TTL_SECONDS}`, ...(production ? ['Secure'] : [])].join('; ');
}

export function clearedCookie(name: string, production: boolean): string {
  return [`${name}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0', ...(production ? ['Secure'] : [])].join('; ');
}

export function readCookie(header: string | undefined, name: string): string | null {
  for (const part of (header ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=') || null;
  }
  return null;
}

// ---- token del portale

/**
 * Verifica del token del portale: firma EdDSA, emittente (il portale), destinatario (questo servizio),
 * scadenza. Ogni token vale una volta sola (jti), per non poterlo riusare da un indirizzo rimasto
 * nella cronologia.
 */
export function portalVerifier(opts: { portalUrl: string; serviceId: string; jwks?: JWTVerifyGetKey }) {
  const issuer = opts.portalUrl;
  const jwks = opts.jwks ?? createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`), { cooldownDuration: 30_000 });
  const used = new Map<string, number>(); // jti -> scadenza (ms)

  return async (token: string): Promise<PlayerSession | null> => {
    try {
      const { payload } = await jwtVerify(token, jwks, { issuer, audience: opts.serviceId, algorithms: ['EdDSA'], clockTolerance: 5 });
      if (typeof payload.sub !== 'string' || typeof payload.preferred_username !== 'string' || typeof payload.jti !== 'string' || typeof payload.exp !== 'number') {
        return null;
      }
      const now = Date.now();
      for (const [id, exp] of used) if (exp < now) used.delete(id);
      if (used.has(payload.jti)) return null;
      used.set(payload.jti, payload.exp * 1000);
      const groups = Array.isArray(payload.groups) ? payload.groups.filter((g): g is string => typeof g === 'string') : [];
      return { sub: payload.sub, username: payload.preferred_username, groups };
    } catch {
      return null;
    }
  };
}
