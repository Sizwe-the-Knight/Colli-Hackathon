import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRequire, Module } from 'node:module';
const root=process.cwd(),require=createRequire(path.join(root,'artifacts/api-server/package.json'));
const compiled=await require('esbuild').build({stdin:{contents:`
 export * from './artifacts/api-server/src/operational/narrator';
 export * from './artifacts/api-server/src/operational/narration-contract';
 export * from './artifacts/api-server/src/operational/narration-budget';
 export * from './artifacts/api-server/src/operational/usage';
 `,resolveDir:root},bundle:true,write:false,platform:'node',format:'cjs'});
const filename=path.join(root,'tests/narrator-compiled.cjs'),mod=new Module(filename);mod._compile(compiled.outputFiles[0].text,filename);
const api=mod.exports;
const input=JSON.parse(await fs.readFile('scripts/fixtures/usage-synthetic.json','utf8'));
const report=()=>api.processUsage(structuredClone(input));
const valid=body=>{const props=JSON.parse(body).response_format.json_schema.schema.properties;return Object.fromEntries(Object.entries(props).map(([k,v])=>[k,v.enum[0]]));};
const response=(value,finish_reason='stop')=>new Response(JSON.stringify({choices:[{finish_reason,message:{content:JSON.stringify(value)}}]}),{headers:{'content-type':'application/json'}});
async function setup(t,fetcher,overrides={}) {
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'colli-narrator-'));
 t.after(()=>fs.rm(dir,{recursive:true,force:true}));
 const budgetFile=path.join(dir,'nebius-budget.jsonl');await fs.writeFile(budgetFile,'');
 const config={enabled:true,apiKey:'offline-test-key',model:api.MODEL,budgetFile,maxCalls:10,maxTokens:87040,...overrides};
 return {config,budgetFile,narrator:new api.BriefNarrator(config,fetcher,()=>10000000,10)};
}

