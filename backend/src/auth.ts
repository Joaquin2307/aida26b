import crypto from 'crypto';
import { promisify } from 'util';

import { isRole } from '../../shared/src/types/types';
import type { Role, AuthUser } from '../../shared/src/types/types';

const scrypt = promisify(crypto.scrypt);

// Role/AuthUser/isRole live in the shared SSOT types; re-exported so existing
// backend imports (`./auth`) keep working from a single source of truth.
export { isRole };
export type { Role, AuthUser };

export const SESSION_COOKIE = 'aida_session';
export const SESSION_DAYS = 7;

export async function hashPassword(password: string, salt = crypto.randomBytes(16).toString('hex')) {
  const key = (await scrypt(password, salt, 64)) as Buffer;
  return { passwordHash: key.toString('hex'), passwordSalt: salt };
}

export async function verifyPassword(password: string, salt: string, expectedHash: string) {
  const { passwordHash } = await hashPassword(password, salt);
  const actual = Buffer.from(passwordHash, 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

export function newSessionToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashToken(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function parseCookies(header?: string) {
  const cookies: Record<string, string> = {};
  if (!header) return cookies;

  header.split(';').forEach((part) => {
    const index = part.indexOf('=');
    if (index === -1) return;
    cookies[part.slice(0, index).trim()] = decodeURIComponent(part.slice(index + 1).trim());
  });

  return cookies;
}

export function sessionCookie(token: string, secure: boolean) {
  return [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${SESSION_DAYS * 24 * 60 * 60}`,
    secure ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

export function clearSessionCookie(secure: boolean) {
  return [
    `${SESSION_COOKIE}=`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    'Max-Age=0',
    secure ? 'Secure' : '',
  ].filter(Boolean).join('; ');
}

export function publicUser(row: Record<string, unknown>): AuthUser {
  return {
    id: Number(row.id),
    username: String(row.username),
    email: row.email === null || row.email === undefined ? null : String(row.email),
    role: row.role as Role,
    is_active: Boolean(row.is_active),
    must_change_password: Boolean(row.must_change_password),
  };
}
