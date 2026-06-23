/**
 * Tests for ai.ts that require a loaded model — mocks node-llama-cpp and uses
 * a real temp directory so scanForModels / listModels can be exercised too.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// ── hoisted paths so the mock factory can reference them ─────────────────────

const PATHS = vi.hoisted(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { join } = require('path') as typeof import('path');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { tmpdir } = require('os') as typeof import('os');
    const root = join(tmpdir(), `leaf-ai-model-test-${process.pid}-${Date.now()}`);
    return { root, leafHome: join(root, '.leaf') };
});

// ── node-llama-cpp mock ──────────────────────────────────────────────────────

const mockPrompt = vi.hoisted(() =>
    vi.fn().mockImplementation(
        async (
            _text: string,
            opts: {
                onResponseChunk?: (chunk: { type: undefined; segmentType: undefined; text: string }) => void;
                signal?: AbortSignal;
            },
        ) => {
            opts.onResponseChunk?.({ type: undefined, segmentType: undefined, text: 'Hello' });
            opts.onResponseChunk?.({ type: undefined, segmentType: undefined, text: ' world' });
        },
    ),
);

const mockClearHistory = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

const mockSequence = vi.hoisted(() => ({
    nextTokenIndex: 50,
    contextSize: 200,
    disposed: false,
    clearHistory: mockClearHistory,
}));

const mockGetSequence = vi.hoisted(() => vi.fn().mockReturnValue(mockSequence));
const mockContextDispose = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockModelDispose = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockCreateContext = vi.hoisted(() =>
    vi.fn().mockResolvedValue({
        dispose: mockContextDispose,
        getSequence: mockGetSequence,
    }),
);
const mockLoadModel = vi.hoisted(() =>
    vi.fn().mockResolvedValue({
        dispose: mockModelDispose,
        createContext: mockCreateContext,
    }),
);
const mockGetLlama = vi.hoisted(() => vi.fn().mockResolvedValue({ loadModel: mockLoadModel }));
const mockReadGgufFileInfo = vi.hoisted(() => vi.fn().mockResolvedValue({ metadata: {} }));

vi.mock('node-llama-cpp', () => {
    class LlamaChatSession {
        sequence: typeof mockSequence;
        prompt: typeof mockPrompt;
        constructor({ contextSequence }: { contextSequence: typeof mockSequence }) {
            this.sequence = contextSequence;
            this.prompt = mockPrompt;
        }
    }
    return {
        getLlama: mockGetLlama,
        LlamaChatSession,
        readGgufFileInfo: mockReadGgufFileInfo,
    };
});

// ── other mocks ──────────────────────────────────────────────────────────────

vi.mock('electron', () => ({
    shell: { openPath: vi.fn().mockResolvedValue('') },
}));

vi.mock('@/main/lib/logger', () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/main/lib/paths', () => ({
    DEFAULT_MODELS_DIR: PATHS.root,
    LEAF_HOME: PATHS.leafHome,
}));

vi.mock('@/main/services/systemPrompt', () => ({
    getActiveSystemPrompt: vi.fn().mockResolvedValue('You are helpful.'),
}));

// ── imports ──────────────────────────────────────────────────────────────────

import { register, cleanup } from '@/main/services/ai';

// ── helpers ──────────────────────────────────────────────────────────────────

function makeIpc() {
    const h: Record<string, (...args: unknown[]) => unknown> = {};
    const ipc = {
        handle: vi.fn((ch: string, fn: (...args: unknown[]) => unknown) => {
            h[ch] = fn;
        }),
    };
    return { ipc, handlers: h };
}

let handlers: Record<string, (...args: unknown[]) => unknown>;

function modelFilePath() {
    return path.join(PATHS.root, 'test-model.gguf');
}

beforeEach(() => {
    fs.mkdirSync(PATHS.root, { recursive: true });
    const { ipc, handlers: h } = makeIpc();
    handlers = h;
    register(ipc as never, () => null);
});

afterEach(async () => {
    await cleanup();
    fs.rmSync(PATHS.root, { recursive: true, force: true });
    vi.clearAllMocks();
});

// ── listModels / scanForModels / isModelFile / formatFileSize ────────────────

describe('listModels (scanForModels)', () => {
    it('returns an empty list when the models directory is empty', async () => {
        const result = (await handlers['ai:listModels']?.()) as { success: boolean; models: unknown[] };
        expect(result.success).toBe(true);
        expect(result.models).toHaveLength(0);
    });

    it('finds a .gguf file and returns its info', async () => {
        fs.writeFileSync(modelFilePath(), Buffer.alloc(1024 * 1024)); // 1 MB
        const result = (await handlers['ai:listModels']?.()) as {
            success: boolean;
            models: { name: string; sizeFormatted: string }[];
        };
        expect(result.success).toBe(true);
        expect(result.models).toHaveLength(1);
        expect(result.models[0].name).toBe('test-model.gguf');
        expect(result.models[0].sizeFormatted).toMatch(/MB/);
    });

    it('ignores non-.gguf files', async () => {
        fs.writeFileSync(path.join(PATHS.root, 'README.txt'), 'docs');
        fs.writeFileSync(path.join(PATHS.root, 'config.json'), '{}');
        const result = (await handlers['ai:listModels']?.()) as { success: boolean; models: unknown[] };
        expect(result.models).toHaveLength(0);
    });

    it('ignores files with non-model prefixes', async () => {
        fs.writeFileSync(path.join(PATHS.root, 'mmproj-model.gguf'), '');
        fs.writeFileSync(path.join(PATHS.root, 'projector-clip.gguf'), '');
        fs.writeFileSync(path.join(PATHS.root, 'tokenizer.gguf'), '');
        fs.writeFileSync(path.join(PATHS.root, 'adapter-lora.gguf'), '');
        const result = (await handlers['ai:listModels']?.()) as { success: boolean; models: unknown[] };
        expect(result.models).toHaveLength(0);
    });

    it('recurses into subdirectories (depth ≤ 2)', async () => {
        const sub = path.join(PATHS.root, 'vendor', 'llama');
        fs.mkdirSync(sub, { recursive: true });
        fs.writeFileSync(path.join(sub, 'llama-7b.gguf'), '');
        const result = (await handlers['ai:listModels']?.()) as { success: boolean; models: { name: string }[] };
        expect(result.models).toHaveLength(1);
        expect(result.models[0].name).toContain('llama-7b.gguf');
    });

    it('sorts models alphabetically by name', async () => {
        fs.writeFileSync(path.join(PATHS.root, 'zeta.gguf'), '');
        fs.writeFileSync(path.join(PATHS.root, 'alpha.gguf'), '');
        const result = (await handlers['ai:listModels']?.()) as { success: boolean; models: { name: string }[] };
        expect(result.models[0].name).toBe('alpha.gguf');
        expect(result.models[1].name).toBe('zeta.gguf');
    });

    it('formatFileSize: returns "0 B" for empty files', async () => {
        fs.writeFileSync(path.join(PATHS.root, 'empty.gguf'), '');
        const result = (await handlers['ai:listModels']?.()) as {
            success: boolean;
            models: { sizeFormatted: string }[];
        };
        expect(result.models[0].sizeFormatted).toBe('0 B');
    });
});

// ── loadModel ────────────────────────────────────────────────────────────────

describe('loadModel (success path)', () => {
    beforeEach(() => {
        fs.writeFileSync(modelFilePath(), '');
    });

    it('loads a model and reports success', async () => {
        const result = (await handlers['ai:loadModel']?.({}, modelFilePath())) as {
            success: boolean;
            modelName?: string;
        };
        expect(result.success).toBe(true);
        expect(result.modelName).toBe('test-model.gguf');
    });

    it('getStatus reflects loaded model', async () => {
        await handlers['ai:loadModel']?.({}, modelFilePath());
        const status = handlers['ai:getStatus']?.() as {
            isModelLoaded: boolean;
            currentModelPath: string;
            currentModelName: string;
            contextTokens: number;
            contextSize: number;
        };
        expect(status.isModelLoaded).toBe(true);
        expect(status.currentModelName).toBe('test-model.gguf');
        expect(status.contextTokens).toBe(50);
        expect(status.contextSize).toBe(200);
    });

    it('unloads successfully via ai:unloadModel', async () => {
        await handlers['ai:loadModel']?.({}, modelFilePath());
        const result = (await handlers['ai:unloadModel']?.()) as { success: boolean };
        expect(result.success).toBe(true);
        expect(mockContextDispose).toHaveBeenCalled();
        expect(mockModelDispose).toHaveBeenCalled();

        const status = handlers['ai:getStatus']?.() as { isModelLoaded: boolean };
        expect(status.isModelLoaded).toBe(false);
    });

    it('loading a second model auto-unloads the first', async () => {
        await handlers['ai:loadModel']?.({}, modelFilePath());
        const secondPath = path.join(PATHS.root, 'second.gguf');
        fs.writeFileSync(secondPath, '');
        await handlers['ai:loadModel']?.({}, secondPath);
        expect(mockModelDispose).toHaveBeenCalled();
        const status = handlers['ai:getStatus']?.() as { currentModelName: string };
        expect(status.currentModelName).toBe('second.gguf');
    });

    it('cleanup() unloads the model when one is loaded', async () => {
        await handlers['ai:loadModel']?.({}, modelFilePath());
        await cleanup();
        const status = handlers['ai:getStatus']?.() as { isModelLoaded: boolean };
        expect(status.isModelLoaded).toBe(false);
    });

    it('getModelLoadOptions: uses CPU-only for mistral3 architecture', async () => {
        mockReadGgufFileInfo.mockResolvedValueOnce({ metadata: { general: { architecture: 'mistral3' } } });
        await handlers['ai:loadModel']?.({}, modelFilePath());
        expect(mockLoadModel).toHaveBeenCalledWith(expect.objectContaining({ gpuLayers: 0 }));
    });

    it('getModelLoadOptions: falls back to defaults when readGgufFileInfo throws', async () => {
        mockReadGgufFileInfo.mockRejectedValueOnce(new Error('bad file'));
        const result = (await handlers['ai:loadModel']?.({}, modelFilePath())) as { success: boolean };
        expect(result.success).toBe(true);
        expect(mockLoadModel).toHaveBeenCalledWith(expect.objectContaining({ modelPath: modelFilePath() }));
    });

    it('returns failure when llamaInstance.loadModel throws', async () => {
        mockLoadModel.mockRejectedValueOnce(new Error('GGML error'));
        const result = (await handlers['ai:loadModel']?.({}, modelFilePath())) as { success: boolean; error: string };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/GGML error/);
    });
});

// ── chat ─────────────────────────────────────────────────────────────────────

describe('chat (with loaded model)', () => {
    beforeEach(async () => {
        fs.writeFileSync(modelFilePath(), '');
        await handlers['ai:loadModel']?.({}, modelFilePath());
    });

    it('returns the streamed response', async () => {
        const result = (await handlers['ai:chat']?.({}, 'Hi', '')) as { success: boolean; response?: string };
        expect(result.success).toBe(true);
        expect(result.response).toBe('Hello world');
    });

    it('includes noteContext in the prompt when provided', async () => {
        await handlers['ai:chat']?.({}, 'What is this?', 'My note content here');
        const calledWith = mockPrompt.mock.calls[0][0] as string;
        expect(calledWith).toContain('My note content here');
        expect(calledWith).toContain('What is this?');
    });

    it('injects pendingConversationHistory as a summary on the next chat', async () => {
        // Restore history first (sets pendingConversationHistory)
        handlers['ai:restoreChatHistory']?.({}, [
            { role: 'user', content: 'Old question' },
            { role: 'assistant', content: 'Old answer' },
        ]);
        await handlers['ai:chat']?.({}, 'Follow up', '');
        const calledWith = mockPrompt.mock.calls[0][0] as string;
        expect(calledWith).toContain('Old question');
        expect(calledWith).toContain('Old answer');
        expect(calledWith).toContain('Follow up');
    });

    it('returns failure when session.prompt throws', async () => {
        mockPrompt.mockRejectedValueOnce(new Error('inference failed'));
        const result = (await handlers['ai:chat']?.({}, 'Hi', '')) as { success: boolean; error?: string };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/inference failed/);
    });

    it('returns failure when already generating', async () => {
        // Simulate in-progress generation by starting a slow chat
        const slowPrompt = new Promise<void>((resolve) => setTimeout(resolve, 500));
        mockPrompt.mockReturnValueOnce(slowPrompt);
        const firstChat = handlers['ai:chat']?.({}, 'Slow', '');
        const result = (await handlers['ai:chat']?.({}, 'Second', '')) as { success: boolean; error?: string };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/already generating/i);
        await firstChat; // clean up
    });

    it('stopChat aborts an in-progress generation', async () => {
        let chatResolve!: () => void;
        mockPrompt.mockImplementationOnce(
            () =>
                new Promise<void>((r) => {
                    chatResolve = r;
                }),
        );
        const chatPromise = handlers['ai:chat']?.({}, 'Long response', '');
        const stopResult = handlers['ai:stopChat']?.() as { success: boolean };
        expect(stopResult.success).toBe(true);
        chatResolve();
        await chatPromise;
    });
});

// ── resetChat ────────────────────────────────────────────────────────────────

describe('resetChat (with loaded model)', () => {
    beforeEach(async () => {
        fs.writeFileSync(modelFilePath(), '');
        await handlers['ai:loadModel']?.({}, modelFilePath());
    });

    it('succeeds and clears tracked history', async () => {
        await handlers['ai:chat']?.({}, 'Hello', '');
        const result = (await handlers['ai:resetChat']?.()) as { success: boolean };
        expect(result.success).toBe(true);
        expect(mockClearHistory).toHaveBeenCalled();
    });

    it('falls back to new sequence when existing sequence is disposed', async () => {
        mockSequence.disposed = true;
        const result = (await handlers['ai:resetChat']?.()) as { success: boolean };
        expect(result.success).toBe(true);
        expect(mockGetSequence).toHaveBeenCalled();
        mockSequence.disposed = false; // restore
    });

    it('returns failure when clearHistory throws', async () => {
        mockClearHistory.mockRejectedValueOnce(new Error('clear failed'));
        const result = (await handlers['ai:resetChat']?.()) as { success: boolean; error?: string };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/clear failed/);
    });
});

// ── restoreChatHistory / buildConversationSummary ────────────────────────────

describe('restoreChatHistory with messages', () => {
    it('stores messages and builds summary on next chat', async () => {
        fs.writeFileSync(modelFilePath(), '');
        await handlers['ai:loadModel']?.({}, modelFilePath());

        const messages = Array.from({ length: 60 }, (_, i) => ({
            role: i % 2 === 0 ? 'user' : 'assistant',
            content: `Message ${i}`.repeat(200),
        }));
        handlers['ai:restoreChatHistory']?.({}, messages);

        await handlers['ai:chat']?.({}, 'Continue', '');
        const calledWith = mockPrompt.mock.calls[0][0] as string;
        // buildConversationSummary truncates at 50 messages and 2000 chars per message
        expect(calledWith).toContain('User:');
        expect(calledWith).toContain('Assistant:');
    });
});
