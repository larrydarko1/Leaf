import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

vi.mock('electron', () => ({}));
vi.mock('@/main/lib/logger', () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { register } from '@/main/services/media';

let tmpDir: string;
let vaultRoot: string;
let handlers: Record<string, (...args: unknown[]) => Promise<unknown>>;

beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'leaf-media-'));
    vaultRoot = tmpDir;

    handlers = {};
    const ipc = {
        handle: vi.fn((channel: string, fn: (...args: unknown[]) => Promise<unknown>) => {
            handlers[channel] = fn;
        }),
    };
    register(ipc as never, () => vaultRoot);
});

afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('audio:saveRecording', () => {
    it('saves a base64-encoded file inside the vault', async () => {
        const fileName = 'recording.wav';
        const base64 = Buffer.from('audio data').toString('base64');
        const result = (await handlers['audio:saveRecording']?.({}, vaultRoot, fileName, base64)) as {
            success: boolean;
            path: string;
        };
        expect(result.success).toBe(true);
        expect(fs.existsSync(result.path)).toBe(true);
    });

    it('saves into a subdirectory of the vault', async () => {
        const subDir = path.join(vaultRoot, 'recordings');
        fs.mkdirSync(subDir);
        const base64 = Buffer.from('audio').toString('base64');
        const result = (await handlers['audio:saveRecording']?.({}, subDir, 'rec.wav', base64)) as { success: boolean };
        expect(result.success).toBe(true);
    });

    it('rejects a filename with path traversal', async () => {
        const base64 = Buffer.from('x').toString('base64');
        const result = (await handlers['audio:saveRecording']?.({}, vaultRoot, '../evil.wav', base64)) as {
            success: boolean;
        };
        expect(result.success).toBe(false);
    });

    it('rejects a folder path outside the vault', async () => {
        const outsideDir = fs.mkdtempSync(path.join(os.tmpdir(), 'outside-'));
        const base64 = Buffer.from('x').toString('base64');
        const result = (await handlers['audio:saveRecording']?.({}, outsideDir, 'rec.wav', base64)) as {
            success: boolean;
            error: string;
        };
        fs.rmSync(outsideDir, { recursive: true, force: true });
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/outside the vault/i);
    });

    it('rejects when no vault is open', async () => {
        vaultRoot = null as unknown as string;
        const ipc = {
            handle: vi.fn((ch: string, fn: (...args: unknown[]) => Promise<unknown>) => {
                handlers[ch] = fn;
            }),
        };
        register(ipc as never, () => null);
        const base64 = Buffer.from('x').toString('base64');
        const result = (await handlers['audio:saveRecording']?.({}, tmpDir, 'rec.wav', base64)) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('rejects non-string arguments', async () => {
        const result = (await handlers['audio:saveRecording']?.({}, 123, 'rec.wav', 'base64')) as { success: boolean };
        expect(result.success).toBe(false);
    });
});

describe('spellcheck:getSuggestions', () => {
    it('always returns an empty suggestions array', async () => {
        const result = (await handlers['spellcheck:getSuggestions']?.()) as {
            success: boolean;
            suggestions: unknown[];
        };
        expect(result.success).toBe(true);
        expect(result.suggestions).toHaveLength(0);
    });
});
