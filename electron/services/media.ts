// Media Service
// Owns IPC handlers for audio recording saves and spellcheck suggestions.

import type { IpcMain } from 'electron';
import path from 'path';
import fs from 'fs/promises';

export function register(ipc: IpcMain): void {
    // Save an audio recording (base64-encoded WAV) to the vault
    ipc.handle('audio:saveRecording', async (_event, folderPath: string, fileName: string, base64Data: string) => {
        if (typeof folderPath !== 'string' || typeof fileName !== 'string' || typeof base64Data !== 'string') {
            return { success: false, error: 'Invalid arguments' };
        }
        // Only allow safe filenames (no path traversal)
        if (path.basename(fileName) !== fileName) {
            return { success: false, error: 'Invalid file name' };
        }
        try {
            const filePath = path.join(folderPath, fileName);
            await fs.writeFile(filePath, Buffer.from(base64Data, 'base64'));
            return { success: true, path: filePath };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Spellcheck suggestions — Chromium handles this natively via the context menu.
    // This stub exists so the renderer's API call doesn't throw.
    ipc.handle('spellcheck:getSuggestions', async () => {
        return { success: true, suggestions: [] };
    });
}
