import test, { beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import { act, createElement, useState } from 'react';
import axios from 'axios';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const name of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'MouseEvent', 'Event']) {
  Object.defineProperty(globalThis, name, { value: dom.window[name], configurable: true });
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
globalThis.localStorage = { getItem: () => 'admin-token' };
Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => { throw new Error('No camera in test'); } } });
URL.createObjectURL = () => 'blob:test-kyc-preview';
URL.revokeObjectURL = () => {};
const { createRoot } = await import('react-dom/client');
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (['/KycFileViewer', '/InfoHint'].some(path => specifier.endsWith(path))) return nextResolve(specifier + '.tsx', context);
    if (['/kycFiles', '/entrepreneur.api'].some(path => specifier.endsWith(path))) return nextResolve(specifier + '.ts', context);
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (!url.endsWith('.tsx') || !url.includes('/frontend/src/')) return nextLoad(url, context);
    return { format: 'module', shortCircuit: true, source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2023 },
    }).outputText };
  },
});
const originalAdapter = axios.defaults.adapter;
let adminRequest;
let refreshedProfile;
axios.defaults.adapter = async config => {
  adminRequest = config;
  return { data: { data: refreshedProfile }, config, headers: {}, status: 200, statusText: 'OK' };
};
const { getKycProfile } = await import('../src/api/admin.api.ts');
const { KycFileViewer } = await import('../src/components/admin/KycFileViewer.tsx');
const { KYCReviewModal } = await import('../src/components/admin/KYCReviewModal.tsx');
const { KYCUploadModal } = await import('../src/components/KYCUploadModal.tsx');
const { kycFileKind, kycUploadError, parseKycDocuments, privateKycUrl, KYC_ID_ACCEPT, KYC_FACE_ACCEPT } = await import('../src/utils/kycFiles.ts');
axios.defaults.adapter = originalAdapter;

