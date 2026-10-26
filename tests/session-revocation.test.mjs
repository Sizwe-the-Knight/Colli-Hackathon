import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

// Static security-contract checks only. No DB module, SQL engine, network or
// credential loading. PostgreSQL behavioral tests are explicitly skipped below.
const dbRequire = createRequire(path.resolve('lib/db/package.json'));
const { generateMigration } = dbRequire('drizzle-kit/api');
const { readMigrationFiles } = dbRequire('drizzle-orm/migrator');
const folder = path.resolve('lib/db/drizzle');
const read = file => fs.readFileSync(path.join(folder, file), 'utf8');
const sql = read('0003_restricted_session_revocation.sql');
const before = fs.readFileSync('lib/db/admin/0003_before.sql', 'utf8');
const after = fs.readFileSync('lib/db/admin/0003_after.sql', 'utf8');
const normalize = value => value.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim();
const functions = [...sql.matchAll(/CREATE FUNCTION auth\.(\w+)\(([^)]*)\)([\s\S]*?)AS \$function\$([\s\S]*?)\$function\$;/g)];
const fn = name => {
  const result = functions.find(match => match[1] === name);
  assert.ok(result, `Missing ${name}`);
  return { args: result[2], header: result[3], body: result[4] };
};
const identity = fn('_session_identity').body;
const revoke = fn('_revoke_session').body;
const cleanup = fn('cleanup_revoked_sessions').body;
const ordered = (source, ...parts) => {
  let index = -1;
  for (const part of parts) {
    const next = source.indexOf(part, index + 1);
    assert.ok(next > index, `Missing or out-of-order guard: ${part}`);
    index = next;
  }
};

test('offline: custom 0003 preserves the generated table snapshot and journal chain', async () => {
  const previous = JSON.parse(read('meta/0002_snapshot.json'));
  const current = JSON.parse(read('meta/0003_snapshot.json'));
  assert.equal(current.prevId, previous.id);
  assert.notEqual(current.id, previous.id);
  const { id, prevId, ...schema } = current;
  const { id: oldId, prevId: oldParent, ...oldSchema } = previous;
  assert.deepEqual(schema, oldSchema);
  assert.deepEqual(await generateMigration(previous, current), []);
  const journal = JSON.parse(read('meta/_journal.json'));
  assert.equal(journal.entries.length, 5);
  assert.equal(journal.entries[3].tag, '0003_restricted_session_revocation');
  assert.ok(journal.entries[3].when > journal.entries[2].when);
  const migrations = readMigrationFiles({ migrationsFolder: folder });
  assert.equal(migrations.length, 5);
  assert.equal(migrations[3].sql.length, sql.split('--> statement-breakpoint').length);
  for (const statement of migrations[3].sql) {
    assert.equal((statement.match(/\$function\$/g) ?? []).length % 2, 0);
  }
});

test('offline: administrator provisions a fresh restricted role, then removes handoff membership', () => {
  assert.match(normalize(before), /BEGIN; CREATE ROLE colli_auth_ops NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 0;/);
  assert.match(before, /WITH INHERIT FALSE/);
  assert.match(before, /WITH SET TRUE/);
  assert.match(before, /WITH ADMIN FALSE/);
  assert.equal(normalize(after), 'BEGIN; REVOKE colli_auth_ops FROM colli_migrator; COMMIT;');
  assert.doesNotMatch(normalize(before), /PASSWORD|IF NOT EXISTS|colli_app/);
  assert.doesNotMatch(normalize(sql), /CREATE ROLE|GRANT colli_auth_ops TO/);
  assert.match(sql, /NOT m\.inherit_option AND NOT m\.admin_option/);
  assert.match(sql, /pg_catalog\.pg_default_acl/);
});

test('offline: owner data grants are exact, runtime registration and marker privileges are untouched', () => {
  const grants = sql.split('--> statement-breakpoint').map(normalize).filter(s => s.startsWith('GRANT '));
  assert.deepEqual(grants, [
    'GRANT USAGE ON SCHEMA public, auth TO colli_auth_ops;',
    'GRANT SELECT (id, auth_version), UPDATE (auth_version) ON public.users TO colli_auth_ops;',
    'GRANT SELECT, DELETE, UPDATE (expire) ON auth.sessions TO colli_auth_ops;',
    'GRANT SELECT, INSERT, DELETE, UPDATE (revoked_at, retain_until) ON auth.revoked_sessions TO colli_auth_ops;',
    'GRANT CREATE ON SCHEMA auth TO colli_auth_ops;',
  ]);
  assert.doesNotMatch(normalize(sql), /GRANT [^;]*TO colli_app|WITH GRANT OPTION|ALTER TABLE|CREATE TABLE|TRUNCATE|DELETE FROM public\.users|INSERT INTO public\.users/);
  assert.equal((sql.match(/UPDATE public\.users/g) ?? []).length, 1);
});

