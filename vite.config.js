import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
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
                find: /^outline-editor\/styles\.css$/,
                replacement: resolve(__dirname, 'vendor/outline-editor/dist/outline-editor.css'),
            },
            {
                find: /^outline-editor$/,
                replacement: resolve(__dirname, 'vendor/outline-editor/dist/index.cjs'),
            },
        ],
    },
    optimizeDeps: {
        include: ['outline-editor', 'styled-components'],
        esbuildOptions: {
            define: {
                global: 'globalThis',
            },
        },
    },
    test: {
        environment: 'jsdom',
        globals: true,
        setupFiles: './src/test/setup.ts',
        css: true,
    },
});
