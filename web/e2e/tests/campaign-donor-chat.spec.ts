import type {Page} from '@playwright/test';
import {DatabaseSync} from 'node:sqlite';
import {resolve} from 'node:path';
import {test,expect,fixtures as f,headers,data} from './fixtures';

function updateFixture(sql:string,...values:string[]) {
  const database=new DatabaseSync(resolve(process.env.UFM_E2E_RUNTIME!,'runtime.sqlite'));
  try { expect(database.prepare(sql).run(...values).changes).toBe(1); }
  finally {database.close();}
}
test.beforeEach(async({page,baseURL,request})=>{
  await page.route('**/*',route=>route.request().url().startsWith(baseURL!)?route.continue():route.abort());
  await data(await request.post('/api/v1/investments',{headers:headers(),data:{campaignId:f.campaigns.published,amount:100}}),201);
});
async function session(page:Page,role:'owner'|'admin') {
  await page.addInitScript(({user,role})=>{
    localStorage.setItem('accessToken',user.token);localStorage.setItem('userId',user.id);
    localStorage.setItem('userEmail',user.email);localStorage.setItem('userRole',role==='admin'?'admin':'entrepreneur');
    if(role==='admin')localStorage.setItem('adminAccessLevel','admin');
  },{user:f.accounts[role],role});
}
async function openDonor(page:Page,role:'owner'|'admin') {
  if(role==='owner')await page.locator('article').filter({has:page.getByText('QA published',{exact:true})}).getByRole('button',{name:'Vista Previa',exact:true}).click();
  else await page.getByRole('row').filter({has:page.getByText('QA published',{exact:true})}).getByTitle('Previsualizar Campaña',{exact:true}).click();
  await page.getByRole('dialog',{name:'QA published',exact:true}).getByRole('button',{name:/Donadores Activos/}).click();
  await page.getByRole('button',{name:'Ver detalle de Ana Prueba',exact:true}).click();
  return page.getByRole('dialog',{name:'Detalle del donador Ana Prueba',exact:true});
}
for(const role of ['owner','admin'] as const)test(`${role}: retry opens the right campaign chat and repeated visits reuse it`,async({page,request})=>{
  await session(page,role);
  const lists:string[]=[];
  page.on('request',request=>{if(new URL(request.url()).pathname.endsWith('/investors'))lists.push(new URL(request.url()).pathname);});
  let fail=true,calls=0,release!:()=>void;
  const gate=new Promise<void>(resolve=>{release=resolve;});
  await page.route('**/api/v1/chat/conversations',async route=>{
    if(route.request().method()!=='POST')return route.continue();
    calls++;
    expect(route.request().postDataJSON()).toMatchObject({otherUserId:f.accounts.donor.id,campaignId:f.campaigns.published});
    if(!fail)return route.continue();
    await gate;await route.fulfill({status:500,json:{message:'Synthetic internal error'}});
  });
  await page.goto(role==='owner'?'/entrepreneur-campaigns':'/admin/campaigns');
  const detail=await openDonor(page,role);
  expect(lists).toContain(`/api/v1/${role==='owner'?'entrepreneurs/me':'admin'}/campaigns/${f.campaigns.published}/investors`);
  if(role==='admin')expect(lists.some(path=>path.includes('/entrepreneurs/'))).toBe(false);
  await expect(detail.getByRole('button')).toHaveCount(2);
  await detail.getByRole('button',{name:'Enviar Mensaje',exact:true}).evaluate(button=>{button.click();button.click();});
  await expect(detail.getByRole('status')).toHaveText('Abriendo conversación...');expect(calls).toBe(1);
  release();await expect(detail.getByRole('alert')).toContainText('No se pudo abrir la conversación');
  await expect(detail).toBeVisible();
  fail=false;await detail.getByRole('button',{name:'Reintentar',exact:true}).click();
  await expect(page).toHaveURL(/\/chat\/[^/]+$/);
  await expect(page.getByPlaceholder('Escríbele a Ana...',{exact:true})).toBeVisible();
  const id=new URL(page.url()).pathname.split('/').at(-1);
  let conversations=await data(await request.get('/api/v1/chat/conversations',{headers:headers(role)}));
  expect(conversations).toHaveLength(1);expect(conversations[0]).toMatchObject({id,campaignId:f.campaigns.published,otherUser:{id:f.accounts.donor.id}});
  await page.goBack();await openDonor(page,role);
  await detail.getByRole('button',{name:'Enviar Mensaje',exact:true}).click();
  await expect(page).toHaveURL(new RegExp('/chat/'+id+'$'));
  conversations=await data(await request.get('/api/v1/chat/conversations',{headers:headers(role)}));
  expect(conversations).toHaveLength(1);expect(calls).toBe(3);
});

for(const change of ['inactive','private'] as const)test(`${change}: server permissions reject chat without losing the selected donor`,async({page,request})=>{
  await session(page,'owner');await page.goto('/entrepreneur-campaigns');
  const detail=await openDonor(page,'owner');
  if(change==='inactive')updateFixture('UPDATE users SET is_active = 0 WHERE id = ?',f.accounts.donor.id);
  else updateFixture("UPDATE campaigns SET status = 'draft' WHERE id = ?",f.campaigns.published);
  const denied=page.waitForResponse(response=>response.url().endsWith('/api/v1/chat/conversations')&&response.request().method()==='POST');
  await detail.getByRole('button',{name:'Enviar Mensaje',exact:true}).click();
  expect((await denied).status()).toBe(change==='inactive'?422:404);
  await expect(detail.getByRole('alert')).toBeVisible();await expect(detail).toBeVisible();
  expect(await data(await request.get('/api/v1/chat/conversations',{headers:headers('owner')}))).toHaveLength(0);
  if(change==='inactive')updateFixture('UPDATE users SET is_active = 1 WHERE id = ?',f.accounts.donor.id);
  else updateFixture("UPDATE campaigns SET status = 'published' WHERE id = ?",f.campaigns.published);
  await detail.getByRole('button',{name:'Reintentar',exact:true}).click();
  await expect(page).toHaveURL(/\/chat\/[^/]+$/);
  expect(await data(await request.get('/api/v1/chat/conversations',{headers:headers('owner')}))).toHaveLength(1);
});
