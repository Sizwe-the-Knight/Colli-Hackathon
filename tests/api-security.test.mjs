import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire, Module} from 'node:module';
import path from 'node:path';
import fs from 'node:fs';
import vm from 'node:vm';
import {IncomingMessage,ServerResponse} from 'node:http';
import {Socket} from 'node:net';
const require=createRequire(path.resolve('artifacts/api-server/package.json'));
const {build}=require('esbuild');
const result=await build({stdin:{contents:`
 export * from './artifacts/api-server/src/lib/security';
 export * from './artifacts/api-server/src/lib/session-policy';
 export * from './artifacts/api-server/src/lib/session-runtime';
 export * from './artifacts/api-server/src/lib/session-readiness';
 export {default as sessionLibrary} from 'express-session';
 export {default as auth} from './artifacts/api-server/src/routes/auth';
 export {default as health} from './artifacts/api-server/src/routes/health';
 export {default as routes} from './artifacts/api-server/src/routes';
 export {usersTable as registrationSchema} from './lib/db/src/schema/users';
 export {fixture} from 'fixture';
`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'offline',setup(b){
 b.onResolve({filter:/^express-session$/},()=>({path:require.resolve('express-session')}));
 b.onResolve({filter:/^(fixture|express|bcrypt|@workspace\/db)$/},a=>({path:a.path,namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents: a.path==='fixture'?`export const fixture={rows:[],valid:true,error:null,ready:true,events:[],queries:[],hashCalls:[]};`:a.path==='express'?`
 export function Router(){const r={stack:[]};for(const method of ['get','post','patch','put','delete','use'])r[method]=(...args)=>{r.stack.push({method,args});return r};return r;}
 `:a.path==='bcrypt'?`import {fixture as f} from 'fixture';export default {hash:async(value,rounds)=>{f.hashCalls.push({value,rounds});return 'synthetic'},compare:async()=>f.valid};`:`
 import {fixture as f} from 'fixture';
 export const usersTable={email:'email',id:'id'};
 const run=async()=>{if(f.error)throw f.error;const value=f.rows.shift()??[];if(value instanceof Error)throw value;return value};
 export const db={select:()=>({from:()=>({where:run})}),update:()=>({set:()=>({where:()=>({returning:run})})})};
 export const pool={query:async(text,values)=>{
  if(text.startsWith('INSERT') || text.startsWith('UPDATE public.users')){f.queries.push({text,values});return {rows:await run()}}
  if(text!=='SELECT id FROM users LIMIT 0')throw new Error('Unexpected offline query');
  if(!f.ready)throw new Error('secret connection details');return {rows:[]}
 },connect:async()=>{
  if(f.connectFailure)throw new Error('private connection details');
  return {release(discard){f.sessionQueries.push({text:'RELEASE',values:[discard]})},query:async(text,values)=>{
   f.sessionQueries.push({text,values});
   if(f.onQuery)await f.onQuery(text,values);
   if(f.failQuery && text.startsWith(f.failQuery))throw new Error('private SQL details');
   if(text.startsWith('BEGIN')||text.startsWith('SET LOCAL')||text==='COMMIT'||text==='ROLLBACK')return {rows:[]};
   if(text==='SELECT 1'){if(!f.ready)throw new Error('private details');return {rows:[{}]}};
   if(text.startsWith('WITH required_columns'))return {rows:[f.readinessFlags]};
   if(text.endsWith('LIMIT 0'))return {rows:[]};
   if(text.startsWith('SELECT floor'))return {rows:[{now:String(f.now)}]};
   if(text.startsWith('SELECT auth_version'))return {rows:f.accountVersion===null?[]:[{authVersion:f.accountVersion}]};
   if(text.startsWith('SELECT sess,'))return {rows:f.sessionRow?[structuredClone(f.sessionRow)]:[]};
   if(text.startsWith('SELECT EXISTS'))return {rows:[{revoked:f.marked}]};
   if(text.startsWith('SELECT auth.revoke_'))return {rows:[{result:f.revokeResult}]};
   if(text.startsWith('UPDATE public.users'))return pool.query(text,values);
   if(text.startsWith('INSERT INTO auth.sessions')||text.startsWith('UPDATE auth.sessions'))return {rows:[]};
   throw new Error('Unexpected transaction query');
  }};
 }};
 `}));
}}]});
const compiled=new Module(path.resolve('tests/security-memory.cjs'));
compiled._compile(result.outputFiles[0].text,compiled.id);
const api=compiled.exports;
const sid='offline-session-identifier-000001';
const now=1792500000000;
const identity=()=>({userId:1,authVersion:1,issuedAt:now-1000,lastActivityAt:now-1000,absoluteExpiresAt:now-1000+604800000});
const user={id:1,email:'test@example.invalid',name:'Test',passwordHash:'synthetic',providers:null,createdAt:new Date(0)};
function response(){return {code:200,body:null,cleared:false,status(c){this.code=c;return this},json(v){this.body=v;return this},clearCookie(){this.cleared=true},setHeader(){}}}
function request(body={},failure){const req={body,method:'POST',sessionID:sid,session:null};const make=()=>({regenerate(cb){api.fixture.events.push('regenerate');if(failure==='regenerate')return cb(new Error('secret'));req.sessionID='rotated-session-identifier-000001';req.session=make();cb()},save(cb){api.fixture.events.push('save');cb(failure==='save'?new Error('secret'):null)},destroy(cb){api.fixture.events.push('destroy');delete req.session.userId;cb(failure==='destroy'?new Error('secret'):null)}});req.session=make();return req}
async function call(router,url,req){const route=router.stack.find(r=>r.args[0]===url);assert.ok(route);const res=response();try{for(const handler of route.args.slice(1)){let next=false;let failure;await handler(req,res,error=>{next=true;failure=error});if(failure)throw failure;if(!next)break}}catch(e){api.safeErrorHandler(e,req,res,()=>{})}return res}
test.beforeEach(()=>{Object.assign(api.fixture,{rows:[],valid:true,error:null,ready:true,readinessFlags:{identity_ok:true,utc_ok:true,required_ok:true,restricted_ok:true,functions_ok:true,schema_ok:true,auth_limits_ok:true},events:[],queries:[],hashCalls:[],sessionQueries:[],now,accountVersion:1,marked:false,revokeResult:'revoked',failQuery:null,connectFailure:false,onQuery:null,sessionRow:{sess:identity(),canonical:true,expires:String(now-1000+86400000)}})});
test('login regenerates and saves before returning a sanitized user',async()=>{api.fixture.rows=[[user]];const req=request({email:user.email,password:'synthetic-password'});req.session.userId=99;const res=await call(api.auth,'/auth/login',req);assert.equal(res.code,200);assert.equal(req.session.userId,1);assert.deepEqual(api.fixture.events,['regenerate','save']);assert.equal(res.body.passwordHash,undefined)});
test('unknown user and invalid password are unauthorized',async()=>{for(const rows of [[],[user]]){api.fixture.rows=[rows];api.fixture.valid=false;const res=await call(api.auth,'/auth/login',request({email:user.email,password:'synthetic-password'}));assert.equal(res.code,401);assert.deepEqual(api.fixture.events,[])}});

