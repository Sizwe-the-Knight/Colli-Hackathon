import type { pool as databasePool } from '@workspace/db';
import { hash } from './narration-contract';
import type { BudgetLimits, NarrationStore, ReservationResult } from './narration-budget';

// Only server configuration designates judge accounts. Neither the request body
// nor an email/domain or user profile field can grant the reserved allocation.
export function judgeAccounts(value = ''): ReadonlySet<string> {
  if (!value.trim()) return new Set();
  const ids = value.split(',').map(v => v.trim());
  if (ids.length > 20 || ids.some(v => !/^[1-9]\d*$/.test(v) || !Number.isSafeInteger(Number(v))))
    throw new Error('Invalid judge account configuration');
  return new Set(ids.map(v => hash(String(Number(v)))));
}
export class PostgresNarrationStore implements NarrationStore {
  constructor(private readonly pool: Pick<typeof databasePool, 'query'>, private readonly limits: BudgetLimits,
    private readonly judges: ReadonlySet<string>) {}
  async reserve(key: string, account: string, _now: number): Promise<ReservationResult> {
    // Function serializes reservations and commits BEFORE this query returns.
    const r = await this.pool.query<{ result: string }>(
      'SELECT auth.reserve_narration($1,$2,$3,$4,$5) AS result',
      [key, account, this.judges.has(account), this.limits.maxCalls, this.limits.maxTokens]);
    const status = r.rows[0]?.result;
    if (!['reserved', 'already_attempted', 'budget_exhausted', 'rate_limited'].includes(status))
      throw new Error('Narration quota unavailable');
    return status as ReservationResult;
  }
  async lookup(key: string, account: string): Promise<{ narrative: unknown } | null> {
    const r = await this.pool.query<{ value: { narrative: unknown } | null }>(
      'SELECT auth.read_narration($1,$2) AS value', [key, account]);
    if (r.rows.length !== 1) throw new Error('Narration cache unavailable');
    return r.rows[0].value;
  }
  async save(key: string, account: string, narrative: unknown): Promise<void> {
    const r = await this.pool.query<{ saved: boolean }>(
      'SELECT auth.save_narration($1,$2,$3::jsonb) AS saved', [key, account, JSON.stringify(narrative)]);
    if (r.rows[0]?.saved !== true) throw new Error('Narration cache unavailable');
  }
}
