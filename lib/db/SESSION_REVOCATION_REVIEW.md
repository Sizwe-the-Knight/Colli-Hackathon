# Restricted session revocation — Session 2M-J

PREPARED, NOT APPLIED. No PostgreSQL connection, role provisioning or SQL execution
occurred in this session. Migration 0003 is custom SQL; Drizzle snapshots describe
tables, not these functions or their ACLs. The SQL and adversarial PostgreSQL tests
must be reviewed together before application. Existing runtime behavior is unchanged.

## Execution order (separate approval required)

1. Stop application writers. Privately connect and independently verify the intended
   database/role/host/port; for the disposable database use colli_migrator,
   colli_dev_disposable, 127.0.0.1, 55432. Verify journal 0000–0002 hashes/timestamps,
   schema, four-user integrity baseline, empty session/marker tables, and absence
   of 0003/functions/owner role. Stop on partial application or unexpected state.
   Review PUBLIC, inherited, default and grant-option privileges and table/schema
   ownership, including function-language privileges. Ensure no untrusted CREATE
   on public/auth and no runtime ability to SET ROLE to any privileged owner.
2. Administrator runs `admin/0003_before.sql` on the maintenance database through
   the existing private bootstrap connection. This creates a cluster-wide NOLOGIN
   role with no password and only a temporary, non-inherited SET ROLE membership
   for colli_migrator. It does not require expanding bootstrap HBA access to the
   application database. A pre-existing role causes failure, not automatic reuse.
3. As colli_migrator, apply 0003 ONCE using the existing Drizzle `migrate()` workflow,
   never push. Use READ COMMITTED, UTC, statement_timeout=10s, lock_timeout=2s,
   idle_in_transaction_session_timeout=15s. Installed Drizzle ORM executes pending
   statements and the journal insert in one transaction. Do not execute the file
   statement-by-statement with autocommit. Role provisioning is a separate admin
   transaction, not atomic with this migration.
4. In that migration, grant the restricted owner's required data privileges, create
   five functions, and revoke PUBLIC/colli_app function access immediately.
   Temporarily grant the new owner auth
   CREATE, transfer all five functions, then revoke CREATE before commit. Existing
   users, session and marker tables remain owned by colli_migrator. No runtime
   grants or registration-grant changes are included.
5. Administrator runs `admin/0003_after.sql` after success OR failure to remove
   the temporary membership. Independently verify membership absence, function
   ownership/ACLs/configuration, schema privileges, unchanged user data and journal.
   If the migration fails, leave runtime stopped, retain evidence, remove membership
   and report; do not retry, drop roles/objects, or improvise a repair.
6. Test with isolated synthetic fixtures under separately approved PostgreSQL
   verification. Runtime still has no function EXECUTE or auth schema/table access.
   Migrator can prepare fixtures and grant narrowly scoped test EXECUTE inside a
   rolled-back test transaction using an administrator-approved mechanism; it must
   not regain owner membership silently. Review the live test harness separately.
7. Runtime permissions and application activation are separate future sessions.
   Keep production's MemoryStore rejection. No production activation follows
   automatically from a passing database migration test.

