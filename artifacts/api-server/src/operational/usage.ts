/** Pure normalized-JSON processing. No environment, database, network or clock dependencies. */
export type Coverage = 'complete' | 'partial' | 'unknown';
export type Outcome = 'success' | 'failure' | 'unknown';
export type PeriodName = 'previous' | 'current';
export interface Period { start: string; end: string; coverage: Coverage }
export interface Provenance {
  kind: 'synthetic' | 'user_imported';
  importId: string;
  label: string;
  independentlyVerified: false;
}
export interface UsageRecord {
  key: string;
  sourceId: string;
  provider: string;
  model: string | null;
  eventId: string;
  timestamp: string;
  inputTokens: number | null;
  outputTokens: number | null;
  cost: { amount: string; currency: string } | null;
  outcome: Outcome;
  workflow: string | null;
  provenance: Provenance & { row: number };
}
export interface ImportBatch {
  version: 1;
  provenance: Provenance;
  sourceIds: string[];
  periods: Record<PeriodName, Period>;
  records: UsageRecord[];
}
export interface Quantity { total: number | null; suppliedRecords: number; missingRecords: number }
export interface Totals {
  recordKeys: string[];
  activities: number;
  inputTokens: Quantity;
  outputTokens: Quantity;
  costs: { currency: string; amount: string; suppliedRecords: number }[];
  missingCostRecords: number;
  outcomes: Record<Outcome, number>;
  distribution: { provider: string; model: string | null; activities: number }[];
}
export interface Change {
  metric: 'activities' | 'inputTokens' | 'outputTokens' | 'failures' | 'recordedCost';
  previous: number | string;
  current: number | string;
  delta: number | string;
  currency: string | null;
  percent: number | null;
}
export interface Finding {
  id: string;
  kind: 'change' | 'insufficient_data' | 'no_action';
  whatChanged: string;
  whyItMatters: string;
  investigateNext: string;
  change: Change | null;
  evidence: { recordKeys: string[]; periods: PeriodName[]; basis: 'importer_supplied_coverage' };
}
export interface UsageReport {
  version: 1;
  provenance: Provenance;
  sourceIds: string[];
  periods: Record<PeriodName, Period & { totals: Totals }>;
  comparison: { supported: boolean; reason: string; changes: Change[] };
  records: UsageRecord[];
  excludedRecordKeys: string[];
  findings: Finding[];
  limitations: string[];
}

export class UsageValidationError extends Error {
  constructor(public readonly path: string, public readonly code: string) {
    super(`Usage input rejected at ${path}: ${code}`);
    this.name = 'UsageValidationError';
  }
}
function reject(path: string, code: string): never { throw new UsageValidationError(path, code); }
const object = (value: unknown, path: string, allowed: string[]): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return reject(path, 'object_required');
  const result = Object.fromEntries(Object.entries(value));
  if (Object.keys(result).some(key => !allowed.includes(key))) reject(path, 'unknown_field');
  return result;
};
const identifier = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)) return reject(path, 'identifier_required');
  return value;
};
const label = (value: unknown, path: string): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > 200 || /[\u0000-\u001f]/.test(value)) return reject(path, 'label_required');
  return value.trim();
};
const timestamp = (value: unknown, path: string): string => {
  // Strict UTC format plus round-trip validation rejects rolled-over calendar dates.
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) return reject(path, 'utc_timestamp_required');
  const parsed = new Date(value);
  const expected = value.includes('.') ? value : value.replace('Z', '.000Z');
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString() !== expected) return reject(path, 'invalid_timestamp');
  return expected;
};
const quantity = (value: unknown, path: string): number | null => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return reject(path, 'nonnegative_safe_integer_required');
  return value;
};
const scale = 1000000n;
const units = (amount: string): bigint => {
  const [whole, fraction = ''] = amount.split('.');
  return BigInt(whole) * scale + BigInt(fraction.padEnd(6, '0'));
};
const decimal = (value: bigint): string => {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  const fraction = (absolute % scale).toString().padStart(6, '0').replace(/0+$/, '');
  return `${sign}${absolute / scale}${fraction ? `.${fraction}` : ''}`;
};
const sort = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;

