import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

vi.mock('electron', () => ({}));

vi.mock('@/main/lib/logger', () => ({
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const PATHS = vi.hoisted(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { join } = require('path') as typeof import('path');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { tmpdir } = require('os') as typeof import('os');
    const modelRoot = join(tmpdir(), `leaf-speech-test-${process.pid}-${Date.now()}`);
    return { modelRoot };
});

vi.mock('@/main/lib/paths', () => ({
    getWhisperModelDir: () => PATHS.modelRoot,
}));

const mockTranscriber = vi.hoisted(() => vi.fn());

vi.mock('@huggingface/transformers', () => ({
    env: { cacheDir: '', allowRemoteModels: true },
    pipeline: vi.fn().mockResolvedValue(mockTranscriber),
}));

import { cleanup, register } from '@/main/services/speech';

function makeIpc() {
    const handlers: Record<string, (...args: unknown[]) => Promise<unknown>> = {};
    const ipc = {
        handle: vi.fn((ch: string, fn: (...args: unknown[]) => Promise<unknown>) => {
            handlers[ch] = fn;
        }),
    };
    return { ipc, handlers };
}

function createModelFiles() {
    const modelDir = path.join(PATHS.modelRoot, 'Xenova', 'whisper-tiny.en');
    const onnxDir = path.join(modelDir, 'onnx');
    fs.mkdirSync(onnxDir, { recursive: true });
    fs.writeFileSync(path.join(modelDir, 'config.json'), '{}');
    fs.writeFileSync(path.join(onnxDir, 'encoder_model.onnx'), '');
    fs.writeFileSync(path.join(onnxDir, 'decoder_model_merged.onnx'), '');
}

beforeEach(() => {
    cleanup();
    fs.rmSync(PATHS.modelRoot, { recursive: true, force: true });
});

afterEach(() => {
    fs.rmSync(PATHS.modelRoot, { recursive: true, force: true });
});

describe('cleanup', () => {
    it('runs without throwing', () => {
        expect(() => cleanup()).not.toThrow();
    });
});

describe('speech:getStatus', () => {
    it('reports not loaded and not loading on fresh state', () => {
        const { ipc, handlers } = makeIpc();
        register(ipc as never, () => null);
        const status = handlers['speech:getStatus']?.() as { isModelLoaded: boolean; isModelLoading: boolean };
        expect(status.isModelLoaded).toBe(false);
        expect(status.isModelLoading).toBe(false);
    });
});

describe('speech:transcribe', () => {
    it('returns failure for an empty audio array', async () => {
        const { ipc, handlers } = makeIpc();
        register(ipc as never, () => null);
        const result = (await handlers['speech:transcribe']?.({}, [])) as { success: boolean; error: string };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/no audio data/i);
    });

    it('returns failure for non-array audio data', async () => {
        const { ipc, handlers } = makeIpc();
        register(ipc as never, () => null);
        const result = (await handlers['speech:transcribe']?.({}, 'blob')) as { success: boolean };
        expect(result.success).toBe(false);
    });

    it('returns failure when the model is not loaded', async () => {
        const { ipc, handlers } = makeIpc();
        register(ipc as never, () => null);
        const result = (await handlers['speech:transcribe']?.({}, [0.1, 0.2])) as { success: boolean; error: string };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/not loaded/i);
    });
});

describe('speech:init', () => {
    it('returns failure when a required model file is missing', async () => {
        // modelRoot is empty — no model files exist
        const { ipc, handlers } = makeIpc();
        register(ipc as never, () => null);
        const result = (await handlers['speech:init']?.()) as { success: boolean; error: string };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/missing model file/i);
    });

    it('loads model successfully when all files exist', async () => {
        createModelFiles();
        mockTranscriber.mockResolvedValue({ text: 'hello' });
        const { ipc, handlers } = makeIpc();
        register(ipc as never, () => null);
        const result = (await handlers['speech:init']?.()) as { success: boolean; message?: string };
        expect(result.success).toBe(true);
        expect(result.message).toMatch(/loaded/i);
    });

    it('returns "already loaded" when called twice', async () => {
        createModelFiles();
        const { ipc, handlers } = makeIpc();
        register(ipc as never, () => null);
        await handlers['speech:init']?.();
        const result = (await handlers['speech:init']?.()) as { success: boolean; message?: string };
        expect(result.success).toBe(true);
        expect(result.message).toMatch(/already loaded/i);
    });

    it('transcribes audio successfully when model is loaded', async () => {
        createModelFiles();
        mockTranscriber.mockResolvedValue({ text: 'transcribed text' });
        const { ipc, handlers } = makeIpc();
        register(ipc as never, () => null);
        await handlers['speech:init']?.();
        const result = (await handlers['speech:transcribe']?.({}, [0.1, 0.2, 0.3])) as {
            success: boolean;
            text?: string;
        };
        expect(result.success).toBe(true);
        expect(result.text).toBe('transcribed text');
    });

    it('transcribes audio when result is a plain string', async () => {
        createModelFiles();
        mockTranscriber.mockResolvedValue('plain text result');
        const { ipc, handlers } = makeIpc();
        register(ipc as never, () => null);
        await handlers['speech:init']?.();
        const result = (await handlers['speech:transcribe']?.({}, [0.1, 0.2])) as { success: boolean; text?: string };
        expect(result.success).toBe(true);
        expect(result.text).toBe('plain text result');
    });

    it('returns failure when transcription throws', async () => {
        createModelFiles();
        mockTranscriber.mockRejectedValueOnce(new Error('transcription error'));
        const { ipc, handlers } = makeIpc();
        register(ipc as never, () => null);
        await handlers['speech:init']?.();
        const result = (await handlers['speech:transcribe']?.({}, [0.1])) as { success: boolean; error?: string };
        expect(result.success).toBe(false);
    });

    it('returns "model is currently loading" when init is called while loading', async () => {
        createModelFiles();
        const { pipeline } = await import('@huggingface/transformers');
        let resolvePipeline!: (v: typeof mockTranscriber) => void;
        vi.mocked(pipeline).mockImplementationOnce(
            () =>
                new Promise<typeof mockTranscriber>((r) => {
                    resolvePipeline = r;
                }),
        );

        const { ipc, handlers } = makeIpc();
        register(ipc as never, () => null);

        // Start init without awaiting so isModelLoading becomes true
        const firstInitPromise = handlers['speech:init']?.();
        // Second call should see isModelLoading = true
        const result = (await handlers['speech:init']?.()) as { success: boolean; error: string };
        expect(result.success).toBe(false);
        expect(result.error).toMatch(/currently loading/i);

        // Resolve the slow pipeline so the first init completes
        resolvePipeline(mockTranscriber);
        await firstInitPromise;
    });
});
