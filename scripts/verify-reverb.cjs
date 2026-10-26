/** Local protocol check; creates no users, messages or database records. */
const { createHmac, createHash } = require('node:crypto');
const fs = require('node:fs');
const { resolve } = require('node:path');
const { createRequire } = require('node:module');
const legacyRequire = createRequire(resolve(__dirname, '../backend/package.json'));
const WebSocket = legacyRequire('ws');
const env = legacyRequire('dotenv').parse(fs.readFileSync(resolve(__dirname, '../.env')));
const channel = 'private-migration-verification';
const port = process.env.REVERB_PORT || env.REVERB_PORT || '9091';
const ws = new WebSocket(`ws://127.0.0.1:${port}/app/${env.REVERB_APP_KEY}?protocol=7&client=js&version=8.4.0`, { origin: env.APP_URL || 'http://localhost:8765' });
let verified = false;
const timeout = setTimeout(() => { console.error('Reverb no respondió a tiempo.'); process.exitCode = 1; ws.close(); }, 10000);
ws.on('message', async raw => {
  const message = JSON.parse(String(raw));
  if (message.event === 'pusher:connection_established') {
    const { socket_id } = JSON.parse(message.data);
    const signature = createHmac('sha256', env.REVERB_APP_SECRET).update(`${socket_id}:${channel}`).digest('hex');
    ws.send(JSON.stringify({ event: 'pusher:subscribe', data: { channel, auth: `${env.REVERB_APP_KEY}:${signature}` } }));
  } else if (message.event === 'pusher_internal:subscription_succeeded') {
    const body = JSON.stringify({ name: 'migration.verified', channels: [channel], data: JSON.stringify({ ok: true }) });
    const path = `/apps/${env.REVERB_APP_ID}/events`;
    const query = new URLSearchParams({ auth_key: env.REVERB_APP_KEY, auth_timestamp: String(Math.floor(Date.now() / 1000)), auth_version: '1.0', body_md5: createHash('md5').update(body).digest('hex') });
    const signature = createHmac('sha256', env.REVERB_APP_SECRET).update(`POST\n${path}\n${query}`).digest('hex');
    query.set('auth_signature', signature);
    const response = await fetch(`http://127.0.0.1:${port}${path}?${query}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
    if (!response.ok) { console.error('No se pudo publicar el evento de prueba.'); process.exitCode = 1; ws.close(); }
  } else if (message.event === 'migration.verified' && JSON.parse(message.data).ok) {
    verified = true; clearTimeout(timeout); console.log('Reverb: conexión, canal privado y recepción de evento verificados.'); ws.close();
  } else if (message.event === 'pusher:error') { console.error('Reverb rechazó la conexión o el canal privado.'); process.exitCode = 1; ws.close(); }
});
ws.on('error', () => { clearTimeout(timeout); console.error('No se pudo conectar a Reverb.'); process.exitCode = 1; });
ws.on('close', () => { clearTimeout(timeout); if (!verified) process.exitCode = 1; });
