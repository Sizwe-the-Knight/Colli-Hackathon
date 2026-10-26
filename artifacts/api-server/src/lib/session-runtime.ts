import { AsyncLocalStorage } from 'node:async_hooks';
import session, { type SessionData } from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { pool, type PoolClient } from '@workspace/db';
import { ABSOLUTE_MS, deadline, sessionIdentity, Unauthenticated, type SessionIdentity } from './session-policy';
import { checkSessionReadiness } from './session-readiness';

type Client = PoolClient;
type SessionRow = { sess: unknown; canonical: boolean; expires: string };
const issuance = new AsyncLocalStorage<number>();
const validSid = (sid: string) => /^[A-Za-z0-9_-]{32,128}$/.test(sid);

// json (not jsonb) retains duplicate keys and number spellings. Check them before
// pg's JSON decoder can turn malformed persisted metadata into a valid identity.
const sessionSelect = `SELECT sess, extract(epoch FROM expire AT TIME ZONE 'UTC') * 1000 AS expires,
  CASE WHEN json_typeof(sess) = 'object' THEN
    NOT EXISTS (SELECT 1 FROM json_each(sess) GROUP BY key HAVING count(*) > 1)
    AND NOT EXISTS (SELECT 1 FROM json_each(sess) WHERE
      key IN ('userId','authVersion','issuedAt','lastActivityAt','absoluteExpiresAt','reauthenticatedAt')
      AND value::text !~ '^[1-9][0-9]{0,12}$')
  ELSE false END AS canonical
  FROM auth.sessions WHERE sid = $1`;

async function transaction<T>(work: (client: Client) => Promise<T>): Promise<T> {
  const client = await pool.connect().catch(() => { throw new Error('Session service unavailable'); });
  let discard = false;
  try {
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    await client.query("SET LOCAL TIME ZONE 'UTC'");
    await client.query("SET LOCAL statement_timeout = '5s'");
    await client.query("SET LOCAL lock_timeout = '1s'");
    await client.query("SET LOCAL idle_in_transaction_session_timeout = '10s'");
    const value = await work(client);
    await client.query('COMMIT');
    return value;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { discard = true; }
    // Do not pass pg errors (which can contain bindings/credentials) to Express.
    if (error instanceof Unauthenticated) throw error;
    throw new Error('Session service unavailable');
  } finally { client.release(discard); }
}

async function clock(client: Client): Promise<number> {
  const { rows } = await client.query<{ now: string }>(
    'SELECT floor(extract(epoch FROM clock_timestamp()) * 1000)::text AS now');
  const now = Number(rows[0]?.now);
  if (!Number.isSafeInteger(now) || now <= 0) throw new Error('Invalid database clock');
  return now;
}

async function account(client: Client, userId: number) {
  const { rows } = await client.query<{ authVersion: number }>(
    'SELECT auth_version AS "authVersion" FROM public.users WHERE id = $1 FOR UPDATE', [userId]);
  return rows[0];
}

async function marked(client: Client, sid: string) {
  const { rows } = await client.query<{ revoked: boolean }>(
    'SELECT EXISTS (SELECT 1 FROM auth.revoked_sessions WHERE sid = $1 AND retain_until > clock_timestamp()) AS revoked', [sid]);
  return rows[0]?.revoked !== false;
}

async function lockedIdentity(client: Client, sid: string): Promise<SessionIdentity> {
  if (!validSid(sid)) throw new Unauthenticated();
  const candidate = (await client.query<SessionRow>(sessionSelect, [sid])).rows[0];
  const initial = candidate?.canonical && sessionIdentity(candidate.sess, await clock(client));
  if (!initial) throw new Unauthenticated();
  const user = await account(client, initial.userId);
  const row = (await client.query<SessionRow>(`${sessionSelect} FOR UPDATE`, [sid])).rows[0];
  // Time and metadata must be re-read AFTER both account and SID lock waits.
  const now = await clock(client);
  const identity = row?.canonical && sessionIdentity(row.sess, now);
  if (!user || !identity || identity.userId !== initial.userId || user.authVersion !== identity.authVersion ||
      !Number.isFinite(Number(row.expires)) || Number(row.expires) <= now ||
      Number(row.expires) > Math.ceil(deadline(identity) / 1000) * 1000 || await marked(client, sid)) {
    throw new Unauthenticated();
  }
  return identity;
}

