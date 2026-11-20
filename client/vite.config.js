/**
 * Vite config.
 *   npm run dev         → http://localhost:5173, /api proxied to the Node.js API
 *   npm run build       → dist/ talking to the API (VITE_API_URL or same-origin /api)
 *   npm run build:demo  → dist/ with the in-browser demo database (.env.demo),
 *                         relative asset paths so it works from any sub-folder
 */
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === 'demo' ? './' : '/',
  server: {
    port: 5173,
    proxy: { '/api': { target: process.env.API_PROXY || 'http://localhost:4000', changeOrigin: true } },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 600,
  },
}));
