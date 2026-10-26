import { defineConfig } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [laravel({ input: ['frontend/src/main.tsx'], refresh: ['resources/views/**', 'routes/**'] }), react(), tailwindcss()],
  publicDir: false,
  resolve: { dedupe: ['react', 'react-dom'], alias: [
    { find: /^es-toolkit\/compat$/, replacement: 'lodash' },
    { find: /^es-toolkit\/compat\/(.*)/, replacement: 'lodash/$1' },
  ] },
  server: { host: '127.0.0.1', port: 8766, strictPort: true },
});
