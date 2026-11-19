import test, { beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import axios from 'axios';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'Event']) {
  Object.defineProperty(globalThis, name, { value: dom.window[name], configurable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.localStorage = { getItem: () => 'super-admin-token' };
const { createRoot } = await import('react-dom/client');
const layoutModule = new URL('./__admin_email_layout.mjs', import.meta.url).href;
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('/AdminLayout')) return { url: layoutModule, shortCircuit: true };
    return nextResolve(specifier.endsWith('/admin.api') ? specifier + '.ts' : specifier, context);
  },
  load(url, context, nextLoad) {
    if (url === layoutModule) return { format: 'module', shortCircuit: true, source: "export function AdminLayout({children}) { return children; }" };
    if (!url.endsWith('/SuperAdminDashboardPage.tsx')) return nextLoad(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
    }).outputText };
  },
});
let rejectDuplicate;
let submitted;
const originalAdapter = axios.defaults.adapter;
axios.defaults.adapter = async config => {
  if (config.method === 'post') {
    submitted = JSON.parse(config.data);
    if (rejectDuplicate) {
      const message = 'Ya existe una cuenta con este correo electrónico.';
      throw new axios.AxiosError(message, 'ERR_BAD_REQUEST', config, null, { config, status: 422, headers: {}, data: { message: [message], errors: { email: [message] } } });
    }
  }
  return { data: { data: [] }, config, headers: {}, status: 200, statusText: 'OK' };
};
const { SuperAdminDashboardPage } = await import('../src/pages/admin/SuperAdminDashboardPage.tsx');
axios.defaults.adapter = originalAdapter;

let root, container, errors;
const originalError = console.error;
beforeEach(async () => {
  errors = [];
  console.error = error => errors.push(error);
  submitted = null;
  rejectDuplicate = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(createElement(SuperAdminDashboardPage)));
});
afterEach(async () => {
  try { await act(async () => root.unmount()); container.remove(); }
  finally { console.error = originalError; }
});
after(() => dom.window.close());
const fill = async (type, value) => act(async () => {
  const input = container.querySelector(`input[type="${type}"]`);
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
const submit = async () => act(async () => container.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));

test('the existing form displays the email validation message and retains entered values', async () => {
  await fill('email', 'DUPLICATE@EXAMPLE.TEST');
  await fill('password', 'Password123');
  await submit();
  assert.equal(submitted.email, 'DUPLICATE@EXAMPLE.TEST');
  assert.match(container.textContent, /Ya existe una cuenta con este correo electrónico/);
  assert.equal(container.querySelector('input[type="email"]').value, 'DUPLICATE@EXAMPLE.TEST');
  assert.doesNotMatch(container.textContent, /Administrador creado con éxito/);
  assert.equal(errors.length, 1);
  assert.equal(errors[0].response.status, 422);
});

test('a successful creation still clears the form and shows confirmation', async () => {
  rejectDuplicate = false;
  await fill('email', 'NEW@EXAMPLE.TEST');
  await fill('password', 'Password123');
  await submit();
  assert.match(container.textContent, /Administrador creado con éxito/);
  assert.equal(container.querySelector('input[type="email"]').value, '');
  assert.equal(container.querySelector('input[type="password"]').value, '');
  assert.deepEqual(errors, []);
});
