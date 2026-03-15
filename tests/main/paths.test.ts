import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';
import os from 'os';

// Mock fs before importing the module
vi.mock('fs', () => ({
    default: { existsSync: vi.fn() },
    existsSync: vi.fn(),
}));

import fs from 'fs';
import { DEFAULT_MODELS_DIR, getWhisperModelDir } from '../../src/main/lib/paths';

describe('paths', () => {
    describe('DEFAULT_MODELS_DIR', () => {
        it('is under home directory', () => {
            expect(DEFAULT_MODELS_DIR.startsWith(os.homedir())).toBe(true);
        });

        it('ends with leaf-models', () => {
            expect(DEFAULT_MODELS_DIR.endsWith('leaf-models')).toBe(true);
        });

        it('equals path.join(homedir, leaf-models)', () => {
            expect(DEFAULT_MODELS_DIR).toBe(path.join(os.homedir(), 'leaf-models'));
        });
    });

    describe('getWhisperModelDir', () => {
        const originalResourcesPath = process.resourcesPath;

        beforeEach(() => {
            vi.mocked(fs.existsSync).mockReset();
            // Reset resourcesPath
            (process as { resourcesPath?: string }).resourcesPath = originalResourcesPath;
        });

        it('returns dev path when resourcesPath is undefined', () => {
            (process as { resourcesPath?: string }).resourcesPath = undefined;
            const result = getWhisperModelDir();
            expect(result).toContain('models/whisper');
            // Should not contain 'Resources' (production path marker)
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
});
