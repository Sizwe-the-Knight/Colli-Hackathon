export const IDLE_MS = 24 * 60 * 60 * 1000;
export const ABSOLUTE_MS = 7 * IDLE_MS;

export interface SessionIdentity {
  userId: number;
  authVersion: number;
  issuedAt: number;
  lastActivityAt: number;
  absoluteExpiresAt: number;
  reauthenticatedAt?: number;
}

const keys = new Set(['userId', 'authVersion', 'issuedAt', 'lastActivityAt',
  'absoluteExpiresAt', 'reauthenticatedAt', 'cookie']);
const integer = (n: unknown, max: number): n is number =>
  typeof n === 'number' && Number.isSafeInteger(n) && n > 0 && n <= max;

export function sessionIdentity(value: unknown, now: number): SessionIdentity | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v: Record<string, unknown> = Object.fromEntries(Object.entries(value));
  if (Object.keys(v).some(k => !keys.has(k)) ||
      !integer(v.userId, 2147483647) || !integer(v.authVersion, 2147483647) ||
      !integer(v.issuedAt, 9999999999999) || !integer(v.lastActivityAt, 9999999999999) ||
      !integer(v.absoluteExpiresAt, 9999999999999)) return null;
  if (v.absoluteExpiresAt !== v.issuedAt + ABSOLUTE_MS || v.lastActivityAt < v.issuedAt ||
      v.lastActivityAt > now || now >= v.lastActivityAt + IDLE_MS || now >= v.absoluteExpiresAt) return null;
  if ('cookie' in v && (!v.cookie || typeof v.cookie !== 'object' || Array.isArray(v.cookie))) return null;
  if ('reauthenticatedAt' in v && (!integer(v.reauthenticatedAt, 9999999999999) ||
      v.reauthenticatedAt < v.issuedAt || v.reauthenticatedAt > now)) return null;
  return { userId: v.userId, authVersion: v.authVersion, issuedAt: v.issuedAt,
    lastActivityAt: v.lastActivityAt, absoluteExpiresAt: v.absoluteExpiresAt,
    ...(typeof v.reauthenticatedAt === 'number' ? { reauthenticatedAt: v.reauthenticatedAt } : {}) };
}

export const deadline = (identity: SessionIdentity) =>
  Math.min(identity.lastActivityAt + IDLE_MS, identity.absoluteExpiresAt);

export class Unauthenticated extends Error {
  constructor() { super('Not authenticated'); }
}
