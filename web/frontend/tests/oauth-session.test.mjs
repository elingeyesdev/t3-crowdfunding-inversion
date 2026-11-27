import test, { beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import { act, createElement, StrictMode } from 'react';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import axios from 'axios';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const name of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'Node',
  'Event',
  'MouseEvent',
]) {
  Object.defineProperty(globalThis, name, { value: dom.window[name], configurable: true });
}
globalThis.localStorage = dom.window.localStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
registerHooks({
  load(url, context, nextLoad) {
    if (!url.endsWith('/OAuthCallbackPage.tsx')) return nextLoad(url, context);
    return {
      format: 'module',
      shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          jsx: ts.JsxEmit.ReactJSX,
          target: ts.ScriptTarget.ES2023,
        },
      }).outputText,
    };
  },
});
const { OAuthCallbackPage } = await import('../src/pages/OAuthCallbackPage.tsx');
const { logout } = await import('../src/api/auth.api.ts');
const token = '42|opaque-server-credential';
const url =
  '/auth/callback?' + new URLSearchParams({ token, userId: 'untrusted-id', role: 'super_admin' });
const keys = ['accessToken', 'userId', 'userEmail', 'userRole', 'adminAccessLevel'];
const originalAdapter = axios.defaults.adapter;
const originalError = console.error;
let root, container, calls, user, failure, hold, finish, errors;
axios.defaults.adapter = async (config) => {
  calls.push(config);
  if (config.url === '/api/v1/auth/logout')
    return { config, headers: {}, status: 200, data: { data: null } };
  assert.equal(config.url, '/api/v1/auth/me');
  assert.equal(config.headers.Authorization, `Bearer ${token}`);
  assert.equal(config.timeout, 15000);
  assert.equal(
    localStorage.getItem('accessToken'),
    null,
    'pending credentials must not be persisted',
  );
  if (hold)
    await new Promise((resolve) => {
      finish = resolve;
    });
  if (failure !== null) {
    throw new axios.AxiosError(
      'Synthetic failure',
      'ERR_BAD_RESPONSE',
      config,
      null,
      failure
        ? { config, status: failure, headers: {}, data: { message: 'Synthetic failure' } }
        : undefined,
    );
  }
  return { config, headers: {}, status: 200, data: { data: user } };
};
beforeEach(() => {
  localStorage.clear();
  for (const key of keys) localStorage.setItem(key, 'previous-session');
  localStorage.setItem('rememberedEmail', 'remembered@example.test');
  window.history.replaceState({}, '', url);
  user = {
    id: 'server-user',
    email: 'person@example.test',
    roles: ['investor'],
    adminAccessLevel: null,
    isActive: true,
  };
  calls = [];
  failure = null;
  hold = false;
  finish = null;
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
  } finally {
    console.error = originalError;
  }
});
after(() => {
  axios.defaults.adapter = originalAdapter;
  dom.window.close();
});
function Destination() {
  const location = useLocation();
  return createElement('output', { 'data-path': location.pathname }, location.pathname);
}
async function mount(path = url, strict = false) {
  const tree = createElement(
    MemoryRouter,
    { initialEntries: [path] },
    createElement(
      Routes,
      null,
      createElement(Route, { path: '/auth/callback', element: createElement(OAuthCallbackPage) }),
      createElement(Route, { path: '*', element: createElement(Destination) }),
    ),
  );
  await act(async () => root.render(strict ? createElement(StrictMode, null, tree) : tree));
}
function noSession() {
  for (const key of keys) assert.equal(localStorage.getItem(key), null, key);
}
const button = (label) =>
  [...container.querySelectorAll('button')].find((node) => node.textContent === label);
async function click(node) {
  assert.ok(node);
  await act(async () =>
    node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })),
  );
}

