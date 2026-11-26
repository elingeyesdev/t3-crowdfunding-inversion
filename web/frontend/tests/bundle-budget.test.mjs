import test from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { analyzeBundle, checkBudget, staticClosure } from '../../scripts/lib/bundle-analysis.mjs';

const manifest = {
  main: { file: 'main.js', imports: ['shared'], dynamicImports: ['home', 'admin'] },
  shared: { file: 'shared.js', imports: ['main'] },
  home: { file: 'home.js', imports: ['shared'], css: ['style.css'], isDynamicEntry: true },
  admin: { file: 'admin.js', imports: ['shared'], isDynamicEntry: true },
};
const contents = {
  'main.js': Buffer.from('bootstrap'),
  'shared.js': Buffer.from('shared'),
  'home.js': Buffer.from('landing'),
  'admin.js': Buffer.from('administration'),
  'style.css': Buffer.from('body {}'),
};
const budget = {
  entry: 'main',
  home: 'home',
  limits: { homeJs: { bytes: 1000, gzipBytes: 1000, fileCount: 3 } },
  maxChunkBytes: 1000,
  deferredEntries: ['home', 'admin'],
  forbiddenHomePrefixes: ['pages/', 'node_modules/recharts/'],
};
const inventory = {
  'main.js': ['app.tsx'],
  'shared.js': ['node_modules/react/index.js'],
  'home.js': ['home'],
  'admin.js': ['pages/admin.tsx'],
};
const report = () => analyzeBundle(manifest, (file) => contents[file], budget);

test('static closure follows shared dependencies once, handles cycles and excludes dynamic imports', () => {
  assert.deepEqual(staticClosure(manifest, ['main', 'home']), ['home', 'main', 'shared']);
  assert.throws(() => staticClosure(manifest, ['missing']), /Missing manifest entry/);
});

test('initial page measurement includes bootstrap, landing and shared scripts with per-file gzip', () => {
  const value = report();
  assert.equal(
    value.homeJs.bytes,
    contents['main.js'].length + contents['shared.js'].length + contents['home.js'].length,
  );
  assert.equal(
    value.homeJs.gzipBytes,
    ['main.js', 'shared.js', 'home.js'].reduce(
      (sum, file) => sum + gzipSync(contents[file], { level: 9 }).length,
      0,
    ),
  );
  assert.equal(value.homeJs.fileCount, 3);
  assert.equal(value.allJs.fileCount, 4);
  assert.equal(value.homeCss.bytes, contents['style.css'].length);
  assert.deepEqual(checkBudget(value, manifest, inventory, budget), []);
});

test('each budget dimension fails independently, including too many tiny files', () => {
  for (const unit of ['bytes', 'gzipBytes', 'fileCount']) {
    const limit = { ...budget, limits: { homeJs: { [unit]: 1 } } };
    assert.ok(
      checkBudget(report(), manifest, inventory, limit).some((error) =>
        error.startsWith('homeJs.' + unit),
      ),
    );
  }
  assert.ok(
    checkBudget(report(), manifest, inventory, { ...budget, maxChunkBytes: 1 }).some((error) =>
      error.includes('Chunk too large'),
    ),
  );
});

test('administration or charts hidden in a shared initial chunk fail the isolation check', () => {
  for (const source of ['pages/admin.tsx', 'node_modules/recharts/index.js']) {
    const mixed = { ...inventory, 'shared.js': [source] };
    assert.ok(
      checkBudget(report(), manifest, mixed, budget).some((error) => error.includes(source)),
    );
  }
});

test('missing metadata, missing lazy entries and eager route imports cannot produce a green check', () => {
  assert.ok(
    checkBudget(report(), manifest, null, budget).some((error) =>
      error.includes('Missing bundle module inventory'),
    ),
  );
  assert.ok(
    checkBudget(report(), manifest, {}, budget).some((error) =>
      error.includes('Missing module inventory for'),
    ),
  );
  const eager = { ...manifest, admin: { ...manifest.admin, isDynamicEntry: false } };
  assert.ok(
    checkBudget(report(), eager, inventory, budget).some((error) =>
      error.includes('Not a dynamic entry'),
    ),
  );
  const pulled = { ...manifest, main: { ...manifest.main, imports: ['shared', 'admin'] } };
  const pulledReport = analyzeBundle(pulled, (file) => contents[file], budget);
  assert.ok(
    checkBudget(pulledReport, pulled, inventory, budget).some((error) =>
      error.includes('Deferred entry required'),
    ),
  );
});

test('the old monolithic build remains measurable without a separate landing entry', () => {
  const legacy = analyzeBundle({ main: { file: 'main.js' } }, (file) => contents[file], budget);
  assert.deepEqual(legacy.entryJs, legacy.homeJs);
  assert.equal(legacy.homeJs.fileCount, 1);
});
