import { test, expect, fixtures as f, headers, data } from './fixtures';

test.beforeEach(async ({ page, baseURL }) => {
  await page.route('**/*', (route) =>
    route.request().url().startsWith(baseURL!) ? route.continue() : route.abort(),
  );
  await page.addInitScript((user) => {
    localStorage.setItem('accessToken', user.token);
    localStorage.setItem('userId', user.id);
    localStorage.setItem('userEmail', user.email);
    localStorage.setItem('userRole', 'entrepreneur');
  }, f.accounts.owner);
});

for (const entry of ['/entrepreneur-campaigns', '/entrepreneur-profile'])
  for (const mode of ['create', 'edit']) {
    test(`${entry} ${mode}: pending lock, retained files, visible failure and successful retry`, async ({
      page,
      request,
    }) => {
      if (mode === 'edit') {
        const categories = await data(await request.get('/api/v1/categories'));
        // Match campaigns created through the web, including the categories pivot.
        await data(
          await request.patch(`/api/v1/entrepreneurs/me/campaigns/${f.campaigns.draft}`, {
            headers: headers('owner'),
            data: { categoryIds: [categories[0].id] },
          }),
        );
      }
      await page.goto(entry);
      if (mode === 'create')
        await page
          .getByRole('button', {
            name: entry === '/entrepreneur-profile' ? 'Nueva Campaña' : 'Lanzar Campaña',
            exact: true,
          })
          .click();
      else {
        if (entry === '/entrepreneur-profile')
          await page.getByText('QA draft', { exact: true }).click();
        else
          await page
            .locator('article')
            .filter({ has: page.getByText('QA draft', { exact: true }) })
            .getByRole('button', { name: 'Vista Previa', exact: true })
            .click();
        await page
          .getByRole('dialog', { name: 'QA draft', exact: true })
          .getByRole('button', { name: 'Editar', exact: true })
          .click();
      }
      await expect(
        page.getByRole('heading', {
          name: mode === 'edit' ? 'Actualizar campaña' : 'Lanzar nueva campaña',
          exact: true,
        }),
      ).toBeVisible();
      const form = page.locator('form').filter({ has: page.locator('#title') });
      const title = `Prueba ${mode} ${entry === '/entrepreneur-profile' ? 'perfil' : 'campañas'}`;
      await form.locator('#title').fill(title);
      await form.locator('#shortDescription').fill('Resumen de una campaña sintética');
      await form
        .locator('#description')
        .fill(
          'Descripción detallada de un proyecto sintético para verificar el guardado y la recuperación de formularios.',
        );
      await expect(form.locator('input[type="checkbox"]').first()).toBeAttached();
      if ((await form.locator('input[type="checkbox"]:checked').count()) === 0)
        await form
          .locator('label')
          .filter({ has: page.locator('input[type="checkbox"]') })
          .first()
          .click();
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jL1kAAAAASUVORK5CYII=',
        'base64',
      );
      await form
        .locator('#cover-upload')
        .setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: png });
      const pdf = Buffer.from(
        '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF',
      );
      await form
        .locator('input[type="file"]:not(#cover-upload)')
        .setInputFiles({ name: 'support.pdf', mimeType: 'application/pdf', buffer: pdf });
      await form
        .getByPlaceholder('Ej. Cotización oficial del proveedor')
        .fill('Justificación conservada');
      await form.getByRole('button', { name: 'Añadir Documento', exact: true }).click();

      const path =
        '/api/v1/entrepreneurs/me/campaigns' + (mode === 'edit' ? '/' + f.campaigns.draft : '');
      const method = mode === 'edit' ? 'PATCH' : 'POST';
      let fail = true,
        calls = 0,
        release!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      await page.route('**' + path, async (route) => {
        if (route.request().method() !== method) return route.continue();
        calls++;
        if (!fail) return route.continue();
        await gate;
        await route.fulfill({
          status: mode === 'edit' ? 500 : 422,
          json: { message: 'No se pudo guardar la campaña de prueba.' },
        });
      });
      await form.getByRole('button', { name: 'Guardar Borrador', exact: true }).click();
      const sent = page.waitForRequest(
        (request) => request.method() === method && new URL(request.url()).pathname === path,
      );
      await page.getByRole('button', { name: 'Sí, guardar', exact: true }).evaluate((button) => {
        button.click();
        button.click();
      });
      await sent;
      try {
        await expect(page.getByRole('status')).toHaveText('Guardando campaña...');
        await expect(form.locator('#title')).toBeDisabled();
        await expect(form.getByRole('button', { name: 'Descartar', exact: true })).toBeDisabled();
        await form.evaluate((node) => node.requestSubmit());
        expect(calls).toBe(1);
      } finally {
        release();
      }
      const alert = page.getByRole('alert');
      await expect(alert).toContainText('No se pudo guardar la campaña de prueba.');
      await expect(alert).toBeFocused();
      await expect(form.locator('#title')).toHaveValue(title);
      await expect(form.locator('#cover-upload')).toHaveValue(/cover\.png$/);
      await expect(form.getByText('support.pdf', { exact: true })).toBeVisible();
      await expect(form.getByText('Justificación conservada', { exact: true })).toBeVisible();
      await expect(
        form.getByRole('button', { name: 'Guardar Borrador', exact: true }),
      ).toBeEnabled();
      fail = false;
      const corrected = title + ' corregida';
      await form.locator('#title').fill(corrected);
      await form.getByRole('button', { name: 'Guardar Borrador', exact: true }).click();
      await page.getByRole('button', { name: 'Sí, guardar', exact: true }).click();
      await expect(
        page.getByRole('heading', {
          name: mode === 'edit' ? 'Actualizar campaña' : 'Lanzar nueva campaña',
          exact: true,
        }),
      ).toHaveCount(0);
      expect(calls).toBe(2);
      const listing = await data(
        await request.get('/api/v1/entrepreneurs/me/campaigns', { headers: headers('owner') }),
      );
      const saved = listing.data.filter((campaign) => campaign.title === corrected);
      expect(saved).toHaveLength(1);
      if (mode === 'edit') expect(saved[0].id).toBe(f.campaigns.draft);
      expect(saved[0].coverImageUrl).toBeTruthy();
      const documents = await data(
        await request.get(`/api/v1/entrepreneurs/me/campaigns/${saved[0].id}/documents`, {
          headers: headers('owner'),
        }),
      );
      expect(documents).toHaveLength(1);
      expect(documents[0].original_name).toBe('support.pdf');
    });
  }
