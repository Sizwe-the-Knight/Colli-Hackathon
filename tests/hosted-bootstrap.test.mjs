import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createHash } from 'node:crypto';
import { verifyArtifacts, sha256 } from '../lib/db/hosted/v1/verify-artifacts.mjs';

const base = 'lib/db/hosted/v1/';
const read = path => fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const hosted = name => read(base + name);
const local = name => read('lib/db/drizzle/' + name);
const definitions = sql => [...sql.matchAll(/CREATE FUNCTION (auth\.\w+)\([\s\S]*?\$function\$;/g)].map(m => m[0]);
const functions = definitions(local('0003_restricted_session_revocation.sql') + '\n' + local('0005_auth_attempt_limits.sql'));

test('offline integrity manifest covers every execution artifact and all six historical migrations', () => {
  const result = verifyArtifacts();
  assert.match(result.manifestSha256, /^[a-f0-9]{64}$/);
  const manifest = JSON.parse(hosted('manifest.json'));
  assert.equal(manifest.sources.filter(s => /drizzle\/000\d.*\.sql$/.test(s.path)).length, 6);
  assert.equal(manifest.sources.filter(s => /snapshot\.json$/.test(s.path)).length, 6);
  assert.ok(manifest.sources.some(s => s.path.endsWith('_journal.json')));
  for (const name of fs.readdirSync(base).filter(n => n !== 'manifest.json')) {
    assert.ok(manifest.artifacts.some(a => a.path === base + name), name);
  }
});

test('integrity checker rejects changed SQL/source and makes no network/database call', () => {
  for (const target of [base+'02-schema.sql', 'lib/db/drizzle/0003_restricted_session_revocation.sql']) {
    assert.throws(() => verifyArtifacts(path => {
      const data = fs.readFileSync(path);
      return path === target ? Buffer.concat([data,Buffer.from('\n-- tampered')]) : data;
    }), /mismatch/);
  }
  assert.doesNotMatch(hosted('verify-artifacts.mjs'), /from ['"](?:pg|https?|net|child_process)|fetch\(|writeFile|execFile/);
});

test('all six complete function definitions are unchanged, with catalog body fingerprints', () => {
  const installed = definitions(hosted('02-schema.sql')+'\n'+hosted('04-auth-limits.sql'));
  assert.equal(functions.length,6);
  assert.deepEqual(installed, functions);
  for (const fn of functions) {
    const body = fn.match(/AS \$function\$([\s\S]*?)\$function\$;/)[1];
    assert.ok(hosted('assert-installed.sql').includes(createHash('md5').update(body).digest('hex')));
  }
});

test('initial schema and narrow registration DDL are copied without invented data or local guard bypass', () => {
  for (const name of ['0000_initial_users.sql','0001_persistent_sessions.sql','0002_narrow_registration_insert.sql']) {
    assert.ok(hosted('02-schema.sql').includes(local(name).trim()), name);
  }
  assert.ok(hosted('02-schema.sql').includes(local('0003_restricted_session_revocation.sql').split('GRANT USAGE ON SCHEMA public, auth TO colli_auth_ops;')[1].trim()));
  assert.ok(hosted('02-schema.sql').indexOf('GRANT USAGE ON SCHEMA public TO colli_auth_ops') < hosted('02-schema.sql').indexOf('SET LOCAL ROLE colli_migrator'));
  assert.match(hosted('02-schema.sql'), /GRANT USAGE ON SCHEMA auth TO colli_auth_ops/);
  assert.match(hosted('02-schema.sql'), /GRANT UPDATE \(providers,updated_at\) ON public.users TO colli_app/);
  assert.match(hosted('01-roles.sql'), /PASSWORD NULL/);
  assert.doesNotMatch(hosted('bootstrap.psql'), /__drizzle_migrations|127\.0\.0\.1|colli_dev_disposable/);
});

test('runtime grants exactly preserve 0004 and no counter-table runtime access is added', () => {
  const grants = sql => sql.match(/^GRANT [\s\S]*?;/gm) ?? [];
  assert.deepEqual(grants(hosted('03-runtime-grants.sql')),grants(local('0004_session_runtime_grants.sql')));
  const limiter = hosted('04-auth-limits.sql');
  assert.match(limiter,/REVOKE ALL ON auth.auth_attempts FROM PUBLIC, colli_app/);
  assert.match(limiter,/SET LOCAL ROLE colli_auth_ops;\nCREATE FUNCTION/);
  assert.match(limiter,/REVOKE CREATE ON SCHEMA auth FROM colli_auth_ops/);
  assert.doesNotMatch(limiter,/GRANT colli_auth_ops TO colli_migrator|GRANT [^;]*ON auth.auth_attempts TO colli_app/);
  const table = local('0005_auth_attempt_limits.sql').match(/CREATE TABLE [\s\S]*?\n\);/)[0];
  assert.ok(limiter.includes(table));
});

test('bootstrap journals actual phase hashes and cleanup inside one bounded atomic transaction', () => {
  const sql = hosted('bootstrap.psql');
  const manifest = JSON.parse(hosted('manifest.json'));
  assert.equal((sql.match(/^BEGIN /gm)??[]).length,1);
  assert.equal((sql.match(/^COMMIT;/gm)??[]).length,1);
  assert.equal((sql.match(/^INSERT INTO colli_hosted_migrations.journal/gm)??[]).length,5);
  for (const phase of manifest.phases) {
    const expected = sha256(fs.readFileSync(base+phase.file));
    assert.ok(sql.includes(`'${phase.id}','colli-hosted-v1','${expected}'`));
    assert.ok(hosted('assert-journal.sql').includes(`('${phase.id}','${expected}')`));
    assert.ok(sql.indexOf(`\\ir ${phase.file}`)<sql.indexOf(`'${phase.id}','colli-hosted-v1'`));
  }
  assert.ok(sql.indexOf('05-membership-cleanup.sql')<sql.indexOf('assert-installed.sql'));
  assert.ok(sql.indexOf('assert-journal.sql')<sql.indexOf('COMMIT;'));
  for (const setting of ["READ COMMITTED","timezone='UTC'","statement_timeout='10s'","lock_timeout='2s'","idle_in_transaction_session_timeout='15s'",'pg_advisory_xact_lock(1129270348,90)','ON_ERROR_STOP on']) assert.ok(sql.includes(setting),setting);
  for(const phase of manifest.phases) assert.doesNotMatch(hosted(phase.file),/^COMMIT;|^BEGIN ISOLATION|^\\connect|DROP ROLE|DROP TABLE/gm);
});

test('probe rolls back and checks direct access rejection plus independent ACL/role restoration', () => {
  const sql = hosted('probe.psql');
  assert.doesNotMatch(sql,/^COMMIT;|CREATE ROLE colli_(app|migrator|auth_ops)\b/gm);
  assert.match(sql,/ALTER TABLE colli_v1_probe.t OWNER TO colli_v1_probe_m/);
  assert.match(sql,/ALTER SCHEMA colli_v1_probe OWNER TO colli_v1_probe_m/);
  assert.match(sql,/ALTER FUNCTION colli_v1_probe.read_value\(\) OWNER TO colli_v1_probe_o/);
  assert.match(sql,/EXCEPTION WHEN insufficient_privilege THEN NULL/);
  assert.ok(sql.indexOf('ROLLBACK;')<sql.indexOf('\\ir probe-absence.psql'));
  assert.match(hosted('probe-absence.psql'),/BEGIN READ ONLY/);
  for(const text of ['probe_baseline','datacl','nspacl','pg_catalog.pg_roles','pg_catalog.pg_namespace']) assert.ok(hosted('probe-absence.psql').includes(text));
});

test('only documented administrator creator grants survive; no temporary runtime/migrator access', () => {
  assert.match(hosted('01-roles.sql'), /WITH SET TRUE GRANTED BY CURRENT_USER/);
  assert.match(hosted('05-membership-cleanup.sql'), /FROM CURRENT_USER GRANTED BY CURRENT_USER/);
  assert.match(hosted('02-schema.sql'), /REVOKE colli_auth_ops FROM colli_migrator/);
  for(const file of ['assert-installed.sql','05-membership-cleanup.sql','probe.psql']) {
    const sql=hosted(file);
    assert.match(sql,/member=session_user::regrole AND admin_option AND NOT inherit_option AND NOT set_option/);
    assert.match(sql,/g.oid=grantor AND g.rolsuper/);
  }
  assert.match(hosted('assert-installed.sql'), /Table\/sequence ACL mismatch/);
  assert.match(hosted('assert-installed.sql'), /Column ACL mismatch/);
  assert.match(hosted('assert-installed.sql'), /Function definition\/security\/ACL mismatch/);
});

test('connection and runtime checks enforce the exact target, verified TLS and direct host', () => {
  for(const file of ['connection-guard.psql','runtime-readiness.psql']) {
    const sql=hosted(file);
    for(const text of ['expected_host','client_host',"'5432'","'verify-full'","'%-pooler.%'",'170000','179999',"'neondb'"]) assert.ok(sql.includes(text),`${file}: ${text}`);
  }
  const readiness = read('artifacts/api-server/src/lib/session-readiness.ts').match(/export const sessionReadinessSql = `([\s\S]*?)`;/)[1];
  assert.ok(hosted('runtime-readiness.psql').includes(readiness));
  assert.match(hosted('runtime-readiness.psql'), /BEGIN READ ONLY/);
  assert.match(hosted('verify.psql'), /BEGIN READ ONLY/);
});

test('missing connection variables raise before later SQL with ON_ERROR_STOP, not quit arguments', () => {
  // Static/offline verification of the documented psql -f contract, not live SQL execution.
  const sql = hosted('connection-guard.psql');
  assert.doesNotMatch(sql, /\\quit\b/);
  assert.ok(sql.indexOf('\\set ON_ERROR_STOP on') < sql.indexOf('\\if'));
  for (const [variable, label] of [['expected_admin','expected_admin'],['expected_host','expected_host'],['tls_mode','PGSSLMODE']]) {
    const block = `\\if :{?${variable}}\n\\else\n  DO $missing$ BEGIN RAISE EXCEPTION 'Missing ${label}' USING ERRCODE='22023'; END; $missing$;\n\\endif`;
    assert.ok(sql.includes(block), label);
    assert.ok(sql.indexOf(block) < sql.indexOf("SELECT set_config('colli.expected_admin'"));
  }
  assert.ok(sql.indexOf('\\unset tls_mode') < sql.indexOf('\\getenv tls_mode PGSSLMODE'));
  assert.ok(sql.indexOf('\\getenv tls_mode PGSSLMODE') < sql.indexOf('\\if :{?tls_mode}'));
  // Reinsert only the removed proxy-incompatible predicate to pin every other check unchanged.
  const original = sql.replace("     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles", "     OR (SELECT ssl FROM pg_catalog.pg_stat_ssl WHERE pid=pg_backend_pid()) IS DISTINCT FROM true\n     OR NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles");
  assert.equal(sha256(original.slice(original.indexOf("SELECT set_config('colli.expected_admin'"))),
    'f87f2e246726ce78a31ca0b995f0b0fc42b2fa2c6e5bd9be667acc2ca09c9aa6');
});

test('Neon administrator guard uses client TLS requirements, not proxy backend SSL statistics', () => {
  assert.doesNotMatch(hosted('connection-guard.psql'), /pg_stat_ssl/);
  const runbook = hosted('RUNBOOK.md');
  assert.match(runbook, /PGSSLMODE=verify-full/);
  assert.match(runbook, /PGSSLROOTCERT/);
  assert.match(runbook, /Before any ownership probe, check client-side `\\conninfo`/);
  assert.match(runbook, /Server-side SQL does not independently prove client certificate verification/);
  assert.match(runbook, /-c '\\conninfo' -f lib\/db\/hosted\/v1\/probe.psql/);
});

test('probe documents same-connection restoration separately from mandatory fresh verification', () => {
  assert.match(hosted('probe.psql'), /included check uses the SAME connection after ROLLBACK/);
  assert.match(hosted('probe.psql'), /additional fresh connection must ALSO run probe-absence.psql/);
  assert.match(hosted('RUNBOOK.md'), /fresh-connection `probe-absence.psql` check remains mandatory/);
});

test('missing bootstrap manifest fails before transaction or phases under ON_ERROR_STOP', () => {
  const sql = hosted('bootstrap.psql');
  const failure = "DO $missing$ BEGIN RAISE EXCEPTION 'Missing manifest_sha256' USING ERRCODE='22023'; END; $missing$;";
  assert.ok(sql.includes(`\\if :{?manifest_sha256}\n\\else\n  ${failure}\n\\endif`));
  assert.ok(sql.indexOf('\\set ON_ERROR_STOP on') < sql.indexOf(failure));
  assert.ok(sql.indexOf(failure) < sql.indexOf('BEGIN ISOLATION'));
  assert.doesNotMatch(sql, /\\quit\b/);
});

test('installer includes resolve to the exact versioned phases and assertions in execution order', () => {
  const phases = JSON.parse(hosted('manifest.json')).phases.map(p => p.file);
  const expected = {
    'bootstrap.psql': ['connection-guard.psql', ...phases, 'assert-installed.sql', 'assert-journal.sql'],
    'verify.psql': ['connection-guard.psql', 'assert-installed.sql', 'assert-journal.sql'],
  };
  for (const [file, names] of Object.entries(expected)) {
    const sql = hosted(file);
    assert.deepEqual([...sql.matchAll(/^\\ir (.+)$/gm)].map(m => m[1]), names);
    for (const name of names) assert.ok(fs.existsSync(base + name), `${file}: ${name}`);
    assert.match(sql, /\\set ON_ERROR_STOP on/);
    assert.ok(sql.indexOf('\\set ON_ERROR_STOP on') < sql.indexOf('BEGIN'));
    assert.ok(hosted('RUNBOOK.md').includes(`-f ${base}${file}`));
  }
});

test('runtime readiness retains client verification and exact application checks through Neon proxy', () => {
  const sql = hosted('runtime-readiness.psql');
  assert.doesNotMatch(sql, /pg_stat_ssl/);
  assert.ok(sql.indexOf('\\unset tls_mode') < sql.indexOf('\\getenv tls_mode PGSSLMODE'));
  assert.match(sql, /current_setting\('colli.tls_mode'\)<>'verify-full'/);
  assert.match(sql, /current_user<>'colli_app' OR session_user<>'colli_app'/);
  assert.match(sql, /Runtime readiness rejected/);
  assert.match(hosted('RUNBOOK.md'), /-c '\\conninfo' -f lib\/db\/hosted\/v1\/runtime-readiness.psql/);
});
