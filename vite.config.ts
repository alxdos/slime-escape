import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  worker: {
    format: 'es'
  },
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: resolve(rootDir, 'index.html'),
        portal: resolve(rootDir, 'portal/index.html')
      }
    }
  }
});