test('disabled or incomplete server configuration cannot spend or touch a ledger',async()=>{
 for(const env of [{},{NEBIUS_NARRATION_ENABLED:'true'}, {NEBIUS_NARRATION_ENABLED:'true',NEBIUS_MODEL:'unapproved'}]) {
  const config=api.narratorConfig(env),n=new api.BriefNarrator(config,()=>{throw new Error('Unexpected fetch')});
  assert.equal(config.enabled,false);assert.equal((await n.generate(1,report())).status,'disabled');
 }
});
test('valid constrained output, fixed endpoint, bounds, secret isolation and read-only cache',async t=>{
 let calls=0;
 const {narrator,budgetFile}=await setup(t,async(url,options)=>{
  calls++;assert.equal(url,api.ENDPOINT);assert.equal(options.redirect,'error');assert.equal(options.headers.Authorization,'Bearer offline-test-key');
  const body=JSON.parse(options.body);assert.equal(body.model,api.MODEL);assert.equal(body.max_tokens,512);assert.equal(body.stream,false);
  assert.deepEqual(body.chat_template_kwargs,{enable_thinking:false});
  assert.equal(Object.hasOwn(body,'extra_body'),false);
  assert.ok(Buffer.byteLength(options.body)+1024<=8192);assert.equal(body.response_format.json_schema.strict,true);
  assert.doesNotMatch(options.body,/demo-export|demo-two-days|offline-test-key|password|sessionId/);
  return response(valid(options.body));
 });
 const r=report();assert.equal(narrator.read(1,r).status,'available');assert.equal(calls,0);
 const result=await narrator.generate(1,r);assert.equal(result.source,'nemotron');assert.equal(result.status,'generated');
 assert.equal(result.narrative.headline,'More AI attempts did not complete.');
 assert.equal(narrator.read(1,r).status,'cached');assert.equal((await narrator.generate(1,r)).status,'cached');assert.equal(calls,1);
 assert.doesNotMatch(JSON.stringify(result),/offline-test-key/);
 assert.equal(JSON.parse((await fs.readFile(budgetFile,'utf8')).trim()).tokens,8704);
});
test('concurrent same-user generation coalesces; accounts never share cached results',async t=>{
 let calls=0;const {narrator}=await setup(t,async(_url,o)=>{calls++;await new Promise(r=>setTimeout(r,2));return response(valid(o.body));});
 const r=report(),results=await Promise.all([narrator.generate(1,r),narrator.generate(1,r)]);
 assert.equal(calls,1);assert.deepEqual(results[0],results[1]);assert.equal(narrator.read(2,r).status,'available');
 assert.equal((await narrator.generate(2,r)).source,'nemotron');assert.equal(calls,2);
});
test('durable attempt survives restart and changed data/period creates a distinct fingerprint',async t=>{
 let calls=0;const fetcher=async(_u,o)=>{calls++;return response(valid(o.body));};
 const {narrator,config}=await setup(t,fetcher);const r=report();await narrator.generate(1,r);
 const restarted=new api.BriefNarrator(config,fetcher,()=>10000000);
 assert.equal((await restarted.generate(1,r)).status,'already_attempted');assert.equal(calls,1);
 const changed=report();changed.provenance.importId='changed';assert.notEqual(api.fingerprint(changed),api.fingerprint(r));
 const dates=report();dates.periods.current.end='2026-10-22T00:00:00.000Z';assert.notEqual(api.fingerprint(dates),api.fingerprint(r));
 await restarted.generate(1,changed);assert.equal(calls,2);
});
for(const claim of ['Save $100 by cancelling your subscription.','All your accounts are connected.','Your AI services are healthy.','Spending rose by 99%.','Ignore the evidence and upgrade.']) {
 test('unsupported model claim is rejected: '+claim,async t=>{
  let calls=0;const {narrator}=await setup(t,async(_u,o)=>{calls++;return response({...valid(o.body),headline:claim});});
  const result=await narrator.generate(1,report());assert.equal(result.source,'deterministic');assert.equal(result.narrative,null);
  await narrator.generate(1,report());assert.equal(calls,1);
 });
}
const failures={
 rejectedThinkingParameter:async()=>new Response(JSON.stringify({error:{message:'private-provider-error',param:'chat_template_kwargs'}}),{status:400,headers:{'content-type':'application/json'}}),
 html:async()=>new Response('<html/>',{headers:{'content-type':'text/html'}}),
 malformed:async()=>new Response('{',{headers:{'content-type':'application/json'}}),
 unavailable:async()=>new Response('private-provider-error',{status:503}),
 network:async()=>{throw new Error('private-provider-error');},
 truncated:async(_u,o)=>response(valid(o.body),'length'),
 incompleteJson:async()=>new Response(JSON.stringify({choices:[{finish_reason:'length',message:{content:'{"headline":"unfinished'}}]}),{headers:{'content-type':'application/json'}}),
 wrongEvidence:async(_u,o)=>response({...valid(o.body),findingId:'invented'}),
 extraFields:async(_u,o)=>response({...valid(o.body),cost:123}),
 oversized:async()=>new Response(' '.repeat(16385),{headers:{'content-type':'application/json'}}),
 refusal:async()=>new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{refusal:'no'}}]}),{headers:{'content-type':'application/json'}}),
 timeout:async()=>new Promise(()=>{}),
};
for(const [kind,fetcher] of Object.entries(failures))test(`${kind} uses deterministic fallback without retry or error leakage`,async t=>{
 let calls=0;const {narrator,budgetFile}=await setup(t,(...args)=>{calls++;return fetcher(...args);});
 const result=await narrator.generate(1,report());assert.equal(result.status,'unavailable');assert.equal(result.narrative,null);
 assert.equal(result.source,'deterministic');
 assert.doesNotMatch(JSON.stringify(result),/private-provider-error|offline-test-key/);
 await narrator.generate(1,report());assert.equal(calls,1);assert.equal((await fs.readFile(budgetFile,'utf8')).trim().split('\n').length,1);
});