const signed = (name, expires = Math.floor(Date.now() / 1000) + 600) => `http://localhost/api/v1/private-files/kyc/${name}?expires=${expires}&signature=test-signature`;
let root, container, calls, respond, errors;
const originalError = console.error;
beforeEach(context => {
  // Keep signed URLs and the viewer's expiry timers independent of real elapsed time.
  context.mock.timers.enable({ apis: ['Date', 'setTimeout'], now: new Date('2026-11-26T12:00:00Z') });
  calls = [];
  errors = [];
  console.error = (...args) => errors.push(args.map(String).join(' '));
  respond = async () => new Response(null, { status: 200, headers: { 'Content-Type': 'application/octet-stream' } });
  globalThis.fetch = async (url, options) => { calls.push({ url, options }); return respond(url, options); };
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async context => {
  try {
    await act(async () => root.unmount());
    container.remove();
    assert.deepEqual(errors, [], 'React rendering must not emit errors');
  } finally {
    console.error = originalError;
    context.mock.timers.reset();
  }
});
after(() => dom.window.close());
const render = async node => act(async () => root.render(node));
const renderFile = async (doc, props = {}) => render(createElement(KycFileViewer, { document: doc, label: 'Documento KYC', refreshing: false, onRefresh: async () => {}, ...props }));
const click = async text => act(async () => {
  const element = [...container.querySelectorAll('button')].find(node => node.textContent.includes(text) || node.getAttribute('aria-label') === text);
  assert.ok(element, `Missing button ${text}`);
  element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});

test('MIME or URL pathname detects signed PDF, images and all accepted video formats', () => {
  for (const [name, kind] of [['ID.PDF', 'pdf'], ['id.jpeg', 'image'], ['id.webp', 'image'], ['face.mp4', 'video'], ['face.webm', 'video'], ['face.mov', 'video']]) assert.equal(kycFileKind(signed(name)+'#preview', undefined), kind);
  assert.equal(kycFileKind(signed('no-extension'), 'application/pdf'), 'pdf');
  assert.equal(kycFileKind(signed('id.jpg')+'&name=other.pdf'), 'image');
  assert.equal(kycFileKind(signed('face.mov'), 'video/quicktime; charset=binary'), 'video');
  assert.equal(kycFileKind(signed('file.pdf'), 'text/html'), 'unsupported');
  assert.equal(privateKycUrl(signed('id.pdf'), window.location.href).href, signed('id.pdf'));
  assert.equal(privateKycUrl('https://foreign.example/api/v1/private-files/kyc/id.pdf?expires=9999999999&signature=x', window.location.href), null);
  assert.deepEqual(parseKycDocuments('invalid JSON'), []);
  assert.deepEqual(parseKycDocuments({ url: 'bad' }), []);
  assert.equal(parseKycDocuments(JSON.stringify([{ type: 'idDocument', url: signed('id.pdf') }])).length, 1);
});

test('upload validation and accepted formats match the server policy and size limits', () => {
  for (const [name, type] of [['id.pdf', 'application/pdf'], ['id.jpg', 'image/jpeg'], ['id.png', 'image/png'], ['id.webp', 'image/webp']]) assert.equal(kycUploadError({ name, type, size: 1024 }, 'idDocument'), null);
  for (const [name, type] of [['face.mp4', 'video/mp4'], ['face.webm', 'video/webm'], ['face.mov', 'video/quicktime'], ['face.jpg', 'image/jpeg']]) assert.equal(kycUploadError({ name, type, size: 1024 }, 'faceValidation'), null);
  for (const [name, type] of [['id.gif', 'image/gif'], ['id.avif', 'image/avif']]) assert.ok(kycUploadError({ name, type, size: 1 }, 'idDocument'));
  assert.ok(kycUploadError({ name: 'face.ogg', type: 'video/ogg', size: 1 }, 'faceValidation'));
  assert.ok(kycUploadError({ name: 'id.pdf', type: 'application/pdf', size: 10 * 1024 * 1024 + 1 }, 'idDocument'));
  assert.ok(kycUploadError({ name: 'face.mp4', type: 'video/mp4', size: 50 * 1024 * 1024 + 1 }, 'faceValidation'));
  assert.ok(KYC_ID_ACCEPT.includes('application/pdf'));
  assert.ok(KYC_FACE_ACCEPT.includes('video/quicktime'));
  assert.doesNotMatch(KYC_ID_ACCEPT, /image\/\*/);
});

test('a signed PDF uses its PDF viewer and preserves every signing parameter', async () => {
  const url = signed('id.PDF');
  respond = async () => new Response(null, { status: 200, headers: { 'Content-Type': 'application/pdf' } });
  await renderFile({ type: 'idDocument', url });
  assert.equal(container.querySelector('iframe').src, url);
  assert.equal(container.querySelector('img'), null);
  assert.equal(calls[0].options.method, 'HEAD');
  assert.equal(calls[0].options.cache, 'no-store');
});

test('images and MP4, WEBM, MOV use the correct viewers instead of image fallbacks', async () => {
  await renderFile({ type: 'idDocument', url: signed('id.jpg') });
  assert.ok(container.querySelector('img'));
  for (const ext of ['mp4', 'webm', 'mov']) {
    const url = signed('face.'+ext);
    await renderFile({ type: 'faceValidation', url });
    assert.equal(container.querySelector('video').src, url);
    assert.equal(container.querySelector('img'), null);
  }
  await act(async () => container.querySelector('video').dispatchEvent(new Event('error')));
  assert.match(container.textContent, /navegador no puede mostrar/);
  assert.ok(container.querySelector('a[download]'));
});

test('expired links and HTTP failures have explicit messages without attempting public paths', async () => {
  await renderFile({ type: 'idDocument', url: signed('id.pdf', 1) });
  assert.match(container.textContent, /ha caducado/);
  assert.equal(calls.length, 0);
  assert.equal(container.querySelector('iframe'), null);
  respond = async () => new Response(null, { status: 403 });
  await renderFile({ type: 'idDocument', url: signed('forbidden.pdf') });
  assert.match(container.textContent, /ha caducado o ya no es válido/);
  respond = async () => new Response(null, { status: 404 });
  await renderFile({ type: 'idDocument', url: signed('missing.pdf') });
  assert.match(container.textContent, /No se pudo cargar/);
  assert.doesNotMatch(container.textContent, /ha caducado/);
  respond = async () => { throw new Error('Network failure'); };
  await renderFile({ type: 'idDocument', url: signed('offline.pdf') });
  assert.match(container.textContent, /problema de conexión/);
});

test('an open viewer reports expiration once its signed URL expires', async context => {
  const expires = Math.floor(Date.now() / 1000) + 1;
  await renderFile({ type: 'idDocument', url: signed('timed.pdf', expires) });
  assert.ok(container.querySelector('iframe'));
  await act(async () => context.mock.timers.tick(999));
  assert.ok(container.querySelector('iframe'), 'The document remains visible just before expiration');
  assert.doesNotMatch(container.textContent, /ha caducado/);
  await act(async () => context.mock.timers.tick(1));
  assert.match(container.textContent, /ha caducado/);
  assert.equal(container.querySelector('iframe'), null);
});

const profile = docs => ({ id: 'profile', first_name: 'KYC', updated_at: '2026-11-18T18:00:00Z', verification_documents: docs });
test('renewal updates signed links through the authorized callback and handles failure', async () => {
  const old = { type: 'idDocument', url: signed('id.pdf', 1) };
  const fresh = { ...old, url: signed('id.pdf') };
  let fail = true;
  let renewals = 0;
  function Harness() {
    const [data, setData] = useState(profile(JSON.stringify([old])));
    return createElement(KYCReviewModal, { isOpen: true, kycData: data, onClose() {}, onApprove: async () => {}, onReject: async () => {}, onRefresh: async id => {
      assert.equal(id, 'profile'); renewals++;
      if (fail) throw new Error('Session unavailable');
      const next = profile([fresh]); setData(next); return next;
    } });
  }
  await render(createElement(Harness));
  await click('Renovar enlaces');
  assert.match(container.textContent, /No se pudieron renovar/);
  fail = false;
  await click('Renovar enlaces');
  assert.equal(renewals, 2);
  assert.equal(container.querySelector('iframe').src, fresh.url);
});

test('a late response for the previous file cannot replace the selected file', async () => {
  let finishOld;
  respond = url => url.includes('old.jpg') ? new Promise(resolve => { finishOld = resolve; }) : Promise.resolve(new Response(null, { status: 200 }));
  await renderFile({ type: 'idDocument', url: signed('old.jpg') });
  const next = signed('next.jpg');
  await renderFile({ type: 'idDocument', url: next });
  await act(async () => finishOld(new Response(null, { status: 200 })));
  assert.equal(container.querySelector('img').src, next);
});

test('the upload form accepts videos and previews them with a video element', async () => {
  await render(createElement(KYCUploadModal, { onClose() {}, onSuccess() {} }));
  const idInput = container.querySelector('input[type="file"]');
  assert.equal(idInput.accept, KYC_ID_ACCEPT);
  Object.defineProperty(idInput, 'files', { value: [new dom.window.File(['pdf'], 'id.pdf', { type: 'application/pdf' })] });
  await act(async () => idInput.dispatchEvent(new Event('change', { bubbles: true })));
  await click('Siguiente');
  const faceInput = container.querySelector('input[type="file"]');
  assert.equal(faceInput.accept, KYC_FACE_ACCEPT);
  Object.defineProperty(faceInput, 'files', { value: [new dom.window.File(['video'], 'face.mov', { type: 'video/quicktime' })] });
  await act(async () => faceInput.dispatchEvent(new Event('change', { bubbles: true })));
  assert.ok(container.querySelector('video[controls]'));
  assert.equal(container.querySelector('img'), null);
});

test('an unavailable camera API shows an inline error and keeps file upload available', async () => {
  const original = navigator.mediaDevices;
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
  try {
    await render(createElement(KYCUploadModal, { onClose() {}, onSuccess() {} }));
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, 'files', { value: [new dom.window.File(['pdf'], 'id.pdf', { type: 'application/pdf' })] });
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
    await click('Siguiente');
    assert.match(container.textContent, /No se pudo acceder a la cámara/);
    assert.ok(container.querySelector('input[type="file"]'));
    assert.equal([...container.querySelectorAll('button')].find(node => node.textContent.includes('Activar cámara')).disabled, false);
  } finally {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: original });
  }
});

