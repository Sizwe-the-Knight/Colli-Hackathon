import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire, Module } from 'node:module';

const root = process.cwd();
const dbRequire = createRequire(path.join(root, 'lib/db/package.json'));
const apiRequire = createRequire(path.join(root, 'artifacts/api-server/package.json'));
const { generateDrizzleJson, generateMigration } = dbRequire('drizzle-kit/api');
const { build } = apiRequire('esbuild');
const folder = path.join(root, 'lib/db/drizzle');
const before = JSON.parse(fs.readFileSync(path.join(folder, 'meta/0000_snapshot.json'), 'utf8'));
const after = JSON.parse(fs.readFileSync(path.join(folder, 'meta/0001_snapshot.json'), 'utf8'));
const journal = JSON.parse(fs.readFileSync(path.join(folder, 'meta/_journal.json'), 'utf8'));
const sql = fs.readFileSync(path.join(folder, '0001_persistent_sessions.sql'), 'utf8');

// Compile schema definitions only, never lib/db/src/index.ts (which creates a Pool).
const result = await build({
  entryPoints: [path.join(root, 'lib/db/src/schema/index.ts')],
  bundle: true, packages: 'external', write: false, platform: 'node', format: 'cjs',
});
const filename = path.join(root, 'lib/db/schema-inspection.cjs');
const compiled = new Module(filename);
compiled.filename = filename;
compiled.paths = Module._nodeModulePaths(path.dirname(filename));
compiled._compile(result.outputFiles[0].text, filename);

test('journal and generated snapshots preserve the existing migration chain', () => {
  assert.equal(after.prevId, before.id);
  assert.deepEqual(journal.entries.map(entry => [entry.idx, entry.tag]), [
    [0, '0000_initial_users'], [1, '0001_persistent_sessions'],
    [2, '0002_narrow_registration_insert'],
    [3, '0003_restricted_session_revocation'],
    [4, '0004_session_runtime_grants'],
  ]);
  assert.ok(journal.entries[1].when > journal.entries[0].when);
  const users = structuredClone(after.tables['public.users']);
  delete users.columns.auth_version;
  delete users.checkConstraints.users_auth_version_positive;
  assert.deepEqual(users, before.tables['public.users']);
});

test('custom registration privilege migration preserves schema and narrows only INSERT', async () => {
  const privilegeSnapshot = JSON.parse(fs.readFileSync(path.join(folder, 'meta/0002_snapshot.json'), 'utf8'));
  assert.equal(privilegeSnapshot.prevId, after.id);
  assert.notEqual(privilegeSnapshot.id, after.id);
  const { id, prevId, ...schema } = privilegeSnapshot;
  const { id: previousId, prevId: previousParent, ...previousSchema } = after;
  assert.deepEqual(schema, previousSchema);
  assert.deepEqual(await generateMigration(after, privilegeSnapshot), []);
  assert.ok(journal.entries[2].when > journal.entries[1].when);
  assert.equal(journal.entries[2].breakpoints, true);

  const privilegeSql = fs.readFileSync(path.join(folder, '0002_narrow_registration_insert.sql'), 'utf8');
  const statements = privilegeSql.split('--> statement-breakpoint').map(value => value.replace(/\s+/g, ' ').trim());
  assert.deepEqual(statements, [
    'REVOKE INSERT ON TABLE public.users FROM colli_app;',
    'REVOKE INSERT (id, email, name, password_hash, auth_version, providers, created_at, updated_at) ON TABLE public.users FROM colli_app;',
    'GRANT INSERT (email, name, password_hash) ON TABLE public.users TO colli_app;',
  ]);
});

test('SQL is exactly the offline Drizzle delta; current schema has no snapshot drift', async () => {
  const statements = sql.split('--> statement-breakpoint').map(value => value.trim()).filter(Boolean);
  assert.deepEqual((await generateMigration(before, after)).map(value => value.trim()), statements);
  const current = generateDrizzleJson(compiled.exports, after.id, ['public', 'auth']);
  assert.deepEqual(await generateMigration(after, current), []);
});

test('migration contains only the approved additive objects and no privilege operations', () => {
  assert.deepEqual(Object.keys(after.tables).sort(), ['auth.revoked_sessions', 'auth.sessions', 'public.users']);
  assert.deepEqual(after.schemas, { auth: 'auth' });
  for (const key of ['roles', 'policies', 'views', 'enums', 'sequences']) assert.deepEqual(after[key], {});
  assert.doesNotMatch(sql, /\b(DROP|RENAME|TRUNCATE|DELETE|GRANT|REVOKE|FUNCTION|TRIGGER|OIDS)\b/i);
  assert.equal((sql.match(/CREATE SCHEMA/g) ?? []).length, 1);
  assert.equal((sql.match(/CREATE TABLE/g) ?? []).length, 2);
  assert.equal((sql.match(/CREATE INDEX/g) ?? []).length, 3);
  assert.equal((sql.match(/ALTER TABLE/g) ?? []).length, 2);
  const version = after.tables['public.users'].columns.auth_version;
  assert.equal(version.type, 'integer');
  assert.equal(version.notNull, true);
  assert.equal(version.default, 1);
  assert.match(after.tables['public.users'].checkConstraints.users_auth_version_positive.value, /> 0$/);
  assert.equal('authVersion' in compiled.exports.insertUserSchema.shape, false);
});

test('store columns, account lookup and independently retained markers are represented', () => {
  const sessions = after.tables['auth.sessions'];
  assert.deepEqual(Object.keys(sessions.columns), ['sid', 'sess', 'expire']);
  assert.equal(sessions.columns.sid.type, 'varchar');
  assert.equal(sessions.columns.sid.primaryKey, true);
  assert.equal(sessions.columns.sess.type, 'json');
  assert.equal(sessions.columns.expire.type, 'timestamp (6)');
  assert.ok(Object.values(sessions.columns).every(column => column.notNull));
  assert.equal(sessions.indexes.sessions_expire_idx.columns[0].expression, 'expire');
  assert.equal(sessions.indexes.sessions_user_id_idx.columns[0].expression, '("sess" ->> \'userId\')');
  const markers = after.tables['auth.revoked_sessions'];
  assert.equal(markers.columns.sid.primaryKey, true);
  assert.equal(markers.columns.revoked_at.default, 'now()');
  assert.equal(markers.columns.retain_until.type, 'timestamp (6) with time zone');
  assert.equal(markers.indexes.revoked_sessions_retain_until_idx.columns[0].expression, 'retain_until');
  assert.match(markers.checkConstraints.revoked_sessions_retention_bound.value, /interval '168 hours'/);
  assert.deepEqual(markers.foreignKeys, {}); // No cascade can erase a live marker.
});