test('new registration rejects short passwords but existing short-password login still works',async()=>{
 for(const password of ['password','x'.repeat(14),'😀'.repeat(8)]) {
  assert.equal((await call(api.auth,'/auth/register',request({email:user.email,name:'Test',password}))).code,400);
 }
 assert.equal(api.fixture.hashCalls.length,0);
 api.fixture.rows=[[user]];
 assert.equal((await call(api.auth,'/auth/login',request({email:user.email,password:'password'}))).code,200);
});
test('registration saves a new session and returns 201',async()=>{api.fixture.rows=[[],[user]];const res=await call(api.auth,'/auth/register',request({email:user.email,name:'Test',password:'synthetic-password'}));assert.equal(res.code,201);assert.deepEqual(api.fixture.events,['regenerate','save'])});

test('registration executes only the three approved INSERT columns with separate bindings', async () => {
 const body={email:"O'Hara@example.invalid",name:"Test'); DROP TABLE users; --",password:'synthetic-password'};
 api.fixture.rows=[[],[{...user,email:body.email,name:body.name}]];
 const res=await call(api.auth,'/auth/register',request(body));
 assert.equal(res.code,201);
 assert.equal(api.fixture.queries.length,1);
 const {text,values}=api.fixture.queries[0];
 const sql=text.replace(/\s+/g,' ').trim();
 assert.match(sql,/^INSERT INTO public\.users \(email, name, password_hash\) VALUES \(\$1, \$2, \$3\) RETURNING /);
 assert.deepEqual(text.match(/\$\d+/g),['$1','$2','$3']);
 assert.deepEqual(values,[body.email,body.name,'synthetic']);
 for(const value of [body.email,body.name,body.password,'synthetic'])assert.equal(text.includes(value),false);
 assert.deepEqual(api.fixture.hashCalls,[{value:body.password,rounds:12}]);
 assert.equal(res.body.email,body.email); // Preserve existing case-sensitive input behavior.
});

test('client security/default fields cannot enter registration bindings or replace returned defaults', async () => {
 const returned={...user,authVersion:1,updatedAt:new Date(0)};
 api.fixture.rows=[[],[returned]];
 const req=request({email:user.email,name:user.name,password:'synthetic-password',id:999,userId:999,
  authVersion:999,auth_version:999,passwordHash:'client-supplied',password_hash:'client-supplied',
  providers:['client-supplied'],createdAt:'client-supplied',updatedAt:'client-supplied'});
 req.session.userId=999;
 const res=await call(api.auth,'/auth/register',req);
 assert.equal(res.code,201);
 assert.deepEqual(api.fixture.queries[0].values,[user.email,user.name,'synthetic']);
 assert.deepEqual(res.body,{id:1,email:user.email,name:user.name,providers:null,createdAt:new Date(0).toISOString()});
 assert.equal(req.session.userId,1);
 assert.deepEqual(api.fixture.events,['regenerate','save']);
});

test('omitted registration columns retain their schema defaults and nullable providers', () => {
 const schema=api.registrationSchema;
 assert.equal(schema.id.hasDefault,true);
 assert.equal(schema.authVersion.default,1);
 assert.equal(schema.authVersion.notNull,true);
 assert.equal(schema.providers.notNull,false);
 assert.equal(schema.providers.default,undefined);
 const {PgDialect}=require('drizzle-orm/pg-core');
 for(const key of ['createdAt','updatedAt']) {
  assert.equal(schema[key].hasDefault,true);
  assert.equal(new PgDialect().sqlToQuery(schema[key].default).sql,'now()');
 }
});

