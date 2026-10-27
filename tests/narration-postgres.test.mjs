import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire, Module } from 'node:module';
const root=process.cwd(),require=createRequire(path.join(root,'artifacts/api-server/package.json'));
const compiled=await require('esbuild').build({stdin:{contents:`
 export * from './artifacts/api-server/src/operational/narrator';
 export * from './artifacts/api-server/src/operational/narration-postgres';
 export * from './artifacts/api-server/src/operational/narration-contract';
 export * from './artifacts/api-server/src/operational/usage';
 export * from './artifacts/api-server/src/operational/demo-scenario';
 `,resolveDir:root},bundle:true,write:false,platform:'node',format:'cjs'});
const filename=path.join(root,'tests/narration-postgres-compiled.cjs'),mod=new Module(filename);
mod._compile(compiled.outputFiles[0].text,filename);const api=mod.exports;
const report=()=>api.processUsage(JSON.parse(fs.readFileSync('scripts/fixtures/usage-synthetic.json','utf8')));
const config=api.narratorConfig({NODE_ENV:'production',NEBIUS_NARRATION_ENABLED:'true',NEBIUS_API_KEY:'offline-key',
 NEBIUS_BUDGET_BACKEND:'postgres',NEBIUS_MAX_CALLS:'100',NEBIUS_TOKEN_BUDGET:'870400'});
const valid=body=>Object.fromEntries(Object.entries(JSON.parse(body).response_format.json_schema.schema.properties).map(([k,v])=>[k,v.enum[0]]));
const response=value=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]}),{headers:{'content-type':'application/json'}});
// Database boundary double, NOT evidence of live PostgreSQL locking/privileges.
function database() {
 const records=new Map(),calls=[];let fail=null;
 const pool={async query(sql,args){
  calls.push({sql,args});if(fail&&sql.includes(fail))throw new Error('private database failure');
  const [key,account]=args,existing=records.get(key);
  if(sql.includes('read_narration'))return {rows:[{value:existing&&existing.account===account?{narrative:existing.narrative}:null}]};
  if(sql.includes('save_narration')){if(!existing||existing.account!==account||existing.narrative)return {rows:[{saved:false}]};existing.narrative=JSON.parse(args[2]);return {rows:[{saved:true}]};}
  if(sql.includes('reserve_narration')){
   if(existing)return {rows:[{result:'already_attempted'}]};
   const judge=args[2],all=[...records.values()];
   if(all.length>=args[3]||(all.length+1)*8704>args[4]||all.filter(r=>r.account===account).length>=3||
     all.filter(r=>r.judge===judge).length>=(judge?20:80))return {rows:[{result:'budget_exhausted'}]};
   records.set(key,{account,judge,narrative:null});return {rows:[{result:'reserved'}]};
  }
  assert.fail('Unexpected query');
 }};
 return {pool,records,calls,setFailure:value=>{fail=value}};
}
function service(db,fetcher,judges='',timeout=1000) {
 return new api.BriefNarrator(config,fetcher,Date.now,timeout,new api.PostgresNarrationStore(db.pool,config,api.judgeAccounts(judges)));
}
test('production requires PostgreSQL and bounded caps; judge selection is server-only',()=>{
 assert.equal(config.enabled,true);
 assert.throws(()=>new api.BriefNarrator(config),/Persistent/);
 for(const backend of ['file','other'])assert.equal(api.narratorConfig({NODE_ENV:'production',NEBIUS_NARRATION_ENABLED:'true',NEBIUS_BUDGET_BACKEND:backend,
  NEBIUS_API_KEY:'test',NEBIUS_BUDGET_FILE:path.resolve('unused'),NEBIUS_MAX_CALLS:'100',NEBIUS_TOKEN_BUDGET:'870400'}).enabled,false);
 assert.equal(api.narratorConfig({NEBIUS_NARRATION_ENABLED:'true',NEBIUS_BUDGET_BACKEND:'postgres',NEBIUS_API_KEY:'test',NEBIUS_MAX_CALLS:'101',NEBIUS_TOKEN_BUDGET:'870400'}).enabled,false);
 assert.deepEqual([...api.judgeAccounts('7, 8')],[api.hash('7'),api.hash('8')]);
 for(const invalid of ['email@example.com','0','-1','7,','1e3','9007199254740992'])assert.throws(()=>api.judgeAccounts(invalid));
});
test('GET never spends; validated output survives narrator restart and stays account-scoped',async()=>{
 const db=database();let outbound=0;
 const fetcher=async(_url,o)=>{outbound++;assert.equal(db.records.size,1);assert.equal([...db.records.values()][0].narrative,null);return response(valid(o.body));};
 const n=service(db,fetcher),r=report();assert.equal((await n.readStored(1,r)).status,'available');assert.equal(outbound,0);
 assert.equal((await n.generate(1,r)).source,'nemotron');assert.equal(outbound,1);
 const restarted=service(db,fetcher);
 assert.equal((await restarted.readStored(1,r)).status,'cached');assert.equal((await restarted.generate(1,r)).status,'cached');
 assert.equal((await restarted.readStored(2,r)).source,'deterministic');assert.equal(outbound,1);
 assert.ok(db.calls.every(c=>c.sql.includes('$1')&&c.sql.includes('$2')));
 assert.ok(db.calls.every(c=>!JSON.stringify(c.args).includes('offline-key')));
});
test('two independent narrator instances cannot both spend on the same account/report',async()=>{
 const db=database();let outbound=0;
 const fetcher=async(_url,o)=>{outbound++;return response(valid(o.body));};
 await Promise.all([service(db,fetcher).generate(1,report()),service(db,fetcher).generate(1,report())]);
 assert.equal(db.records.size,1);assert.equal(outbound,1);
});

