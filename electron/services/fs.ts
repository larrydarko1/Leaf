// File System Service
// Owns all vault-level file/folder IPC handlers.
// Pattern: export a register(ipcMain, getMainWindow) function that wires up
// its own handlers, keeping main.ts focused on app bootstrap only.

import type { IpcMain, BrowserWindow } from 'electron';
import { dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { watch } from 'fs';
import type { FSWatcher } from 'fs';
import { ALLOWED_EXTENSIONS } from '../lib/extensions';
import { IMAGE_MIMETYPES, AUDIO_MIMETYPES } from '../lib/mime';

let folderWatcher: FSWatcher | null = null;

interface FileEntry {
    name: string;
    path: string;
    relativePath: string;
    extension: string;
    size: number;
    modified: string;
    folder: string;
}

interface FolderEntry {
    name: string;
    path: string;
    relativePath: string;
    type: 'folder';
    folder: string;
}

interface ScanResult {
    files: FileEntry[];
    folders: FolderEntry[];
}

async function scanFolder(folderPath: string, basePath = folderPath): Promise<ScanResult> {
    const files: FileEntry[] = [];
    const folders: FolderEntry[] = [];
    try {
        const entries = await fs.readdir(folderPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(folderPath, entry.name);
            const relativePath = path.relative(basePath, fullPath);
            if (entry.isDirectory()) {
                folders.push({ name: entry.name, path: fullPath, relativePath, type: 'folder', folder: path.dirname(relativePath) });
                const sub = await scanFolder(fullPath, basePath);
                files.push(...sub.files);
                folders.push(...sub.folders);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (ALLOWED_EXTENSIONS.has(ext)) {
                    const stats = await fs.stat(fullPath);
                    files.push({ name: entry.name, path: fullPath, relativePath, extension: ext, size: stats.size, modified: stats.mtime.toISOString(), folder: path.dirname(relativePath) });
                }
            }
        }
    } catch (error) {
        console.error('[fs-service] Error scanning folder:', error);
    }
    return { files, folders };
}

async function findFileRecursive(dir: string, targetName: string): Promise<string | null> {
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch { return null; }
    for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isFile() && entry.name === targetName) return fullPath;
        if (entry.isDirectory()) {
            const found = await findFileRecursive(fullPath, targetName);
            if (found) return found;
        }
    }
    return null;
}

