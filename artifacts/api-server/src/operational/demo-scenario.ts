import fixture from '../../../../scripts/fixtures/usage-synthetic.json';
import { processUsage } from './usage';

const supported = ['anthropic', 'deepseek', 'google', 'grok', 'mistral', 'openai', 'perplexity'];
// Stable, versioned examples, not imported activity. Sorting/deduplication prevents
// preference order from creating another report or inference reservation.
export function providerDemo(raw: unknown) {
  let values: unknown = raw;
  if (typeof raw === 'string') { try { values = JSON.parse(raw); } catch { values = null; } }
  const providers = Array.isArray(values) ? supported.filter(p => (values as unknown[]).includes(p)) : [];
  // Preserve the historical explicitly separate example and its cache identity.
  if (!providers.length) return processUsage(fixture);
  const id = 'selected-v1-' + providers.join('-');
  const record = (provider: string, index: number, current: boolean, failure = false) => ({
    sourceId: id, provider, model: null, eventId: (current ? 'c' : 'p') + index,
    timestamp: current ? '2026-10-20T10:00:00Z' : '2026-10-19T10:00:00Z',
    outcome: failure ? 'failure' : 'success',
  });
  // Every selected service has an example in each period. One additional current
  // attempt fails; no fabricated prices, model names, causes or tasks are supplied.
  const report = processUsage({ version: 1,
    provenance: { kind: 'synthetic', importId: id, label: 'Example records for selected providers; no connected account activity' },
    sourceIds: [id], periods: fixture.periods,
    records: [...providers.map((p,i) => record(p,i,false)),
      ...providers.map((p,i) => record(p,i,true)), record(providers[0],providers.length,true,true)],
  });
  // Distinct finding IDs prevent an in-flight preference change from attaching
  // an explanation for a different scenario to the currently displayed facts.
  return { ...report, findings: report.findings.map(f => ({ ...f, id: id + ':' + f.id })) };
}
