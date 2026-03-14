import { resolve } from 'path';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import vue from '@vitejs/plugin-vue';
import { configDefaults } from 'vitest/config';

export default defineConfig({
    main: {
        plugins: [externalizeDepsPlugin()],
        build: {
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'electron/main.ts'),
                },
            },
        },
    },
    preload: {
        plugins: [externalizeDepsPlugin()],
        build: {
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'electron/preload.ts'),
                },
            },
        },
    },
    renderer: {
        plugins: [vue()],
        base: './',
        root: resolve(__dirname, '.'),
        server: {
            port: 3000,
            strictPort: true,
        },
        build: {
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'index.html'),
                },
                output: {
                    manualChunks: undefined,
                },
            },
        },
        test: {
            globals: true,
            environment: 'jsdom',
            exclude: [...configDefaults.exclude],
        },
    },
});
