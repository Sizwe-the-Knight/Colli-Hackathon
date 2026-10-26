# Neon Free hosted initialization proposal v1 — NOT authorized to apply

**Concrete successor:** [hosted/v1/RUNBOOK.md](hosted/v1/RUNBOOK.md) and its hashed
SQL artifacts now implement this proposal for the founder's Neon Free PostgreSQL 17
project. They are prepared only. The founder's initial read-only preflight passed;
the reversible privilege/ownership probe and actual initialization remain UNVERIFIED.
The successor uses one atomic administrator transaction with explicit owner-role
switching, replacing the separate provisioning/schema/cleanup commits below. It
also explicitly distinguishes PostgreSQL 17's unavoidable creator ADMIN-only rows
from temporary SET/INHERIT access. The historical proposal below is retained for
context; use only the successor's ordered procedure after separate approval.

Zero-dollar target: Render Free Node + Neon Free PostgreSQL. No Railway plan or
paid storage is approved. Official role reference (checked 2026-10-24):
https://neon.com/docs/manage/roles . Neon console/API roles inherit neon_superuser;
that role is NOT true PostgreSQL superuser. Application roles must instead be
created with controlled SQL and no elevated memberships.

First run the separately approved read-only `hosted/neon-capability-checks.sql`
against an explicitly matched Neon database/administrator using direct TLS. Results
are capability indicators, not proof that ownership transfer is allowed. Before
real provisioning, separately approve a single transaction with uniquely named
NOLOGIN probe roles/schema/table/function: verify CREATE ROLE, temporary SET TRUE /
INHERIT FALSE / ADMIN FALSE membership, SET ROLE, ALTER TABLE/FUNCTION OWNER,
column grants, SECURITY DEFINER with restricted search_path, and revocation.
ROLLBACK and independently verify no probe objects or memberships remain. Do not
attempt that probe or actual bootstrap in this session. Any unsupported operation
is a hard compatibility gate, not permission to use an elevated runtime.

## Decision

Use an explicitly separate **hosted baseline lineage**, not a forged application of
local migration 0004. Leave 0000–0004, their snapshots/journal and installed local
history byte-for-byte unchanged. Do not point ordinary local Drizzle migrate() at
the hosted database. A new local 0005 cannot solve this: pending 0004 fails first.

Migration 0005 now separately prepares PostgreSQL-backed authentication limits.
It is NOT applied. Its generated table/snapshot and reviewed function/ACL statements
are a source for a truthful `hosted-v1-auth-limits` phase after hosted runtime grants.
Do not execute the local folder on Neon or insert a fictional local 0005 entry.

The next approved bootstrap implementation will produce one checked-in artifact
directory `lib/db/hosted/v1/` with a provenance manifest and role-specific phases.
This document specifies the artifacts; none are executed or supplied as a bypass.

## Provider capability gate — verify, do not assume

Require PostgreSQL 17-compatible role membership options (SET/INHERIT/ADMIN),
PL/pgSQL, JSON, advisory/row locks, transaction settings and ordinary schemas.
An authorized administrative identity must be able to create restricted roles,
grant temporary SET membership, transfer function ownership, and grant privileges
on objects owned by both colli_migrator and colli_auth_ops. True superuser is not
assumed or inherently needed for these ordinary ownership operations, but the
provider must demonstrate equivalent required authority with approved narrow probes.
Provider-internal system roles are not application memberships.

Do not use a provider-created elevated default role as colli_app. Neon-created
console roles may inherit neon_superuser; create the runtime via controlled SQL
with no memberships. Railway administrative capabilities remain unverified too.
If the provider prevents the exact owner/ACL model, STOP. Do not replace definer
functions with an elevated runtime or loosen readiness to conceal incompatibility.

## Exact artifacts and provenance contract for approval

1. `manifest.json`: hosted lineage ID `colli-hosted-v1`, PostgreSQL target version,
   SHA-256 of every local 0000–0004 source file plus local journal, SHA-256 of each
   NEW hosted phase, and an explicit mapping of each copied statement/function.
   Record that local 0004 was NOT executed; only its reviewed grants were ported.
2. `admin-before.sql`: fresh dedicated hosted database/identities are supplied by
   operator, never inferred. Fail on existing application objects/roles unless
   separately inspected. Create LOGIN colli_migrator/colli_app without elevated
   attributes; NOLOGIN colli_auth_ops with the exact 0003 restricted attributes.
   Apply reviewed database CONNECT/PUBLIC restrictions. Grant migrator only temporary
   SET TRUE, INHERIT FALSE, ADMIN FALSE membership. Private password handling stays
   outside checked-in SQL. Record provisioning completion separately from schema.
3. `schema.sql`: under colli_migrator, reproduce 0000–0002 schema/registration
   permissions and the five exact 0003 function bodies/security configurations,
   ownership transfers and PUBLIC revocations. Include the pre-existing initial
   restricted SELECT/provider UPDATE/sequence USAGE grants that were originally
   provisioned outside migration SQL. No data rows, session fixtures or runtime
   access expansion. Schema guards check explicit hosted identity/target and expected
   owners/ACLs, not localhost. Compare function bodies to original source hashes.
