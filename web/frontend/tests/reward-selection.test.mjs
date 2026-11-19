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
globalThis.localStorage = { getItem: () => 'donor-token' };
const { createRoot } = await import('react-dom/client');
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (['/campaignStatus', '/rewardSelection'].some(path => specifier.endsWith(path))) return nextResolve(specifier + '.ts', context);
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (!url.endsWith('.tsx') || !url.includes('/frontend/src/')) return nextLoad(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
    }).outputText };
  },
});
const { RewardTierCards } = await import('../src/components/campaign-detail/RewardTierCards.tsx');
const { ContributionConfirmModal } = await import('../src/components/campaign-detail/ContributionConfirmModal.tsx');
const { rewardAmountRange, rewardSelectionError } = await import('../src/utils/rewardSelection.ts');
const tier = { id: 'selected', title: 'Recompensa elegida', description: 'Paquete seleccionado', amount: 75, currency: 'BOB', minPercentage: 5, maxPercentage: 20, maxClaims: null, currentClaims: 0, isActive: true, expiresAt: null };
let root, container;
beforeEach(() => {
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
after(() => dom.window.close());
const render = async (component, props) => act(async () => root.render(createElement(component, props)));
const click = async button => act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));

test('selection validates the same price and inclusive percentage limits as the API', () => {
  assert.deepEqual(rewardAmountRange(tier, 1000), { min: 75, max: 200 });
  for (const amount of [75, 100, 200]) assert.equal(rewardSelectionError(tier, amount, 1000, 'BOB'), null);
  for (const amount of [50, 74.99, 200.01]) assert.match(rewardSelectionError(tier, amount, 1000, 'BOB'), /entre 75 y 200/);
  const exact = { ...tier, amount: 0, minPercentage: 12.345, maxPercentage: 12.345 };
  assert.deepEqual(rewardAmountRange(exact, 2000), { min: 246.9, max: 246.9 });
  assert.equal(rewardSelectionError(exact, 246.9, 2000, 'BOB'), null);
});

test('missing, inactive, expired, sold-out and wrong-currency selections have explicit errors', () => {
  assert.match(rewardSelectionError(undefined, 100, 1000, 'BOB'), /ya no está disponible/);
  for (const [attrs, expected] of [[{ isActive: false }, /no disponible/], [{ expiresAt: '2000-01-01T00:00:00Z' }, /vencida/], [{ maxClaims: 1, currentClaims: 1 }, /agotada/], [{ currency: 'USD' }, /moneda/]]) {
    assert.match(rewardSelectionError({ ...tier, ...attrs }, 100, 1000, 'BOB'), expected);
  }
});

test('reward cards show the actual range, disable unavailable tiers and preserve selection identity', async () => {
  let selected;
  const tiers = [tier, { ...tier, id: 'expired', expiresAt: '2000-01-01T00:00:00Z' }, { ...tier, id: 'sold', maxClaims: 1, currentClaims: 1 }, { ...tier, id: 'inactive', isActive: false }];
  await render(RewardTierCards, { tiers, goalAmount: 1000, selectedTierId: null, onSelect: id => { selected = id; } });
  const buttons = [...container.querySelectorAll('button')];
  assert.match(buttons[0].textContent, /75 – 200/);
  assert.doesNotMatch(buttons[0].textContent, /o más/);
  for (const button of buttons.slice(1)) {
    assert.equal(button.disabled, true);
    await click(button);
  }
  assert.equal(selected, undefined);
  await click(buttons[0]);
  assert.equal(selected, tier.id);
});

test('confirmation displays the selected reward and invokes confirmation only when enabled', async () => {
  let confirmed = 0;
  const props = { campaign: { title: 'Campaña', campaignType: 'donation', currency: 'BOB' }, amount: 100, selectedTier: tier, loading: false, onConfirm: () => confirmed++, onCancel() {} };
  await render(ContributionConfirmModal, props);
  assert.match(container.textContent, /Recompensa elegida/);
  assert.match(container.textContent, /Recompensa Incluida/);
  await click([...container.querySelectorAll('button')].find(button => button.textContent.includes('Confirmar Aporte')));
  assert.equal(confirmed, 1);
  await render(ContributionConfirmModal, { ...props, loading: true });
  const processing = [...container.querySelectorAll('button')].find(button => button.textContent.includes('Procesando'));
  assert.equal(processing.disabled, true);
  await click(processing);
  assert.equal(confirmed, 1);
});

test('direct confirmation explicitly states that no reward is included', async () => {
  await render(ContributionConfirmModal, { campaign: { title: 'Campaña', campaignType: 'donation' }, amount: 100, selectedTier: null, loading: false, onConfirm() {}, onCancel() {} });
  assert.match(container.textContent, /Aporte directo sin recompensa/);
  assert.doesNotMatch(container.textContent, /Recompensa Incluida/);
});

test('the client sends the exact selected ID and surfaces a stale-availability rejection', async () => {
  const originalAdapter = axios.defaults.adapter;
  let sent;
  axios.defaults.adapter = async config => {
    sent = JSON.parse(config.data);
    assert.equal(config.headers.Authorization, 'Bearer donor-token');
    const response = { config, status: 422, headers: {}, data: { message: 'La recompensa seleccionada se ha agotado. No se registró el aporte.' } };
    throw new axios.AxiosError('Unavailable', 'ERR_BAD_REQUEST', config, null, response);
  };
  try {
    const { createInvestment } = await import('../src/api/investor.api.ts');
    await assert.rejects(createInvestment({ campaignId: 'campaign', amount: 100, rewardTierId: tier.id }), error => error.response.status === 422 && error.response.data.message.includes('agotado'));
    assert.deepEqual(sent, { campaignId: 'campaign', amount: 100, rewardTierId: 'selected' });
    await assert.rejects(createInvestment({ campaignId: 'campaign', amount: 100 }));
    assert.equal(Object.hasOwn(sent, 'rewardTierId'), false);
  } finally { axios.defaults.adapter = originalAdapter; }
});
