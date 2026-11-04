import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

const apiTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  resolve: { conditions: ['@namma/source'] },
  server: {
    port: 5173,
    // Comma-separated extra hostnames allowed to reach the dev server (e.g. a preview proxy),
    // or "true" to allow any host. Defaults to Vite's localhost-only protection.
    ...(process.env.VITE_ALLOWED_HOSTS && {
      allowedHosts:
        process.env.VITE_ALLOWED_HOSTS === 'true'
          ? true
          : process.env.VITE_ALLOWED_HOSTS.split(',').map((h) => h.trim()),
    }),
    proxy: {
      '/api': apiTarget,
      '/health': apiTarget,
    },
  },
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    css: false,
  },
});