export function normalizeUsage(value: unknown): ImportBatch {
  const batch = object(value, '$', ['version', 'provenance', 'sourceIds', 'periods', 'records']);
  if (batch.version !== 1) reject('version', 'unsupported_version');
  const rawProvenance = object(batch.provenance, 'provenance', ['kind', 'importId', 'label']);
  if (rawProvenance.kind !== 'synthetic' && rawProvenance.kind !== 'user_imported') reject('provenance.kind', 'invalid_kind');
  const provenance: Provenance = { kind: rawProvenance.kind,
    importId: identifier(rawProvenance.importId, 'provenance.importId'),
    label: label(rawProvenance.label, 'provenance.label'), independentlyVerified: false };
  if (!Array.isArray(batch.sourceIds) || !batch.sourceIds.length || batch.sourceIds.length > 1000) reject('sourceIds', 'nonempty_bounded_array_required');
  const sourceIds = batch.sourceIds.map((s, i) => identifier(s, `sourceIds[${i}]`)).sort(sort);
  if (new Set(sourceIds).size !== sourceIds.length) reject('sourceIds', 'duplicate_source');
  const rawPeriods = object(batch.periods, 'periods', ['previous', 'current']);
  const period = (name: PeriodName): Period => {
    const p = object(rawPeriods[name], `periods.${name}`, ['start', 'end', 'coverage']);
    const start = timestamp(p.start, `periods.${name}.start`), end = timestamp(p.end, `periods.${name}.end`);
    if (Date.parse(start) >= Date.parse(end)) reject(`periods.${name}`, 'positive_duration_required');
    if (p.coverage !== 'complete' && p.coverage !== 'partial' && p.coverage !== 'unknown') reject(`periods.${name}.coverage`, 'invalid_coverage');
    return { start, end, coverage: p.coverage };
  };
  const periods = { previous: period('previous'), current: period('current') };
  const duration = (p: Period) => Date.parse(p.end) - Date.parse(p.start);
  if (periods.previous.end !== periods.current.start || duration(periods.previous) !== duration(periods.current)) reject('periods', 'adjacent_equal_duration_required');
  if (!Array.isArray(batch.records) || batch.records.length > 100000) reject('records', 'bounded_array_required');
  const seen = new Set<string>();
  const records = batch.records.map((raw: unknown, i): UsageRecord => {
    const path = `records[${i}]`;
    const r = object(raw, path, ['sourceId','provider','model','eventId','timestamp','inputTokens','outputTokens','cost','outcome','workflow']);
    const sourceId = identifier(r.sourceId, `${path}.sourceId`);
    if (!sourceIds.includes(sourceId)) reject(path, 'source_outside_declared_scope');
    const provider = identifier(r.provider, `${path}.provider`), eventId = identifier(r.eventId, `${path}.eventId`);
    const key = JSON.stringify([sourceId, provider, eventId]);
    if (seen.has(key)) reject(path, 'duplicate_event_identity');
    seen.add(key);
    let cost: UsageRecord['cost'] = null;
    if (r.cost !== undefined && r.cost !== null) {
      const c = object(r.cost, `${path}.cost`, ['amount','currency']);
      if (typeof c.amount !== 'string' || !/^(0|[1-9]\d{0,11})(\.\d{1,6})?$/.test(c.amount)) reject(`${path}.cost.amount`, 'nonnegative_decimal_string_required');
      if (typeof c.currency !== 'string' || !/^[A-Z]{3}$/.test(c.currency)) reject(`${path}.cost.currency`, 'three_letter_currency_required');
      cost = { amount: decimal(units(c.amount)), currency: c.currency };
    }
    const outcome = r.outcome ?? 'unknown';
    if (outcome !== 'success' && outcome !== 'failure' && outcome !== 'unknown') reject(`${path}.outcome`, 'invalid_outcome');
    return { key, sourceId, provider, eventId, timestamp: timestamp(r.timestamp, `${path}.timestamp`),
      model: r.model == null ? null : identifier(r.model, `${path}.model`),
      inputTokens: quantity(r.inputTokens, `${path}.inputTokens`), outputTokens: quantity(r.outputTokens, `${path}.outputTokens`),
      cost, outcome, workflow: r.workflow == null ? null : label(r.workflow, `${path}.workflow`),
      provenance: { ...provenance, row: i + 1 } };
  }).sort((a, b) => sort(a.timestamp, b.timestamp) || sort(a.key, b.key));
  return { version: 1, provenance, sourceIds, periods, records };
}

