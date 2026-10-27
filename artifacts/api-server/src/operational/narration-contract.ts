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
// Read-only compatibility for previously validated, persisted results. Never send
// this vocabulary in a new request or change the report's reservation identity.
export function legacyNarrativeChoices(report: UsageReport, finding: Finding): Choices | null {
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

export function previousNarrativeChoices(report: UsageReport, finding: Finding): Choices | null {
  const previous = report.periods.previous.totals, current = report.periods.current.totals;
  if (finding.kind === 'insufficient_data' && !report.comparison.supported) return {
    headline: ['We need a fuller picture.'],
    whatHappened: ['Some information is missing, so we cannot fairly compare these periods.'],
    whyItMatters: ["Missing information doesn't mean everything went well."],
    nextStep: ['Read the coverage note above before drawing a conclusion.'],
  };
  if (finding.kind === 'no_action' && report.comparison.supported) return {
    headline: ['No change needed.'], whatHappened: ['The totals stayed the same across these two periods.'],
    whyItMatters: ["That doesn't tell us whether every task went well."],
    nextStep: ['No change is suggested by these totals alone.'],
  };
  const change = finding.change;
  if (!report.comparison.supported || finding.kind !== 'change' || !change) return null;
  if (change.metric === 'failures') {
    const linked = new Set(finding.evidence.recordKeys);
    const recordsFor = (keys: string[]) => report.records.filter(r => keys.includes(r.key));
    const before = recordsFor(previous.recordKeys), now = recordsFor(current.recordKeys);
    // Context comes from linked evidence, never an invented provider or count.
    if (before.length !== previous.activities || now.length !== current.activities ||
        before.filter(r => r.outcome === 'failure').length !== Number(change.previous) ||
        now.filter(r => r.outcome === 'failure').length !== Number(change.current) ||
        ![...before, ...now].every(r => linked.has(r.key))) return null;
    const failed = now.filter(r => r.outcome === 'failure');
    const names: Record<string, string> = { anthropic: 'Anthropic', openai: 'OpenAI', google: 'Gemini', grok: 'Grok', deepseek: 'DeepSeek', mistral: 'Mistral', perplexity: 'Perplexity' };
    const provider = failed.length === 1 ? names[failed[0].provider] : undefined;
    const taskUnknown = failed.length > 0 && failed.every(r => r.workflow === null);
    return {
      headline: [provider ? `${provider} couldn't complete one request.` : `${failed.length} of ${current.activities} AI requests failed.`],
      whatHappened: [`${change.current} of ${current.activities} requests failed in this period, compared with ${change.previous} of ${previous.activities} before.`],
      whyItMatters: taskUnknown
        ? ["We don't know why, what the task was, or whether anyone's work was affected.", "These records don't show the cause or the task. They don't establish a bigger problem."]
        : ["These records don't show the cause or whether anyone's work was affected."],
      nextStep: report.provenance.kind === 'synthetic'
        ? ['Compare the two periods above. This demo needs no action on your accounts.']
        : ['Compare the two periods above before changing services. The cause is still unknown.'],
    };
  }
  if (change.metric === 'recordedCost') return {
    headline: ['Recorded spending changed.'],
    whatHappened: [`${change.currency} ${change.current} was recorded, compared with ${change.currency} ${change.previous} before.`],
    whyItMatters: ['These amounts may not cover your whole bill. They are not proof of savings.'],
    nextStep: ['Compare the amounts above without adding different currencies together.'],
  };
  if (change.metric === 'activities') return {
    headline: ['The number of AI requests changed.'],
    whatHappened: [`There were ${change.current} AI requests, compared with ${change.previous} before.`],
    whyItMatters: ["More requests don't necessarily mean more useful work."],
    nextStep: ['Compare the two periods above before deciding whether anything needs to change.'],
  };
  if (change.metric === 'inputTokens' || change.metric === 'outputTokens') return {
    headline: ['The amount of text processed changed.'],
    whatHappened: [change.metric === 'inputTokens' ? 'The amount of text sent to AI changed.' : 'The amount of text returned by AI changed.'],
    whyItMatters: ["Text length alone doesn't tell us how useful or costly the work was."],
    nextStep: ['Do not change services based on text length alone.'],
  };
  return null;
}

// Enrich the factual observation without claiming a cause or a reliable trend.
export function narrativeChoices(report: UsageReport, finding: Finding): Choices | null {
  const choices = previousNarrativeChoices(report, finding);
  if (!choices || finding.change?.metric !== 'failures') return choices;
  const now = report.periods.current.totals, before = report.periods.previous.totals;
  return { ...choices,
    whatHappened: [
      `${now.outcomes.success} of ${now.activities} requests worked; ${now.outcomes.failure} failed. Before, ${before.outcomes.failure} of ${before.activities} failed.`,
    ],
    whyItMatters: ["A failed request doesn't by itself mean a service is unreliable. These two periods don't tell us whether it will keep happening."],
    nextStep: ['Compare the failed counts and total requests above. Look for repeated failures across more periods before deciding to switch services.'],
  };
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
      { role: 'system', content: 'Explain this evidence to a friend who knows nothing about AI technology. Choose exactly one evidence-approved option per field in the JSON schema. Use the concrete counts and named service when supplied. Say what happened, what we do not know, and the available next step. Never invent a cause, task, lost work, trend or an error screen. The displayed period comparison is available; raw error details are not. No change needed is valid when offered. Return JSON only.' },
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
