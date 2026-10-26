import { open, readFile, stat, unlink } from 'node:fs/promises';
import { RESERVATION_TOKENS } from './narration-contract';

interface Reservation { key: string; account: string; at: number; tokens: number }
export type ReservationResult = 'reserved' | 'already_attempted' | 'budget_exhausted' | 'rate_limited';
export interface BudgetLimits { maxCalls: number; maxTokens: number }
export interface NarrationStore {
  reserve(key: string, account: string, now: number): Promise<ReservationResult>;
  lookup?(key: string, account: string): Promise<{ narrative: unknown } | null>;
  save?(key: string, account: string, narrative: unknown): Promise<void>;
}

// A pre-created, private, persistent JSONL ledger. Reserve before sending, never
// refund uncertain failures. Exclusive file creation serializes reservations even
// across processes on one local volume. A stale lock fails closed; never auto-clear.
export class NarrationBudget {
  constructor(private readonly file: string, private readonly limits: BudgetLimits) {}
  async reserve(key: string, account: string, now: number): Promise<ReservationResult> {
    const lock = await open(this.file + '.lock', 'wx', 0o600);
    try {
      if ((await stat(this.file)).size > 1_000_000) throw new Error('Budget unavailable');
      const raw = await readFile(this.file, 'utf8');
      if (raw && !raw.endsWith('\n')) throw new Error('Budget unavailable');
      const rows: Reservation[] = raw.split('\n').filter(Boolean).map(line => {
        const v: unknown = JSON.parse(line);
        if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('Budget unavailable');
        const r = v as Record<string, unknown>;
        if (Object.keys(r).length !== 4 || typeof r.key !== 'string' || !/^[a-f0-9]{64}$/.test(r.key) ||
            typeof r.account !== 'string' || !/^[a-f0-9]{64}$/.test(r.account) ||
            typeof r.at !== 'number' || !Number.isSafeInteger(r.at) || r.at < 0 || r.at > now || r.tokens !== RESERVATION_TOKENS) throw new Error('Budget unavailable');
        return { key: r.key, account: r.account, at: r.at, tokens: RESERVATION_TOKENS };
      });
      if (rows.some(row => row.key === key)) return 'already_attempted';
      if (rows.length >= this.limits.maxCalls || (rows.length + 1) * RESERVATION_TOKENS > this.limits.maxTokens) return 'budget_exhausted';
      if (rows.filter(r => now - r.at < 60_000).length >= 3 ||
          rows.filter(r => r.account === account && now - r.at < 3_600_000).length >= 2) return 'rate_limited';
      const ledger = await open(this.file, 'a');
      try { await ledger.writeFile(JSON.stringify({ key, account, at: now, tokens: RESERVATION_TOKENS }) + '\n'); await ledger.sync(); }
      finally { await ledger.close(); }
      return 'reserved';
    } finally { await lock.close(); await unlink(this.file + '.lock'); }
  }
}
