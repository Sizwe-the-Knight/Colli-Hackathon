import { isAbsolute } from 'node:path';
import type { UsageReport } from './usage';
import { NarrationBudget, type NarrationStore } from './narration-budget';
import { MODEL, ENDPOINT, fingerprint, hash, leadFinding, narrativeChoices, legacyNarrativeChoices, providerRequest, validateNarrative,
  type NarrationResult } from './narration-contract';

export interface NarratorConfig { enabled: boolean; apiKey: string; model: string; budgetFile: string; maxCalls: number; maxTokens: number; storage?: 'file' | 'postgres' }
export function narratorConfig(env: NodeJS.ProcessEnv): NarratorConfig {
  const maxCalls = Number(env.NEBIUS_MAX_CALLS ?? 0), maxTokens = Number(env.NEBIUS_TOKEN_BUDGET ?? 0);
  const model = env.NEBIUS_MODEL ?? MODEL, budgetFile = env.NEBIUS_BUDGET_FILE ?? '';
  const apiKey = env.NEBIUS_API_KEY ?? '';
  const storage = env.NEBIUS_BUDGET_BACKEND === 'postgres' ? 'postgres' : 'file';
  const valid = model === MODEL && (storage === 'postgres' || isAbsolute(budgetFile)) && !!apiKey.trim() &&
    (!env.NEBIUS_BUDGET_BACKEND || ['file', 'postgres'].includes(env.NEBIUS_BUDGET_BACKEND)) &&
    (env.NODE_ENV !== 'production' || storage === 'postgres') &&
    Number.isSafeInteger(maxCalls) && maxCalls > 0 && maxCalls <= 1000 &&
    Number.isSafeInteger(maxTokens) && maxTokens > 0 && maxTokens <= 10_000_000 &&
    (storage !== 'postgres' || (maxCalls <= 100 && maxTokens <= 870400));
  return { enabled: env.NEBIUS_NARRATION_ENABLED === 'true' && valid, apiKey, model, budgetFile, maxCalls, maxTokens, storage };
}

async function boundedJson(response: Response): Promise<unknown> {
  if (!response.ok || !response.headers.get('content-type')?.toLowerCase().includes('application/json') || !response.body) throw new Error('Provider unavailable');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) { const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > 16_384) throw new Error('Invalid provider response'); chunks.push(value); }
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export class BriefNarrator {
  private readonly cache = new Map<string, NarrationResult>();
  private readonly pending = new Map<string, Promise<NarrationResult>>();
  private readonly budget: NarrationStore;
  constructor(private readonly config: NarratorConfig, private readonly fetcher: typeof fetch = fetch,
    private readonly now: () => number = Date.now, private readonly timeoutMs = 15_000, store?: NarrationStore) {
    // A PostgreSQL configuration must never fall back to an ephemeral file ledger.
    if (config.enabled && config.storage === 'postgres' && !store) throw new Error('Persistent narration store required');
    this.budget = store ?? new NarrationBudget(config.budgetFile, config);
  }
  private key(accountId: number, report: UsageReport) { return hash(`${accountId}:${fingerprint(report)}`); }
  read(accountId: number, report: UsageReport): NarrationResult {
    const finding = leadFinding(report);
    const base: NarrationResult = { fingerprint: fingerprint(report), findingId: finding?.id ?? null,
      status: 'disabled', source: 'deterministic', narrative: null, model: null };
    if (!Number.isSafeInteger(accountId) || accountId <= 0 || !this.config.enabled) return base;
    const cached = this.cache.get(this.key(accountId, report));
    if (cached) return { ...cached, status: cached.source === 'nemotron' ? 'cached' : cached.status };
    return { ...base, status: finding && narrativeChoices(report, finding) ? 'available' : 'unsupported' };
  }
  async readStored(accountId: number, report: UsageReport): Promise<NarrationResult> {
    const initial = this.read(accountId, report);
    if (initial.status !== 'available' || !this.budget.lookup) return initial;
    try {
      const saved = await this.budget.lookup(this.key(accountId, report), hash(String(accountId)));
      if (!saved) return initial;
      const finding = leadFinding(report)!;
      const legacy = legacyNarrativeChoices(report, finding);
      const narrative = validateNarrative(saved.narrative, finding.id, narrativeChoices(report, finding)!) ??
        (legacy ? validateNarrative(saved.narrative, finding.id, legacy) : null);
      // Durable results are revalidated against today's exact evidence contract.
      return narrative ? { ...initial, status: 'cached', source: 'nemotron', narrative, model: this.config.model }
        : { ...initial, status: 'already_attempted' };
    } catch { return { ...initial, status: 'unavailable' }; }
  }
  async generate(accountId: number, report: UsageReport): Promise<NarrationResult> {
    const initial = await this.readStored(accountId, report);
    if (initial.status !== 'available') return initial;
    const key = this.key(accountId, report);
    const existing = this.pending.get(key); if (existing) return existing;
    const operation = this.perform(accountId, key, report, initial);
    this.pending.set(key, operation);
    try { return await operation; } finally { this.pending.delete(key); }
  }
  private async perform(accountId: number, key: string, report: UsageReport, initial: NarrationResult): Promise<NarrationResult> {
    const fallback = (status: NarrationResult['status']): NarrationResult => ({ ...initial, status });
    const finding = leadFinding(report)!;
    const choices = narrativeChoices(report, finding)!;
    const body = providerRequest(report, finding, choices, this.config.model);
    if (!body) return fallback('unsupported');
    let result: NarrationResult;
    try {
      const reservation = await this.budget.reserve(key, hash(String(accountId)), this.now());
      if (reservation !== 'reserved') return reservation === 'already_attempted' && this.budget.lookup
        ? await this.readStored(accountId, report) : fallback(reservation);
      const controller = new AbortController();
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => {
          controller.abort(); reject(new Error('Provider timeout'));
        }, this.timeoutMs); });
        const operation = (async () => {
          const response = await this.fetcher(ENDPOINT, { method: 'POST', redirect: 'error', signal: controller.signal,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.config.apiKey}` }, body });
          const value = await boundedJson(response);
          if (!value || typeof value !== 'object') throw new Error('Invalid provider response');
          const data = value as Record<string, unknown>;
          if (!Array.isArray(data.choices) || data.choices.length !== 1) throw new Error('Invalid provider response');
          const choice: unknown = data.choices[0];
          if (!choice || typeof choice !== 'object') throw new Error('Invalid provider response');
          const c = choice as Record<string, unknown>;
          if (c.finish_reason !== 'stop' || !c.message || typeof c.message !== 'object') throw new Error('Incomplete provider response');
          const message = c.message as Record<string, unknown>;
          if (message.refusal || message.tool_calls || typeof message.content !== 'string') throw new Error('Invalid provider response');
          const narrative = validateNarrative(JSON.parse(message.content), finding.id, choices);
          if (!narrative) throw new Error('Unsupported narrative');
          return { ...initial, status: 'generated' as const, source: 'nemotron' as const, narrative, model: this.config.model };
        })();
        result = await Promise.race([operation, timeout]);
      } finally { if (timer) clearTimeout(timer); }
      if (result.source === 'nemotron' && this.budget.save)
        await this.budget.save(key, hash(String(accountId)), result.narrative);
    } catch { result = fallback('unavailable'); } // Never return/log provider bodies, keys or errors.
    // Bounded by configured lifetime call allowance. Failed attempts cannot trigger
    // another paid request; the ledger preserves that rule across API restarts.
    if (this.cache.size < 1000) this.cache.set(key, result);
    return result;
  }
}
