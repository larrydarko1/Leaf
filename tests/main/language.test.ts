import fs from 'fs';
import path from 'path';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const PATHS = vi.hoisted(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { join } = require('path') as typeof import('path');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { tmpdir } = require('os') as typeof import('os');
    const tmpRoot = join(tmpdir(), `leaf-language-test-${process.pid}-${Date.now()}`);
    const leafHome = join(tmpRoot, '.leaf');
    return {
        TMP_ROOT: tmpRoot,
        LEAF_HOME: leafHome,
        LOCALES_DIR: join(leafHome, 'locales'),
        STATE_FILE: join(leafHome, 'state.json'),
        BUNDLED_DIR: join(tmpRoot, 'bundled-locales'),
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
    LOCALES_DIR: PATHS.LOCALES_DIR,
    STATE_FILE: PATHS.STATE_FILE,
    getBundledLocalesDir: () => PATHS.BUNDLED_DIR,
}));

const { LEAF_HOME, LOCALES_DIR, STATE_FILE, BUNDLED_DIR } = PATHS;

function resetTmp() {
    fs.rmSync(LEAF_HOME, { recursive: true, force: true });
    fs.rmSync(BUNDLED_DIR, { recursive: true, force: true });
    fs.mkdirSync(BUNDLED_DIR, { recursive: true });
}

function writeBundledLocale(id: string, content: Record<string, unknown>) {
    fs.writeFileSync(path.join(BUNDLED_DIR, `${id}.json`), JSON.stringify(content));
}

function writeState(state: Record<string, unknown>) {
    fs.mkdirSync(LEAF_HOME, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(state));
}

async function freshService() {
    const { register } = await import('@/main/services/language');
    const handlers: Record<string, (...args: unknown[]) => unknown> = {};
    register({
        handle: vi.fn((channel: string, fn: (...args: unknown[]) => unknown) => {
            handlers[channel] = fn;
        }),
    } as never);
    return {
        list: () =>
            handlers['language:list']!({}) as Promise<{
                success: boolean;
                languages?: { id: string; name: string }[];
                activeId: string;
                localesDir: string;
                error?: string;
            }>,
        setActive: (id: unknown) =>
            handlers['language:setActive']!({}, id) as Promise<{ success: boolean; error?: string }>,
        load: (id: unknown) =>
            handlers['language:load']!({}, id) as Promise<{
                success: boolean;
                content?: Record<string, unknown>;
                error?: string;
            }>,
    };
}

beforeEach(() => {
    resetTmp();
    vi.resetModules();
});

afterEach(() => {
    resetTmp();
});

