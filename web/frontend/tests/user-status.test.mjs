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
globalThis.localStorage = { getItem: () => 'admin-token' };
const { createRoot } = await import('react-dom/client');
const layout = new URL('./__user_status_layout.mjs', import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('/AdminLayout')) return { url: layout, shortCircuit: true };
    if (['/admin.api', '/apiError'].some(path => specifier.endsWith(path))) return nextResolve(specifier+'.ts', context);
    if (specifier.endsWith('/RequestErrorNotice')) return nextResolve(specifier+'.tsx', context);
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === layout) return { format: 'module', shortCircuit: true, source: 'export function AdminLayout({children}) { return children; }' };
    if (!['/AdminUsersPage.tsx', '/RequestErrorNotice.tsx'].some(path => url.endsWith(path))) return nextLoad(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
    }).outputText };
  },
});
const originalAdapter = axios.defaults.adapter;
const row = (id, active, allowed = true) => ({ id, email: id+'@example.test', is_active: active, created_at: '2026-11-25T12:00:00Z', status_version: 0, can_suspend: allowed && active, can_reactivate: allowed && !active, can_view_history: allowed });
let root, container, users, failure, historyFailure, changes, hold, finish, historyCalls;
axios.defaults.adapter = async config => {
  assert.equal(config.headers.Authorization, 'Bearer admin-token');
  let data;
  if (config.method === 'patch') {
    const input = JSON.parse(config.data);
    changes.push(input);
    if (hold) { hold = false; await new Promise(resolve => { finish = resolve; }); }
    if (failure !== null) throw new axios.AxiosError('Failed', failure ? 'ERR_BAD_RESPONSE' : 'ERR_NETWORK', config, null,
      failure ? { config, status: failure, headers: {}, data: { message: failure === 409 ? 'La cuenta cambió. Actualiza la lista.' : 'El motivo no es válido.' } } : undefined);
    const id = config.url.split('/').at(-2);
    const current = users.find(user => user.id === id);
    const updated = { ...current, is_active: input.isActive, status_version: current.status_version + 1, can_suspend: !current.is_active, can_reactivate: current.is_active };
    users = users.map(user => user.id === id ? updated : user);
    data = updated;
  } else if (config.url.endsWith('/status-history')) {
    historyCalls.push(config.params?.page);
    if (historyFailure) throw new axios.AxiosError('Offline', 'ERR_NETWORK', config);
    data = { entries: [{ id: 'history-'+config.params.page, actorId: 'admin', actorEmail: 'operator@example.test', fromActive: true, toActive: false, version: config.params.page, reason: '<script>Motivo privado</script>', createdAt: '2026-11-25T12:00:00Z' }], page: config.params.page, totalPages: 2 };
  } else data = structuredClone(users);
  return { config, headers: {}, status: 200, statusText: 'OK', data: { data } };
};
const { AdminUsersPage } = await import('../src/pages/admin/AdminUsersPage.tsx');
beforeEach(() => {
  users = [row('active', true), row('suspended', false), row('protected', true, false)];
  failure = null; historyFailure = false; changes = []; hold = false; finish = null; historyCalls = [];
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
after(() => { axios.defaults.adapter = originalAdapter; dom.window.close(); });
const mount = async () => act(async () => root.render(createElement(MemoryRouter, null, createElement(AdminUsersPage))));
const button = text => [...container.querySelectorAll('button')].find(node => node.textContent.trim() === text);
const click = async node => { assert.ok(node); await act(async () => node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))); };
const fill = async (selector, value) => act(async () => {
  const input = container.querySelector(selector);
  const prototype = input.tagName === 'TEXTAREA' ? dom.window.HTMLTextAreaElement.prototype : dom.window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
const submit = async () => act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
const tableRow = email => [...container.querySelectorAll('tbody tr')].find(node => node.textContent.includes(email));

test('allowed reactivation is available while protected accounts have no state-changing actions', async () => {
  await mount();
  assert.ok(tableRow('suspended@example').querySelector('[title="Reactivar Cuenta"]'));
  assert.equal(tableRow('protected@example').querySelector('button'), null);
  await click(tableRow('suspended@example').querySelector('button'));
  assert.match(container.querySelector('[role="dialog"]').textContent, /nuevo inicio de sesión/);
});

test('a reason is required and blank reasons never reach the API', async () => {
  await mount(); await click(container.querySelector('[title="Reactivar Cuenta"]'));
  await fill('#status-reason', '  '); await submit();
  assert.equal(changes.length, 0);
  assert.match(container.querySelector('[role="alert"]').textContent, /motivo/);
  assert.match(tableRow('suspended@example').textContent, /Suspendido/);
});

test('pending confirmation cannot be submitted twice and only the response changes the visible status', async () => {
  await mount(); await click(container.querySelector('[title="Reactivar Cuenta"]'));
  await fill('#status-reason', '  Revisión completada  '); hold = true;
  await submit(); await submit();
  assert.equal(changes.length, 1);
  assert.deepEqual(changes[0], { isActive: true, reason: 'Revisión completada', expectedVersion: 0 });
  assert.match(tableRow('suspended@example').textContent, /Suspendido/);
  assert.equal(button('Procesando...').disabled, true);
  await act(async () => finish());
  assert.match(tableRow('suspended@example').textContent, /Activo/);
  assert.equal(container.querySelector('[role="dialog"]'), null);
  assert.match(container.querySelector('[role="status"]').textContent, /Cuenta reactivada/);
});

for (const status of [0, 422, 409]) {
  test(`failed confirmation (${status}) preserves the reason and the last confirmed status`, async () => {
    await mount(); await click(container.querySelector('[title="Reactivar Cuenta"]'));
    await fill('#status-reason', 'Motivo conservado'); failure = status; await submit();
    assert.ok(container.querySelector('[role="alert"]'));
    assert.equal(container.querySelector('#status-reason').value, 'Motivo conservado');
    assert.match(tableRow('suspended@example').textContent, /Suspendido/);
    assert.equal(button('Confirmar').disabled, false);
    failure = null; await submit();
    assert.match(tableRow('suspended@example').textContent, /Activo/);
  });
}

test('suspension uses the same confirmed-state flow and preserves the active search', async () => {
  await mount(); await fill('input[type="text"]', 'active@');
  await click(container.querySelector('[title="Suspender Cuenta"]'));
  await fill('#status-reason', 'Incumplimiento revisado'); await submit();
  assert.equal(changes[0].isActive, false);
  assert.match(tableRow('active@example').textContent, /Suspendido/);
  assert.equal(container.querySelector('input[type="text"]').value, 'active@');
  assert.match(container.querySelector('[role="status"]').textContent, /Cuenta suspendida/);
});

test('history loads actor, reason and date safely and supports pagination and retry', async () => {
  await mount(); historyFailure = true; await click(tableRow('active@example').querySelector('[title="Ver historial de estado"]'));
  assert.match(container.querySelector('[role="alert"]').textContent, /conectar|conexión/);
  historyFailure = false; await click(button('Reintentar'));
  assert.match(container.querySelector('[role="dialog"]').textContent, /operator@example.test/);
  assert.match(container.querySelector('[role="dialog"]').textContent, /Motivo privado/);
  assert.equal(container.querySelector('script'), null);
  await click(button('Siguiente'));
  assert.equal(historyCalls.at(-1), 2);
  assert.match(container.querySelector('[role="dialog"]').textContent, /Página 2 de 2/);
  await click(button('Cerrar historial'));
  assert.equal(container.querySelector('[role="dialog"]'), null);
});
