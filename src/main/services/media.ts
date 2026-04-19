/**
 * Media Service — owns IPC handlers for audio recording saves and spellcheck suggestions.
 */

import type { IpcMain } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { assertSafeFileName } from '../lib/validation';

// The vault root is passed in from the register call so media-service
// can validate that audio recordings are written inside the vault.
let getVaultRoot: (() => string | null) | null = null;

export function register(ipc: IpcMain, vaultRootFn: () => string | null): void {
    getVaultRoot = vaultRootFn;

    // Save an audio recording (base64-encoded WAV) to the vault
    ipc.handle('audio:saveRecording', async (_event, folderPath: string, fileName: string, base64Data: string) => {
        if (typeof folderPath !== 'string' || typeof fileName !== 'string' || typeof base64Data !== 'string') {
            return { success: false, error: 'Invalid arguments' };
        }
        try {
            // Only allow safe filenames (no path traversal)
            assertSafeFileName(fileName);

            // Validate target folder is inside the active vault
            const vaultRoot = getVaultRoot?.();
            if (!vaultRoot) return { success: false, error: 'No vault is open.' };
            const resolvedFolder = path.resolve(folderPath);
            const resolvedRoot = path.resolve(vaultRoot);
            if (resolvedFolder !== resolvedRoot && !resolvedFolder.startsWith(resolvedRoot + path.sep)) {
                return { success: false, error: 'Access denied: path is outside the vault.' };
            }

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
