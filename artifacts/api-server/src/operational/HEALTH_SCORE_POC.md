# AI Health Score — hypothetical beta proof of concept

This is an isolated, deterministic experiment, **not an assessment of any Colli
account**. The existing Daily Brief remains **Not assessed**. Its three-request
fixture does not support this example; no numbers or results are merged into it.
An optional disclosure in the Brief displays a static artifact from this scorer,
clearly separate from the account and current Brief. There is no new API route,
database access, provider connection or inference call. Nemotron neither selects
the component scores nor calculates the total.

## Definition

For one complete 30-day period (UTC, start inclusive, end exclusive):

| Component | Evidence-derived subscore | Weight | Synthetic example | Contribution |
|---|---|---|---|---|
| Ecosystem fit | 100 × met declared needs / all declared needs | 35% | 9 / 10 → 90 | 31.5 |
| Spending efficiency | 100 × spending supported by meaningful use / total paid spending | 30% | $90 / $120 → 75 | 22.5 |
| Reliability | 100 × successful requests / all requests | 25% | 96 / 100 → 96 | 24 |
| Continuity for important workflows | 100 × critical workflows with usable fallback / all critical workflows | 10% | 4 / 5 → 80 | 8 |

**0.35 × 90 + 0.30 × 75 + 0.25 × 96 + 0.10 × 80 = 86/100.**

Each ratio is in [0,100]. Components are not rounded before weighting. Only the
final sum is rounded to the nearest integer (.5 upwards). The weights are the
founder's proposed product model, not empirically validated risk predictors. No
health grade, confidence percentage or “healthy/unhealthy” threshold is assigned.

## Evidence requirements and assumptions

- All four categories must declare **complete** coverage of the same period and
  reference an inspectable source description. The fixture contains invented,
  explicitly labelled aggregate evidence; it does not claim actual underlying
  provider records or independent verification. Source references and completeness
  declarations establish traceability within the scenario, not authenticity.
- **Fit:** list distinct needs before measuring outcomes; define what meets each
  need. This simple ratio weights needs equally. Provider count/diversity and model
  brand are not inputs. Concentrated use is not penalized on its own.
- **Spend:** use one currency, integer minor units (cents for this USD example),
  complete paid costs and an explicit, non-overlapping allocation to meaningful
  use. A login or any token use is not automatically meaningful. Shared costs must
  not be counted twice. Unsupported spending does not prove waste, available savings
  or that a subscription should be cancelled. Mixed currencies need prior reviewed
  normalization; the scorer performs no currency conversion or billing lookup.
- **Reliability:** include every request and known outcome; unknown or missing
  outcomes mean coverage is incomplete. Count retries as requests rather than
  silently removing unsuccessful attempts. No inferred error reasons are used.
- **Continuity:** define critical workflows and credible failure scenarios first.
  Count coverage only when an accessible, usable fallback has been checked against
  minimum requirements. Merely listing a second provider is insufficient. No
  assumption is made that different providers have independent failure modes.

`scoreSyntheticHealth(unknown)` returns either `illustrative` with components and
source references, or `not_assessed` with a null score and a non-sensitive reason.
Missing/partial evidence, invalid dates, unsafe/fractional/negative counts, a
numerator exceeding its total, missing source references and zero denominators
withhold the **whole** score. Weights are never redistributed to hide gaps.

A free account with $0 paid spending therefore receives **Not assessed**, not an
automatic spending score of 100 or an overall 100. No activity, no declared needs
or no critical workflows also requires a future reviewed not-applicable policy;
this proof of concept does not invent one. Fully evidenced zero numerators with
positive denominators can yield zero. The scorer currently accepts **synthetic
provenance only**, deliberately preventing accidental use as a real account score.

## Inspect and reproduce the static demonstration

Inspect `scripts/fixtures/health-score-synthetic.json` for every numerator,
denominator, source description, period and disclosure. Run from the repository:

```powershell
& 'C:\Program Files\nodejs\node.exe' scripts/health-score-example.mjs
& 'C:\Program Files\nodejs\node.exe' scripts/health-score-example.mjs --check-preview
& 'C:\Program Files\nodejs\node.exe' --test tests/health-score.test.mjs
```

The preview prints **Hypothetical synthetic score**, the four ratios/contributions,
and 86. It does not start services or read environment credentials. No claim about
the currently unassessed Brief or live users follows from this example. Any future
account integration needs evidence collection/coverage verification and a reviewed
policy for missing/not-applicable categories before scoring can be enabled.

The checked-in `artifacts/colli/src/lib/health-score-sample.json` is generated with
`node scripts/health-score-example.mjs --write-preview`. The check command and
focused tests fail if it diverges from the scorer and fixture. The native
Preview/Hide control has no network handler and does not replace Not assessed.
