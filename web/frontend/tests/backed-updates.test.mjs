import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';

let fail = false;
let body;
const requests = [];
const originalAdapter = axios.defaults.adapter;
axios.defaults.adapter = async config => {
  requests.push(config);
  if (fail) throw new Error('Connection unavailable');
  return { data: { data: body }, status: 200, statusText: 'OK', headers: {}, config };
};
globalThis.localStorage = { getItem: () => 'donor-token' };
registerHooks({
  resolve(specifier, context, nextResolve) {
    const localModule = ['/image.utils', '/useBackedCampaignUpdates', '/investor.api'].some(path => specifier.endsWith(path));
    return nextResolve(localModule ? specifier + '.ts' : specifier, context);
  },
  load(url, context, nextLoad) {
    if (!url.endsWith('/DonorBackedUpdatesFeed.tsx')) return nextLoad(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
    }).outputText };
  },
});
const { DonorBackedUpdatesFeedView } = await import('../src/components/donor-tracking/DonorBackedUpdatesFeed.tsx');
const { getBackedCampaignUpdates } = await import('../src/api/investor.api.ts');
axios.defaults.adapter = originalAdapter;

const update = { id: 'entry', campaignId: 'first', title: 'Avance del proyecto', content: 'Resultados publicados', attachments: [], campaignTitle: 'Primer proyecto', campaignCurrentAmount: 100, campaignGoalAmount: 1000, entrepreneurName: 'Public Author', createdAt: '2026-11-18T18:00:00Z' };
const meta = { totalItems: 24, totalPages: 3, currentPage: 1, itemCount: 10, itemsPerPage: 10 };
const defaults = { updates: [update], campaigns: [{ id: 'first', title: 'Primer proyecto' }, { id: 'later', title: 'Proyecto de otra página' }], loading: false, error: null, meta, page: 1, selectedCampaignId: 'all', onCampaignChange() {}, onPageChange() {}, onRetry() {} };
const render = props => renderToStaticMarkup(createElement(MemoryRouter, null, createElement(DonorBackedUpdatesFeedView, { ...defaults, ...props })));

test('results include the author, campaign link, global campaign options and pagination', () => {
  const html = render({});
  for (const text of ['Avance del proyecto', 'Public Author', 'Proyecto de otra página', 'Siguiente', 'Anterior', 'Página 1 de 3', 'href="/campaign/first"']) assert.ok(html.includes(text));
  assert.match(html, /disabled=""[^>]*>Anterior/);
  assert.doesNotMatch(html, /Sin novedades publicadas/);
});

test('a load error shows retry without presenting old results or an empty feed', () => {
  const html = render({ error: 'No se pudieron cargar las novedades.' });
  assert.match(html, /role="alert"/);
  assert.match(html, /Reintentar/);
  assert.doesNotMatch(html, /Avance del proyecto|Sin novedades publicadas|Paginación de novedades/);
});

test('loading hides prior results and a successful empty result has its own message', () => {
  const loading = render({ loading: true });
  assert.match(loading, /Sincronizando bitácora/);
  assert.doesNotMatch(loading, /Avance del proyecto|Sin novedades publicadas/);
  const empty = render({ updates: [], meta: { ...meta, totalItems: 0, totalPages: 1 } });
  assert.match(empty, /Sin novedades publicadas/);
  assert.doesNotMatch(empty, /Reintentar|role="alert"/);
});

test('the final page disables next and a removed project has an explicit option', () => {
  const last = render({ page: 3, meta: { ...meta, currentPage: 3 } });
  assert.match(last, /disabled=""[^>]*>Siguiente/);
  const unavailable = render({ selectedCampaignId: 'removed', campaigns: [] });
  assert.match(unavailable, /Proyecto no disponible/);
});

test('the API sends authentication, page and campaign filters to the paginated route', async () => {
  body = { data: [update], meta, campaigns: defaults.campaigns };
  assert.deepEqual(await getBackedCampaignUpdates({ page: 2, limit: 10, campaignId: 'later' }), body);
  assert.equal(requests.at(-1).url, '/investments/backed-campaigns/updates');
  assert.deepEqual(requests.at(-1).params, { page: 2, limit: 10, campaignId: 'later' });
  assert.equal(requests.at(-1).headers.Authorization, 'Bearer donor-token');
  await getBackedCampaignUpdates();
  assert.deepEqual(requests.at(-1).params, { page: 1, limit: 10 });
});

test('empty pages remain valid while invalid payloads and connection failures surface as errors', async () => {
  body = { data: [], campaigns: [], meta: { ...meta, totalItems: 0, totalPages: 1 } };
  assert.deepEqual((await getBackedCampaignUpdates()).data, []);
  body = []; // The previous unpaginated shape must not masquerade as empty.
  await assert.rejects(getBackedCampaignUpdates(), /no es válida/);
  fail = true;
  await assert.rejects(getBackedCampaignUpdates(), /Connection unavailable/);
  fail = false;
  body = { data: [update], meta, campaigns: defaults.campaigns };
  assert.equal((await getBackedCampaignUpdates()).data.length, 1);
});
