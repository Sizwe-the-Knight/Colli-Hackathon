import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire, Module } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(path.resolve('artifacts/api-server/package.json'));
const source = path.resolve('artifacts/api-server/src/operational/usage.ts');
const built = await require('esbuild').build({ entryPoints: [source], bundle: true, write: false, platform: 'node', format: 'cjs', metafile: true });
const compiled = new Module(source);
compiled._compile(built.outputFiles[0].text, source);
const { processUsage, importUsageJson, normalizeUsage, UsageValidationError } = compiled.exports;
const fixture = name => JSON.parse(fs.readFileSync(`scripts/fixtures/usage-${name}.json`, 'utf8'));
const example = () => fixture('synthetic');
const reject = (data, code) => assert.throws(() => processUsage(data), error => error instanceof UsageValidationError && error.code === code);

test('pure pipeline imports no auth runtime, database, services or dependencies', () => {
  assert.equal(Object.keys(built.metafile.inputs).length, 1);
});

test('normalizes UTC, decimal costs, missing values and attributable source provenance', () => {
  const data = fixture('incomplete');
  data.provenance.kind = 'user_imported';
  const normalized = normalizeUsage(data);
  const r = normalized.records[0];
  assert.equal(r.timestamp, '2026-10-20T12:00:00.000Z');
  assert.equal(r.cost, null); assert.equal(r.outputTokens, null); assert.equal(r.model, null);
  assert.equal(r.outcome, 'unknown'); assert.equal(r.workflow, null);
  assert.deepEqual(r.provenance, { ...data.provenance, independentlyVerified: false, row: 1 });
  assert.equal(r.key, JSON.stringify(['demo-export','openai','incomplete-1']));
  assert.equal(normalizeUsage(example()).records[0].cost.amount, '0.1');
});

test('strict timestamps reject rollover, timezone ambiguity and malformed input', () => {
  for (const timestamp of ['2026-02-30T12:00:00Z','2026-13-01T00:00:00Z','2026-10-20','2026-10-20T24:00:00Z','2026-10-20T10:00:00+02:00','not-a-date',null]) {
    const d=example(); d.records[0].timestamp=timestamp;
    assert.throws(()=>processUsage(d), UsageValidationError);
  }
});

test('negative, fractional, string and unsafe token counts are rejected', () => {
  for (const value of [-1,1.5,'100',NaN,Infinity,Number.MAX_SAFE_INTEGER+1]) {
    const d=example(); d.records[0].inputTokens=value;
    reject(d,'nonnegative_safe_integer_required');
  }
});

test('invalid decimal/currency fields are rejected without exposing raw values', () => {
  for (const cost of [{amount:-1,currency:'USD'},{amount:'-1',currency:'USD'},{amount:'1e2',currency:'USD'},
    {amount:'0.0000001',currency:'USD'},{amount:'1',currency:'usd'},{amount:'1'},{}]) {
    const d=example();d.records[0].cost=cost; assert.throws(()=>processUsage(d),UsageValidationError);
  }
  const d=example();d.records[0].timestamp='PRIVATE_VALUE';
  assert.throws(()=>processUsage(d),error=>!error.message.includes('PRIVATE_VALUE'));
});

test('malformed envelopes, unknown fields and dishonest verification flags are rejected', () => {
  for(const d of [null,[],{}, {...example(),version:2},{...example(),credential:'forbidden'}]) assert.throws(()=>processUsage(d),UsageValidationError);
  const d=example();d.provenance.independentlyVerified=true;reject(d,'unknown_field');
  for(const value of [['success'],{},false,42]) { const x=example();x.records[0].outcome=value;reject(x,'invalid_outcome'); }
  const x=example();x.periods.current.coverage=['complete'];reject(x,'invalid_coverage');
});

test('duplicate identities reject the whole batch even when payload/timestamp differs', () => {
  const d=example();d.records.push({...d.records[0],timestamp:'2026-10-20T18:00:00Z',inputTokens:999});
  reject(d,'duplicate_event_identity');
  const x=example();x.records[1].eventId=x.records[0].eventId;
  assert.equal(processUsage(x).records.length,5); // Another provider's ID namespace.
  const y=example();y.sourceIds.push('another-source');y.records.push({...y.records[0],sourceId:'another-source'});
  assert.equal(processUsage(y).records.length,6);
});

