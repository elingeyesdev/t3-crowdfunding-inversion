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
const navbarModule = new URL('./__notification_preferences_navbar.mjs', import.meta.url).href;
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
let saved, submitted;
const defaults = { inAppEnabled: true, emailEnabled: true, investmentAlerts: true, commentAlerts: true, campaignStatusUpdates: true, milestoneUpdates: true };
const originalAdapter = axios.defaults.adapter;
axios.defaults.adapter = async config => {
  assert.equal(config.headers.Authorization, 'Bearer user-token');
  let data;
  if (config.url.endsWith('/preferences')) {
    if (config.method === 'put') {
      submitted = JSON.parse(config.data);
      saved = { ...saved, ...submitted };
    }
    data = saved;
  } else data = { notifications: [], unreadCount: 0, total: 0, totalPages: 1 };
  return { data: { data }, config, headers: {}, status: 200, statusText: 'OK' };
};
const { NotificationsPage } = await import('../src/pages/NotificationsPage.tsx');
let root, container;
beforeEach(() => {
  saved = { ...defaults };
  submitted = undefined;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});
after(() => { axios.defaults.adapter = originalAdapter; dom.window.close(); });
const button = text => [...container.querySelectorAll('button')].find(node => node.textContent.trim() === text);
const checkbox = text => [...container.querySelectorAll('label')].find(node => node.textContent.includes(text))?.querySelector('input');
const click = async node => { assert.ok(node); await act(async () => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))); };
async function open() {
  await act(async () => root.render(createElement(MemoryRouter, null, createElement(NotificationsPage))));
  await click(button('Preferencias'));
}

test('the preferences dialog displays the saved milestone switch alongside the other categories', async () => {
  saved = { ...defaults, milestoneUpdates: false, commentAlerts: false };
  await open();
  assert.equal(checkbox('Hitos y avances').checked, false);
  assert.equal(checkbox('Mensajes y Comentarios').checked, false);
  assert.equal(checkbox('Inversiones y Aportes').checked, true);
  assert.equal(checkbox('Estados de Campañas').checked, true);
});

test('changing milestone preferences sends the canonical field and preserves unrelated and per-event settings', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  saved = { ...defaults, commentAlerts: false, categories: { investment_received: false } };
  await open();
  await click(checkbox('Hitos y avances'));
  await act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  assert.equal(submitted.milestoneUpdates, false);
  assert.equal(submitted.commentAlerts, false);
  assert.equal(submitted.investmentAlerts, true);
  assert.deepEqual(submitted.categories, { investment_received: false });
  assert.match(container.textContent, /Preferencias guardadas correctamente/);
  await act(async () => t.mock.timers.tick(1200));
  await click(button('Preferencias'));
  assert.equal(checkbox('Hitos y avances').checked, false);
});

test('the general switch can change without resetting disabled categories', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  saved = { ...defaults, investmentAlerts: false, milestoneUpdates: false };
  await open();
  await click(checkbox('Notificaciones en la aplicación'));
  await act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  assert.equal(submitted.inAppEnabled, false);
  assert.equal(submitted.investmentAlerts, false);
  assert.equal(submitted.milestoneUpdates, false);
  assert.equal(submitted.campaignStatusUpdates, true);
  await act(async () => t.mock.timers.tick(1200));
});