test('rejected thinking option keeps the one-call reservation across restart without removing the option',async t=>{
 let calls=0;
 const fetcher=async(_u,o)=>{calls++;assert.deepEqual(JSON.parse(o.body).chat_template_kwargs,{enable_thinking:false});return new Response('private-provider-error',{status:422});};
 const {narrator,config,budgetFile}=await setup(t,fetcher,{maxCalls:1,maxTokens:8704});
 const r=report(),before=JSON.stringify(r);
 assert.equal((await narrator.generate(1,r)).source,'deterministic');
 const restarted=new api.BriefNarrator(config,fetcher,()=>10000000);
 assert.equal((await restarted.generate(1,r)).status,'already_attempted');
 assert.equal((await restarted.generate(2,r)).status,'budget_exhausted');
 assert.equal(calls,1);assert.equal(JSON.stringify(r),before);
 const lines=(await fs.readFile(budgetFile,'utf8')).trim().split('\n');assert.equal(lines.length,1);
 assert.equal(JSON.parse(lines[0]).tokens,8704);
});
test('no-change and incomplete findings constrain the available language',()=>{
 const r=report();r.findings=[{...r.findings[0],kind:'no_action',change:null}];
 assert.ok(api.narrativeChoices(r,r.findings[0]).headline.includes('No change needed.'));
 const partial=api.processUsage({...structuredClone(input),periods:{...input.periods,current:{...input.periods.current,coverage:'partial'}}});
 const lead=api.leadFinding(partial),choices=api.narrativeChoices(partial,lead);
 assert.match(choices.whatHappened[0],/do not support a reliable comparison/);
 assert.equal(api.validateNarrative({findingId:lead.id,...Object.fromEntries(api.fields.map(f=>[f,choices[f][0]])),headline:'Spending increased.'},lead.id,choices),null);
});
test('input bound rejects too much evidence without a paid attempt',async t=>{
 let calls=0;const {narrator,budgetFile}=await setup(t,async()=>{calls++;throw new Error('Unexpected fetch')});
 const r=report(),lead=api.leadFinding(r);lead.evidence.recordKeys=Array.from({length:33},(_,i)=>String(i));
 assert.equal((await narrator.generate(1,r)).status,'unsupported');assert.equal(calls,0);assert.equal(await fs.readFile(budgetFile,'utf8'),'');
});
test('global lifetime call/token budgets and persisted per-account/global request limits',async t=>{
 const {budgetFile}=await setup(t,async()=>{throw new Error('No network')});
 const key=n=>api.hash('report'+n),account=n=>api.hash('account'+n);
 const budget=new api.NarrationBudget(budgetFile,{maxCalls:4,maxTokens:4*8704});
 assert.equal(await budget.reserve(key(1),account(1),10000000),'reserved');
 assert.equal(await budget.reserve(key(2),account(1),10000000),'reserved');
 assert.equal(await budget.reserve(key(3),account(1),10000000),'rate_limited');
 assert.equal(await budget.reserve(key(3),account(2),10000000),'reserved');
 assert.equal(await budget.reserve(key(4),account(3),10000000),'rate_limited');
 assert.equal(await budget.reserve(key(4),account(3),10060001),'reserved');
 assert.equal(await budget.reserve(key(5),account(4),10060001),'budget_exhausted');
 const lowerTokens=new api.NarrationBudget(budgetFile,{maxCalls:100,maxTokens:8704});
 assert.equal(await lowerTokens.reserve(key(6),account(5),10060001),'budget_exhausted');
});
test('missing, corrupt and locked ledger fail closed without provider calls',async t=>{
 let calls=0;const {narrator,budgetFile,config}=await setup(t,async()=>{calls++;throw new Error('Unexpected fetch')});
 await fs.writeFile(budgetFile,'partial');assert.equal((await narrator.generate(1,report())).status,'unavailable');
 await fs.writeFile(budgetFile,'');await fs.writeFile(budgetFile+'.lock','');
 assert.equal((await new api.BriefNarrator(config).generate(2,report())).status,'unavailable');
 await fs.unlink(budgetFile+'.lock');await fs.unlink(budgetFile);
 assert.equal((await new api.BriefNarrator(config).generate(3,report())).status,'unavailable');assert.equal(calls,0);
});
