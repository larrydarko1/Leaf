// Speech-to-Text Service - Local Whisper inference via @huggingface/transformers
// Runs in the Electron main process using onnxruntime-node for native ONNX inference.
// Model is pre-downloaded and bundled inside the project at models/whisper/.
// 100% offline — no network calls at runtime.

const path = require('path');
const { getWhisperModelDir } = require('../lib/paths.cjs');

let pipelineFn = null;
let transcriber = null;
let isModelLoading = false;
let isModelReady = false;

/**
 * Dynamically import @huggingface/transformers (ESM module from CJS)
 * Same pattern used by ai-service.cjs for node-llama-cpp.
 */
async function getTransformers() {
    if (pipelineFn) return pipelineFn;

    const transformers = await import('@huggingface/transformers');

    // Point cache to the bundled model directory
    const cacheDir = getWhisperModelDir();
    transformers.env.cacheDir = cacheDir;
    // No remote downloads — model is already bundled
    transformers.env.allowRemoteModels = false;

    // Verify model files exist before proceeding
    const fs = require('fs');
    const modelDir = path.join(cacheDir, 'Xenova', 'whisper-tiny.en');
    const onnxDir = path.join(modelDir, 'onnx');
    const requiredFiles = [
        path.join(modelDir, 'config.json'),
        path.join(onnxDir, 'encoder_model.onnx'),
        path.join(onnxDir, 'decoder_model_merged.onnx'),
    ];
    for (const f of requiredFiles) {
        if (!fs.existsSync(f)) {
            console.error('[Speech] Missing required model file:', f);
            throw new Error(`Missing model file: ${path.basename(f)}`);
        }
    }
    console.log('[Speech] All model files verified at:', modelDir);

    pipelineFn = transformers.pipeline;
    return pipelineFn;
}

/**
 * Initialize the Whisper speech recognition model.
 * Loads directly from the bundled model files — no download needed.
 * @param {Electron.BrowserWindow} mainWindow - For sending status events to renderer
 */
async function initModel(mainWindow) {
    if (transcriber) {
        return { success: true, message: 'Model already loaded' };
    }
    if (isModelLoading) {
        return { success: false, error: 'Model is currently loading' };
    }

    isModelLoading = true;

    try {
        const pipeline = await getTransformers();

        // Notify renderer that loading has started
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('speech:status', {
                status: 'loading',
                message: 'Loading Whisper model...'
            });
        }

        // Load whisper-tiny.en — English-only, smallest & fastest
        // Loaded from bundled model files, no network needed
        transcriber = await pipeline(
            'automatic-speech-recognition',
            'Xenova/whisper-tiny.en',
            {
                revision: 'main',
            }
        );

        isModelReady = true;
        isModelLoading = false;

        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('speech:status', {
                status: 'ready',
                message: 'Whisper model ready'
            });
        }

        console.log('[Speech] Whisper model loaded successfully');
        return { success: true, message: 'Whisper model loaded' };
    } catch (error) {
        isModelLoading = false;
        isModelReady = false;
        console.error('[Speech] Failed to load Whisper model:', error);

        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('speech:status', {
                status: 'error',
                message: error.message
            });
        }

        return { success: false, error: error.message };
    }
}

/**
 * Transcribe audio data using the loaded Whisper model.
 * @param {number[]} audioData - Raw PCM audio samples at 16kHz mono (Float32 range -1 to 1)
 * @returns {Promise<{success: boolean, text?: string, error?: string}>}
 */
async function transcribe(audioData) {
    if (!transcriber || !isModelReady) {
        return { success: false, error: 'Whisper model not loaded' };
    }

    try {
        // Convert plain array back to Float32Array for the pipeline
        const float32Audio = new Float32Array(audioData);

        const result = await transcriber(float32Audio);

        // Pipeline returns { text: "..." } or a string
        const text = typeof result === 'string' ? result : (result.text || '');

        return { success: true, text: text.trim() };
    } catch (error) {
        console.error('[Speech] Transcription error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get current service status
 */
function getStatus() {
    return {
        isModelLoaded: isModelReady,
        isModelLoading,
    };
}

/**
 * Cleanup resources
 */
async function cleanup() {
    transcriber = null;
    isModelReady = false;
    isModelLoading = false;
}

/**
 * Wire up all speech IPC handlers.
 * @param {Electron.IpcMain} ipc
 * @param {() => Electron.BrowserWindow | null} getMainWindow
 */
function register(ipc, getMainWindow) {
    ipc.handle('speech:init', async () => initModel(getMainWindow()));
    ipc.handle('speech:transcribe', async (event, audioData) => {
        if (!audioData) return { success: false, error: 'No audio data' };
        return transcribe(audioData);
    });
    ipc.handle('speech:getStatus', async () => getStatus());
}

module.exports = {
    register,
    initModel,
    transcribe,
    getStatus,
    cleanup,
};
