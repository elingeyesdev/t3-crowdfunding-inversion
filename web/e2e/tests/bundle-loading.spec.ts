import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Page } from '@playwright/test';
import { test, expect, fixtures as f } from './fixtures';

const build = resolve('public/build');
const manifest = JSON.parse(readFileSync(resolve(build, 'manifest.json'), 'utf8'));
const inventory: Record<string, string[]> = JSON.parse(
  readFileSync(resolve(build, 'bundle-modules.json'), 'utf8'),
);
const exploreAsset = manifest['frontend/src/pages/ExploreCampaignsPage.tsx'].file;

function requestedModules(page: Page) {
  const modules = new Set<string>();
  page.on('request', (request) => {
    const file = new URL(request.url()).pathname.replace(/^\/build\//, '');
    for (const module of inventory[file] ?? []) modules.add(module);
  });
  return modules;
}

async function session(page: Page, account: 'admin' | 'donor') {
  await page.addInitScript(
    ({ user, role }) => {
      localStorage.setItem('accessToken', user.token);
      localStorage.setItem('userId', user.id);
      localStorage.setItem('userEmail', user.email);
      localStorage.setItem('userRole', role);
      if (role === 'admin') localStorage.setItem('adminAccessLevel', 'admin');
    },
    { user: f.accounts[account], role: account === 'donor' ? 'investor' : 'admin' },
  );
}

let pageErrors: string[];
test.beforeEach(async ({ page, baseURL }) => {
  pageErrors = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.route('**/*', (route) =>
    route.request().url().startsWith(baseURL!) ? route.continue() : route.abort(),
  );
});

test.afterEach(() => {
  expect(pageErrors).toEqual([]);
});

test('production home excludes other pages and chart modules, and navigates to the catalog', async ({
  page,
}) => {
  const modules = requestedModules(page);
  const response = await page.goto('/');
  expect(response!.headers()['cache-control']).toMatch(/no-cache|no-store/);
  await expect(page.getByRole('link', { name: /explorar/i }).first()).toBeVisible();
  expect(modules.has('frontend/src/pages/LandingPage.tsx')).toBe(true);
  expect(
    [...modules].filter(
      (module) => module.startsWith('frontend/src/pages/') && !module.endsWith('/LandingPage.tsx'),
    ),
  ).toEqual([]);
  expect([...modules].some((module) => module.startsWith('node_modules/recharts/'))).toBe(false);
  await page
    .getByRole('link', { name: /explorar/i })
    .first()
    .click();
  await expect(page.getByText('QA published', { exact: true })).toBeVisible();
});

test('public deep entry and refresh preserve the campaign URL', async ({ page }) => {
  const path = `/campaign/${f.campaigns.published}?source=direct#details`;
  await page.goto(path);
  await expect(page.getByRole('heading', { name: 'QA published', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'QA published', exact: true })).toBeVisible();
  expect(new URL(page.url()).search + new URL(page.url()).hash).toBe('?source=direct#details');
});

test('private entry without a session redirects before downloading the dashboard', async ({
  page,
}) => {
  const modules = requestedModules(page);
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Inicia sesión' })).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  expect(modules.has('frontend/src/pages/InvestorDashboardPage.tsx')).toBe(false);
});

test('authenticated administration supports direct entry and refresh', async ({ page }) => {
  await session(page, 'admin');
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Panel de Control', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Panel de Control', exact: true })).toBeVisible();
});

test('a delayed page chunk displays an accessible loading state', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolveGate) => {
    release = resolveGate;
  });
  await page.route(`**/build/${exploreAsset}`, async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.goto('/explore', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('status')).toHaveText('Cargando página...');
  } finally {
    release();
  }
  await expect(page.getByText('QA published', { exact: true })).toBeVisible();
});

test('a failed page chunk offers recovery and reloads the same URL successfully', async ({
  page,
}) => {
  let fail = true;
  await page.route(`**/build/${exploreAsset}`, (route) =>
    fail ? route.abort('failed') : route.continue(),
  );
  await page.goto('/explore?q=QA', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('alert')).toContainText('No pudimos mostrar esta sección');
  fail = false;
  await page.getByRole('button', { name: 'Recargar página', exact: true }).click();
  await expect(page.getByText('QA published', { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/explore\?q=QA$/);
});

test('chart code is fetched when opening performance, including a direct tab refresh', async ({
  page,
}) => {
  await session(page, 'donor');
  const modules = requestedModules(page);
  await page.goto('/dashboard');
  await expect(page.getByRole('button', { name: 'Rendimiento', exact: true })).toBeVisible();
  expect([...modules].some((module) => module.startsWith('node_modules/recharts/'))).toBe(false);
  await page.getByRole('button', { name: 'Rendimiento', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Comienza tu viaje de donación' })).toBeVisible();
  expect([...modules].some((module) => module.startsWith('node_modules/recharts/'))).toBe(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Comienza tu viaje de donación' })).toBeVisible();
});
