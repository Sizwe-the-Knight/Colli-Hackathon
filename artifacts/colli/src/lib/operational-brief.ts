import { z } from 'zod';

// Validate the consumed wire contract; do not recompute engine totals or changes.
const text = z.string().min(1);
const count = z.number().int().nonnegative().safe();
const timestamp = z.string().datetime();
const quantity = z.object({ total: count.nullable(), suppliedRecords: count, missingRecords: count });
const currency = z.string().regex(/^[A-Z]{3}$/);
const decimal = z.string().regex(/^\d+(\.\d+)?$/);
const provenance = z.object({ kind: z.enum(['synthetic', 'user_imported']), importId: text, label: text, independentlyVerified: z.literal(false) });
const period = z.object({ start: timestamp, end: timestamp, coverage: z.enum(['complete', 'partial', 'unknown']), totals: z.object({
  recordKeys: z.array(text), activities: count, inputTokens: quantity, outputTokens: quantity,
  costs: z.array(z.object({ currency, amount: decimal, suppliedRecords: count })), missingCostRecords: count,
  outcomes: z.object({ success: count, failure: count, unknown: count }),
}) });
const change = z.object({ metric: z.enum(['activities', 'inputTokens', 'outputTokens', 'failures', 'recordedCost']),
  previous: z.union([z.number().finite(), decimal]), current: z.union([z.number().finite(), decimal]),
  delta: z.union([z.number().finite(), z.string().regex(/^-?\d+(\.\d+)?$/)]), currency: currency.nullable(), percent: z.number().finite().nullable() });
const finding = z.object({ id: text, kind: z.enum(['change', 'insufficient_data', 'no_action']),
  whatChanged: text, whyItMatters: text, investigateNext: text, change: change.nullable(),
  evidence: z.object({ recordKeys: z.array(text), periods: z.array(z.enum(['previous', 'current'])), basis: z.literal('importer_supplied_coverage') }),
});
export const operationalBriefSchema = z.object({
  version: z.literal(1), provenance, sourceIds: z.array(text),
  periods: z.object({ previous: period, current: period }),
  comparison: z.object({ supported: z.boolean(), reason: text, changes: z.array(change) }),
  findings: z.array(finding), limitations: z.array(text), excludedRecordKeys: z.array(text),
  records: z.array(z.object({ key: text, sourceId: text, provider: text, eventId: text, timestamp,
    model: text.nullable(), workflow: text.nullable(), inputTokens: count.nullable(), outputTokens: count.nullable(),
    outcome: z.enum(['success', 'failure', 'unknown']), cost: z.object({ amount: decimal, currency }).nullable(),
    provenance: provenance.extend({ row: count.positive() }),
  })),
}).refine(report => {
  const keys = new Set(report.records.map(record => record.key));
  return keys.size === report.records.length && report.findings.every(item => item.evidence.recordKeys.every(key => keys.has(key))) &&
    Object.values(report.periods).every(p => p.totals.recordKeys.every(key => keys.has(key))) &&
    (report.comparison.supported || (!report.comparison.changes.length && report.findings.every(f => f.change === null)));
}, 'Inconsistent report evidence or unsupported comparison');
export type OperationalBrief = z.infer<typeof operationalBriefSchema>;
export type BriefFinding = OperationalBrief['findings'][number];

export const narrationSchema = z.object({
  fingerprint: z.string().regex(/^[a-f0-9]{64}$/), findingId: text.nullable(),
  status: z.enum(['available', 'disabled', 'generated', 'cached', 'unavailable', 'budget_exhausted', 'rate_limited', 'already_attempted', 'unsupported']),
  source: z.enum(['deterministic', 'nemotron']), model: text.nullable(),
  narrative: z.object({ findingId: text, headline: text.max(160), whatHappened: text.max(240), whyItMatters: text.max(240), nextStep: text.max(240) }).strict().nullable(),
}).strict().refine(v => v.source === 'nemotron' ? !!v.narrative && v.narrative.findingId === v.findingId && !!v.model && ['generated', 'cached'].includes(v.status) : v.narrative === null && v.model === null && !['generated', 'cached'].includes(v.status));
export type BriefNarration = z.infer<typeof narrationSchema>;

export function centralFinding(report: OperationalBrief): BriefFinding | undefined {
  if (!report.comparison.supported) return report.findings.find(f => f.kind === 'insufficient_data');
  return report.findings.find(f => f.change?.metric === 'failures') ?? report.findings.find(f => f.kind === 'change') ?? report.findings[0];
}

function currentFailures(finding: BriefFinding, report?: OperationalBrief) {
  if (!report || finding.change?.metric !== 'failures') return null;
  const currentKeys = new Set(report.periods.current.totals.recordKeys);
  const evidenceKeys = new Set(finding.evidence.recordKeys);
  const records = report.records.filter(record => currentKeys.has(record.key));
  const failures = records.filter(record => record.outcome === 'failure');
  // Add source context only when the supplied totals and linked records agree.
  if (records.length !== report.periods.current.totals.activities ||
      failures.length !== Number(finding.change.current) ||
      !failures.every(record => evidenceKeys.has(record.key))) return null;
  return { total: records.length, failures };
}

export function findingHeadline(finding: BriefFinding, report?: OperationalBrief): string {
  const change = finding.change;
  const context = currentFailures(finding, report);
  if (context && context.total > 0) {
    const words = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
    const count = words[context.failures.length] ?? String(context.failures.length);
    const total = words[context.total]?.toLowerCase() ?? String(context.total);
    return `${count} of ${total} AI requests failed.`;
  }
  if (change?.metric === 'failures') return Number(change.current) === 1 ? 'One AI request failed.' : `${change.current} AI requests failed in these records.`;
  if (finding.kind === 'insufficient_data') return 'We need a fuller picture.';
  if (finding.kind === 'no_action') return 'The recorded totals are unchanged.';
  return finding.whatChanged;
}

// Editorial presentation only. Calculated findings and source evidence stay intact.
export function findingExplanation(finding: BriefFinding, report?: OperationalBrief): { context: string; significance: string; nextStep: string } {
  const records = currentFailures(finding, report);
  const failedRecord = records?.failures.length === 1 ? records.failures[0] : null;
  const providerNames: Record<string, string> = { anthropic: 'Anthropic', openai: 'OpenAI' };
  const provider = failedRecord ? providerNames[failedRecord.provider] ?? failedRecord.provider : null;
  if (finding.change?.metric === 'failures') return {
    context: provider ? `A request to ${provider} was recorded as unsuccessful. We don't yet know why.` : `The records show ${finding.change.current} ${Number(finding.change.current) === 1 ? 'failure' : 'failures'}, compared with ${finding.change.previous} in the previous period.`,
    significance: "We haven't seen enough to know whether this is a bigger issue or whether anyone's work was affected.",
    nextStep: 'Check the original records before making changes.',
  };
  if (finding.kind === 'insufficient_data') return {
    context: 'Some information needed to compare the two periods is missing.',
    significance: "Missing information doesn't mean nothing happened, nothing was spent, or everything is working well.",
    nextStep: 'Check that the records cover both periods and include the missing details.',
  };
  if (finding.kind === 'no_action') return {
    context: 'The totals we can compare stayed the same across both periods.',
    significance: "Unchanged totals alone don't tell us whether everything is working well.",
    nextStep: 'No change is suggested by these totals alone. Check the records if you have other concerns.',
  };
  return { context: '', significance: finding.whyItMatters, nextStep: finding.investigateNext };
}
