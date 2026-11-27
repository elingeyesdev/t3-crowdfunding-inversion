import { test, expect, fixtures as f, headers, data } from './fixtures';

test.beforeEach(async ({ page, baseURL }) => {
  await page.route('**/*', (route) =>
    route.request().url().startsWith(baseURL!)
      ? route.continue()
      : route.abort(),
  );
  await page.addInitScript((user) => {
    localStorage.setItem('accessToken', user.token);
    localStorage.setItem('userId', user.id);
    localStorage.setItem('userEmail', user.email);
    localStorage.setItem('userRole', 'entrepreneur');
  }, f.accounts.owner);
});

for (const entry of ['/entrepreneur-campaigns', '/entrepreneur-profile']) {
  for (const mode of ['create', 'edit']) {
    test(`${entry} ${mode}: recover partial uploads and lost responses without duplicates`, async ({
      page,
      request,
    }) => {
      const categories = await data(await request.get('/api/v1/categories'));
      if (mode === 'edit')
        await data(
          await request.patch(
            `/api/v1/entrepreneurs/me/campaigns/${f.campaigns.draft}`,
            {
              headers: headers('owner'),
              data: { categoryIds: [categories[0].id] },
            },
          ),
        );
      await page.goto(entry);
      if (mode === 'create') {
        await page
          .getByRole('button', {
            name:
              entry === '/entrepreneur-profile'
                ? 'Nueva Campaña'
                : 'Lanzar Campaña',
            exact: true,
          })
          .click();
      } else {
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
      const form = page.locator('form').filter({ has: page.locator('#title') });
      const title = `Subidas ${mode} ${entry === '/entrepreneur-profile' ? 'perfil' : 'campañas'}`;
      await form.locator('#title').fill(title);
      await form
        .locator('#shortDescription')
        .fill('Resumen sintético para comprobar subidas');
      await form
        .locator('#description')
        .fill(
          'Descripción detallada de un proyecto sintético para verificar recuperación de subidas parciales sin duplicar campañas ni documentos.',
        );
      await expect(
        form.locator('input[type="checkbox"]').first(),
      ).toBeAttached();
      if (!(await form.locator('input[type="checkbox"]:checked').count()))
        await form
          .locator('label')
          .filter({ has: page.locator('input[type="checkbox"]') })
          .first()
          .click();
      await form
        .locator('#cover-upload')
        .setInputFiles({
          name: 'cover.png',
          mimeType: 'image/png',
          buffer: Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jL1kAAAAASUVORK5CYII=',
            'base64',
          ),
        });
      for (const name of ['support.pdf', 'pending.pdf']) {
        await form
          .locator('input[type="file"]:not(#cover-upload)')
          .setInputFiles({
            name,
            mimeType: 'application/pdf',
            buffer: Buffer.from(
              '%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF',
            ),
          });
        await form
          .getByPlaceholder('Ej. Cotización oficial del proveedor')
          .fill('Respaldo ' + name);
        await form
          .getByRole('button', { name: 'Añadir Documento', exact: true })
          .click();
      }
      let writes = 0,
        covers = 0,
        received = 0,
        pending = 0;
      let firstCover: string | undefined;
      let firstDocument: string | undefined;
      const keys: string[] = [];
      const base = '/api/v1/entrepreneurs/me/campaigns';
      const path = base + (mode === 'edit' ? '/' + f.campaigns.draft : '');
      await page.route('**' + path, async (route) => {
        if (route.request().method() === (mode === 'edit' ? 'PATCH' : 'POST'))
          writes++;
        await route.continue();
      });
      await page.route('**' + base + '/*/cover', async (route) => {
        covers++;
        if (covers > 1) return route.continue();
        const response = await route.fetch();
        expect(response.status()).toBe(200);
        firstCover = (await response.json()).data.coverImageUrl;
        // The server committed the file, but the browser never received its receipt.
        await route.fulfill({
          status: 503,
          json: { message: 'Respuesta de portada perdida' },
        });
      });
      await page.route('**' + base + '/*/documents', async (route) => {
        if (route.request().method() !== 'POST') return route.continue();
        const body = route.request().postDataBuffer()!.toString('latin1');
        if (body.includes('filename="support.pdf"')) {
          received++;
          return route.continue();
        }
        pending++;
        keys.push(body.match(/name="uploadId"\r\n\r\n([^\r]+)/)![1]);
        if (pending > 2) return route.continue();
        if (pending === 1) {
          const response = await route.fetch();
          expect(response.status()).toBe(201);
          firstDocument = (await response.json()).data.id;
        }
        await route.fulfill({
          status: 503,
          json: { message: 'No se recibió la confirmación del documento' },
        });
      });
      await form
        .getByRole('button', { name: 'Guardar Borrador', exact: true })
        .click();
      await page
        .getByRole('button', { name: 'Sí, guardar', exact: true })
        .click();
      const progress = page.getByRole('region', {
        name: 'Estado de las subidas',
      });
      const retry = progress.getByRole('button', {
        name: 'Reintentar subidas pendientes',
        exact: true,
      });
      await expect(retry).toBeEnabled();
      await expect(page.getByRole('alert')).toContainText(
        'Los datos de la campaña ya están guardados',
      );
      await expect(form.locator('#title')).toBeDisabled();
      await expect(form.locator('#cover-upload')).toHaveValue(/cover\.png$/);
      await expect(
        progress.getByRole('listitem').filter({ hasText: 'support.pdf' }),
      ).toContainText('Recibido');
      expect([writes, covers, received, pending]).toEqual([1, 1, 1, 1]);
      await retry.click();
      await expect(retry).toBeEnabled();
      await expect(
        progress.getByRole('listitem').filter({ hasText: 'cover.png' }),
      ).toContainText('Recibido');
      expect([writes, covers, received, pending]).toEqual([1, 2, 1, 2]);
      await retry.click();
      await expect(progress).toHaveCount(0);
      expect([writes, covers, received, pending]).toEqual([1, 2, 1, 3]);
      expect(new Set(keys).size).toBe(1);
      const listing = await data(
        await request.get(base, { headers: headers('owner') }),
      );
      const campaigns = listing.data.filter(
        (campaign) => campaign.title === title,
      );
      expect(campaigns).toHaveLength(1);
      const saved = campaigns[0];
      if (mode === 'edit') expect(saved.id).toBe(f.campaigns.draft);
      expect(saved.coverImageUrl).toBe(firstCover);
      const documents = await data(
        await request.get(`${base}/${saved.id}/documents`, {
          headers: headers('owner'),
        }),
      );
      expect(documents).toHaveLength(2);
      expect(
        documents.find((doc) => doc.original_name === 'pending.pdf').id,
      ).toBe(firstDocument);
      for (const doc of documents)
        expect((await request.get(doc.file_url)).status()).toBe(200);
    });
  }
}
