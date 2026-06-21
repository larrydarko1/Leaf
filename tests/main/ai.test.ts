import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('fs/promises', async () => {
    const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
    return {
        default: {
            ...actual,
            mkdir: vi.fn().mockResolvedValue(undefined),
        },
    };
});

vi.mock('electron', () => ({
    shell: { openPath: vi.fn().mockResolvedValue('') },
}));
vi.mock('@/main/lib/logger', () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));
vi.mock('@/main/lib/paths', () => ({
    DEFAULT_MODELS_DIR: '/fake/models',
    LEAF_HOME: '/fake/leaf-home',
}));
vi.mock('@/main/services/systemPrompt', () => ({
    getActiveSystemPrompt: vi.fn().mockResolvedValue(''),
}));

import { register, cleanup } from '@/main/services/ai';

let handlers: Record<string, (...args: unknown[]) => unknown>;

function makeIpc() {
    const h: Record<string, (...args: unknown[]) => unknown> = {};
    const ipc = {
        handle: vi.fn((ch: string, fn: (...args: unknown[]) => unknown) => {
            h[ch] = fn;
        }),
    };
    return { ipc, handlers: h };
}

beforeEach(() => {
    const r = makeIpc();
    handlers = r.handlers;
    register(r.ipc as never, () => null);
});

// ── cleanup ───────────────────────────────────────────────────────────────────

describe('cleanup', () => {
    it('resolves without error when no model is loaded', async () => {
        await expect(cleanup()).resolves.toBeUndefined();
    });
});

// ── ai:getStatus ──────────────────────────────────────────────────────────────

describe('ai:getStatus', () => {
    it('reports unloaded state on initial call', () => {
        const status = handlers['ai:getStatus']?.() as {
            isModelLoaded: boolean;
            currentModelPath: string | null;
            currentModelName: string | null;
            isGenerating: boolean;
            modelsDir: string;
        };
        expect(status.isModelLoaded).toBe(false);
        expect(status.currentModelPath).toBeNull();
        expect(status.currentModelName).toBeNull();
        expect(status.isGenerating).toBe(false);
        expect(status.modelsDir).toBe('/fake/models');
    });
});

// ── ai:listModels ─────────────────────────────────────────────────────────────

describe('ai:listModels', () => {
    it('returns an empty models list when the models directory does not exist', async () => {
        const result = (await handlers['ai:listModels']?.()) as {
            success: boolean;
            models: unknown[];
            modelsDir: string;
        };
        expect(result.success).toBe(true);
        expect(result.models).toHaveLength(0);
        expect(result.modelsDir).toBe('/fake/models');
    });
});

// ── ai:loadModel input validation ─────────────────────────────────────────────

describe('ai:loadModel', () => {
    it('returns failure for non-string modelPath', async () => {
        const result = (await handlers['ai:loadModel']?.({}, 123)) as { success: boolean; error: string };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/invalid model path/i);
    });

    it('returns failure for an empty modelPath', async () => {
        const result = (await handlers['ai:loadModel']?.({}, '')) as { success: boolean; error: string };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/invalid model path/i);
    });

    it('returns failure for a model path outside the models directory', async () => {
        const result = (await handlers['ai:loadModel']?.({}, '/etc/some-model.gguf')) as {
            success: boolean;
            error: string;
        };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/access denied/i);
    });
});

// ── ai:chat input validation ──────────────────────────────────────────────────

describe('ai:chat', () => {
    it('returns failure for non-string userMessage', async () => {
        const result = (await handlers['ai:chat']?.({}, 123, '')) as { success: boolean; error: string };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/invalid arguments/i);
    });

    it('returns failure for an empty userMessage', async () => {
        const result = (await handlers['ai:chat']?.({}, '', '')) as { success: boolean; error: string };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/invalid arguments/i);
    });
});

// ── ai:stopChat ───────────────────────────────────────────────────────────────

describe('ai:stopChat', () => {
    it('returns failure when no generation is in progress', () => {
        const result = handlers['ai:stopChat']?.() as { success: boolean; error: string };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/no generation/i);
    });
});

// ── ai:resetChat ──────────────────────────────────────────────────────────────

describe('ai:resetChat', () => {
    it('returns failure when no model is loaded', async () => {
        const result = (await handlers['ai:resetChat']?.()) as { success: boolean; error: string };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/no model loaded/i);
    });
});

// ── ai:loadModel (file not found) ────────────────────────────────────────────

describe('ai:loadModel (file not found)', () => {
    it('returns failure when model file does not exist inside models directory', async () => {
        const result = (await handlers['ai:loadModel']?.({}, '/fake/models/nonexistent.gguf')) as {
            success: boolean;
            error: string;
        };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/not found/i);
    });
});

// ── ai:openLeafDir ────────────────────────────────────────────────────────────

describe('ai:openLeafDir', () => {
    it('calls shell.openPath with LEAF_HOME and returns success', async () => {
        const { shell } = await import('electron');
        const result = (await handlers['ai:openLeafDir']?.()) as { success: boolean };
        expect(result.success).toBe(true);
        expect(shell.openPath).toHaveBeenCalled();
    });
});

// ── ai:restoreChatHistory ─────────────────────────────────────────────────────

describe('ai:restoreChatHistory', () => {
    it('returns failure for non-array messages', async () => {
        const result = (await handlers['ai:restoreChatHistory']?.({}, 'not an array')) as {
            success: boolean;
            error: string;
        };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/invalid messages/i);
    });

    it('returns failure for messages with invalid role', async () => {
        const result = (await handlers['ai:restoreChatHistory']?.({}, [{ role: 'system', content: 'hi' }])) as {
            success: boolean;
        };
        expect(result.success).toBe(false);
    });

    it('succeeds with an empty messages array', async () => {
        const result = (await handlers['ai:restoreChatHistory']?.({}, [])) as { success: boolean };
        expect(result.success).toBe(true);
    });

    it('succeeds with valid user and assistant messages', async () => {
        const messages = [
            { role: 'user', content: 'Hello' },
            { role: 'assistant', content: 'Hi there' },
        ];
        const result = (await handlers['ai:restoreChatHistory']?.({}, messages)) as { success: boolean };
        expect(result.success).toBe(true);
    });
});