test('registration RETURNING aliases preserve user fields and native pg timestamp decoding', async () => {
 api.fixture.rows=[[],[user]];
 await call(api.auth,'/auth/register',request({email:user.email,name:user.name,password:'synthetic-password'}));
 assert.equal(api.fixture.queries[0].text.split('RETURNING ')[1].replace(/\s+/g,' ').trim(),
  'id, email, name, password_hash AS "passwordHash", auth_version AS "authVersion", providers, created_at AS "createdAt", updated_at AS "updatedAt"');
 const dbRequire=createRequire(path.resolve('lib/db/package.json'));
 const date=dbRequire('pg').types.getTypeParser(1184)('2026-10-16 12:00:00+00');
 assert.ok(date instanceof Date);
 assert.equal(date.toISOString(),'2026-10-16T12:00:00.000Z');
});

test('invalid registration input cannot reach hashing or INSERT', async () => {
 const valid={email:user.email,name:user.name,password:'synthetic-password'};
 for(const body of [null,{}, {...valid,email:'bad'}, {...valid,email:' test@example.invalid '},
  {...valid,name:' '}, {...valid,name:'x'.repeat(201)}, {...valid,password:'short'},
  {...valid,password:'x'.repeat(73)}, {...valid,password:'é'.repeat(37)}]) {
  assert.equal((await call(api.auth,'/auth/register',request(body))).code,400);
 }
 assert.deepEqual(api.fixture.queries,[]);
 assert.deepEqual(api.fixture.hashCalls,[]);
 assert.deepEqual(api.fixture.events,[]);
});

test('registration precheck rejects duplicates before hashing or INSERT', async () => {
 api.fixture.rows=[[user]];
 const res=await call(api.auth,'/auth/register',request({email:user.email,name:user.name,password:'synthetic-password'}));
 assert.equal(res.code,409);
 assert.deepEqual(api.fixture.queries,[]);
 assert.deepEqual(api.fixture.hashCalls,[]);
 assert.deepEqual(api.fixture.events,[]);
});

test('raw pg unique-constraint errors remain sanitized conflicts', async () => {
 const error=new Error('private query parameters');error.code='23505';
 api.fixture.rows=[[],error];
 const res=await call(api.auth,'/auth/register',request({email:user.email,name:user.name,password:'synthetic-password'}));
 assert.equal(res.code,409);
 assert.deepEqual(res.body,{error:'Email already in use'});
 assert.deepEqual(api.fixture.events,[]);
});

test('failed or empty registration INSERT never creates an authenticated session', async () => {
 for(const outcome of [new Error('private query parameters'),[]]) {
  api.fixture.rows=[[],outcome];
  const res=await call(api.auth,'/auth/register',request({email:user.email,name:user.name,password:'synthetic-password'}));
  assert.equal(res.code,503);
  assert.deepEqual(res.body,{error:'Service temporarily unavailable'});
  assert.deepEqual(api.fixture.events,[]);
 }
});

