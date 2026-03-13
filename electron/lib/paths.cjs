// App path constants and resolution helpers — pure Node, no Electron imports.
// Used by:
//   ai-service.cjs          → DEFAULT_MODELS_DIR
//   hf-download-service.cjs → DEFAULT_MODELS_DIR
//   speech-service.cjs      → getWhisperModelDir()

'use strict';

const path = require('path');
const os = require('os');

// Directory where the user stores their GGUF models: ~/leaf-models/
const DEFAULT_MODELS_DIR = path.join(os.homedir(), 'leaf-models');

/**
 * Resolve the bundled Whisper model directory.
 * In development  →  <repo>/models/whisper/
 * In production   →  <app>/Contents/Resources/models/whisper/
 *
 * __dirname here is electron/lib/, so ../../ reaches the repo root.
 */
function getWhisperModelDir() {
    const devPath = path.join(__dirname, '../../models/whisper');

    if (process.resourcesPath) {
        const prodPath = path.join(process.resourcesPath, 'models/whisper');
        const fs = require('fs');
        if (fs.existsSync(prodPath)) {
            console.log('[paths] Whisper model → production:', prodPath);
            return prodPath;
        }
        console.warn('[paths] Production model path not found, falling back to dev:', devPath);
    }

    console.log('[paths] Whisper model → dev:', devPath);
    return devPath;
}

module.exports = { DEFAULT_MODELS_DIR, getWhisperModelDir };
