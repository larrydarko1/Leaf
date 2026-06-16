/**
 * Speech-to-Text Service — local Whisper inference via @huggingface/transformers.
 * Runs in the Electron main process using onnxruntime-node for native ONNX inference.
 * Model is pre-downloaded and bundled; 100% offline at runtime.
 */

import type { IpcMain, BrowserWindow } from 'electron';
import type { pipeline as PipelineFn } from '@huggingface/transformers';
import path from 'path';
import { existsSync } from 'fs';
import { getWhisperModelDir } from '../lib/paths';
import { log } from '../lib/logger';

// Minimal shape of the parts of @huggingface/transformers we actually touch
type TransformersEnv = {
    cacheDir: string;
    allowRemoteModels: boolean;
};

type TransformersModule = {
    pipeline: typeof PipelineFn;
    env: TransformersEnv;
};

// The return type of pipeline('automatic-speech-recognition', ...) for audio
type TranscriptionResult = { text: string } | string;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Transcriber = (audio: Float32Array) => Promise<any>;

let pipelineFn: typeof PipelineFn | null = null;
let transcriber: Transcriber | null = null;
let isModelLoading = false;
let isModelReady = false;

export function cleanup(): void {
    transcriber = null;
    isModelReady = false;
    isModelLoading = false;
}

export function register(ipc: IpcMain, getMainWindow: () => BrowserWindow | null): void {
    ipc.handle('speech:init', async () => initModel(getMainWindow()));
    ipc.handle('speech:transcribe', async (_event, audioData: number[]) => {
        if (!Array.isArray(audioData) || audioData.length === 0) return { success: false, error: 'No audio data' };
        return transcribe(audioData);
    });
    ipc.handle('speech:getStatus', () => getStatus());
}

/**
 * Dynamically import @huggingface/transformers (ESM module from CJS)
 * Same pattern used by ai-service.ts for node-llama-cpp.
 */
async function getTransformers(): Promise<typeof PipelineFn> {
    if (pipelineFn !== null) return pipelineFn;

    const transformers = (await import('@huggingface/transformers')) as TransformersModule;

    // Point cache to the bundled model directory
    const cacheDir = getWhisperModelDir();
    transformers.env.cacheDir = cacheDir;
    // No remote downloads — model is already bundled
    transformers.env.allowRemoteModels = false;

    // Verify model files exist before proceeding
    const modelDir = path.join(cacheDir, 'Xenova', 'whisper-tiny.en');
    const onnxDir = path.join(modelDir, 'onnx');
    const requiredFiles = [
        path.join(modelDir, 'config.json'),
        path.join(onnxDir, 'encoder_model.onnx'),
        path.join(onnxDir, 'decoder_model_merged.onnx'),
    ];
    for (const f of requiredFiles) {
        if (!existsSync(f)) {
            log.error('[Speech] Missing required model file:', f);
            throw new Error(`Missing model file: ${path.basename(f)}`);
        }
    }
    log.info('[Speech] All model files verified at:', modelDir);

    pipelineFn = transformers.pipeline;
    return pipelineFn;
}

async function initModel(
    mainWindow: BrowserWindow | null,
): Promise<{ success: boolean; message?: string; error?: string }> {
    if (transcriber !== null) {
        return { success: true, message: 'Model already loaded' };
    }
    if (isModelLoading) {
        return { success: false, error: 'Model is currently loading' };
    }

    isModelLoading = true;

    try {
        const pipeline = await getTransformers();

        if (mainWindow !== null && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('speech:status', {
                status: 'loading',
                message: 'Loading Whisper model...',
            });
        }

        transcriber = (await pipeline('automatic-speech-recognition', 'Xenova/whisper-tiny.en', {
            revision: 'main',
        })) as Transcriber;

        isModelReady = true;
        isModelLoading = false;

        if (mainWindow !== null && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('speech:status', {
                status: 'ready',
                message: 'Whisper model ready',
            });
        }

        log.info('[Speech] Whisper model loaded successfully');
        return { success: true, message: 'Whisper model loaded' };
    } catch (error) {
        isModelLoading = false;
        isModelReady = false;
        log.error('[Speech] Failed to load Whisper model:', error);

        if (mainWindow !== null && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('speech:status', {
                status: 'error',
                message: (error as Error).message,
            });
        }

        return { success: false, error: (error as Error).message };
    }
}

async function transcribe(audioData: number[]): Promise<{ success: boolean; text?: string; error?: string }> {
    if (transcriber === null || !isModelReady) {
        return { success: false, error: 'Whisper model not loaded' };
    }

    try {
        const float32Audio = new Float32Array(audioData);
        const result = (await transcriber(float32Audio)) as TranscriptionResult;
        const text = typeof result === 'string' ? result : (result.text ?? '');
        return { success: true, text: text.trim() };
    } catch (error) {
        log.error('[Speech] Transcription error:', error);
        return { success: false, error: (error as Error).message };
    }
}

function getStatus(): { isModelLoaded: boolean; isModelLoading: boolean } {
    return { isModelLoaded: isModelReady, isModelLoading };
}
