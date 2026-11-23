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
const navbarModule = new URL('./__notification_read_navbar.mjs', import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('/RequestErrorNotice')) return nextResolve(specifier + '.tsx', context);
    if (specifier.endsWith('/apiError')) return nextResolve(specifier + '.ts', context);
    if (specifier.endsWith('/Navbar')) return { url: navbarModule, shortCircuit: true };
    if (specifier.endsWith('/notifications.api')) return nextResolve(specifier + '.ts', context);
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === navbarModule) return { format: 'module', shortCircuit: true, source: 'export function Navbar() { return null; }' };
    if (!['/NotificationsPage.tsx', '/NotificationBell.tsx', '/RequestErrorNotice.tsx'].some(path => url.endsWith(path))) return nextLoad(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
    }).outputText };
  },
});
let notifications, requests, rejectRead, newArrival;
const originalAdapter = axios.defaults.adapter;
axios.defaults.adapter = async config => {
  assert.equal(config.headers.Authorization, 'Bearer user-token');
  let data;
  if (config.method === 'patch') {
    const selection = JSON.parse(config.data);
    requests.push(selection);
    if (rejectRead) throw new axios.AxiosError('Unavailable', 'ERR_NETWORK', config);
    let updatedCount = 0;
    notifications = notifications.map(notification => {
      if (!notification.isRead && (!selection.typeCode || notification.typeCode === selection.typeCode)) {
        updatedCount++;
        return { ...notification, isRead: true };
      }
      return notification;
    });
    if (newArrival) {
      notifications.push({ ...notifications[0], id: 'new', typeCode: 'investment_received', isRead: false });
      newArrival = false;
    }
    data = { updatedCount, unreadCount: notifications.filter(item => !item.isRead).length };
  } else data = { notifications: structuredClone(notifications), unreadCount: notifications.filter(item => !item.isRead).length, total: notifications.length, totalPages: 1 };
  return { data: { data }, config, headers: {}, status: 200, statusText: 'OK' };
};
const { NotificationBell } = await import('../src/components/NotificationBell.tsx');
const { NotificationsPage } = await import('../src/pages/NotificationsPage.tsx');
const { markAllNotificationsAsRead, subscribeToNotificationsRead } = await import('../src/api/notifications.api.ts');
let root, container;
beforeEach(() => {
  notifications = ['new_comment', 'new_comment', 'investment_confirmed'].map((typeCode, index) => ({ id: String(index), typeCode, title: 'Aviso '+index, body: 'Detalle', isRead: false, createdAt: '2026-11-19T12:00:00Z', actionUrl: null }));
  requests = [];
  rejectRead = false;
  newArrival = false;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
after(() => { axios.defaults.adapter = originalAdapter; dom.window.close(); });
const click = async node => { assert.ok(node); await act(async () => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))); };
const bell = () => container.querySelector('#bell');
const page = () => container.querySelector('#page');
async function mount(t) {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  await act(async () => root.render(createElement(MemoryRouter, null,
    createElement('div', { id: 'bell' }, createElement(NotificationBell)),
    createElement('div', { id: 'page' }, createElement(NotificationsPage)))));
  await click(container.querySelector('#notification-bell-btn'));
}

test('filtered read keeps the real count in both mounted views and leaves unrelated notices unread', async t => {
  await mount(t);
  let result;
  await act(async () => { result = await markAllNotificationsAsRead('new_comment'); });
  assert.deepEqual(result, { updatedCount: 2, unreadCount: 1 });
  assert.deepEqual(requests, [{ typeCode: 'new_comment' }]);
  assert.match(bell().textContent, /No leídas \(1\)/);
  assert.equal(container.querySelector('#notification-bell-btn').textContent.trim(), '1');
  assert.match(page().textContent, /No leídas1/);
  // Each panel's unread-only filter must retain the remaining investment.
  await click([...bell().querySelectorAll('button')].find(node => node.textContent.includes('No leídas')));
  assert.match(bell().textContent, /Aviso 2/);
  assert.doesNotMatch(bell().textContent, /Aviso 0|Aviso 1/);
  await act(async () => { await markAllNotificationsAsRead('new_comment'); });
  assert.match(bell().textContent, /No leídas \(1\)/);
});

test('mark-all from either view immediately updates the other without waiting for polling', async t => {
  await mount(t);
  await click([...page().querySelectorAll('button')].find(node => node.textContent.trim() === 'Marcar todas leídas'));
  assert.deepEqual(requests, [{}]);
  assert.equal(container.querySelector('#notification-bell-btn').textContent.trim(), '');
  assert.match(bell().textContent, /No leídas \(0\)/);
  assert.match(bell().textContent, /Al día/);
  assert.doesNotMatch(page().textContent, /Marcar todas leídas/);
});

test('both panels use a nonzero server count even when a new notice arrives during mark-all', async t => {
  await mount(t);
  newArrival = true;
  await click([...bell().querySelectorAll('button')].find(node => node.textContent.includes('Marcar todas')));
  assert.equal(container.querySelector('#notification-bell-btn').textContent.trim(), '1');
  assert.match(page().textContent, /No leídas1/);
});

test('failed operations emit no success event and preserve both counters', async t => {
  await mount(t);
  rejectRead = true;
  let events = 0;
  const unsubscribe = subscribeToNotificationsRead(() => events++);
  try {
    await act(async () => { await assert.rejects(markAllNotificationsAsRead('new_comment')); });
    assert.equal(events, 0);
    assert.equal(container.querySelector('#notification-bell-btn').textContent.trim(), '3');
    assert.match(page().textContent, /No leídas3/);
  } finally { unsubscribe(); }
});
