import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'copy-owner-routes-html',
        closeBundle() {
          const distDir = path.resolve(__dirname, 'dist');
          const indexHtml = path.join(distDir, 'index.html');
          if (fs.existsSync(indexHtml)) {
            for (const route of ['owner-server-control', 'owner-app']) {
              const routeDir = path.join(distDir, route);
              fs.mkdirSync(routeDir, {recursive: true});
              fs.copyFileSync(indexHtml, path.join(routeDir, 'index.html'));
            }
          }
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
