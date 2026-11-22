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
globalThis.localStorage = { getItem: () => 'user-token' };
const { createRoot } = await import('react-dom/client');
const navbar = new URL('./__deletion_navbar.mjs', import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('/Navbar')) return { url: navbar, shortCircuit: true };
    if (specifier.endsWith('/notifications.api')) return nextResolve(specifier + '.ts', context);
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === navbar) return { format: 'module', shortCircuit: true, source: 'export function Navbar() { return null; }' };
    if (!['/NotificationsPage.tsx', '/NotificationBell.tsx'].some(path => url.endsWith(path))) return nextLoad(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
    }).outputText };
  },
});

const notice = (id, isRead, category = 'campaign') => ({ id, title: id, body: 'Detail', isRead, category,
  typeCode: category === 'investment' ? 'investment_confirmed' : 'campaign_published', createdAt: '2026-11-22T12:00:00Z', actionUrl: null });
let records, requests, rejectDelete, holdDelete, finishDelete, arrival, container, root, logs;
const originalAdapter = axios.defaults.adapter;
const originalError = console.error;
axios.defaults.adapter = async config => {
  assert.equal(config.headers.Authorization, 'Bearer user-token');
  requests.push({ method: config.method, url: config.url, params: { ...config.params } });
  let data;
  if (config.method === 'delete') {
    if (rejectDelete) throw new axios.AxiosError('Unavailable', 'ERR_NETWORK', config);
    if (holdDelete) { holdDelete = false; await new Promise(resolve => { finishDelete = resolve; }); }
    const before = records.length;
    records = config.url.endsWith('/clear-read') ? records.filter(row => !row.isRead) : records.filter(row => row.id !== config.url.split('/').at(-1));
    data = { deletedCount: before - records.length };
    if (arrival) { records.unshift(arrival); arrival = null; }
  } else {
    const { page = 1, limit = 20, category, unread, q } = config.params || {};
    const matching = records.filter(row => (!category || row.category === category)
      && (unread === undefined || row.isRead === !unread) && (!q || row.title.includes(q)));
    data = { notifications: matching.slice((page - 1) * limit, page * limit), total: matching.length,
      totalPages: Math.max(1, Math.ceil(matching.length / limit)), page, perPage: limit,
      unreadCount: records.filter(row => !row.isRead).length };
  }
  return { data: { data: structuredClone(data) }, config, headers: {}, status: 200, statusText: 'OK' };
};
const { NotificationsPage } = await import('../src/pages/NotificationsPage.tsx');
const { NotificationBell } = await import('../src/components/NotificationBell.tsx');
beforeEach(() => {
  records = []; requests = []; rejectDelete = false; holdDelete = false; finishDelete = null; arrival = null; logs = [];
  console.error = (...args) => logs.push(args);
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); console.error = originalError; });
after(() => { axios.defaults.adapter = originalAdapter; dom.window.close(); });
function seed(read, unread) {
  records = [...Array.from({ length: read }, (_, i) => notice('Read '+i, true)),
    ...Array.from({ length: unread }, (_, i) => notice('Pending '+i, false))];
}
const page = () => container.querySelector('#page');
const button = text => [...page().querySelectorAll('button')].find(node => node.textContent.trim().startsWith(text));
const click = async node => { assert.ok(node); await act(async () => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))); };
const remove = () => page().querySelector('button[title="Eliminar notificación"]');
const selectCategory = async value => act(async () => {
  const select = page().querySelector('select'); select.value = value; select.dispatchEvent(new Event('change', { bubbles: true }));
});
async function mount(withBell = false) {
  await act(async () => root.render(createElement(MemoryRouter, null,
    withBell ? createElement('div', { id: 'bell' }, createElement(NotificationBell)) : null,
    createElement('div', { id: 'page' }, createElement(NotificationsPage)))));
}

test('clearing read notices reloads global counts, including an arrival during deletion', async () => {
  seed(30, 20); await mount();
  assert.equal(button('Todas').textContent.trim(), 'Todas (50)');
  arrival = notice('New arrival', false);
  await click(button('Limpiar leídas'));
  assert.equal(button('Todas').textContent.trim(), 'Todas (21)');
  assert.match(button('No leídas').textContent, /21/);
  assert.match(page().textContent, /New arrival/);
  assert.match(page().textContent, /Página 1 de 2/);
  assert.equal(records.length, 21);
  assert.ok(records.every(row => !row.isRead));
});

