import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const PATHS = vi.hoisted(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { join } = require('path') as typeof import('path');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { tmpdir } = require('os') as typeof import('os');
    const tmpRoot = join(tmpdir(), `leaf-theme-test-${process.pid}-${Date.now()}`);
    const leafHome = join(tmpRoot, '.leaf');
    return {
        LEAF_HOME: leafHome,
        THEMES_DIR: join(leafHome, 'themes'),
        STATE_FILE: join(leafHome, 'state.json'),
        BUNDLED_DIR: join(tmpRoot, 'bundled-themes'),
    };
});

vi.mock('electron', () => ({
    shell: { openPath: vi.fn().mockResolvedValue('') },
}));

vi.mock('@/main/lib/logger', () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/main/lib/paths', () => ({
    LEAF_HOME: PATHS.LEAF_HOME,
    THEMES_DIR: PATHS.THEMES_DIR,
    STATE_FILE: PATHS.STATE_FILE,
    getBundledThemesDir: () => PATHS.BUNDLED_DIR,
}));

const { LEAF_HOME, THEMES_DIR, STATE_FILE, BUNDLED_DIR } = PATHS;

function resetDirs() {
    fs.rmSync(LEAF_HOME, { recursive: true, force: true });
    fs.rmSync(BUNDLED_DIR, { recursive: true, force: true });
    fs.mkdirSync(BUNDLED_DIR, { recursive: true });
}

function writeBundledTheme(id: string, content: Record<string, unknown>) {
    fs.writeFileSync(path.join(BUNDLED_DIR, `${id}.json`), JSON.stringify(content));
}

