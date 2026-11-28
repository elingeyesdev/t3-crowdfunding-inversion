import test, {beforeEach,afterEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import ts from 'typescript';
import {JSDOM} from 'jsdom';
import {act,createElement} from 'react';
import {MemoryRouter,useLocation} from 'react-router-dom';
import axios from 'axios';

const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost'});
for(const name of ['window','document','navigator','HTMLElement','Node','MouseEvent','Event']) Object.defineProperty(globalThis,name,{value:dom.window[name],configurable:true});
globalThis.localStorage=dom.window.localStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=await import('react-dom/client');
registerHooks({
  resolve(specifier,context,next){
    if(specifier.startsWith('.')&&context.parentURL?.includes('/frontend/src/'))for(const extension of ['.ts','.tsx']){
      const url=new URL(specifier+extension,context.parentURL);if(existsSync(url))return {url:url.href,shortCircuit:true};
    }
    return next(specifier,context);
  },
  load(url,context,next){
    if(!url.endsWith('.tsx')||!url.includes('/frontend/src/'))return next(url,context);
    return {format:'module',shortCircuit:true,source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2023}}).outputText};
  },
});
const originalAdapter=axios.defaults.adapter,originalError=console.error;
let root,container,calls,status,gate,location,errors;
const donor=id=>({userId:id,firstName:id,lastName:'Prueba',displayName:null,avatarUrl:null,location:null,bio:'Biografía',email:id+'@example.test',totalInvested:100,investmentCount:1,lastInvestmentAt:'2026-11-20T12:00:00Z'});
axios.defaults.adapter=async config=>{
  calls.push({url:config.url,body:config.data?JSON.parse(config.data):null});
  let data;
  if(config.url==='/chat/conversations'){
    if(gate)await gate.promise;
    if(status!==null)throw new axios.AxiosError('Synthetic failure','ERR_BAD_RESPONSE',config,null,status?{status,data:{message:status===422?'El usuario no está activo.':'Synthetic error'}}:undefined);
    data={id:'conversation'};
  }else data={data:[donor('first'),donor('second'),donor('sender')],meta:{totalItems:3,totalPages:1,currentPage:1,itemsPerPage:20,itemCount:3}};
  return {config,status:200,statusText:'OK',headers:{},data:{data}};
};
const {CampaignInvestorsTab}=await import('../src/components/CampaignInvestorsTab.tsx');
function Location(){location=useLocation();return null;}
beforeEach(()=>{
  calls=[];status=null;gate=null;errors=[];console.error=(...args)=>errors.push(args);
  localStorage.setItem('userId','sender');localStorage.setItem('accessToken','test-token');
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(async()=>{try{await act(async()=>root.unmount());container.remove();assert.deepEqual(errors,[]);}finally{console.error=originalError;}});
after(()=>{axios.defaults.adapter=originalAdapter;dom.window.close();});
const mount=(props={})=>act(async()=>root.render(createElement(MemoryRouter,{initialEntries:['/entrepreneur-campaigns']},createElement(Location),createElement(CampaignInvestorsTab,{campaignId:'campaign',currency:'BOB',...props}))));
const button=label=>[...container.querySelectorAll('button')].find(node=>node.getAttribute('aria-label')===label||node.textContent.trim()===label);
const click=async node=>act(async()=>{assert.ok(node);node.click();});
const open=async(id='first')=>click(button('Ver detalle de '+id+' Prueba'));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const posts=()=>calls.filter(call=>call.url==='/chat/conversations');

for(const isAdmin of [false,true])test(`${isAdmin?'admin':'owner'} opens the selected donor's campaign conversation and blocks duplicate clicks`,async()=>{
  await mount({isAdmin});await open();gate=deferred();
  const send=button('Enviar Mensaje');
  await act(async()=>{send.dispatchEvent(new MouseEvent('click',{bubbles:true}));send.dispatchEvent(new MouseEvent('click',{bubbles:true}));});
  assert.equal(posts().length,1);assert.deepEqual(posts()[0].body,{otherUserId:'first',campaignId:'campaign'});
  assert.match(container.querySelector('[role="status"]').textContent,/Abriendo conversación/);
  assert.equal(button('Abriendo conversación...').disabled,true);
  assert.ok(calls.some(call=>call.url.startsWith(isAdmin?'/admin/campaigns/':'/entrepreneurs/me/campaigns/')));
  await act(async()=>gate.resolve());assert.equal(location.pathname,'/chat/conversation');
  assert.doesNotMatch(container.textContent,/Próximamente/);
});
for(const failure of [0,500,401,403,404,422])test(`opening chat ${failure} retains the donor and exposes recovery`,async()=>{
  await mount();await open();status=failure;await click(button('Enviar Mensaje'));
  assert.equal(location.pathname,'/entrepreneur-campaigns');
  assert.match(container.querySelector('[role="dialog"]').textContent,/first Prueba/);
  assert.ok(container.querySelector('[role="alert"]'));
  if(failure===401)assert.ok(container.querySelector('a[href="/login"]'));
  else{
    status=null;await click(button('Reintentar'));assert.equal(location.pathname,'/chat/conversation');assert.equal(posts().length,2);
  }
});
test('a donor cannot start a conversation with themselves and the empty external action is removed',async()=>{
  await mount();await open('sender');
  assert.equal(button('Enviar Mensaje').disabled,true);assert.match(container.textContent,/propio perfil/);
  assert.equal(container.querySelector('[role="dialog"]').querySelectorAll('button').length,2);
  await click(button('Enviar Mensaje'));assert.equal(posts().length,0);
});
test('closing a pending request and choosing another donor ignores the old response and keeps the new lock',async()=>{
  await mount();await open();gate=deferred();await click(button('Enviar Mensaje'));
  const first=gate;await click(button('Cerrar detalle del donador'));await open('second');
  gate=deferred();await click(button('Enviar Mensaje'));const second=gate;
  await act(async()=>first.resolve());assert.equal(location.pathname,'/entrepreneur-campaigns');
  assert.equal(button('Abriendo conversación...').disabled,true);
  assert.equal(posts()[1].body.otherUserId,'second');
  await act(async()=>second.resolve());assert.equal(location.pathname,'/chat/conversation');
});
for(const reject of [false,true])test(`changing campaign ignores a late chat ${reject?'failure':'success'}`,async()=>{
  await mount();await open();gate=deferred();await click(button('Enviar Mensaje'));const pending=gate;
  gate=null;await mount({campaignId:'another'});await open('second');
  await act(async()=>reject?pending.reject(new Error('Old failure')):pending.resolve());
  assert.equal(location.pathname,'/entrepreneur-campaigns');assert.equal(container.querySelector('[role="alert"]'),null);
  assert.equal(button('Enviar Mensaje').disabled,false);
});