for(const failure of ['regenerate','save'])test(`registration session ${failure} failure does not report success`, async () => {
 api.fixture.rows=[[],[user]];
 const req=request({email:user.email,name:user.name,password:'synthetic-password'},failure);
 const res=await call(api.auth,'/auth/register',req);
 assert.equal(res.code,503);
 assert.equal(req.session.userId,undefined);
 assert.equal(res.cleared,true);
 assert.deepEqual(res.body,{error:'Service temporarily unavailable'});
});
test('registration unique-constraint race returns 409 without leaking SQL',async()=>{const error=new Error('private SQL values');error.cause={code:'23505'};api.fixture.rows=[[],error];const res=await call(api.auth,'/auth/register',request({email:user.email,name:'Test',password:'synthetic-password'}));assert.equal(res.code,409);assert.deepEqual(api.fixture.events,[]);assert.ok(!JSON.stringify(res).includes('private'))});
test('duplicate account and database failures return controlled errors',async()=>{api.fixture.rows=[[user]];assert.equal((await call(api.auth,'/auth/register',request({email:user.email,name:'Test',password:'synthetic-password'}))).code,409);api.fixture.error=new Error('password=secret');const res=await call(api.auth,'/auth/login',request({email:user.email,password:'synthetic-password'}));assert.equal(res.code,503);assert.ok(!JSON.stringify(res).includes('secret'))});
for(const failure of ['regenerate','save'])test(`session ${failure} failure never authenticates`,async()=>{api.fixture.rows=[[user]];const req=request({email:user.email,password:'synthetic-password'},failure);const res=await call(api.auth,'/auth/login',req);assert.equal(res.code,503);assert.equal(req.session.userId,undefined);assert.equal(res.cleared,true)});
test('logout clears cookie and distinguishes store failure',async()=>{for(const failure of [undefined,'destroy']){const req=request({},failure);req.session.userId=1;const res=await call(api.auth,'/auth/logout',req);assert.equal(res.code,failure?503:200);assert.equal(res.cleared,true);if(failure)assert.equal(res.body.success,undefined)}});
test('authentication middleware rejects absent and malformed identities',async()=>{for(const id of [undefined,0,-1,'1',1.5]){const res=response();let next=false;await api.requireAuth({sessionID:sid,session:{userId:id}},res,error=>{assert.ifError(error);next=true});assert.equal(res.code,401);assert.equal(next,false)}let next=false;await api.requireAuth({sessionID:sid,session:{userId:1}},response(),error=>{assert.ifError(error);next=true});assert.equal(next,true)});
test('all operational routers are behind authentication',()=>{const entries=api.routes.stack;assert.equal(entries[1].args[0],api.requireAuth);assert.equal(entries.slice(2).length,8);const res=response();entries[1].args[0]({session:{}},res,()=>assert.fail('unauthorized traversal'));assert.equal(res.code,401)});
test('origin policy rejects foreign, null and missing unsafe origins',()=>{const guard=api.originProtection(new Set(['http://127.0.0.1:5173']));for(const origin of ['https://evil.invalid','null',undefined]){const res=response();guard({method:'POST',get:n=>n==='origin'?origin:undefined},res,()=>assert.fail('origin accepted'));assert.equal(res.code,403)}for(const headers of [{origin:'http://127.0.0.1:5173'},{referer:'http://127.0.0.1:5173/login'}]){let next=false;guard({method:'POST',get:n=>headers[n]},response(),()=>next=true);assert.equal(next,true)}});
test('origin configuration is explicit; insecure production origins rejected',()=>{assert.deepEqual([...api.securityConfig({}).origins],['http://127.0.0.1:5173']);assert.throws(()=>api.securityConfig({NODE_ENV:'production',APP_ORIGIN:'http://example.invalid'}));assert.throws(()=>api.securityConfig({CORS_ORIGINS:'*'}));assert.equal(api.securityConfig({HOST:'0.0.0.0'}).host,'0.0.0.0')});
test('CORS headers are limited to explicitly allowed origins',()=>{const cors=require('cors')(api.corsOptions(new Set(['http://127.0.0.1:5173'])));for(const origin of ['http://127.0.0.1:5173','https://evil.invalid']){const headers={};const res={setHeader(k,v){headers[k]=v},getHeader(k){return headers[k]}};cors({method:'GET',headers:{origin}},res,()=>{});assert.equal(headers['Access-Control-Allow-Origin'],origin.startsWith('http://127')?origin:undefined);if(origin.startsWith('http://127'))assert.equal(headers['Access-Control-Allow-Credentials'],'true')}});
test('provider selection handles valid updates and missing users',async()=>{for(const found of [true,false]){api.fixture.rows=[found?[user]:[]];const req=request({providers:['openai']});req.session.userId=1;const res=await call(api.auth,'/auth/providers',req);assert.equal(res.code,found?200:401)}});
test('cookie settings and production store fail-closed policy',()=>{assert.deepEqual(api.cookieOptions(false),{httpOnly:true,sameSite:'lax',secure:false,path:'/'});assert.equal(api.cookieOptions(true).secure,true);assert.throws(()=>api.sessionOptions({SESSION_SECRET:'short'}));assert.throws(()=>api.sessionOptions({SESSION_SECRET:'x'.repeat(32),NODE_ENV:'production'}));assert.throws(()=>api.sessionOptions({SESSION_SECRET:'x'.repeat(32)},new api.sessionLibrary.MemoryStore()));const store=new api.PersistentSessionStore();const options=api.sessionOptions({SESSION_SECRET:'x'.repeat(32),NODE_ENV:'production'},store);assert.equal(options.saveUninitialized,false);assert.equal(options.resave,false);assert.equal(options.rolling,false);assert.equal(options.cookie.secure,true);store.close()});
test('malformed auth and provider inputs rejected safely',async()=>{for(const body of [undefined,null,{}, {email:'bad',password:'synthetic-password'}, {email:user.email,password:'x'.repeat(73)}]){assert.equal((await call(api.auth,'/auth/login',request(body))).code,400)}const req=request(null);req.session.userId=1;assert.equal((await call(api.auth,'/auth/providers',req)).code,400)});
test('parser failures do not disclose body or internal errors',()=>{for(const [type,code] of [['entity.parse.failed',400],['entity.too.large',413]]){const res=response();api.safeErrorHandler({type,message:'secret',body:'secret'},{},res,()=>{});assert.equal(res.code,code);assert.ok(!JSON.stringify(res).includes('secret'))}});
test('liveness and readiness distinguish unavailable database',async()=>{api.fixture.ready=false;assert.equal((await call(api.health,'/healthz',request())).code,200);let res=await call(api.health,'/readyz',request());assert.equal(res.code,503);assert.equal(res.body.database,'unavailable');api.fixture.ready=true;res=await call(api.health,'/readyz',request());assert.equal(res.body.database,'available');assert.equal(res.body.sessions,'ready');assert.equal(res.code,200)});

// These tests execute the real policy, transaction and store methods against a
// deterministic SQL transport double. They do not execute PostgreSQL or prove
// its lock behavior/privileges; those remain separate live acceptance gates.
const sqlCalls = () => api.fixture.sessionQueries.map(q => q.text);
const payload = () => ({...identity(), cookie:new api.sessionLibrary.Cookie({maxAge:604800000})});

