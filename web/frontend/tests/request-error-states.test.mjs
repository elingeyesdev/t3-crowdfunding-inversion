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
globalThis.localStorage = { getItem: () => 'test-token' };
const { createRoot } = await import('react-dom/client');
const virtual = name => new URL('./__request_error_'+name+'.mjs', import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('/Navbar')) return { url: virtual('navbar'), shortCircuit: true };
    if (specifier.endsWith('/AdminLayout')) return { url: virtual('layout'), shortCircuit: true };
    if (['/notifications.api', '/admin.api', '/apiError'].some(path => specifier.endsWith(path))) return nextResolve(specifier+'.ts', context);
    if (specifier.endsWith('/RequestErrorNotice')) return nextResolve(specifier+'.tsx', context);
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === virtual('navbar')) return { format: 'module', shortCircuit: true, source: 'export function Navbar() { return null; }' };
    if (url === virtual('layout')) return { format: 'module', shortCircuit: true, source: 'export function AdminLayout({ children }) { return children; }' };
    if (!['/NotificationsPage.tsx', '/AdminUsersPage.tsx', '/RequestErrorNotice.tsx'].some(path => url.endsWith(path))) return nextLoad(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
    }).outputText };
  },
});

const defaults = { inAppEnabled: true, emailEnabled: true, campaignStatusUpdates: true, investmentAlerts: true, commentAlerts: false, milestoneUpdates: true, categories: { custom_event: false } };
const notice = { id: 'notice', title: 'Aviso confirmado', body: 'Detalle', isRead: false, category: 'investment', typeCode: 'investment_confirmed', createdAt: '2026-11-22T12:00:00Z', actionUrl: null };
let failure, empty, preferencesFailure, saveFailure, saved, submitted, calls, root, container, holdPreferences, finishPreferences, suspendFailure;
const originalAdapter = axios.defaults.adapter;
function fail(config, status) {
  throw new axios.AxiosError('Request failed', status ? 'ERR_BAD_RESPONSE' : 'ERR_NETWORK', config, null,
    status ? { status, config, headers: {}, data: { message: status === 422 ? 'La preferencia no es válida.' : 'INTERNAL SERVER DETAILS' } } : undefined);
}
axios.defaults.adapter = async config => {
  assert.equal(config.headers.Authorization, 'Bearer test-token');
  calls.push({ url: config.url, method: config.method, params: { ...config.params } });
  let data;
  if (config.method === 'delete' && config.url.startsWith('/admin/users/')) {
    if (suspendFailure !== null) fail(config, suspendFailure);
    data = null;
  } else if (config.url.endsWith('/preferences')) {
    if (config.method === 'put') {
      submitted = JSON.parse(config.data);
      if (saveFailure !== null) fail(config, saveFailure);
      saved = structuredClone(submitted);
      data = saved;
    } else {
      if (preferencesFailure !== null) fail(config, preferencesFailure);
      data = structuredClone(saved);
      if (holdPreferences) { holdPreferences = false; await new Promise(resolve => { finishPreferences = resolve; }); }
    }
  } else {
    if (failure !== null) fail(config, failure);
    data = config.url === '/admin/users'
      ? (empty ? [] : [{ id: 'user', email: 'kept@example.test', is_active: true, created_at: '2026-11-22T12:00:00Z' }])
      : { notifications: empty ? [] : [notice], unreadCount: empty ? 0 : 1, total: empty ? 0 : 1, totalPages: 1, perPage: 12 };
  }
  return { data: { data: structuredClone(data) }, config, headers: {}, status: 200, statusText: 'OK' };
};
const { NotificationsPage } = await import('../src/pages/NotificationsPage.tsx');
const { AdminUsersPage } = await import('../src/pages/admin/AdminUsersPage.tsx');
const originalError = console.error, originalWarn = console.warn;
beforeEach(() => {
  failure = null; preferencesFailure = null; saveFailure = null; suspendFailure = null; empty = false; saved = structuredClone(defaults); submitted = null; calls = []; holdPreferences = false; finishPreferences = null;
  console.error = () => {}; console.warn = () => {};
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); console.error = originalError; console.warn = originalWarn; });
after(() => { axios.defaults.adapter = originalAdapter; dom.window.close(); });
const mount = async Component => act(async () => root.render(createElement(MemoryRouter, null, createElement(Component))));
const button = text => [...container.querySelectorAll('button')].find(node => node.textContent.trim() === text);
const click = async node => { assert.ok(node); await act(async () => node.dispatchEvent(new MouseEvent('click', { bubbles: true }))); };
const fill = async (input, value) => act(async () => {
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
const submit = async () => act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
const checkbox = text => [...container.querySelectorAll('label')].find(label => label.textContent.includes(text)).querySelector('input');

for (const [name, Component, content, emptyMessage, refresh] of [
  ['notifications', NotificationsPage, /Aviso confirmado/, /No se encontraron notificaciones/, () => container.querySelector('[title="Actualizar notificaciones"]')],
  ['users', AdminUsersPage, /kept@example.test/, /Sin resultados/, () => button('Actualizar Lista')],
]) {
  test(name+': an initial connection failure is an error with retry, never an empty result', async () => {
    failure = 0; await mount(Component);
    assert.match(container.querySelector('[role="alert"]').textContent, /conectar|conexión/);
    assert.doesNotMatch(container.textContent, emptyMessage);
    failure = null; await click(button('Reintentar'));
    assert.match(container.textContent, content);
    assert.equal(container.querySelector('[role="alert"]'), null);
  });

  test(name+': refresh failure labels stale data and retry preserves the active filter', async () => {
    await mount(Component);
    if (name === 'notifications') {
      await act(async () => { const select = container.querySelector('select'); select.value = 'investment'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    } else await fill(container.querySelector('input'), 'kept');
    failure = 500; await click(refresh());
    assert.match(container.querySelector('[role="alert"]').textContent, /anteriores|desactualizad|actualizad/);
    assert.match(container.textContent, content);
    assert.doesNotMatch(container.textContent, /INTERNAL SERVER DETAILS/);
    failure = null; await click(button('Reintentar'));
    assert.equal(container.querySelector('[role="alert"]'), null);
    if (name === 'notifications') assert.equal(calls.at(-1).params.category, 'investment');
    else assert.equal(container.querySelector('input').value, 'kept');
  });

  test(name+': expired sessions offer sign-in and permission failures explain denied access', async () => {
    failure = 401; await mount(Component);
    assert.match(container.querySelector('[role="alert"]').textContent, /sesión/);
    assert.equal(container.querySelector('a[href="/login"]').textContent, 'Iniciar sesión');
    assert.doesNotMatch(container.textContent, emptyMessage);
    failure = 403; await click(refresh());
    assert.match(container.querySelector('[role="alert"]').textContent, /permisos/);
  });

  test(name+': a successful empty response has its empty state without an error', async () => {
    empty = true; await mount(Component);
    assert.equal(container.querySelector('[role="alert"]'), null);
    assert.match(container.textContent, emptyMessage);
  });
}

test('preferences cannot be saved before a failed load is retried successfully', async () => {
  await mount(NotificationsPage); preferencesFailure = 0; await click(button('Preferencias'));
  assert.match(container.querySelector('[role="alert"]').textContent, /conexión|conectar/);
  assert.equal(button('Guardar Cambios').disabled, true);
  await submit(); assert.equal(submitted, null);
  preferencesFailure = null; await click(button('Reintentar'));
  assert.equal(checkbox('Mensajes y Comentarios').checked, false);
  assert.equal(button('Guardar Cambios').disabled, false);
});

test('failed preference saves retain edited values and unrelated settings until a successful retry', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  await mount(NotificationsPage); await click(button('Preferencias'));
  await click(checkbox('Inversiones y Aportes'));
  saveFailure = 422; await submit();
  assert.match(container.querySelector('[role="alert"]').textContent, /La preferencia no es válida/);
  assert.equal(checkbox('Inversiones y Aportes').checked, false);
  assert.deepEqual(submitted.categories, { custom_event: false });
  assert.doesNotMatch(container.textContent, /Preferencias guardadas correctamente/);
  await act(async () => t.mock.timers.tick(1500));
  assert.ok(container.querySelector('form'));
  saveFailure = null; await submit();
  assert.match(container.textContent, /Preferencias guardadas correctamente/);
  assert.equal(saved.investmentAlerts, false);
});

test('preferences preserve edits on session expiration without automatically leaving the form', async () => {
  await mount(NotificationsPage); await click(button('Preferencias'));
  await click(checkbox('Hitos y avances'));
  saveFailure = 401; await submit();
  assert.match(container.querySelector('[role="alert"]').textContent, /sesión/);
  assert.ok(container.querySelector('a[href="/login"]'));
  assert.equal(checkbox('Hitos y avances').checked, false);
  assert.doesNotMatch(container.textContent, /Preferencias guardadas correctamente/);
});

test('an old preference request cannot overwrite a reopened dialog', async () => {
  await mount(NotificationsPage); holdPreferences = true;
  await click(button('Preferencias'));
  const oldRequest = finishPreferences;
  assert.equal(button('Guardar Cambios').disabled, true);
  await click(button('Cancelar'));
  saved.investmentAlerts = false;
  await click(button('Preferencias'));
  assert.equal(checkbox('Inversiones y Aportes').checked, false);
  await act(async () => oldRequest());
  assert.equal(checkbox('Inversiones y Aportes').checked, false);
});

test('failed user suspension shows an inline error and preserves the confirmed account state', async () => {
  await mount(AdminUsersPage); suspendFailure = 503;
  await click(container.querySelector('button[title="Suspender Cuenta"]'));
  await click(button('Confirmar'));
  assert.match(container.querySelector('[role="alert"]').textContent, /servicio no está disponible/);
  assert.match(container.textContent, /kept@example.test/);
  assert.match(container.textContent, /Activo/);
  assert.equal(container.querySelector('button[title="Suspender Cuenta"]').disabled, false);
});
