import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { buildApp } from './server/index.mjs';
import path from 'path';

export default defineConfig(() => {
  const config = {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { '@': path.resolve(__dirname, '.') },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // allow access via Cloudflare quick-tunnel public hostnames (they rotate)
      allowedHosts: true,
      proxy: {
        // Scraping + stream proxy handled by the express backend in dev
        '/api': {
          target: 'http://localhost:8787',
          changeOrigin: true,
        },
      },
    },
  };
  if (process.env.DISABLE_HMR === 'true') return config;
  // Attach API routes only; Vite owns transformed modules and SPA fallback.
  return { ...config, plugins: [...config.plugins, { name: 'nekoflix-backend', configureServer(srv) { srv.middlewares.use(buildApp({ serveStatic: false })); } }] };
});
