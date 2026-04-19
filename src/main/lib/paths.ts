/**
 * App path constants and resolution helpers — pure Node, no Electron imports.
 * Used by ai-service, hf-download-service, and speech-service.
 */

import path from 'path';
import os from 'os';
import fs from 'fs';
import { log } from './logger';

// Directory where the user stores their GGUF models: ~/leaf-models/
const DEFAULT_MODELS_DIR = path.join(os.homedir(), 'leaf-models');

/**
 * Resolve the bundled Whisper model directory.
 * In development  →  <repo>/models/whisper/
 * In production   →  <app>/Contents/Resources/models/whisper/
 *
 * After electron-vite bundles everything to out/main/index.js,
 * __dirname points to out/main/, so ../../ reaches the repo root.
 */
function getWhisperModelDir(): string {
    const devPath = path.join(__dirname, '../../models/whisper');

    if (process.resourcesPath) {
        const prodPath = path.join(process.resourcesPath, 'models/whisper');
        if (fs.existsSync(prodPath)) {
            log.info('[paths] Whisper model → production:', prodPath);
            return prodPath;
        }
        log.warn('[paths] Production model path not found, falling back to dev:', devPath);
    }

    log.info('[paths] Whisper model → dev:', devPath);
    return devPath;
}

export { DEFAULT_MODELS_DIR, getWhisperModelDir };
