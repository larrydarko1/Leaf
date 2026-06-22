import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('electron', () => ({}));
vi.mock('@/main/lib/logger', () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/main/lib/paths', () => ({
    DEFAULT_MODELS_DIR: '/fake/models',
}));

import { register } from '@/main/services/hf-download';

let handlers: Record<string, (...args: unknown[]) => unknown>;

beforeEach(() => {
    handlers = {};
    const ipc = {
        handle: vi.fn((ch: string, fn: (...args: unknown[]) => unknown) => {
            handlers[ch] = fn;
        }),
    };
    register(ipc as never, () => null);
});

// ── hf:getActiveDownloads ─────────────────────────────────────────────────────

describe('hf:getActiveDownloads', () => {
    it('returns an empty list when no downloads are active', () => {
        const result = handlers['hf:getActiveDownloads']?.() as { success: boolean; downloads: string[] };
        expect(result.success).toBe(true);
        expect(result.downloads).toHaveLength(0);
    });
});

// ── hf:cancelDownload ─────────────────────────────────────────────────────────

describe('hf:cancelDownload', () => {
    it('returns failure for non-string fileName', async () => {
        const result = (await handlers['hf:cancelDownload']?.({}, 123)) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('returns failure when no active download exists for the file', async () => {
        const result = (await handlers['hf:cancelDownload']?.({}, 'missing.gguf')) as {
            success: boolean;
            error: string;
        };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/no active download/i);
    });
});

// ── hf:download URL and filename validation ───────────────────────────────────

describe('hf:download', () => {
    it('returns failure for non-string arguments', async () => {
        const result = (await handlers['hf:download']?.({}, 123, 'model.gguf')) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('rejects a non-HTTPS URL', async () => {
        const result = (await handlers['hf:download']?.({}, 'http://huggingface.co/model.gguf', 'model.gguf')) as {
            success: boolean;
            error: string;
        };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/https/i);
    });

    it('rejects a URL from a disallowed host', async () => {
        const result = (await handlers['hf:download']?.({}, 'https://evil.com/model.gguf', 'model.gguf')) as {
            success: boolean;
            error: string;
        };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/hugging face/i);
    });

    it('accepts huggingface.co as a valid host', async () => {
        // Will fail past URL validation (network error) but NOT with a URL-rejection error
        const result = (await handlers['hf:download']?.(
            {},
            'https://huggingface.co/repo/resolve/main/model.gguf',
            'model.gguf',
        )) as { success: boolean; error?: string };
        // If it fails it should be for a non-URL-validation reason (mkdir, network, etc.)
        if (!result.success) {
            expect(result.error).not.toMatch(/https/i);
            expect(result.error).not.toMatch(/hugging face/i);
        }
    });

    it('rejects a filename with path separators', async () => {
        const result = (await handlers['hf:download']?.(
            {},
            'https://huggingface.co/r/resolve/main/model.gguf',
            '../evil.gguf',
        )) as { success: boolean; error: string };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/filename/i);
    });

    it('rejects an empty filename', async () => {
        const result = (await handlers['hf:download']?.(
            {},
            'https://huggingface.co/r/resolve/main/model.gguf',
            '',
        )) as { success: boolean; error: string };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/filename/i);
    });

    it('accepts an hf.co subdomain as a valid host', async () => {
        const result = (await handlers['hf:download']?.({}, 'https://cdn-lfs.hf.co/model.gguf', 'model.gguf')) as {
            success: boolean;
            error?: string;
        };
        if (!result.success) {
            expect(result.error).not.toMatch(/hugging face/i);
        }
    });
});

// ── hf:search ─────────────────────────────────────────────────────────────────

describe('hf:search', () => {
    it('returns failure for non-string query', async () => {
        const result = (await handlers['hf:search']?.({}, 123)) as { success: boolean; error: string };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/invalid arguments/i);
    });
});

// ── hf:listFiles ──────────────────────────────────────────────────────────────

describe('hf:listFiles', () => {
    it('returns failure for non-string repoId', async () => {
        const result = (await handlers['hf:listFiles']?.({}, 123)) as { success: boolean; error: string };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/invalid repoId/i);
    });

    it('returns failure for a string that does not match owner/repo format', async () => {
        const result = (await handlers['hf:listFiles']?.({}, 'notarepo')) as { success: boolean; error: string };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/invalid repoId/i);
    });

    it('returns failure for a repoId with path traversal', async () => {
        const result = (await handlers['hf:listFiles']?.({}, '../owner/repo')) as { success: boolean; error: string };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/invalid repoId/i);
    });
});