test('deleting the last item on the last page fetches the last valid page and fills its rows', async () => {
  seed(0, 13); await mount(); await click(button('Siguiente'));
  assert.match(page().textContent, /Página 2 de 2/);
  await click(remove());
  assert.equal(button('Todas').textContent.trim(), 'Todas (12)');
  assert.equal(page().querySelectorAll('button[title="Eliminar notificación"]').length, 12);
  assert.match(page().textContent, /Pending 0/);
  assert.doesNotMatch(page().textContent, /Pending 12|Página 2 de/);
  assert.deepEqual(requests.filter(row => row.method === 'get').slice(-2).map(row => row.params.page), [2, 1]);
});

test('cleanup from a later page returns to a valid page even when all filtered rows disappear', async () => {
  seed(25, 2); await mount(); await click(button('Siguiente')); await click(button('Siguiente'));
  assert.match(page().textContent, /Página 3 de 3/);
  await click(button('Limpiar leídas'));
  assert.equal(button('Todas').textContent.trim(), 'Todas (2)');
  assert.equal(page().querySelectorAll('button[title="Eliminar notificación"]').length, 2);
  assert.equal(requests.at(-1).params.page, 1);
  assert.equal(button('Siguiente'), undefined);
  assert.ok(records.every(row => !row.isRead));
});

test('deletion preserves category, search and read filters and uses the filtered empty total', async () => {
  records = [notice('Selected investment', true, 'investment'), notice('Other investment', true, 'investment'), notice('Other unread', false)];
  await mount(); await selectCategory('investment'); await click(button('Historial leídas'));
  await act(async () => {
    const search = page().querySelector('input');
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(search, 'Selected');
    search.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await click(remove());
  assert.match(page().textContent, /No se encontraron notificaciones/);
  assert.equal(button('Todas').textContent.trim(), 'Todas (0)');
  assert.match(button('No leídas').textContent, /1/);
  assert.equal(page().querySelector('select').value, 'investment');
  assert.deepEqual(requests.at(-1).params, { page: 1, limit: 12, unread: false, category: 'investment', q: 'Selected' });
});

test('finishing a deletion refreshes the current filters and prevents duplicate requests while pending', async () => {
  records = [notice('Old campaign', true), notice('Current investment', false, 'investment')];
  await mount(); holdDelete = true;
  await click(remove());
  assert.equal(remove().disabled, true);
  await click(remove());
  assert.equal(requests.filter(row => row.method === 'delete').length, 1);
  await selectCategory('investment');
  await act(async () => finishDelete());
  assert.equal(requests.at(-1).params.category, 'investment');
  assert.match(page().textContent, /Current investment/);
  assert.doesNotMatch(page().textContent, /Old campaign/);
  assert.equal(button('Todas').textContent.trim(), 'Todas (1)');
});

test('failed deletion and cleanup preserve the confirmed list and counters', async () => {
  seed(1, 2); await mount(); rejectDelete = true;
  await click(remove()); await click(button('Limpiar leídas'));
  assert.equal(records.length, 3);
  assert.equal(button('Todas').textContent.trim(), 'Todas (3)');
  assert.match(button('No leídas').textContent, /2/);
  assert.equal(page().querySelectorAll('button[title="Eliminar notificación"]').length, 3);
  assert.equal(remove().disabled, false);
  assert.equal(logs.length, 2);
  assert.equal(requests.filter(row => row.method === 'get').length, 1, 'Failed mutations must not emit a success refresh.');
});

test('deleting from either mounted view synchronizes the bell and the full list without polling', async () => {
  seed(1, 2); await mount(true);
  await click(container.querySelector('#notification-bell-btn'));
  await click(remove());
  const bell = container.querySelector('#bell');
  assert.doesNotMatch(bell.textContent, /Read 0/);
  assert.equal(bell.querySelectorAll('button[title="Eliminar notificación"]').length, 2);
  await click(bell.querySelector('button[title="Eliminar notificación"]'));
  assert.equal(button('Todas').textContent.trim(), 'Todas (1)');
  assert.match(button('No leídas').textContent, /1/);
  assert.equal(page().querySelectorAll('button[title="Eliminar notificación"]').length, 1);
});
