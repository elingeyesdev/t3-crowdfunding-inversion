import { test, expect, fixtures as f } from './fixtures';

test.beforeEach(async ({ page, baseURL }) => {
  // External fonts and avatars are irrelevant to these acceptance assertions.
  await page.route('**/*', route => route.request().url().startsWith(baseURL!) ? route.continue() : route.abort());
});
test('HU-V01-CA01 portada permite entrar al catálogo', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: /explorar/i }).first().click();
  await expect(page).toHaveURL(/\/explore$/);
  await expect(page.getByText('QA published', { exact: true })).toBeVisible();
});
test('HU-V01-CA02 catálogo permite consulta sin registrarse', async ({ page }) => {
  await page.goto('/explore');
  await expect(page.getByText('QA published', { exact: true })).toBeVisible();
  await expect(page.getByText('QA draft', { exact: true })).toHaveCount(0);
});
test('HU-V03-CA01 abrir ficha pública desde catálogo', async ({ page }) => {
  await page.goto('/explore');
  await page.getByText('QA published', { exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/campaign/${f.campaigns.published}$`));
  await expect(page.getByRole('heading', { name: 'QA published', exact: true })).toBeVisible();
});
test('HU-C02-CA02 acceso privado regresa a la ruta solicitada', async ({ page }) => {
  await page.goto('/profile'); await expect(page).toHaveURL(/\/login$/);
  await page.getByLabel('Correo electrónico', { exact: true }).fill(f.accounts.donor.email);
  await page.getByLabel('Contraseña', { exact: true }).fill('Password123');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
});
for (const [account, target] of [['donor','dashboard'], ['owner','entrepreneur-profile'], ['admin','admin'], ['superadmin','superadmin']]) {
  test(`HU-C02-${account === 'admin' || account === 'superadmin' ? 'CA03' : 'CA02'} destino de ${account} respeta rol`, async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Correo electrónico', { exact: true }).fill(f.accounts[account].email);
    await page.getByLabel('Contraseña', { exact: true }).fill('Password123');
    await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/${target}$`));
  });
}
test('HU-C02-CA04 interfaz muestra credenciales inválidas sin entrar', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico', { exact: true }).fill(f.accounts.donor.email);
  await page.getByLabel('Contraseña', { exact: true }).fill('Wrong123');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page.getByText(/credenciales inválidas/i)).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});
test('HU-C02-CA05 recordar correo conserva y retira selección', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Correo electrónico', { exact: true }).fill(f.accounts.donor.email);
  await page.getByLabel('Contraseña', { exact: true }).fill('Password123');
  await page.getByLabel('Recordar mi correo', { exact: true }).check();
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/); await page.goto('/login');
  await expect(page.getByLabel('Correo electrónico', { exact: true })).toHaveValue(f.accounts.donor.email);
  await page.getByLabel('Recordar mi correo', { exact: true }).uncheck();
  await page.getByLabel('Contraseña', { exact: true }).fill('Password123');
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/); await page.goto('/login');
  await expect(page.getByLabel('Correo electrónico', { exact: true })).toHaveValue('');
});
test('HU-T01-CA01 ruta privada solicita autenticación', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: 'Inicia sesión' })).toBeVisible();
});
