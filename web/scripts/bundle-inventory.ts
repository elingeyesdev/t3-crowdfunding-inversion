import { normalizePath } from 'vite';
import type { Plugin } from 'vite';

/** Build evidence for the budget check, containing module paths relative to web/ only. */
export function bundleInventory(): Plugin {
  let root = '';
  return {
    name: 'web-bundle-inventory',
    apply: 'build',
    configResolved(config) {
      root = normalizePath(config.root) + '/';
    },
    generateBundle(_options, bundle) {
      const inventory: Record<string, string[]> = {};
      for (const output of Object.values(bundle)) {
        if (output.type !== 'chunk') continue;
        inventory[output.fileName] = Object.entries(output.modules)
          .filter(([, module]) => module.renderedLength > 0)
          .map(([id]) => normalizePath(id).split('?')[0])
          .filter((id) => id.startsWith(root))
          .map((id) => id.slice(root.length))
          .sort();
      }
      this.emitFile({
        type: 'asset',
        fileName: 'bundle-modules.json',
        source: JSON.stringify(inventory),
      });
    },
  };
}
