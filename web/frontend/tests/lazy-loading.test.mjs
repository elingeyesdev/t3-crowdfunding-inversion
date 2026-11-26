import test, { beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import { act, createElement, lazy } from 'react';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const name of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'Node',
  'MouseEvent',
  'Event',
])
  Object.defineProperty(globalThis, name, { value: dom.window[name], configurable: true });
globalThis.localStorage = dom.window.localStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
let caseId = 0;
const requested = [];
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (
      specifier.startsWith('./pages/') &&
      new URL(context.parentURL).pathname.endsWith('/App.tsx')
    ) {
      const name = specifier.split('/').at(-1);
      return {
        url: new URL(`./__lazy_${name}.mjs?case=${caseId}`, import.meta.url).href,
        shortCircuit: true,
      };
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    const parsed = new URL(url);
    if (parsed.pathname.includes('/__lazy_')) {
      const name = parsed.pathname.split('__lazy_')[1].replace('.mjs', '');
      requested.push(name);
      return {
        format: 'module',
        shortCircuit: true,
        source: `import {createElement} from 'react'; export function ${name}(){return createElement('h1',null,'${name}');}`,
      };
    }
    if (!parsed.pathname.endsWith('.tsx') || !parsed.pathname.includes('/frontend/src/'))
      return nextLoad(url, context);
    return {
      format: 'module',
      shortCircuit: true,
      source: ts.transpileModule(readFileSync(new URL(parsed.pathname, parsed), 'utf8'), {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          jsx: ts.JsxEmit.ReactJSX,
          target: ts.ScriptTarget.ES2023,
        },
      }).outputText,
    };
  },
});
const { AsyncContent } = await import('../src/components/AsyncContent.tsx');
let root, container, caught, errors;
const originalError = console.error;
beforeEach(() => {
  caseId++;
  requested.length = 0;
  localStorage.clear();
  caught = [];
  errors = [];
  console.error = (...args) => errors.push(args.map(String).join(' '));
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container, {
    onCaughtError: (error) => caught.push(error),
    onUncaughtError: (error) => errors.push(error),
  });
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
after(() => dom.window.close());
const render = (node) => act(async () => root.render(node));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

test('a pending module has a visible status and is replaced when the module resolves', async () => {
  const pending = deferred();
  const Screen = lazy(() => pending.promise);
  await render(
    createElement(AsyncContent, { label: 'Cargando estadísticas...' }, createElement(Screen)),
  );
  assert.match(container.querySelector('[role="status"]').textContent, /Cargando estadísticas/);
  await act(async () =>
    pending.resolve({ default: () => createElement('h1', null, 'Statistics ready') }),
  );
  assert.equal(container.querySelector('[role="status"]'), null);
  assert.match(container.textContent, /Statistics ready/);
});

test('a failed module has an explicit reload action and a working home link', async () => {
  const Screen = lazy(() => Promise.reject(new Error('Chunk unavailable')));
  await render(createElement(AsyncContent, null, createElement(Screen)));
  assert.match(container.querySelector('[role="alert"]').textContent, /No pudimos mostrar/);
  assert.equal(container.querySelector('button').textContent, 'Recargar página');
  assert.equal(container.querySelector('a').getAttribute('href'), '/');
  assert.equal(caught.length, 1);
});

for (const [path, name, token] of [
  ['/', 'LandingPage', false],
  ['/campaign/test', 'CampaignDetailPage', false],
  ['/forgot-password', 'PasswordRecoveryPage', false],
  ['/admin', 'AdminDashboardPage', true],
  ['/dashboard', 'LoginPage', false],
]) {
  test(`direct entry ${path} only imports its resolved route`, async () => {
    window.history.replaceState({}, '', path);
    if (token) localStorage.setItem('accessToken', 'test-token');
    const { default: App } = await import(`../src/App.tsx?case=${caseId}`);
    await render(createElement(App));
    assert.match(container.textContent, new RegExp(name));
    assert.deepEqual(requested, [name]);
  });
}
