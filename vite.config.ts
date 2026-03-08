import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const outlineEditorRuntimePath = fileURLToPath(
  new URL('./src/modules/outline-editor/dist/index.cjs', import.meta.url),
);

export default defineConfig({
  plugins: [react()],
  resolve: {
    preserveSymlinks: true,
    dedupe: [
      'react',
      'react-dom',
      'styled-components',
      'i18next',
      'react-i18next',
    ],
    alias: [
      {
        find: 'outline-editor-local-runtime',
        replacement: outlineEditorRuntimePath,
      },
    ],
  },
  optimizeDeps: {
    include: ['styled-components', 'outline-editor-local-runtime'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  build: {
    // The editor runtime is intentionally lazy-loaded as a large optional chunk.
    chunkSizeWarningLimit: 8000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/src/modules/outline-editor/')) {
            return 'editor-core';
          }

          if (id.includes('/node_modules/')) {
            return 'app-core';
          }

          return undefined;
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    css: true,
    include: ['src/test/**/*.{test,spec}.{ts,tsx}'],
  },
});
