import test, {beforeEach,afterEach,after} from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import ts from 'typescript';
import {JSDOM} from 'jsdom';
import {act,createElement} from 'react';
import {MemoryRouter} from 'react-router-dom';
import axios from 'axios';

const dom=new JSDOM('<!doctype html><html><body></body></html>',{url:'http://localhost'});
for(const name of ['window','document','navigator','HTMLElement','Node','MouseEvent','Event']) Object.defineProperty(globalThis,name,{value:dom.window[name],configurable:true});
globalThis.localStorage=dom.window.localStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT=true;
const {createRoot}=await import('react-dom/client');
registerHooks({
  resolve(specifier,context,next){
    if(specifier.startsWith('.')&&context.parentURL?.includes('/frontend/src/')) for(const ext of ['.ts','.tsx']) {
      const url=new URL(specifier+ext,context.parentURL);if(existsSync(url))return {url:url.href,shortCircuit:true};
    }
    return next(specifier,context);
  },
  load(url,context,next){
    if(!url.endsWith('.tsx')||!url.includes('/frontend/src/'))return next(url,context);
    return {format:'module',shortCircuit:true,source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2023}}).outputText};
  },
});
const originalAdapter=axios.defaults.adapter;
let root,container,rows,status,gates,calls,errors;
const originalError=console.error;
const row=(id='first',liked=false,count=2)=>({id,campaignId:'campaign',authorId:'author',authorName:id,authorAvatar:null,content:'Comentario '+id,likedByMe:liked,likesCount:count,createdAt:'2026-11-20T12:00:00Z'});
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
axios.defaults.adapter=async config=>{
  const operation=config.method==='get'?'list':config.url.endsWith('/like')?'like':'post';
  calls.push({operation,url:config.url,data:config.data});
  if(gates[operation])await gates[operation].promise;
  if(status[operation]!==null)throw new axios.AxiosError('Synthetic failure','ERR_BAD_RESPONSE',config,null,status[operation]?{status:status[operation],data:{message:status[operation]===422?'El comentario no es válido.':'INTERNAL DETAILS'}}:undefined);
  let data;
  if(operation==='list')data=structuredClone(rows);
  else if(operation==='post'){
    data={...row('created'),content:JSON.parse(config.data).content,likesCount:0};rows.unshift(data);
  }else{
    const id=config.url.split('/').at(-2);const comment=rows.find(item=>item.id===id);
    comment.likesCount+=comment.likedByMe?-1:1;comment.likedByMe=!comment.likedByMe;
    data={liked:comment.likedByMe,likesCount:comment.likesCount};
  }
  return {config,status:200,statusText:'OK',headers:{},data:{data}};
};
const {CampaignComments}=await import('../src/components/campaign-detail/CampaignComments.tsx');
beforeEach(()=>{
  rows=[row(),row('second')];status={list:null,post:null,like:null};gates={};calls=[];errors=[];
  console.error=(...args)=>errors.push(args);localStorage.setItem('accessToken','test');
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(async()=>{try{await act(async()=>root.unmount());container.remove();assert.deepEqual(errors,[]);}finally{console.error=originalError;}});
after(()=>{axios.defaults.adapter=originalAdapter;dom.window.close();});
const mount=(props={})=>act(async()=>root.render(createElement(MemoryRouter,null,createElement(CampaignComments,{campaignId:'campaign',...props}))));
const button=label=>[...container.querySelectorAll('button')].find(node=>node.getAttribute('aria-label')===label||node.textContent===label);
const click=node=>act(async()=>{assert.ok(node);node.click();});
const fill=text=>act(async()=>{
  const node=container.querySelector('textarea');Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype,'value').set.call(node,text);node.dispatchEvent(new Event('input',{bubbles:true}));
});
const like=(id='first')=>button('Dar me gusta al comentario de '+id)||button('Quitar me gusta al comentario de '+id);
for(const failure of [0,500,401])test(`list ${failure}: no fake empty state or counter and retry recovers`,async()=>{
  status.list=failure;await mount();
  assert.ok(container.querySelector('[role="alert"]'));
  assert.doesNotMatch(container.textContent,/Sé el primero|\(0\)|INTERNAL DETAILS/);
  if(failure===401)assert.equal(container.querySelector('a[href="/login"]').textContent,'Iniciar sesión');
  else{status.list=null;await click(button('Reintentar'));assert.match(container.textContent,/Comentario first/);}
});
test('loading, empty and successful comments remain distinct',async()=>{
  gates.list=deferred();rows=[];await mount();
  assert.match(container.querySelector('[role="status"]').textContent,/Cargando/);
  assert.doesNotMatch(container.textContent,/Sé el primero|\(0\)/);
  await act(async()=>gates.list.resolve());assert.match(container.textContent,/Sé el primero/);assert.match(container.textContent,/\(0\)/);
});
for(const failure of [0,422,500,401])test(`posting ${failure} retains the draft, blocks duplicate sends and recovers`,async()=>{
  await mount();await fill('  Texto conservado  ');status.post=failure;gates.post=deferred();
  const publish=button('Publicar comentario');
  await act(async()=>{publish.dispatchEvent(new MouseEvent('click',{bubbles:true}));publish.dispatchEvent(new MouseEvent('click',{bubbles:true}));});
  assert.equal(calls.filter(call=>call.operation==='post').length,1);
  assert.equal(like().disabled,true);assert.equal(container.querySelector('textarea').disabled,true);
  await act(async()=>gates.post.resolve());
  assert.equal(container.querySelector('textarea').value,'  Texto conservado  ');
  assert.ok(container.querySelector('[role="alert"]'));
  if(failure===401)assert.ok(container.querySelector('a[href="/login"]'));
  else{
    status.post=null;gates.post=null;await click(button('Reintentar'));
    assert.equal(container.querySelector('textarea').value,'');assert.equal(rows.filter(item=>item.id==='created').length,1);
    assert.match(container.textContent,/Texto conservado/);assert.equal(container.querySelector('[role="alert"]'),null);
  }
});
for(const initiallyLiked of [false,true])test(`failed ${initiallyLiked?'unlike':'like'} restores the exact snapshot and blocks overlapping mutations`,async()=>{
  rows=[row('first',initiallyLiked,initiallyLiked?1:0),row('second')];await mount();
  status.like=500;gates.like=deferred();await fill('Borrador durante el like');
  const first=like(),second=like('second'),publish=button('Publicar comentario');
  await act(async()=>{first.dispatchEvent(new MouseEvent('click',{bubbles:true}));first.dispatchEvent(new MouseEvent('click',{bubbles:true}));second.dispatchEvent(new MouseEvent('click',{bubbles:true}));publish.dispatchEvent(new MouseEvent('click',{bubbles:true}));});
  assert.equal(calls.filter(call=>call.operation==='like').length,1);assert.equal(calls.filter(call=>call.operation==='post').length,0);
  await act(async()=>gates.like.resolve());
  assert.equal(like().getAttribute('aria-pressed'),String(initiallyLiked));assert.equal(like().textContent,initiallyLiked?'1':'Me gusta');
  assert.equal(container.querySelector('textarea').value,'Borrador durante el like');
  assert.match(container.querySelector('[role="alert"]').textContent,/estado anterior/);
  status.like=null;gates.like=null;await click(button('Reintentar'));
  assert.equal(like().getAttribute('aria-pressed'),String(!initiallyLiked));assert.equal(like().textContent,initiallyLiked?'Me gusta':'1');
  assert.equal(container.querySelector('[role="alert"]'),null);
});
for(const operation of ['list','post','like'])test(`a late ${operation} response cannot change another campaign or its draft`,async()=>{
  if(operation==='list')gates.list=deferred();
  await mount();
  if(operation==='post'){gates.post=deferred();await fill('Texto anterior');await click(button('Publicar comentario'));}
  if(operation==='like'){gates.like=deferred();await click(like());}
  const pending=gates[operation];gates[operation]=null;rows=[row('current')];
  await mount({campaignId:'another'});await fill('Nuevo borrador');
  await act(async()=>pending.resolve());
  assert.match(container.textContent,/Comentario current/);assert.doesNotMatch(container.textContent,/Comentario first|Texto anterior/);
  assert.equal(container.querySelector('textarea').value,'Nuevo borrador');assert.equal(container.querySelector('[role="alert"]'),null);
});
test('closed campaigns retain read access and disable mutations, including after a load retry',async()=>{
  status.list=500;await mount({readOnly:true});status.list=null;await click(button('Reintentar'));
  assert.match(container.textContent,/Comentario first/);assert.equal(container.querySelector('textarea'),null);
  assert.equal(like().disabled,true);await click(like());assert.equal(calls.filter(call=>call.operation!=='list').length,0);
});
