import { createHash } from 'node:crypto';
import { pool } from '@workspace/db';
import type { PoolClient } from '@workspace/db';
import type { AttemptStore } from './auth-limits';

type Connection = Pick<PoolClient, 'query' | 'release'>;
export class PostgresAuthAttempts implements AttemptStore {
  constructor(private readonly connect: () => Promise<Connection> = () => pool.connect()) {}
  async take(kind: 'login' | 'register', network: string): Promise<number> {
    const client = await this.connect();
    let discard = false;
    try {
      await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      await client.query("SET LOCAL statement_timeout = '3s'");
      await client.query("SET LOCAL lock_timeout = '1s'");
      const { rows } = await client.query<{ retry_after: number }>(
        'SELECT auth.consume_auth_attempt($1, $2) AS retry_after',
        [kind, createHash('sha256').update(network).digest('hex')]);
      const wait = rows[0]?.retry_after;
      if (rows.length !== 1 || !Number.isSafeInteger(wait) || wait! < 0 || wait! > 3600) {
        throw new Error('Invalid authentication limit result');
      }
      // Commit the reservation BEFORE allowing hashing/lookup/session creation.
      await client.query('COMMIT');
      return wait!;
    } catch {
      try { await client.query('ROLLBACK'); } catch { discard = true; }
      throw new Error('Authentication limits unavailable');
    } finally { client.release(discard); }
  }
}
