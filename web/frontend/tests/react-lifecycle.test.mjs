import test, { beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import { act, createElement, useCallback } from 'react';

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
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
registerHooks({
    load(url, context, nextLoad) {
        if (!url.endsWith('.tsx') || !url.includes('/frontend/src/')) return nextLoad(url, context);
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
const { useAsyncResource } = await import('../src/hooks/useAsyncResource.ts');
const { EditProfileModal: EntrepreneurEditor } =
    await import('../src/components/entrepreneur-profile/EditProfileModal.tsx');
const { EditProfileModal: InvestorEditor } =
    await import('../src/components/investor-profile/EditProfileModal.tsx');
const { useClock } = await import('../src/hooks/useClock.ts');

let root, container, latest;
let errors;
const originalError = console.error;
beforeEach(() => {
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
function Resource({ id, fetch }) {
    const load = useCallback(() => fetch(id), [id, fetch]);
    latest = useAsyncResource(load);
    return createElement(
        'p',
        null,
        latest.loading ? 'Loading' : latest.error ? 'Error' : (latest.data?.label ?? 'Empty'),
    );
}

test('a request change hides prior data and ignores a late response from the old request', async () => {
    const first = deferred(),
        second = deferred();
    const fetch = (id) => (id === 'first' ? first.promise : second.promise);
    await render(createElement(Resource, { id: 'first', fetch }));
    await render(createElement(Resource, { id: 'second', fetch }));
    assert.equal(container.textContent, 'Loading');
    await act(async () => first.resolve({ label: 'Wrong campaign' }));
    assert.equal(container.textContent, 'Loading');
    await act(async () => second.resolve({ label: 'Current campaign' }));
    assert.equal(container.textContent, 'Current campaign');
});

test('retry clears the error while loading and commits a new successful response', async () => {
    const pending = deferred();
    let calls = 0;
    const fetch = () => (++calls === 1 ? Promise.reject(new Error('Offline')) : pending.promise);
    await render(createElement(Resource, { id: 'one', fetch }));
    assert.equal(container.textContent, 'Error');
    await act(async () => latest.retry());
    assert.equal(container.textContent, 'Loading');
    assert.equal(latest.error, null);
    await act(async () => pending.resolve({ label: 'Recovered' }));
    assert.equal(container.textContent, 'Recovered');
    assert.equal(calls, 2);
});

test('a silent refresh preserves confirmed data on failure and cannot overwrite a newer request', async () => {
    const pending = deferred();
    let calls = 0;
    const fetch = (id) =>
        id === 'second'
            ? Promise.resolve({ label: 'Second' })
            : ++calls === 1
              ? Promise.resolve({ label: 'First' })
              : calls === 2
                ? Promise.reject(new Error('Offline'))
                : pending.promise;
    await render(createElement(Resource, { id: 'first', fetch }));
    await act(async () => latest.refetch());
    assert.equal(container.textContent, 'First');
    let refresh;
    await act(async () => {
        refresh = latest.refetch();
    });
    await render(createElement(Resource, { id: 'second', fetch }));
    await act(async () => {
        pending.resolve({ label: 'Stale first' });
        await refresh;
    });
    assert.equal(container.textContent, 'Second');
});

test('a late read cannot overwrite confirmed data supplied after a mutation', async () => {
    const pending = deferred();
    await render(createElement(Resource, { id: 'one', fetch: () => pending.promise }));
    await act(async () => latest.setData({ label: 'Saved change' }));
    await act(async () => pending.resolve({ label: 'Older server snapshot' }));
    assert.equal(container.textContent, 'Saved change');
});

test('a mutation started before retry completes the current attempt without leaving loading stuck', async () => {
    const first=deferred(), second=deferred(); let calls=0;
    const fetch=() => ++calls===1?first.promise:second.promise;
    await render(createElement(Resource,{id:'same',fetch}));
    const saveResult=latest.setData;
    await act(async () => latest.retry());
    await act(async () => saveResult({label:'Saved during retry'}));
    assert.equal(container.textContent,'Saved during retry');
    await act(async () => {first.resolve({label:'Old'});second.resolve({label:'Old retry snapshot'});});
    assert.equal(container.textContent,'Saved during retry');
});

test('old setters and refresh callbacks cannot overwrite or cancel another resource', async () => {
    const pending=deferred();
    const fetch=id => id==='first'?Promise.resolve({label:'First'}):pending.promise;
    await render(createElement(Resource,{id:'first',fetch}));
    const oldSet=latest.setData, oldRefresh=latest.refetch;
    await render(createElement(Resource,{id:'second',fetch}));
    await act(async () => {oldSet({label:'Old save'});await oldRefresh();});
    await act(async () => pending.resolve({label:'Second'}));
    assert.equal(container.textContent,'Second');
});

test('a request resolving after unmount does not update another mounted resource', async () => {
    const pending = deferred();
    await render(createElement(Resource, { id: 'old', fetch: () => pending.promise }));
    await act(async () => root.unmount());
    root = createRoot(container);
    await render(
        createElement(Resource, {
            id: 'new',
            fetch: () => Promise.resolve({ label: 'New mount' }),
        }),
    );
    await act(async () => pending.resolve({ label: 'Unmounted' }));
    assert.equal(container.textContent, 'New mount');
});

for (const [name, Editor] of [
    ['entrepreneur', EntrepreneurEditor],
    ['investor', InvestorEditor],
]) {
    test(`${name} profile initializes existing values and keeps select identity and focus on edits`, async () => {
        const profile = {
            id: 'profile',
            firstName: 'Existing',
            lastName: 'User',
            state: 'La Paz',
            city: 'La Paz',
            country: 'Bolivia',
        };
        const props = {
            type: 'profile',
            profile,
            saving: false,
            onSave: async () => {},
            onClose() {},
        };
        await render(createElement(Editor, props));
        assert.equal(container.querySelector('input[name="firstName"]').value, 'Existing');
        await render(createElement(Editor, { ...props, type: 'address' }));
        const select = container.querySelector('select[name="state"]');
        assert.ok(select);
        select.focus();
        await act(async () => {
            select.value = 'Cochabamba';
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });
        assert.equal(container.querySelector('select[name="state"]'), select);
        assert.equal(document.activeElement, select);
        assert.equal(select.value, 'Cochabamba');
        const changed = { ...profile, firstName: 'Another' };
        await render(createElement(Editor, { ...props, profile: changed }));
        assert.equal(container.querySelector('input[name="firstName"]').value, 'Another');
    });
}

test('the clock advances from a timer and releases that timer when unmounted', async (context) => {
    context.mock.timers.enable({ apis: ['Date', 'setInterval'], now: 1_000 });
    function Clock() {
        return createElement('p', null, String(useClock(1_000)));
    }
    try {
        await render(createElement(Clock));
        assert.equal(container.textContent, '1000');
        await act(async () => context.mock.timers.tick(1_000));
        assert.equal(container.textContent, '2000');
        await act(async () => root.unmount());
        root = createRoot(container);
        await act(async () => context.mock.timers.tick(5_000));
        assert.equal(container.textContent, '');
    } finally {
        context.mock.timers.reset();
    }
});
