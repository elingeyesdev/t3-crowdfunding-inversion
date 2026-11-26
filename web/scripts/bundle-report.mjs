import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { analyzeBundle, checkBudget } from './lib/bundle-analysis.mjs';

const web = fileURLToPath(new URL('../', import.meta.url));
const build = resolve(web, 'public/build');
const budgetPath = resolve(web, 'bundle-budget.json');
const budget = existsSync(budgetPath) ? JSON.parse(readFileSync(budgetPath, 'utf8')) : undefined;
try {
  const manifest = JSON.parse(readFileSync(resolve(build, 'manifest.json'), 'utf8'));
  const read = (file) => {
    const path = resolve(build, file);
    if (!path.startsWith(build + sep)) throw new Error(`Asset outside build directory: ${file}`);
    return readFileSync(path);
  };
  const report = {
    toolchain: {
      node: process.version,
      vite: JSON.parse(readFileSync(resolve(web, 'node_modules/vite/package.json'), 'utf8'))
        .version,
      lockSha256: createHash('sha256')
        .update(readFileSync(resolve(web, 'package-lock.json')))
        .digest('hex'),
      gzipLevel: 9,
    },
    ...analyzeBundle(manifest, read, budget),
  };
  if (process.argv.includes('--json')) console.log(JSON.stringify(report, null, 2));
  else
    for (const key of ['entryJs', 'homeJs', 'homeCss', 'allJs']) {
      console.log(
        `${key}: ${(report[key].bytes / 1000).toFixed(2)} kB; gzip ${(report[key].gzipBytes / 1000).toFixed(2)} kB (${report[key].files.length} files)`,
      );
    }
  if (process.argv.includes('--check')) {
    if (!budget) throw new Error('Missing bundle-budget.json');
    const inventoryPath = resolve(build, 'bundle-modules.json');
    const inventory = existsSync(inventoryPath)
      ? JSON.parse(readFileSync(inventoryPath, 'utf8'))
      : null;
    const failures = checkBudget(report, manifest, inventory, budget);
    if (failures.length) throw new Error(failures.join('\n'));
    console.log('Bundle budget passed.');
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
