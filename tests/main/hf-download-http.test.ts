/**
 * Extended hf-download tests that mock https to cover the HTTP call paths:
 * searchModels, listRepoFiles, downloadModel, and cancelDownload.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';

vi.mock('electron', () => ({}));
vi.mock('@/main/lib/logger', () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/main/lib/paths', () => ({
    DEFAULT_MODELS_DIR: '/fake/models',
}));

// vi.mock factories are hoisted — cannot reference variables from the outer scope.
// Define the mocks using inline vi.fn() and import the mocked modules after.
vi.mock('https', () => ({ default: { request: vi.fn() } }));
vi.mock('fs/promises', () => ({
    default: {
        mkdir: vi.fn().mockResolvedValue(undefined),
        stat: vi.fn().mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' })),
        rename: vi.fn().mockResolvedValue(undefined),
        unlink: vi.fn().mockResolvedValue(undefined),
    },
}));
vi.mock('fs', () => ({
    default: { watch: vi.fn() },
    createWriteStream: vi.fn(),
    watch: vi.fn(),
}));

import { register } from '@/main/services/hf-download';
import https from 'https';
import fs from 'fs/promises';
import * as fsModule from 'fs';

const mockHttps = https as unknown as { request: ReturnType<typeof vi.fn> };
const mockFs = fs as unknown as {
    mkdir: ReturnType<typeof vi.fn>;
    stat: ReturnType<typeof vi.fn>;
    rename: ReturnType<typeof vi.fn>;
    unlink: ReturnType<typeof vi.fn>;
};

// ── HTTP mock helpers ────────────────────────────────────────────────────────

function makeResponse(statusCode: number, body: string, headers: Record<string, string> = {}) {
    const res = new EventEmitter() as NodeJS.EventEmitter & {
        statusCode: number;
        headers: Record<string, string>;
    };
    res.statusCode = statusCode;
    res.headers = headers;
    return res;
}

type ResCb = (res: ReturnType<typeof makeResponse>) => void;

// Each call to setupHttpMock captures its own callback via mockImplementationOnce,
// so parallel requests (e.g. Promise.all in listRepoFiles) each get the right cb.
function setupHttpMock(statusCode: number, body: string, headers: Record<string, string> = {}) {
    const res = makeResponse(statusCode, body, headers);
    mockHttps.request.mockImplementationOnce((_opts: unknown, cb: ResCb) => {
        const req = new EventEmitter() as NodeJS.EventEmitter & { end: () => void };
        req.end = vi.fn(() => {
            process.nextTick(() => {
                cb(res);
                process.nextTick(() => {
                    res.emit('data', body);
                    res.emit('end');
                });
            });
        });
        return req;
    });
    return res;
}

function setupHttpError(errorMessage: string) {
    mockHttps.request.mockImplementationOnce((_opts: unknown, _cb: ResCb) => {
        const req = new EventEmitter() as NodeJS.EventEmitter & { end: () => void };
        req.end = vi.fn(() => {
            process.nextTick(() => req.emit('error', new Error(errorMessage)));
        });
        return req;
    });
}

// ── Setup handlers ───────────────────────────────────────────────────────────

let handlers: Record<string, (...args: unknown[]) => unknown>;

beforeEach(() => {
    vi.clearAllMocks();
    mockFs.stat.mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
    mockFs.mkdir.mockResolvedValue(undefined);
    mockFs.rename.mockResolvedValue(undefined);
    mockFs.unlink.mockResolvedValue(undefined);
    vi.spyOn(fsModule, 'createWriteStream').mockReturnValue({ write: vi.fn(), close: vi.fn(), on: vi.fn() } as never);

    handlers = {};
    const ipc = {
        handle: vi.fn((ch: string, fn: (...args: unknown[]) => unknown) => {
            handlers[ch] = fn;
        }),
    };
    register(ipc as never, () => null);
});

// ── hf:search ─────────────────────────────────────────────────────────────────

describe('hf:search HTTP paths', () => {
    it('returns search results when API responds with valid model data', async () => {
        const sampleModel = {
            id: 'owner/model-7b',
            modelId: 'owner/model-7b',
            author: 'owner',
            downloads: 1000,
            likes: 50,
            tags: ['text-generation'],
            lastModified: '2024-01-01',
            gguf: { architecture: 'llama', total: 7e9 },
        };
        setupHttpMock(200, JSON.stringify([sampleModel]));

        const result = (await handlers['hf:search']?.({}, 'llama', 'downloads', 0)) as {
            success: boolean;
            results?: { id: string; downloads: number; parameterCount: string | null }[];
            hasMore?: boolean;
        };

        expect(result.success).toBe(true);
        expect(result.results).toHaveLength(1);
        expect(result.results?.[0]?.id).toBe('owner/model-7b');
        expect(result.results?.[0]?.parameterCount).toBe('7.0B');
        expect(result.hasMore).toBe(false);
    });

    it('sets hasMore when more results exist than the page size', async () => {
        // The page size is 20 — generate 21 results
        const models = Array.from({ length: 21 }, (_, i) => ({
            id: `owner/model-${i}`,
            modelId: `owner/model-${i}`,
            author: 'owner',
            downloads: i * 100,
            likes: i,
            tags: [],
            lastModified: '2024-01-01',
        }));
        setupHttpMock(200, JSON.stringify(models));

        const result = (await handlers['hf:search']?.({}, 'query')) as { success: boolean; hasMore?: boolean };
        expect(result.success).toBe(true);
        expect(result.hasMore).toBe(true);
    });

    it('uses "trending" sort parameter when specified', async () => {
        setupHttpMock(200, JSON.stringify([]));

        await handlers['hf:search']?.({}, 'test', 'trending', 0);

        const requestArgs = mockHttps.request.mock.calls[0] as [{ path: string }, unknown];
        expect(requestArgs[0].path).toContain('trendingScore');
    });

    it('uses "lastModified" sort parameter when specified', async () => {
        setupHttpMock(200, JSON.stringify([]));

        await handlers['hf:search']?.({}, 'test', 'lastModified', 0);

        const requestArgs = mockHttps.request.mock.calls[0] as [{ path: string }, unknown];
        expect(requestArgs[0].path).toContain('lastModified');
    });

    it('uses "likes" sort parameter when specified', async () => {
        setupHttpMock(200, JSON.stringify([]));

        await handlers['hf:search']?.({}, 'test', 'likes', 0);

        const requestArgs = mockHttps.request.mock.calls[0] as [{ path: string }, unknown];
        expect(requestArgs[0].path).toContain('likes');
    });

    it('defaults to "downloads" for unrecognized sort value', async () => {
        setupHttpMock(200, JSON.stringify([]));

        await handlers['hf:search']?.({}, 'test', 'invalid_sort', 0);

        const requestArgs = mockHttps.request.mock.calls[0] as [{ path: string }, unknown];
        expect(requestArgs[0].path).toContain('downloads');
    });

    it('returns search failure when API responds with HTTP error', async () => {
        setupHttpMock(500, 'Internal Server Error');

        const result = (await handlers['hf:search']?.({}, 'llama')) as { success: boolean; error?: string };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/search failed/i);
    });

    it('returns search failure on network error', async () => {
        setupHttpError('Connection refused');

        const result = (await handlers['hf:search']?.({}, 'llama')) as { success: boolean; error?: string };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/search failed/i);
    });

    it('returns search failure when response is invalid JSON', async () => {
        setupHttpMock(200, 'not valid json');

        const result = (await handlers['hf:search']?.({}, 'llama')) as { success: boolean; error?: string };
        expect(result.success).toBe(false);
    });

    it('formats large parameter counts (T for trillion)', async () => {
        const model = {
            id: 'big/model',
            modelId: 'big/model',
            author: 'big',
            downloads: 1,
            likes: 1,
            tags: [],
            lastModified: '2024-01-01',
            gguf: { total: 1.5e12 },
        };
        setupHttpMock(200, JSON.stringify([model]));

        const result = (await handlers['hf:search']?.({}, 'big')) as {
            success: boolean;
            results?: { parameterCount: string | null }[];
        };
        expect(result.results?.[0]?.parameterCount).toBe('1.5T');
    });

    it('formats medium parameter counts (M for million)', async () => {
        const model = {
            id: 'small/model',
            modelId: 'small/model',
            author: 'small',
            downloads: 1,
            likes: 1,
            tags: [],
            lastModified: '2024-01-01',
            gguf: { total: 350e6 },
        };
        setupHttpMock(200, JSON.stringify([model]));

        const result = (await handlers['hf:search']?.({}, 'small')) as {
            success: boolean;
            results?: { parameterCount: string | null }[];
        };
        expect(result.results?.[0]?.parameterCount).toBe('350M');
    });

    it('handles model with no gguf metadata', async () => {
        const model = {
            id: 'plain/model',
            modelId: 'plain/model',
            downloads: 10,
            likes: 1,
            tags: [],
            lastModified: '2024-01-01',
        };
        setupHttpMock(200, JSON.stringify([model]));

        const result = (await handlers['hf:search']?.({}, 'plain')) as {
            success: boolean;
            results?: { parameterCount: string | null; architecture: string | null }[];
        };
        expect(result.results?.[0]?.parameterCount).toBeNull();
        expect(result.results?.[0]?.architecture).toBeNull();
    });
});

// ── hf:listFiles ──────────────────────────────────────────────────────────────

describe('hf:listFiles HTTP paths', () => {
    function makeModelResponse(modelId = 'owner/model') {
        return JSON.stringify({
            id: modelId,
            modelId,
            downloads: 500,
            likes: 20,
            tags: [],
            lastModified: '2024-01-01',
            gguf: { architecture: 'llama', contextLength: 4096, total: 7e9 },
        });
    }

    function makeTreeResponse(files: { path: string; size: number }[]) {
        return JSON.stringify(
            files.map((f) => ({
                type: 'file',
                path: f.path,
                size: f.size,
                lfs: { size: f.size },
                oid: 'abc123',
            })),
        );
    }

    it('returns empty file list when repo has no GGUF files', async () => {
        setupHttpMock(200, makeModelResponse());
        setupHttpMock(200, JSON.stringify([])); // empty tree

        const result = (await handlers['hf:listFiles']?.({}, 'owner/model')) as {
            success: boolean;
            files: unknown[];
            modelInfo: { architecture: string | null };
        };
        expect(result.success).toBe(true);
        expect(result.files).toHaveLength(0);
        expect(result.modelInfo.architecture).toBe('llama');
    });

    it('returns files with metadata for a GGUF file in the tree', async () => {
        setupHttpMock(200, makeModelResponse());
        setupHttpMock(200, makeTreeResponse([{ path: 'model-Q4_K_M.gguf', size: 6_000_000_000 }]));

        const result = (await handlers['hf:listFiles']?.({}, 'owner/model')) as {
            success: boolean;
            files: {
                name: string;
                size: number;
                quantType: string | null;
                isSharded: boolean;
                tier: { label: string };
            }[];
        };
        expect(result.success).toBe(true);
        expect(result.files).toHaveLength(1);
        expect(result.files[0]?.quantType).toBe('Q4_K_M');
        expect(result.files[0]?.isSharded).toBe(false);
        expect(result.files[0]?.tier.label).toBe('Large');
    });

    it('groups sharded files into one entry', async () => {
        setupHttpMock(200, makeModelResponse());
        setupHttpMock(
            200,
            makeTreeResponse([
                { path: 'model-00001-of-00002.gguf', size: 2_000_000_000 },
                { path: 'model-00002-of-00002.gguf', size: 2_000_000_000 },
            ]),
        );

        const result = (await handlers['hf:listFiles']?.({}, 'owner/model')) as {
            success: boolean;
            files: { isSharded: boolean; shardCount: number }[];
        };
        expect(result.success).toBe(true);
        expect(result.files).toHaveLength(1);
        expect(result.files[0]?.isSharded).toBe(true);
        expect(result.files[0]?.shardCount).toBe(2);
    });

    it('classifies a 1 GB file as Small tier', async () => {
        setupHttpMock(200, makeModelResponse());
        setupHttpMock(200, makeTreeResponse([{ path: 'tiny-Q4.gguf', size: 1_000_000_000 }]));

        const result = (await handlers['hf:listFiles']?.({}, 'owner/model')) as {
            success: boolean;
            files: { tier: { label: string } }[];
        };
        expect(result.files[0]?.tier.label).toBe('Small');
    });

    it('classifies a 3 GB file as Medium tier', async () => {
        setupHttpMock(200, makeModelResponse());
        setupHttpMock(200, makeTreeResponse([{ path: 'mid.gguf', size: 3_000_000_000 }]));

        const result = (await handlers['hf:listFiles']?.({}, 'owner/model')) as {
            success: boolean;
            files: { tier: { label: string } }[];
        };
        expect(result.files[0]?.tier.label).toBe('Medium');
    });

    it('classifies a 20 GB file as Very Large tier', async () => {
        setupHttpMock(200, makeModelResponse());
        setupHttpMock(200, makeTreeResponse([{ path: 'huge.gguf', size: 20_000_000_000 }]));

        const result = (await handlers['hf:listFiles']?.({}, 'owner/model')) as {
            success: boolean;
            files: { tier: { label: string } }[];
        };
        expect(result.files[0]?.tier.label).toBe('Very Large');
    });

    it('classifies a 50 GB file as Extreme tier', async () => {
        setupHttpMock(200, makeModelResponse());
        setupHttpMock(200, makeTreeResponse([{ path: 'monster.gguf', size: 50_000_000_000 }]));

        const result = (await handlers['hf:listFiles']?.({}, 'owner/model')) as {
            success: boolean;
            files: { tier: { label: string } }[];
        };
        expect(result.files[0]?.tier.label).toBe('Extreme');
    });

    it('recurses into subdirectories in the tree', async () => {
        setupHttpMock(200, makeModelResponse());
        // First tree response includes a directory entry
        setupHttpMock(200, JSON.stringify([{ type: 'directory', path: 'quantized', oid: 'dir1' }]));
        // Second tree response (recursive fetch of the directory)
        setupHttpMock(200, makeTreeResponse([{ path: 'quantized/model-Q4.gguf', size: 2_000_000_000 }]));

        const result = (await handlers['hf:listFiles']?.({}, 'owner/model')) as {
            success: boolean;
            files: unknown[];
        };
        expect(result.success).toBe(true);
        expect(result.files).toHaveLength(1);
    });

    it('returns failure when API call fails', async () => {
        setupHttpError('DNS lookup failed');
        setupHttpError('DNS lookup failed');

        const result = (await handlers['hf:listFiles']?.({}, 'owner/model')) as {
            success: boolean;
            error?: string;
        };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/failed to list files/i);
    });

    it('returns the repoName from modelId', async () => {
        setupHttpMock(200, makeModelResponse('owner/my-model'));
        setupHttpMock(200, JSON.stringify([]));

        const result = (await handlers['hf:listFiles']?.({}, 'owner/my-model')) as {
            success: boolean;
            repoName: string;
        };
        expect(result.repoName).toBe('owner/my-model');
    });
});

// ── hf:download — paths that don't reach createWriteStream ──────────────────
// (createWriteStream is a named import captured at module load time and cannot
//  be intercepted via vi.mock in this test environment; we test the error paths
//  that resolve before the file-write step.)

describe('hf:download early-exit paths', () => {
    function makeHangingReq() {
        const req = new EventEmitter() as NodeJS.EventEmitter & { end: () => void };
        req.end = vi.fn(); // never calls back — hangs forever
        return req;
    }

    it('returns failure when model file already exists with content', async () => {
        mockFs.stat.mockResolvedValueOnce({ size: 1000 });

        const result = (await handlers['hf:download']?.(
            {},
            'https://huggingface.co/repo/resolve/main/model.gguf',
            'model.gguf',
        )) as { success: boolean; error?: string };

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/already exists/i);
    });

    it('returns failure when HTTP download returns non-200 status', async () => {
        mockHttps.request.mockImplementationOnce((_opts: unknown, cb: ResCb) => {
            const res = makeResponse(404, '', {});
            const req = new EventEmitter() as NodeJS.EventEmitter & { end: () => void };
            req.end = vi.fn(() => {
                process.nextTick(() => {
                    cb(res);
                    process.nextTick(() => res.emit('end'));
                });
            });
            return req;
        });

        const result = (await handlers['hf:download']?.(
            {},
            'https://huggingface.co/repo/resolve/main/model.gguf',
            'model.gguf',
        )) as { success: boolean; error?: string };

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/HTTP 404/i);
    });

    it('returns failure on network error during request', async () => {
        setupHttpError('ECONNRESET');

        const result = (await handlers['hf:download']?.(
            {},
            'https://huggingface.co/repo/resolve/main/model.gguf',
            'model.gguf',
        )) as { success: boolean; error?: string };

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/network error/i);
    });

    it('rejects a redirect to a non-HF host', async () => {
        mockHttps.request.mockImplementationOnce((_opts: unknown, cb: ResCb) => {
            const res = makeResponse(302, '', { location: 'https://evil.com/model.gguf' });
            const req = new EventEmitter() as NodeJS.EventEmitter & { end: () => void };
            req.end = vi.fn(() => {
                process.nextTick(() => {
                    cb(res);
                    process.nextTick(() => res.emit('end'));
                });
            });
            return req;
        });

        const result = (await handlers['hf:download']?.(
            {},
            'https://huggingface.co/repo/resolve/main/model.gguf',
            'model.gguf',
        )) as { success: boolean; error?: string };

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/hugging face/i);
    });

    it('returns failure when the same model is already being downloaded', async () => {
        // First download hangs indefinitely (stuck waiting for a response)
        mockHttps.request.mockImplementationOnce((_opts: unknown, _cb: ResCb) => makeHangingReq());

        const firstDownload = handlers['hf:download']?.(
            {},
            'https://huggingface.co/repo/resolve/main/dup.gguf',
            'dup.gguf',
        );
        // Let the event loop tick so activeDownloads.set() runs
        await new Promise((r) => setTimeout(r, 5));

        // Second attempt with the same filename
        const result = (await handlers['hf:download']?.(
            {},
            'https://huggingface.co/repo/resolve/main/dup.gguf',
            'dup.gguf',
        )) as { success: boolean; error?: string };

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/already being downloaded/i);

        // Clean up: force the first download to error out
        await handlers['hf:cancelDownload']?.({}, 'dup.gguf');
        void firstDownload; // let it hang — it will be GC'd
    });
});

// ── hf:cancelDownload — cancel a pending (not-yet-responded) download ────────

describe('hf:cancelDownload (cancel before response)', () => {
    it('cancels a download that is awaiting an HTTP response', async () => {
        let savedReq: (EventEmitter & { end: () => void }) | null = null;

        mockHttps.request.mockImplementationOnce((_options: unknown, _cb: unknown) => {
            const req = new EventEmitter() as EventEmitter & { end: () => void };
            req.end = vi.fn(); // never fires the callback — hangs
            savedReq = req;
            return req;
        });

        // Start but don't await — hangs at the network request
        const downloadPromise = handlers['hf:download']?.(
            {},
            'https://huggingface.co/repo/resolve/main/pending.gguf',
            'pending.gguf',
        );

        await new Promise((r) => setTimeout(r, 5));

        const cancelResult = (await handlers['hf:cancelDownload']?.({}, 'pending.gguf')) as {
            success: boolean;
        };
        expect(cancelResult.success).toBe(true);

        // Unblock the promise via a network error so the test doesn't leak
        savedReq!.emit('error', new Error('test cleanup'));
        await downloadPromise;
    });
});
