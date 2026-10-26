# Neon hosted baseline v1 — prepared, NOT executed

Target reported by founder: **colli-hackathon / production / neondb / PostgreSQL 17 /
AWS Frankfurt / Free ($0)**. The initial read-only preflight is accepted; do not
repeat it as an architecture exercise. No credentials or actual endpoint are stored here.

## Approval gates and connection

1. Approve ONLY `probe.psql` first. It tests the remaining ownership/privilege
   operations in one transaction and always ends with ROLLBACK. It creates two
   NOLOGIN probe owners and one LOGIN probe role with NULL password (cannot authenticate).
   It exercises database/public-schema ACL authority, column grants, table/function
   ownership transfer, SECURITY DEFINER, role switching, direct-access denial and
   temporary membership removal. No Colli objects or data are involved. Existing
   probe names cause STOP, not reuse. No retry on failure.
2. The probe's included `probe-absence.psql` is a SAME-connection check after ROLLBACK.
   Check its exit status and SQLSTATE on failure. An additional, independently opened
   fresh-connection `probe-absence.psql` check remains mandatory. It verifies probe roles/schema absent AND the original
   database/public-schema ACL fingerprint restored. Save the non-secret baseline
   fingerprint before starting; never infer restoration merely from ROLLBACK output.
3. Review that evidence and separately approve `bootstrap.psql` and its manifest.
   No initialization until the probe passes. No application writers or other deployers.
4. Apply ONCE; fresh administrator verification follows. Privately setting the two
   LOGIN passwords and runtime readiness acceptance are separate approved steps.
   The scripts never contain passwords. Neon console-created roles must NOT be used
   as colli_app, and its role editor must not be used to recreate application roles.

Use installed **psql 17**, direct/unpooled port 5432 with `psql -X -W -f`, not a
pooled hostname, URI with password, SQL-editor paste, or statement-at-a-time execution.
Match the exact endpoint/branch/database/admin in the Neon console before approval.
The scripts cannot independently infer project/region/branch from PostgreSQL catalogs.
The caller-supplied expected host is the independently reviewed console hostname.

Set `PGSSLMODE=verify-full` and `PGSSLROOTCERT` to a verified CA bundle that trusts
Neon's certificate chain (currently Let's Encrypt ISRG Root X1). Never disable
certificate/hostname verification. Start with a clean private console: no PGSERVICE,
PGHOSTADDR, PGOPTIONS or password environment override. `-W` prompts privately; no
password in command history, output, URI, SQL, manifest or diagnostic log. Keep
`ON_ERROR_STOP`, `VERBOSITY=sqlstate`, `-X` and all identity guards intact.
Missing manifest_sha256 in bootstrap, or expected_admin, expected_host or PGSSLMODE
in the connection guard, raises a fixed, non-secret SQL exception.
With the required non-interactive `psql -f`
invocation, ON_ERROR_STOP terminates the entire script/include chain with exit 3;
later statements cannot run. Do not substitute interactive script execution.
The guard clears its cached tls_mode before reading PGSSLMODE, so an old psql
variable cannot conceal a missing environment variable.

Before any ownership probe, check client-side `\conninfo` on the verified direct
connection: require SSL, the expected direct hostname, port 5432, administrator
and neondb. Keep `PGSSLMODE=verify-full` and the trusted `PGSSLROOTCERT` configured
for that connection and subsequent commands; stop on any mismatch or missing SSL.
Neon's proxy can report backend `pg_stat_ssl.ssl = false` despite client TLS.
The administrator and runtime readiness guards therefore do not require backend SSL statistics.
Server-side SQL does not independently prove client certificate verification;
the mandatory libpq configuration and client-side connection check provide that
connection evidence. `\conninfo` alone does not prove verify-full was configured.

Non-secret command templates, **not authorization to run them now**:

