import type { Page } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import {test,expect,fixtures as f,data} from './fixtures';

test.beforeEach(async({page,baseURL})=>{
  await page.route('**/*',route=>route.request().url().startsWith(baseURL!)?route.continue():route.abort());
  // Only the disposable per-test database is changed to provide both modalities.
  const database=new DatabaseSync(resolve(process.env.UFM_E2E_RUNTIME!,'runtime.sqlite'));
  try {
    expect(database.prepare("UPDATE campaigns SET campaign_type = 'reward' WHERE id = ?").run(f.campaigns.funded).changes).toBe(1);
  } finally { database.close(); }
});

function responseFor(page:Page,type:string,limit='12') {
  return page.waitForResponse(response=>{
    const url=new URL(response.url());
    return url.pathname==='/api/v1/campaigns/public' && url.searchParams.get('limit')===limit && (url.searchParams.get('campaignType')??'')===type;
  });
}
async function expectSelection(page:Page,type:string) {
  expect(new URL(page.url()).searchParams.get('campaignType')??'').toBe(type);
  await expect(page.getByRole('combobox',{name:'Filtrar por modalidad',exact:true})).toHaveValue(type);
}
for(const [label,type,title] of [
  ['Campañas de Donación','donation','QA published'],
  ['Campañas de Recompensa','reward','QA funded'],
]) test(`${label}: footer URL, selection, API results and reload agree`,async({page})=>{
  await page.goto('/');
  const link=page.getByRole('contentinfo').getByRole('link',{name:label,exact:true});
  await expect(link).toHaveAttribute('href','/explore?campaignType='+type);
  const received=responseFor(page,type);
  await link.click();
  const response=await received;
  const result=await data(response);
  expect(result.data.length).toBeGreaterThan(0);expect(result.data.every(row=>row.campaignType===type)).toBe(true);
  expect(new URL(response.url()).searchParams.has('type')).toBe(false);
  await expectSelection(page,type);
  await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:type==='reward'?'QA published':'QA funded',exact:true})).toHaveCount(0);
  const reloaded=responseFor(page,type);await page.reload();
  expect((await data(await reloaded)).data.every(row=>row.campaignType===type)).toBe(true);
  await expectSelection(page,type);await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
});

test('changing footer modality on the catalog and browser back/forward restore URL, controls and results',async({page})=>{
  await page.goto('/explore?campaignType=donation');
  await expectSelection(page,'donation');
  let received=responseFor(page,'reward');
  await page.getByRole('contentinfo').getByRole('link',{name:'Campañas de Recompensa',exact:true}).click();
  await received;await expectSelection(page,'reward');
  await expect(page.getByRole('heading',{name:'QA funded',exact:true})).toBeVisible();
  received=responseFor(page,'donation');await page.goBack();await received;
  await expectSelection(page,'donation');await expect(page.getByRole('heading',{name:'QA published',exact:true})).toBeVisible();
  received=responseFor(page,'reward');await page.goForward();await received;
  await expectSelection(page,'reward');await expect(page.getByRole('heading',{name:'QA published',exact:true})).toHaveCount(0);
});

test('changing modality resets the page, preserves filters and clearing them can be undone with back',async({page,request})=>{
  const categories=await data(await request.get('/api/v1/categories'));
  const url=new URLSearchParams({campaignType:'donation',page:'2',limit:'1',q:'QA',categoryId:categories[0].id,sortBy:'goal_amount',sortOrder:'ASC'});
  await page.goto('/explore?'+url);
  const search=page.getByPlaceholder('Buscar campañas...', {exact:true});
  await expect(search).toHaveValue('QA');
  let received=responseFor(page,'reward','1');
  await page.getByRole('combobox',{name:'Filtrar por modalidad',exact:true}).selectOption('reward');
  const response=await received;const query=new URL(response.url()).searchParams;
  expect(query.get('page')).toBe('1');
  for(const key of ['limit','q','categoryId','sortBy','sortOrder'])expect(query.get(key)).toBe(url.get(key));
  await expectSelection(page,'reward');expect(new URL(page.url()).searchParams.has('page')).toBe(false);
  received=responseFor(page,'donation','1');await page.goBack();await received;
  expect(new URL(page.url()).searchParams.get('page')).toBe('2');await expectSelection(page,'donation');await expect(search).toHaveValue('QA');
  received=responseFor(page,'reward','1');await page.goForward();await received;
  await search.fill('sin coincidencias del catálogo');
  received=responseFor(page,'reward','1');
  await search.press('Enter');expect((await data(await received)).data).toHaveLength(0);
  await expect(page.getByRole('heading',{name:'Sin Resultados',exact:true})).toBeVisible();
  received=responseFor(page,'','1');await page.getByRole('button',{name:'Limpiar filtros',exact:true}).click();await received;
  await expectSelection(page,'');await expect(search).toHaveValue('');
  for(const key of ['q','categoryId','page','campaignType'])expect(new URL(page.url()).searchParams.has(key)).toBe(false);
  received=responseFor(page,'reward','1');await page.goBack();await received;
  await expectSelection(page,'reward');await expect(search).toHaveValue('sin coincidencias del catálogo');
  await expect(page.getByRole('heading',{name:'Sin Resultados',exact:true})).toBeVisible();
});
