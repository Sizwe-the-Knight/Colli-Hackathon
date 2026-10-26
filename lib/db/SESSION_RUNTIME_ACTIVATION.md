# Persistent-session activation checkpoint

0004 is prepared, not applied. The API's unconditional startup stop remains in
`artifacts/api-server/src/app.ts`. There is no environment override or MemoryStore
fallback. Offline checks do not establish live PostgreSQL or browser acceptance.

## Apply grants only after separate approval

0004 contains exactly the four runtime GRANT statements reviewed in
`SESSION_REVOCATION_REVIEW.md`. Users/sequence privileges are unchanged. No schema
creation, owner membership, direct marker writes, auth_version writes, internal
function execution, or grant options are added.

`colli_migrator` owns the tables but cannot grant EXECUTE on functions now owned by
`colli_auth_ops`. This migration therefore requires the authorized administrator
`colli_bootstrap`, using the existing transactional Drizzle `migrate()` workflow.
It neither restores migrator membership nor runs individual statements in autocommit.
The SQL guard restricts this prepared application to `colli_dev_disposable` at
127.0.0.1:55432. Production identities/deployment remain a separate approval.

Before application, keep all application writers stopped. Authenticate privately;
independently check current/session identities, PostgreSQL 17.11, target address,
exact journal hashes/timestamps for 0000–0003, absent 0004, reviewed ownership and
effective ACLs, no temporary memberships, original four-user/provider baseline and
zero session/marker rows. Stop on partial/unexpected state. Bootstrap currently needs
separately approved temporary HBA access to this database: only the established
loopback SCRAM rule, original backup/hash, and byte-for-byte restoration, reload and
independent rejection check afterward. Do not invoke historical execution runners.

Use UTC, READ COMMITTED and the established bounded timeouts. Run Drizzle once with
0004 as the only pending migration; its four grants and journal entry must commit
together. Verify actual effective column/table/schema/function privileges as
`colli_app`, ownership/membership absence, unchanged data and journal afterward.
No automatic retry or repair on error. Restore HBA and stop PostgreSQL regardless
of outcome. This session authorizes none of those live operations.

## Readiness and future startup

`/healthz` reports process liveness before session middleware. `/readyz` returns
process, database and session readiness separately, using a bounded read-only
transaction. A reachable database alone is insufficient: the runtime identity,
UTC connection setting, effective required/forbidden privileges, session table
layout, and all five functions' ownership/security configuration/ACLs must match.
Zero-row reads verify the required columns are accessible without reading session
data. Errors return 503 with sanitized status fields; failed rollback discards the
connection. Missing permissions/objects never create tables or trigger repairs.

After separately approved removal of the hard stop, startup must await store
initialization before listening. Initialization uses the same readiness check;
failure closes the pool, sets a failing exit status and does not listen. Checks are
observations, not a permanent guarantee: protected requests and guarded writes
continue checking account/version/expiry/markers and fail closed on later outages.
The catalog query itself and effective permissions still require live validation.

The store disables automatic table creation, stock touch, and automatic pruning.
No marker-cleanup endpoint or scheduler is activated by these grants. Bounded
cleanup invocation/scheduling requires a subsequent explicit operational decision.

## Remaining live acceptance and rollback

After approved grant application/verification, approve a separate contained local
activation change and test only disposable synthetic accounts: registration and
duplicates, login/rotation, provider persistence, API restart persistence, two-device
current logout versus revoke-all, stale/deleted-account rejection, idle/absolute
expiry, delayed writes, store/DB outage readiness, and browser error/retry behavior.
Confirm ordinary refresh does not extend absolute or idle deadlines; no original
accounts may be modified. Finish with exact-fixture cleanup and service shutdown.

On a failed activation keep the API stopped. Do not fall back to MemoryStore or
deploy code ignoring revocation. Retain additive schema and active markers. If
permissions must be withdrawn, prepare a separately approved administrator
transaction revoking only 0004's grants; do not rewrite journal history or drop
security functions/data. No automatic rollback SQL is executed.