test('policy rejects missing, malformed, extra and out-of-range metadata', () => {
 const good=identity();
 for(const value of [null,undefined,[],{}, {userId:1}, {...good,userId:'1'},
  {...good,authVersion:0},{...good,authVersion:2147483648},{...good,issuedAt:1.5},
  {...good,lastActivityAt:now+1},{...good,lastActivityAt:good.issuedAt-1},
  {...good,absoluteExpiresAt:good.absoluteExpiresAt+1},{...good,cookie:null},
  {...good,password:'forbidden'},{...good,reauthenticatedAt:now+1}]) {
  assert.equal(api.sessionIdentity(value,now),null);
 }
 assert.deepEqual(api.sessionIdentity(good,now),good);
});

test('idle and absolute deadlines reject equality, not just times beyond expiry', () => {
 const good=identity();
 assert.ok(api.sessionIdentity(good,good.lastActivityAt+api.IDLE_MS-1));
 assert.equal(api.sessionIdentity(good,good.lastActivityAt+api.IDLE_MS),null);
 const nearAbsolute={...good,lastActivityAt:good.absoluteExpiresAt-1000};
 assert.equal(api.deadline(nearAbsolute),good.absoluteExpiresAt);
 assert.ok(api.sessionIdentity(nearAbsolute,good.absoluteExpiresAt-1));
 assert.equal(api.sessionIdentity(nearAbsolute,good.absoluteExpiresAt),null);
});

test('runtime rejects absent rows, noncanonical metadata, stale versions and markers', async () => {
 const original=structuredClone(api.fixture.sessionRow);
 for(const failure of ['missing','canonical','metadata','account','version','marker','expiry','overlong']) {
  Object.assign(api.fixture,{sessionRow:structuredClone(original),accountVersion:1,marked:false,sessionQueries:[]});
  if(failure==='missing')api.fixture.sessionRow=null;
  if(failure==='canonical')api.fixture.sessionRow.canonical=false;
  if(failure==='metadata')api.fixture.sessionRow.sess={userId:1};
  if(failure==='account')api.fixture.accountVersion=null;
  if(failure==='version')api.fixture.accountVersion=2;
  if(failure==='marker')api.fixture.marked=true;
  if(failure==='expiry')api.fixture.sessionRow.expires=String(now);
  if(failure==='overlong')api.fixture.sessionRow.expires=String(now+api.ABSOLUTE_MS);
  await assert.rejects(api.sessions.authenticate(sid),api.Unauthenticated);
  assert.ok(sqlCalls().includes('ROLLBACK'));
  assert.ok(!sqlCalls().includes('COMMIT'));
 }
});

test('runtime rechecks metadata and DB time after account and session lock waits', async () => {
 for(const change of ['version','metadata','clock']) {
  Object.assign(api.fixture,{sessionRow:{sess:identity(),canonical:true,expires:String(now-1000+86400000)},now,accountVersion:1});
  api.fixture.onQuery=text=>{
   if(text.startsWith('SELECT auth_version') && change==='version')api.fixture.accountVersion=2;
   if(text.startsWith('SELECT sess,') && text.endsWith('FOR UPDATE')) {
    if(change==='metadata')api.fixture.sessionRow.sess.userId=2;
    if(change==='clock')api.fixture.now=identity().lastActivityAt+api.IDLE_MS;
   }
  };
  await assert.rejects(api.sessions.authenticate(sid),api.Unauthenticated);
 }
});

test('ordinary authentication uses account then SID ordering and does not extend activity', async () => {
 const original=structuredClone(api.fixture.sessionRow);
 assert.deepEqual(await api.sessions.authenticate(sid),identity());
 const calls=sqlCalls();
 assert.ok(calls.findIndex(s=>s.startsWith('SELECT auth_version')) < calls.findIndex(s=>s.startsWith('SELECT sess,')&&s.endsWith('FOR UPDATE')));
 assert.ok(calls.findIndex(s=>s.endsWith('FOR UPDATE')&&s.startsWith('SELECT sess,')) < calls.findIndex(s=>s.startsWith('SELECT EXISTS')));
 assert.ok(!calls.some(s=>/^(INSERT|UPDATE|DELETE)/.test(s)));
 assert.deepEqual(api.fixture.sessionRow,original);
 assert.ok(calls.includes("SET LOCAL TIME ZONE 'UTC'"));
});

test('delayed store writes cannot recreate a deleted row or bypass markers/version changes', async () => {
 const data=payload();
 for(const failure of ['deleted','marker','version','issuance','activity']) {
  Object.assign(api.fixture,{sessionRow:{sess:identity(),canonical:true,expires:String(now-1000+86400000)},accountVersion:1,marked:false,sessionQueries:[]});
  const attempted={...data};
  if(failure==='deleted')api.fixture.sessionRow=null;
  if(failure==='marker')api.fixture.marked=true;
  if(failure==='version')api.fixture.accountVersion=2;
  if(failure==='issuance'){attempted.issuedAt++;attempted.absoluteExpiresAt++;attempted.lastActivityAt++}
  if(failure==='activity')attempted.lastActivityAt++;
  await assert.rejects(api.sessions.save(sid,attempted),api.Unauthenticated);
  assert.ok(!sqlCalls().some(s=>/^(INSERT|UPDATE)/.test(s)));
 }
});

