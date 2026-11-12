/** Read-only PostgreSQL export. Run after stopping writes to the legacy backend. */
const { createRequire } = require('node:module');
const { resolve, dirname } = require('node:path');
const { mkdirSync, writeFileSync, existsSync } = require('node:fs');
const legacyRequire = createRequire(resolve(__dirname, '../backend/package.json'));
legacyRequire('dotenv').config({ path: resolve(__dirname, '../backend/.env'), quiet: true });
const { Client } = legacyRequire('pg');
const output = resolve(process.argv[2] || 'storage/app/private/legacy-export.json');
if (existsSync(output)) throw new Error('El archivo de salida ya existe; elige otro nombre.');
const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' } : false });
(async () => {
  await client.connect();
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const { rows } = await client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename");
  const tables = {};
  for (const { tablename } of rows) {
    const quoted = '"' + tablename.replaceAll('"', '""') + '"';
    tables[tablename] = (await client.query(`SELECT * FROM public.${quoted}`)).rows;
  }
  await client.query('COMMIT');
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), tables }, null, 2), { flag: 'wx', mode: 0o600 });
  console.log(`Exportadas ${rows.length} tablas a ${output}. No se modificó el origen.`);
})().catch(() => { console.error('No se pudo exportar. Comprueba la conexión PostgreSQL de backend/.env y el archivo de salida.'); process.exitCode = 1; }).finally(() => client.end());
