import {defineConfig} from 'vite';
import {fileURLToPath} from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: {alias: {'@living-region/carrying-capacity/browser': fileURLToPath(new URL('../carrying-capacity/src/browser.mjs', import.meta.url))}},
  server: {host: process.env.LIVING_REGION_HOST ?? '127.0.0.1', port: Number(process.env.EDUCATION_PORT ?? 5175), strictPort: false, allowedHosts: ['localhost', '127.0.0.1', '::1', 'zvorygin']},
  build: {outDir: 'dist', emptyOutDir: true}
});
