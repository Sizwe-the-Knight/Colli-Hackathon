import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire, Module } from 'node:module';
import path from 'node:path';
const root=process.cwd();
const require=createRequire(path.join(root,'artifacts/api-server/package.json'));
const {build}=require('esbuild');
// Exercise real page handlers and transport, with deterministic hook/router/cache fixtures.
const result=await build({stdin:{contents:`
 export { Onboarding } from './artifacts/colli/src/pages/onboarding';
 export { Settings } from './artifacts/colli/src/pages/settings';
 export { fixture } from 'fixture';
`,resolveDir:root},bundle:true,write:false,platform:'node',format:'cjs',jsx:'transform',plugins:[{name:'fixtures',setup(b){
 b.onResolve({filter:/^(fixture|react|wouter|@tanstack\/react-query|@workspace\/api-client-react|@\/lib\/context|@\/lib\/utils|@\/components\/premium-ui|@\/components\/ui\/switch|lucide-react)$/},a=>({path:a.path,namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},a=>({resolveDir:root,contents: a.path==='fixture'?`
 export const fixture={states:[],cursor:0,user:null,confirmed:null,cache:null,route:null};
 `:a.path==='react'?`
 import {fixture as f} from 'fixture';
 export function useState(initial){const i=f.cursor++;if(!(i in f.states))f.states[i]=typeof initial==='function'?initial():initial;return [f.states[i],v=>{f.states[i]=typeof v==='function'?v(f.states[i]):v}];}
 export default {createElement:(type,props,...children)=>({type,props:{...props,children}})};
 `:a.path==='@workspace/api-client-react'?`
 import {fixture as f} from 'fixture';
 export * from './lib/api-client-react/src/provider-save';
 export const useGetMe=()=>({data:f.user});export const getGetMeQueryKey=()=>['/api/auth/me'];
 `:a.path==='@tanstack/react-query'?`
 import {fixture as f} from 'fixture';export const useQueryClient=()=>({cancelQueries:async()=>{},setQueryData:(key,user)=>{f.cache=user}});
 `:a.path==='@/lib/context'?`
 import {fixture as f} from 'fixture';export const useAppContext=()=>({theme:'light',setTheme(){},setUser:u=>{f.confirmed=u}});
 `:a.path==='wouter'?`
 import {fixture as f} from 'fixture';export const useLocation=()=>['/',v=>{f.route=v}];
 `:`export const cn=(...args)=>args.join(' ');export const PremiumCard='section';export const Switch='input';export const Check='check';export const Sun='sun';export const Moon='moon';export const Globe='globe';export const Bell='bell';export const BrainCircuit='brain';` }));
}}]});
const mod=new Module(path.join(root,'tests/provider-memory.cjs'));mod._compile(result.outputFiles[0].text,path.join(root,'tests/provider-memory.cjs'));
const {fixture:f,Onboarding,Settings}=mod.exports;
const user={id:1,name:'Synthetic',email:'test@example.invalid',providers:['openai','anthropic'],createdAt:'2026-10-16'};
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}});
const nodes=value=>!value||typeof value!=='object'?[]:Array.isArray(value)?value.flatMap(nodes):[value,...nodes(value.props?.children)];
const text=n=>typeof n==='string'?n:Array.isArray(n)?n.map(text).join(''):n?.props?text(n.props.children):'';
function render(Page){f.cursor=0;return nodes(Page());}
function reset(){Object.assign(f,{states:[],cursor:0,user,confirmed:user,cache:user,route:null});}
function saveButton(tree){return tree.find(n=>n.type==='button'&&/Continue with|Save providers|Saving|Saved/.test(text(n)));}
const failures=[
 ['HTTP 400',()=>json({error:'invalid'},400)],
 ['HTTP 403',()=>json({error:'forbidden'},403)],
 ['HTTP 500',()=>json({error:'internal'},500)],
 ['expired session',()=>json({error:'unauthorized'},401)],
 ['offline',()=>{throw new TypeError('offline')}],
 ['HTML 200',()=>new Response('<html/>',{headers:{'content-type':'text/html'}})],
 ['malformed JSON',()=>new Response('{',{headers:{'content-type':'application/json'}})],
 ['missing user fields',()=>json({providers:user.providers})],
 ['unconfirmed providers',()=>json({...user,providers:null})],
 ['mismatched providers',()=>json({...user,providers:['google']})],
 ['empty response',()=>new Response(null,{status:204})],
 ['timeout',(_url,options)=>new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))))],
];
for(const [label,Page] of [['onboarding',Onboarding],['settings',Settings]]){
 for(const [failure,fetcher] of failures)test(`${label}: ${failure} preserves draft and confirmed state; retry succeeds`,async t=>{
  reset();const original=globalThis.fetch, timer=globalThis.setTimeout,clear=globalThis.clearTimeout;
  t.after(()=>{globalThis.fetch=original;globalThis.setTimeout=timer;globalThis.clearTimeout=clear});
  let expire;globalThis.setTimeout=callback=>{expire=callback;return 1};globalThis.clearTimeout=()=>{};
  globalThis.fetch=fetcher;
  let tree=render(Page);tree.find(n=>n.type==='button'&&/Gemini/.test(text(n))).props.onClick();tree=render(Page);const draft=tree.filter(n=>n.props?.['aria-pressed']!==undefined).map(n=>n.props['aria-pressed']);
  const pending=saveButton(tree).props.onClick();
  tree=render(Page);assert.equal(saveButton(tree).props.disabled,true);
  assert.ok(tree.filter(n=>n.props?.['aria-pressed']!==undefined).every(n=>n.props.disabled));
  if(failure==='timeout')expire();
  await pending;tree=render(Page);
  assert.equal(saveButton(tree).props.disabled,false);
  assert.deepEqual(tree.filter(n=>n.props?.['aria-pressed']!==undefined).map(n=>n.props['aria-pressed']),draft);
  assert.equal(f.confirmed,user);assert.equal(f.cache,user);assert.equal(f.route,null);
  const alert=tree.find(n=>n.props?.role==='alert');assert.ok(alert);
  assert.match(text(alert),failure==='expired session'?/session has expired/:/couldn’t confirm/);
  assert.doesNotMatch(text(saveButton(tree)),/Saved/);
  globalThis.fetch=async(url,options)=>{assert.equal(url,'/api/auth/providers');assert.equal(options.method,'PATCH');assert.equal(options.credentials,'include');return json({...user,providers:JSON.parse(options.body).providers})};
  await saveButton(tree).props.onClick();tree=render(Page);
  assert.ok(!tree.some(n=>n.props?.role==='alert'));
  assert.deepEqual(f.confirmed,{...user,providers:[...user.providers,'google']});assert.deepEqual(f.cache,f.confirmed);
  assert.equal(f.route,label==='onboarding'?'/brief':null);
  if(label==='settings')assert.match(text(saveButton(tree)),/Saved/);
 });
}
