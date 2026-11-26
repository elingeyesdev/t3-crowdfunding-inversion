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
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'Event', 'MouseEvent']) {
  Object.defineProperty(globalThis, name, { value: dom.window[name], configurable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let signedIn;
globalThis.localStorage = {
  getItem: key => key === 'accessToken' && signedIn ? 'test-token' : null,
  removeItem: () => {},
};
const { createRoot } = await import('react-dom/client');
const navbar = new URL('./__verification_navbar.mjs', import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('/Navbar')) return { url: navbar, shortCircuit: true };
    if (['/auth.api', '/useAuth', '/apiError'].some(path => specifier.endsWith(path))) return nextResolve(specifier+'.ts', context);
    if (['/RequestErrorNotice', '/EmailVerificationControls'].some(path => specifier.endsWith(path))) return nextResolve(specifier+'.tsx', context);
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === navbar) return { format: 'module', shortCircuit: true, source: 'export function Navbar() { return null; }' };
    if (!['/EmailVerificationPage.tsx', '/AccountSettingsPage.tsx', '/EmailVerificationControls.tsx', '/RequestErrorNotice.tsx'].some(path => url.endsWith(path))) return nextLoad(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
    }).outputText };
  },
});
const { EmailVerificationPage } = await import('../src/pages/EmailVerificationPage.tsx');
const { AccountSettingsPage } = await import('../src/pages/AccountSettingsPage.tsx');
const { RequestErrorNotice } = await import('../src/components/RequestErrorNotice.tsx');
const { isVerificationPath } = await import('../src/api/auth.api.ts');
const path = '/api/v1/auth/email/verify/12345678-1234-1234-1234-123456789abc/'+ 'a'.repeat(40)+'?expires=9999999999&signature='+'b'.repeat(64);
const pageUrl = '/verify-email?verification='+encodeURIComponent(path);
const originalAdapter = axios.defaults.adapter;
let root, container, calls, verified, failure, hold, finish, google;
const fail = (config, status, code, message) => {
  throw new axios.AxiosError('Failure', status ? 'ERR_BAD_RESPONSE' : 'ERR_NETWORK', config, null,
    status ? { config, status, headers: {}, data: { code, message } } : undefined);
};
axios.defaults.adapter = async config => {
  assert.equal(config.headers.Authorization, 'Bearer test-token');
  calls.push({ url: config.url, method: config.method });
  let data;
  if (config.method === 'get') {
    data = { id: 'fixture', email: 'person@example.test', emailVerified: verified, lastLoginAt: null, hasPassword: !google, oauthProvider: google ? 'google' : null };
  } else {
    if (hold) { hold = false; await new Promise(resolve => { finish = resolve; }); }
    if (failure !== null) fail(config, failure, failure === 403 ? 'EMAIL_VERIFICATION_MISMATCH' : undefined,
      failure === 403 ? 'Este enlace no corresponde al correo de tu cuenta. Inicia sesión con la cuenta correcta.' : failure === 429 ? 'Espera antes de reenviar.' : 'El enlace no es válido o ha caducado. Solicita uno nuevo.');
    if (config.url === path) verified = true;
    data = { emailVerified: verified, message: 'Solicitud recibida. Revisa tu correo.' };
  }
  return { config, headers: {}, status: 200, statusText: 'OK', data: { data } };
};
beforeEach(() => {
  signedIn = true; verified = false; failure = null; hold = false; finish = null; google = false; calls = [];
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
});
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
after(() => { axios.defaults.adapter = originalAdapter; dom.window.close(); });
function LoginDestination() {
  const location = useLocation();
  return createElement('output', null, JSON.stringify(location.state));
}
const mount = async (url = '/account-settings') => act(async () => root.render(
  createElement(MemoryRouter, { initialEntries: [url] }, createElement(Routes, null,
    createElement(Route, { path: '/account-settings', element: createElement(AccountSettingsPage) }),
    createElement(Route, { path: '/verify-email', element: createElement(EmailVerificationPage) }),
    createElement(Route, { path: '/login', element: createElement(LoginDestination) })))));
const button = text => [...container.querySelectorAll('button')].find(node => node.textContent.includes(text));
const click = async node => { assert.ok(node); await act(async () => node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))); };
const posts = () => calls.filter(call => call.method === 'post');