describe('language service', () => {
    it('ensures locales directory exists on first seeding', async () => {
        writeBundledLocale('en', { common: { save: 'Save' } });
        const svc = await freshService();
        await svc.list();
        expect(fs.existsSync(LOCALES_DIR)).toBe(true);
    });

    it('copies bundled locale files to ~/.leaf/locales/ on first seed', async () => {
        writeBundledLocale('en', { common: { save: 'Save' } });
        writeBundledLocale('it', { common: { save: 'Salva' } });
        const svc = await freshService();
        await svc.list();
        expect(fs.existsSync(path.join(LOCALES_DIR, 'en.json'))).toBe(true);
        expect(fs.existsSync(path.join(LOCALES_DIR, 'it.json'))).toBe(true);
    });

    it('preserves existing values but backfills missing keys when seeding', async () => {
        writeBundledLocale('en', { common: { save: 'Save' } });
        fs.mkdirSync(LOCALES_DIR, { recursive: true });
        fs.writeFileSync(path.join(LOCALES_DIR, 'en.json'), JSON.stringify({ custom: true }));
        const svc = await freshService();
        await svc.list();
        const content = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf-8'));
        expect(content.custom).toBe(true);
        expect(content.common.save).toBe('Save');
    });

    it('is idempotent — listing twice only copies once', async () => {
        writeBundledLocale('en', { common: { save: 'Save' } });
        const svc = await freshService();
        await svc.list();
        const stats1 = fs.statSync(path.join(LOCALES_DIR, 'en.json'));
        await new Promise((resolve) => setTimeout(resolve, 10));
        await svc.list();
        const stats2 = fs.statSync(path.join(LOCALES_DIR, 'en.json'));
        expect(stats1.mtimeMs).toBe(stats2.mtimeMs);
    });

    describe('language:list', () => {
        it('returns all language files from ~/.leaf/locales/', async () => {
            fs.mkdirSync(LOCALES_DIR, { recursive: true });
            fs.writeFileSync(path.join(LOCALES_DIR, 'en.json'), JSON.stringify({ common: {} }));
            fs.writeFileSync(path.join(LOCALES_DIR, 'it.json'), JSON.stringify({ common: {} }));
            const svc = await freshService();
            const result = await svc.list();
            expect(result.success).toBe(true);
            expect(result.languages).toHaveLength(2);
            const ids = result.languages?.map((l) => l.id).sort();
            expect(ids).toEqual(['en', 'it']);
        });

        it('returns active language id from state', async () => {
            fs.mkdirSync(LOCALES_DIR, { recursive: true });
            fs.writeFileSync(path.join(LOCALES_DIR, 'en.json'), JSON.stringify({ common: {} }));
            writeState({ activeLanguage: 'en' });
            const svc = await freshService();
            const result = await svc.list();
            expect(result.activeId).toBe('en');
        });

        it('defaults to "en" when activeLanguage is not in state', async () => {
            fs.mkdirSync(LOCALES_DIR, { recursive: true });
            fs.writeFileSync(path.join(LOCALES_DIR, 'en.json'), JSON.stringify({ common: {} }));
            writeState({});
            const svc = await freshService();
            const result = await svc.list();
            expect(result.activeId).toBe('en');
        });

        it('returns empty list when locales directory does not exist', async () => {
            const svc = await freshService();
            const result = await svc.list();
            expect(result.success).toBe(true);
            expect(result.languages).toEqual([]);
        });

        it('ignores non-.json files in locales directory', async () => {
            fs.mkdirSync(LOCALES_DIR, { recursive: true });
            fs.writeFileSync(path.join(LOCALES_DIR, 'en.json'), JSON.stringify({ common: {} }));
            fs.writeFileSync(path.join(LOCALES_DIR, 'README.md'), '# Locales');
            const svc = await freshService();
            const result = await svc.list();
            expect(result.languages).toHaveLength(1);
            expect(result.languages?.[0]!.id).toBe('en');
        });

        it('returns localesDir path in response', async () => {
            fs.mkdirSync(LOCALES_DIR, { recursive: true });
            const svc = await freshService();
            const result = await svc.list();
            expect(result.localesDir).toBe(LOCALES_DIR);
        });
    });

    describe('language:setActive', () => {
        beforeEach(() => {
            fs.mkdirSync(LOCALES_DIR, { recursive: true });
            fs.writeFileSync(path.join(LOCALES_DIR, 'en.json'), JSON.stringify({ common: {} }));
            fs.writeFileSync(path.join(LOCALES_DIR, 'it.json'), JSON.stringify({ common: {} }));
            writeState({});
        });

        it('updates activeLanguage in state', async () => {
            const svc = await freshService();
            await svc.setActive('it');
            const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
            expect(state.activeLanguage).toBe('it');
        });

        it('returns success when language file exists', async () => {
            const svc = await freshService();
            const result = await svc.setActive('it');
            expect(result.success).toBe(true);
        });

        it('returns error when language file does not exist', async () => {
            const svc = await freshService();
            const result = await svc.setActive('fr');
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('rejects invalid language ids', async () => {
            const svc = await freshService();
            const result = await svc.setActive('../../../etc/passwd');
            expect(result.success).toBe(false);
        });

        it('preserves other state properties when updating activeLanguage', async () => {
            writeState({ activeTheme: 'dark', activePrompt: 'coding' });
            const svc = await freshService();
            await svc.setActive('it');
            const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
            expect(state.activeLanguage).toBe('it');
            expect(state.activeTheme).toBe('dark');
            expect(state.activePrompt).toBe('coding');
        });
    });

    describe('language id validation, via language:setActive', () => {
        it.each(['en', 'en_US', 'zh-Hans', 'pt_BR'])('accepts the well-formed id %s', async (id) => {
            const svc = await freshService();
            const result = await svc.setActive(id);
            expect(result.error).toBe('Language not found');
        });

        it.each(['../../../etc/passwd', '..\\windows\\system32'])('rejects the traversal attempt %s', async (id) => {
            const svc = await freshService();
            const result = await svc.setActive(id);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid language id');
        });

        it.each(['en;rm -rf /', 'en`whoami`', 'en$(cat /etc/passwd)', ''])(
            'rejects the special-character id %s',
            async (id) => {
                const svc = await freshService();
                const result = await svc.setActive(id);
                expect(result.success).toBe(false);
                expect(result.error).toBe('Invalid language id');
            },
        );

        it('rejects a non-string id before it reaches the service', async () => {
            const svc = await freshService();
            const result = await svc.setActive(123);
            expect(result.success).toBe(false);
            expect(result.error).toBe('Invalid language id');
        });
    });

    describe('language:load', () => {
        beforeEach(() => {
            fs.mkdirSync(LOCALES_DIR, { recursive: true });
        });

        it('returns content for a valid existing language file', async () => {
            fs.writeFileSync(path.join(LOCALES_DIR, 'en.json'), JSON.stringify({ common: { save: 'Save' } }));
            const svc = await freshService();
            const result = await svc.load('en');
            expect(result.success).toBe(true);
            expect(result.content?.['common']).toBeDefined();
        });

        it('returns failure for invalid language id', async () => {
            const svc = await freshService();
            const result = await svc.load('../../../etc/passwd');
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/invalid language id/i);
        });

        it('returns failure when language file does not exist', async () => {
            const svc = await freshService();
            const result = await svc.load('fr');
            expect(result.success).toBe(false);
            expect(result.error).toMatch(/not found/i);
        });

        it('returns failure when file contains invalid JSON', async () => {
            fs.writeFileSync(path.join(LOCALES_DIR, 'en.json'), 'not valid json{{');
            const svc = await freshService();
            const result = await svc.load('en');
            expect(result.success).toBe(false);
        });
    });

    describe('register', () => {
        it('registers all language IPC handlers', async () => {
            const { register } = await import('@/main/services/language');
            const handles: string[] = [];
            const ipc = {
                handle: vi.fn((ch: string) => {
                    handles.push(ch);
                }),
            };
            register(ipc as never);
            expect(handles).toContain('language:list');
            expect(handles).toContain('language:setActive');
            expect(handles).toContain('language:load');
            expect(handles).toContain('language:openLeafDir');
        });
    });
});