test('previously approved wording survives the refinement without a new reservation or fetch',async()=>{
 const db=database(),r=report(),lead=api.leadFinding(r),fingerprint=api.fingerprint(r);
 const account=api.hash('1'),key=api.hash('1:'+fingerprint),choices=api.legacyNarrativeChoices(r,lead);
 const narrative={findingId:lead.id,...Object.fromEntries(api.fields.map(f=>[f,choices[f][0]]))};
 db.records.set(key,{account,judge:false,narrative});
 const before=JSON.stringify([...db.records]);
 const n=service(db,()=>assert.fail('No new inference for a cached report'));
 assert.deepEqual((await n.readStored(1,r)).narrative,narrative);
 assert.equal((await n.generate(1,r)).status,'cached');
 assert.equal(api.fingerprint(r),fingerprint);assert.equal(JSON.stringify([...db.records]),before);
 assert.ok(db.calls.every(c=>c.sql.includes('read_narration')));
 narrative.nextStep='Open a nonexistent error screen';
 assert.equal((await n.readStored(1,r)).status,'already_attempted');
});
for(const failure of ['provider','timeout','unsupported','save','reserve','read'])test(`${failure} fails closed with no automatic retry across restart`,async()=>{
 const db=database();let outbound=0;
 if(['save','reserve','read'].includes(failure))db.setFailure(failure+'_narration');
 const fetcher=async(_url,o)=>{outbound++;
  if(failure==='provider')throw new Error('private provider error');
  if(failure==='timeout')return new Promise(()=>{});
  return response(failure==='unsupported'?{...valid(o.body),headline:'Save $100 today'}:valid(o.body));};
 const result=await service(db,fetcher,'',failure==='timeout'?25:1000).generate(1,report());
 assert.equal(result.source,'deterministic');assert.equal(result.narrative,null);
 assert.doesNotMatch(JSON.stringify(result),/private|offline-key/);
 db.setFailure(null);
 if(!['read','reserve'].includes(failure)){
  const after=await service(db,fetcher).generate(1,report());assert.equal(after.source,'deterministic');assert.equal(outbound,1);assert.equal(db.records.size,1);
 }else assert.equal(outbound,0);
});
test('tampered durable narration is rejected against the unchanged evidence validator',async()=>{
 const db=database();const n=service(db,async(_url,o)=>response(valid(o.body)));await n.generate(1,report());
 [...db.records.values()][0].narrative.headline='You saved $100';
 const result=await service(db,()=>assert.fail('No inference')).readStored(1,report());assert.equal(result.source,'deterministic');assert.equal(result.status,'already_attempted');
});
test('server passes authenticated account hashes, configured caps and reserved judge eligibility only',async()=>{
 const db=database(),store=new api.PostgresNarrationStore(db.pool,config,api.judgeAccounts('42'));
 await store.reserve('a'.repeat(64),api.hash('42'),0);
 assert.deepEqual(db.calls[0].args,['a'.repeat(64),api.hash('42'),true,100,870400]);
 for(let i=0;i<3;i++)assert.equal(await store.reserve(api.hash('another'+i),api.hash('2'),0),'reserved');
 assert.equal(await store.reserve(api.hash('fourth'),api.hash('2'),0),'budget_exhausted');
});
test('mocked durable allocation preserves 20 judge slots when public 80 are exhausted',async()=>{
 const db=database(),store=new api.PostgresNarrationStore(db.pool,config,api.judgeAccounts('900'));
 for(let i=0;i<80;i++)assert.equal(await store.reserve(api.hash('r'+i),api.hash('a'+i),0),'reserved');
 assert.equal(await store.reserve(api.hash('public81'),api.hash('public81'),0),'budget_exhausted');
 assert.equal(await store.reserve(api.hash('judge1'),api.hash('900'),0),'reserved');
});
test('prepared SQL enforces durable limits, atomic reservations and least privilege without expiry/reset',()=>{
 const sql=fs.readFileSync('lib/db/hosted/narration-v1/001_narration_quotas.sql','utf8');
 assert.match(sql,/pg_advisory_xact_lock\(1129270348, 6\)/);
 assert.ok(sql.indexOf('pg_advisory_xact_lock')<sql.indexOf('v_now := pg_catalog.clock_timestamp'));
 for(const text of ['p_calls NOT BETWEEN 1 AND 100','p_tokens NOT BETWEEN 8704 AND 870400','WHERE account=p_account) >= 3','v_cap-20','WHERE judge) >= 20',"interval '1 minute'","interval '1 hour'"]){assert.ok(sql.includes(text),text);}
 assert.doesNotMatch(sql,/DELETE FROM|TRUNCATE TABLE|GRANT (?:SELECT|INSERT|UPDATE|DELETE).*TO colli_app|GRANT colli_auth_ops TO/);
 assert.equal((sql.match(/SECURITY DEFINER/g)||[]).length,3);
 assert.equal((sql.match(/SET search_path = pg_catalog, pg_temp/g)||[]).length,3);
 assert.match(sql,/REVOKE ALL ON FUNCTION[\s\S]*FROM PUBLIC, colli_app/);
 assert.match(sql,/REVOKE CREATE ON SCHEMA auth FROM colli_auth_ops/);
 const apply=fs.readFileSync('lib/db/hosted/narration-v1/apply.psql','utf8');
 assert.match(apply,/ON_ERROR_STOP on/);assert.ok(apply.indexOf('BEGIN;')<apply.indexOf('001_narration_quotas.sql'));assert.ok(apply.indexOf('verify.sql')<apply.indexOf('COMMIT;'));
 assert.ok(apply.indexOf('WITH SET TRUE GRANTED BY CURRENT_USER')>apply.indexOf('Unexpected pre-upgrade membership'));
 assert.ok(apply.indexOf('05-membership-cleanup.sql')>apply.indexOf('001_narration_quotas.sql'));
 assert.ok(apply.indexOf('05-membership-cleanup.sql')<apply.indexOf('COMMIT;'));
 assert.doesNotMatch(apply,/GRANT colli_auth_ops TO colli_migrator/);
 assert.match(sql,/GRANT UPDATE\(narrative\) ON auth\.narration_attempts TO colli_auth_ops/);
 assert.ok(sql.indexOf('GRANT CREATE ON SCHEMA auth')<sql.indexOf('SET LOCAL ROLE colli_auth_ops'));
 const includes=[...apply.matchAll(/^\\ir (.+)$/gm)].map(m=>m[1].trim());
 for(const include of includes)assert.ok(fs.existsSync(path.resolve('lib/db/hosted/narration-v1',include)),include);
});

