import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

const outlineEditorAppPath = fileURLToPath(
  new URL('./src/modules/outline-editor/upstream-source/app', import.meta.url),
);
const outlineEditorSharedPath = fileURLToPath(
  new URL('./src/modules/outline-editor/upstream-source/shared', import.meta.url),
);
const outlineEditorPublicPath = fileURLToPath(
  new URL('./src/modules/outline-editor/upstream-source/public/index.ts', import.meta.url),
);

export default defineConfig({
  plugins: [
    react({
      babel: {
        plugins: [
          ['@babel/plugin-proposal-decorators', { legacy: true }],
          ['@babel/plugin-proposal-class-properties', { loose: true }],
        ],
      },
    }),
  ],
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
        replacement: outlineEditorPublicPath,
      },
      {
        find: '~/',
        replacement: `${outlineEditorAppPath}/`,
      },
      {
        find: '@shared/',
        replacement: `${outlineEditorSharedPath}/`,
      },
    ],
  },
  optimizeDeps: {
    include: ['styled-components'],
    exclude: ['outline-editor-local-runtime'],
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
