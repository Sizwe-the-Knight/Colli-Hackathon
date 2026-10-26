import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire, Module } from 'node:module';
import { spawnSync } from 'node:child_process';
const require=createRequire(path.resolve('artifacts/api-server/package.json'));
const source=path.resolve('artifacts/api-server/src/operational/health-score.ts');
const built=await require('esbuild').build({entryPoints:[source],bundle:true,write:false,platform:'node',format:'cjs',metafile:true});
const mod=new Module(source);mod._compile(built.outputFiles[0].text,source);
const {scoreSyntheticHealth:score,HEALTH_WEIGHTS}=mod.exports;
const fixture=()=>JSON.parse(fs.readFileSync('scripts/fixtures/health-score-synthetic.json','utf8'));
const specs=[['fit','metNeeds','declaredNeeds'],['spend','meaningfulUseCents','paidCents'],['reliability','successfulRequests','requests'],['continuity','coveredWorkflows','criticalWorkflows']];

test('pure standalone scorer has no dependencies; complete illustrative scenario produces exactly 86',()=>{
 assert.equal(Object.keys(built.metafile.inputs).length,1);
 const input=fixture(),before=JSON.stringify(input),r=score(input);
 assert.equal(r.status,'illustrative');assert.equal(r.label,'Hypothetical synthetic score');assert.equal(r.score,86);assert.equal(r.weightedTotal,86);
 assert.deepEqual(r.components.map(c=>c.subscore),[90,75,96,80]);assert.deepEqual(r.components.map(c=>c.contribution),[31.5,22.5,24,8]);
 assert.equal(JSON.stringify(input),before);assert.deepEqual(score(input),r);assert.ok(Object.isFrozen(HEALTH_WEIGHTS));
 assert.ok(r.components.every(c=>input.sources.some(s=>s.id===c.evidenceRef)));
});
test('all components are bounded; no intermediate rounding or arbitrary category ratings',()=>{
 for(const numerator of [0,1,2,3]){
  const input=fixture();for(const [k,n,d] of specs){input[k][n]=numerator;input[k][d]=3;}
  const r=score(input);assert.equal(r.score,Math.round(100*numerator/3));
  for(const c of r.components){assert.ok(c.subscore>=0&&c.subscore<=100);assert.ok(c.contribution>=0&&c.contribution<=100*c.weight);}
 }
 const input=fixture();input.fit.metNeeds=1;input.fit.declaredNeeds=3;
 const subscore=score(input).components[0].subscore;
 assert.ok(Math.abs(subscore-100/3)<1e-12);assert.notEqual(subscore,Math.round(subscore));
});
test('a free account or zero activity cannot acquire a perfect score by default',()=>{
 for(const [k,n,d] of specs){const input=fixture();input[k][n]=0;input[k][d]=0;const r=score(input);assert.equal(r.status,'not_assessed');assert.equal(r.score,null);assert.equal(r.reason,'zero_denominator');assert.equal(r.dimension,k);}
});
test('final rounding handles exact half points without floating-point drift',()=>{
 const input=fixture();for(const [k,n,d] of specs){input[k][n]=0;input[k][d]=1;}
 input.fit.metNeeds=1;input.fit.declaredNeeds=70;
 assert.equal(score(input).weightedTotal,0.5);assert.equal(score(input).score,1);
 input.fit.declaredNeeds=71;assert.equal(score(input).score,0);
});
test('missing, partial, unknown and unreferenced evidence withholds the whole score',()=>{
 for(const [k] of specs){
  for(const coverage of ['partial','unknown',undefined]){const input=fixture();input[k].coverage=coverage;assert.equal(score(input).status,'not_assessed');}
  const input=fixture();input[k].evidenceRef='missing';assert.equal(score(input).reason,'incomplete_evidence');
  delete input[k];assert.equal(score(input).score,null);
 }
 for(const input of [null,{},[],{...fixture(),sources:[]},{...fixture(),sources:[...fixture().sources,fixture().sources[0]]}])assert.equal(score(input).status,'not_assessed');
});
test('non-numeric, fractional, negative, unsafe and out-of-range aggregates never clamp into a valid score',()=>{
 for(const [k,n,d] of specs){
  for(const value of [null,'1',-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1]){
   for(const field of [n,d]){const input=fixture();input[k][field]=value;assert.equal(score(input).status,'not_assessed');}
  }
  const input=fixture();input[k][n]=input[k][d]+1;assert.equal(score(input).reason,'invalid_counts');
 }
 const input=fixture();input.spend.currency='USD+EUR';assert.equal(score(input).status,'not_assessed');
});
test('periods must be exactly thirty valid UTC days, without rollover or timezone ambiguity',()=>{
 for(const end of ['2026-09-31T00:00:00.000Z','2026-10-02T00:00:00.000Z','2026-09-01T00:00:00.000Z','2026-10-01','2026-10-01T00:00:00+02:00']){
  const input=fixture();input.period.end=end;assert.equal(score(input).status,'not_assessed');
 }
});
test('real or current Brief reports are not scored, and provider concentration never changes the result',()=>{
 const input=fixture();input.provenance.kind='user_imported';assert.equal(score(input).reason,'synthetic_only');
 assert.equal(score(JSON.parse(fs.readFileSync('scripts/fixtures/usage-synthetic.json','utf8'))).status,'not_assessed');
 const concentrated={...fixture(),providers:['one']},diverse={...fixture(),providers:['one','two','three']};
 assert.deepEqual(score(concentrated),score(diverse));
 // No input score/model-supplied rating can override the four evidence ratios.
 assert.equal(score({...fixture(),score:100,modelRating:100}).score,86);
});
test('isolated offline example prints synthetic disclosure and calculated components',()=>{
 const run=spawnSync(process.execPath,['scripts/health-score-example.mjs'],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);const output=JSON.parse(run.stdout);
 assert.match(output.disclosure,/Hypothetical.*not the Daily Brief/);assert.equal(output.result.score,86);assert.equal(output.result.components.length,4);
});

test('checked-in UI artifact is reproducible from the real scorer and complete fixture',()=>{
 const artifact=JSON.parse(fs.readFileSync('artifacts/colli/src/lib/health-score-sample.json','utf8'));
 assert.deepEqual(artifact.result,score(fixture()));assert.deepEqual(artifact.period,fixture().period);
 assert.equal(artifact.currency,fixture().spend.currency);assert.equal(artifact.disclosure,fixture().provenance.label);
 const run=spawnSync(process.execPath,['scripts/health-score-example.mjs','--check-preview'],{encoding:'utf8'});
 assert.equal(run.status,0,run.stderr);
});
