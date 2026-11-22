import test, { beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'MouseEvent', 'Event']) {
  Object.defineProperty(globalThis, name, { value: dom.window[name], configurable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const shells = ['Navbar', 'Footer', 'UniFoundMeLogo', 'AISupportChat'];
const shellModule = new URL('./__landing_shell.mjs', import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (shells.some(name => specifier.endsWith('/'+name))) return { url: shellModule, shortCircuit: true };
    if (['/public-campaigns.api', '/categories.api', '/image.utils', '/campaignDonors'].some(path => specifier.endsWith(path))) return nextResolve(specifier + '.ts', context);
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === shellModule) return { format: 'module', shortCircuit: true, source: shells.map(name => `export function ${name}() { return null; }`).join('\n') };
    if (!url.endsWith('/LandingPage.tsx')) return nextLoad(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
    }).outputText };
  },
});
const campaign = (id, investorCount) => ({ id, title: 'Proyecto '+id, slug: id, shortDescription: 'Historia real', campaignType: 'donation', status: 'published', goalAmount: 1000, currentAmount: 250, investorCount, coverImageUrl: null, endDate: null, createdAt: '2026-11-21T12:00:00Z', categoryName: 'Comunidad', entrepreneurName: 'Emprendedor', entrepreneurUserId: 'owner', videoUrl: null });
let response, failure, pending, release, requests;
const originalAdapter = axios.defaults.adapter;
axios.defaults.adapter = async config => {
  if (config.url === '/categories') return { data: { data: [] }, config, headers: {}, status: 200, statusText: 'OK' };
  requests.push(config.url);
  if (pending) await new Promise(resolve => { release = resolve; });
  if (failure) throw new axios.AxiosError('Unavailable', 'ERR_NETWORK', config);
  return { data: { data: response }, config, headers: {}, status: 200, statusText: 'OK' };
};
const { LandingPage } = await import('../src/pages/LandingPage.tsx');
const { campaignDonorsLabel } = await import('../src/utils/campaignDonors.ts');
let root, container;
beforeEach(() => {
  response = { data: [campaign('uno', 7)], meta: { totalItems: 123 } };
  failure = false; pending = false; release = null; requests = [];
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
after(() => { axios.defaults.adapter = originalAdapter; dom.window.close(); });
const render = async () => act(async () => root.render(createElement(MemoryRouter, null, createElement(LandingPage))));
const text = () => container.textContent;

test('the landing page displays API totals and donor counts without invented social or success statistics', async () => {
  await render();
  assert.match(text(), /123 campañas disponibles/);
  assert.doesNotMatch(text(), /123\+|100\+ donadores|94%|Éxito comprobado|cientos de emprendedores|miles de donadores|100% seguras/);
  assert.equal([...container.querySelectorAll('[title="Personas con aportes vigentes en esta campaña"]')].length, 2);
  for (const metric of container.querySelectorAll('[title="Personas con aportes vigentes en esta campaña"]')) assert.match(metric.textContent, /7 donadores/);
  assert.match(requests[0], /limit=8/);
  assert.ok(container.querySelector('a[href="/explore"]'));
});

test('zero campaigns is an explicit successful empty state', async () => {
  response = { data: [], meta: { totalItems: 0 } };
  await render();
  assert.match(text(), /0 campañas disponibles/);
  assert.match(text(), /No hay campañas disponibles aún/);
  assert.equal(container.querySelector('[role="alert"]'), null);
  assert.doesNotMatch(text(), /Donadores: sin datos|100\+|94%/);
});

test('zero donors, one donor and unavailable counts remain distinct across campaign cards', async () => {
  response = { data: [campaign('cero', 0), campaign('uno', 1), campaign('sin-datos', null)], meta: { totalItems: 3 } };
  await render();
  assert.match(text(), /0 donadores/);
  assert.match(text(), /1 donador/);
  assert.match(text(), /Donadores: sin datos/);
  assert.doesNotMatch(text(), /undefined|NaN|null donadores/);
});

test('loading does not present an empty result or a zero total', async () => {
  pending = true;
  await render();
  assert.match(text(), /Cargando campañas/);
  assert.doesNotMatch(text(), /0 campañas disponibles|No hay campañas disponibles/);
  pending = false;
  await act(async () => release());
  assert.match(text(), /123 campañas disponibles/);
});

test('a failed query shows unavailable data and retry recovers the real metrics', async () => {
  failure = true;
  await render();
  assert.match(container.querySelector('[role="alert"]').textContent, /No se pudieron cargar/);
  assert.match(text(), /Campañas: sin datos/);
  assert.doesNotMatch(text(), /0 campañas disponibles|No hay campañas disponibles aún/);
  failure = false;
  await act(async () => [...container.querySelectorAll('button')].find(node => node.textContent === 'Reintentar').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  assert.match(text(), /123 campañas disponibles/);
  assert.equal(container.querySelector('[role="alert"]'), null);
});

test('invalid metrics are unavailable rather than fabricated zeroes and labels use singular correctly', async () => {
  response = { data: [campaign('uno', -1)], meta: { totalItems: null } };
  await render();
  assert.match(text(), /Campañas: sin datos/);
  assert.match(text(), /Donadores: sin datos/);
  assert.equal(campaignDonorsLabel(1), '1 donador');
  assert.equal(campaignDonorsLabel(0), '0 donadores');
  for (const invalid of [null, undefined, -1, NaN, Infinity, 1.5, '7']) assert.equal(campaignDonorsLabel(invalid), 'Donadores: sin datos');
});
