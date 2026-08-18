/**
 * Tests for the env config module.
 *
 * `config` is built once at import time from `process.env`, so every case here
 * stubs the environment first and then re-imports the module under a fresh
 * registry — a plain top-level import would freeze whatever the runner's own
 * environment happened to be.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';

async function loadConfig() {
    vi.resetModules();
    return (await import('@/main/lib/config')).config;
}

describe('config', () => {
    afterEach(() => {
        vi.unstubAllEnvs();
    });

    describe('rendererUrl', () => {
        it('is the ELECTRON_RENDERER_URL electron-vite sets in dev', async () => {
            vi.stubEnv('ELECTRON_RENDERER_URL', 'http://localhost:5173');

            const config = await loadConfig();

            expect(config.rendererUrl).toBe('http://localhost:5173');
        });

        it('defaults to an empty string when the variable is absent, as in a packaged build', async () => {
            vi.stubEnv('ELECTRON_RENDERER_URL', undefined);

            const config = await loadConfig();

            expect(config.rendererUrl).toBe('');
        });

        it('keeps an explicitly empty value empty rather than falling back', async () => {
            vi.stubEnv('ELECTRON_RENDERER_URL', '');

            const config = await loadConfig();

            expect(config.rendererUrl).toBe('');
        });
    });

    describe('shape', () => {
        it('exposes only the declared keys, dropping the rest of process.env', async () => {
            vi.stubEnv('ELECTRON_RENDERER_URL', 'http://localhost:5173');
            vi.stubEnv('LEAF_NOT_IN_THE_SCHEMA', 'ignored');

            const config = await loadConfig();

            expect(Object.keys(config)).toEqual(['rendererUrl']);
        });

        it('reads the environment once, so later mutation does not leak in', async () => {
            vi.stubEnv('ELECTRON_RENDERER_URL', 'http://localhost:5173');

            const config = await loadConfig();
            vi.stubEnv('ELECTRON_RENDERER_URL', 'http://localhost:9999');

            expect(config.rendererUrl).toBe('http://localhost:5173');
        });
    });
});
