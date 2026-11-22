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
const navbarModule = new URL('./__notification_filter_navbar.mjs', import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('/Navbar')) return { url: navbarModule, shortCircuit: true };
    if (specifier.endsWith('/notifications.api')) return nextResolve(specifier + '.ts', context);
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === navbarModule) return { format: 'module', shortCircuit: true, source: 'export function Navbar() { return null; }' };
    if (!url.endsWith('/NotificationsPage.tsx')) return nextLoad(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
    }).outputText };
  },
});

const notice = (id, isRead) => ({ id, title: id, body: 'Notification body', typeCode: 'new_comment',
  isRead, createdAt: '2026-11-22T12:00:00Z', actionUrl: null });
const firstReadPage = Array.from({ length: 12 }, (_, i) => notice('Leída '+(i + 1), true));
const fixtures = {
  all: { notifications: [notice('Pendiente', false), notice('Leída 1', true)], total: 17, totalPages: 2 },
  unread: { notifications: [notice('Pendiente', false)], total: 4, totalPages: 1 },
  read: { notifications: firstReadPage, total: 13, totalPages: 2 },
  lastRead: { notifications: [notice('Leída 13', true)], total: 13, totalPages: 2 },
};
let requests, container, root;
const originalAdapter = axios.defaults.adapter;
axios.defaults.adapter = async config => {
  assert.equal(config.headers.Authorization, 'Bearer user-token');
  const uri = new URL(axios.getUri(config), 'http://localhost');
  requests.push(uri);
  const selection = config.params?.unread;
  const fixture = selection === true ? fixtures.unread : selection === false
    ? (config.params?.page === 2 ? fixtures.lastRead : fixtures.read) : fixtures.all;
  return { data: { data: { ...fixture, unreadCount: 4, page: config.params?.page || 1, perPage: 12 } },
    config, headers: {}, status: 200, statusText: 'OK' };
};
const { NotificationsPage } = await import('../src/pages/NotificationsPage.tsx');
const { getMyNotifications, getNotifications } = await import('../src/api/notifications.api.ts');
beforeEach(() => {
  requests = [];
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
after(() => { axios.defaults.adapter = originalAdapter; dom.window.close(); });
const button = prefix => [...container.querySelectorAll('button')].find(node => node.textContent.trim().startsWith(prefix));
const click = async node => { assert.ok(node); await act(async () => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))); };

test('both API clients preserve explicit false and omit an absent read filter in the actual query string', async () => {
  for (const client of [getMyNotifications, getNotifications]) {
    await client();
    assert.equal(requests.at(-1).searchParams.has('unread'), false);
    await client({ unread: false });
    assert.equal(requests.at(-1).searchParams.get('unread'), 'false');
    await client({ unread: true });
    assert.equal(requests.at(-1).searchParams.get('unread'), 'true');
  }
});

test('read history and unread tabs send distinct filters and changing tabs resets pagination', async () => {
  await act(async () => root.render(createElement(MemoryRouter, null, createElement(NotificationsPage))));
  assert.equal(requests.at(-1).searchParams.has('unread'), false);
  assert.match(container.textContent, /Pendiente/);
  await click(button('Siguiente'));
  assert.equal(requests.at(-1).searchParams.get('page'), '2');

  await click(button('Historial leídas'));
  assert.equal(requests.at(-1).searchParams.get('unread'), 'false');
  assert.equal(requests.at(-1).searchParams.get('page'), '1');
  assert.doesNotMatch(container.textContent, /Pendiente/);
  assert.match(container.textContent, /Leída 12/);
  assert.match(container.textContent, /Página 1 de 2/);
  await click(button('Siguiente'));
  assert.equal(requests.at(-1).searchParams.get('unread'), 'false');
  assert.match(container.textContent, /Leída 13/);
  assert.match(container.textContent, /Página 2 de 2/);
  assert.equal(button('Siguiente').disabled, true);

  await click(button('No leídas'));
  assert.equal(requests.at(-1).searchParams.get('unread'), 'true');
  assert.equal(requests.at(-1).searchParams.get('page'), '1');
  assert.match(container.textContent, /Pendiente/);
  assert.doesNotMatch(container.textContent, /Leída 13/);
  await click(button('Todas'));
  assert.equal(requests.at(-1).searchParams.has('unread'), false);
  assert.match(container.textContent, /Pendiente/);
  assert.match(container.textContent, /Leída 1/);
});
