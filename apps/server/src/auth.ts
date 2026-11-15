import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';

function scryptAsync(password: string, salt: Buffer, len: number): Promise<Buffer> {
  return new Promise((resolve, reject) => scrypt(password, salt, len, (err, key) => (err ? reject(err) : resolve(key))));
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt, 64);
  return ['scrypt', salt.toString('base64'), key.toString('base64')].join(':');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, saltB64, keyB64] = stored.split(':');
  if (algo !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const key = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length);
  return key.length === expected.length && timingSafeEqual(key, expected);
}

export function tokens(secret: string) {
  const key = new TextEncoder().encode(secret);
  return {
    sign: (userId: number): Promise<string> =>
      new SignJWT({}).setProtectedHeader({ alg: 'HS256' }).setSubject(String(userId)).setIssuedAt().setExpirationTime('60d').sign(key),
    verify: async (token: string): Promise<number | null> => {
      try {
        const { payload } = await jwtVerify(token, key);
        const id = Number(payload.sub);
        return Number.isInteger(id) ? id : null;
      } catch {
        return null;
      }
    },
  };
}
