import test, { beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';
import { campaignTypeLabel, isSupportedCampaignType } from '../src/utils/campaignType.ts';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'MouseEvent', 'Event', 'File', 'FileReader']) {
  Object.defineProperty(globalThis, name, { value: dom.window[name], configurable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.localStorage = { getItem: () => 'test-token' };
const { createRoot } = await import('react-dom/client');
const shells = ['Navbar', 'InvestorDashboardOverview', 'InvestorDashboardAnalytics', 'AddCapitalModal', 'DonorRewardsTracker', 'DonorBackedUpdatesFeed', 'DonorReceiptsList'];
const virtual = name => new URL('./__type_'+name+'.mjs', import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    const shell = shells.find(name => specifier.endsWith('/'+name));
    if (shell) return { url: virtual(shell), shortCircuit: true };
    if (specifier.endsWith('/useInvestorDashboard')) return { url: virtual('dashboard'), shortCircuit: true };
    if (specifier.startsWith('.') && context.parentURL?.includes('/frontend/src/')) {
      for (const ext of ['.ts', '.tsx']) {
        const url = new URL(specifier+ext, context.parentURL);
        if (existsSync(url)) return { url: url.href, shortCircuit: true };
      }
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    const shell = shells.find(name => url === virtual(name));
    if (shell) return { format: 'module', shortCircuit: true, source: `export function ${shell}() { return null; }` };
    if (url === virtual('dashboard')) return { format: 'module', shortCircuit: true, source: 'const data = {}; export function useInvestorDashboard() { return { data, loading: false, error: null, refetch() {} }; }' };
    if (!url.endsWith('.tsx') || !url.includes('/frontend/src/')) return nextLoad(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
    }).outputText };
  },
});
let root, container, submitted, rawType;
const investment = type => ({ id: type, campaignId: type, campaignTitle: 'Proyecto '+type, campaignType: type, amount: 10, currency: 'BOB', investmentStatus: 'completed', createdAt: '2026-11-25T12:00:00Z', campaignGoal: 1000, campaignStatus: 'published', rewardTierId: null, rewardClaimId: null, rewardTitle: null });
const history = ['donation', 'reward', 'equity', 'legacy_custom'].map(investment);
const originalAdapter = axios.defaults.adapter;
axios.defaults.adapter = async config => {
  let data;
  if (config.url === '/categories') data = [{ id: 'category', name: 'Category', displayName: 'Category' }];
  else if (/^\/entrepreneurs\/me\/campaigns\/[^/]+\/documents$/.test(config.url)) data = [];
  else if (config.url === '/investments/me') data = structuredClone(history);
  else if (config.url === '/admin/campaigns/pending') data = { data: [{ id: 'campaign', campaign_type: rawType, goal_amount: 100, title: 'Original type' }], meta: { totalItems: 1 } };
  else if (config.url.startsWith('/admin/campaigns/')) data = { id: 'campaign', campaign_type: rawType, title: 'Original type' };
  else throw new Error('Unexpected request: '+config.url);
  return { config, headers: {}, status: 200, statusText: 'OK', data: { data } };
};
const { ContributionConfirmModal } = await import('../src/components/campaign-detail/ContributionConfirmModal.tsx');
const { CampaignForm } = await import('../src/components/CampaignForm.tsx');
const { InvestmentsFeed } = await import('../src/components/investor-profile/InvestmentsFeed.tsx');
const { InvestorDashboardPage } = await import('../src/pages/InvestorDashboardPage.tsx');
const { getPendingCampaigns, getCampaignDetail } = await import('../src/api/admin.api.ts');
beforeEach(() => {
  submitted = null; rawType = 'equity';
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
after(() => { axios.defaults.adapter = originalAdapter; dom.window.close(); });
const mount = async (Component, props = {}) => act(async () => root.render(createElement(MemoryRouter, null, createElement(Component, props))));
const click = async button => { assert.ok(button); await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true }))); };
const button = text => [...container.querySelectorAll('button')].find(node => node.textContent.trim() === text);
const fill = async (selector, value) => act(async () => {
  const input = container.querySelector(selector);
  const prototype = input.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
const initial = type => ({ id: 'campaign', campaignType: type, title: 'Campaña válida', description: 'Descripción suficientemente completa para guardar esta campaña de prueba sin cambios en su modalidad.', shortDescription: 'Eslogan de prueba válido', goalAmount: 1000, categoryIds: ['category'], endDate: '2099-12-31T16:00:00Z', rewardTiers: [] });

test('labels distinguish supported, historical, unknown and missing types', () => {
  assert.equal(campaignTypeLabel('donation'), 'Donación');
  assert.equal(campaignTypeLabel('reward'), 'Con recompensas');
  assert.match(campaignTypeLabel('equity'), /Equity.*no disponible/);
  assert.match(campaignTypeLabel('legacy_custom'), /legacy_custom/);
  assert.match(campaignTypeLabel(undefined), /no informado/);
  for (const value of ['equity', 'legacy_custom', null, 'DONATION']) assert.equal(isSupportedCampaignType(value), false);
});

for (const type of ['donation', 'reward', 'equity', 'legacy_custom']) {
  test(`confirmation identifies ${type} and permits only supported contributions`, async () => {
    let confirms = 0;
    await mount(ContributionConfirmModal, { campaign: { title: 'Original campaign', campaignType: type, campaignTypeLabel: type }, amount: 10, selectedTier: null, loading: false, onCancel() {}, onConfirm() { confirms++; } });
    assert.match(container.textContent, new RegExp(campaignTypeLabel(type).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    const confirm = [...container.querySelectorAll('button')].find(node => node.textContent.includes('Confirmar Aporte'));
    assert.equal(confirm.disabled, !isSupportedCampaignType(type));
    await click(confirm);
    assert.equal(confirms, isSupportedCampaignType(type) ? 1 : 0);
  });
}

for (const type of ['donation', 'reward']) {
  test(`editing and saving a ${type} form retains the chosen type in the DTO`, async () => {
    await mount(CampaignForm, { initialData: initial(type), saving: false, saveError: null, onCancel() {}, async onSuccess(dto) { submitted = dto; return false; } });
    const select = container.querySelector('#campaign-type');
    assert.equal(select.value, type);
    assert.deepEqual([...select.options].map(option => option.value), ['donation', 'reward']);
    await act(async () => {
      const input = container.querySelector('input[type="file"]:not(#cover-upload)');
      Object.defineProperty(input, 'files', { configurable: true, value: [new File(['fixture'], 'support.txt', { type: 'text/plain' })] });
      input.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await fill('input[placeholder="Ej. Cotización oficial del proveedor"]', 'Documento de respaldo');
    await click(button('Añadir Documento'));
    await act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
    await click(button('Sí, guardar'));
    assert.equal(submitted.campaignType, type);
  });
}

test('unsupported historical forms expose the original type without an editable form', async () => {
  await mount(CampaignForm, { initialData: initial('equity'), saving: false, saveError: null, onCancel() {}, async onSuccess(dto) { submitted = dto; return true; } });
  assert.match(container.querySelector('[role="alert"]').textContent, /Equity/);
  assert.equal(container.querySelector('form'), null);
  assert.equal(submitted, null);
});

for (const Component of [InvestmentsFeed, InvestorDashboardPage]) {
  test(`${Component.name} displays original reward, equity and unknown history without relabeling`, async () => {
    await mount(Component, { capitalData: null, capitalLoading: false });
    assert.match(container.textContent, /Con recompensas/);
    assert.match(container.textContent, /Equity.*no disponible/);
    assert.match(container.textContent, /Tipo no soportado: legacy_custom/);
    assert.equal(history[2].campaignType, 'equity');
  });
}

test('administrative adapters preserve the API type for pending lists and detail', async () => {
  for (const type of ['reward', 'equity', 'legacy_custom']) {
    rawType = type;
    assert.equal((await getPendingCampaigns({})).campaigns[0].campaign_type, type);
    assert.equal((await getCampaignDetail('campaign')).campaign_type, type);
  }
});