4. `admin-after.sql`: remove temporary membership after schema success OR failure;
   independently verify absence before continuing. Hard interruption instructions
   must name this exact cleanup; a finally handler is not a guarantee.
5. `runtime-grants.sql`: under the verified hosted administrator, reproduce the
   **four GRANT statements** of 0004 exactly. Preserve all role, ownership and excess
   authority predicates; replace the local-only identity/transport guard with an
   explicit hosted target/administrator allowlist and verified secure connection.
   Do not require or silently grant runtime membership, schema CREATE, direct marker
   writes, auth_version writes or internal-function execution.

## Truthful versioned journal and transactions

Use a new dedicated restricted journal (proposed schema `colli_hosted_migrations`),
not Drizzle's local 0000–0004 journal. Record `hosted-v1-schema` and
`hosted-v1-runtime-grants`, each with actual executed artifact SHA-256, manifest
SHA-256 and application time. Each phase's SQL and its journal insert commit in
the SAME transaction. Entries identify actual hosted artifacts, not hashes of
unexecuted local SQL. Unique phase IDs reject duplicates; mismatches/partial states
STOP without repair/retry. Admin provisioning/cleanup are separate verified phases.
Journal has no runtime privileges. Ownership/admin rights must permit the two
authorized writers without granting the app anything additional.

Use UTC, READ COMMITTED, statement_timeout=10s, lock_timeout=2s and
idle_in_transaction_session_timeout=15s as in the reviewed local workflow. A single
controlled migrator must hold an advisory deployment lock across database phases.
Do not execute statement-by-statement in autocommit. Passwords are never journaled.

Future schema releases MUST explicitly target this hosted lineage and verify its
manifest/journal. The local Drizzle folder is not automatically a hosted upgrade
path; adding a truthful hosted baseline is preferable to pretending 0004 ran.
This lineage choice and the concrete artifacts need owner review before execution.

## Independent acceptance / rollback

Fresh admin and runtime connections must verify target identity, server version,
expected empty user/session/marker baseline, table constraints/indexes, five exact
function definitions/signatures/owners/settings, effective PUBLIC/inherited grants,
and removed migrator membership. Run all six existing session-readiness checks as
colli_app unchanged, plus registration/provider privilege checks and hosted journal
hash verification. Do not repeat the completed local concurrency test suite.

Before first activation, failed transactional phases roll back; existing committed
phases remain recorded. Remove temporary membership, leave API stopped, and report
the exact state. No automatic role drops, destructive schema rollback or false
journal entries. After users exist, recovery requires a separately approved plan
and backup; never initialize over a populated database.

Remaining hard gate: actual provider capabilities, secure connection identity and
review/implementation of these artifacts. This proposal alone is not deployment
authorization and does not make migration 0004 portable.

## Concrete authentication-limit phase (0005)

- Table `auth.auth_attempts`: `(kind varchar(8), network varchar(64))` primary key,
  `expires_at timestamptz`, `attempts integer`, all NOT NULL. CHECK constraints limit
  kind to login/register, network to a SHA-256 hex key or global `*`, counts to 1–200.
  Owned by colli_migrator. colli_app has ZERO table/column access.
- `auth.consume_auth_attempt(text,text)` is SECURITY DEFINER owned by existing
  NOLOGIN colli_auth_ops, with `search_path=pg_catalog,pg_temp`, UTC. It accepts no
  user/session ID, arbitrary limit, cutoff or clock. It returns only retry seconds.
- Owner gets DML on this new counter table only. Runtime receives only EXECUTE.
  PUBLIC execution is revoked. No session function definition/grant changes,
  runtime memberships, direct marker writes or auth_version changes.
- Administrator must have independently verified SET authority for both existing
  owners and schema grant authority. This is temporary deployment authority for
  the administrator, NEVER membership of migrator in auth_ops. The schema CREATE
  grant needed to transfer the new function is removed in the same transaction.
  Remove newly provisioned administrative memberships after all phases and verify.
- Two transaction-scoped advisory locks (one per endpoint) serialize global plus
  client reservations. Database clock is read AFTER waiting. The bounded API
  transaction commits before authentication work; failure never admits/retries.
  Different processes share committed counters, so Render restart cannot reset them.
- Add a unique `hosted-v1-auth-limits` journal row with actual hosted SQL/manifest
  hashes in the SAME transaction. Manifest maps 0005 source hash and generated
  table DDL. No invented local migration entries. Exact hosted artifacts still need
  approval/implementation; this remains a proposal, not executable provisioning.
- Independently check effective ACLs, constraints/function definition, all prior
  session/registration grants and the additional auth_limits_ok readiness flag.
  Live two-connection limiter tests (same-network and global cap) are mandatory
  before public registration; offline mocks do not prove PostgreSQL locking.

For the existing local lineage only, 0005 can later be executed transactionally by
the authorized local administrator with exactly one Drizzle journal entry after
independent identity checks. It has a capability guard, not a superuser assumption.
Missing 0005 deliberately blocks startup/readiness of this new source checkpoint.
