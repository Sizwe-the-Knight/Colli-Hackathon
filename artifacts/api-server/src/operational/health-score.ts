/** Isolated synthetic proof of concept. No imports, I/O, clock or model decisions. */
export const HEALTH_WEIGHTS = Object.freeze({ fit: 0.35, spend: 0.30, reliability: 0.25, continuity: 0.10 });
export type HealthDimension = keyof typeof HEALTH_WEIGHTS;
type Coverage = 'complete' | 'partial' | 'unknown';
interface Evidence { coverage: Coverage; evidenceRef: string }
export interface SyntheticHealthInput {
  version: 1;
  provenance: { kind: 'synthetic'; label: string };
  period: { start: string; end: string };
  sources: { id: string; description: string }[];
  fit: Evidence & { declaredNeeds: number; metNeeds: number };
  spend: Evidence & { currency: string; paidCents: number; meaningfulUseCents: number };
  reliability: Evidence & { requests: number; successfulRequests: number };
  continuity: Evidence & { criticalWorkflows: number; coveredWorkflows: number };
}
type Reason = 'missing_or_invalid_input' | 'synthetic_only' | 'incomplete_evidence' | 'invalid_counts' | 'zero_denominator';
export type HealthScoreResult = {
  status: 'not_assessed'; label: 'Not assessed'; score: null; reason: Reason; dimension?: HealthDimension;
} | {
  status: 'illustrative'; label: 'Hypothetical synthetic score'; score: number;
  weightedTotal: number;
  components: { dimension: HealthDimension; evidenceRef: string; numerator: number; denominator: number;
    subscore: number; weight: number; contribution: number }[];
};
function object(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
function text(value: unknown): value is string { return typeof value === 'string' && value.trim().length > 0; }
function midnight(value: unknown): number | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/.test(value)) return null;
  const n = Date.parse(value);
  return Number.isFinite(n) && new Date(n).toISOString() === value ? n : null;
}
const absent = (reason: Reason, dimension?: HealthDimension): HealthScoreResult =>
  ({ status: 'not_assessed', label: 'Not assessed', score: null, reason, ...(dimension ? { dimension } : {}) });

/** All four ratios are required. Never impute missing values or redistribute weights.
 * Counts are declared synthetic aggregates, not proof of connected-provider coverage.
 * Only the final weighted sum is rounded (nearest integer, .5 rounds up).
 */
export function scoreSyntheticHealth(input: unknown): HealthScoreResult {
  if (!object(input) || input.version !== 1 || !object(input.provenance)) return absent('missing_or_invalid_input');
  if (input.provenance.kind !== 'synthetic') return absent('synthetic_only');
  if (!text(input.provenance.label) || !object(input.period) || !Array.isArray(input.sources)) return absent('missing_or_invalid_input');
  const start = midnight(input.period.start), end = midnight(input.period.end);
  if (start === null || end === null || end - start !== 30 * 86400000) return absent('missing_or_invalid_input');
  const sources = new Set<string>();
  for (const source of input.sources) {
    if (!object(source) || !text(source.id) || !text(source.description) || sources.has(source.id)) return absent('missing_or_invalid_input');
    sources.add(source.id);
  }
  const specs = [
    ['fit', 'metNeeds', 'declaredNeeds'], ['spend', 'meaningfulUseCents', 'paidCents'],
    ['reliability', 'successfulRequests', 'requests'], ['continuity', 'coveredWorkflows', 'criticalWorkflows'],
  ] as const;
  const components: Extract<HealthScoreResult, { status: 'illustrative' }>['components'] = [];
  // Exact rational accumulation prevents binary floating-point error at .5 boundaries.
  let totalNumerator = 0n, totalDenominator = 1n;
  for (const [dimension, numeratorKey, denominatorKey] of specs) {
    const evidence = input[dimension];
    if (!object(evidence)) return absent('missing_or_invalid_input', dimension);
    if (evidence.coverage !== 'complete' || !text(evidence.evidenceRef) || !sources.has(evidence.evidenceRef))
      return absent('incomplete_evidence', dimension);
    if (dimension === 'spend' && (typeof evidence.currency !== 'string' || !/^[A-Z]{3}$/.test(evidence.currency)))
      return absent('missing_or_invalid_input', dimension);
    const numerator = evidence[numeratorKey], denominator = evidence[denominatorKey];
    if (typeof numerator !== 'number' || typeof denominator !== 'number' || !Number.isSafeInteger(numerator) ||
      !Number.isSafeInteger(denominator) || numerator < 0 || denominator < 0 || numerator > denominator)
      return absent('invalid_counts', dimension);
    if (denominator === 0) return absent('zero_denominator', dimension);
    const ratio = numerator / denominator, subscore = 100 * ratio, weight = HEALTH_WEIGHTS[dimension];
    const n = BigInt(numerator) * BigInt(weight * 100), d = BigInt(denominator);
    totalNumerator = totalNumerator * d + n * totalDenominator;
    totalDenominator *= d;
    components.push({ dimension, evidenceRef: evidence.evidenceRef, numerator, denominator, subscore, weight, contribution: ratio * (weight * 100) });
  }
  const weightedTotal = Number(totalNumerator) / Number(totalDenominator);
  return { status: 'illustrative', label: 'Hypothetical synthetic score',
    score: Number((2n * totalNumerator + totalDenominator) / (2n * totalDenominator)), weightedTotal, components };
}
