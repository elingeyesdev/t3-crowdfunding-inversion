import test, { beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import axios from 'axios';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'Event']) {
  Object.defineProperty(globalThis, name, { value: dom.window[name], configurable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.localStorage = { getItem: () => null };
const { createRoot } = await import('react-dom/client');
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (['/auth.api', '/investor.api', '/authRole', '/apiError'].some(path => specifier.endsWith(path))) return nextResolve(specifier+'.ts', context);
    if (specifier.endsWith('/RequestErrorNotice')) return nextResolve(specifier+'.tsx', context);
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (!['/PasswordRecoveryPage.tsx', '/LoginPage.tsx', '/RequestErrorNotice.tsx'].some(path => url.endsWith(path))) return nextLoad(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
    }).outputText };
  },
});
const { PasswordRecoveryPage } = await import('../src/pages/PasswordRecoveryPage.tsx');
const { LoginPage } = await import('../src/pages/LoginPage.tsx');
const originalAdapter = axios.defaults.adapter;
const generic = 'Si existe una cuenta que puede recuperar su acceso, recibirás las instrucciones por correo.';
const token = 'a'.repeat(64);
const resetUrl = `/reset-password?token=${token}&email=person%2Bweb%40example.test`;
let root, container, calls, failure, hold, finish;
axios.defaults.adapter = async config => {
  assert.equal(config.headers.Authorization, undefined);
  assert.equal(config.timeout, 15000);
  calls.push({ url: config.url, data: JSON.parse(config.data) });
  if (hold) { hold = false; await new Promise(resolve => { finish = resolve; }); }
  if (failure !== null) {
    throw new axios.AxiosError('Failure', failure ? 'ERR_BAD_REQUEST' : 'ERR_NETWORK', config, null,
      failure ? { config, status: failure, headers: {}, data: { message: 'El enlace no es válido o ha caducado. Solicita uno nuevo.' } } : undefined);
  }
  return { config, headers: {}, status: 202, statusText: 'Accepted', data: { data: { message: generic } } };
};
beforeEach(() => {
  calls = []; failure = null; hold = false; finish = null;
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
after(() => { axios.defaults.adapter = originalAdapter; dom.window.close(); });
function Location() {
  const location = useLocation();
  return createElement('output', { 'data-location': true }, location.pathname+location.search);
}
const mount = async (url = '/forgot-password') => act(async () => root.render(
  createElement(MemoryRouter, { initialEntries: [url] },
    createElement(Location), createElement(Routes, null,
      createElement(Route, { path: '/forgot-password', element: createElement(PasswordRecoveryPage) }),
      createElement(Route, { path: '/reset-password', element: createElement(PasswordRecoveryPage, { reset: true }) }),
      createElement(Route, { path: '/login', element: createElement(LoginPage) })))));
const fill = async (id, value) => act(async () => {
  const input = container.querySelector('#'+id);
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
const submit = async () => act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
const passwords = async (password = 'Updated123', confirmation = password) => {
  await fill('new-password', password); await fill('confirm-password', confirmation);
};

test('request normalizes email and shows generic confirmation and Google guidance', async () => {
  await mount(); await fill('recovery-email', ' PERSON@EXAMPLE.TEST '); await submit();
  assert.deepEqual(calls, [{ url: '/api/v1/auth/forgot-password', data: { email: 'person@example.test' } }]);
  assert.equal(container.querySelector('[role="status"]').textContent, generic);
  assert.match(container.textContent, /únicamente Google/);
});

test('pending requests cannot be submitted twice', async () => {
  await mount(); await fill('recovery-email', 'person@example.test'); hold = true;
  await submit(); await submit();
  assert.equal(calls.length, 1); assert.equal(container.querySelector('button').disabled, true);
  await act(async () => finish());
  assert.equal(container.querySelector('button').disabled, false);
});

test('invalid email makes no request; a network failure retains email and allows retry', async () => {
  await mount(); await fill('recovery-email', 'invalid'); await submit();
  assert.equal(calls.length, 0); assert.match(container.querySelector('[role="alert"]').textContent, /válido/);
  await fill('recovery-email', 'person@example.test'); failure = 0; await submit();
  assert.match(container.querySelector('[role="alert"]').textContent, /conectar|conexión/);
  assert.equal(container.querySelector('#recovery-email').value, 'person@example.test');
  failure = null; await submit(); assert.equal(container.querySelector('[role="alert"]'), null);
  assert.ok(container.querySelector('[role="status"]'));
});

test('incomplete reset links show a new-link option without a password form', async () => {
  await mount('/reset-password?email=person%40example.test');
  assert.equal(container.querySelector('form'), null);
  assert.match(container.querySelector('[role="alert"]').textContent, /incompleto|válido/);
  assert.ok(container.querySelector('a[href="/forgot-password"]'));
});

test('weak or mismatched passwords never reach the reset endpoint', async () => {
  await mount(resetUrl); await passwords('weak'); await submit();
  assert.match(container.querySelector('[role="alert"]').textContent, /mayúscula/);
  await passwords('Updated123', 'Different123'); await submit();
  assert.match(container.querySelector('[role="alert"]').textContent, /no coinciden/);
  assert.equal(calls.length, 0);
});

test('expired token errors keep the form and offer requesting a fresh link', async () => {
  await mount(resetUrl); await passwords(); failure = 422; await submit();
  assert.match(container.querySelector('[role="alert"]').textContent, /caducado/);
  assert.equal(container.querySelector('#new-password').value, 'Updated123');
  assert.ok(container.querySelector('a[href="/forgot-password"]'));
  assert.equal(container.querySelector('[role="status"]'), null);
});

test('successful reset sends the link credentials and replaces the URL with login confirmation', async () => {
  await mount(resetUrl); await passwords(); await submit();
  assert.deepEqual(calls, [{ url: '/api/v1/auth/reset-password', data: {
    email: 'person+web@example.test', token, password: 'Updated123', password_confirmation: 'Updated123',
  } }]);
  assert.equal(container.querySelector('[data-location]').textContent, '/login?passwordReset=success');
  assert.match(container.querySelector('[role="status"]').textContent, /contraseña/);
  assert.ok(container.querySelector('a[href="/forgot-password"]'));
  assert.doesNotMatch(container.textContent, new RegExp(token));
});
