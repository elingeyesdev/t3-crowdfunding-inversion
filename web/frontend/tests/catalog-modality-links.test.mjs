import test, { beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import { act, createElement, useEffect } from 'react';
import { MemoryRouter, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {url:'http://localhost'});
for (const name of ['window','document','navigator','HTMLElement','Node','MouseEvent','Event']) Object.defineProperty(globalThis,name,{value:dom.window[name],configurable:true});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const {createRoot} = await import('react-dom/client');
registerHooks({
  resolve(specifier,context,next) {
    if (specifier.startsWith('.') && context.parentURL?.includes('/frontend/src/')) for(const extension of ['.ts','.tsx']) {
      const url = new URL(specifier+extension,context.parentURL);
      if(existsSync(url)) return {url:url.href,shortCircuit:true};
    }
    return next(specifier,context);
  },
  load(url,context,next) {
    if(!url.endsWith('.tsx') || !url.includes('/frontend/src/')) return next(url,context);
    return {format:'module',shortCircuit:true,source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2023}}).outputText};
  },
});
let calls, pending, root, container, state, location, mounts;
const originalAdapter = axios.defaults.adapter;
axios.defaults.adapter = async config => {
  const query = new URL(config.url,'http://localhost').searchParams;
  calls.push(query);
  if(pending && query.get('campaignType')==='reward') await pending.promise;
  const data = {data:[{id:'donation',title:'Campaña de donación'},{id:'reward',title:'Campaña con recompensas'}].filter(row=>!query.get('campaignType') || row.id===query.get('campaignType')),meta:{totalItems:1,currentPage:Number(query.get('page'))}};
  return {config,status:200,statusText:'OK',headers:{},data:{data}};
};
const {Footer} = await import('../src/components/Footer.tsx');
const {usePublicCampaigns} = await import('../src/hooks/usePublicCampaigns.ts');
function Catalog() {
  state = usePublicCampaigns();
  useEffect(()=>{mounts++;},[]);
  return createElement('div',null,
    createElement('output',null,state.loading?'Cargando':state.campaigns.map(row=>row.title).join(' | ')),
    createElement(Footer));
}
function Navigation() {
  location = useLocation();
  const navigate = useNavigate();
  return createElement('nav',null,
    createElement('button',{onClick:()=>navigate(-1)},'Atrás'),
    createElement('button',{onClick:()=>navigate(1)},'Adelante'));
}
beforeEach(()=>{calls=[];pending=null;mounts=0;container=document.createElement('div');document.body.append(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
after(()=>{axios.defaults.adapter=originalAdapter;dom.window.close();});
const mount = (path='/') => act(async()=>root.render(createElement(MemoryRouter,{initialEntries:[path]},
  createElement(Navigation),createElement(Routes,null,
    createElement(Route,{path:'/',element:createElement(Footer)}),
    createElement(Route,{path:'/explore',element:createElement(Catalog)})))));
const click = label => act(async()=>{
  const node=[...container.querySelectorAll('a,button')].find(node=>node.textContent===label);
  assert.ok(node);node.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true}));
});
for(const [label,type] of [['Campañas de Donación','donation'],['Campañas de Recompensa','reward']]) {
  test(`${label} aligns the URL, filter and actual API request`,async()=>{
    await mount();
    assert.equal([...container.querySelectorAll('a')].find(node=>node.textContent===label).getAttribute('href'),'/explore?campaignType='+type);
    await click(label);
    assert.equal(location.search,'?campaignType='+type);
    assert.equal(state.filters.campaignType,type);
    assert.equal(calls.at(-1).get('campaignType'),type);
    assert.equal(calls.at(-1).has('type'),false);
    assert.deepEqual(state.campaigns.map(row=>row.id),[type]);
  });
}
test('footer navigation changes modality without remounting and back/forward restores each URL',async()=>{
  await mount('/explore?campaignType=donation');
  await click('Campañas de Recompensa');
  assert.equal(mounts,1);assert.equal(state.filters.campaignType,'reward');
  await click('Atrás');assert.equal(state.filters.campaignType,'donation');assert.equal(calls.at(-1).get('campaignType'),'donation');
  await click('Adelante');assert.equal(state.filters.campaignType,'reward');assert.deepEqual(state.campaigns.map(row=>row.id),['reward']);
});
test('changing modality resets pagination and preserves other filters, while browser back restores them',async()=>{
  await mount('/explore?campaignType=donation&page=3&q=huerto&categoryId=category&sortBy=goal_amount&sortOrder=ASC&limit=6');
  await act(async()=>state.updateFilters({campaignType:'reward'}));
  assert.equal(state.filters.page,1);assert.equal(new URLSearchParams(location.search).has('page'),false);
  for(const [key,value] of [['q','huerto'],['categoryId','category'],['sortBy','goal_amount'],['sortOrder','ASC'],['limit','6']]) assert.equal(calls.at(-1).get(key),value);
  await act(async()=>state.goToPage(2));
  assert.equal(calls.at(-1).get('page'),'2');assert.equal(calls.at(-1).get('campaignType'),'reward');
  await click('Atrás');assert.equal(state.filters.page,1);
  await click('Atrás');assert.equal(state.filters.page,3);assert.equal(state.filters.campaignType,'donation');
});
test('clearing filters removes the API modality and back restores the prior selection',async()=>{
  await mount('/explore?campaignType=reward&q=huerto&categoryId=category&page=2');
  await act(async()=>state.updateFilters({q:undefined,categoryId:undefined,campaignType:undefined}));
  assert.equal(location.search,'');assert.equal(state.filters.page,1);assert.equal(calls.at(-1).has('campaignType'),false);
  assert.equal(state.campaigns.length,2);
  await click('Atrás');assert.equal(state.filters.campaignType,'reward');assert.equal(state.filters.q,'huerto');assert.equal(state.filters.page,2);
});
test('late results of another modality cannot replace the current catalog',async()=>{
  let release;pending={promise:new Promise(resolve=>{release=resolve;})};
  await mount('/explore?campaignType=reward');
  assert.equal(state.loading,true);
  await click('Campañas de Donación');
  assert.deepEqual(state.campaigns.map(row=>row.id),['donation']);
  await act(async()=>release());
  assert.deepEqual(state.campaigns.map(row=>row.id),['donation']);assert.equal(state.filters.campaignType,'donation');
});
