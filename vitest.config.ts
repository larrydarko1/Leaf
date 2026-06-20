import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { configDefaults } from 'vitest/config';
import { fileURLToPath } from 'url';

export default defineConfig({
    plugins: [vue()],
    resolve: {
        alias: {
            '@/main': fileURLToPath(new URL('./src/main', import.meta.url)),
            '@/renderer': fileURLToPath(new URL('./src/renderer', import.meta.url)),
            '@/schemas': fileURLToPath(new URL('./src/schemas', import.meta.url)),
            '@/preload': fileURLToPath(new URL('./src/preload', import.meta.url)),
        },
    },
    esbuild: { tsconfigRaw: { compilerOptions: { target: 'ESNext' } } },
    test: {
        globals: true,
        environment: 'jsdom',
        exclude: [...configDefaults.exclude, 'e2e/**'],
        setupFiles: ['./vitest.setup.ts'],
    },
});
