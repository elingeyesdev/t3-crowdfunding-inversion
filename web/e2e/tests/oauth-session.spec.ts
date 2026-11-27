import { test, expect, fixtures as f } from './fixtures';
import type { Page } from '@playwright/test';

const sessionKeys = ['accessToken', 'userId', 'userEmail', 'userRole', 'adminAccessLevel'];
const callback = (account: string) =>
  '/auth/callback?' +
  new URLSearchParams({
    token: f.accounts[account].token,
    userId: 'untrusted-url-user',
    role: account === 'donor' ? 'super_admin' : 'investor',
  });

async function seedPreviousSession(page: Page) {
  await page.goto('/login');
  await page.evaluate(() => {
    for (const key of ['accessToken', 'userId', 'userEmail', 'userRole', 'adminAccessLevel']) {
      localStorage.setItem(key, 'previous-session');
    }
    localStorage.setItem('rememberedEmail', 'remembered@example.test');
  });
}
async function expectNoSession(page: Page) {
  expect(
    await page.evaluate((keys) => keys.map((key) => localStorage.getItem(key)), sessionKeys),
  ).toEqual(sessionKeys.map(() => null));
}

test.beforeEach(async ({ page, baseURL }) => {
  await page.route('**/*', (route) =>
    route.request().url().startsWith(baseURL!) ? route.continue() : route.abort(),
  );
});

for (const [account, path, heading, role] of [
  ['donor', '/dashboard', 'Seguimiento Privado del Donador', 'investor'],
  ['owner', '/entrepreneur-profile', 'Juan Prueba', 'entrepreneur'],
  ['admin', '/admin', 'Panel de Control', 'admin'],
  ['superadmin', '/superadmin', 'Panel de SuperAdmin', 'super_admin'],
]) {
  test(`OAuth ${account}: server identity, controls, refresh and token revocation`, async ({
    page,
    request,
  }) => {
    await seedPreviousSession(page);
    const referrers: string[] = [];
    page.on('request', (request) => referrers.push(request.headers().referer ?? ''));
    const response = await page.goto(callback(account));
    expect(response!.headers()['cache-control']).toContain('no-store');
    expect(response!.headers()['referrer-policy']).toBe('no-referrer');
    await expect(page).toHaveURL(new RegExp(`${path}$`));
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    const isAdmin = account === 'admin' || account === 'superadmin';
    const email = isAdmin
      ? page.locator('header').getByText(f.accounts[account].email, { exact: true })
      : page
          .getByRole('navigation')
          .getByRole('link', { name: f.accounts[account].email, exact: true });
    await expect(email).toBeVisible();
    const logout = page.getByRole('button', {
      name: isAdmin ? 'Cerrar Sesión' : 'Salir',
      exact: true,
    });
    await expect(logout).toBeVisible();
    if (!isAdmin)
      await expect(page.getByRole('button', { name: 'Notificaciones', exact: true })).toBeVisible();
    expect(
      await page.evaluate((keys) => keys.map((key) => localStorage.getItem(key)), sessionKeys),
    ).toEqual([
      f.accounts[account].token,
      f.accounts[account].id,
      f.accounts[account].email,
      role,
      isAdmin ? role : null,
    ]);
    expect(referrers.some((value) => value.includes('token='))).toBe(false);
    await page.reload();
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    await expect(email).toBeVisible();
    await logout.click();
    await expect(page.getByRole('heading', { name: 'Inicia sesión', exact: true })).toBeVisible();
    await expectNoSession(page);
    expect(
      (
        await request.get('/api/v1/auth/me', {
          headers: {
            Authorization: `Bearer ${f.accounts[account].token}`,
            Accept: 'application/json',
          },
        })
      ).status(),
    ).toBe(401);
  });
}

test('OAuth transient lookup failure clears stale identity and retry completes the same credential', async ({
  page,
}) => {
  await seedPreviousSession(page);
  let fail = true;
  await page.route('**/api/v1/auth/me', (route) =>
    fail
      ? route.fulfill({ status: 503, json: { message: 'Synthetic service failure' } })
      : route.continue(),
  );
  await page.goto(callback('donor'));
  await expect(page.getByRole('alert')).toContainText('no está disponible temporalmente');
  await expectNoSession(page);
  await expect(page).toHaveURL(/\/auth\/callback$/);
  fail = false;
  await page.getByRole('button', { name: 'Reintentar', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole('link', { name: f.accounts.donor.email, exact: true })).toBeVisible();
});

test('OAuth invalid credential offers sign-in and leaves no partial session', async ({ page }) => {
  await seedPreviousSession(page);
  await page.goto('/auth/callback?token=invalid-synthetic-token&role=super_admin');
  await expect(page.getByRole('alert')).toContainText('ya no es válido o no está autorizado');
  await expectNoSession(page);
  await expect(page.getByRole('button', { name: 'Reintentar' })).toHaveCount(0);
  await page.getByRole('link', { name: 'Volver a iniciar sesión', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Inicia sesión', exact: true })).toBeVisible();
});

for (const path of ['/auth/callback', '/auth/callback?error=denied&token=ignored']) {
  test(`OAuth missing or rejected input is recoverable: ${path}`, async ({ page }) => {
    await seedPreviousSession(page);
    let identityRequests = 0;
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === '/api/v1/auth/me') identityRequests++;
    });
    await page.goto(path);
    await expect(page.getByRole('alert')).toContainText('incompleto o fue rechazado');
    await expect(page).toHaveURL(/\/auth\/callback$/);
    await expectNoSession(page);
    expect(identityRequests).toBe(0);
  });
}
