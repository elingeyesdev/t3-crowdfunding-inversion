import test, { beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import axios from 'axios';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'MouseEvent']) {
  Object.defineProperty(globalThis, name, { value: dom.window[name], configurable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');

// Keep real React hooks and DOM updates. Capture the data passed to Recharts
// without depending on browser layout/ResizeObserver in this DOM test.
const chartModule = new URL('./__audit_chart_stub.mjs', import.meta.url).href;
const chartSource = `
  import { createElement } from 'react';
  const chart = name => ({ children, data }) => createElement(name === 'AreaChart' || name === 'PieChart' ? 'svg' : name === 'Pie' ? 'g' : 'div', { 'data-chart': name, 'data-series': data ? JSON.stringify(data) : undefined }, children);
  export const ResponsiveContainer = chart('ResponsiveContainer');
  export const AreaChart = chart('AreaChart');
  export const PieChart = chart('PieChart');
  export const Pie = chart('Pie');
  export const Area = () => null, XAxis = () => null, YAxis = () => null,
    CartesianGrid = () => null, Tooltip = () => null, Cell = () => null;
`;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'recharts') return { url: chartModule, shortCircuit: true };
    const local = ['/campaignFunding', '/public-campaigns.api'].some(path => specifier.endsWith(path));
    return nextResolve(local ? specifier + '.ts' : specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === chartModule) return { format: 'module', source: chartSource, shortCircuit: true };
    if (!url.endsWith('/PublicFinancialAuditing.tsx')) return nextLoad(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
    }).outputText };
  },
});

const requests = [];
const originalAdapter = axios.defaults.adapter;
axios.defaults.adapter = config => new Promise((resolve, reject) => {
  requests.push({ config, reject, resolve: value => resolve({ data: { data: value }, config, headers: {}, status: 200, statusText: 'OK' }) });
});
const { PublicFinancialAuditing } = await import('../src/components/campaign-detail/transparency/PublicFinancialAuditing.tsx');
const { usePublicCampaignFinance } = await import('../src/hooks/usePublicCampaignFinance.ts');
axios.defaults.adapter = originalAdapter;

