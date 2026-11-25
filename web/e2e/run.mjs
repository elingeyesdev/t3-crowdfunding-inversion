import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import net from 'node:net';

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const runtimeParent = resolve(web, '../tmp/playwright');
mkdirSync(runtimeParent, { recursive: true });
const runtime = mkdtempSync(resolve(runtimeParent, 'run-'));
writeFileSync(resolve(runtime, 'e2e-only'), 'Disposable UniFundMe Playwright runtime');
writeFileSync(resolve(runtime, 'runtime.sqlite'), '');
for (const dir of ['views', 'storage/framework/cache/data', 'storage/framework/sessions', 'storage/framework/views', 'storage/logs', 'storage/app/private', 'storage/app/public']) mkdirSync(resolve(runtime, dir), { recursive: true });
const port = await new Promise((res, rej) => {
  const socket = net.createServer(); socket.once('error', rej);
  socket.listen(0, '127.0.0.1', () => { const port = socket.address().port; socket.close(() => res(port)); });
});
const env = { ...process.env, UFM_E2E_RUNTIME: runtime, UFM_E2E_KEY: `base64:${randomBytes(32).toString('base64')}`, UFM_E2E_URL: `http://127.0.0.1:${port}` };
const php = process.env.PHP_BINARY || 'php';
const seed = spawnSync(php, ['e2e/support/seed.php'], { cwd: web, env, encoding: 'utf8' });
if (seed.status !== 0) { process.stderr.write(seed.stderr || seed.stdout || String(seed.error)); process.exit(1); }
console.log(seed.stdout.trim());
const server = spawn(php, ['-S', `127.0.0.1:${port}`, '-t', 'public', 'e2e/support/router.php'], { cwd: web, env, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
let serverLog = ''; server.stderr.on('data', d => { serverLog = (serverLog + d).slice(-12000); });
try {
  let ready = false;
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw new Error(`Server exited: ${serverLog}`);
    try { if ((await fetch(`${env.UFM_E2E_URL}/up`)).ok) { ready = true; break; } } catch {}
    await new Promise(r => setTimeout(r, 150));
  }
  if (!ready) throw new Error(`Test server unavailable: ${serverLog}`);
  const cli = resolve(web, 'node_modules/@playwright/test/cli.js');
  const child = spawn(process.execPath, [cli, 'test', ...process.argv.slice(2)], { cwd: web, env, stdio: 'inherit', windowsHide: true });
  const result = await new Promise((res, rej) => { child.once('error', rej); child.once('exit', code => res(code ?? 1)); });
  process.exitCode = result;
} catch (error) { console.error(error); console.error(serverLog); process.exitCode = 1; }
finally { server.kill(); }
