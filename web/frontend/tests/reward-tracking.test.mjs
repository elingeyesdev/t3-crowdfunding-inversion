import test, { beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'MouseEvent', 'Event']) {
  Object.defineProperty(globalThis, name, { value: dom.window[name], configurable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('/ProgressBar')) return nextResolve(specifier + '.tsx', context);
    if (['/rewardTracking', '/image.utils', '/investor.api'].some(path => specifier.endsWith(path))) return nextResolve(specifier + '.ts', context);
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (!url.endsWith('.tsx') || !url.includes('/frontend/src/')) return nextLoad(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
    }).outputText };
  },
});
const { DonorRewardsTracker } = await import('../src/components/donor-tracking/DonorRewardsTracker.tsx');
const { DonorContributionsFeed } = await import('../src/components/donor-tracking/DonorContributionsFeed.tsx');
const { hasInvestmentReward, rewardTrackingStatus, rewardTrackingUrl, rewardTrackingDate } = await import('../src/utils/rewardTracking.ts');
const investment = (status, id = status || 'unknown') => ({ id, amount: 100, currency: 'BOB', investmentStatus: 'completed', createdAt: '2026-11-18T18:00:00Z', campaignId: 'campaign', campaignTitle: 'Proyecto de recompensas', campaignType: 'donation', campaignGoal: 1000, campaignCoverImage: null, campaignStatus: 'published', rewardTierId: 'tier-'+id, rewardClaimId: status ? 'claim-'+id : null, rewardTitle: 'Recompensa '+id, rewardClaimStatus: status, trackingNumber: ['shipped', 'delivered'].includes(status) ? 'TRACK-123' : null, trackingUrl: ['shipped', 'delivered'].includes(status) ? 'https://carrier.example/track/123' : null, shippedAt: ['shipped', 'delivered'].includes(status) ? '2026-11-18T18:00:00Z' : null, deliveredAt: status === 'delivered' ? '2026-11-19T18:00:00Z' : null });
const direct = { ...investment(null, 'direct'), rewardTierId: null, rewardClaimId: null, rewardTitle: null };
let root, container, errors;
const originalError = console.error;
beforeEach(() => {
  errors = [];
  console.error = (...args) => errors.push(args.map(String).join(' '));
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  try {
    await act(async () => root.unmount());
    container.remove();
    assert.deepEqual(errors, []);
  } finally { console.error = originalError; }
});
after(() => dom.window.close());
const render = async (investments, component = DonorRewardsTracker, loading = false) => act(async () => root.render(createElement(MemoryRouter, null, createElement(component, { investments, loading }))));
const click = async label => act(async () => {
  const node = [...container.querySelectorAll('button')].find(node => node.textContent.trim() === label);
  assert.ok(node, `Missing filter ${label}`);
  node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});

test('actual fulfillment states are displayed and direct donations do not become reward cards', async () => {
  await render(['pending', 'processing', 'shipped', 'delivered', 'cancelled', null].map(status => investment(status)).concat(direct));
  assert.equal(container.querySelectorAll('h3').length, 6);
  for (const text of ['En Espera de Producción', 'En Preparación / Empaque', 'En Camino / Despachada', 'Entregada con Éxito', 'Recompensa Cancelada', 'Sin seguimiento disponible']) assert.ok(container.textContent.includes(text), text);
});

test('shipment, delivery and cancellation filters show tracking without fictional future phases', async () => {
  await render(['pending', 'shipped', 'delivered', 'cancelled'].map(status => investment(status)));
  await click('En Camino');
  assert.equal(container.querySelector('h3').textContent, 'Recompensa shipped');
  assert.match(container.textContent, /TRACK-123|Enviado el/);
  assert.equal(container.querySelector('a[href="https://carrier.example/track/123"]').textContent.trim(), 'Rastrear paquete');
  await click('Entregadas');
  assert.equal(container.querySelector('h3').textContent, 'Recompensa delivered');
  assert.match(container.textContent, /Entregado el/);
  await click('Canceladas');
  assert.equal(container.querySelector('h3').textContent, 'Recompensa cancelled');
  const card = container.querySelector('h3').parentElement.parentElement;
  assert.match(card.textContent, /entrega de esta recompensa está cancelada/);
  assert.doesNotMatch(card.textContent, /Producción y Empaque|Despacho \/ Envío|En Espera de Producción/);
});

test('missing or unknown claim status is not presented as pending and absent dates stay absent', async () => {
  await render([investment(null), investment('future_state')]);
  assert.equal(container.querySelectorAll('h3').length, 2);
  assert.doesNotMatch(container.textContent, /En Espera de Producción|Enviado el|Entregado el/);
  await click('En Espera');
  assert.match(container.textContent, /No hay recompensas que coincidan/);
  await click('Sin seguimiento');
  assert.equal(container.querySelectorAll('h3').length, 2);
});

test('claim identifiers determine reward presence and tracking links only allow HTTP or HTTPS', () => {
  assert.equal(hasInvestmentReward(direct), false);
  assert.equal(hasInvestmentReward({ ...investment('pending'), rewardTitle: 'Aporte Directo' }), true);
  assert.equal(hasInvestmentReward({ ...investment('delivered'), rewardTierId: null, rewardTitle: null }), true);
  assert.equal(rewardTrackingStatus(null), 'unknown');
  assert.equal(rewardTrackingStatus('future_state'), 'unknown');
  assert.equal(rewardTrackingUrl('javascript:alert(1)'), null);
  assert.equal(rewardTrackingUrl('/api/v1/private-files/documents/id.pdf'), null);
  assert.equal(rewardTrackingUrl('https://carrier.example/track/123'), 'https://carrier.example/track/123');
  assert.equal(rewardTrackingDate(null), null);
  assert.equal(rewardTrackingDate('invalid date'), null);
});

test('the contributions history labels cancelled rewards correctly and preserves direct contributions', async () => {
  await render([{ ...investment('cancelled'), investmentStatus: 'refunded' }, direct], DonorContributionsFeed);
  assert.match(container.textContent, /Cancelada/);
  assert.doesNotMatch(container.textContent, /En preparación/);
  assert.match(container.textContent, /Proyecto de recompensas/);
  assert.ok(container.textContent.includes('100'));
});

test('a claim remains visible even when the reward title no longer exists', async () => {
  await render([{ ...investment('delivered'), rewardTierId: null, rewardTitle: null }]);
  assert.match(container.textContent, /Recompensa asociada al aporte/);
  assert.match(container.textContent, /Entregada con Éxito/);
});

test('loading and a direct-only history do not invent pending rewards', async () => {
  await render([investment('shipped')], DonorRewardsTracker, true);
  assert.match(container.textContent, /Cargando tus recompensas/);
  assert.doesNotMatch(container.textContent, /Recompensa shipped/);
  await render([direct]);
  assert.match(container.textContent, /No tienes recompensas reclamadas/);
  assert.doesNotMatch(container.textContent, /En Espera de Producción/);
});
