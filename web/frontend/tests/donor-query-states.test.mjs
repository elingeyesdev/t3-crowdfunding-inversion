import test, { beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { existsSync, readFileSync } from 'node:fs';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {url:'http://localhost'});
for (const name of ['window','document','navigator','HTMLElement','Node','Event','MouseEvent']) Object.defineProperty(globalThis,name,{value:dom.window[name],configurable:true});
globalThis.localStorage = dom.window.localStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const {createRoot} = await import('react-dom/client');
const shells = ['Navbar','ProfileHeader','ProfileSidebar','ProfileTabs','AddCapitalModal','EditProfileModal'];
const virtual = name => new URL('./__donor_'+name+'.mjs',import.meta.url).href;
registerHooks({
  resolve(specifier, context, next) {
    const shell = shells.find(name=>specifier.endsWith('/'+name));
    if (shell) return {url:virtual(shell),shortCircuit:true};
    if (specifier.startsWith('.') && context.parentURL?.includes('/frontend/src/')) for (const extension of ['.ts','.tsx']) {
      const url = new URL(specifier+extension,context.parentURL);
      if (existsSync(url)) return {url:url.href,shortCircuit:true};
    }
    return next(specifier,context);
  },
  load(url,context,next) {
    const name = shells.find(shell=>url===virtual(shell));
    if (name) {
      return {format:'module',shortCircuit:true,source: name === 'EditProfileModal'
        ? "import {createElement} from 'react'; export function EditProfileModal({type}) {return type?createElement('div',{role:'dialog'},'Editor de perfil'):null;}"
        : `export function ${name}(){return null;}`};
    }
    if (!url.endsWith('.tsx') || !url.includes('/frontend/src/')) return next(url,context);
    return {format:'module',shortCircuit:true,source:ts.transpileModule(readFileSync(new URL(url),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2023}}).outputText};
  },
});
let historyStatus, capitalStatus, profileStatus, rows, root, container, calls, holdHistory, latest;
const capital = {totalInvestments:1,totalInvested:125,maxInvestmentLimit:1000,availableCapital:875,pendingAmount:0,completedInvestments:1};
const row = {id:'investment',campaignId:'campaign',campaignTitle:'Donación confirmada de prueba',campaignType:'donation',amount:125,currency:'BOB',investmentStatus:'completed',createdAt:'2026-11-20T12:00:00Z',campaignGoal:1000,campaignCurrentAmount:125,rewardClaimId:null};
const originalAdapter = axios.defaults.adapter;
axios.defaults.adapter = async config => {
  calls.push(config.url);
  const status = config.url === '/investments/me' ? historyStatus : config.url === '/investors/me/capital' ? capitalStatus : profileStatus;
  if (config.url === '/investments/me' && holdHistory) await holdHistory.promise;
  if (status !== null) throw new axios.AxiosError('Synthetic failure','ERR_BAD_RESPONSE',config,null,status ? {status,data:{message:'INTERNAL DETAILS'}} : undefined);
  const data = config.url === '/investments/me' ? rows : config.url === '/investors/me/capital' ? capital : {id:'profile',firstName:'Donador',lastName:'Prueba',investorType:'individual'};
  return {config,status:200,statusText:'OK',headers:{},data:{data}};
};
const {InvestorDashboardPage} = await import('../src/pages/InvestorDashboardPage.tsx');
const {InvestorProfilePage} = await import('../src/pages/InvestorProfilePage.tsx');
const {useInvestorDashboard} = await import('../src/hooks/useInvestorDashboard.ts');
beforeEach(()=>{
  historyStatus=capitalStatus=profileStatus=null; rows=[row]; calls=[];holdHistory=null;
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
after(()=>{axios.defaults.adapter=originalAdapter;dom.window.close();});
const mount = Component => act(async()=>root.render(createElement(MemoryRouter,null,createElement(Component))));
const retry = async () => {
  const button=[...container.querySelectorAll('button')].find(node=>node.textContent==='Reintentar');
  assert.ok(button);await act(async()=>button.click());
};
const deferred=()=>{let resolve;const promise=new Promise(yes=>resolve=yes);return {promise,resolve};};

for (const Component of [InvestorDashboardPage,InvestorProfilePage]) for (const status of [0,500,401,404]) {
  test(`${Component.name}: history ${status} is not empty or a missing profile, and recovers`,async()=>{
    historyStatus=status;
    await mount(Component);
    assert.ok(container.querySelector('[role="alert"]'));
    assert.doesNotMatch(container.textContent,/Sin Donaciones Aún|Completar Perfil de Donador|¡Casi listo/);
    if(status===500) assert.doesNotMatch(container.textContent,/INTERNAL DETAILS/);
    assert.equal(calls.filter(url=>url==='/investments/me').length,1);
    if(status===401) assert.equal(container.querySelector('a[href="/login"]').textContent,'Iniciar sesión');
    else {
      historyStatus=null;await retry();
      assert.match(container.textContent,/Donación confirmada de prueba/);
      assert.equal(container.querySelector('[role="alert"]'),null);
    }
  });
}
for (const status of [0,500,401]) test(`profile ${status} never starts onboarding and can recover`,async()=>{
  profileStatus=status;
  await mount(InvestorProfilePage);
  await act(async()=>new Promise(resolve=>setTimeout(resolve,850)));
  assert.equal(container.querySelector('[role="dialog"]'),null);
  assert.doesNotMatch(container.textContent,/¡Casi listo|Completar Ahora/);
  assert.ok(container.querySelector('[role="alert"]'));
  if(status!==401) {profileStatus=null;await retry();assert.match(container.textContent,/Donación confirmada de prueba/);}
});
test('only a confirmed missing capital profile offers dashboard onboarding',async()=>{
  capitalStatus=404;await mount(InvestorDashboardPage);
  assert.match(container.textContent,/Completar Perfil de Donador/);
});
test('a capital server failure has retry and never requests profile creation',async()=>{
  capitalStatus=500;await mount(InvestorDashboardPage);
  assert.doesNotMatch(container.textContent,/Completar Perfil de Donador|INTERNAL DETAILS/);
  capitalStatus=null;await retry();assert.match(container.textContent,/Donación confirmada de prueba/);
});
test('a successful empty history alone shows the empty state',async()=>{
  rows=[];await mount(InvestorProfilePage);
  assert.match(container.textContent,/Sin Donaciones Aún/);
  assert.equal(container.querySelector('[role="alert"]'),null);
});
test('pending history never presents an empty state',async()=>{
  holdHistory=deferred();await mount(InvestorProfilePage);
  assert.match(container.textContent,/Cargando historial/);
  assert.doesNotMatch(container.textContent,/Sin Donaciones Aún/);
  await act(async()=>holdHistory.resolve());
  assert.match(container.textContent,/Donación confirmada de prueba/);
});
test('refresh hides prior history during loading and failure and retries a new snapshot',async()=>{
  function Harness(){latest=useInvestorDashboard();return null;}
  await mount(Harness);assert.equal(latest.investments.length,1);
  holdHistory=deferred();historyStatus=500;
  await act(async()=>latest.refetch());
  assert.equal(latest.investmentsLoading,true);assert.deepEqual(latest.investments,[]);
  await act(async()=>holdHistory.resolve());
  assert.ok(latest.investmentsError);assert.deepEqual(latest.investments,[]);
  historyStatus=null;holdHistory=null;rows=[];
  await act(async()=>latest.retryInvestments());
  assert.equal(latest.investmentsError,null);assert.deepEqual(latest.investments,[]);
});