function aggregate(records: UsageRecord[]): Totals {
  const tokens = (field: 'inputTokens' | 'outputTokens'): Quantity => {
    const supplied = records.filter(r => r[field] !== null);
    let total = 0;
    for (const record of supplied) {
      total += record[field]!;
      if (!Number.isSafeInteger(total)) reject(field, 'aggregate_exceeds_safe_integer');
    }
    return { total: supplied.length ? total : null, suppliedRecords: supplied.length, missingRecords: records.length - supplied.length };
  };
  const costs = new Map<string, { amount: bigint; suppliedRecords: number }>();
  const distribution = new Map<string, Totals['distribution'][number]>();
  const outcomes = { success: 0, failure: 0, unknown: 0 };
  for (const r of records) {
    outcomes[r.outcome]++;
    if (r.cost) {
      const c = costs.get(r.cost.currency) ?? { amount: 0n, suppliedRecords: 0 };
      c.amount += units(r.cost.amount); c.suppliedRecords++; costs.set(r.cost.currency, c);
    }
    const key = JSON.stringify([r.provider, r.model]);
    const d = distribution.get(key) ?? { provider: r.provider, model: r.model, activities: 0 };
    d.activities++; distribution.set(key, d);
  }
  return { recordKeys: records.map(r => r.key), activities: records.length,
    inputTokens: tokens('inputTokens'), outputTokens: tokens('outputTokens'),
    costs: [...costs].sort(([a], [b]) => sort(a, b)).map(([currency, c]) => ({ currency, amount: decimal(c.amount), suppliedRecords: c.suppliedRecords })),
    missingCostRecords: records.filter(r => !r.cost).length, outcomes,
    distribution: [...distribution].sort(([a], [b]) => sort(a, b)).map(([, d]) => d) };
}

