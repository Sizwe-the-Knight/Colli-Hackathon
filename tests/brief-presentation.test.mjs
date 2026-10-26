import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire, Module } from 'node:module';
const root=process.cwd(),require=createRequire(path.join(root,'artifacts/api-server/package.json'));
// Small hook harness for the real Brief component: all network/query boundaries
// are mocked, while the real event handler, state updates and presentation run.
const controls=`
 export const control={query:null,read:null,post:null,gets:0,posts:[],states:[],cursor:0,effects:[],deps:[],cleanups:[]};
 export function state(value){const i=control.cursor++;if(!(i in control.states))control.states[i]=value;return [control.states[i],v=>{control.states[i]=typeof v==='function'?v(control.states[i]):v}];}
 export function ref(value){const i=control.cursor++;return control.states[i]??(control.states[i]={current:value});}
 export function effect(fn,deps){const i=control.cursor++;if(!control.deps[i]||deps.some((v,j)=>!Object.is(v,control.deps[i][j]))){control.deps[i]=deps;control.effects.push(()=>{control.cleanups[i]?.();control.cleanups[i]=fn()});}}
 export function reset(){control.cleanups.forEach(fn=>fn?.());Object.assign(control,{states:[],cursor:0,effects:[],deps:[],cleanups:[],gets:0,posts:[]});}
`;
const compiled=await require('esbuild').build({stdin:{contents:`
 import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server';
 import {Button} from './artifacts/colli/src/components/ui/button';
 import {Badge} from './artifacts/colli/src/components/ui/badge';
 import {Brief,BriefContent,BriefNarrationControl} from './artifacts/colli/src/pages/brief';
 import {control} from 'presentation-control'; export {control,reset} from 'presentation-control';
 export * from './artifacts/api-server/src/operational/usage';
 export * from './artifacts/colli/src/lib/operational-brief';
 export {BriefContent,BriefNarrationControl};
 export const renderBrief=()=>{control.cursor=0;const tree=Brief();const effects=control.effects.splice(0);effects.forEach(fn=>fn());return tree;};
 export const renderContent=props=>renderToStaticMarkup(<BriefContent {...props}/>);
 export const renderPrimitives=()=>renderToStaticMarkup(<><Button disabled aria-label="Save preference">Save</Button><Button asChild variant="outline"><a href="/dashboard">Dashboard</a></Button><Badge variant="outline">Sample</Badge></>);
 export const renderControl=props=>renderToStaticMarkup(<BriefNarrationControl {...props}/>);
 `,resolveDir:root,loader:'tsx'},bundle:true,write:false,platform:'node',format:'cjs',jsx:'transform',loader:{'.css':'empty'},
 nodePaths:[path.join(root,'artifacts/colli/node_modules')],plugins:[{name:'presentation-boundaries',setup(b){
  b.onResolve({filter:/^presentation-control$/},()=>({path:'control',namespace:'fixture'}));
  b.onLoad({filter:/^control$/,namespace:'fixture'},()=>({contents:controls}));
  b.onResolve({filter:/^react$/},a=>a.importer.replaceAll('\\','/').endsWith('/pages/brief.tsx')?{path:'hooks',namespace:'fixture'}:undefined);
  b.onLoad({filter:/^hooks$/,namespace:'fixture'},()=>({contents:"import React from 'react';export default React;export {state as useState,ref as useRef,effect as useEffect} from 'presentation-control';",resolveDir:path.join(root,'artifacts/colli')}));
  b.onResolve({filter:/^@tanstack\/react-query$/},()=>({path:'query',namespace:'fixture'}));
  b.onLoad({filter:/^query$/,namespace:'fixture'},()=>({contents:"import {control} from 'presentation-control';export const useQuery=()=>control.query;"}));
  b.onResolve({filter:/^@workspace\/api-client-react$/},()=>({path:'api',namespace:'fixture'}));
  b.onLoad({filter:/^api$/,namespace:'fixture'},()=>({contents:`import {control} from 'presentation-control';
   export const getOperationalBrief=()=>{throw new Error('Unexpected report fetch')};
   export const getBriefNarration=async()=>{control.gets++;return control.read};
   export const generateBriefNarration=async(fingerprint,signal)=>{control.posts.push({fingerprint,signal});return control.post()};`}));
  b.onResolve({filter:/^wouter$/},()=>({path:'links',namespace:'fixture'}));
  b.onLoad({filter:/^links$/,namespace:'fixture'},()=>({contents:"import React from 'react';export const Link=({children,...props})=>React.createElement('a',props,children);",resolveDir:path.join(root,'artifacts/colli')}));
  b.onResolve({filter:/^@\//},a=>({path:path.join(root,'artifacts/colli/src',a.path.slice(2)+(a.path.includes('components/')?'.tsx':'.ts'))}));
 }}]});
const filename=path.join(root,'tests/brief-presentation-compiled.cjs'),mod=new Module(filename);mod._compile(compiled.outputFiles[0].text,filename);const api=mod.exports;
const report=api.operationalBriefSchema.parse(api.processUsage(JSON.parse(fs.readFileSync('scripts/fixtures/usage-synthetic.json','utf8'))));
const finding=api.centralFinding(report);
const available={fingerprint:'a'.repeat(64),findingId:finding.id,status:'available',source:'deterministic',model:null,narrative:null};
const generated={...available,status:'generated',source:'nemotron',model:'nvidia/Nemotron-3_5-Lightning',narrative:{findingId:finding.id,headline:'More AI attempts did not complete.',whatHappened:'The supplied records show more unsuccessful attempts than in the previous period.',whyItMatters:'An unsuccessful attempt may interrupt someone’s work.',nextStep:'Check the supporting records to understand what happened.'}};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function find(tree,type){if(!tree||typeof tree!=='object')return null;if(tree.type===type)return tree;for(const child of [tree.props?.children].flat(Infinity)){const result=find(child,type);if(result)return result;}return null;}
function current(){const content=find(api.renderBrief(),api.BriefContent);return {content:content.props,control:content.props.narrationControl.props};}
async function setup(read=available,post=async()=>generated){api.reset();api.control.query={data:report,error:null,isLoading:false};api.control.read=read;api.control.post=post;api.renderBrief();await flush();return current();}

test('Health Score is dominant in semantic order; honest state precedes narrative and Dashboard finishes the Brief',()=>{
 const before=JSON.stringify(report),html=api.renderContent({report});
 const order=['Daily Executive Brief','AI Health Score','Not assessed','What happened?','Why does it matter?','What should I do next?','href="/dashboard"'];
 for(let i=1;i<order.length;i++)assert.ok(html.indexOf(order[i-1])<html.indexOf(order[i]),order[i]);
 assert.match(html,/aria-labelledby="brief-health-title" aria-describedby="brief-health-reason"/);
 assert.match(html,/We need more complete information before giving you a score/);
 assert.match(html,/Demonstration · synthetic records/);assert.doesNotMatch(html,/84\/100|95\/100|role="(?:meter|progressbar)"/);
 assert.equal(JSON.stringify(report),before);
});
test('mount, rerender and cached refresh never generate; cache does not announce a new update',async()=>{
 let view=await setup({...generated,status:'cached'});
 for(let i=0;i<3;i++)view=current();
 assert.equal(api.control.gets,1);assert.equal(api.control.posts.length,0);
 assert.equal(view.content.highlightExplanation,false);
 const html=api.renderControl(view.control);assert.match(html,/Previously generated by NVIDIA Nemotron via Nebius/);assert.doesNotMatch(html,/Brief updated/);
 view=await setup({...generated,status:'cached'});assert.equal(api.control.posts.length,0);
});
test('deliberate click sends one existing fingerprint request; loading is disabled and newly generated success highlights only the narrative',async()=>{
 let resolve;let view=await setup(available,()=>new Promise(r=>{resolve=r}));
 const element=api.BriefNarrationControl(view.control),button=find(element,'button');
 assert.equal(button.props.className,'brief-primary');assert.equal(button.props.type,'button');
 button.props.onClick();button.props.onClick();
 view=current();assert.equal(api.control.posts.length,1);assert.equal(api.control.posts[0].fingerprint,available.fingerprint);
 let html=api.renderControl(view.control);assert.match(html,/disabled=""/);assert.match(html,/aria-busy="true"/);assert.match(html,/Preparing a Nemotron explanation/);assert.doesNotMatch(html,/Brief updated/);
 resolve(generated);await flush();view=current();
 html=api.renderControl(view.control);assert.match(html,/Brief updated with NVIDIA Nemotron via Nebius/);assert.match(html,/role="status" aria-atomic="true"/);
 assert.match(api.renderContent(view.content),/brief-feature-updated/);assert.match(api.renderContent(view.content),/Not assessed/);
 current();assert.equal(api.control.posts.length,1);
});
for(const kind of ['cached','fallback','error'])test(`${kind} POST response never announces a fresh success or highlights the explanation`,async()=>{
 let view=await setup(available,async()=>{if(kind==='error')throw new Error('offline failure');return kind==='cached'?{...generated,status:'cached'}:{...available,status:'unavailable'};});
 view.control.onGenerate();await flush();view=current();
 const html=api.renderControl(view.control);assert.doesNotMatch(html,/Brief updated/);assert.doesNotMatch(api.renderContent(view.content),/brief-feature-updated/);
 assert.match(html,kind==='cached'?/Previously generated/:/deterministic/);assert.equal(api.control.posts.length,1);
 current();assert.equal(api.control.posts.length,1);
});
test('fallback, disabled and absent attribution cannot become success even with a stale presentation flag',()=>{
 for(const narration of [null,{...available,status:'disabled'},{...available,status:'budget_exhausted'},{...available,status:'already_attempted'}]){
  const html=api.renderControl({narration,generating:false,notice:'',updated:true,onGenerate:()=>assert.fail('No click')});
  assert.match(html,/Deterministic/);assert.doesNotMatch(html,/Brief updated|<button/);
 }
 assert.doesNotMatch(api.renderContent({report,narration:{...generated,status:'cached'},highlightExplanation:true}),/brief-feature-updated/);
});
test('shared buttons, centered final CTA, mobile wrapping and reduced motion remain explicit',()=>{
 const css=fs.readFileSync('artifacts/colli/src/pages/brief.css','utf8');
 assert.match(css,/\.brief-actions\{[^}]*text-align:center/);assert.match(css,/\.brief-destination\{[^}]*margin:10px auto 0/);
 assert.match(css,/\.brief-primary\{[^}]*min-height:48px[^}]*max-width:100%/);
 assert.match(css,/\.brief-primary:disabled/);assert.match(css,/:focus-visible\{outline:2px/);
 assert.match(css,/@media\(max-width:600px\)[\s\S]*\.brief-primary\{width:100%/);
 assert.match(css,/@media\(prefers-reduced-motion:reduce\)\{[^}]*brief-feature-updated\{animation:none;transition:none/);
 assert.match(css,/brief-explanation-update 1\.6s ease-out 1/);assert.doesNotMatch(css,/infinite|linear-gradient/);
});

test('sample is opt-in native disclosure; account, narrative and provenance remain separate',async()=>{
 const view=await setup(),before=JSON.stringify(report),html=api.renderContent(view.content);
 assert.deepEqual(html.match(/<details[^>]*>/g),['<details class="health-sample">']);
 assert.ok(html.includes('<summary><span class="health-sample-show">Preview sample score</span>'));
 assert.match(html,/Hide sample score/);assert.match(html,/Hypothetical synthetic example · 30 days/);
 assert.match(html,/This is not your account score/);assert.match(html,/not calculated from connected providers or the current Daily Brief evidence/);
 assert.ok(html.includes('<strong>86</strong><span>/100</span>'));
 for(const value of ['90/100','75/100','96/100','80/100','9 of 10','$90 of $120','96 of 100','4 of 5'])assert.ok(html.includes(value),value);
 assert.ok(html.indexOf('Not assessed')<html.indexOf('<strong>86'));
 assert.equal(JSON.stringify(report),before);assert.equal(api.control.posts.length,0);
 const source=fs.readFileSync('artifacts/colli/src/components/health-score-preview.tsx','utf8');
 assert.doesNotMatch(source,/useEffect|useState|onClick|fetch\(|generateBriefNarration|api-client|scoreSyntheticHealth/);
 const css=fs.readFileSync('artifacts/colli/src/pages/brief.css','utf8');
 assert.match(css,/health-sample\[open\] .health-sample-hide\{display:inline/);
 assert.match(css,/@media\(max-width:600px\)\{.health-sample-breakdown\{grid-template-columns:1fr/);
});

test('attributed UI primitives preserve disabled buttons, Slot links and badge output',()=>{
 const html=api.renderPrimitives();
 assert.match(html,/<button[^>]*disabled=""[^>]*aria-label="Save preference"/);
 assert.match(html,/<a[^>]*href="\/dashboard"/);assert.match(html,/>Sample<\/div>/);
 assert.doesNotMatch(html,/hover-elevate|active-elevate/);
});
