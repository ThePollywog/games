import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { pwa } from './scripts/pwa.ts';

export default defineConfig({
  // GitHub Pages serves the site from a subfolder, so that build uses relative asset paths.
  base: process.env.BASE ?? '/',
  plugins: [react(), pwa()],
  server: {
    host: true,
    proxy: { '/api': 'http://localhost:8787' },
  },
});
