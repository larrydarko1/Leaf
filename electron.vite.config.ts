import { resolve } from 'path';
import { defineConfig } from 'electron-vite';
import vue from '@vitejs/plugin-vue';
import { fileURLToPath } from 'url';

export default defineConfig({
    main: {
        build: {
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'src/main/index.ts'),
                },
            },
        },
    },
    preload: {
        build: {
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'src/preload/index.ts'),
                },
            },
        },
    },
    renderer: {
        plugins: [vue()],
        resolve: {
            alias: {
                '@': fileURLToPath(new URL('./src/renderer', import.meta.url)),
            },
        },
        css: {
            preprocessorOptions: {
                scss: {
                    additionalData: (source: string, filename: string) =>
                        filename.endsWith('style.scss')
                            ? source
                            : `@use 'sass:color';\n@use '@/style' as *;\n${source}`,
                },
            },
        },
        base: './',
        root: resolve(__dirname, 'src/renderer'),
        server: {
            port: 3000,
            strictPort: true,
        },
        build: {
            rollupOptions: {
                input: {
                    index: resolve(__dirname, 'src/renderer/index.html'),
                },
                output: {
                    manualChunks: undefined,
                },
            },
        },
    },
});
