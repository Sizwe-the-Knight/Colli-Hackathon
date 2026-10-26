import { createHash } from 'node:crypto';
import type { Finding, UsageReport } from './usage';

export const MODEL = 'nvidia/Nemotron-3_5-Lightning';
export const ENDPOINT = 'https://api.tokenfactory.nebius.com/v1/chat/completions';
export const INPUT_TOKEN_BOUND = 8192;
export const OUTPUT_TOKEN_BOUND = 512;
export const RESERVATION_TOKENS = INPUT_TOKEN_BOUND + OUTPUT_TOKEN_BOUND;
export const fields = ['headline', 'whatHappened', 'whyItMatters', 'nextStep'] as const;
export type Narrative = Record<typeof fields[number], string> & { findingId: string };
export type Choices = Record<typeof fields[number], string[]>;
export type NarrationStatus = 'available' | 'disabled' | 'generated' | 'cached' | 'unavailable' |
  'budget_exhausted' | 'rate_limited' | 'already_attempted' | 'unsupported';
export interface NarrationResult {
  fingerprint: string;
  findingId: string | null;
  status: NarrationStatus;
  source: 'deterministic' | 'nemotron';
  narrative: Narrative | null;
  model: string | null;
}

export const hash = (value: string) => createHash('sha256').update(value).digest('hex');
export const fingerprint = (report: UsageReport) => hash(JSON.stringify(report));
export function leadFinding(report: UsageReport): Finding | undefined {
  if (!report.comparison.supported) return report.findings.find(f => f.kind === 'insufficient_data');
  return report.findings.find(f => f.change?.metric === 'failures') ?? report.findings.find(f => f.kind === 'change') ?? report.findings[0];
}

// Constrained narration, not a keyword filter for arbitrary prose. Each allowed
// sentence is justified by a deterministic finding. Numbers/evidence stay in Colli.
// New finding kinds require reviewed wording before becoming model-eligible.
export function narrativeChoices(report: UsageReport, finding: Finding): Choices | null {
  if (finding.kind === 'insufficient_data' && !report.comparison.supported) return {
    headline: ['There is not enough information to compare yet.', 'A clearer picture needs more information.'],
    whatHappened: ['The supplied records do not support a reliable comparison.'],
    whyItMatters: ['Missing information could hide a change.', 'A partial picture can be misleading.'],
    nextStep: ['Check that both periods include the information you want to compare.'],
  };
  if (finding.kind === 'no_action' && report.comparison.supported) return {
    headline: ['No change needed.', 'The compared totals are unchanged.'],
    whatHappened: ['The totals that could be compared stayed the same.'],
    whyItMatters: ['These totals alone do not tell us whether every AI service is working well.'],
    nextStep: ['No change needed based on these totals alone.'],
  };
  const change = finding.change;
  if (!report.comparison.supported || finding.kind !== 'change' || !change) return null;
  const up = Number(change.delta) > 0;
  if (Number(change.delta) === 0 || !Number.isFinite(Number(change.delta))) return null;
  switch (change.metric) {
    case 'failures': return {
      headline: up ? ['More AI attempts did not complete.', 'Unfinished AI attempts deserve a closer look.'] : ['Fewer AI attempts did not complete.'],
      whatHappened: [up ? 'The supplied records show more unsuccessful attempts than in the previous period.' : 'The supplied records show fewer unsuccessful attempts than in the previous period.'],
      whyItMatters: ['An unsuccessful attempt may interrupt someone’s work.', 'The records do not explain why those attempts were unsuccessful.'],
      nextStep: ['Review the affected examples before deciding whether anything needs to change.', 'Check the supporting records to understand what happened.'],
    };
    case 'recordedCost': return {
      headline: [up ? 'Recorded spending increased.' : 'Recorded spending decreased.'],
      whatHappened: [up ? 'The recorded amount rose within the compared currency.' : 'The recorded amount fell within the compared currency.'],
      whyItMatters: ['Recorded amounts are not a complete bill or proof of savings.'],
      nextStep: ['Check the examples behind this change before adjusting a budget.'],
    };
    case 'activities': return {
      headline: [up ? 'More AI activity was recorded.' : 'Less AI activity was recorded.'],
      whatHappened: [up ? 'The supplied records contain more AI attempts than before.' : 'The supplied records contain fewer AI attempts than before.'],
      whyItMatters: ['Activity counts alone do not show whether the work was useful.'],
      nextStep: ['Review the examples behind the change before drawing conclusions.'],
    };
    case 'inputTokens': case 'outputTokens': return {
      headline: ['The amount of text processed changed.'],
      whatHappened: [change.metric === 'inputTokens' ? 'The recorded amount of text sent to AI changed.' : 'The recorded amount of text returned by AI changed.'],
      whyItMatters: ['Text volume alone does not establish value or total spending.'],
      nextStep: ['Check the recorded examples and costs separately.'],
    };
  }
}

export function validateNarrative(value: unknown, findingId: string, choices: Choices): Narrative | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).length !== 5 || v.findingId !== findingId ||
      fields.some(field => typeof v[field] !== 'string' || !choices[field].includes(v[field]))) return null;
  return { findingId, headline: String(v.headline), whatHappened: String(v.whatHappened),
    whyItMatters: String(v.whyItMatters), nextStep: String(v.nextStep) };
}

export function providerRequest(report: UsageReport, finding: Finding, choices: Choices, model: string) {
  const properties = Object.fromEntries(fields.map(field => [field, { type: 'string', enum: choices[field] }]));
  // Hash evidence references: no event identifiers, account details, arbitrary
  // source labels, workflows, credentials or session data leave the server.
  const evidence = finding.evidence.recordKeys.map(hash);
  if (evidence.length > 32) return null;
  const body = JSON.stringify({ model, stream: false, n: 1, temperature: 0,
    max_tokens: OUTPUT_TOKEN_BOUND,
    // Raw HTTP extension; SDK `extra_body` is not a JSON payload wrapper.
    chat_template_kwargs: { enable_thinking: false },
    messages: [
      { role: 'system', content: 'Compose a concise everyday-language Daily Brief from the supplied finding. Choose exactly one approved sentence per field in the JSON schema. Pick a helpful, conservative combination. Do not add facts, numbers, causes, promises or advice. No change needed is valid when offered. Return JSON only.' },
      { role: 'user', content: JSON.stringify({ findingId: finding.id, kind: finding.kind, change: finding.change,
        evidence, periods: finding.evidence.periods, coverage: { previous: report.periods.previous.coverage, current: report.periods.current.coverage },
        synthetic: report.provenance.kind === 'synthetic', independentlyVerified: false }) },
    ],
    response_format: { type: 'json_schema', json_schema: { name: 'daily_brief', strict: true, schema: {
      type: 'object', properties: { findingId: { type: 'string', enum: [finding.id] }, ...properties },
      required: ['findingId', ...fields], additionalProperties: false,
    } } },
  });
  // UTF-8 byte ceiling is deliberately more conservative than a token estimate;
  // reserve 1,024 tokens for chat/schema framing. No truncation of evidence.
  return Buffer.byteLength(body, 'utf8') + 1024 <= INPUT_TOKEN_BOUND ? body : null;
}