test('changing selected examples cannot reset durable per-account quotas; reordered selection reuses cache',async()=>{
 const db=database();let calls=0;const fetcher=async(_url,o)=>{calls++;return response(valid(o.body));};
 let n=service(db,fetcher);
 const first=api.providerDemo(['google','grok']);assert.equal((await n.generate(77,first)).status,'generated');
 n=service(db,fetcher);assert.equal((await n.generate(77,api.providerDemo(['grok','google','google']))).status,'cached');assert.equal(calls,1);
 for(const selection of [['openai'],['mistral']])assert.equal((await n.generate(77,api.providerDemo(selection))).status,'generated');
 assert.equal((await n.generate(77,api.providerDemo(['deepseek']))).status,'budget_exhausted');assert.equal(calls,3);assert.equal(db.records.size,3);
});

test('prior factual narration remains readable without a fresh request or reservation',async()=>{
 const db=database(),r=report(),f=api.leadFinding(r),choices=api.previousNarrativeChoices(r,f);
 const key=api.hash('91:'+api.fingerprint(r));const narrative={findingId:f.id,...Object.fromEntries(api.fields.map(k=>[k,choices[k][0]]))};
 db.records.set(key,{account:api.hash('91'),judge:false,narrative});
 const n=service(db,()=>assert.fail('Cached wording must not call provider'));
 assert.equal((await n.generate(91,r)).status,'cached');assert.equal(db.records.size,1);
 assert.ok(db.calls.every(c=>!c.sql.includes('reserve_narration')));
});
