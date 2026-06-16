/**
 * App path constants and resolution helpers — pure Node, no Electron imports.
 * Used by ai-service, hf-download-service, speech-service, and systemPrompt-service.
 */

import path from 'path';
import os from 'os';
import fs from 'fs';
import { log } from './logger';

// ─── Leaf user directory: ~/.leaf/ ───────────────────────────────────────────
// All user-owned, user-editable Leaf data lives under here.
//   ~/.leaf/models/      → GGUF model files
//   ~/.leaf/prompts/     → markdown system prompts (one per template)
//   ~/.leaf/state.json   → small key/value file (active prompt id, etc.)
export const LEAF_HOME: string = path.join(os.homedir(), '.leaf');

// Directory where the user stores their GGUF models: ~/.leaf/models/
export const DEFAULT_MODELS_DIR: string = path.join(LEAF_HOME, 'models');

// Directory where system-prompt templates live: ~/.leaf/prompts/
export const PROMPTS_DIR: string = path.join(LEAF_HOME, 'prompts');

// Directory where user-editable theme presets live: ~/.leaf/themes/
export const THEMES_DIR: string = path.join(LEAF_HOME, 'themes');

// Persistent app state (active prompt id, active theme id, etc.): ~/.leaf/state.json
export const STATE_FILE: string = path.join(LEAF_HOME, 'state.json');

// Legacy location used before the ~/.leaf/ consolidation.
const LEGACY_MODELS_DIR: string = path.join(os.homedir(), 'leaf-models');

/**
 * Migrate legacy `~/leaf-models/` → `~/.leaf/models/` on first launch.
 * Idempotent: no-op if the legacy dir doesn't exist or the new path is
 * already populated. Runs synchronously at startup before any service
 * touches the models dir.
 */
export function migrateLegacyPaths(): void {
    try {
        if (!fs.existsSync(LEGACY_MODELS_DIR)) return;
        if (fs.existsSync(DEFAULT_MODELS_DIR)) {
            log.info('[paths] Both legacy and new model dirs exist — leaving legacy alone.');
            return;
        }
        fs.mkdirSync(LEAF_HOME, { recursive: true });
        fs.renameSync(LEGACY_MODELS_DIR, DEFAULT_MODELS_DIR);
        log.info(`[paths] Migrated ${LEGACY_MODELS_DIR} → ${DEFAULT_MODELS_DIR}`);
    } catch (err) {
        log.error('[paths] Legacy path migration failed:', err);
    }
}

/**
 * Resolve the bundled prompt-templates directory shipped with the app.
 * In development  →  <repo>/assets/prompts/
 * In production   →  <app>/Contents/Resources/assets/prompts/
 */
export function getBundledPromptsDir(): string {
    const devPath = path.join(__dirname, '../../assets/prompts');

    if (process.resourcesPath != null) {
        const prodPath = path.join(process.resourcesPath, 'assets/prompts');
        if (fs.existsSync(prodPath)) return prodPath;
    }

    return devPath;
}

/**
 * Resolve the bundled theme presets directory shipped with the app.
 * In development  →  <repo>/assets/themes/
 * In production   →  <app>/Contents/Resources/assets/themes/
 */
export function getBundledThemesDir(): string {
    const devPath = path.join(__dirname, '../../assets/themes');

    if (process.resourcesPath != null) {
        const prodPath = path.join(process.resourcesPath, 'assets/themes');
        if (fs.existsSync(prodPath)) return prodPath;
    }

    return devPath;
}

/**
 * Resolve the bundled Whisper model directory.
 * In development  →  <repo>/models/whisper/
 * In production   →  <app>/Contents/Resources/models/whisper/
 *
 * After electron-vite bundles everything to out/main/index.js,
 * __dirname points to out/main/, so ../../ reaches the repo root.
 */
export function getWhisperModelDir(): string {
    const devPath = path.join(__dirname, '../../models/whisper');

    if (process.resourcesPath != null) {
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