test('issuance reads the current account version under lock and writes only whitelisted metadata', async () => {
 api.fixture.sessionRow=null;api.fixture.accountVersion=3;
 const data={userId:1,cookie:new api.sessionLibrary.Cookie({maxAge:604800000})};
 await api.sessions.issuing(1,()=>api.sessions.save(sid,data));
 const insert=api.fixture.sessionQueries.find(q=>q.text.startsWith('INSERT INTO auth.sessions'));
 const persisted=JSON.parse(insert.values[1]);
 assert.deepEqual(Object.keys(persisted).sort(),['absoluteExpiresAt','authVersion','cookie','issuedAt','lastActivityAt','userId'].sort());
 assert.equal(persisted.authVersion,3);assert.equal(persisted.issuedAt,now);
 assert.equal(persisted.lastActivityAt,now);assert.equal(persisted.absoluteExpiresAt,now+api.ABSOLUTE_MS);
 assert.equal(insert.values[2],Math.ceil((now+api.IDLE_MS)/1000));
 assert.ok(sqlCalls().includes('COMMIT'));
});

test('issuance rejects existing or quarantined SIDs without overwriting them', async () => {
 for(const existing of [true,false]) {
  api.fixture.sessionRow=existing?{sess:identity(),canonical:true,expires:String(now+1000)}:null;
  api.fixture.marked=!existing;api.fixture.sessionQueries=[];
  await assert.rejects(api.sessions.issuing(1,()=>api.sessions.save(sid,payload())),api.Unauthenticated);
  assert.ok(!sqlCalls().some(s=>s.startsWith('INSERT')));
 }
});

test('logout commits invalid-session quarantine but does not report authentication or success', async () => {
 api.fixture.revokeResult='invalid_session';
 const req=request({sid:'attacker-supplied',userId:999});req.session.userId=1;
 const res=await call(api.auth,'/auth/logout-all',req);
 assert.equal(res.code,401);assert.equal(res.body.success,undefined);
 assert.ok(sqlCalls().includes('COMMIT'));
 const revoke=api.fixture.sessionQueries.find(q=>q.text.startsWith('SELECT auth.revoke_all_sessions'));
 assert.deepEqual(revoke.values,[sid]);
});

test('logout transaction and commit failures never return success or leak diagnostics', async () => {
 for(const failure of ['SELECT auth.revoke_','COMMIT']) {
  api.fixture.failQuery=failure;api.fixture.sessionQueries=[];
  const req=request();req.session.userId=1;
  const res=await call(api.auth,'/auth/logout',req);
  assert.equal(res.code,503);assert.equal(res.body.success,undefined);assert.equal(res.cleared,true);
  assert.ok(!JSON.stringify(res).includes('private'));
  assert.ok(sqlCalls().includes('ROLLBACK'));
 }
});

test('pool acquisition failures are sanitized and never authenticate', async () => {
 api.fixture.connectFailure=true;
 await assert.rejects(api.sessions.authenticate(sid),{message:'Session service unavailable'});
 const req=request();req.session.userId=1;
 const res=await call(api.auth,'/auth/me',req);
 assert.equal(res.code,503);assert.ok(!JSON.stringify(res).includes('private'));
});

test('protected provider write revalidates under locks, retains updated_at and commits before success', async () => {
 api.fixture.rows=[[{...user,providers:'["openai"]'}]];
 const req=request({providers:['openai'],userId:999});req.session.userId=1;
 const res=await call(api.auth,'/auth/providers',req);
 assert.equal(res.code,200);assert.deepEqual(res.body.providers,['openai']);
 const query=api.fixture.queries[0];
 assert.match(query.text,/SET providers = \$1, updated_at = clock_timestamp\(\)/);
 assert.deepEqual(query.values,['["openai"]',1]);
 assert.equal(sqlCalls().filter(s=>s.startsWith('SELECT auth_version')).length,2); // middleware and mutation; session.save is a route-level double
 const calls=sqlCalls();
 const update=calls.findIndex(s=>s.startsWith('UPDATE public.users'));
 assert.ok(update>calls.findIndex(s=>s.startsWith('SELECT EXISTS')));
 assert.ok(calls.lastIndexOf('COMMIT')>update);
});

test('revocation between middleware and mutation prevents provider writes', async () => {
 let accountReads=0;
 api.fixture.onQuery=text=>{
  if(text.startsWith('SELECT auth_version') && ++accountReads===2)api.fixture.accountVersion=2;
 };
 const req=request({providers:['openai']});req.session.userId=1;
 const res=await call(api.auth,'/auth/providers',req);
 assert.equal(res.code,401);assert.deepEqual(api.fixture.queries,[]);
 assert.ok(sqlCalls().includes('ROLLBACK'));
});

test('logout response waits for commit confirmation', async () => {
 let releaseCommit,enteredCommit;
 const entered=new Promise(resolve=>{enteredCommit=resolve});
 const gate=new Promise(resolve=>{releaseCommit=resolve});
 api.fixture.onQuery=async text=>{if(text==='COMMIT'){enteredCommit();await gate}};
 const req=request();req.session.userId=1;
 const res=response();
 const pending=api.logout(req,res);
 await entered;
 assert.equal(res.body,null);
 releaseCommit();await pending;
 assert.deepEqual(res.body,{success:true});
});

test('failed protected mutation rolls back and never advances session activity', async () => {
 await assert.rejects(api.sessions.mutate(sid,async()=>{throw new Error('private mutation failure')}),{message:'Session service unavailable'});
 assert.ok(sqlCalls().includes('ROLLBACK'));
 assert.ok(!sqlCalls().some(s=>s.startsWith('UPDATE auth.sessions')));
});