test('account settings supports sending and resending with duplicate submission prevention', async () => {
  await mount(); assert.match(container.textContent, /Sin verificar/);
  hold = true; await click(button('Enviar verificación')); await click(button('Solicitando'));
  assert.equal(posts().length, 1); assert.equal(button('Solicitando').disabled, true);
  await act(async () => finish());
  assert.match(container.querySelector('[role="status"]').textContent, /Revisa tu correo/);
  assert.ok(button('Reenviar verificación'));
  assert.equal(posts()[0].url, '/api/v1/auth/email/verification');
});

test('throttling and network errors allow retry and never mark the account verified', async () => {
  await mount(); failure = 429; await click(button('Enviar verificación'));
  assert.match(container.querySelector('[role="alert"]').textContent, /Espera/);
  assert.match(container.textContent, /Sin verificar/);
  failure = 0; await click(button('Enviar verificación'));
  assert.match(container.querySelector('[role="alert"]').textContent, /conexión|conectar/);
  failure = null; await click(button('Enviar verificación'));
  assert.equal(container.querySelector('[role="alert"]'), null);
});

test('refresh reflects confirmation from another tab and hides send controls', async () => {
  await mount(); verified = true; await click(button('actualizar estado'));
  assert.doesNotMatch(container.textContent, /Sin verificar/);
  assert.equal(button('Enviar verificación'), undefined);
  assert.match(container.textContent, /Verificado/);
});

test('verified Google accounts keep their verified badge without unnecessary mail controls', async () => {
  verified = true; google = true; await mount();
  assert.match(container.textContent, /Verificado/); assert.match(container.textContent, /Cuenta Google/);
  assert.equal(button('Enviar verificación'), undefined); assert.equal(posts().length, 0);
});

test('signed-out confirmation retains the full signed link through the login destination', async () => {
  signedIn = false; await mount(pageUrl);
  assert.equal(posts().length, 0);
  await click(container.querySelector('a[href="/login"]'));
  assert.equal(JSON.parse(container.querySelector('output').textContent).from, pageUrl);
});

test('confirmation requires a button click and refreshes the verified account', async () => {
  await mount(pageUrl); assert.equal(posts().length, 0);
  await click(button('Confirmar mi correo'));
  assert.deepEqual(posts(), [{ method: 'post', url: path }]);
  assert.match(container.querySelector('[role="status"]').textContent, /correo está verificado/);
  assert.equal(button('Confirmar mi correo'), undefined);
});

test('expired links and wrong-account errors explain how to recover and permit requesting another link', async () => {
  await mount(pageUrl); failure = 422; await click(button('Confirmar mi correo'));
  assert.match(container.querySelector('[role="alert"]').textContent, /caducado/);
  assert.ok(button('Enviar verificación'));
  failure = 403; await click(button('Confirmar mi correo'));
  assert.match(container.querySelector('[role="alert"]').textContent, /cuenta correcta/);
  assert.ok(container.querySelector('a[href="/login"]'));
  assert.equal(verified, false);
});

test('malformed or external links never receive authenticated requests', async () => {
  for (const invalid of ['', 'https://attacker.test'+path, '//attacker.test'+path, path+'&redirect=evil', path.replace('signature=', 'other='), path+'#extra']) {
    assert.equal(isVerificationPath(invalid), false);
  }
  await mount('/verify-email?verification='+encodeURIComponent('https://attacker.test'+path));
  assert.match(container.querySelector('[role="alert"]').textContent, /incompleto|válido/);
  assert.equal(button('Confirmar mi correo'), undefined); assert.equal(posts().length, 0);
});

test('restricted-operation errors offer the account verification destination', async () => {
  const error = new axios.AxiosError('Forbidden', 'ERR_BAD_REQUEST', undefined, undefined,
    { status: 403, data: { code: 'EMAIL_VERIFICATION_REQUIRED', message: 'Verifica tu correo para realizar aportes.' } });
  await act(async () => root.render(createElement(MemoryRouter, null, createElement(RequestErrorNotice, { error, fallback: 'Error' }))));
  assert.match(container.querySelector('[role="alert"]').textContent, /Verifica tu correo/);
  assert.equal(container.querySelector('a').getAttribute('href'), '/account-settings');
});
