# Hosted synthetic narration — prepared additive upgrade

**Not applied or enabled by this commit.** No hosted settings or historical
acceptance files are changed. This is a separate hosted upgrade, not a rewrite of
Drizzle 0000–0005 or hosted-v1 bootstrap history. The new table is intentionally
managed by this SQL upgrade, not Drizzle push/schema synchronization. Do not run
`drizzle-kit push`, rerun hosted-v1 bootstrap, or fabricate Drizzle journal entries.

## Release gate

1. Keep `NEBIUS_NARRATION_ENABLED=false`. Review the three new SQL/psql files.
   Run the existing offline hosted-v1 artifact verification. Compute SHA-256 of
   the **actual bytes** of `001_narration_quotas.sql` and retain that hash with the
   release evidence. Use that exact file during execution; do not edit it afterward.
2. Use the established **direct/unpooled** Neon administrator connection to `neondb`,
   PostgreSQL 17, with `PGSSLMODE=verify-full` and the trusted CA. Check `\conninfo`
   for client TLS first. SQL cannot prove client certificate verification, and
   Neon's backend `pg_stat_ssl` does not represent its proxy TLS. Never put the
   administrator credential in Render. The existing administrator must retain its
   provider-created ADMIN-only authority for the two owner roles. The wrapper adds
   self-granted SET-only access inside the transaction and removes it before COMMIT,
   preserving the original ADMIN-only rows. It never grants the runtime or migrator
   any role membership. Connection loss rolls back these uncommitted changes too.
3. In a separately authorized deployment, execute `apply.psql` through `psql -X -f`
   with `ON_ERROR_STOP` (already set in the file), the existing `expected_admin`
   and `expected_host` variables, `manifest_sha256` set to the **original hosted-v1
   manifest hash recorded during installation**, and `narration_sha256` set to the
   measured lowercase file hash. Password entry remains private. The wrapper checks
   the original five journal rows, rejects pre-existing narration objects, and runs
   the additive SQL, permission assertions and a separate provenance insert in ONE
   transaction. Its `colli_hosted_migrations.narration_v1` row records the actual new
   file hash and executor; no historical journal row is changed. Any error rolls
   back on disconnection. Do not retry an ambiguous outcome; inspect it read-only.
4. On a **fresh** verified administrator connection, `BEGIN READ ONLY`, include
   `verify.sql`, compare its recorded artifact hash with the reviewed file, and
   `ROLLBACK`. Confirm the installer reported zero initial narration reservations, unchanged historical
   migration rows and unchanged existing users/security records. As `colli_app`,
   verify the three function EXECUTE privileges and absence of direct table/column
   grants. A no-inference, rolled-back reservation/save/read check with a fixed
   synthetic key can verify behavior before activation; it must not send HTTP.
   Live PostgreSQL syntax, permissions and concurrency are not proved by mock tests.
5. Only after those checks pass, deploy the application code and set the variables
   below. Test hosted GET/refresh without spending. Any later genuine POST requires
   the founder's deployment/inference approval. Never run the old database-fixture
   acceptance harness. No local PostgreSQL is needed for this release gate.

## Render variables (values are configuration, never API-key contents)

```dotenv
NEBIUS_NARRATION_ENABLED=true
NEBIUS_BUDGET_BACKEND=postgres
NEBIUS_MODEL=nvidia/Nemotron-3_5-Lightning
NEBIUS_MAX_CALLS=100
NEBIUS_TOKEN_BUDGET=870400
```

Supply `NEBIUS_API_KEY` privately as a backend secret. Remove/leave unset
`NEBIUS_BUDGET_FILE` on Render. Keep the existing restricted `colli_app`
`DATABASE_URL`, verified Neon TLS, session secret, origin and proxy settings unchanged.
Do not put any variable in `VITE_*`. Production rejects file-backed inference.
The feature remains off by default or when configuration is invalid. Database/store
failure returns deterministic wording without a new request.

`NEBIUS_JUDGE_ACCOUNT_IDS` is an optional comma-separated list of existing numeric
Colli account IDs, designated by the founder **server-side**. Obtain the intended
judge IDs through a narrowly authorized administrative lookup after their normal
registration; do not accept IDs from a public request, publish them in Devpost, or
use an email-domain heuristic. With an empty list the 20 judge slots remain reserved
and unused; the public 80 cannot consume them. Judges can initially use public
capacity and be designated later. No special account type, shared password or new
authentication flow is introduced. Each account still has at most three attempts
across all fingerprints and both allocations. Keep judge designation and existing
credits available through **December 15, 2026**. There is no date expiry in code.

## Guarantees and limits

- 100 additional hosted attempts maximum: 80 public and 20 judge-reserved, each
  reserving 8,704 tokens before HTTP (maximum 870,400). Historical local acceptance
  reservations remain untouched and are **not** counted as free/refunded usage.
- Three lifetime attempts/account; two/hour/account and three/minute globally.
  The database's single transaction lock serializes quota checks across instances.
  The function commits before returning to native fetch. Errors or uncertain
  commits never authorize fetch; a crash after reservation consumes capacity.
- One attempt per account/report fingerprint, including failures. No retry or
  refund path. Accepted wording is stored once and revalidated on reuse. Refresh,
  login, Dashboard navigation and repeated POST for the same report do not spend.
- Runtime gets only EXECUTE on reserve/read/save. No direct table DML, counter reset,
  DELETE, role membership, auth-version write or schema CREATE. Public function
  execution is revoked. No authentication/session function is changed.
- The route accepts only the server-produced synthetic report fingerprint; no
  client report, prompt, judge flag or account ID is accepted. Only bounded synthetic
  findings/evidence hashes reach Nebius, never user/provider/session details.
- The token cap is not a dollar or credit balance. Free hosting, credits and provider
  availability are external constraints. Reserved judge capacity cannot guarantee
  unlimited generations; previously accepted results and deterministic copy remain
  usable when allowance is spent. Do not reset accounting to extend access.

Rollback/containment: set generation **false** and remove the hosted key if needed.
Keep reservations, cached results and upgrade provenance intact. Do not drop tables,
refund uncertain calls or revert real user data. Missing upgrade objects fail closed
for narration; the deterministic Brief continues to work.