test('source scope is explicit and identities never depend on the import ID', () => {
  const d=example();d.records[0].sourceId='unlisted';reject(d,'source_outside_declared_scope');
  const a=example(),b=example();b.provenance.importId='another-import';
  assert.deepEqual(processUsage(a).records.map(r=>r.key),processUsage(b).records.map(r=>r.key));
});

test('synthetic demonstration produces exact totals and separated costs', () => {
  const r=processUsage(example());const p=r.periods.previous.totals,c=r.periods.current.totals;
  assert.equal(p.activities,2);assert.equal(c.activities,3);
  assert.equal(p.inputTokens.total,300);assert.equal(c.inputTokens.total,500);
  assert.equal(p.outputTokens.total,150);assert.equal(c.outputTokens.total,250);
  assert.deepEqual(p.costs,[{currency:'USD',amount:'0.3',suppliedRecords:2}]);
  assert.deepEqual(c.costs,[{currency:'EUR',amount:'0.1',suppliedRecords:1},{currency:'USD',amount:'0.4',suppliedRecords:2}]);
  assert.deepEqual(c.outcomes,{success:2,failure:1,unknown:0});
  assert.deepEqual(c.distribution,[{provider:'anthropic',model:'demo-model-b',activities:1},{provider:'openai',model:'demo-model-a',activities:2}]);
  const counts=r.comparison.changes.find(c=>c.metric==='activities');
  assert.deepEqual(counts,{metric:'activities',previous:2,current:3,delta:1,currency:null,percent:50});
  const usd=r.comparison.changes.find(c=>c.currency==='USD');assert.equal(usd.delta,'0.1');
});

test('half-open period boundaries include start and exclude end', () => {
  const d=example();d.records=[
    {...d.records[0],eventId:'outside-before',timestamp:'2026-10-18T23:59:59.999Z'},
    {...d.records[0],eventId:'previous-start',timestamp:d.periods.previous.start},
    {...d.records[0],eventId:'current-start',timestamp:d.periods.current.start},
    {...d.records[0],eventId:'outside-after',timestamp:d.periods.current.end}];
  const r=processUsage(d);
  assert.equal(r.periods.previous.totals.activities,1);assert.equal(r.periods.current.totals.activities,1);
  assert.equal(r.excludedRecordKeys.length,2);
  assert.ok(r.findings.every(f=>f.evidence.recordKeys.every(k=>!r.excludedRecordKeys.includes(k))));
});

test('nonadjacent, overlapping and unequal reporting windows are rejected', () => {
  for(const start of ['2026-10-19T12:00:00Z','2026-10-20T12:00:00Z','2026-10-21T00:00:00Z']) {
    const d=example();d.periods.current.start=start;assert.throws(()=>processUsage(d),UsageValidationError);
  }
  const d=example();d.periods.current.end='2026-10-22T00:00:00Z';reject(d,'adjacent_equal_duration_required');
});

test('unknown costs are not zero and incomplete measures suppress only unsupported comparisons', () => {
  const d=example();delete d.records[2].cost;delete d.records[3].outputTokens;delete d.records[4].outcome;
  const r=processUsage(d);assert.equal(r.comparison.supported,true);
  assert.equal(r.periods.current.totals.missingCostRecords,1);
  assert.deepEqual(r.comparison.changes.map(c=>c.metric),['activities','inputTokens']);
  assert.ok(r.findings.some(f=>f.kind==='insufficient_data'));
  d.records.forEach(r=>{delete r.cost});
  assert.deepEqual(processUsage(d).periods.current.totals.costs,[]);
});

test('explicit zero is preserved as supplied data while all missing tokens stay null', () => {
  const d=example();d.records.forEach(r=>{r.inputTokens=0;delete r.outputTokens;r.cost={amount:'0',currency:'USD'}});
  const c=processUsage(d).periods.current.totals;
  assert.deepEqual(c.inputTokens,{total:0,suppliedRecords:3,missingRecords:0});
  assert.deepEqual(c.outputTokens,{total:null,suppliedRecords:0,missingRecords:3});
  assert.deepEqual(c.costs,[{currency:'USD',amount:'0',suppliedRecords:3}]);
});