export function processUsage(value: unknown): UsageReport {
  const batch = normalizeUsage(value);
  const belongs = (r: UsageRecord, p: Period) => r.timestamp >= p.start && r.timestamp < p.end;
  const previousRecords = batch.records.filter(r => belongs(r, batch.periods.previous));
  const currentRecords = batch.records.filter(r => belongs(r, batch.periods.current));
  const previous = aggregate(previousRecords), current = aggregate(currentRecords);
  const recordKeys = [...previous.recordKeys, ...current.recordKeys];
  const includedKeys = new Set(recordKeys);
  const evidence: Finding['evidence'] = { recordKeys, periods: ['previous','current'], basis: 'importer_supplied_coverage' };
  const supported = batch.periods.previous.coverage === 'complete' && batch.periods.current.coverage === 'complete' &&
    previous.activities > 0 && current.activities > 0;
  const changes: Change[] = [];
  const countChange = (metric: Change['metric'], p: number, c: number) => changes.push({ metric, previous: p, current: c,
    delta: c - p, currency: null, percent: p === 0 ? null : Math.round((c - p) / p * 10000) / 100 });
  if (supported) {
    countChange('activities', previous.activities, current.activities);
    for (const field of ['inputTokens','outputTokens'] as const) {
      if (!previous[field].missingRecords && !current[field].missingRecords) countChange(field, previous[field].total!, current[field].total!);
    }
    if (!previous.outcomes.unknown && !current.outcomes.unknown) countChange('failures', previous.outcomes.failure, current.outcomes.failure);
    if (!previous.missingCostRecords && !current.missingCostRecords) {
      for (const currency of [...new Set([...previous.costs, ...current.costs].map(c => c.currency))].sort(sort)) {
        const p = previous.costs.find(c => c.currency === currency)?.amount ?? '0';
        const c = current.costs.find(c => c.currency === currency)?.amount ?? '0';
        changes.push({ metric: 'recordedCost', previous: p, current: c, delta: decimal(units(c) - units(p)), currency, percent: null });
      }
    }
  }
  const incomplete = [previous, current].some(t => t.missingCostRecords || t.inputTokens.missingRecords || t.outputTokens.missingRecords || t.outcomes.unknown);
  const measureNames: Record<Change['metric'], string> = {
    activities: 'requests', inputTokens: 'input tokens', outputTokens: 'output tokens',
    failures: 'failed requests', recordedCost: 'cost',
  };
  const findings: Finding[] = changes.filter(c => c.delta !== 0 && c.delta !== '0').map((change, i) => ({
    id: `change-${i + 1}`, kind: 'change', change,
    whatChanged: `Recorded ${measureNames[change.metric]}${change.currency ? ` (${change.currency})` : ''} changed from ${change.previous} to ${change.current}.`,
    whyItMatters: change.metric === 'failures' ? 'The supplied records show a change in unsuccessful requests; this alone does not establish an incident or its cause.' :
      change.metric === 'recordedCost' ? 'Recorded spending changed within the supplied scope. This is not a complete bill or evidence of savings.' :
      'Recorded workload volume changed. Counts alone do not establish quality, productivity or subscription utilization.',
    investigateNext: change.metric === 'failures' ? 'Inspect the failed requests in the source records before diagnosing an incident.' :
      change.metric === 'recordedCost' ? 'Reconcile the currency-specific records with the source export before making a budget decision.' :
      'Inspect the provider/model distribution and source records for an explanation before taking action.',
    evidence: change.currency ? { ...evidence, recordKeys: [...previousRecords, ...currentRecords].filter(r => r.cost?.currency === change.currency).map(r => r.key) } : evidence,
  }));
  if (!supported || incomplete) findings.push({ id: 'insufficient-data', kind: 'insufficient_data', change: null,
    whatChanged: !supported ? 'A reliable period comparison is not supported by the supplied coverage and records.' : 'Some measures are missing; comparisons for those measures are withheld.',
    whyItMatters: 'Missing records, outcomes or costs cannot establish inactivity, zero spending or a healthy operational state.',
    investigateNext: 'Confirm source coverage and supply the missing fields before interpreting changes or taking action.', evidence });
  if (!findings.length) findings.push({ id: 'no-supported-change', kind: 'no_action', change: null,
    whatChanged: 'No change in the comparable recorded aggregate totals was found.',
    whyItMatters: 'Unchanged totals do not establish service health or absence of incidents.',
    investigateNext: 'No action is suggested from these totals alone; investigate source records if there are other concerns.', evidence });
  return { version: 1, provenance: batch.provenance, sourceIds: batch.sourceIds,
    periods: { previous: { ...batch.periods.previous, totals: previous }, current: { ...batch.periods.current, totals: current } },
    comparison: { supported, reason: supported ? 'Adjacent equal-duration periods; both declared complete for the same source scope, with records in each.' : 'Both periods need records and explicit complete coverage for the same source scope.', changes },
    records: batch.records, excludedRecordKeys: batch.records.filter(r => !includedKeys.has(r.key)).map(r => r.key), findings,
    limitations: ['Coverage is an importer assertion, not independently verified.',
      batch.provenance.kind === 'synthetic' ? 'Synthetic demonstration only; not operational evidence.' : 'User-imported records; authenticity and completeness are not independently verified.',
      'Totals describe accepted records only. Missing quantities remain unknown; currencies are never converted or combined.',
      'Request counts do not establish task quality, employee productivity, subscription utilization, savings or service health.'] };
}

export function importUsageJson(text: string): UsageReport {
  if (Buffer.byteLength(text, 'utf8') > 10 * 1024 * 1024) reject('$', 'import_too_large');
  let value: unknown;
  try { value = JSON.parse(text); } catch { return reject('$', 'malformed_json'); }
  return processUsage(value);
}
