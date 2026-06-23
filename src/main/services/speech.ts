/**
 * Speech-to-Text Service — local Whisper inference via @huggingface/transformers.
 * Runs in the Electron main process using onnxruntime-node for native ONNX inference.
 * Model is pre-downloaded and bundled; 100% offline at runtime.
 */

import type { IpcMain, BrowserWindow } from 'electron';
import type { pipeline as PipelineFn } from '@huggingface/transformers';
import path from 'path';
import { existsSync } from 'fs';
import { getWhisperModelDir } from '@/main/lib/paths';
import { log } from '@/main/lib/logger';
import type { Transcriber, TranscriptionResult, TransformersModule } from '@/schemas/vault';

// Minimal shape of the pipeline internals we need for language detection
// Property names must match @huggingface/transformers API exactly
/* eslint-disable @typescript-eslint/naming-convention */
type WhisperPipeline = {
    model: {
        generate(opts: Record<string, unknown>): Promise<ArrayLike<{ tolist(): (number | bigint)[] }>>;
        generation_config: { lang_to_id: Record<string, number> };
    };
    processor(audio: Float32Array): Promise<{ input_features: unknown }>;
};
/* eslint-enable @typescript-eslint/naming-convention */

// Whisper decoder_start_token_id — constant across all Whisper models
const WHISPER_SOT = 50258;

let pipelineFn: typeof PipelineFn | null = null;
let transcriber: Transcriber | null = null;
let isModelLoading = false;
let isModelReady = false;

// undefined = not yet attempted; null = attempted but failed; string = detected language code
let detectedLanguage: string | null | undefined = undefined;

export function cleanup(): void {
    transcriber = null;
    isModelReady = false;
    isModelLoading = false;
    detectedLanguage = undefined;
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
    const modelDir = path.join(cacheDir, 'Xenova', 'whisper-base');
    const onnxDir = path.join(modelDir, 'onnx');
    const requiredFiles = [
        path.join(modelDir, 'config.json'),
        path.join(onnxDir, 'encoder_model_quantized.onnx'),
        path.join(onnxDir, 'decoder_model_merged_quantized.onnx'),
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

        transcriber = (await pipeline('automatic-speech-recognition', 'Xenova/whisper-base', {
            revision: 'main',
            dtype: 'q8',
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

/**
 * Detects the spoken language by running a single decoder step with only the
 * start-of-transcript token and reading whichever language token the model predicts.
 * Called once per model session; result is cached in `detectedLanguage`.
 *
 * v3.8.1 of @huggingface/transformers does not implement automatic language detection
 * (the relevant code path has a TODO comment and defaults to English), so we do it
 * manually here via the model's internal generate API.
 */
async function detectLanguage(float32Audio: Float32Array): Promise<string | null> {
    if (transcriber === null) {
        return null;
    }
    try {
        const pipe = transcriber as unknown as WhisperPipeline;
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const { input_features } = await pipe.processor(float32Audio);

        // max_new_tokens: 1 — generate only the language token after [<|startoftranscript|>]
        const outputs = await pipe.model.generate({
            inputs: input_features,
            decoder_input_ids: [WHISPER_SOT],
            max_new_tokens: 1,
        });

        // outputs[0] = [WHISPER_SOT, langToken]
        const tokens = outputs[0].tolist();
        const langToken = Number(tokens[1]);

        const langToId = pipe.model.generation_config.lang_to_id;
        for (const [langKey, tokenId] of Object.entries(langToId)) {
            if (Number(tokenId) === langToken) {
                const match = /\|(.+)\|/.exec(langKey);
                if (match !== null) {
                    log.info('[Speech] Language detected:', match[1]);
                    return match[1];
                }
            }
        }
        return null;
    } catch (err) {
        log.warn('[Speech] Language detection failed, falling back to model default:', err);
        return null;
    }
}

async function transcribe(audioData: number[]): Promise<{ success: boolean; text?: string; error?: string }> {
    if (transcriber === null || !isModelReady) {
        return { success: false, error: 'Whisper model not loaded' };
    }

    try {
        const float32Audio = new Float32Array(audioData);

        // Detect language on the first transcription call and cache it for the session.
        // Reset happens in cleanup() when the model is unloaded.
        if (detectedLanguage === undefined) {
            detectedLanguage = await detectLanguage(float32Audio);
        }

        const call = transcriber as unknown as (
            audio: Float32Array,
            options: Record<string, unknown>,
        ) => Promise<unknown>;

        const options: Record<string, unknown> = detectedLanguage !== null ? { language: detectedLanguage } : {};
        const result = (await call(float32Audio, options)) as TranscriptionResult;
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