```powershell
# From repository root. Fill only non-secret, independently verified identifiers.
$neonHost = '<exact direct endpoint from production branch>'
$neonAdmin = '<existing Neon administrator role>'
$env:PGSSLMODE = 'verify-full'
$env:PGSSLROOTCERT = '<absolute verified CA-bundle path>'
$integrity = node lib/db/hosted/v1/verify-artifacts.mjs | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Artifact verification failed' }

# Before Gate 1: inspect client-side TLS on the direct connection; STOP on mismatch.
psql.exe -X -W -h $neonHost -p 5432 -U $neonAdmin -d neondb -c '\conninfo'
# Check exit status and the SSL/identity output before proceeding. Keep the same TLS configuration.
# Gate 1: only after probe approval; -c runs on the SAME connection before -f.
psql.exe -X -W -h $neonHost -p 5432 -U $neonAdmin -d neondb -v expected_host="$neonHost" -v expected_admin="$neonAdmin" -c '\conninfo' -f lib/db/hosted/v1/probe.psql
# Check $LASTEXITCODE immediately. Save the displayed non-secret baseline fingerprint.
$probeBaseline = '<fingerprint recorded before probe mutations>'
psql.exe -X -W -h $neonHost -p 5432 -U $neonAdmin -d neondb -v expected_host="$neonHost" -v expected_admin="$neonAdmin" -v probe_baseline_sha="$probeBaseline" -f lib/db/hosted/v1/probe-absence.psql

# STOP for evidence review and separate bootstrap approval.
# Re-run offline integrity verification immediately before the approved application.
$integrity = node lib/db/hosted/v1/verify-artifacts.mjs | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw 'Artifact verification failed' }
psql.exe -X -W -h $neonHost -p 5432 -U $neonAdmin -d neondb -v expected_host="$neonHost" -v expected_admin="$neonAdmin" -v manifest_sha256="$($integrity.manifestSha256)" -f lib/db/hosted/v1/bootstrap.psql
# Check exit status. NEVER automatically repeat this command, including after lost connection.
psql.exe -X -W -h $neonHost -p 5432 -U $neonAdmin -d neondb -v expected_host="$neonHost" -v expected_admin="$neonAdmin" -v manifest_sha256="$($integrity.manifestSha256)" -f lib/db/hosted/v1/verify.psql
```

Run each command separately and check its status before continuing. Failed probe
means stop before bootstrap. Failed/ambiguous bootstrap means inspect, never retry.
Use the already installed psql executable's absolute path if it is not on PATH.
No installer, new wrapper, paid plan, API/frontend startup or inference is involved.

## Atomic bootstrap and restricted roles

One administrator connection, one READ COMMITTED transaction, UTC, 10s statements,
2s locks, 15s idle-in-transaction timeout and one deployment advisory lock cover:

| Phase | Authority and effect |
| --- | --- |
| 01 roles | Administrator creates password-less LOGIN migrator/runtime and restricted NOLOGIN owner; database/schema ACLs; admin-owned journal. Reject existing Colli roles/schema, public user objects or custom admin defaults. |
| 02 schema | SET LOCAL ROLE migrator; original 0000–0002 DDL, original five 0003 functions/owner ACLs, established narrow users/sequence grants. Temporary migrator→owner SET membership is removed immediately afterward. |
| 03 runtime grants | Original four 0004 GRANT statements, under each actual object owner. Preserve its ownership/excess-permission checks; replace only local/superuser identity assumptions. |
| 04 auth limits | Original 0005 table, function body and final ACLs. Table created as migrator; function created directly as ops under temporary schema CREATE, then CREATE removed. No restored migrator membership. |
| 05 cleanup | Remove administrator's self-granted temporary SET access; assert exact remaining membership contract. |

All changes, five journal rows, cleanup and catalog assertions commit together.
No intermediate role provisioning commits. This deliberately supersedes the old
multi-connection, separately committed admin-before/admin-after proposal: there is
no need to leave temporary migrator authority outstanding across password prompts.
The migrator remains a distinct SQL owner and future login identity; SET LOCAL ROLE
executes its schema work while session_user remains the verified administrator.
All six function bodies, security settings and final runtime permissions are preserved.
Public-schema USAGE for ops is granted by the administrator; auth-schema USAGE is
granted by its migrator owner. This splits 0003's combined schema grant without
giving the migrator a new grant option on the provider-owned public schema.

**PostgreSQL 17 creator authority:** a non-superuser CREATEROLE administrator gets
an automatic membership for each created role from the bootstrap superuser, with
ADMIN TRUE, SET FALSE, INHERIT FALSE. It cannot revoke that automatic grant itself.
Do not claim these three rows are absent. This procedure explicitly allows ONLY those
three provider-created rows to the verified administrator and rejects any other
remaining incoming memberships. Separate self-granted SET rows are removed using
`GRANTED BY CURRENT_USER`. Neither runtime, migrator nor ops has any outgoing
membership at completion. No elevated runtime, permanent schema CREATE for ops,
direct marker/auth_version runtime writes or internal function execution is added.
The probe must demonstrate this exact provider behavior before bootstrap approval.

