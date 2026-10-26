# Grounded Nemotron Brief

Disabled by default for new installations. The founder confirmed genuine hosted
narration after the controlled acceptance described below. This snapshot makes
**no live inference calls**.
The existing deterministic report remains usable when narration is disabled,
exhausted, invalid, slow, refused or unavailable. Hosted activation requires the
prepared additive PostgreSQL quota upgrade; local file-ledger acceptance remains unchanged.

## Official contract checked 2026-10-23

- [Nebius quickstart](https://docs.tokenfactory.nebius.com/quickstart):
  `POST https://api.tokenfactory.nebius.com/v1/chat/completions`, Bearer API key.
- [Official Nemotron cookbook](https://github.com/nebius/token-factory-cookbook/blob/main/models/nemotron/run_nemotron.ipynb):
  exact pinned model `nvidia/Nemotron-3_5-Lightning`.
- [Structured output](https://docs.tokenfactory.nebius.com/ai-models-inference/json):
  `response_format.type=json_schema`, named strict schema; response at
  `choices[0].message.content`. A controlled request completed successfully; availability and entitlement for a
  new account remain deployment prerequisites. There is no automatic model fallback.

## What the model does

### Concise completion setting (26 October 2026)

The serialized raw HTTP body includes top-level
`"chat_template_kwargs": { "enable_thinking": false }`. There is no literal
`extra_body` field: that name is an SDK argument, not a wrapper in the HTTP JSON.
[NVIDIA's Nemotron 3.5 Lightning curl example](https://docs.nvidia.com/nim/large-language-models/2.0.10/get-started/advanced/get-started-nemotron-3.5-lightning.html)
uses this setting to disable reasoning and preserve the completion budget for the
visible answer. The Nebius model ID and endpoint remain those in its cookbook above;
NVIDIA's NIM example is not proof of Nebius endpoint support.

Offline tests cover this serialized body. The founder reports one controlled
request returned HTTP 200, finish_reason stop, 439 input / 139 output tokens and
validated narration without fallback. The endpoint accepted the request containing
the option; internal reasoning behavior is not independently observable from that
response. No additional inference was performed for this snapshot. The 8,704-token
reservation, 512 output cap, required finish_reason stop, schema and evidence
validation remain unchanged. There are no automatic retries or model substitutions.

Nemotron composes four fields (headline, what happened, why it may matter, next step)
by choosing from evidence-approved sentences for the central finding. The strict
dynamic enum schema is also validated locally. Arbitrary prose is not displayed:
syntax validation or a prohibited-word list cannot prove a free-form claim true.
This deliberately limits creative wording, while providing a genuine runtime model
choice. New finding types require reviewed wording. “No change needed” is offered
only for the engine's no-action result. Numbers, calculations, currency separation,
health state, evidence tables and provenance never come from the model.

Only one structured finding, its change, declared coverage and at most 32 hashed
evidence references are sent. No raw event IDs, user IDs, names, emails, workflows,
provider credentials or session data are sent. Oversize input falls back without
truncating evidence. Synthetic status is preserved. Future private imports must
continue deriving their report from the authenticated account on the server;
the current route serves only the bundled synthetic demonstration.

## When spending can happen

Authenticated `GET /api/operational/brief/narration` only reads cached narration
(PostgreSQL for hosted generation). It never calls Nebius. The optional **Explain with NVIDIA Nemotron** button sends an
origin-protected `POST` with the current report fingerprint. The server builds the
report itself and rejects stale fingerprints or extra request fields. Only that
POST can make one provider request. There is no polling, automatic paid retry,
SDK retry, redirect following or inference on refresh/navigation.

Validated results and failed outcomes are cached per authenticated user and SHA-256
of the complete deterministic report (including periods/provenance/evidence).
Concurrent duplicate requests share one operation. Results are never shared across
accounts, even for the common demo. Hosted validated results and reservations
survive restarts in PostgreSQL; stored wording is revalidated before display.
Interrupted/failed reservations never trigger an automatic retry. The local
file-ledger acceptance path still has only a process-local wording cache.

## Budget and hosting

### Hosted PostgreSQL allocation

See [the activation guide](../../../../lib/db/hosted/narration-v1/README.md).
`NEBIUS_BUDGET_BACKEND=postgres` selects a narrow SECURITY DEFINER reservation
operation using the existing restricted database pool. A global transaction lock
serializes all reservations across instances. The call is committed before fetch;
uncertain commits fail closed. Three lifetime attempts/account, 80 public attempts,
20 judge attempts, 100 total and 870,400 tokens are database ceilings. Existing
3/minute global and 2/hour/account windows also apply. No reset/refund/expiry path
is exposed. Lower configured global caps remain enforced. Judge eligibility comes
only from `NEBIUS_JUDGE_ACCOUNT_IDS` on the server, not client inputs. The fixed
synthetic report normally needs one call/account; three is an upper bound across
changed report fingerprints, not a regenerate button. There is no October deadline
in code. Preserve database reservations and deployment availability through December 15.
This hosted allocation is additional to the two historical local acceptance calls;
their ledger remains untouched. A token allowance is not a dollar/credit guarantee.

### Historical local file-ledger acceptance

Server-only configuration: `NEBIUS_NARRATION_ENABLED`, `NEBIUS_API_KEY`,
`NEBIUS_MODEL`, `NEBIUS_BUDGET_FILE`, `NEBIUS_MAX_CALLS`, `NEBIUS_TOKEN_BUDGET`.
All must be deliberately configured before enabling. Invalid configuration disables
generation; no key is returned or logged. Endpoint is fixed to the official host.

After separate approval, an operator must pre-create an **empty**
`nebius-budget.jsonl` on private persistent local storage outside tracked source,
with access limited to the API OS account/necessary administrators. On Windows use
restricted directory ACLs; POSIX mode alone is not a Windows ACL. Do not place it in
a public/static directory. Never delete/reset the ledger during judging.

Each attempted call durably reserves **8,704 tokens** (8,192 input + 512 output)
before network I/O, even on timeout or failure. The complete UTF-8 request must fit
within 7,168 bytes, leaving 1,024 for model/chat/schema framing; this deliberately
overestimates text tokenization rather than using a character-average estimate.
Provider `max_tokens=512` caps completion; model-specific framing/usage must also
be checked during live acceptance. Responses are capped at 16 KiB and 15 seconds.
The global lifetime limits are at most 1,000 calls and 10,000,000 reserved tokens;
configured lower limits apply. There are also 3 new attempts/minute globally and
2 new attempts/hour/account. No refunds or automatic budget resets occur.
This is a call/token allowance, **not a dollar-denominated billing system**. Choose
the allowance against current provider pricing/credits before enabling.

An exclusive `.lock` serializes ledger reservations on one persistent local volume.
Append plus fsync precedes inference; corruption, missing storage, clock regression
or lock failure stops spending. A hard interruption can leave a lock: keep inference
disabled and inspect it manually after ensuring no process owns it. Never silently
clear a lock or reinitialize a damaged ledger. Rate/budget accounting persists across
restarts. Cache is capped at 1,000 entries. Use one API instance for judging. Ephemeral
disks, independent replica ledgers or unreliable network filesystems are **not** a
supported budget boundary; do not enable inference on those deployments.

## Smallest separately approved live acceptance

1. Use the accepted local database/auth setup and synthetic report. Supply the key
   privately, a fresh private ledger, `NEBIUS_MAX_CALLS=1`,
   `NEBIUS_TOKEN_BUDGET=8704`, the pinned model and enable flag.
2. Load/refresh/navigate: verify no provider call and unchanged deterministic evidence.
3. Click once. Verify one reserved call and a validated, labelled Nemotron result
   (or honest fallback); inspect only sanitized status and aggregate token usage.
   If structured output is rejected, stop; do not retry another model automatically.
4. Repeat click/refresh: no new provider request. Another account must not receive
   the first account's cache, and the global one-call budget must refuse another call.
5. Restart API: no budget reset or automatic new call. Disable generation afterward.

Offline tests use injected fetch responses and isolated temporary ledger files;
they do not establish actual model availability, billing, prose quality or browser
acceptance. No production/paid service is invoked by tests.