test('offline: five fixed-purpose functions have safe settings, ownership and same-transaction PUBLIC revokes', () => {
  assert.deepEqual(functions.map(f => f[1]), [
    '_session_identity', '_revoke_session', 'revoke_current_session', 'revoke_all_sessions', 'cleanup_revoked_sessions',
  ]);
  for (const [, name, , header] of functions) {
    assert.match(header, /SET search_path = pg_catalog, pg_temp/);
    assert.match(header, /SET timezone = 'UTC'/);
    assert.match(header, name.startsWith('_') ? /SECURITY INVOKER/ : /SECURITY DEFINER/);
    if (header.includes('LANGUAGE plpgsql')) assert.match(fn(name).body.trim(), /END;$/);
    const definition = sql.indexOf(`CREATE FUNCTION auth.${name}(`);
    const publicRevoke = sql.indexOf(`REVOKE ALL ON FUNCTION auth.${name}(`);
    const nextDefinition = sql.indexOf('CREATE FUNCTION ', definition + 1);
    assert.ok(publicRevoke > definition && (nextDefinition < 0 || publicRevoke < nextDefinition));
    assert.match(sql.slice(publicRevoke).split(';')[0], /FROM PUBLIC, colli_app$/);
    assert.match(sql, new RegExp(`ALTER FUNCTION auth\\.${name}\\([^;]+ OWNER TO colli_auth_ops;`));
  }
  assert.equal(normalize(sql).endsWith('REVOKE CREATE ON SCHEMA auth FROM colli_auth_ops;'), true);
  assert.doesNotMatch(normalize(sql), /\bEXECUTE\b|CREATE OR REPLACE|WHEN OTHERS|SET ROLE/);
  // The installed migrator, not a newly invented SQL runner, wraps statements and
  // the migration journal insertion together. This is inspection, not a DB test.
  const dialect = fs.readFileSync(dbRequire.resolve('drizzle-orm/pg-core/dialect'), 'utf8');
  ordered(dialect, 'async migrate(', 'session.transaction(', 'migration.sql', 'insert into');
});

test('offline: external signatures accept only a SID, cleanup accepts no arguments', () => {
  assert.equal(fn('revoke_current_session').args, 'p_sid text');
  assert.equal(fn('revoke_all_sessions').args, 'p_sid text');
  assert.equal(fn('cleanup_revoked_sessions').args, '');
  assert.equal(normalize(fn('revoke_current_session').body), 'SELECT auth._revoke_session(p_sid, false);');
  assert.equal(normalize(fn('revoke_all_sessions').body), 'SELECT auth._revoke_session(p_sid, true);');
});

test('offline: malformed, missing and ambiguous metadata is rejected before numeric casts', () => {
  ordered(identity, "json_typeof(p_sess) IS DISTINCT FROM 'object'", 'json_each(p_sess)', 'FOREACH v_key', "json_typeof(p_sess -> v_key) IS DISTINCT FROM 'number'", "!~ '^[1-9][0-9]{0,12}$'", "v_user := (p_sess ->> 'userId')::bigint");
  assert.match(identity, /HAVING count\(\*\) > 1/);
  assert.match(identity, /j\.key NOT IN/);
  assert.match(identity, /v_user > 2147483647 OR v_version > 2147483647 THEN RETURN/);
  assert.match(identity, /NOT pg_catalog\.isfinite\(p_expire\)/);
  assert.match(identity, /reauthenticatedAt.*IS NOT NULL/);
  assert.match(revoke, /IF NOT FOUND THEN EXIT validate_session/);
  assert.match(revoke, /IF NOT v_valid THEN RETURN 'invalid_session'/);
});

