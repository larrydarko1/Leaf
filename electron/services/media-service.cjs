// Media Service
// Owns IPC handlers for audio recording saves and spellcheck suggestions.

const { ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;

/**
 * Wire up media IPC handlers.
 * @param {Electron.IpcMain} ipc
 */
function register(ipc) {
    // Save an audio recording (base64-encoded WAV) to the vault
    ipc.handle('audio:saveRecording', async (event, folderPath, fileName, base64Data) => {
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
            return { success: false, error: error.message };
        }
    });

    // Spellcheck suggestions — Chromium handles this natively via the context menu.
    // This stub exists so the renderer's API call doesn't throw.
    ipc.handle('spellcheck:getSuggestions', async () => {
        return { success: true, suggestions: [] };
    });
}

module.exports = { register };
