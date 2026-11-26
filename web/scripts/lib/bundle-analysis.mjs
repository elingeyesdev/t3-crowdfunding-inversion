import { gzipSync } from 'node:zlib';

export function staticClosure(manifest, roots) {
  const visited = new Set();
  function visit(key) {
    if (visited.has(key)) return;
    if (!manifest[key]) throw new Error(`Missing manifest entry: ${key}`);
    visited.add(key);
    for (const dependency of manifest[key].imports ?? []) visit(dependency);
  }
  roots.forEach(visit);
  return [...visited].sort();
}

export function measureFiles(files, read) {
  const assets = [...new Set(files)].sort().map((file) => {
    const contents = read(file);
    return { file, bytes: contents.length, gzipBytes: gzipSync(contents, { level: 9 }).length };
  });
  return {
    fileCount: assets.length,
    bytes: assets.reduce((total, asset) => total + asset.bytes, 0),
    gzipBytes: assets.reduce((total, asset) => total + asset.gzipBytes, 0),
    files: assets,
  };
}

export function analyzeBundle(manifest, read, options = {}) {
  const entry = options.entry ?? 'frontend/src/main.tsx';
  const home = options.home ?? 'frontend/src/pages/LandingPage.tsx';
  const entryKeys = staticClosure(manifest, [entry]);
  // Before code splitting, the landing page is part of the eager entry graph.
  const homeKeys = staticClosure(manifest, manifest[home] ? [entry, home] : [entry]);
  const javascript = (keys) =>
    keys.map((key) => manifest[key].file).filter((file) => file.endsWith('.js'));
  return {
    entryKeys,
    homeKeys,
    entryJs: measureFiles(javascript(entryKeys), read),
    homeJs: measureFiles(javascript(homeKeys), read),
    homeCss: measureFiles(
      homeKeys.flatMap((key) => manifest[key].css ?? []),
      read,
    ),
    allJs: measureFiles(
      Object.values(manifest)
        .map((chunk) => chunk.file)
        .filter((file) => file.endsWith('.js')),
      read,
    ),
  };
}

export function checkBudget(report, manifest, inventory, budget) {
  const failures = [];
  for (const [metric, limits] of Object.entries(budget.limits)) {
    for (const [unit, limit] of Object.entries(limits)) {
      if (!Number.isFinite(limit) || limit <= 0)
        throw new Error(`Invalid limit: ${metric}.${unit}`);
      if (report[metric][unit] > limit)
        failures.push(`${metric}.${unit}: ${report[metric][unit]} > ${limit}`);
    }
  }
  for (const entry of budget.deferredEntries) {
    if (!manifest[entry]?.isDynamicEntry) failures.push(`Not a dynamic entry: ${entry}`);
    if (entry !== budget.home && report.homeKeys.includes(entry))
      failures.push(`Deferred entry required by the home page: ${entry}`);
  }
  if (!inventory) failures.push('Missing bundle module inventory; rebuild before checking.');
  else
    for (const file of report.homeJs.files) {
      if (!inventory[file.file]) {
        failures.push(`Missing module inventory for ${file.file}`);
        continue;
      }
      for (const module of inventory[file.file]) {
        if (
          module !== budget.home &&
          budget.forbiddenHomePrefixes.some((prefix) => module.startsWith(prefix))
        ) {
          failures.push(`Home page includes ${module} via ${file.file}`);
        }
      }
    }
  if (budget.maxChunkBytes) {
    for (const file of report.allJs.files)
      if (file.bytes > budget.maxChunkBytes)
        failures.push(`Chunk too large: ${file.file} (${file.bytes} bytes)`);
  }
  return failures;
}
