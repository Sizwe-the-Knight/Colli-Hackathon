import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';

const require=createRequire(path.resolve('lib/db/package.json'));
const {readMigrationFiles}=require('drizzle-orm/migrator');
const {generateMigration}=require('drizzle-kit/api');
const folder='lib/db/drizzle';
const read=name=>fs.readFileSync(`${folder}/${name}`,'utf8');
const sql=read('0004_session_runtime_grants.sql');
const normalize=text=>text.replace(/\s+/g,' ').trim();
const review=fs.readFileSync('lib/db/SESSION_REVOCATION_REVIEW.md','utf8');
const statements=sql.split('--> statement-breakpoint');

test('0004 grants exactly the reviewed runtime contract, with no other mutation', () => {
 const grants=review.slice(review.indexOf('Exact proposed future store grants')).split('```sql')[1].split('```')[0];
 assert.equal(normalize(statements.slice(1).join(' ')),normalize(grants));
 assert.equal(statements.length,5);
 const guardCode=statements[0].replace(/--[^\r\n]*/g,'').replace(/'(?:''|[^'])*'/g,"''");
 assert.doesNotMatch(guardCode,/\b(?:GRANT|REVOKE|ALTER|CREATE|DROP|INSERT|DELETE|UPDATE|EXECUTE)\b/i);
 assert.doesNotMatch(sql,/WITH GRANT OPTION|SET ROLE|ALTER DEFAULT PRIVILEGES|CREATE TABLE|CREATE FUNCTION/i);
 for(const target of ['public.users','colli_auth_ops','auth._revoke_session','auth._session_identity']) {
  assert.ok(!statements.slice(1).some(statement=>statement.includes(target)));
 }
});

test('0004 refuses an unapproved connection, ownership or excess authority rather than repairing it', () => {
 const guard=statements[0];
 for(const predicate of ["current_user <> 'colli_bootstrap'","session_user <> 'colli_bootstrap'",
  "current_database() <> 'colli_dev_disposable'","host(inet_server_addr()) IS DISTINCT FROM '127.0.0.1'",
  'inet_server_port() IS DISTINCT FROM 55432',"relowner <> 'colli_migrator'::regrole",
  "proowner <> 'colli_auth_ops'::regrole","pg_catalog.pg_has_role('colli_app', 'colli_auth_ops', 'MEMBER')",
  "pg_catalog.pg_has_role('colli_migrator', 'colli_auth_ops', 'MEMBER')",
  "'auth_version', 'UPDATE'","'auth_version', 'INSERT'","'auth', 'CREATE'",
  "'auth.revoked_sessions', 'INSERT,UPDATE'","'auth._revoke_session(text,boolean)', 'EXECUTE'"]) {
  assert.ok(guard.includes(predicate),predicate);
 }
 assert.equal((guard.match(/RAISE EXCEPTION/g)??[]).length,4);
});

test('0004 is versioned after 0003 with an unchanged schema snapshot and exact SQL hash', async () => {
 const before=JSON.parse(read('meta/0003_snapshot.json'));
 const after=JSON.parse(read('meta/0004_snapshot.json'));
 assert.equal(after.prevId,before.id);assert.notEqual(after.id,before.id);
 const {id,prevId,...schema}=after;
 const {id:oldId,prevId:oldParent,...previous}=before;
 assert.deepEqual(schema,previous);
 assert.deepEqual(await generateMigration(before,after),[]);
 const journal=JSON.parse(read('meta/_journal.json'));
 assert.ok(journal.entries.length>=5);
 assert.deepEqual(journal.entries[4],{idx:4,version:'7',when:journal.entries[4].when,tag:'0004_session_runtime_grants',breakpoints:true});
 assert.ok(journal.entries[4].when>journal.entries[3].when);
 const migrations=readMigrationFiles({migrationsFolder:folder});
 assert.ok(migrations.length>=5);
 assert.deepEqual(migrations[4].sql,statements);
 assert.equal(migrations[4].folderMillis,journal.entries[4].when);
 const {createHash}=await import('node:crypto');
 assert.equal(migrations[4].hash,createHash('sha256').update(sql).digest('hex'));
});

test('readiness inspects effective privilege/schema/function contracts without changing ACLs or invoking functions', () => {
 const source=fs.readFileSync('artifacts/api-server/src/lib/session-readiness.ts','utf8');
 const query=source.split('export const sessionReadinessSql = `')[1].split('`;')[0];
 for(const check of ['has_column_privilege','has_table_privilege','has_any_column_privilege','has_schema_privilege',
  'has_sequence_privilege','has_function_privilege','WITH GRANT OPTION','pg_auth_members','aclexplode',
  'acldefault','p.prosecdef','p.proowner','p.proconfig','pg_attribute','pg_constraint'])assert.ok(query.includes(check),check);
 for(const forbidden of ["('public.users','auth_version','UPDATE')","('public.users','auth_version','INSERT')",
  "('auth.sessions','sid','UPDATE')","('auth.revoked_sessions','revoked_at','SELECT')"])assert.ok(query.includes(forbidden));
 assert.doesNotMatch(query,/SELECT auth\.(?:revoke_|cleanup_|_revoke|_session)|^\s*GRANT\s|CREATE TABLE/im);
 assert.ok(query.includes("'auth._revoke_session(text,boolean)',false,false"));
 assert.ok(query.includes("'auth._session_identity(json,timestamp,timestamptz)',false,false"));
});
