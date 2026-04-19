import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { configDefaults } from 'vitest/config';

export default defineConfig({
    plugins: [vue()],
    esbuild: { tsconfigRaw: { compilerOptions: { target: 'ESNext' } } },
    test: {
        globals: true,
        environment: 'jsdom',
        exclude: [...configDefaults.exclude],
    },
});
