import test, { beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import ts from 'typescript';
import { JSDOM } from 'jsdom';
import { act, createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' });
for (const name of [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'Node',
  'MouseEvent',
  'Event',
  'File',
])
  Object.defineProperty(globalThis, name, { value: dom.window[name], configurable: true });
globalThis.FileReader = class {
  result = 'data:image/png;base64,Zml4dHVyZQ==';
  readAsDataURL() {
    this.onloadend?.();
  }
};
globalThis.localStorage = dom.window.localStorage;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { createRoot } = await import('react-dom/client');
const virtual = (name) => new URL('./__saving_' + name + '.mjs', import.meta.url).href;
const shells = [
  'Navbar',
  'CampaignCard',
  'CampaignPreviewModal',
  'PublishUpdateModal',
  'KYCUploadModal',
];
const apiNames = [
  'getAllMyCampaigns',
  'getMyCampaignById',
  'getCampaignDocuments',
  'createCampaign',
  'updateCampaign',
  'submitCampaignForReview',
  'publishCampaign',
  'uploadCampaignImage',
  'deleteCampaign',
  'finalizeCampaign',
  'uploadCampaignDocument',
];
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('/campaign.api')) return { url: virtual('api'), shortCircuit: true };
    if (specifier.endsWith('/categories.api'))
      return { url: virtual('categories'), shortCircuit: true };
    if (specifier.endsWith('/useEntrepreneurProfile'))
      return { url: virtual('profile'), shortCircuit: true };
    const shell = shells.find((name) => specifier.endsWith('/' + name));
    if (shell) return { url: virtual(shell), shortCircuit: true };
    if (specifier.startsWith('.') && context.parentURL?.includes('/frontend/src/'))
      for (const ext of ['.ts', '.tsx']) {
        const url = new URL(specifier + ext, context.parentURL);
        if (existsSync(url)) return { url: url.href, shortCircuit: true };
      }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    let source;
    if (url === virtual('api'))
      source = apiNames
        .map((name) => `export const ${name}=(...args)=>globalThis.__savingApi.${name}(...args);`)
        .join('\n');
    else if (url === virtual('categories'))
      source = 'export const getCategories=()=>globalThis.__savingCategories();';
    else if (url === virtual('profile'))
      source =
        'export function useEntrepreneurProfile(){return {profile:{identityVerified:true}};}';
    else if (url === virtual('CampaignCard'))
      source =
        "import {createElement} from 'react'; export function CampaignCard({campaign,onPreview}){return createElement('button',{onClick:()=>onPreview(campaign)},'Vista previa de prueba');}";
    else if (url === virtual('CampaignPreviewModal'))
      source =
        "import {createElement} from 'react'; export function CampaignPreviewModal({open,campaign,onEdit}){return open?createElement('button',{onClick:()=>onEdit(campaign)},'Editar desde vista previa'):null;}";
    else {
      const shell = shells.find((name) => url === virtual(name));
      if (shell) source = `export function ${shell}(){return null;}`;
    }
    if (source) return { format: 'module', shortCircuit: true, source };
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
const { MyCampaignsPage } = await import('../src/pages/MyCampaignsPage.tsx');
const { CampaignForm } = await import('../src/components/CampaignForm.tsx');
const { useCampaigns } = await import('../src/hooks/useCampaigns.ts');
const { CampaignUploadSession } = await import('../src/utils/campaignUploads.ts');
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};
const originalError = console.error;
let root, container, campaign, gate, mutations, uploads, latest, errors;
beforeEach(() => {
  globalThis.__savingCategories = async () => [{ id: 'category', displayName: 'Tecnología' }];
  errors = [];
  console.error = (...args) => errors.push(args);
  campaign = {
    id: 'existing',
    campaignType: 'donation',
    status: 'draft',
    title: 'Campaña de prueba',
    description:
      'Descripción suficientemente completa para guardar la campaña durante las pruebas de creación y edición.',
    shortDescription: 'Eslogan de prueba válido',
    goalAmount: 1000,
    currentAmount: 0,
    categoryIds: ['category'],
    rewardTiers: [],
    endDate: null,
  };
  gate = deferred();
  mutations = [];
  uploads = [];
  const save = async (mode, dto) => {
    mutations.push({ mode, dto });
    await gate.promise;
    campaign = { ...campaign, ...dto, id: mode === 'create' ? 'created' : campaign.id };
    return campaign;
  };
  globalThis.__savingApi = {
    getAllMyCampaigns: async () => ({
      data: [campaign],
      meta: { totalItems: 1, totalPages: 1, currentPage: 1, itemsPerPage: 100, itemCount: 1 },
    }),
    getMyCampaignById: async () => campaign,
    getCampaignDocuments: async () => [],
    createCampaign: (dto) => save('create', dto),
    updateCampaign: (_id, dto) => save('edit', dto),
    uploadCampaignImage: async (...args) => uploads.push({ kind: 'cover', args }),
    uploadCampaignDocument: async (...args) => uploads.push({ kind: 'document', args }),
  };
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  try {
    await act(async () => root.unmount());
    container.remove();
    assert.deepEqual(
      errors.filter((args) => !/^Error (creating|updating) campaign/.test(String(args[0]))),
      [],
    );
  } finally {
    console.error = originalError;
  }
});
after(() => dom.window.close());
const mount = (Component) =>
  act(async () => root.render(createElement(MemoryRouter, null, createElement(Component))));