test('cost accumulation is exact decimal arithmetic rather than floating-point addition', () => {
  const d=example();d.records[0].cost.amount='0.000001';d.records[1].cost.amount='999999999999.999999';
  assert.equal(processUsage(d).periods.previous.totals.costs[0].amount,'1000000000000');
});

test('token aggregate overflow rejects rather than silently rounding a total', () => {
  const d=example();d.records[0].inputTokens=Number.MAX_SAFE_INTEGER;reject(d,'aggregate_exceeds_safe_integer');
});

test('partial and unknown coverage never support a trend or false health finding', () => {
  for(const coverage of ['partial','unknown']) {
    const d=example();d.periods.current.coverage=coverage;
    const r=processUsage(d);assert.equal(r.comparison.supported,false);assert.deepEqual(r.comparison.changes,[]);
    assert.deepEqual(r.findings.map(f=>f.kind),['insufficient_data']);
  }
  const r=processUsage(fixture('incomplete'));
  assert.equal(r.periods.current.totals.activities,1);
  assert.equal(r.periods.current.totals.missingCostRecords,1);
  assert.equal(r.periods.previous.totals.inputTokens.total,null);
  assert.equal(r.findings[0].kind,'insufficient_data');
});

test('empty data never produces an all-clear; zero previous values do not fabricate percentages', () => {
  const d=example();d.records=[];const r=processUsage(d);
  assert.equal(r.comparison.supported,false);assert.equal(r.findings[0].kind,'insufficient_data');
  const failure=processUsage(example()).comparison.changes.find(c=>c.metric==='failures');
  assert.equal(failure.previous,0);assert.equal(failure.current,1);assert.equal(failure.percent,null);
});

test('unchanged complete totals produce a conservative no-action finding', () => {
  const d=example();d.records=[d.records[0],{...d.records[0],eventId:'same-next-day',timestamp:'2026-10-20T08:00:00Z'}];
  const r=processUsage(d);assert.equal(r.findings.length,1);assert.equal(r.findings[0].kind,'no_action');
  assert.match(r.findings[0].whyItMatters,/do not establish service health/);
});

test('every calculated finding has resolvable evidence and currency-specific evidence stays separate', () => {
  const r=processUsage(example());const byKey=new Map(r.records.map(record=>[record.key,record]));
  for(const f of r.findings) {
    assert.ok(f.evidence.recordKeys.length>0);
    for(const k of f.evidence.recordKeys) {
      assert.ok(byKey.has(k));
      if(f.change?.currency)assert.equal(byKey.get(k).cost.currency,f.change.currency);
    }
    if(f.change)assert.ok(r.comparison.changes.includes(f.change));
  }
});

test('deterministic repeatability and source-object immutability', () => {
  const d=example(),before=JSON.stringify(d);
  assert.equal(JSON.stringify(processUsage(d)),JSON.stringify(processUsage(d)));
  assert.equal(JSON.stringify(d),before);
});

test('JSON import rejects malformed, oversized and structurally invalid input without payload excerpts', () => {
  assert.throws(()=>importUsageJson('{"private":"RAW_DATA"'),e=>e.code==='malformed_json'&&!e.message.includes('RAW_DATA'));
  assert.throws(()=>importUsageJson(' '.repeat(10*1024*1024+1)),e=>e.code==='import_too_large');
  assert.deepEqual(importUsageJson(JSON.stringify(example())),processUsage(example()));
  reject(fixture('malformed'),'invalid_timestamp');
});

test('executable JSON example succeeds, shows restraint and exits nonzero on malformed fixture', () => {
  for(const name of ['synthetic','incomplete','malformed']) {
    const result=spawnSync(process.execPath,['scripts/usage-example.mjs',`scripts/fixtures/usage-${name}.json`],{encoding:'utf8'});
    assert.equal(result.status,name==='malformed'?1:0,result.stderr);
    if(name==='malformed') { assert.match(result.stderr,/records\[0\]\.timestamp: invalid_timestamp/);assert.equal(result.stdout,''); }
    else {
      const report=JSON.parse(result.stdout);assert.equal(report.provenance.kind,'synthetic');
      assert.equal(report.comparison.supported,name==='synthetic');
    }
  }
});
