# Normalized usage pipeline — output contract v1

This module executes without importing the API, authentication, database, environment
or wall clock. It does not activate the API or replace the existing sample dashboard.
No provider-specific consumer-account integrations, billing inference or LLM calls exist.

From the repository root:

```powershell
pnpm.cmd --filter @workspace/scripts run usage-example
node scripts/usage-example.mjs scripts/fixtures/usage-incomplete.json
node scripts/usage-example.mjs scripts/fixtures/usage-malformed.json
node scripts/usage-example.mjs C:\path\to\normalized-export.json
```

The command prints the calculated JSON report to stdout; it writes no files and
makes no connections. The malformed fixture deliberately exits 1 with a sanitized
field/code error. Other fixtures contain only invented data. Avoid redirecting real
imports/reports into Git; reports include accepted event identifiers and source labels.

## Input

Use `scripts/fixtures/usage-synthetic.json` as the complete example. The envelope
contains `version: 1`, `provenance`, `sourceIds`, `periods` and `records`.

- Provenance: `kind` is `synthetic` or `user_imported`; `importId` identifies the
  batch; `label` describes the export. A batch has one provenance kind. Authenticity
  is never independently verified. No client-supplied verification flag is accepted.
- Source scope: stable `sourceIds` identify exported activity streams, not import
  filenames. Use different source IDs for different account/project streams. Keep
  the same ID when reimporting the same stream. The caller is responsible for that
  mapping; this first slice has no account discovery or persistent import ledger.
- Each period specifies `start`, `end` and `coverage` (`complete`, `partial`,
  `unknown`). Both periods use the same declared source scope, equal elapsed
  durations and adjacent half-open intervals `[start,end)`. Timestamps must be UTC
  RFC3339 strings with whole seconds or exactly three fractional digits. Convert
  provider offsets upstream; calendar rollover and implicit local times are rejected.
- Each record requires `sourceId`, `provider`, `eventId`, `timestamp`. When an export
  lacks a stable event ID, assign one in the import adapter before using this contract;
  the pipeline will not guess identities or deduplicate by timestamp alone.
- Optional `model`, `workflow`, `inputTokens`, `outputTokens`, `cost`, `outcome` are
  normalized to null/unknown when absent. Tokens are nonnegative safe integers.
  Outcome is `success`, `failure` or `unknown`; failure is a request outcome, not
  proof of an operational incident.
- Cost, when present, needs an amount **decimal string** (up to 12 integral and six
  fractional digits) and uppercase three-letter currency code. These are recorded
  amounts, not computed prices; currency codes are format-checked, not validated
  against a live currency registry. Exact fixed-point arithmetic preserves precision.
- Unknown fields, invalid quantities, malformed timestamps and duplicate
  `(sourceId,provider,eventId)` identities reject the entire batch. Import ID is
  deliberately excluded from event identity. Combine batches before processing to
  detect cross-batch duplicates; this command does not persist or merge imports.
  JSON input is limited to 10 MiB, 100,000 records and 1,000 source IDs.

## Output and evidence

`UsageReport` includes normalized records/provenance, per-period totals and provider/
model counts, excluded event keys, supported changes and typed findings. Exact event
keys link every finding to accepted records. Original import row numbers remain
available even though records are sorted by timestamp/key. Currency-specific findings
link only records of that currency. No exchange-rate conversion or combined spending
total is produced. Token/cost missing-record counts accompany supplied totals.

Comparisons require records in both periods and explicitly complete coverage.
“Complete” is the importer's assertion, never independently established. Incomplete
token, outcome or cost fields suppress comparisons for those measures. Missing costs
are never filled with zero. A currency absent from a fully costed, complete period
has zero **recorded** cost within that scope, not a claim about total account spending.
Percentage changes are rounded to two decimals; a zero baseline has no percentage.
Cost changes use exact decimal strings and do not calculate percentages.

Empty/partial coverage produces insufficient-data findings. Unchanged complete totals
produce no-action findings, never a healthy score or “no incidents” conclusion.
Counts do not establish quality, employee productivity, subscription utilization or
savings. Coverage outside the declared source scope is unknown.

The authenticated, read-only `/api/operational/brief` route processes the bundled
synthetic fixture. The Daily Executive Brief consumes its findings, displays
provenance/limitations and resolves `evidence.recordKeys` against `records`.
This is shared demonstration data, not connected provider activity. Secondary
Control Panel pages still use sample metrics. Persistent imports and Nemotron
remain unimplemented; a future narrative model must not invent new statistics.
