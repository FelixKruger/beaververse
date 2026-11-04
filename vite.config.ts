import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: { port: 5173, strictPort: true, proxy: { '/room': { target: 'ws://127.0.0.1:8788', ws: true } } },
  build: { target: 'es2022' },
});
