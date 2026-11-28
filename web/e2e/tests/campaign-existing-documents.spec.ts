import type { Page, APIRequestContext } from '@playwright/test';
import { test, expect, fixtures as f, headers, data } from './fixtures';

const base = '/api/v1/entrepreneurs/me/campaigns/' + f.campaigns.draft;
const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');

test.beforeEach(async ({ page, baseURL, request }) => {
  await page.route('**/*', route => route.request().url().startsWith(baseURL!) ? route.continue() : route.abort());
  await page.addInitScript(user => {
    localStorage.setItem('accessToken', user.token);
    localStorage.setItem('userId', user.id);
    localStorage.setItem('userEmail', user.email);
    localStorage.setItem('userRole', 'entrepreneur');
  }, f.accounts.owner);
  const categories = await data(await request.get('/api/v1/categories'));
  await data(await request.patch(base, {headers:headers('owner'), data:{
    categoryIds:[categories[0].id], endDate:null,
    shortDescription:'Resumen de campaña con respaldo',
    description:'Descripción suficientemente detallada para comprobar que editar una campaña conserva los documentos guardados y solo sube los nuevos.',
  }}));
});

async function openEditor(page: Page, entry: string, title = 'QA draft') {
  if (entry === '/entrepreneur-profile') await page.getByText(title, {exact:true}).click();
  else await page.locator('article').filter({has:page.getByText(title, {exact:true})}).getByRole('button', {name:'Vista Previa',exact:true}).click();
  await page.getByRole('dialog', {name:title,exact:true}).getByRole('button', {name:'Editar',exact:true}).click();
  await expect(page.getByRole('heading', {name:'Actualizar campaña',exact:true})).toBeVisible();
}

async function addNew(page: Page) {
  const form = page.locator('form').filter({has:page.locator('#title')});
  await form.locator('input[type="file"]:not(#cover-upload)').setInputFiles({name:'new.pdf',mimeType:'application/pdf',buffer:pdf});
  await form.getByPlaceholder('Ej. Cotización oficial del proveedor').fill('Documento nuevo de respaldo');
  await form.getByRole('button', {name:'Añadir Documento',exact:true}).click();
}

async function save(page: Page) {
  await page.getByRole('button', {name:'Guardar Borrador',exact:true}).click();
  await page.getByRole('button', {name:'Sí, guardar',exact:true}).click();
  await expect(page.getByRole('heading', {name:'Actualizar campaña',exact:true})).toHaveCount(0);
}

async function documents(request: APIRequestContext) {
  return data(await request.get(base+'/documents', {headers:headers('owner')}));
}

