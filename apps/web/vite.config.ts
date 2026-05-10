import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
// fast-glob (used by viteStaticCopy) requires forward slashes on all platforms
const dataDir = path.resolve(projectRoot, '../../packages/data').replace(/\\/g, '/');

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: `${dataDir}/dataset.json`,
          dest: '.',
        },
        {
          src: `${dataDir}/dataset-meta.json`,
          dest: '.',
        },
        {
          src: `${dataDir}/sprites`,
          dest: '.',
        },
      ],
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(projectRoot, './src'),
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