const finance = {
  campaignId: 'first', title: 'First campaign', currentAmount: 1000, goalAmount: 2000,
  fundingPercentage: 50, investorCount: 2, averageInvestment: 500, largestInvestment: 600, currency: 'BOB',
  recentInvestments: [
    { id: 'direct', amount: 400, investorDisplayName: 'Direct donor', createdAt: '2026-11-18T18:00:00Z' },
    { id: 'reward', amount: 600, investorDisplayName: 'Reward donor', rewardTitle: 'Gold reward', createdAt: '2026-11-19T18:00:00Z' },
  ],
  dailyProgress: [{ date: '2026-11-18T18:00:00Z', accumulatedAmount: 400 }, { date: '2026-11-19T18:00:00Z', accumulatedAmount: 1000 }],
  fundingBreakdown: [{ rewardTitle: 'Aportes Directos', totalAmount: 400 }, { rewardTitle: 'Gold reward', totalAmount: 600 }],
};
let root;
let container;
let errors;
const originalConsoleError = console.error;
beforeEach(() => {
  errors = [];
  console.error = (...args) => errors.push(args.map(String).join(' '));
  requests.length = 0;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  try {
    await act(async () => root.unmount());
    container.remove();
    assert.deepEqual(errors, [], 'React must not report hook-order or rendering errors');
  } finally {
    console.error = originalConsoleError;
  }
});
after(() => dom.window.close());
const render = async props => act(async () => root.render(createElement(PublicFinancialAuditing, { campaignId: 'first', finance: null, ...props })));
const button = label => [...container.querySelectorAll('button')].find(node => node.textContent.trim() === label);
const click = async label => act(async () => {
  const node = button(label);
  assert.ok(node, `Missing button: ${label}`);
  node.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
const series = chart => JSON.parse(container.querySelector(`[data-chart="${chart}"]`).getAttribute('data-series'));

test('the mounted component survives loading, data, no data and back to data', async () => {
  await render({ loading: true });
  assert.match(container.textContent, /Cargando auditoría/);
  await render({ finance });
  assert.match(container.textContent, /Total Recaudado/);
  await render({ finance: null });
  assert.match(container.textContent, /No hay información financiera/);
  assert.doesNotMatch(container.textContent, /Cargando auditoría/);
  await render({ finance });
  await render({ finance, loading: true });
  assert.doesNotMatch(container.textContent, /Total Recaudado/);
  await render({ finance });
  assert.match(container.textContent, /Direct donor/);
});

test('figures, 5% fee, net amount and chart series keep their existing calculations', async () => {
  await render({ finance });
  for (const amount of ['Bs. 1.000', 'Bs. 50', 'Bs. 950', '50% de la meta']) assert.ok(container.textContent.includes(amount), amount);
  assert.deepEqual(series('AreaChart').map(point => point.accumulated), [400, 1000]);
  assert.deepEqual(series('Pie').map(point => ({ name: point.name, value: point.value })), [{ name: 'Aportes Directos', value: 400 }, { name: 'Gold reward', value: 600 }]);
});

test('filters work and reset on campaign change without mixing donors or data', async () => {
  await render({ finance });
  await click('Directos');
  assert.match(container.querySelector('tbody').textContent, /Direct donor/);
  assert.doesNotMatch(container.querySelector('tbody').textContent, /Reward donor/);
  await click('Recompensas');
  assert.match(container.querySelector('tbody').textContent, /Reward donor/);
  assert.doesNotMatch(container.querySelector('tbody').textContent, /Direct donor/);
  const next = { ...finance, campaignId: 'second', currentAmount: 2000, recentInvestments: finance.recentInvestments.map(item => ({ ...item, investorDisplayName: 'Next '+item.investorDisplayName })) };
  await render({ campaignId: 'second', finance: next });
  assert.match(container.querySelector('tbody').textContent, /Next Direct donor/);
  assert.match(container.querySelector('tbody').textContent, /Next Reward donor/);
  assert.match(container.textContent, /Bs. 2.000/);
});

test('zero amounts and empty series are valid data and do not stay in loading', async () => {
  await render({ finance: { ...finance, currentAmount: 0, investorCount: 0, averageInvestment: 0, largestInvestment: 0, fundingPercentage: 0, recentInvestments: [], dailyProgress: [], fundingBreakdown: [] }, createdAt: '2026-11-18T18:00:00Z' });
  assert.match(container.textContent, /Bs. 0/);
  assert.match(container.textContent, /Total Recaudado/);
  assert.doesNotMatch(container.textContent, /Cargando auditoría/);
  assert.equal(series('AreaChart')[0].accumulated, 0);
});

function Harness({ campaignId }) {
  const { finance, loading, error, retry } = usePublicCampaignFinance(campaignId);
  return createElement(PublicFinancialAuditing, { campaignId, finance, loading, error, onRetry: retry });
}
const renderHarness = async campaignId => act(async () => root.render(createElement(Harness, { campaignId })));
const resolve = async (request, body) => act(async () => request.resolve(body));

test('campaign changes hide old data immediately and ignore late responses', async () => {
  await renderHarness('first');
  const first = requests.at(-1);
  await renderHarness('second');
  const second = requests.at(-1);
  assert.equal(second.config.url, '/campaigns/public/second/financial-progress');
  await resolve(second, { ...finance, currentAmount: 2000 });
  assert.match(container.textContent, /Bs. 2.000/);
  await resolve(first, finance);
  assert.match(container.textContent, /Bs. 2.000/);
  await renderHarness('third');
  assert.match(container.textContent, /Cargando auditoría/);
  assert.doesNotMatch(container.textContent, /Bs. 2.000/);
});

test('request failure exits loading, retry recovers and an empty response remains distinct', async () => {
  await renderHarness('first');
  await act(async () => requests.at(-1).reject(new Error('Network failure')));
  assert.ok(container.querySelector('[role="alert"]'));
  assert.doesNotMatch(container.textContent, /Cargando auditoría|No hay información financiera/);
  await click('Reintentar');
  assert.match(container.textContent, /Cargando auditoría/);
  assert.equal(requests.length, 2);
  await resolve(requests.at(-1), finance);
  assert.match(container.textContent, /Total Recaudado/);
  await renderHarness('empty');
  await resolve(requests.at(-1), null);
  assert.match(container.textContent, /No hay información financiera/);
  assert.doesNotMatch(container.textContent, /Cargando auditoría/);
});