for (const [roles, level, destination, role] of [
  [['investor'], null, '/dashboard', 'investor'],
  [['entrepreneur'], null, '/entrepreneur-profile', 'entrepreneur'],
  [['investor', 'entrepreneur'], null, '/entrepreneur-profile', 'entrepreneur'],
  [['admin'], 'admin', '/admin', 'admin'],
  [['super_admin'], 'super_admin', '/superadmin', 'super_admin'],
]) {
  test(`server roles ${roles.join(',')} initialize the complete session and select ${destination}`, async () => {
    user = { ...user, roles, adminAccessLevel: level };
    await mount();
    assert.equal(container.querySelector('output')?.dataset.path, destination);
    assert.equal(localStorage.getItem('accessToken'), token);
    assert.equal(localStorage.getItem('userId'), user.id);
    assert.equal(localStorage.getItem('userEmail'), user.email);
    assert.equal(localStorage.getItem('userRole'), role);
    assert.equal(localStorage.getItem('adminAccessLevel'), level);
    assert.equal(localStorage.getItem('rememberedEmail'), 'remembered@example.test');
    assert.equal(window.location.search, '');
  });
}

test('a pending identity lookup clears stale data without publishing the new token', async () => {
  hold = true;
  await mount();
  noSession();
  assert.match(container.querySelector('[role="status"]').textContent, /Iniciando sesión/);
  assert.equal(window.location.search, '');
  await act(async () => finish());
  assert.equal(localStorage.getItem('accessToken'), token);
});

for (const [status, retry] of [
  [401, false],
  [403, false],
  [0, true],
  [500, true],
  [429, true],
]) {
  test(`lookup failure ${status || 'network'} leaves no session and exposes the appropriate recovery`, async () => {
    failure = status;
    await mount();
    noSession();
    assert.ok(container.querySelector('[role="alert"]'));
    assert.equal(Boolean(button('Reintentar')), retry);
    assert.equal(container.querySelector('a').getAttribute('href'), '/login');
    assert.equal(container.querySelector('output'), null);
  });
}

test('retry requests the identity again and commits the recovered session', async () => {
  failure = 500;
  await mount();
  failure = null;
  hold = true;
  await click(button('Reintentar'));
  noSession();
  assert.equal(button('Reintentar'), undefined);
  assert.ok(container.querySelector('[role="status"]'));
  await act(async () => finish());
  assert.equal(calls.length, 2);
  assert.equal(container.querySelector('output')?.dataset.path, '/dashboard');
});

for (const [name, patch] of [
  ['missing email', { email: null }],
  ['inactive account', { isActive: false }],
  ['conflicting administrative permissions', { adminAccessLevel: 'super_admin' }],
]) {
  test(`an invalid server identity (${name}) cannot complete a session`, async () => {
    user = { ...user, ...patch };
    await mount();
    noSession();
    assert.match(container.querySelector('[role="alert"]').textContent, /No se pudieron validar/);
    assert.equal(container.querySelector('output'), null);
  });
}

for (const path of ['/auth/callback', '/auth/callback?token=ignored&error=denied']) {
  test(`an incomplete or rejected callback never requests an identity: ${path}`, async () => {
    await mount(path);
    noSession();
    assert.equal(calls.length, 0);
    assert.ok(container.querySelector('[role="alert"]'));
    assert.equal(button('Reintentar'), undefined);
    await click(container.querySelector('a'));
    assert.equal(container.querySelector('output')?.dataset.path, '/login');
  });
}

test('a lookup resolved after leaving the callback cannot replace a newer session', async () => {
  hold = true;
  await mount();
  await act(async () => root.render(createElement('p', null, 'Another page')));
  assert.equal(calls[0].signal.aborted, true);
  localStorage.setItem('accessToken', 'newer-session');
  localStorage.setItem('userEmail', 'newer@example.test');
  await act(async () => finish());
  assert.equal(container.textContent, 'Another page');
  assert.equal(localStorage.getItem('accessToken'), 'newer-session');
  assert.equal(localStorage.getItem('userEmail'), 'newer@example.test');
});

test('StrictMode cleanup does not cancel the succeeding initialization', async () => {
  await mount(url, true);
  assert.equal(container.querySelector('output')?.dataset.path, '/dashboard');
  assert.equal(localStorage.getItem('accessToken'), token);
  assert.equal(calls.filter((config) => !config.signal.aborted).length <= 1, true);
});

test('logout clears every stored identity field while preserving the remembered address', async () => {
  await logout();
  noSession();
  assert.equal(calls[0].url, '/api/v1/auth/logout');
  assert.equal(localStorage.getItem('rememberedEmail'), 'remembered@example.test');
});
