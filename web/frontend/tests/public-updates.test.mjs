import test from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import axios from 'axios';

registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(specifier.endsWith('/image.utils') ? specifier + '.ts' : specifier, context);
  },
  load(url, context, nextLoad) {
    if (!url.endsWith('/CampaignUpdatesTimeline.tsx')) return nextLoad(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
    }).outputText };
  },
});
const { CampaignUpdatesTimeline } = await import('../src/components/campaign-detail/transparency/CampaignUpdatesTimeline.tsx');
const render = props => renderToStaticMarkup(createElement(CampaignUpdatesTimeline, props));
const update = { id: 'entry', campaignId: 'campaign', title: 'Primer avance', content: 'Nueva etapa del proyecto', authorName: 'Public Author', authorDisplayName: 'project-author', authorAvatar: '/storage/profiles/avatar.jpg', createdAt: '2026-11-18T18:00:00Z' };

test('the timeline renders public content and author data', () => {
  const html = render({ updates: [update] });
  for (const text of ['Primer avance', 'Nueva etapa del proyecto', 'Public Author', '@project-author', '/storage/profiles/avatar.jpg']) assert.ok(html.includes(text));
});

test('load errors show a retry button and hide empty or stale content', () => {
  const html = render({ updates: [update], error: 'No se pudo cargar la bitácora.', onRetry() {} });
  assert.match(html, /role="alert"/);
  assert.match(html, /Reintentar/);
  assert.doesNotMatch(html, /Primer avance|Aún no se han publicado/);
});

test('only a successful empty response shows the empty-log message', () => {
  const html = render({ updates: [] });
  assert.match(html, /Aún no se han publicado/);
  assert.doesNotMatch(html, /role="alert"|Reintentar/);
});

test('loading hides old entries without presenting an empty log', () => {
  const html = render({ updates: [update], loading: true });
  assert.match(html, /Cargando bitácora/);
  assert.doesNotMatch(html, /Primer avance|Aún no se han publicado/);
});

// Intercept the actual API client to verify its route and response contract.
let body = [update];
let fail = false;
const requests = [];
const originalAdapter = axios.defaults.adapter;
axios.defaults.adapter = async config => {
  requests.push(config);
  if (fail) throw new Error('Simulated connection failure');
  return { data: { data: body }, status: 200, statusText: 'OK', headers: {}, config };
};
const { fetchPublicCampaignUpdates } = await import('../src/api/public-campaigns.api.ts');
axios.defaults.adapter = originalAdapter;

test('the client uses the existing public route and accepts an empty log', async () => {
  body = [update];
  assert.deepEqual(await fetchPublicCampaignUpdates('campaign'), [update]);
  assert.equal(requests.at(-1).url, '/campaigns/campaign/updates');
  assert.equal(requests.at(-1).baseURL, '/api/v1');
  assert.equal(requests.at(-1).timeout, 15000);
  body = [];
  assert.deepEqual(await fetchPublicCampaignUpdates('campaign'), []);
});

test('invalid payloads and connection failures remain errors and a new request can recover', async () => {
  body = { unexpected: 'response' };
  await assert.rejects(fetchPublicCampaignUpdates('campaign'), /no es válida/);
  fail = true;
  await assert.rejects(fetchPublicCampaignUpdates('campaign'), /connection failure/);
  fail = false;
  body = [update];
  assert.deepEqual(await fetchPublicCampaignUpdates('campaign'), [update]);
});
