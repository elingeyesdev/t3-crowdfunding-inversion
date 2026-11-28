import { test, expect, fixtures as f, headers, data, invest } from './fixtures';

test('HU-C01-CA01 registro por correo asigna rol público', async ({ request }) => {
  const account = await data(await request.post('/api/v1/users/register', { data: { email: 'new@example.test', password: 'Password123', signupRole: 'entrepreneur' } }), 201);
  expect(account.roles).toContain('entrepreneur');
  const session = await data(await request.post('/api/v1/auth/login', { data: { email: 'new@example.test', password: 'Password123' } }));
  const identity = await data(await request.get('/api/v1/auth/me', { headers: { Authorization: `Bearer ${session.accessToken}` } }));
  expect(identity.id).toBe(account.id);
  expect(identity.emailVerified).toBe(false);
});
for (const password of ['short', 'password123', 'Password']) {
  test(`HU-C01-CA02 rechaza contraseña inválida ${password}`, async ({ request }) => {
    expect((await request.post('/api/v1/users/register', { data: { email: 'new@example.test', password } })).status()).toBe(422);
  });
}
test('HU-C01-CA03 correo duplicado normalizado no crea otra cuenta', async ({ request }) => {
  expect((await request.post('/api/v1/users/register', { data: { email: 'DONOR@EXAMPLE.TEST', password: 'Password123' } })).status()).toBe(422);
});
test('HU-C02-CA01 login entrega sesión y rol sin contraseña', async ({ request }) => {
  const session = await data(await request.post('/api/v1/auth/login', { data: { email: f.accounts.donor.email, password: 'Password123' } }));
  expect(session.accessToken).toBeTruthy(); expect(session.user.roles).toContain('investor');
  expect(JSON.stringify(session)).not.toMatch(/passwordHash|password_hash/);
});
test('HU-C02-CA04 contraseña incorrecta no genera acceso', async ({ request }) => {
  expect((await request.post('/api/v1/auth/login', { data: { email: f.accounts.donor.email, password: 'Wrong123' } })).status()).toBe(401);
});
test('HU-C03-CA04 token revocado no permite volver a consultar cuenta', async ({ request }) => {
  await data(await request.post('/api/v1/auth/logout', { headers: headers() }));
  expect((await request.get('/api/v1/auth/me', { headers: headers() })).status()).toBe(401);
});
test('HU-C04-CA01 cambio de contraseña valida actual y permite nuevo acceso', async ({ request }) => {
  await data(await request.patch('/api/v1/users/me/password', { headers: headers(), data: { currentPassword: 'Password123', newPassword: 'Changed456' } }));
  expect((await request.post('/api/v1/auth/login', { data: { email: f.accounts.donor.email, password: 'Password123' } })).status()).toBe(401);
  const session = await data(await request.post('/api/v1/auth/login', { data: { email: f.accounts.donor.email, password: 'Changed456' } }));
  expect(session.accessToken).toBeTruthy();
});
test('HU-D01-CA02 edición de perfil persiste por API', async ({ request }) => {
  await data(await request.put('/api/v1/investors/me/profile', { headers: headers(), data: { firstName: 'Beatriz' } }));
  expect((await data(await request.get('/api/v1/investors/me/profile', { headers: headers() }))).firstName).toBe('Beatriz');
});
test('HU-D03-CA01 saldo simulado inicial es coherente', async ({ request }) => {
  const capital = await data(await request.get('/api/v1/investors/me/capital', { headers: headers() }));
  expect(Number(capital.availableCapital)).toBe(500); expect(Number(capital.totalInvested)).toBe(0);
});
test('HU-D03-CA04 aumentar capital simulado actualiza disponible', async ({ request }) => {
  const capital = await data(await request.post('/api/v1/investors/me/capital/add', { headers: headers(), data: { amount: 50 } }));
  expect(Number(capital.availableCapital)).toBe(550);
});
test('HU-D04-CA02 aporte conserva saldo recaudación e historial', async ({ request }) => {
  await data(await invest(request, 100), 201);
  expect(Number((await data(await request.get('/api/v1/investors/me/capital', { headers: headers() }))).availableCapital)).toBe(400);
  expect(Number((await data(await request.get(`/api/v1/campaigns/public/${f.campaigns.published}`))).currentAmount)).toBe(100);
  const history = await data(await request.get('/api/v1/investments/me', { headers: headers() }));
  expect(history).toHaveLength(1); expect(Number(history[0].amount)).toBe(100);
});
for (const amount of [0, -1, 9.99, 300.01, 0.001]) {
  test(`HU-D04-CA04 monto inválido ${amount} no descuenta saldo`, async ({ request }) => {
    expect((await invest(request, amount)).status()).toBe(422);
    expect(Number((await data(await request.get('/api/v1/investors/me/capital', { headers: headers() }))).availableCapital)).toBe(500);
    expect(await data(await request.get('/api/v1/investments/me', { headers: headers() }))).toHaveLength(0);
  });
}
test('HU-D04-CA04 saldo insuficiente rechaza operación completa', async ({ request }) => {
  await data(await invest(request, 300), 201);
  expect((await invest(request, 250)).status()).toBe(422);
  expect(Number((await data(await request.get('/api/v1/investors/me/capital', { headers: headers() }))).availableCapital)).toBe(200);
});
for (const state of ['expired', 'funded', 'completed', 'failed', 'draft']) {
  test(`HU-D04-CA05 campaña ${state} no admite aporte`, async ({ request }) => {
    expect((await request.post('/api/v1/investments', { headers: headers(), data: { campaignId: f.campaigns[state], amount: 100 } })).status()).toBe(422);
  });
}
test('HU-D05-CA02 conserva exactamente la recompensa elegida', async ({ request }) => {
  await data(await invest(request, 100, f.reward), 201);
  const [entry] = await data(await request.get('/api/v1/investments/me', { headers: headers() }));
  expect(entry.rewardTierId).toBe(f.reward); expect(entry.rewardClaimId).toBeTruthy();
});
for (const reward of ['rewardExpired', 'rewardFull']) {
  test(`HU-D05-CA03 ${reward} rechaza sin aporte ni descuento`, async ({ request }) => {
    expect((await invest(request, 100, f[reward])).status()).toBe(422);
    expect(await data(await request.get('/api/v1/investments/me', { headers: headers() }))).toHaveLength(0);
    expect(Number((await data(await request.get('/api/v1/investors/me/capital', { headers: headers() }))).availableCapital)).toBe(500);
  });
}
test('HU-D05-CA04 aporte sin recompensa no crea entrega', async ({ request }) => {
  await data(await invest(request, 100), 201);
  const [entry] = await data(await request.get('/api/v1/investments/me', { headers: headers() }));
  expect(entry.rewardTierId).toBeNull(); expect(entry.rewardClaimId).toBeNull();
});
test('HU-D07-CA02 comprobante propio es PDF descargable', async ({ request }) => {
  await data(await invest(request, 100), 201);
  const [entry] = await data(await request.get('/api/v1/investments/me', { headers: headers() }));
  const receipt = await request.get(`/api/v1/investments/${entry.id}/receipt`, { headers: headers() });
  expect(receipt.status()).toBe(200); expect(receipt.headers()['content-type']).toContain('application/pdf');
  expect((await receipt.body()).subarray(0, 5).toString()).toBe('%PDF-');
});
test('HU-E09-CA01 enviar borrador a revisión registra transición', async ({ request }) => {
  await data(await request.post(`/api/v1/entrepreneurs/me/campaigns/${f.campaigns.draft}/submit-for-review`, { headers: headers('owner') }));
  const history = await data(await request.get(`/api/v1/entrepreneurs/me/campaigns/${f.campaigns.draft}/history`, { headers: headers('owner') }));
  expect(history[0].to_status).toBe('pending_review');
});
test('HU-E10-CA01 publica campaña aprobada con KYC y vigencia', async ({ request }) => {
  const published = await data(await request.post(`/api/v1/entrepreneurs/me/campaigns/${f.campaigns.approved}/publish`, { headers: headers('owner') }));
  expect(published.status).toBe('published');
  expect((await request.get(`/api/v1/campaigns/public/${f.campaigns.approved}`)).status()).toBe(200);
});
test('HU-E10-CA02 aprobar no publica automáticamente', async ({ request }) => {
  const approved = await data(await request.patch(`/api/v1/admin/campaigns/${f.campaigns.pending_review}/status`, { headers: headers('admin'), data: { status: 'approved' } }));
  expect(approved.status).toBe('approved');
  expect((await request.get(`/api/v1/campaigns/public/${f.campaigns.pending_review}`)).status()).toBe(404);
});
for (const state of ['draft', 'rejected', 'pending_review']) {
  test(`HU-E10 regresión ${state} no puede omitir aprobación`, async ({ request }) => {
    expect((await request.post(`/api/v1/entrepreneurs/me/campaigns/${f.campaigns[state]}/publish`, { headers: headers('owner') })).status()).toBe(422);
  });
}
test('HU-E10-CA03 revalida KYC al publicar', async ({ request }) => {
  expect((await request.post(`/api/v1/entrepreneurs/me/campaigns/${f.campaigns.kycPending}/publish`, { headers: headers('otherOwner') })).status()).toBe(422);
});
test('HU-E14-CA02 cierre sin meta reembolsa y cancela recompensa una sola vez', async ({ request }) => {
  await data(await invest(request, 100, f.reward), 201);
  const close = `/api/v1/entrepreneurs/me/campaigns/${f.campaigns.published}/finalize`;
  await data(await request.post(close, { headers: headers('owner') }));
  const [entry] = await data(await request.get('/api/v1/investments/me', { headers: headers() }));
  expect(entry.investmentStatus).toBe('refunded'); expect(entry.rewardClaimStatus).toBe('cancelled');
  expect(Number((await data(await request.get('/api/v1/investors/me/capital', { headers: headers() }))).availableCapital)).toBe(500);
  expect((await request.post(close, { headers: headers('owner') })).status()).toBe(422);
});
test('HU-E15-CA01 propietario elimina borrador sin actividad financiera', async ({ request }) => {
  await data(await request.delete(`/api/v1/entrepreneurs/me/campaigns/${f.campaigns.draft}`, { headers: headers('owner') }));
  expect((await request.get(`/api/v1/entrepreneurs/me/campaigns/${f.campaigns.draft}`, { headers: headers('owner') })).status()).toBe(404);
});
for (const path of ['/auth/me', '/investments/me', '/admin/users', '/notifications', '/chat/conversations']) {
  test(`HU-T01-CA01 anónimo no accede a ${path}`, async ({ request }) => {
    expect((await request.get(`/api/v1${path}`)).status()).toBe(401);
  });
}
test('HU-T01-CA02 donador no puede aprobar campañas', async ({ request }) => {
  expect((await request.patch(`/api/v1/admin/campaigns/${f.campaigns.pending_review}/status`, { headers: headers(), data: { status: 'approved' } })).status()).toBe(403);
});
test('HU-T01-CA03 tercero no edita campaña ni descarga comprobante ajeno', async ({ request }) => {
  expect((await request.patch(`/api/v1/entrepreneurs/me/campaigns/${f.campaigns.draft}`, { headers: headers('otherOwner'), data: { title: 'Ajena' } })).status()).toBe(403);
  await data(await invest(request, 100), 201);
  const [entry] = await data(await request.get('/api/v1/investments/me', { headers: headers() }));
  expect((await request.get(`/api/v1/investments/${entry.id}/receipt`, { headers: headers('otherDonor') })).status()).toBe(404);
});
for (const path of ['/uploads/kyc/secret.pdf', '/storage/kyc/secret.pdf', '/api/v1/private-files/kyc/secret.pdf']) {
  test(`HU-T01-CA04 documento KYC no se entrega por ${path}`, async ({ request }) => {
    expect((await request.get(path)).status()).toBe(403);
  });
}
test('HU-C05-CA01 conversación y mensajes quedan limitados a participantes', async ({ request }) => {
  const conversation = await data(await request.post('/api/v1/chat/conversations', { headers: headers(), data: { otherUserId: f.accounts.owner.id, campaignId: f.campaigns.published } }), 201);
  const path = `/api/v1/chat/conversations/${conversation.id}/messages`;
  await data(await request.post(path, { headers: headers(), data: { content: 'Consulta QA' } }), 201);
  expect((await request.get(path, { headers: headers('otherDonor') })).status()).toBe(403);
});
test('HU-C10-CA02 comentario registrado conserva autor y contenido', async ({ request }) => {
  const path = `/api/v1/campaigns/${f.campaigns.published}/comments`;
  const comment = await data(await request.post(path, { headers: headers(), data: { content: 'Comentario QA' } }), 201);
  expect(comment.authorId).toBe(f.accounts.donor.id);
  expect((await data(await request.get(path))).some((c: any) => c.content === 'Comentario QA')).toBe(true);
});
test('HU-C11-CA01 Me gusta alterna contador sin duplicarse', async ({ request }) => {
  const path = `/api/v1/campaigns/${f.campaigns.published}/comments`;
  const comment = await data(await request.post(path, { headers: headers(), data: { content: 'Comentario QA' } }), 201);
  expect((await data(await request.post(`${path}/${comment.id}/like`, { headers: headers() }))).likesCount).toBe(1);
  expect((await data(await request.post(`${path}/${comment.id}/like`, { headers: headers() }))).likesCount).toBe(0);
});
