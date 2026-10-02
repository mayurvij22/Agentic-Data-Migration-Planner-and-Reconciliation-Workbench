import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  },
  build: {
    // Emit to the repo root so the bundle is found whether Vercel resolves the
    // output directory from the repo root or from this package.
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: false
  }
});