const button = (text) =>
  [...container.querySelectorAll('button')].find((node) => node.textContent.trim() === text);
const click = async (node) => {
  assert.ok(node);
  await act(async () =>
    node.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })),
  );
};
const fill = async (selector, value) =>
  act(async () => {
    const node = container.querySelector(selector);
    assert.ok(node, selector);
    const proto =
      node.tagName === 'TEXTAREA'
        ? dom.window.HTMLTextAreaElement.prototype
        : dom.window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(node, value);
    node.dispatchEvent(new Event('input', { bubbles: true }));
  });
const choose = async (selector, file) =>
  act(async () => {
    const node = container.querySelector(selector);
    Object.defineProperty(node, 'files', { configurable: true, value: [file] });
    node.dispatchEvent(new Event('change', { bubbles: true }));
  });
async function prepare(mode) {
  await mount(MyCampaignsPage);
  if (mode === 'edit') {
    await click(button('Vista previa de prueba'));
    await click(button('Editar desde vista previa'));
  } else {
    await click(button('Lanzar Campaña'));
    await fill('#title', campaign.title);
    await fill('#description', campaign.description);
    await fill('#shortDescription', campaign.shortDescription);
    await click(container.querySelector('input[type="checkbox"]'));
  }
  const cover = new File(['cover'], 'cover.png', { type: 'image/png' });
  const document = new File(['document'], 'support.pdf', { type: 'application/pdf' });
  await choose('#cover-upload', cover);
  await choose('input[type="file"]:not(#cover-upload)', document);
  await fill(
    'input[placeholder="Ej. Cotización oficial del proveedor"]',
    'Justificación conservada',
  );
  await click(button('Añadir Documento'));
  return { cover, document };
}
const submit = () =>
  act(async () =>
    container
      .querySelector('form')
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
  );
