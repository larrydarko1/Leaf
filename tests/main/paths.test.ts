import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import path from 'path';
import os from 'os';

// Prevent electron-log → electron binary from being loaded in CI.
vi.mock('electron', () => ({
    app: { getPath: vi.fn(), getVersion: vi.fn() },
}));

vi.mock('../../src/main/lib/logger', () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

/**
 * Mock fs before importing the module. We delegate to the real fs by default
 * so unrelated imports (e.g. the logger) keep working; tests override the
 * returned mock fns as needed.
 */
vi.mock('fs', async () => {
    const actual = await vi.importActual<typeof import('fs')>('fs');
    const existsSync = vi.fn(actual.existsSync);
    const mkdirSync = vi.fn(actual.mkdirSync);
    const renameSync = vi.fn(actual.renameSync);
    return {
        ...actual,
        existsSync,
        mkdirSync,
        renameSync,
        default: {
            ...actual,
            existsSync,
            mkdirSync,
            renameSync,
        },
    };
});

import fs from 'fs';
import {
    LEAF_HOME,
    DEFAULT_MODELS_DIR,
    PROMPTS_DIR,
    STATE_FILE,
    getWhisperModelDir,
    getBundledPromptsDir,
    migrateLegacyPaths,
} from '../../src/main/lib/paths';

describe('paths', () => {
    describe('LEAF_HOME', () => {
        it('is ~/.leaf', () => {
            expect(LEAF_HOME).toBe(path.join(os.homedir(), '.leaf'));
        });
    });

    describe('DEFAULT_MODELS_DIR', () => {
        it('is under LEAF_HOME', () => {
            expect(DEFAULT_MODELS_DIR.startsWith(LEAF_HOME)).toBe(true);
        });

        it('equals ~/.leaf/models', () => {
            expect(DEFAULT_MODELS_DIR).toBe(path.join(os.homedir(), '.leaf', 'models'));
        });
    });

    describe('PROMPTS_DIR', () => {
        it('equals ~/.leaf/prompts', () => {
            expect(PROMPTS_DIR).toBe(path.join(os.homedir(), '.leaf', 'prompts'));
        });
    });

    describe('STATE_FILE', () => {
        it('equals ~/.leaf/state.json', () => {
            expect(STATE_FILE).toBe(path.join(os.homedir(), '.leaf', 'state.json'));
        });
    });

    describe('migrateLegacyPaths', () => {
        const legacyDir = path.join(os.homedir(), 'leaf-models');

        beforeEach(() => {
            vi.mocked(fs.existsSync).mockReset();
            vi.mocked(fs.mkdirSync).mockReset();
            vi.mocked(fs.renameSync).mockReset();
        });

        it('is a no-op when legacy dir does not exist', () => {
            vi.mocked(fs.existsSync).mockReturnValue(false);
            migrateLegacyPaths();
            expect(fs.renameSync).not.toHaveBeenCalled();
            expect(fs.mkdirSync).not.toHaveBeenCalled();
        });

        it('skips migration when both legacy and new dirs exist', () => {
            vi.mocked(fs.existsSync).mockImplementation((p) => {
                if (p === legacyDir) return true;
                if (p === DEFAULT_MODELS_DIR) return true;
                return false;
            });
            migrateLegacyPaths();
            expect(fs.renameSync).not.toHaveBeenCalled();
        });

        it('renames legacy → new when only legacy exists', () => {
            vi.mocked(fs.existsSync).mockImplementation((p) => p === legacyDir);
            vi.mocked(fs.mkdirSync).mockImplementation(() => undefined);
            vi.mocked(fs.renameSync).mockImplementation(() => undefined);
            migrateLegacyPaths();
            expect(fs.mkdirSync).toHaveBeenCalledWith(LEAF_HOME, { recursive: true });
            expect(fs.renameSync).toHaveBeenCalledWith(legacyDir, DEFAULT_MODELS_DIR);
        });

        it('swallows errors instead of throwing', () => {
            vi.mocked(fs.existsSync).mockImplementation((p) => p === legacyDir);
            vi.mocked(fs.renameSync).mockImplementation(() => {
                throw new Error('boom');
            });
            expect(() => migrateLegacyPaths()).not.toThrow();
        });
    });

    describe('getWhisperModelDir', () => {
        const originalResourcesPath = process.resourcesPath;

        beforeEach(() => {
            vi.mocked(fs.existsSync).mockReset();
            (process as { resourcesPath?: string }).resourcesPath = originalResourcesPath;
        });

        afterEach(() => {
            (process as { resourcesPath?: string }).resourcesPath = originalResourcesPath;
        });

        it('returns dev path when resourcesPath is undefined', () => {
            (process as { resourcesPath?: string }).resourcesPath = undefined;
            const result = getWhisperModelDir();
            expect(result).toContain('models/whisper');
            expect(result).not.toContain('Resources/models');
        });

        it('returns production path when resourcesPath is set and path exists', () => {
            (process as { resourcesPath?: string }).resourcesPath = '/app/Contents/Resources';
            vi.mocked(fs.existsSync).mockReturnValue(true);

            const result = getWhisperModelDir();
            expect(result).toBe(path.join('/app/Contents/Resources', 'models/whisper'));
        });

        it('falls back to dev path when resourcesPath is set but path does not exist', () => {
            (process as { resourcesPath?: string }).resourcesPath = '/app/Contents/Resources';
            vi.mocked(fs.existsSync).mockReturnValue(false);

            const result = getWhisperModelDir();
            expect(result).toContain('models/whisper');
            expect(result).not.toContain('/app/Contents/Resources');
        });
    });

    describe('getBundledPromptsDir', () => {
        const originalResourcesPath = process.resourcesPath;

        beforeEach(() => {
            vi.mocked(fs.existsSync).mockReset();
            (process as { resourcesPath?: string }).resourcesPath = originalResourcesPath;
        });

        afterEach(() => {
            (process as { resourcesPath?: string }).resourcesPath = originalResourcesPath;
        });

        it('returns dev path when resourcesPath is undefined', () => {
            (process as { resourcesPath?: string }).resourcesPath = undefined;
            const result = getBundledPromptsDir();
            expect(result).toContain('assets/prompts');
        });

        it('returns production path when resourcesPath is set and path exists', () => {
            (process as { resourcesPath?: string }).resourcesPath = '/app/Contents/Resources';
            vi.mocked(fs.existsSync).mockReturnValue(true);
            const result = getBundledPromptsDir();
            expect(result).toBe(path.join('/app/Contents/Resources', 'assets/prompts'));
        });

        it('falls back to dev path when production path does not exist', () => {
            (process as { resourcesPath?: string }).resourcesPath = '/app/Contents/Resources';
            vi.mocked(fs.existsSync).mockReturnValue(false);
            const result = getBundledPromptsDir();
            expect(result).toContain('assets/prompts');
            expect(result).not.toContain('/app/Contents/Resources');
        });
    });
});