test('store touch is inert and cookie touch stays at the absolute deadline', async () => {
 const store=new api.PersistentSessionStore();
 await new Promise(resolve=>store.touch(sid,payload(),resolve));
 assert.deepEqual(api.fixture.sessionQueries,[]);
 const req=request();Object.assign(req.session,identity(),{cookie:new api.sessionLibrary.Cookie({maxAge:604800000})});
 api.absoluteCookie(req,response(),()=>{});
 req.session.touch();req.session.touch();
 assert.equal(req.session.cookie.expires.getTime(),identity().absoluteExpiresAt);
 assert.equal(req.session.lastActivityAt,identity().lastActivityAt);
 store.close();
});

test('guarded store propagates failed late writes and revocation failures to callbacks', async () => {
 const store=new api.PersistentSessionStore();
 api.fixture.marked=true;
 await assert.rejects(new Promise((resolve,reject)=>store.set(sid,payload(),error=>error?reject(error):resolve())),api.Unauthenticated);
 api.fixture.failQuery='SELECT auth.revoke_';
 await assert.rejects(new Promise((resolve,reject)=>store.destroy(sid,error=>error?reject(error):resolve())),{message:'Session revocation unavailable'});
 store.close();
});

test('real Express session rotates SID, quarantines the old SID and saves DB-issued metadata', async t => {
 const store=new api.PersistentSessionStore();
 const socket=new Socket(); // Unconnected: no application server or network.
 t.after(()=>{socket.destroy();store.close()});
 const req=new IncomingMessage(socket);req.url='/auth/login';req.method='POST';
 const res=new ServerResponse(req);
 const middleware=api.sessionLibrary(api.sessionOptions({SESSION_SECRET:'offline-fixture-not-a-deployed-secret'},store));
 await new Promise((resolve,reject)=>middleware(req,res,error=>error?reject(error):resolve()));
 const oldSid=req.sessionID;
 api.fixture.sessionRow=null;
 await api.establishSession(req,res,1);
 assert.notEqual(req.sessionID,oldSid);
 assert.match(req.sessionID,/^[A-Za-z0-9_-]{32,128}$/);
 assert.equal(req.session.authVersion,1);
 assert.equal(req.session.issuedAt,now);
 assert.equal(req.session.absoluteExpiresAt,now+api.ABSOLUTE_MS);
 const revocation=api.fixture.sessionQueries.find(q=>q.text.startsWith('SELECT auth.revoke_current_session'));
 assert.deepEqual(revocation.values,[oldSid]);
 const insertion=api.fixture.sessionQueries.find(q=>q.text.startsWith('INSERT INTO auth.sessions'));
 assert.equal(insertion.values[0],req.sessionID);
 assert.ok(sqlCalls().indexOf('COMMIT')<sqlCalls().indexOf(insertion.text));
 req.session.touch();
 assert.equal(req.session.cookie.expires.getTime(),now+api.ABSOLUTE_MS);
});

test('missing session secret prevents store creation and application setup', async () => {
 let calls=0;
 const compiled=await build({entryPoints:['artifacts/api-server/src/app.ts'],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'containment',setup(b){
  b.onResolve({filter:/.*/},a=>a.kind==='entry-point'?undefined:{path:a.path,namespace:'stub'});
  b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:`const stop=()=>{globalThis.called();throw new Error('Unexpected dependency execution')};export default stop;export const PersistentSessionStore=stop,securityConfig=stop,sessionOptions=stop,originProtection=stop,corsOptions=stop,safeErrorHandler=stop,absoluteCookie=stop,productionWeb=stop,authProtection=stop,proxyConfiguration=stop,renderRequestProtection=stop,PostgresAuthAttempts=stop;export const logger={};`}));
 }}]});
 assert.throws(()=>vm.runInNewContext(compiled.outputFiles[0].text,{module:{exports:{}},exports:{},called(){calls++},process:{env:{}}}),{message:'SESSION_SECRET environment variable is required.'});
 assert.equal(calls,0);
 assert.doesNotMatch(fs.readFileSync('artifacts/api-server/src/app.ts','utf8'),/stopUnverifiedSessionStartup/);
});

test('store construction is offline; initialization checks session prerequisites without writing', async () => {
 const store=new api.PersistentSessionStore();
 try {
  assert.deepEqual(sqlCalls(),[]);
  await store.initialize();
  assert.ok(sqlCalls().includes('BEGIN READ ONLY'));
  assert.ok(sqlCalls().includes("SET LOCAL statement_timeout = '2s'"));
  assert.ok(sqlCalls().includes("SET LOCAL lock_timeout = '1s'"));
  for(const relation of ['auth.sessions','auth.revoked_sessions','public.users']) {
   assert.ok(sqlCalls().some(sql=>sql.includes('FROM '+relation+' LIMIT 0')));
  }
  assert.ok(sqlCalls().includes('COMMIT'));
  assert.ok(!sqlCalls().some(sql=>/^(INSERT|UPDATE|DELETE|CREATE|GRANT)/.test(sql)));
 } finally { store.close(); }
});