test('offline: exact idle and absolute boundaries fail closed independently of rounded store expiry', () => {
  for (const expression of [
    'v_issued > v_now', 'v_activity < v_issued', 'v_activity > v_now',
    'v_absolute <> v_issued + 604800000', 'v_now >= v_absolute',
    'v_now >= v_activity + 86400000', "(p_expire AT TIME ZONE 'UTC') <= p_now",
    'least(v_absolute, v_activity + 86400000)',
  ]) assert.ok(identity.includes(expression), expression);
  assert.match(revoke, /v_now := pg_catalog\.clock_timestamp\(\)/);
  assert.doesNotMatch(normalize(revoke), /CURRENT_TIMESTAMP|now\(\)|transaction_timestamp/);
});

test('offline: lock/revalidation order protects against concurrent version change and deleted accounts', () => {
  ordered(revoke, 'SELECT i.user_id INTO v_candidate',
    'SELECT u.auth_version INTO v_account_version', 'WHERE u.id = v_candidate FOR UPDATE',
    'IF NOT FOUND THEN EXIT validate_session', 'WHERE s.sid = p_sid FOR UPDATE',
    'v_now := pg_catalog.clock_timestamp()', 'SELECT i.user_id, i.auth_version',
    'v_user <> v_candidate OR v_version <> v_account_version', 'v_valid := true');
  assert.match(revoke, /WHERE u\.id = v_user AND u\.auth_version = v_version/);
});

test('offline: duplicate revocation cannot bump a version again after fresh login', () => {
  assert.equal((revoke.match(/RETURN 'already_revoked'/g) ?? []).length, 2);
  ordered(revoke, 'END validate_session', "RETURN 'already_revoked'", 'IF v_valid AND p_all',
    "IF NOT v_valid THEN RETURN 'invalid_session'", 'IF p_all THEN', 'UPDATE public.users');
  assert.match(revoke, /DELETE FROM auth\.sessions AS s WHERE s\.sid = p_sid/);
  assert.doesNotMatch(revoke, /DELETE FROM auth\.sessions[^;]*userId/);
});

test('offline: conservative markers survive late writes and active markers cannot be shortened', () => {
  assert.match(revoke, /VALUES \(p_sid, v_now, v_now \+ interval '168 hours'\)/);
  assert.match(normalize(revoke), /ON CONFLICT \(sid\) DO UPDATE SET revoked_at = EXCLUDED\.revoked_at, retain_until = EXCLUDED\.retain_until WHERE r\.retain_until <= EXCLUDED\.revoked_at;/);
  ordered(revoke, 'INSERT INTO auth.revoked_sessions', 'UPDATE public.users', 'DELETE FROM auth.sessions');
  assert.doesNotMatch(revoke, /DELETE FROM auth\.revoked_sessions|UPDATE auth\.sessions/);
});

test('offline: overflow and database errors cannot be converted to successful revocation', () => {
  ordered(revoke, 'v_account_version = 2147483647', "ERRCODE = '22003'", 'INSERT INTO auth.revoked_sessions');
  assert.match(revoke, /IF NOT FOUND THEN RAISE EXCEPTION 'Authentication state changed'/);
  assert.doesNotMatch(revoke, /EXCEPTION\s+WHEN|COMMIT|ROLLBACK/);
});

test('offline: cleanup cannot accept an early cutoff, shorten markers or delete unbounded batches', () => {
  assert.match(cleanup, /v_cutoff timestamptz := pg_catalog\.statement_timestamp\(\)/);
  assert.equal((cleanup.match(/r\.retain_until <= v_cutoff/g) ?? []).length, 2);
  assert.match(cleanup, /LIMIT 100 FOR UPDATE SKIP LOCKED/);
  assert.match(cleanup, /SELECT count\(\*\)::integer INTO v_count FROM removed/);
  assert.doesNotMatch(cleanup, /(?:^|;)\s*(UPDATE|INSERT|TRUNCATE)\b/m);
});

// These are acceptance gates, not simulated assertions pretending to execute SQL.
for (const scenario of [
  'PostgreSQL function compilation, owner handoff and effective privilege matrix',
  'malformed/duplicate/null metadata, deleted account and invalid SID',
  'idle/absolute exact expiry and UTC/DST boundaries',
  'duplicate logout and preservation of active marker deadlines',
  'revoke-all followed by fresh login and old-SID replay',
  'late session writes before and after marker cleanup',
  'account-version mismatch and concurrent two-connection revocation',
  'integer overflow leaves version, session and marker unchanged',
  'early cleanup rejection, 100-row bound and cleanup/revocation race',
  'database failure, lock timeout and rollback with no partial effects',
]) test.skip(`UNVERIFIED live PostgreSQL: ${scenario}`, () => {});
