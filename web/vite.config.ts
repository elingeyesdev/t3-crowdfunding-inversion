import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { bundleInventory } from './scripts/bundle-inventory.ts';
export default defineConfig({
  plugins: [
    laravel({ input: ['frontend/src/main.tsx'], refresh: ['resources/views/**', 'routes/**'] }),
    react(),
    tailwindcss(),
    bundleInventory(),
  ],
  publicDir: false,
  build: {
    rolldownOptions: {
      output: {
        // Avoid dozens of sub-kilobyte icon requests while keeping charts and routes separate.
        codeSplitting: { groups: [{ name: 'icons', test: /node_modules[\\/]lucide-react/ }] },
      },
    },
  },
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: [
      { find: /^es-toolkit\/compat$/, replacement: 'lodash' },
      { find: /^es-toolkit\/compat\/(.*)/, replacement: 'lodash/$1' },
    ],
  },
  server: { host: '127.0.0.1', port: 8766, strictPort: true },
});