async function write(client: Client, sid: string, data: SessionData, identity: SessionIdentity, insert: boolean) {
  Object.assign(data, identity);
  // Absolute expiry is the browser-cookie ceiling. The DB independently enforces
  // idle expiry; reads and health polling never refresh either security timestamp.
  data.cookie.expires = new Date(identity.absoluteExpiresAt);
  const json = JSON.stringify({ ...identity, cookie: data.cookie });
  const expires = Math.ceil(deadline(identity) / 1000);
  if (insert) {
    await client.query("INSERT INTO auth.sessions (sid, sess, expire) VALUES ($1, $2::json, to_timestamp($3) AT TIME ZONE 'UTC')", [sid, json, expires]);
  } else {
    await client.query("UPDATE auth.sessions SET sess = $2::json, expire = to_timestamp($3) AT TIME ZONE 'UTC' WHERE sid = $1", [sid, json, expires]);
  }
}

export const sessions = {
  issuing<T>(userId: number, work: () => Promise<T>) { return issuance.run(userId, work); },
  async authenticate(sid: string) { return transaction(client => lockedIdentity(client, sid)); },
  async save(sid: string, data: SessionData) {
    if (!validSid(sid)) throw new Unauthenticated();
    await transaction(async client => {
      const userId = issuance.getStore();
      if (userId !== undefined) {
        if (!Number.isSafeInteger(userId) || userId <= 0 || userId !== data.userId) throw new Unauthenticated();
        const user = await account(client, userId);
        const existing = await client.query(sessionSelect + ' FOR UPDATE', [sid]);
        const now = await clock(client);
        if (!user || existing.rows.length || await marked(client, sid)) throw new Unauthenticated();
        const identity = { userId, authVersion: user.authVersion, issuedAt: now, lastActivityAt: now, absoluteExpiresAt: now + ABSOLUTE_MS };
        if (!sessionIdentity(identity, now)) throw new Unauthenticated();
        await write(client, sid, data, identity, true);
      } else {
        const identity = await lockedIdentity(client, sid);
        const proposed = sessionIdentity(data, await clock(client));
        // Only the explicit protected-activity transaction can advance activity.
        // Late saves cannot overwrite newer metadata, reset issuance or revive SIDs.
        if (!proposed || JSON.stringify(proposed) !== JSON.stringify(identity)) throw new Unauthenticated();
        await write(client, sid, data, identity, false);
      }
    });
  },
  async mutate<T>(sid: string, work: (client: Client, identity: SessionIdentity) => Promise<T>) {
    return transaction(async client => {
      const identity = await lockedIdentity(client, sid);
      const result = await work(client, identity);
      // This is deliberate user activity, after validation and the protected write.
      // Preserve issuance; do not expose a generic background keep-alive endpoint.
      const now = await clock(client);
      if (!sessionIdentity(identity, now)) throw new Unauthenticated();
      const updated = { ...identity, lastActivityAt: now };
      await client.query(`UPDATE auth.sessions SET sess =
        jsonb_set(sess::jsonb, '{lastActivityAt}', to_jsonb($2::bigint))::json,
        expire = to_timestamp($3) AT TIME ZONE 'UTC' WHERE sid = $1`,
      [sid, now, Math.ceil(deadline(updated) / 1000)]);
      return { result, identity: updated };
    });
  },
  async revoke(sid: string, all: boolean) {
    if (!validSid(sid)) throw new Unauthenticated();
    return transaction(async client => {
      const sql = all ? 'SELECT auth.revoke_all_sessions($1) AS result' : 'SELECT auth.revoke_current_session($1) AS result';
      const result = (await client.query<{ result: string }>(sql, [sid])).rows[0]?.result;
      if (!['revoked', 'already_revoked', 'invalid_session'].includes(result)) throw new Error('Invalid revocation response');
      return result; // Even invalid_session must commit its quarantine.
    });
  },
};

const PgStore = connectPgSimple(session);
export class PersistentSessionStore extends PgStore {
  async initialize(): Promise<void> {
    if ((await checkSessionReadiness()).status !== 'ready') {
      throw new Error('Persistent session store is not ready');
    }
  }
  constructor() {
    super({ pool, schemaName: 'auth', tableName: 'sessions', createTableIfMissing: false,
      disableTouch: true, pruneSessionInterval: false, errorLog: () => { console.error('Session store unavailable'); } });
  }
  override get(sid: string, callback: (error: Error | null, data?: SessionData | null) => void) {
    super.get(sid, (error: unknown, data) => callback(error ? new Error('Session store unavailable') : null, error ? undefined : data));
  }
  override set(sid: string, data: SessionData, callback?: (error?: Error) => void) {
    void sessions.save(sid, data).then(() => callback?.(), error => callback?.(
      error instanceof Unauthenticated ? error : new Error('Session store unavailable')));
  }
  override destroy(sid: string, callback?: (error?: Error) => void) {
    // Regeneration and destruction require quarantine, not merely stock DELETE.
    void sessions.revoke(sid, false).then(() => callback?.(), () => callback?.(new Error('Session revocation unavailable')));
  }
}
