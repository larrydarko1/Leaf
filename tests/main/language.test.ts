import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import fs from 'fs';

// ── Hoisted shared paths ──────────────────────────────────────────────────────

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

// ── Mock electron ─────────────────────────────────────────────────────────────

vi.mock('electron', () => ({
    shell: { openPath: vi.fn().mockResolvedValue('') },
}));

// ── Mock logger ───────────────────────────────────────────────────────────────

vi.mock('../../src/main/lib/logger', () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// ── Mock paths ────────────────────────────────────────────────────────────────

vi.mock('../../src/main/lib/paths', () => ({
    LEAF_HOME: PATHS.LEAF_HOME,
    LOCALES_DIR: PATHS.LOCALES_DIR,
    STATE_FILE: PATHS.STATE_FILE,
    getBundledLocalesDir: () => PATHS.BUNDLED_DIR,
}));

const { LEAF_HOME, LOCALES_DIR, STATE_FILE, BUNDLED_DIR } = PATHS;

// ── Test utilities ────────────────────────────────────────────────────────────

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

beforeEach(() => {
    resetTmp();
    vi.resetModules();
});

afterEach(() => {
    resetTmp();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('language service', () => {
    it('ensures locales directory exists on first seeding', async () => {
        writeBundledLocale('en', { common: { save: 'Save' } });
        const { ensureSeeded } = await import('../../src/main/services/language');
        await ensureSeeded();
        expect(fs.existsSync(LOCALES_DIR)).toBe(true);
    });

    it('copies bundled locale files to ~/.leaf/locales/ on first seed', async () => {
        writeBundledLocale('en', { common: { save: 'Save' } });
        writeBundledLocale('it', { common: { save: 'Salva' } });
        const { ensureSeeded } = await import('../../src/main/services/language');
        await ensureSeeded();
        expect(fs.existsSync(path.join(LOCALES_DIR, 'en.json'))).toBe(true);
        expect(fs.existsSync(path.join(LOCALES_DIR, 'it.json'))).toBe(true);
    });

    it('does not overwrite existing locale files when seeding', async () => {
        writeBundledLocale('en', { common: { save: 'Save' } });
        // Write existing locale with different content
        fs.mkdirSync(LOCALES_DIR, { recursive: true });
        fs.writeFileSync(path.join(LOCALES_DIR, 'en.json'), JSON.stringify({ custom: true }));
        const { ensureSeeded } = await import('../../src/main/services/language');
        await ensureSeeded();
        const content = JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, 'en.json'), 'utf-8'));
        expect(content.custom).toBe(true);
        expect(content.common).toBeUndefined();
    });

    it('is idempotent — calling ensureSeeded twice only copies once', async () => {
        writeBundledLocale('en', { common: { save: 'Save' } });
        const { ensureSeeded } = await import('../../src/main/services/language');
        await ensureSeeded();
        const stats1 = fs.statSync(path.join(LOCALES_DIR, 'en.json'));
        // Small delay to ensure timestamps would differ
        await new Promise((resolve) => setTimeout(resolve, 10));
        await ensureSeeded();
        const stats2 = fs.statSync(path.join(LOCALES_DIR, 'en.json'));
        expect(stats1.mtimeMs).toBe(stats2.mtimeMs);
    });

    describe('listLanguages', () => {
        it('returns all language files from ~/.leaf/locales/', async () => {
            fs.mkdirSync(LOCALES_DIR, { recursive: true });
            fs.writeFileSync(path.join(LOCALES_DIR, 'en.json'), JSON.stringify({ common: {} }));
            fs.writeFileSync(path.join(LOCALES_DIR, 'it.json'), JSON.stringify({ common: {} }));
            const { listLanguages } = await import('../../src/main/services/language');
            const result = await listLanguages();
            expect(result.success).toBe(true);
            expect(result.languages).toHaveLength(2);
            const ids = result.languages?.map((l) => l.id).sort();
            expect(ids).toEqual(['en', 'it']);
        });

        it('returns active language id from state', async () => {
            fs.mkdirSync(LOCALES_DIR, { recursive: true });
            fs.writeFileSync(path.join(LOCALES_DIR, 'en.json'), JSON.stringify({ common: {} }));
            writeState({ activeLanguage: 'en' });
            const { listLanguages } = await import('../../src/main/services/language');
            const result = await listLanguages();
            expect(result.activeId).toBe('en');
        });

        it('defaults to "en" when activeLanguage is not in state', async () => {
            fs.mkdirSync(LOCALES_DIR, { recursive: true });
            fs.writeFileSync(path.join(LOCALES_DIR, 'en.json'), JSON.stringify({ common: {} }));
            writeState({});
            const { listLanguages } = await import('../../src/main/services/language');
            const result = await listLanguages();
            expect(result.activeId).toBe('en');
        });

        it('returns empty list when locales directory does not exist', async () => {
            const { listLanguages } = await import('../../src/main/services/language');
            const result = await listLanguages();
            expect(result.success).toBe(true);
            expect(result.languages).toEqual([]);
        });

        it('ignores non-.json files in locales directory', async () => {
            fs.mkdirSync(LOCALES_DIR, { recursive: true });
            fs.writeFileSync(path.join(LOCALES_DIR, 'en.json'), JSON.stringify({ common: {} }));
            fs.writeFileSync(path.join(LOCALES_DIR, 'README.md'), '# Locales');
            const { listLanguages } = await import('../../src/main/services/language');
            const result = await listLanguages();
            expect(result.languages).toHaveLength(1);
            expect(result.languages?.[0].id).toBe('en');
        });

        it('returns localesDir path in response', async () => {
            fs.mkdirSync(LOCALES_DIR, { recursive: true });
            const { listLanguages } = await import('../../src/main/services/language');
            const result = await listLanguages();
            expect(result.localesDir).toBe(LOCALES_DIR);
        });
    });

    describe('setActiveLanguage', () => {
        beforeEach(() => {
            fs.mkdirSync(LOCALES_DIR, { recursive: true });
            fs.writeFileSync(path.join(LOCALES_DIR, 'en.json'), JSON.stringify({ common: {} }));
            fs.writeFileSync(path.join(LOCALES_DIR, 'it.json'), JSON.stringify({ common: {} }));
            writeState({});
        });

        it('updates activeLanguage in state', async () => {
            const { setActiveLanguage } = await import('../../src/main/services/language');
            await setActiveLanguage('it');
            const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
            expect(state.activeLanguage).toBe('it');
        });

        it('returns success when language file exists', async () => {
            const { setActiveLanguage } = await import('../../src/main/services/language');
            const result = await setActiveLanguage('it');
            expect(result.success).toBe(true);
        });

        it('returns error when language file does not exist', async () => {
            const { setActiveLanguage } = await import('../../src/main/services/language');
            const result = await setActiveLanguage('fr');
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('rejects invalid language ids', async () => {
            const { setActiveLanguage } = await import('../../src/main/services/language');
            const result = await setActiveLanguage('../../../etc/passwd');
            expect(result.success).toBe(false);
        });

        it('preserves other state properties when updating activeLanguage', async () => {
            writeState({ activeTheme: 'dark', activePrompt: 'coding' });
            const { setActiveLanguage } = await import('../../src/main/services/language');
            await setActiveLanguage('it');
            const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
            expect(state.activeLanguage).toBe('it');
            expect(state.activeTheme).toBe('dark');
            expect(state.activePrompt).toBe('coding');
        });
    });

    describe('isValidLanguageId', () => {
        it('accepts alphanumeric ids with hyphens and underscores', async () => {
            const { isValidLanguageId } = await import('../../src/main/services/language');
            expect(isValidLanguageId('en')).toBe(true);
            expect(isValidLanguageId('en_US')).toBe(true);
            expect(isValidLanguageId('zh-Hans')).toBe(true);
            expect(isValidLanguageId('pt_BR')).toBe(true);
        });

        it('rejects path traversal attempts', async () => {
            const { isValidLanguageId } = await import('../../src/main/services/language');
            expect(isValidLanguageId('../../../etc/passwd')).toBe(false);
            expect(isValidLanguageId('..\\windows\\system32')).toBe(false);
        });

        it('rejects special characters', async () => {
            const { isValidLanguageId } = await import('../../src/main/services/language');
            expect(isValidLanguageId('en;rm -rf /')).toBe(false);
            expect(isValidLanguageId('en`whoami`')).toBe(false);
            expect(isValidLanguageId('en$(cat /etc/passwd)')).toBe(false);
        });

        it('rejects empty strings', async () => {
            const { isValidLanguageId } = await import('../../src/main/services/language');
            expect(isValidLanguageId('')).toBe(false);
        });
    });
});
