// Speech-to-Text Service - Local Whisper inference via @huggingface/transformers
// Runs in the Electron main process using onnxruntime-node for native ONNX inference.
// Model is pre-downloaded and bundled inside the project at models/whisper/.
// 100% offline — no network calls at runtime.

const path = require('path');

let pipelineFn = null;
let transcriber = null;
let isModelLoading = false;
let isModelReady = false;

// Model stored inside the project directory (bundled with the app)
// In dev: <project>/models/whisper/   In prod: <resources>/models/whisper/
function getModelCacheDir() {
    // __dirname is electron/, so go one level up to project root
    const devPath = path.join(__dirname, '..', 'models', 'whisper');
    // In a packaged app, resources are at process.resourcesPath
    if (process.resourcesPath) {
        const prodPath = path.join(process.resourcesPath, 'models', 'whisper');
        const fs = require('fs');
        if (fs.existsSync(prodPath)) return prodPath;
    }
    return devPath;
}

/**
 * Dynamically import @huggingface/transformers (ESM module from CJS)
 * Same pattern used by ai-service.cjs for node-llama-cpp.
 */
async function getTransformers() {
    if (pipelineFn) return pipelineFn;

    const transformers = await import('@huggingface/transformers');

    // Point cache to the bundled model directory
    transformers.env.cacheDir = getModelCacheDir();
    // No remote downloads — model is already bundled
    transformers.env.allowRemoteModels = false;

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

module.exports = {
    initModel,
    transcribe,
    getStatus,
    cleanup,
};
