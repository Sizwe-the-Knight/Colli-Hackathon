import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire, Module} from 'node:module';
const root=process.cwd(),require=createRequire(path.join(root,'artifacts/api-server/package.json'));
const {build}=require('esbuild');
const result=await build({stdin:{contents:`
 import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server';
 import {BriefContent} from './artifacts/colli/src/pages/brief';
 export * from './artifacts/colli/src/lib/operational-brief';
 export * from './artifacts/api-server/src/operational/usage';
 export * from './lib/api-client-react/src/operational-brief';
 export {default as routes} from './artifacts/api-server/src/routes';
 export {narrationRoutes} from './artifacts/api-server/src/routes/operational-brief';
 export {control} from 'control';
 export const render = (report,narration) => renderToStaticMarkup(<BriefContent report={report} narration={narration}/>);
 `,resolveDir:root,loader:'tsx'},bundle:true,write:false,platform:'node',format:'cjs',jsx:'transform',loader:{'.css':'empty'},
 nodePaths:[path.join(root,'artifacts/colli/node_modules')],plugins:[{name:'integration-isolation',setup(b){
 b.onResolve({filter:/^@workspace\/db$/},()=>({path:'db',namespace:'test'}));
 b.onLoad({filter:/^db$/,namespace:'test'},()=>({contents:'export const pool={query(){throw new Error("Offline test cannot query database")}};'}));
 b.onResolve({filter:/^control$/},()=>({path:'control',namespace:'test'}));
 b.onLoad({filter:/^control$/,namespace:'test'},()=>({contents:'export const control={status:401,calls:0};'}));
 b.onResolve({filter:/^\.\//},a=>a.importer.replaceAll('\\','/').endsWith('/routes/index.ts')&&a.path!=='./operational-brief'?{path:'empty-router',namespace:'test'}:undefined);
 b.onLoad({filter:/^empty-router$/,namespace:'test'},()=>({contents:"import {Router} from 'express';export default Router();",resolveDir:path.join(root,'artifacts/api-server')}));
 b.onResolve({filter:/^\.\.\/lib\/security$/},()=>({path:'security',namespace:'test'}));
 b.onLoad({filter:/^security$/,namespace:'test'},()=>({contents:"import {control} from 'control';export function requireAuth(req,res,next){control.calls++;if(control.status!==200)return res.status(control.status).json({error:'Not available'});next()}"}));
 b.onResolve({filter:/^wouter$/},()=>({path:'wouter',namespace:'test'}));
 b.onLoad({filter:/^wouter$/,namespace:'test'},()=>({contents:"import React from 'react';export const Link=({children,...props})=>React.createElement('a',props,children);",resolveDir:path.join(root,'artifacts/colli')}));
 b.onResolve({filter:/^@\//},a=>({path:path.join(root,'artifacts/colli/src',a.path.slice(2)+(a.path.includes('components/')?'.tsx':'.ts'))}));
 }}]});
const mod=new Module(path.join(root,'tests/brief-compiled.cjs'));mod.paths=Module._nodeModulePaths(root);mod._compile(result.outputFiles[0].text,path.join(root,'tests/brief-compiled.cjs'));
const api=mod.exports;
const fixture=name=>JSON.parse(fs.readFileSync('scripts/fixtures/usage-'+name+'.json','utf8'));
const demo=()=>api.processUsage(fixture('synthetic'));
test('demo totals and the published wire contract come from the existing engine',()=>{
 const r=api.operationalBriefSchema.parse(demo()),t=r.periods.current.totals;
 assert.equal(t.activities,3);assert.equal(t.inputTokens.total,500);assert.equal(t.outputTokens.total,250);
 assert.deepEqual(t.costs.map(c=>[c.currency,c.amount]),[['EUR','0.1'],['USD','0.4']]);
 assert.deepEqual(t.outcomes,{success:2,failure:1,unknown:0});
 assert.equal(api.findingHeadline(api.centralFinding(r)),"One AI request failed.");
 const html=api.render(r);assert.match(html,/Demo workspace/);assert.match(html,/AI Health Score/);assert.match(html,/Not assessed/);
 assert.doesNotMatch(html,/92\/100|exceptionally well|inactive for|Estimated monthly savings|complete cross-provider/);
});
test('incomplete coverage withholds comparison and preserves unknown quantities',()=>{
 const r=api.operationalBriefSchema.parse(api.processUsage(fixture('incomplete')));
 assert.equal(r.comparison.supported,false);assert.equal(api.centralFinding(r).kind,'insufficient_data');
 assert.deepEqual(r.comparison.changes,[]);assert.equal(r.periods.current.totals.outputTokens.total,null);
 const html=api.render(r);assert.match(html,/We need a fuller picture/);assert.match(html,/Some information needed to compare/);assert.doesNotMatch(html,/Failed requests rose|USD 0/);
});
test('empty input gives a useful next step without invented health',()=>{
 const r=api.processUsage({...fixture('synthetic'),records:[]}),html=api.render(api.operationalBriefSchema.parse(r));
 assert.match(html,/Not enough data/);assert.match(html,/There is nothing here to compare yet/);assert.match(html,/whether anything went wrong/);
});

test('opening summary preserves evidence while prioritizing Dashboard navigation',()=>{
 const r=api.operationalBriefSchema.parse(demo()),before=JSON.stringify(r),lead=api.centralFinding(r);
 const copy=api.findingExplanation(lead),html=api.render(r);
 assert.match(copy.context,/1 failure.*0 in the previous period/);
 assert.match(copy.significance,/don't know whether anyone/);
 assert.equal((html.match(/Continue to Dashboard/g)??[]).length,1);
 const readingOrder=['Daily Executive Brief','AI Health Score','Not assessed','We need more complete information before giving you a score.','What happened?','Why does it matter?','What should I do next?','Continue to Dashboard'];
 for(let i=1;i<readingOrder.length;i++)assert.ok(html.indexOf(readingOrder[i-1])<html.indexOf(readingOrder[i]),readingOrder[i]+' follows '+readingOrder[i-1]);
 assert.match(html,/<a class="brief-primary" href="\/dashboard"/);
 assert.match(html,/href="\/dashboard"/);
 assert.match(html,/Why does it matter/);assert.match(html,/What should I do next/);
 assert.doesNotMatch(html,/<table|brief-ledger|brief-findings|href="#evidence-/);
 assert.deepEqual(html.match(/<details[^>]*>/g), ['<details class="health-sample">']);
 assert.match(html,/Invented examples, not connected account activity/);
 assert.doesNotMatch(html,/unfinished AI|AI task didn't finish|Clarity before action/);
 assert.equal(JSON.stringify(r),before);
 const decreased={...lead,change:{...lead.change,previous:3,current:0,delta:-3}};
 assert.equal(api.findingHeadline(decreased),"0 AI requests failed in these records.");
 assert.match(api.findingExplanation(decreased).context,/0 failures.*3 in the previous period/);
});
test('main finding uses current-period totals and the linked failure provider without inventing model or cause',()=>{
 const r=api.operationalBriefSchema.parse(demo()),lead=api.centralFinding(r),before=JSON.stringify(r);
 assert.equal(api.findingHeadline(lead,r),'One of three AI requests failed.');
 assert.equal(api.findingExplanation(lead,r).context,"Anthropic couldn't complete one request. We don't know why.");
 const html=api.render(r);
 assert.match(html,/One of three AI requests failed/);
 assert.match(html,/Anthropic couldn&#x27;t complete one request/);
 assert.match(html,/We need more complete information before giving you a score/);
 assert.doesNotMatch(html,/Claude|lost work|<table/);
 // Sample continuity is legitimately 80/100, inside the separate opt-in fixture.
 // Neither that score nor an invented 95 may appear as the account assessment.
 assert.doesNotMatch(html.replace(/<section class="brief-health brief-health-demo"[\s\S]*?<\/section>/, ''),/95\/100|80\/100|86\/100/);
 assert.equal(JSON.stringify(r),before);
 const changed=structuredClone(r);
 changed.records.find(record=>record.eventId==='c2').provider='openai';
 assert.match(api.findingExplanation(api.centralFinding(changed),changed).context,/OpenAI couldn/);
 const unlinked={...lead,evidence:{...lead.evidence,recordKeys:[]}};
 assert.doesNotMatch(api.findingExplanation(unlinked,r).context,/Anthropic/);
 assert.equal(api.findingHeadline(unlinked,r),'One AI request failed.');
 changed.periods.current.totals.activities=99;
 assert.doesNotMatch(api.findingHeadline(api.centralFinding(changed),changed),/99/);
});
test('recorded zero and missing cost are distinct and currencies never combine',()=>{
 const input=fixture('synthetic');input.records.forEach(r=>{r.cost={amount:'0',currency:'USD'}});
 const r=api.operationalBriefSchema.parse(api.processUsage(input));
 assert.equal(r.periods.current.totals.costs[0].amount,'0');assert.doesNotMatch(api.render(r),/USD 0/);
 input.records.forEach(r=>delete r.cost);const missing=api.operationalBriefSchema.parse(api.processUsage(input));
 assert.deepEqual(missing.periods.current.totals.costs,[]);assert.equal(missing.periods.current.totals.missingCostRecords,3);
});
test('every evidence key, event identity, provenance and currency scope survives transport validation',()=>{
 const original=demo(),r=api.operationalBriefSchema.parse(original);
 assert.deepEqual(r.findings,original.findings);assert.deepEqual(r.records,original.records);
 for(const f of r.findings.filter(f=>f.change?.currency)){
  const records=r.records.filter(record=>f.evidence.recordKeys.includes(record.key));
  assert.ok(records.every(record=>record.cost.currency===f.change.currency));
 }
 const html=api.render(r);assert.doesNotMatch(html,/<table|demo-export \/ c2/);assert.ok(r.records.some(record=>record.eventId==='c2'));
});
test('malformed payloads, dangling evidence and unsupported change claims are rejected',()=>{
 for(const value of [null,{},'<html/>',{...demo(),records:[null]}])assert.equal(api.operationalBriefSchema.safeParse(value).success,false);
 const dangling=demo();dangling.findings[0].evidence.recordKeys.push('absent');assert.equal(api.operationalBriefSchema.safeParse(dangling).success,false);
 const unsupported=demo();unsupported.comparison.supported=false;assert.equal(api.operationalBriefSchema.safeParse(unsupported).success,false);
});
test('read-only endpoint obeys mounted auth guard and emits engine output without personal inputs',async()=>{
 const express=require('express'),app=express();app.use('/api',api.routes);
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});
 try{
  const url='http://127.0.0.1:'+server.address().port+'/api/operational/brief';
  for(const status of [401,503]){api.control.status=status;const res=await fetch(url);assert.equal(res.status,status);assert.equal((await res.json()).findings,undefined)}
  api.control.status=200;const res=await fetch(url+'?userId=999&provider=private');assert.equal(res.status,200);assert.equal(res.headers.get('cache-control'),'no-store');assert.deepEqual(await res.json(),demo());assert.equal(api.control.calls,3);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
test('the dedicated client rejects HTML, malformed JSON and failed requests; passes AbortSignal',async t=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original});
 for(const response of [()=>new Response('<html/>',{headers:{'content-type':'text/html'}}),()=>new Response('{',{headers:{'content-type':'application/json'}}),()=>new Response('{}',{status:503})]){
  globalThis.fetch=async()=>response();await assert.rejects(api.getOperationalBrief());
 }
 const signal=new AbortController().signal;
 globalThis.fetch=async(url,options)=>{assert.equal(url,'/api/operational/brief');assert.equal(options.credentials,'include');assert.equal(options.signal,signal);return new Response(JSON.stringify(demo()),{headers:{'content-type':'application/json'}})};
 assert.deepEqual(await api.getOperationalBrief(signal),demo());
});
test('validated narration changes only editorial wording; figures, evidence and demo status remain',()=>{
 const r=api.operationalBriefSchema.parse(demo()),finding=api.centralFinding(r),before=JSON.stringify(r);
 const value={fingerprint:'a'.repeat(64),findingId:finding.id,status:'generated',source:'nemotron',model:'nvidia/Nemotron-3_5-Lightning',
  narrative:{findingId:finding.id,headline:'More AI attempts did not complete.',whatHappened:'The supplied records show more unsuccessful attempts than in the previous period.',whyItMatters:'An unsuccessful attempt may interrupt someone’s work.',nextStep:'Check the supporting records to understand what happened.'}};
 const narration=api.narrationSchema.parse(value),html=api.render(r,narration);
 assert.match(html,/More AI attempts did not complete/);assert.equal(JSON.stringify(r),before);assert.doesNotMatch(html,/<table|EUR 0.1|USD 0.4/);
 assert.match(html,/Not assessed/);assert.match(html,/Demo workspace/);assert.ok(r.records.some(record=>record.eventId==='c2'));
 assert.doesNotMatch(api.render(r,{...narration,findingId:'other'}),/More AI attempts did not complete/);
 assert.equal(api.narrationSchema.safeParse({...value,narrative:null}).success,false);
});
test('generation route accepts only current fingerprint and derives cache identity from the session',async()=>{
 const express=require('express'),app=express(),calls=[];
 const service={readStored:async(id)=>{calls.push(['read',id]);return {source:'deterministic'}},generate:async(id)=>{calls.push(['generate',id]);return {source:'nemotron'}}};
 app.use(express.json());
 app.use((req,res,next)=>{if(req.headers['x-test-auth']!=='yes')return res.status(401).json({error:'Not authenticated'});req.session={userId:42};next()});
 app.use('/api',api.narrationRoutes(service));
 const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))});
 try{
  const url='http://127.0.0.1:'+server.address().port+'/api/operational/brief/narration';
  assert.equal((await fetch(url,{method:'POST'})).status,401);assert.deepEqual(calls,[]);
  const headers={'x-test-auth':'yes','content-type':'application/json'};
  assert.equal((await fetch(url,{headers})).status,200);assert.deepEqual(calls,[['read',42]]);
  for(const body of [{},{fingerprint:'stale',userId:99},{fingerprint:'stale',model:'other'},{fingerprint:'stale',judge:true},{fingerprint:'stale',report:{private:true}}])assert.equal((await fetch(url,{method:'POST',headers,body:JSON.stringify(body)})).status,400);
  assert.equal((await fetch(url,{method:'POST',headers,body:JSON.stringify({fingerprint:'stale'})})).status,409);
  const {createHash}=await import('node:crypto');const fingerprint=createHash('sha256').update(JSON.stringify(demo())).digest('hex');
  const res=await fetch(url,{method:'POST',headers,body:JSON.stringify({fingerprint})});assert.equal(res.status,200);assert.equal(res.headers.get('cache-control'),'no-store');
  assert.deepEqual(calls,[['read',42],['generate',42]]);
 }finally{await new Promise(resolve=>server.close(resolve))}
});
test('client cache reads are GET; generation is explicit POST with only the fingerprint',async t=>{
 const original=globalThis.fetch;t.after(()=>{globalThis.fetch=original});const requests=[];
 globalThis.fetch=async(url,options)=>{requests.push({url,options});return new Response('{}',{headers:{'content-type':'application/json'}})};
 await api.getBriefNarration();assert.equal(requests[0].options.method,'GET');
 await api.generateBriefNarration('a'.repeat(64));assert.equal(requests[1].options.method,'POST');
 assert.equal(requests[1].options.credentials,'include');assert.deepEqual(JSON.parse(requests[1].options.body),{fingerprint:'a'.repeat(64)});
});
// Optional static visual artifact; no API/database/auth bypass is introduced.
if(process.env.COLLI_BRIEF_RENDER_PATH){
 const css=fs.readFileSync('artifacts/colli/src/pages/brief.css','utf8');
 fs.writeFileSync(process.env.COLLI_BRIEF_RENDER_PATH,'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Colli Brief · static fixture preview</title><style>body{margin:0}*{box-sizing:border-box}:root{--app-font-sans:Arial,sans-serif;--app-font-serif:Georgia,serif}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}'+css+'</style></head><body><div class="executive-brief"><header class="brief-masthead"><strong>Colli</strong></header><main class="brief-main">'+api.render(api.operationalBriefSchema.parse(demo()))+'</main></div></body></html>',{flag:'wx'});
}
