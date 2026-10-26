import React from 'react';
import sample from '../lib/health-score-sample.json';

const labels: Record<string, string> = {
  fit: 'Ecosystem fit', spend: 'Spending efficiency', reliability: 'Reliability', continuity: 'Continuity',
};
function evidence(dimension: string, numerator: number, denominator: number) {
  if (dimension === 'spend') {
    const money = (cents: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: sample.currency, maximumFractionDigits: 0 }).format(cents / 100);
    return `${money(numerator)} of ${money(denominator)} paid spending supported by meaningful usage`;
  }
  const units: Record<string, string> = { fit: 'declared needs met', reliability: 'AI requests successful', continuity: 'critical workflows with usable fallbacks' };
  return `${numerator} of ${denominator} ${units[dimension]}`;
}

// Static, generated artifact. Native disclosure requires no fetch, state or effect.
// The account's separate "Not assessed" status remains visible when expanded.
export function HealthScorePreview() {
  if (sample.result.status !== 'illustrative') return null;
  return <details className="health-sample">
    <summary><span className="health-sample-show">Preview sample score</span><span className="health-sample-hide">Hide sample score</span></summary>
    <div className="health-sample-content">
      <h3>Hypothetical synthetic example · 30 days</h3>
      <p className="health-sample-disclosure">This is not your account score. It is not calculated from connected providers or the current Daily Brief evidence.</p>
      <p className="health-sample-score"><strong>{sample.result.score}</strong><span>/100</span><span className="health-sample-score-label">Illustrative score</span></p>
      <dl className="health-sample-breakdown">{sample.result.components.map(component => <div key={component.dimension}>
        <dt>{labels[component.dimension]} <span>· {component.weight * 100}% weight</span></dt>
        <dd><strong>{component.subscore}/100</strong><span>{evidence(component.dimension, component.numerator, component.denominator)}</span></dd>
      </div>)}</dl>
      <p className="health-sample-formula">{sample.result.components.map(c => `${c.weight} × ${c.subscore}`).join(' + ')} = {sample.result.score}.</p>
      <p className="health-sample-footnote">Calculated deterministically from a separate, complete synthetic scenario—not by Nemotron. All four evidence categories are required. Your account remains Not assessed.</p>
    </div>
  </details>;
}