LOGIN passwords are initially NULL. After independent acceptance, use separate
private `psql \password` prompts under the authorized administrator to configure
migrator/app, with SCRAM and Neon password requirements. Do not do this in the
bootstrap or include passwords in its evidence. Keep the administrator out of Render.

## Provenance and independent acceptance

`manifest.json` hashes each hosted artifact's exact LF bytes, plus canonical UTF-8/LF
hashes of original 0000–0005 SQL, snapshots and journal. Source commit is d2e406e.
Its statement mappings explain every copied section and changed execution guard.
`verify-artifacts.mjs` only reads/hashes files, never connects or writes. It verifies
all artifacts and source hashes and outputs the exact manifest SHA-256 for psql.
The reviewed Git commit and hash verification are the trust anchor; do not edit files
between verification and execution. Server SQL cannot hash client-side files itself.

`colli_hosted_migrations.journal` records five actual hosted phase IDs, artifact
SHA-256, manifest SHA-256, session_user and time, in the SAME transaction as execution.
The unique phase key rejects duplicates; fresh-state guards reject reapplication.
No Drizzle/local journal rows are fabricated. Local 0004's localhost guard was NOT
executed; only its mapped grant contract was ported. No local migration is edited.
Future hosted migrations must extend this hosted lineage explicitly, not run the
ordinary local migration folder. Retain manifest and execution evidence privately.

`verify.psql`, on a fresh admin connection, checks exact function body fingerprints,
signatures/owners/security/ACLs, role attributes, allowed creator-only memberships,
no temporary membership, table/column grants, schema restrictions, journal hashes,
and measured empty users/sessions/markers/limiter baseline. Compare its structural
column/default/constraint/index output with source snapshots before acceptance.
Body MD5 values are catalog comparison aids; artifact provenance uses SHA-256.

After separately approved private password setup, run `runtime-readiness.psql`
through a fresh direct verified-TLS **colli_app** connection with expected_host.
It uses the exact existing application readiness query unchanged and touches no data.
Keep the same mandatory verify-full and trusted CA settings. Before readiness,
inspect client-side `\conninfo` for SSL and the expected direct host, port 5432,
neondb and colli_app identity; stop on mismatch. Backend SSL statistics cannot
establish client certificate verification through the Neon proxy.

```powershell
# Only after independent bootstrap acceptance and approved private password setup.
psql.exe -X -W -h $neonHost -p 5432 -U colli_app -d neondb -c '\conninfo'
# Check exit status and SSL/identity output before readiness; retain the same TLS settings.
psql.exe -X -W -h $neonHost -p 5432 -U colli_app -d neondb -v expected_host="$neonHost" -c '\conninfo' -f lib/db/hosted/v1/runtime-readiness.psql
```

No successful hosted runtime readiness, login or limiter concurrency is claimed by
offline checks. Targeted live limiter concurrency/persistence and hosted HTTPS
acceptance remain subsequent gates; do not repeat historical Group A/B tests.

## Failure and interruption

ON_ERROR_STOP with `-f` exits on SQL errors; disconnect rolls back an uncommitted
transaction. Server idle timeout bounds an abandoned open transaction. A client
finally handler is not a hard-interruption guarantee. If connection outcome is
unknown, keep services off and use a fresh approved read-only connection to establish
whether the transaction rolled back or committed. Never replay or run ad hoc cleanup.
After rollback: no new roles/schemas/journal, original ACLs unchanged. After commit:
verify the full installed state and all five journal hashes. Mixed state or remaining
SET membership is a SECURITY BLOCKER; preserve evidence and seek separate repair approval.
Do not drop roles/data to make a rerun pass. No recovery SQL is authorized here.

References: [Neon roles](https://neon.com/docs/manage/roles),
[PostgreSQL 17 creator memberships](https://www.postgresql.org/docs/17/role-attributes.html),
[ownership](https://www.postgresql.org/docs/17/sql-alterfunction.html),
[Neon direct connections](https://neon.com/docs/connect/connection-pooling),
[verified TLS](https://neon.com/docs/connect/connect-securely).