for(const flag of ['identity_ok','utc_ok','required_ok','restricted_ok','functions_ok','schema_ok','auth_limits_ok']) {
 test(`readiness and initialization fail closed for ${flag}, despite database availability`, async () => {
  api.fixture.readinessFlags[flag]=false;
  const res=await call(api.health,'/readyz',request());
  assert.equal(res.code,503);
  assert.deepEqual(res.body,{status:'unavailable',process:'available',database:'available',sessions:'unavailable'});
  assert.ok(sqlCalls().includes('ROLLBACK'));
  const store=new api.PersistentSessionStore();
  try { await assert.rejects(store.initialize(),{message:'Persistent session store is not ready'}); }
  finally { store.close(); }
 });
}

test('readiness rejects incomplete catalog responses and sanitizes SQL/read failures', async () => {
 for(const mode of ['missing','null','catalog','table','commit']) {
  api.fixture.readinessFlags={identity_ok:true,utc_ok:true,required_ok:true,restricted_ok:true,functions_ok:true,schema_ok:true,auth_limits_ok:true};
  api.fixture.failQuery=null;
  if(mode==='missing')delete api.fixture.readinessFlags.functions_ok;
  if(mode==='null')api.fixture.readinessFlags.schema_ok=null;
  if(mode==='catalog')api.fixture.failQuery='WITH required_columns';
  if(mode==='table')api.fixture.failQuery='SELECT sid, sess, expire';
  if(mode==='commit')api.fixture.failQuery='COMMIT';
  const state=await api.checkSessionReadiness();
  assert.equal(state.status,'unavailable');assert.equal(state.sessions,'unavailable');
  assert.ok(!JSON.stringify(state).includes('private'));
 }
});

test('database connection failure keeps sessions unchecked; rollback failure discards client', async () => {
 api.fixture.connectFailure=true;
 assert.deepEqual(await api.checkSessionReadiness(),{status:'unavailable',process:'available',database:'unavailable',sessions:'unchecked'});
 assert.deepEqual(sqlCalls(),[]);
 api.fixture.connectFailure=false;api.fixture.readinessFlags.required_ok=false;api.fixture.failQuery='ROLLBACK';
 assert.equal((await api.checkSessionReadiness()).status,'unavailable');
 assert.deepEqual(api.fixture.sessionQueries.at(-1),{text:'RELEASE',values:[true]});
});

test('protected routes reject stale, revoked, expired and unavailable sessions before traversal', async () => {
 for(const mode of ['version','marker','expiry','database']) {
  Object.assign(api.fixture,{accountVersion:1,marked:false,now,connectFailure:false});
  if(mode==='version')api.fixture.accountVersion=2;
  if(mode==='marker')api.fixture.marked=true;
  if(mode==='expiry')api.fixture.now=identity().lastActivityAt+api.IDLE_MS;
  if(mode==='database')api.fixture.connectFailure=true;
  const req=request();req.session.userId=1;
  const res=response();let passed=false;
  await api.requireAuth(req,res,error=>{if(error)api.safeErrorHandler(error,req,res,()=>{});else passed=true});
  assert.equal(passed,false);assert.equal(res.code,mode==='database'?503:401);
 }
});

test('health probes mount before session middleware without bypassing operational authentication', () => {
 const source=fs.readFileSync('artifacts/api-server/src/app.ts','utf8');
 assert.ok(source.indexOf('app.use("/api", healthRouter)') < source.indexOf('session(sessionOptions'));
 assert.ok(source.indexOf('session(sessionOptions') < source.indexOf('app.use("/api", router)'));
 assert.equal(api.routes.stack[1].args[0],api.requireAuth);
});

test('listener awaits readiness; initialization fails closed and shutdown drains before closing the pool', async () => {
 const bundled=await build({entryPoints:['artifacts/api-server/src/index.ts'],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'startup-isolation',setup(b){
  b.onResolve({filter:/.*/},a=>a.kind==='entry-point'?undefined:{path:a.path,namespace:'stub'});
  b.onLoad({filter:/.*/,namespace:'stub'},a=>({contents:a.path==='./app'?
   `export default {listen:()=>globalThis.fixture.listen()};export const persistentSessionStore={initialize:()=>globalThis.fixture.initialize()};`:
   a.path==='@workspace/db'?`export const pool={end:()=>globalThis.fixture.end()};`:
   `export const logger={error:(message)=>globalThis.fixture.errors.push(message),info:()=>{}};`}));
 }}]});
 for(const failure of [false,true]) {
  let release,entered;
  const ready=new Promise(resolve=>{entered=resolve});
  const gate=new Promise(resolve=>{release=resolve});
  let listens=0,closed=0,drains=0,drained;
  const handlers={};
  const fixture={errors:[],listen(){listens++;return {close(done){drains++;drained=done}}},async end(){closed++},async initialize(){entered();await gate;if(failure)throw new Error('private connection details')}};
  const context={module:{exports:{}},process:{env:{PORT:'3001'},once(name,handler){handlers[name]=handler}},fixture};context.exports=context.module.exports;
  vm.runInNewContext(bundled.outputFiles[0].text,context);
  await ready;assert.equal(listens,0);
  release();await context.module.exports.startup;
  assert.equal(listens,failure?0:1);assert.equal(closed,failure?1:0);
  assert.equal(context.process.exitCode,failure?1:undefined);
  assert.ok(!fixture.errors.join().includes('private'));
  if(!failure) {
   handlers.SIGTERM();handlers.SIGINT();
   assert.equal(drains,1);assert.equal(closed,0);
   drained();await Promise.resolve();assert.equal(closed,1);
  } else { assert.deepEqual(handlers,{}); }
 }
});
