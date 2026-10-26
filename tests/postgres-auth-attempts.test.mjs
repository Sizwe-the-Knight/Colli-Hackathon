import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire,Module} from 'node:module';
import {createHash} from 'node:crypto';
const require=createRequire(path.resolve('artifacts/api-server/package.json'));
const dbRequire=createRequire(path.resolve('lib/db/package.json'));
const {build}=require('esbuild');
const built=await build({entryPoints:['artifacts/api-server/src/lib/postgres-auth-attempts.ts'],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'no-database',setup(b){b.onResolve({filter:/^@workspace\/db$/},()=>({path:'db',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:"export const pool={connect(){throw new Error('No real database permitted')}}"}));}}]});
const mod=new Module(path.resolve('tests/pg-limiter-offline.cjs'));mod._compile(built.outputFiles[0].text,mod.id);const {PostgresAuthAttempts}=mod.exports;
function fixture({wait=0,fail,rollbackFails=false}={}) {
 const calls=[];
 return {calls,connect:async()=>({
  release(discard){calls.push(['release',discard])},
  async query(sql,values){
   calls.push([sql,values]);
   if(sql===fail || (sql==='ROLLBACK'&&rollbackFails))throw new Error('private connection details');
   return {rows:sql.startsWith('SELECT')?[{retry_after:wait}]:[]};
  }
 })};
}
test('attempt commits parameterized hashed network reservation before admission',async()=>{
 const f=fixture();assert.equal(await new PostgresAuthAttempts(f.connect).take('login','192.0.2.1'),0);
 assert.deepEqual(f.calls.map(x=>x[0]),['BEGIN ISOLATION LEVEL READ COMMITTED',"SET LOCAL statement_timeout = '3s'","SET LOCAL lock_timeout = '1s'",'SELECT auth.consume_auth_attempt($1, $2) AS retry_after','COMMIT','release']);
 assert.deepEqual(f.calls[3][1],['login',createHash('sha256').update('192.0.2.1').digest('hex')]);
});
test('denial commits and returns wait; malformed results never admit',async()=>{
 assert.equal(await new PostgresAuthAttempts(fixture({wait:900}).connect).take('login','x'),900);
 for(const wait of [null,'0',-1,3601,1.5]){const f=fixture({wait});await assert.rejects(new PostgresAuthAttempts(f.connect).take('login','x'),/limits unavailable/);assert.ok(f.calls.some(x=>x[0]==='ROLLBACK'));assert.ok(!f.calls.some(x=>x[0]==='COMMIT'));}
});
test('SQL/lock/commit failure never retries or admits; broken rollback discards client',async()=>{
 for(const fail of ['BEGIN ISOLATION LEVEL READ COMMITTED','SELECT auth.consume_auth_attempt($1, $2) AS retry_after','COMMIT']){
  const f=fixture({fail,rollbackFails:true});await assert.rejects(new PostgresAuthAttempts(f.connect).take('register','x'),{message:'Authentication limits unavailable'});
  assert.equal(f.calls.filter(x=>x[0]===fail).length,1);assert.deepEqual(f.calls.at(-1),['release',true]);
 }
 await assert.rejects(new PostgresAuthAttempts(async()=>{throw new Error('offline')}).take('login','x'));
});
test('two adapter instances share committed database state; mocked interleaving holds admission until commit',async()=>{
 // Mock database serialization contract, NOT a live PostgreSQL concurrency test.
 let count=0,tail=Promise.resolve();
 const connect=async()=>{let unlock;return {release(){},async query(sql){
  if(sql.startsWith('SELECT')){const previous=tail;tail=new Promise(r=>{unlock=r});await previous;return {rows:[{retry_after:count>=10?900:(count++,0)}]};}
  if(sql==='COMMIT'||sql==='ROLLBACK')unlock?.();return {rows:[]};
 }}};
 const a=new PostgresAuthAttempts(connect),b=new PostgresAuthAttempts(connect);
 const waits=await Promise.all(Array.from({length:12},(_,i)=>(i%2?a:b).take('login','same-network')));
 assert.equal(waits.filter(v=>v===0).length,10);assert.equal(waits.filter(v=>v===900).length,2);
 assert.equal(await new PostgresAuthAttempts(connect).take('login','same-network'),900);
});
test('versioned SQL serializes before reading time/counters and restricts all direct runtime access',async()=>{
 const file='lib/db/drizzle/0005_auth_attempt_limits.sql',sql=fs.readFileSync(file,'utf8');
 const body=sql.split('AS $function$')[1].split('$function$;')[0];
 assert.ok(body.indexOf('pg_advisory_xact_lock')<body.indexOf('clock_timestamp'));
 assert.ok(body.indexOf('clock_timestamp')<body.indexOf('DELETE FROM auth.auth_attempts'));
 assert.ok(body.indexOf('IF v_wait > 0')<body.indexOf('INSERT INTO auth.auth_attempts'));
 for(const text of ["THEN 200 ELSE 50","THEN 10 ELSE 3","interval '15 minutes'","interval '1 hour'",'ON CONFLICT (kind,network) DO UPDATE','> 1024',"expires_at <= v_now"])assert.ok(body.includes(text),text);
 assert.match(sql,/SECURITY DEFINER/);assert.match(sql,/SET search_path = pg_catalog, pg_temp SET timezone = 'UTC'/);
 assert.match(sql,/REVOKE ALL ON auth.auth_attempts FROM PUBLIC, colli_app/);
 assert.match(sql,/REVOKE ALL ON FUNCTION auth.consume_auth_attempt\(text,text\) FROM PUBLIC, colli_app/);
 assert.match(sql,/ALTER FUNCTION auth.consume_auth_attempt\(text,text\) OWNER TO colli_auth_ops/);
 assert.match(sql,/REVOKE CREATE ON SCHEMA auth FROM colli_auth_ops/);
 assert.doesNotMatch(body,/public\.users|auth\.(sessions|revoked_sessions)|EXECUTE |COMMIT|session_user/);
 const migrations=dbRequire('drizzle-orm/migrator').readMigrationFiles({migrationsFolder:'lib/db/drizzle'});
 assert.equal(migrations.length,6);assert.equal(migrations[5].hash,createHash('sha256').update(sql).digest('hex'));
 const prev=JSON.parse(fs.readFileSync('lib/db/drizzle/meta/0004_snapshot.json'));
 const next=JSON.parse(fs.readFileSync('lib/db/drizzle/meta/0005_snapshot.json'));
 assert.equal(next.prevId,prev.id);
 const ddl=await dbRequire('drizzle-kit/api').generateMigration(prev,next);
 assert.equal(ddl.length,1);assert.ok(sql.includes(ddl[0].trim()));
});