for (const entry of ['/entrepreneur-campaigns','/entrepreneur-profile']) {
  test(`${entry}: edit with existing evidence, add only new files and reopen`, async ({page,request}) => {
    const saved = await data(await request.post(base+'/documents', {headers:headers('owner'), multipart:{
      file:{name:'saved.pdf',mimeType:'application/pdf',buffer:pdf}, justification:'Respaldo guardado previamente',
    }}),201);
    const approved = entry === '/entrepreneur-profile';
    if (approved) await data(await request.patch(`/api/v1/admin/campaigns/${f.campaigns.draft}/documents/${saved.id}/review`, {
      headers:headers('admin'), data:{status:'approved',reviewerNotes:'Revisado para la prueba'},
    }));
    const original = (await documents(request))[0];
    let writes = 0, uploads = 0;
    await page.route('**'+base, async route => {
      if (route.request().method() === 'PATCH') writes++;
      await route.continue();
    });
    await page.route('**'+base+'/documents', async route => {
      if (route.request().method() === 'POST') uploads++;
      await route.continue();
    });
    await page.goto(entry);
    await openEditor(page,entry);
    const region = page.getByRole('region', {name:'Documentos guardados',exact:true});
    await expect(region.getByText('saved.pdf',{exact:true})).toBeVisible();
    await expect(region.getByText(approved ? 'Aprobado' : 'Pendiente de revisión',{exact:true})).toBeVisible();
    await expect(region.getByText('Respaldo guardado previamente',{exact:true})).toBeVisible();
    if (approved) await expect(region).toContainText('Revisado para la prueba');
    const download = await region.getByRole('link', {name:'Abrir documento'}).getAttribute('href');
    expect((await request.get(download!)).status()).toBe(200);
    await expect(page.getByRole('region', {name:'Documentos nuevos',exact:true})).toContainText('No hay documentos nuevos seleccionados');
    const title = 'Campaña con documentos conservados';
    await page.locator('#title').fill(title);
    await save(page);
    expect([writes,uploads]).toEqual([1,0]);
    expect(await documents(request)).toHaveLength(1);
    await openEditor(page,entry,title);
    await expect(region.getByText('saved.pdf',{exact:true})).toBeVisible();
    await addNew(page);
    await expect(page.getByRole('region', {name:'Documentos nuevos',exact:true})).toContainText('new.pdf');
    await expect(region).not.toContainText('new.pdf');
    await save(page);
    expect([writes,uploads]).toEqual([2,1]);
    const after = await documents(request);
    expect(after).toHaveLength(2);
    const retained = after.find(doc => doc.id === original.id);
    for (const field of ['id','campaign_id','original_name','justification','status','reviewer_notes','created_at']) expect(retained[field]).toEqual(original[field]);
    expect(new URL(retained.file_url,'http://localhost').pathname).toBe(new URL(original.file_url,'http://localhost').pathname);
    await openEditor(page,entry,title);
    await expect(region.getByRole('listitem')).toHaveCount(2);
    await expect(page.getByRole('region', {name:'Documentos nuevos',exact:true})).toContainText('No hay documentos nuevos seleccionados');
    if (approved) {
      await page.getByRole('button', {name:'Enviar a Revisión',exact:true}).click();
      await page.getByRole('button', {name:'Sí, enviar',exact:true}).click();
      await expect(page.getByRole('heading', {name:'Actualizar campaña',exact:true})).toHaveCount(0);
      expect([writes,uploads]).toEqual([3,1]);
      expect(await documents(request)).toHaveLength(2);
      expect((await data(await request.get(base,{headers:headers('owner')}))).status).toBe('pending_review');
    }
  });

  test(`${entry}: failed document lookup is recoverable without losing edits or queued files`, async ({page,request}) => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => {release=resolve;});
    let fail = true;
    await page.route('**'+base+'/documents', async route => {
      if (route.request().method() !== 'GET' || !fail) return route.continue();
      await gate;
      await route.fulfill({status:503,json:{message:'Synthetic lookup failure'}});
    });
    await page.goto(entry);
    await openEditor(page,entry);
    const region = page.getByRole('region', {name:'Documentos guardados',exact:true});
    await expect(region.getByRole('status')).toContainText('Cargando documentos guardados');
    await expect(page.getByRole('button', {name:'Guardar Borrador',exact:true})).toBeDisabled();
    const title = 'Cambios conservados tras reintentar';
    await page.locator('#title').fill(title);
    await addNew(page);
    release();
    await expect(region.getByRole('alert')).toContainText('No se pudieron cargar');
    await expect(region).not.toContainText('no tiene documentos guardados');
    fail = false;
    await region.getByRole('button', {name:'Reintentar carga de documentos',exact:true}).click();
    await expect(region).toContainText('Esta campaña no tiene documentos guardados');
    await expect(page.locator('#title')).toHaveValue(title);
    await expect(page.getByRole('region', {name:'Documentos nuevos',exact:true})).toContainText('new.pdf');
    await save(page);
    expect(await documents(request)).toHaveLength(1);
    expect((await data(await request.get(base,{headers:headers('owner')}))).title).toBe(title);
  });
}
