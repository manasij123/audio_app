import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Relative base so the built app works from any sub-path (e.g. GitHub Pages)
// and the service worker can resolve assets next to index.html.
export default defineConfig({
  base: './',
  plugins: [react()],
  // Firebase is required up front (login), so the main bundle is larger than Vite's default hint.
  build: { chunkSizeWarningLimit: 1200 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
