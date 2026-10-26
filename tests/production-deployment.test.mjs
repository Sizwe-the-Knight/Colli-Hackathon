import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire, Module} from 'node:module';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import {request} from 'node:http';
const require=createRequire(path.resolve('artifacts/api-server/package.json'));
const express=require('express');
const {build}=require('esbuild');
const result=await build({stdin:{contents:`export * from './artifacts/api-server/src/lib/production-web'; export * from './artifacts/api-server/src/lib/auth-limits'; export {originProtection, cookieOptions} from './artifacts/api-server/src/lib/security';`,resolveDir:process.cwd()},bundle:true,write:false,platform:'node',format:'cjs',external:['express','express-session'],plugins:[{name:'offline-sessions',setup(b){b.onResolve({filter:/session-runtime$/},()=>({path:'sessions',namespace:'stub'}));b.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export const sessions = {};'}));}}]});
const mod=new Module(path.resolve('artifacts/api-server/offline.cjs'));mod.paths=Module._nodeModulePaths(path.resolve('artifacts/api-server'));mod._compile(result.outputFiles[0].text,mod.id);
const {productionWeb,proxyConfiguration,authProtection,clientNetwork,renderRequestProtection,originProtection,cookieOptions}=mod.exports;
async function serve(app,run){const s=app.listen(0,'127.0.0.1');await new Promise(r=>s.once('listening',r));try{await run(`http://127.0.0.1:${s.address().port}`)}finally{await new Promise(r=>s.close(r));}}
async function temporary(run){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'colli-deploy-'));try{await run(dir)}finally{await fs.rm(dir,{recursive:true,force:true})}}

test('production serves actual assets and SPA without sessions; API errors never become HTML',()=>temporary(async dir=>{
 await fs.writeFile(path.join(dir,'index.html'),'<!doctype html><title>Colli fixture</title>');
 await fs.mkdir(path.join(dir,'assets'));await fs.writeFile(path.join(dir,'assets/app.js'),'/* fixture */');
 const app=express();let sessions=0;
 productionWeb(app,{NODE_ENV:'production',FRONTEND_DIST:dir});
 app.use('/api',(_q,_s,next)=>{sessions++;next()});
 app.get('/api/healthz',(_q,s)=>s.json({status:'ok'}));
 app.use('/api',(_q,s)=>s.status(404).json({error:'API route not found'}));
 await serve(app,async base=>{
  for(const route of ['/','/brief','/dashboard','/login','/settings']){const r=await fetch(base+route);assert.equal(r.status,200);assert.match(await r.text(),/Colli fixture/);assert.equal(r.headers.get('set-cookie'),null);assert.equal(r.headers.get('cache-control'),'no-cache')}
  assert.match(await (await fetch(base+'/assets/app.js')).text(),/fixture/);
  for(const route of ['/assets/missing.js','/.env','/missing.png'])assert.equal((await fetch(base+route)).status,404);
  assert.equal((await fetch(base+'/brief',{method:'POST'})).status,404);
  assert.equal(sessions,0);
  for(const route of ['/api/no-such-route','/API/no-such-route']){const r=await fetch(base+route);assert.equal(r.status,404);assert.match(r.headers.get('content-type'),/json/)}
  assert.equal((await fetch(base+'/api/healthz')).status,200);
 });
}));
test('production refuses missing build, wildcard proxy',()=>{
 assert.throws(()=>productionWeb(express(),{NODE_ENV:'production'}));
 for(const proxy of [undefined,'true','1','0.0.0.0/0','::/0','loopback','127.0.0.1/32/1'])assert.throws(()=>proxyConfiguration(express(),{NODE_ENV:'production',TRUSTED_PROXY_ADDRESSES:proxy}));

});
test('IPv6 privacy/compression and IPv4 mapped aliases share limits',()=>{
 assert.equal(clientNetwork('::ffff:127.0.0.1'),clientNetwork('127.0.0.1'));
 assert.equal(clientNetwork('2001:db8:abcd:1::1'),clientNetwork('2001:0db8:abcd:0001:abcd::2'));
 assert.throws(()=>clientNetwork('unknown'));
});
test('untrusted forwarding cannot evade dev limits; only auth endpoints limited; responses sanitized',async()=>{
 const app=express();app.use('/api',authProtection({},testAttempts()));app.use((_q,s)=>s.json({ok:true}));
 await serve(app,async base=>{
  for(let i=0;i<3;i++)assert.equal((await fetch(base+'/api/auth/register',{method:'POST',headers:{'X-Forwarded-For':`192.0.2.${i}`}})).status,200);
  const r=await fetch(base+'/api/AUTH/REGISTER/',{method:'POST',headers:{'X-Forwarded-For':'192.0.2.99'}});
  assert.equal(r.status,429);assert.ok(r.headers.get('retry-after'));assert.doesNotMatch(await r.text(),/192\.0\.2/);
  assert.equal((await fetch(base+'/api/healthz')).status,200);
 });
});
test('production rejects direct/untrusted and insecure requests; verified proxy resolves client limits',async()=>{
 const env={NODE_ENV:'production',TRUSTED_PROXY_ADDRESSES:'127.0.0.1/32'};
 const app=express();proxyConfiguration(app,env);app.use('/api',authProtection(env,testAttempts()));app.use((_q,s)=>s.json({ok:true}));
 await serve(app,async base=>{
  assert.equal((await fetch(base+'/api/auth/login',{method:'POST'})).status,503);
  for(let i=0;i<3;i++)assert.equal((await fetch(base+'/api/auth/register',{method:'POST',headers:{'X-Forwarded-Proto':'https','X-Forwarded-For':'192.0.2.1'}})).status,200);
  assert.equal((await fetch(base+'/api/auth/register',{method:'POST',headers:{'X-Forwarded-Proto':'https','X-Forwarded-For':'192.0.2.1'}})).status,429);
 });
 const untrusted=express();proxyConfiguration(untrusted,{...env,TRUSTED_PROXY_ADDRESSES:'192.0.2.1/32'});untrusted.use('/api',authProtection(env,testAttempts()));
 await serve(untrusted,async base=>assert.equal((await fetch(base+'/api/auth/login',{method:'POST',headers:{'X-Forwarded-Proto':'https','X-Forwarded-For':'192.0.2.1'}})).status,503));
});

// Middleware fixture only: PostgreSQL enforcement is tested separately.
function testAttempts(){const counts=new Map();return {async take(kind,network){const key=kind+network,n=(counts.get(key)??0)+1;counts.set(key,n);return n>(kind==='register'?3:10)?60:0}}}

// Native HTTP preserves explicit Host and duplicate headers for ingress fixtures.
function renderFetch(url, options={}) {
 return new Promise((resolve,reject)=>{
  const headers=options.headers instanceof Headers?Object.fromEntries(options.headers):options.headers;
  const req=request(url,{...options,headers},res=>{res.resume();res.on('end',()=>resolve({status:res.statusCode}));});
  req.on('error',reject);req.end();
 });
}
const renderEnv={NODE_ENV:'production',PROXY_MODE:'render',RENDER:'true',RENDER_EXTERNAL_HOSTNAME:'colli-hackathon-demo.onrender.com',APP_ORIGIN:'https://colli-hackathon-demo.onrender.com'};
const renderHeaders={Host:'colli-hackathon-demo.onrender.com',Origin:renderEnv.APP_ORIGIN,'CF-Connecting-IP':'192.0.2.25','X-Forwarded-Proto':'https'};
function renderApp(store=testAttempts(),peer){
 const app=express();proxyConfiguration(app,renderEnv);
 if(peer)app.use((req,_res,next)=>{Object.defineProperty(req.socket,'remoteAddress',{value:peer,configurable:true});next()});
 app.use(renderRequestProtection(renderEnv));app.use(originProtection(new Set([renderEnv.APP_ORIGIN])));
 app.use('/api',authProtection(renderEnv,store));app.use((_req,res)=>res.json({ok:true}));return app;
}

test('Render requires explicit production/platform configuration and exact observed peer',()=>{
 for(const overrides of [{NODE_ENV:'development'},{RENDER:'false'},{APP_ORIGIN:'https://evil.example'},{APP_ORIGIN:renderEnv.APP_ORIGIN+'/path'},{TRUSTED_PROXY_ADDRESSES:'127.0.0.1'},{CORS_ORIGINS:'https://evil.example'},{RENDER_EXTERNAL_HOSTNAME:undefined}])assert.throws(()=>proxyConfiguration(express(),{...renderEnv,...overrides}));
 assert.throws(()=>proxyConfiguration(express(),{NODE_ENV:'production',RENDER:'true',TRUSTED_PROXY_ADDRESSES:'127.0.0.1'}));
 const app=express();proxyConfiguration(app,renderEnv);const trust=app.get('trust proxy fn');
 for(const ip of ['127.0.0.1','::ffff:127.0.0.1'])assert.equal(trust(ip),true);
 for(const ip of ['127.0.0.2','::1','10.0.0.1','192.0.2.1'])assert.equal(trust(ip),false);
});

test('Render uses CF identity only: forged XFF cannot change or reset registration network limits',async()=>{
 const networks=[],inner=testAttempts();const app=renderApp({async take(kind,ip){networks.push(ip);return inner.take(kind,ip)}});
 await serve(app,async base=>{
  for(let i=0;i<4;i++){
   const r=await renderFetch(base+'/api/auth/register',{method:'POST',headers:{...renderHeaders,'X-Forwarded-For':`198.51.100.${i}, 127.0.0.1`}});
   assert.equal(r.status,i<3?200:429);
  }
 });
 assert.deepEqual(networks,Array(4).fill('192.0.2.25'));
});

test('Render missing/malformed/duplicate client and protocol headers fail before limiter',async()=>{
 let calls=0;const app=renderApp({async take(){calls++;return 0}});
 await serve(app,async base=>{
  for(const ip of [undefined,'','unknown','192.0.2.1, 192.0.2.2','192.0.2.1:123','fe80::1%eth0','[2001:db8::1]']){
   const headers={...renderHeaders};if(ip===undefined)delete headers['CF-Connecting-IP'];else headers['CF-Connecting-IP']=ip;
   assert.equal((await renderFetch(base+'/api/auth/login',{method:'POST',headers})).status,503);
  }
  for(const proto of [undefined,'http','https, http','http, https']){
   const headers={...renderHeaders};if(proto===undefined)delete headers['X-Forwarded-Proto'];else headers['X-Forwarded-Proto']=proto;
   assert.equal((await renderFetch(base+'/api/auth/login',{method:'POST',headers})).status,503);
  }
  const headers=new Headers(renderHeaders);headers.append('CF-Connecting-IP','192.0.2.2');
  assert.equal((await renderFetch(base+'/api/auth/login',{method:'POST',headers})).status,503);
 });assert.equal(calls,0);
});

test('Render rejects untrusted immediate peers even with plausible forwarding headers',async()=>{
 let calls=0;await serve(renderApp({async take(){calls++;return 0}},'127.0.0.2'),async base=>{
  assert.equal((await renderFetch(base+'/api/auth/login',{method:'POST',headers:renderHeaders})).status,503);
 });assert.equal(calls,0);
});

test('Render Host/forwarded Host never override APP_ORIGIN; CSRF and secure cookie policy retained',async()=>{
 await serve(renderApp(),async base=>{
  for(const altered of [{Host:'evil.example'},{'X-Forwarded-Host':'evil.example'},{'X-Forwarded-Host':'colli-hackathon-demo.onrender.com, evil.example'}])assert.equal((await renderFetch(base+'/api/auth/login',{method:'POST',headers:{...renderHeaders,...altered}})).status,421);
  for(const altered of [{Origin:'https://evil.example'},{Origin:'http://colli-hackathon-demo.onrender.com'}])assert.equal((await renderFetch(base+'/api/auth/login',{method:'POST',headers:{...renderHeaders,...altered}})).status,403);
  const missing={...renderHeaders};delete missing.Origin;
  assert.equal((await renderFetch(base+'/api/auth/login',{method:'POST',headers:missing})).status,403);
  assert.equal((await renderFetch(base+'/api/auth/login',{method:'POST',headers:renderHeaders})).status,200);
  assert.equal((await renderFetch(base+'/api/healthz')).status,200);
  assert.equal((await renderFetch(base+'/api/readyz')).status,200);
  assert.equal((await renderFetch(base+'/api/auth/me')).status,503);
 });
 assert.deepEqual(cookieOptions(true),{httpOnly:true,sameSite:'lax',secure:true,path:'/'});
 assert.equal(cookieOptions(false).secure,false);
});

test('Neon pg configuration preserves certificate and hostname verification without connecting',()=>{
 const dbRequire=createRequire(path.resolve('lib/db/package.json'));const pg=dbRequire('pg');
 const client=new pg.Client({connectionString:'postgresql://colli_app:fixture@ep-fixture.eu-central-1.aws.neon.tech:5432/neondb?sslmode=verify-full'});
 assert.equal(client.host,'ep-fixture.eu-central-1.aws.neon.tech');assert.equal(typeof client.ssl,'object');
 assert.notEqual(client.ssl.rejectUnauthorized,false);assert.equal(client.ssl.checkServerIdentity,undefined);
});
