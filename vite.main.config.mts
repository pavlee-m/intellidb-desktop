import { cpSync, existsSync } from 'node:fs';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';

function copyBackendPlugin(): Plugin {
  let outDir = '.vite/build';

  return {
    name: 'copy-backend',
    configResolved(config) {
      outDir = config.build.outDir;
    },
    writeBundle() {
      const src = path.resolve('src/backend');
      const dest = path.join(path.resolve(outDir), 'backend');

      if (!existsSync(src)) {
        return;
      }

      cpSync(src, dest, { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [copyBackendPlugin()],
  build: {
    rollupOptions: {
      external: ['sqlite3'],
    },
  },
});