function writeState(state: Record<string, unknown>) {
    fs.mkdirSync(LEAF_HOME, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
}

function writeTheme(id: string, content: Record<string, unknown>) {
    fs.mkdirSync(THEMES_DIR, { recursive: true });
    fs.writeFileSync(path.join(THEMES_DIR, `${id}.json`), JSON.stringify(content));
}

// Re-import each time to reset the `seeded` module-level flag
async function freshModule() {
    vi.resetModules();
    return await import('@/main/services/theme');
}

beforeEach(() => {
    resetDirs();
});

afterEach(() => {
    fs.rmSync(LEAF_HOME, { recursive: true, force: true });
    fs.rmSync(BUNDLED_DIR, { recursive: true, force: true });
});

describe('ensureSeeded', () => {
    it('copies bundled themes into THEMES_DIR', async () => {
        writeBundledTheme('dark', { name: 'Dark', colors: { bg: '#000' } });
        const { ensureSeeded } = await freshModule();
        await ensureSeeded();
        expect(fs.existsSync(path.join(THEMES_DIR, 'dark.json'))).toBe(true);
    });

    it('does not overwrite existing user themes', async () => {
        writeBundledTheme('dark', { name: 'Dark', colors: { bg: '#000' } });
        writeTheme('dark', { name: 'Custom Dark', colors: { bg: '#111' } });
        const { ensureSeeded } = await freshModule();
        await ensureSeeded();
        const content = JSON.parse(fs.readFileSync(path.join(THEMES_DIR, 'dark.json'), 'utf-8')) as Record<
            string,
            unknown
        >;
        expect((content as { name: string }).name).toBe('Custom Dark');
    });

    it('is idempotent — runs seeding only once', async () => {
        writeBundledTheme('dark', { name: 'Dark', colors: {} });
        const { ensureSeeded } = await freshModule();
        await ensureSeeded();
        writeBundledTheme('light', { name: 'Light', colors: {} });
        await ensureSeeded();
        // light.json should NOT exist because seeding was skipped the second time
        expect(fs.existsSync(path.join(THEMES_DIR, 'light.json'))).toBe(false);
    });

    it('handles a missing bundled dir gracefully', async () => {
        fs.rmSync(BUNDLED_DIR, { recursive: true, force: true });
        const { ensureSeeded } = await freshModule();
        await expect(ensureSeeded()).resolves.not.toThrow();
    });
});

describe('register — theme:list', () => {
    it('returns the list of themes and the active theme id', async () => {
        writeTheme('dark', { name: 'Dark', description: 'Dark theme', colors: { bg: '#000' } });
        writeState({ activeTheme: 'dark' });
        const { register } = await freshModule();

        const handlers: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
        const ipc = {
            handle: vi.fn((channel: string, fn: (...args: unknown[]) => Promise<unknown>) => {
                handlers[channel] = fn;
            }),
        };
        register(ipc as never);

        const result = (await handlers['theme:list']?.()) as {
            success: boolean;
            themes: { id: string }[];
            activeId: string;
        };
        expect(result.success).toBe(true);
        expect(result.themes).toHaveLength(1);
        expect(result.themes[0].id).toBe('dark');
        expect(result.activeId).toBe('dark');
    });

    it('returns dark as the default activeId when state has no activeTheme', async () => {
        writeTheme('dark', { name: 'Dark', colors: {} });
        const { register } = await freshModule();

        const handlers: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
        const ipc = {
            handle: vi.fn((ch: string, fn: (...args: unknown[]) => Promise<unknown>) => {
                handlers[ch] = fn;
            }),
        };
        register(ipc as never);

        const result = (await handlers['theme:list']?.()) as { activeId: string };
        expect(result.activeId).toBe('dark');
    });

    it('pins dark theme first, then alphabetical order', async () => {
        writeTheme('dark', { name: 'Dark', colors: {} });
        writeTheme('aurora', { name: 'Aurora', colors: {} });
        writeTheme('zen', { name: 'Zen', colors: {} });
        const { register } = await freshModule();

        const handlers: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
        const ipc = {
            handle: vi.fn((ch: string, fn: (...args: unknown[]) => Promise<unknown>) => {
                handlers[ch] = fn;
            }),
        };
        register(ipc as never);

        const result = (await handlers['theme:list']?.()) as { themes: { id: string }[] };
        const ids = result.themes.map((t) => t.id);
        expect(ids[0]).toBe('dark');
        expect(ids[1]).toBe('aurora');
        expect(ids[2]).toBe('zen');
    });

    it('skips files with invalid JSON', async () => {
        writeTheme('dark', { name: 'Dark', colors: {} });
        fs.writeFileSync(path.join(THEMES_DIR, 'bad.json'), 'not json');
        const { register } = await freshModule();

        const handlers: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
        const ipc = {
            handle: vi.fn((ch: string, fn: (...args: unknown[]) => Promise<unknown>) => {
                handlers[ch] = fn;
            }),
        };
        register(ipc as never);

        const result = (await handlers['theme:list']?.()) as { themes: unknown[] };
        expect(result.themes).toHaveLength(1);
    });

    it('strips unsafe color keys', async () => {
        writeTheme('dark', { name: 'Dark', colors: { 'bg-primary': '#000', '../../evil': 'red' } });
        const { register } = await freshModule();

        const handlers: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
        const ipc = {
            handle: vi.fn((ch: string, fn: (...args: unknown[]) => Promise<unknown>) => {
                handlers[ch] = fn;
            }),
        };
        register(ipc as never);

        const result = (await handlers['theme:list']?.()) as { themes: { colors: Record<string, string> }[] };
        const colors = result.themes[0].colors;
        expect(colors['bg-primary']).toBe('#000');
        expect(colors['../../evil']).toBeUndefined();
    });
});

describe('register — theme:setActive', () => {
    it('persists the active theme id', async () => {
        writeTheme('dark', { name: 'Dark', colors: {} });
        const { register } = await freshModule();

        const handlers: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
        const ipc = {
            handle: vi.fn((ch: string, fn: (...args: unknown[]) => Promise<unknown>) => {
                handlers[ch] = fn;
            }),
        };
        register(ipc as never);

        const result = (await handlers['theme:setActive']?.({}, 'dark')) as { success: boolean };
        expect(result.success).toBe(true);
        const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) as { activeTheme: string };
        expect(state.activeTheme).toBe('dark');
    });

    it('rejects a theme id with path traversal characters', async () => {
        const { register } = await freshModule();
        const handlers: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
        const ipc = {
            handle: vi.fn((ch: string, fn: (...args: unknown[]) => Promise<unknown>) => {
                handlers[ch] = fn;
            }),
        };
        register(ipc as never);

        const result = (await handlers['theme:setActive']?.({}, '../evil')) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('rejects an id longer than 64 characters', async () => {
        const { register } = await freshModule();
        const handlers: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
        const ipc = {
            handle: vi.fn((ch: string, fn: (...args: unknown[]) => Promise<unknown>) => {
                handlers[ch] = fn;
            }),
        };
        register(ipc as never);

        const result = (await handlers['theme:setActive']?.({}, 'a'.repeat(65))) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('rejects a non-existent theme id', async () => {
        const { register } = await freshModule();
        const handlers: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
        const ipc = {
            handle: vi.fn((ch: string, fn: (...args: unknown[]) => Promise<unknown>) => {
                handlers[ch] = fn;
            }),
        };
        register(ipc as never);

        const result = (await handlers['theme:setActive']?.({}, 'nonexistent')) as { success: boolean };
        expect(result.success).toBe(false);
    });
});