async function confirmTwice() {
  const confirm = button('Sí, guardar');
  assert.ok(confirm);
  await act(async () => {
    confirm.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    confirm.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}
const failure = (status) =>
  new axios.AxiosError(
    'Fixture failure',
    'ERR_BAD_RESPONSE',
    {},
    null,
    status
      ? {
          status,
          data: {
            message:
              status === 422
                ? 'Revisa el título de la campaña'
                : 'No se pudo guardar la campaña por un error del servidor.',
          },
        }
      : undefined,
  );

for (const mode of ['create', 'edit'])
  for (const status of [422, 500, 0]) {
    test(`${mode}: ${status || 'network'} preserves fields and files, blocks duplicates and permits a successful retry`, async () => {
      const files = await prepare(mode);
      await submit();
      await confirmTwice();
      assert.equal(mutations.length, 1);
      assert.equal(container.querySelector('form').getAttribute('aria-busy'), 'true');
      assert.equal(container.querySelector('#title').matches(':disabled'), true);
      assert.equal(button('Descartar').disabled, true);
      assert.match(container.querySelector('[role="status"]').textContent, /Guardando/);
      await submit();
      assert.equal(mutations.length, 1);
      assert.equal(button('Sí, guardar'), undefined);
      await act(async () => gate.reject(failure(status)));
      const alert = container.querySelector('[role="alert"]');
      assert.ok(alert);
      assert.match(
        alert.textContent,
        status === 422 ? /Revisa el título/ : status === 500 ? /error del servidor/ : /conectar/,
      );
      assert.equal(document.activeElement, alert);
      assert.equal(container.querySelector('#title').value, campaign.title);
      assert.equal(container.querySelector('#cover-upload').files[0], files.cover);
      assert.match(container.textContent, /support.pdf/);
      assert.match(container.textContent, /Justificación conservada/);
      assert.equal(button('Guardar Borrador').disabled, false);
      assert.deepEqual(uploads, []);
      await fill('#title', 'Campaña corregida');
      gate = deferred();
      await submit();
      await confirmTwice();
      assert.equal(mutations.length, 2);
      assert.equal(container.querySelector('[role="alert"]'), null);
      await act(async () => gate.resolve());
      assert.equal(container.querySelector('form'), null);
      assert.equal(mutations[1].dto.title, 'Campaña corregida');
      assert.equal(uploads.length, 2);
      assert.equal(uploads[0].args[1], files.cover);
      assert.equal(uploads[1].args[1], files.document);
    });
  }

function Harness() {
  latest = useCampaigns();
  return null;
}
for (const operation of ['create', 'edit']) {
  test(`the hook rejects a second save before ${operation} has settled`, async () => {
    await mount(Harness);
    let first, second;
    await act(async () => {
      first =
        operation === 'create'
          ? latest.addCampaign(campaign)
          : latest.updateCampaign(campaign.id, campaign);
      second =
        operation === 'create'
          ? latest.updateCampaign(campaign.id, campaign)
          : latest.addCampaign(campaign);
    });
    assert.equal(await second, operation === 'create' ? false : null);
    assert.equal(mutations.length, 1);
    assert.equal(latest.adding, true);
    await act(async () => {
      gate.resolve();
      await first;
    });
    assert.equal(latest.adding, false);
  });
}

test('discarding after an error and opening a new campaign clears the old save error', async () => {
  await prepare('create');
  await submit();
  await confirmTwice();
  await act(async () => gate.reject(failure(422)));
  assert.ok(container.querySelector('[role="alert"]'));
  await click(button('Descartar'));
  await click(button('Sí, descartar'));
  assert.equal(container.querySelector('form'), null);
  await click(button('Lanzar Campaña'));
  assert.equal(container.querySelector('[role="alert"]'), null);
  assert.equal(container.querySelector('#title').value, '');
});

test('an unexpected callback rejection is recoverable and does not close the editor', async () => {
  let closes = 0;
  function Editor() {
    return createElement(CampaignForm, {
      initialData: campaign,
      saving: false,
      saveError: null,
      onCancel() {
        closes++;
      },
      async onSuccess() {
        throw new Error('Fallo inesperado de guardado');
      },
    });
  }
  await mount(Editor);
  await choose('input[type="file"]:not(#cover-upload)', new File(['fixture'], 'support.pdf'));
  await fill('input[placeholder="Ej. Cotización oficial del proveedor"]', 'Documento de prueba');
  await click(button('Añadir Documento'));
  await submit();
  await confirmTwice();
  assert.match(container.querySelector('[role="alert"]').textContent, /Fallo inesperado/);
  assert.equal(closes, 0);
  assert.equal(button('Guardar Borrador').disabled, false);
});

test('late category options preserve an edited field and the original category selection', async () => {
  const categories = deferred();
  globalThis.__savingCategories = () => categories.promise;
  function Editor() {
    return createElement(CampaignForm, {
      initialData: campaign,
      saving: false,
      saveError: null,
      onCancel() {},
      async onSuccess() {
        return false;
      },
    });
  }
  await mount(Editor);
  await fill('#title', 'Cambios antes de cargar las categorías');
  await act(async () => categories.resolve([{ id: 'category', displayName: 'Tecnología' }]));
  assert.equal(container.querySelector('#title').value, 'Cambios antes de cargar las categorías');
  assert.equal(container.querySelector('input[type="checkbox"]').checked, true);
});

for (const mode of ['create', 'edit']) {
  test(`${mode}: partial uploads retry only pending files on the saved campaign`, async () => {
    const files = await prepare(mode);
    const extra = new File(['other'], 'other.pdf', { type: 'application/pdf' });
    await choose('input[type="file"]:not(#cover-upload)', extra);
    await fill('input[placeholder="Ej. Cotización oficial del proveedor"]', 'Otro respaldo');
    await click(button('Añadir Documento'));
    let covers = 0, pending = 0;
    globalThis.__savingApi.uploadCampaignImage = async (...args) => {
      uploads.push({ kind: 'cover', args });
      if (++covers === 1) throw failure(500);
    };
    globalThis.__savingApi.uploadCampaignDocument = async (...args) => {
      uploads.push({ kind: 'document', args });
      if (args[1] === extra && ++pending < 3) throw failure(500);
    };
    await submit();
    await confirmTwice();
    await act(async () => gate.resolve());
    assert.match(container.textContent, /Datos de campaña guardados/);
    assert.match(container.querySelector('[role="alert"]').textContent, /archivos pendientes/);
    assert.equal(container.querySelector('#title').matches(':disabled'), true);
    assert.equal(container.querySelector('#cover-upload').files[0], files.cover);
    assert.equal(uploads.length, 3);
    assert.equal(mutations.length, 1);
    await click(button('Reintentar subidas pendientes'));
    assert.equal(uploads.length, 5);
    assert.ok(button('Reintentar subidas pendientes'));
    await click(button('Reintentar subidas pendientes'));
    assert.equal(container.querySelector('form'), null);
    assert.equal(mutations.length, 1);
    assert.equal(uploads.length, 6);
    assert.equal(uploads.filter(upload => upload.args[1] === files.document).length, 1);
    const attempts = uploads.filter(upload => upload.args[1] === extra);
    assert.equal(new Set(attempts.map(upload => upload.args[3])).size, 1);
    assert.match(attempts[0].args[3], /^[a-f0-9-]{36}$/);
    assert.ok(uploads.every(upload => upload.args[0] === (mode === 'create' ? 'created' : 'existing')));
  });
}

test('closing partial progress requires confirmation and a new editor starts a new save', async () => {
  await prepare('create');
  globalThis.__savingApi.uploadCampaignImage = async () => { throw failure(500); };
  await submit();
  await confirmTwice();
  await act(async () => gate.resolve());
  await click(button('Cerrar y conservar campaña'));
  assert.match(container.textContent, /¿Cerrar el editor\?/);
  assert.ok(container.querySelector('form'));
  await click(button('Sí, cerrar'));
  assert.equal(container.querySelector('form'), null);
  await click(button('Lanzar Campaña'));
  assert.equal(container.querySelector('[aria-label="Estado de las subidas"]'), null);
  assert.equal(container.querySelector('#title').value, '');
  assert.equal(container.querySelector('#title').matches(':disabled'), false);
  assert.equal(mutations.length, 1);
});

test('review retries reuse completed uploads and the same saved campaign', async () => {
  let reviews = 0, closes = 0;
  function Editor() {
    const state = useCampaigns();
    return createElement(CampaignForm, {
      initialData: campaign, saving: state.adding, saveError: state.addError,
      saveProgress: state.saveProgress, onCancel() { closes++; },
      onSuccess: (dto, cover, docs) => state.updateCampaign(campaign.id, dto, cover, docs),
      async onSubmitForReview(dto, cover, docs) {
        if (!await state.updateCampaign(campaign.id, dto, cover, docs)) return false;
        return ++reviews > 1;
      },
    });
  }
  await mount(Editor);
  await choose('input[type="file"]:not(#cover-upload)', new File(['fixture'], 'support.pdf'));
  await fill('input[placeholder="Ej. Cotización oficial del proveedor"]', 'Documento de prueba');
  await click(button('Añadir Documento'));
  await click(button('Enviar a Revisión'));
  await click(button('Sí, enviar'));
  await act(async () => gate.resolve());
  assert.equal(reviews, 1);
  assert.equal(closes, 0);
  await click(button('Reintentar envío a revisión'));
  assert.equal(reviews, 2);
  assert.equal(closes, 1);
  assert.equal(mutations.length, 1);
  assert.equal(uploads.length, 1);
});

test('same-named documents retain separate identities and progress snapshots', async () => {
  const file = new File(['fixture'], 'same.pdf');
  const session = new CampaignUploadSession('saved', undefined, [
    { file, justification: 'Primero' }, { file, justification: 'Segundo' },
  ]);
  const initial = session.progress;
  const calls = [];
  let fail = true;
  const api = {
    async cover() {},
    async document(...args) {
      calls.push(args);
      if (fail && args[2] === 'Segundo') throw failure(500);
    },
  };
  await session.upload(api, () => {});
  assert.equal(session.progress.complete, false);
  assert.equal(initial.files[0].status, 'pending');
  assert.notEqual(calls[0][3], calls[1][3]);
  fail = false;
  await session.upload(api, () => {});
  assert.equal(session.progress.complete, true);
  assert.equal(calls.length, 3);
  assert.equal(calls[1][3], calls[2][3]);
});

test('unmount cancellation aborts the active upload and prevents queued files', async () => {
  const file = new File(['fixture'], 'support.pdf');
  const session = new CampaignUploadSession('saved', file, [{file, justification:'Respaldo'}]);
  let documentCalls = 0, updates = 0;
  await session.upload({
    async cover(_id, _file, signal) {
      session.cancel();
      assert.equal(signal.aborted, true);
      throw new Error('Aborted');
    },
    async document() { documentCalls++; },
  }, () => updates++);
  assert.equal(documentCalls, 0);
  assert.equal(updates, 1);
});

const savedDocument = (status = 'approved') => ({
  id: 'saved-document', campaign_id: 'existing', original_name: 'saved.pdf',
  file_url: '/api/v1/private-files/documents/saved.pdf?expires=123&signature=receipt',
  justification: 'Respaldo que ya estaba guardado', status,
  reviewer_notes: 'Observación de revisión',
});
async function openExisting() {
  await mount(MyCampaignsPage);
  await click(button('Vista previa de prueba'));
  await click(button('Editar desde vista previa'));
}

for (const status of ['pending', 'approved']) {
  test(`an existing ${status} document permits editing without uploading it again`, async () => {
    const saved = savedDocument(status);
    globalThis.__savingApi.getCampaignDocuments = async id => {
      assert.equal(id, 'existing');
      return [saved];
    };
    await openExisting();
    const region = container.querySelector('[aria-label="Documentos guardados"]');
    assert.match(region.textContent, /saved.pdf/);
    assert.match(region.textContent, /Respaldo que ya estaba guardado/);
    assert.match(region.textContent, status === 'pending' ? /Pendiente de revisión/ : /Aprobado/);
    assert.match(region.textContent, /Observación de revisión/);
    assert.equal(region.querySelector('a').getAttribute('href'), saved.file_url);
    assert.equal(region.querySelectorAll('button[aria-label^="Quitar"]').length, 0);
    await fill('#title', 'Título corregido sin subir archivos');
    await submit();
    await confirmTwice();
    await act(async () => gate.resolve());
    assert.equal(container.querySelector('form'), null);
    assert.equal(mutations.length, 1);
    assert.equal(mutations[0].dto.title, 'Título corregido sin subir archivos');
    assert.deepEqual(uploads, []);
  });
}

test('existing and new documents remain separate and only new files are uploaded', async () => {
  const saved = savedDocument();
  globalThis.__savingApi.getCampaignDocuments = async () => [saved];
  const files = await prepare('edit');
  assert.match(container.querySelector('[aria-label="Documentos guardados"]').textContent, /saved.pdf/);
  assert.match(container.querySelector('[aria-label="Documentos nuevos"]').textContent, /support.pdf/);
  await submit();
  await confirmTwice();
  await act(async () => gate.resolve());
  assert.equal(uploads.length, 2);
  assert.equal(uploads[1].args[1], files.document);
  assert.equal(saved.id, 'saved-document');
});

test('loading and failure are distinct from empty documents, and retry preserves edits and new files', async () => {
  const pending = deferred();
  globalThis.__savingApi.getCampaignDocuments = () => pending.promise;
  const files = await prepare('edit');
  const saved = () => container.querySelector('[aria-label="Documentos guardados"]');
  assert.match(saved().textContent, /Cargando documentos guardados/);
  assert.doesNotMatch(saved().textContent, /no tiene documentos/);
  assert.equal(button('Guardar Borrador').disabled, true);
  await fill('#title', 'Título conservado durante la consulta');
  await submit();
  assert.equal(button('Sí, guardar'), undefined);
  await act(async () => pending.reject(failure(500)));
  assert.match(saved().textContent, /No se pudieron cargar/);
  assert.doesNotMatch(saved().textContent, /no tiene documentos/);
  assert.equal(button('Guardar Borrador').disabled, true);
  globalThis.__savingApi.getCampaignDocuments = async () => [savedDocument()];
  await click(button('Reintentar carga de documentos'));
  assert.equal(container.querySelector('#title').value, 'Título conservado durante la consulta');
  assert.equal(container.querySelector('#cover-upload').files[0], files.cover);
  assert.match(container.querySelector('[aria-label="Documentos nuevos"]').textContent, /support.pdf/);
  assert.equal(button('Guardar Borrador').disabled, false);
  await submit();
  await confirmTwice();
  await act(async () => gate.resolve());
  assert.equal(uploads.length, 2);
});

for (const status of ['rejected', 'unknown', 'empty']) {
  test(`${status} documents do not satisfy the supporting-document requirement`, async () => {
    globalThis.__savingApi.getCampaignDocuments = async () => status === 'empty' ? [] : [savedDocument(status)];
    await openExisting();
    const region = container.querySelector('[aria-label="Documentos guardados"]');
    assert.match(region.textContent, status === 'rejected' ? /Rechazado/ : status === 'unknown' ? /Estado no reconocido/ : /no tiene documentos guardados/);
    await submit();
    assert.equal(button('Sí, guardar'), undefined);
    assert.match(container.textContent, /Debes adjuntar al menos un documento/);
    assert.deepEqual(mutations, []);
    assert.deepEqual(uploads, []);
  });
}

test('refresh renews saved links without resetting edits or queued files', async () => {
  let calls = 0;
  globalThis.__savingApi.getCampaignDocuments = async () => [{...savedDocument(), file_url: '/receipt-'+(++calls)}];
  const files = await prepare('edit');
  await fill('#description', 'Descripción corregida que debe conservarse al actualizar los documentos de respaldo.');
  await click(button('Actualizar documentos guardados'));
  assert.equal(container.querySelector('[aria-label="Documentos guardados"] a').getAttribute('href'), '/receipt-2');
  assert.match(container.querySelector('#description').value, /Descripción corregida/);
  assert.equal(container.querySelector('#cover-upload').files[0], files.cover);
  assert.match(container.querySelector('[aria-label="Documentos nuevos"]').textContent, /support.pdf/);
});

test('a late document response from a closed editor cannot replace another campaign', async () => {
  const old = deferred();
  globalThis.__savingApi.getCampaignDocuments = id => id === 'existing' ? old.promise : Promise.resolve([{...savedDocument(), original_name:'current.pdf', campaign_id:id}]);
  await openExisting();
  await click(button('Descartar'));
  await click(button('Sí, descartar'));
  campaign = {...campaign, id:'another'};
  await click(button('Vista previa de prueba'));
  await click(button('Editar desde vista previa'));
  await act(async () => old.resolve([savedDocument()]));
  const region = container.querySelector('[aria-label="Documentos guardados"]');
  assert.match(region.textContent, /current.pdf/);
  assert.doesNotMatch(region.textContent, /saved.pdf/);
});

test('a new campaign never queries saved documents and still requires a new file', async () => {
  let queries = 0;
  globalThis.__savingApi.getCampaignDocuments = async () => { queries++; return []; };
  await mount(MyCampaignsPage);
  await click(button('Lanzar Campaña'));
  await fill('#title', campaign.title);
  await fill('#description', campaign.description);
  await fill('#shortDescription', campaign.shortDescription);
  await click(container.querySelector('input[type="checkbox"]'));
  assert.equal(container.querySelector('[aria-label="Documentos guardados"]'), null);
  await submit();
  assert.equal(button('Sí, guardar'), undefined);
  assert.match(container.textContent, /Debes adjuntar al menos un documento/);
  assert.equal(queries, 0);
  assert.deepEqual(mutations, []);
});