The owner transfer prerequisites and safe SECURITY DEFINER rules follow PostgreSQL
17 documentation: [ALTER FUNCTION](https://www.postgresql.org/docs/17/sql-alterfunction.html),
[GRANT](https://www.postgresql.org/docs/17/sql-grant.html), and
[CREATE FUNCTION](https://www.postgresql.org/docs/17/sql-createfunction.html).

## Functions and data contract

Only `revoke_current_session(text)` and `revoke_all_sessions(text)` will eventually
be callable from authenticated API handlers. Their sole parameter is the SID from
verified server-side session handling, never a request body/query account ID or SID.
Both are SECURITY DEFINER, with `search_path=pg_catalog,pg_temp` and `timezone=UTC`.
Internal `_session_identity(json,timestamp,timestamptz)` and
`_revoke_session(text,boolean)` are SECURITY INVOKER and remain private. The same
restricted role owns all five functions; no wrapper runs as migrator/bootstrap.
There is no dynamic SQL or arbitrary target-user operation.

Persisted security metadata is defined here for future runtime implementation:

- `userId`, `authVersion`: canonical positive JSON integers in PostgreSQL int range.
- `issuedAt`, `lastActivityAt`, `absoluteExpiresAt`: canonical positive JSON integer
  epoch milliseconds, at most 13 digits. `absoluteExpiresAt = issuedAt + 604800000`.
  issuedAt and absoluteExpiresAt are immutable for a SID. No SID reuse, including
  after seven days. Fresh login always rotates to a new unpredictable SID.
- `lastActivityAt >= issuedAt`, no future times; `now < lastActivityAt + 86400000`
  and `now < absoluteExpiresAt`. Equality is expired. Security uses DB time after
  lock waits; it never uses transaction-start time or a caller-supplied cutoff.
- Optional object `cookie` and optional numeric `reauthenticatedAt` within
  [issuedAt,now]. The latter grants no extra privilege here; future sensitive
  operations need a separately reviewed recent-password-verification policy.
- Duplicate keys, unknown top-level keys, strings in numeric fields, nulls,
  fractions, unsafe ranges and legacy userId-only sessions fail closed. No password,
  provider credential or telemetry field is permitted by this whitelist.

`expire` is interpreted explicitly as UTC despite being timezone-less. It must be
finite and in the future, and cannot exceed the rounded minimum of idle/absolute
deadlines. connect-pg-simple rounds to whole seconds; independent millisecond
checks prevent its inclusive GET boundary from extending authorization. Cookie
attributes are not authorization evidence. UTC must also be configured and verified
on every future store connection; the functions' SET timezone does not fix the pool.

Operation results:

- `revoked`: valid persisted identity/account/version; marker written; current
  session row removed. Revoke-all additionally increments auth_version once.
- `already_revoked`: an active marker exists; no version increment or marker change.
  This is idempotent revocation status, never proof of authentication.
- `invalid_session`: no valid persisted identity/account relationship. A correctly
  formatted SID is conservatively quarantined for seven days, but no account version
  is changed and no authentication is granted. Invalid SID syntax causes no writes.
- Database exceptions, deadlocks, timeouts and auth_version exhaustion propagate.
  No catch converts failures into success. API handlers must await COMMIT and return
  a sanitized unavailable response on failure, never raw SQL/JSON/SID/error context.

An `invalid_session` result is a normal return, not an exception: commit its
conservative quarantine before returning an unauthenticated response. Do not roll
that marker back merely because the HTTP result is 401. Never interpret either
`invalid_session` or `already_revoked` as proof of an authenticated account.

Malformed or absent metadata cannot provide a trusted remaining lifetime. The
conservative policy therefore retains ALL new markers for a full 168 hours from
revocation. This also covers valid sessions' remaining absolute lifetime. Active
markers are never shortened or refreshed; expired markers alone may be replaced
with a fresh seven-day quarantine. This fits 0001's unchanged retention constraint.

`cleanup_revoked_sessions()` is SECURITY DEFINER, argument-free, uses database
statement time, selects at most 100 expired rows with FOR UPDATE SKIP LOCKED, and
rechecks `retain_until <= cutoff` in DELETE. It returns only a count. No early cutoff,
SID or batch size can be supplied. Repeated calls can eventually clean all expired
rows; per-call bounding is not rate limiting. Runtime has no direct marker mutation.

## Transactions, concurrency and trust boundary

The operation reads a candidate identity, locks the account FOR UPDATE, locks and
re-reads the SID row, revalidates metadata and account version, and rechecks the
marker. It creates the marker before changing the account version or deleting the
SID, all in the caller's transaction. Integer overflow raises before writes; it
never wraps or resets auth_version. Revoke-all invalidates other devices by version
comparison without deleting their rows, avoiding a broad deletion racing new login.

Concurrent same-account revocations serialize on the account lock. A second old SID
fails version comparison after the first increment. Duplicate same-SID revocation
finds a marker. Neither can increment the new version and invalidate a later login.
Marker UPSERT and cleanup use row locking; cleanup cannot delete a marker whose
deadline was safely replaced with a future deadline. Live race verification remains
mandatory; static tests do not prove these PostgreSQL concurrency claims.

Future login issuance, identity-changing writes, and protected mutations must lock
the same account first, then SID, then marker, revalidate inside the transaction,
and hold locks until the protected change commits. Never wait for an account lock
while holding a SID lock. Login must re-read auth_version under that lock. Stock
connect-pg-simple uses pool.query, not a caller transaction; future integration needs
an explicit transaction strategy for issuance/mutations, not an assumption that an
outer HTTP middleware check makes later writes atomic. Already completed requests
cannot be undone. This session does not implement that runtime strategy.

Late stock-store UPSERTs can recreate a deleted SID row. Such rows remain unusable
because every protected request must check markers, exact expiry, account existence
and version. After marker cleanup the immutable absolute deadline has passed. Never
promote stale authVersion or reset issuedAt during touch/save. The functions alone
do not enforce future middleware behavior; runtime activation is blocked until that
contract is implemented and tested. Normal rotation needs the same old-SID marker
protection as logout; store.destroy alone is insufficient.

PostgreSQL does NOT verify Express's signed browser cookie. Shared colli_app
credentials can read/write session rows once store grants are approved; a compromised
backend could impersonate another session or forge JSON. These functions reduce
ordinary runtime authority, not total-backend-compromise risk. Protect SQL inputs,
database credentials and logs; never accept a browser-provided SID as authorization.
No SID, session JSON, passwords, hashes or SQL bindings may appear in production logs.
Seven-day marker safety assumes late writes originate from legitimately issued,
immutable session metadata. It cannot protect against a compromised DB credential
rewriting issuedAt into the future or inventing another SID; that is the shared-role
trust limitation, not a promise these SQL functions can enforce on arbitrary writers.

## Privileges: prepared owner grants and future runtime grants

| Identity | users | sessions | revoked_sessions | Functions/schema |
| --- | --- | --- | --- | --- |
| colli_auth_ops (NOLOGIN) | SELECT(id,auth_version), UPDATE(auth_version) | SELECT, DELETE, UPDATE(expire) for row locks | SELECT, INSERT, DELETE, UPDATE(revoked_at,retain_until) | Owns only these five functions; USAGE public/auth; no enduring CREATE or memberships |
| colli_migrator | Existing table ownership | Existing table ownership | Existing table ownership | Creates/hands off functions; temporary SET membership removed by admin |
| colli_app after 0003 | Existing SELECT, INSERT(email,name,password_hash), UPDATE(providers,updated_at), sequence USAGE unchanged | None added | None added | None added; no membership or EXECUTE |
| colli_app FUTURE ONLY | Unchanged | SELECT, INSERT(sid,sess,expire), UPDATE(sess,expire), DELETE | SELECT(sid,retain_until) only | auth USAGE; EXECUTE on two wrappers and separately approved bounded cleanup only |

Owner UPDATE(expire) permits SELECT FOR UPDATE on sessions; the SQL does not extend
sessions. Marker UPDATE columns enable expired-row replacement and cleanup locks.
Owner does not receive users password/email access, sequence access, table ownership,
grant options, role creation, login, superuser, or bypass-RLS rights.

Exact proposed future store grants, NOT included in 0003 and NOT AUTHORIZED to run:

```sql
GRANT USAGE ON SCHEMA auth TO colli_app;
GRANT SELECT, INSERT (sid, sess, expire), UPDATE (sess, expire), DELETE
  ON auth.sessions TO colli_app;
GRANT SELECT (sid, retain_until) ON auth.revoked_sessions TO colli_app;
GRANT EXECUTE ON FUNCTION auth.revoke_current_session(text),
  auth.revoke_all_sessions(text), auth.cleanup_revoked_sessions() TO colli_app;
```

Installed connect-pg-simple 10.0.0: get SELECTs sess with sid/expire predicates;
set INSERTs sess/expire/sid with conflict UPDATE(sess,expire) RETURNING sid;
touch UPDATEs expire RETURNING sid; destroy DELETEs one SID; prune DELETEs expired
sessions using `<` and application time. DELETE is table-level in PostgreSQL; stock
store compatibility does require it on sessions, never on revoked_sessions.
No new table/sequence or CREATE grant is needed. Keep createTableIfMissing=false.
Use disableTouch=true until accepted-activity saving updates lastActivityAt and caps
expiry correctly; stock touch alone does not maintain this contract. Pruning is
garbage collection, not authorization, and marker cleanup is a separate operation.

## Verification and rollback gates

Offline tests inspect exact definitions, grants, public access removal, lock/order
guards, malformed-input defenses, expiry/version bounds and cleanup predicates.
The generated snapshot must be schema-identical to 0002 and linked to it. Existing
schema generation must remain unchanged. Historical SQL/snapshots are preserved.
There are no application TypeScript/build changes to validate in this migration.

Actual PostgreSQL tests remain UNVERIFIED: compile/execute all definitions on 17.11;
test owner handoff and effective direct/PUBLIC/inherited/default ACLs; two-device
revocation and fresh login; duplicate logout; stale writes before/after marker
expiry; malformed/duplicate/null/oversized metadata; missing accounts; exact
idle/absolute/UTC/DST boundaries; integer overflow; two-connection lock races and
deadlocks; cleanup batch/active-marker preservation; exceptions and transaction
rollback (no partial version/marker writes); runtime denial of direct auth_version
and marker mutations; unchanged narrow registration and provider updates.

Do not call source-inspection tests SQL execution tests. Do not activate sessions
until these live tests and runtime integration tests pass. On failed application,
transaction rollback should leave no functions/grants/journal entry; verify rather
than assume. Admin membership cleanup is separate and still required. After a
successful deployment leave additive objects in place when rolling back application
code; remove future EXECUTE grants if needed under explicit approval. Once revocation
is active, never deploy code that ignores markers/versions or erase active markers.