test('returning to the camera step starts a fresh request without showing the previous error', async () => {
  const original = navigator.mediaDevices;
  let attempts = 0;
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: () => ++attempts === 1 ? Promise.reject(new Error('Permission denied')) : new Promise(() => {}) } });
  try {
    await render(createElement(KYCUploadModal, { onClose() {}, onSuccess() {} }));
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, 'files', { value: [new dom.window.File(['pdf'], 'id.pdf', { type: 'application/pdf' })] });
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
    await click('Siguiente');
    assert.match(container.textContent, /No se pudo acceder a la cámara/);
    await click('Atrás');
    await click('Siguiente');
    assert.equal(attempts, 2);
    assert.doesNotMatch(container.textContent, /No se pudo acceder a la cámara/);
    assert.match(container.textContent, /Iniciando/);
  } finally {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: original });
  }
});

test('a camera response arriving after selecting a file stops its stream instead of activating it', async () => {
  const original = navigator.mediaDevices;
  let resolveCamera;
  let stopped = 0;
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: () => new Promise(resolve => { resolveCamera = resolve; }) } });
  try {
    await render(createElement(KYCUploadModal, { onClose() {}, onSuccess() {} }));
    const input = container.querySelector('input[type="file"]');
    Object.defineProperty(input, 'files', { value: [new dom.window.File(['pdf'], 'id.pdf', { type: 'application/pdf' })] });
    await act(async () => input.dispatchEvent(new Event('change', { bubbles: true })));
    await click('Siguiente');
    const face = container.querySelector('input[type="file"]');
    Object.defineProperty(face, 'files', { value: [new dom.window.File(['photo'], 'face.jpg', { type: 'image/jpeg' })] });
    await act(async () => face.dispatchEvent(new Event('change', { bubbles: true })));
    await act(async () => resolveCamera({ getTracks: () => [{ stop() { stopped++; } }] }));
    assert.equal(stopped, 1);
    assert.match(container.textContent, /Cambiar foto o video/);
    assert.equal(container.querySelector('video'), null);
  } finally {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: original });
  }
});

test('the refresh API uses the authenticated administrative route', async () => {
  refreshedProfile = profile([]);
  assert.deepEqual(await getKycProfile('profile'), refreshedProfile);
  assert.equal(adminRequest.url, '/admin/kyc/profile');
  assert.equal(adminRequest.headers.Authorization, 'Bearer admin-token');
});
