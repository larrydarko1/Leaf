import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: '.',
    timeout: 60000,
    retries: 0,
    workers: 1,
});
