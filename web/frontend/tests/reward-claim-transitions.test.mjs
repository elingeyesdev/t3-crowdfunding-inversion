import test, { beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import axios from 'axios';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'MouseEvent', 'Event']) {
  Object.defineProperty(globalThis, name, { value: dom.window[name], configurable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.localStorage = { getItem: () => 'owner-token' };
const { createRoot } = await import('react-dom/client');
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (['/campaign.api', '/admin.api', '/campaignPages', '/campaignFunding', '/rewardTracking'].some(path => specifier.endsWith(path))) return nextResolve(specifier + '.ts', context);
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (!url.endsWith('/CampaignRewardsTab.tsx')) return nextLoad(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
    }).outputText };
  },
});
let claims, patches, failUpdate, resolveUpdate;
const originalAdapter = axios.defaults.adapter;
axios.defaults.adapter = async config => {
  let data;
  if (config.method === 'patch') {
    patches.push(JSON.parse(config.data));
    assert.equal(config.headers.Authorization, 'Bearer owner-token');
    if (failUpdate) {
      claims = [{ ...claims[0], claim_status: 'cancelled', investment_status: 'refunded', allowed_statuses: [] }];
      const message = 'No se puede actualizar la recompensa de un aporte reembolsado o no completado.';
      throw new axios.AxiosError(message, 'ERR_BAD_REQUEST', config, null, { config, status: 422, headers: {}, data: { message } });
    }
    if (resolveUpdate) await new Promise(resolve => { resolveUpdate = resolve; });
    // Return the server's canonical state rather than deriving it in the component.
    data = { id: 'claim', status: 'processing', allowedStatuses: ['shipped', 'cancelled'] };
  } else if (config.url.endsWith('/claims')) data = claims;
  else if (config.url.endsWith('/rewards/all')) data = [];
  else data = {};
  return { data: { data }, config, headers: {}, status: 200, statusText: 'OK' };
};
const { CampaignRewardsTab } = await import('../src/components/CampaignRewardsTab.tsx');
let root, container;
beforeEach(() => {
  claims = [{ claim_id: 'claim', claim_status: 'pending', investment_status: 'completed', allowed_statuses: ['processing', 'cancelled'], investment_id: 'investment', reward_title: 'Paquete', amount: 100, invested_at: '2026-11-19T12:00:00Z', investor_email: 'donor@example.test', first_name: 'Donador', last_name: 'Test' }];
  patches = [];
  failUpdate = false;
  resolveUpdate = null;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
after(() => { axios.defaults.adapter = originalAdapter; dom.window.close(); });
async function render(props = {}) {
  await act(async () => root.render(createElement(CampaignRewardsTab, { campaignId: 'campaign', currency: 'BOB', ...props })));
  const toggle = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Donadores con Recompensas'));
  assert.ok(toggle, container.textContent);
  await act(async () => toggle.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}
const select = () => container.querySelector('select');
const values = () => [...select().options].map(option => option.value);
const change = async status => act(async () => { select().value = status; select().dispatchEvent(new Event('change', { bubbles: true })); });

test('owner sees only the current state and server-authorized transitions', async () => {
  await render();
  assert.deepEqual(values(), ['pending', 'processing', 'cancelled']);
  assert.equal(select().disabled, false);
  await change('processing');
  assert.deepEqual(patches, [{ status: 'processing' }]);
  assert.equal(select().value, 'processing');
  assert.deepEqual(values(), ['processing', 'shipped', 'cancelled']);
});

test('cancelled, delivered and refunded claims remain visible without delivery actions', async () => {
  claims = ['cancelled', 'delivered', 'pending'].map((status, index) => ({ ...claims[0], claim_id: 'claim-'+index, investment_id: 'investment-'+index, claim_status: status, investment_status: index === 2 ? 'refunded' : 'completed', allowed_statuses: [] }));
  await render();
  const selectors = [...container.querySelectorAll('select')];
  assert.equal(selectors.length, 3);
  for (const node of selectors) { assert.equal(node.disabled, true); assert.equal(node.options.length, 1); }
  assert.match(selectors[0].textContent, /Cancelada/);
  assert.match(selectors[1].textContent, /Entregada/);
  assert.equal(patches.length, 0);
});

test('a refund during confirmation displays the API error and refreshes the cancelled state', async () => {
  failUpdate = true;
  await render();
  await change('processing');
  assert.match(container.querySelector('[role="alert"]').textContent, /aporte reembolsado/);
  assert.equal(select().value, 'cancelled');
  assert.equal(select().disabled, true);
  assert.deepEqual(values(), ['cancelled']);
});

test('a pending request disables changes and preserves the last confirmed state until success', async () => {
  resolveUpdate = true;
  await render();
  await change('processing');
  assert.equal(select().disabled, true);
  assert.equal(select().value, 'pending');
  await act(async () => resolveUpdate());
  assert.equal(select().disabled, false);
  assert.equal(select().value, 'processing');
  assert.equal(patches.length, 1);
});

test('read-only and admin views cannot mutate reward claims', async () => {
  await render({ readOnly: true });
  assert.equal(select().disabled, true);
  await act(async () => root.unmount());
  root = createRoot(container);
  await render({ isAdmin: true });
  assert.equal(select().disabled, true);
  assert.equal(patches.length, 0);
});

test('the owner can manage deliveries while reward tier definitions remain read-only', async () => {
  await render({ readOnly: true, canManageClaims: true });
  assert.equal(select().disabled, false);
  assert.ok(![...container.querySelectorAll('button')].some(button => button.textContent.includes('Nuevo Nivel')));
  await change('processing');
  assert.deepEqual(patches, [{ status: 'processing' }]);
});