export function register(ipc: IpcMain, getMainWindow: () => BrowserWindow | null): void {

    // Open folder dialog
    ipc.handle('dialog:openFolder', async () => {
        const win = getMainWindow();
        const result = await dialog.showOpenDialog(win!, {
            properties: ['openDirectory'],
            title: 'Select Your Notes Folder',
            buttonLabel: 'Select Folder',
        });
        return result.canceled ? null : result.filePaths[0];
    });

    // Scan vault
    ipc.handle('files:scan', async (_event, folderPath: string) => {
        if (typeof folderPath !== 'string') return { success: false, error: 'Invalid path' };
        try {
            const result = await scanFolder(folderPath);
            return { success: true, files: result.files, folders: result.folders };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Watch vault for external changes
    ipc.handle('fs:watchFolder', async (_event, folderPath: string) => {
        if (typeof folderPath !== 'string') return { success: false, error: 'Invalid path' };
        try {
            if (folderWatcher) { folderWatcher.close(); folderWatcher = null; }
            folderWatcher = watch(folderPath, { recursive: true }, (eventType, filename) => {
                const win = getMainWindow();
                if (win && !win.isDestroyed()) win.webContents.send('fs:changed', { eventType, filename });
            });
            folderWatcher.on('error', (err) => console.error('[fs-service] Watcher error:', err));
            return { success: true };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    ipc.handle('fs:unwatchFolder', async () => {
        if (folderWatcher) { folderWatcher.close(); folderWatcher = null; }
        return { success: true };
    });

    // Resolve ![[embed]] path
    ipc.handle('file:resolveEmbedPath', async (_event, fileName: string, noteDir: string, vaultRoot: string) => {
        if (typeof fileName !== 'string' || typeof noteDir !== 'string' || typeof vaultRoot !== 'string') {
            return { success: false, error: 'Invalid arguments' };
        }
        try {
            const relToNote = path.resolve(noteDir, fileName);
            try { await fs.access(relToNote); return { success: true, path: relToNote }; } catch { /* not found here */ }
            const relToVault = path.resolve(vaultRoot, fileName);
            try { await fs.access(relToVault); return { success: true, path: relToVault }; } catch { /* not found here */ }
            const found = await findFileRecursive(vaultRoot, path.basename(fileName));
            if (found) return { success: true, path: found };
            return { success: false, error: 'File not found' };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Copy external file into vault
    ipc.handle('file:copyToVault', async (_event, sourcePath: string, targetDir: string) => {
        if (typeof sourcePath !== 'string' || typeof targetDir !== 'string') {
            return { success: false, error: 'Invalid arguments' };
        }
        try {
            await fs.mkdir(targetDir, { recursive: true });
            let baseName = path.basename(sourcePath);
            let targetPath = path.join(targetDir, baseName);
            let counter = 1;
            const ext = path.extname(baseName);
            const stem = baseName.slice(0, baseName.length - ext.length);
            while (true) {
                try { await fs.access(targetPath); targetPath = path.join(targetDir, `${stem} (${counter})${ext}`); baseName = path.basename(targetPath); counter++; }
                catch { break; }
            }
            await fs.copyFile(sourcePath, targetPath);
            return { success: true, fileName: baseName, path: targetPath };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Read text file
    ipc.handle('file:read', async (_event, filePath: string) => {
        if (typeof filePath !== 'string') return { success: false, error: 'Invalid path' };
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            return { success: true, content };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Read image as base64 data URL
    ipc.handle('file:readImage', async (_event, filePath: string) => {
        if (typeof filePath !== 'string') return { success: false, error: 'Invalid path' };
        try {
            const ext = path.extname(filePath).toLowerCase();
            const mimeType = IMAGE_MIMETYPES[ext] ?? 'image/png';
            const buf = await fs.readFile(filePath);
            return { success: true, dataUrl: `data:${mimeType};base64,${buf.toString('base64')}` };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Read audio as base64 data URL
    ipc.handle('file:readAudio', async (_event, filePath: string) => {
        if (typeof filePath !== 'string') return { success: false, error: 'Invalid path' };
        try {
            const ext = path.extname(filePath).toLowerCase();
            const mimeType = AUDIO_MIMETYPES[ext] ?? 'audio/mpeg';
            const buf = await fs.readFile(filePath);
            return { success: true, dataUrl: `data:${mimeType};base64,${buf.toString('base64')}` };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Write text file
    ipc.handle('file:write', async (_event, filePath: string, content: string) => {
        if (typeof filePath !== 'string' || typeof content !== 'string') return { success: false, error: 'Invalid arguments' };
        try {
            await fs.writeFile(filePath, content, 'utf-8');
            return { success: true };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Create file
    ipc.handle('file:create', async (_event, folderPath: string, fileName: string) => {
        if (typeof folderPath !== 'string' || typeof fileName !== 'string') return { success: false, error: 'Invalid arguments' };
        try {
            const filePath = path.join(folderPath, fileName);
            await fs.writeFile(filePath, '', 'utf-8');
            return { success: true, path: filePath };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Create folder
    ipc.handle('folder:create', async (_event, parentPath: string, folderName: string) => {
        if (typeof parentPath !== 'string' || typeof folderName !== 'string') return { success: false, error: 'Invalid arguments' };
        try {
            const folderPath = path.join(parentPath, folderName);
            try { await fs.access(folderPath); return { success: false, error: 'A folder with this name already exists' }; } catch { /* doesn't exist yet — good */ }
            await fs.mkdir(folderPath, { recursive: true });
            return { success: true, path: folderPath };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Delete file → trash
    ipc.handle('file:delete', async (_event, filePath: string) => {
        if (typeof filePath !== 'string') return { success: false, error: 'Invalid path' };
        try {
            await shell.trashItem(filePath);
            return { success: true };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Rename file
    ipc.handle('file:rename', async (_event, oldPath: string, newFileName: string) => {
        if (typeof oldPath !== 'string' || typeof newFileName !== 'string') return { success: false, error: 'Invalid arguments' };
        try {
            const newPath = path.join(path.dirname(oldPath), newFileName);
            try { await fs.access(newPath); return { success: false, error: 'A file with this name already exists' }; } catch { /* good */ }
            await fs.rename(oldPath, newPath);
            return { success: true, newPath };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Rename folder
    ipc.handle('folder:rename', async (_event, oldPath: string, newFolderName: string) => {
        if (typeof oldPath !== 'string' || typeof newFolderName !== 'string') return { success: false, error: 'Invalid arguments' };
        try {
            const newPath = path.join(path.dirname(oldPath), newFolderName);
            try { await fs.access(newPath); return { success: false, error: 'A folder with this name already exists' }; } catch { /* good */ }
            await fs.rename(oldPath, newPath);
            return { success: true, newPath };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Delete folder → trash
    ipc.handle('folder:delete', async (_event, folderPath: string) => {
        if (typeof folderPath !== 'string') return { success: false, error: 'Invalid path' };
        try {
            await shell.trashItem(folderPath);
            return { success: true };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Move file
    ipc.handle('file:move', async (_event, filePath: string, targetFolderPath: string) => {
        if (typeof filePath !== 'string' || typeof targetFolderPath !== 'string') return { success: false, error: 'Invalid arguments' };
        try {
            const newPath = path.join(targetFolderPath, path.basename(filePath));
            if (filePath === newPath) return { success: true, newPath };
            try { await fs.access(newPath); return { success: false, error: 'A file with this name already exists in the target folder' }; } catch { /* good */ }
            await fs.rename(filePath, newPath);
            return { success: true, newPath };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Move folder
    ipc.handle('folder:move', async (_event, folderPath: string, targetFolderPath: string) => {
        if (typeof folderPath !== 'string' || typeof targetFolderPath !== 'string') return { success: false, error: 'Invalid arguments' };
        try {
            const newPath = path.join(targetFolderPath, path.basename(folderPath));
            if (folderPath === newPath) return { success: true, newPath };
            if (targetFolderPath.startsWith(folderPath + path.sep) || targetFolderPath === folderPath) {
                return { success: false, error: 'Cannot move a folder into itself' };
            }
            try { await fs.access(newPath); return { success: false, error: 'A folder with this name already exists in the target folder' }; } catch { /* good */ }
            await fs.rename(folderPath, newPath);
            return { success: true, newPath };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });
}
