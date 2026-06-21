/**
 * File System Service — owns all vault-level file/folder IPC handlers.
 * Exports a register function that wires up handlers, keeping main.ts
 * focused on app bootstrap only.
 */

import type { IpcMain, BrowserWindow } from 'electron';
import { dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { watch, existsSync } from 'fs';
import type { FSWatcher } from 'fs';
import { z } from 'zod';
import { ALLOWED_EXTENSIONS } from '@/main/lib/extensions';
import { IMAGE_MIMETYPES, AUDIO_MIMETYPES } from '@/main/lib/mime';
import { assertInsideBoundary } from '@/main/lib/validation';
import { log } from '@/main/lib/logger';
import type { FileInfo, FolderInfo, ScanResult } from '@/schemas/vault';
import {
    SaveDialogOptionsSchema,
    FileWriteBufferArgsSchema,
    ResolveEmbedArgsSchema,
    FileCopyToVaultArgsSchema,
    FileWriteArgsSchema,
    FileCreateArgsSchema,
    FolderCreateArgsSchema,
    FileRenameArgsSchema,
    UpdateEmbedRefsArgsSchema,
    FolderRenameArgsSchema,
    FileMoveArgsSchema,
    FolderMoveArgsSchema,
} from '@/schemas/vault';

let folderWatcher: FSWatcher | null = null;

// The vault root is set when the user opens a folder (via files:scan).
// All subsequent file operations are validated against this root.
let vaultRoot: string | null = null;

/** Returns the active vault root, or null if no vault is open. */
export function getVaultRoot(): string | null {
    return vaultRoot;
}

/** Close the folder watcher if active. Called during app shutdown. */
export function cleanup(): void {
    if (folderWatcher !== null) {
        folderWatcher.close();
        folderWatcher = null;
    }
}

export function register(ipc: IpcMain, getMainWindow: () => BrowserWindow | null): void {
    // Open folder dialog
    ipc.handle('dialog:openFolder', async () => {
        const win = getMainWindow();
        if (win === null) return { success: false, error: 'No window available' };
        const result = await dialog.showOpenDialog(win, {
            properties: ['openDirectory'],
            title: 'Select Your Notes Folder',
            buttonLabel: 'Select Folder',
        });
        return result.canceled ? null : result.filePaths[0];
    });

    // Save-file dialog (for exporting images, etc.)
    ipc.handle('dialog:showSaveDialog', async (_event, rawOptions: unknown) => {
        const parsed = SaveDialogOptionsSchema.safeParse(rawOptions);
        if (!parsed.success) return { success: false, error: 'Invalid arguments' };
        const win = getMainWindow();
        if (win === null) return { success: false, error: 'No window available' };
        const result = await dialog.showSaveDialog(win, {
            defaultPath: parsed.data.defaultPath,
            filters: parsed.data.filters,
        });
        return result.canceled ? null : result.filePath;
    });

    // Write binary file from base64 data
    ipc.handle('file:writeBuffer', async (_event, rawFilePath: unknown, rawBase64Data: unknown) => {
        const parsed = FileWriteBufferArgsSchema.safeParse({ filePath: rawFilePath, base64Data: rawBase64Data });
        if (!parsed.success) return { success: false, error: 'Invalid arguments' };
        const { filePath, base64Data } = parsed.data;
        try {
            await fs.writeFile(filePath, Buffer.from(base64Data, 'base64'));
            return { success: true };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Scan vault — this also sets the active vault root for boundary checks
    ipc.handle('files:scan', async (_event, rawFolderPath: unknown) => {
        const parsed = z.string().safeParse(rawFolderPath);
        if (!parsed.success) return { success: false, error: 'Invalid path' };
        const folderPath = parsed.data;
        try {
            vaultRoot = path.resolve(folderPath);
            const result = await scanFolder(folderPath);
            return { success: true, files: result.files, folders: result.folders };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Watch vault for external changes
    ipc.handle('fs:watchFolder', (_event, rawFolderPath: unknown) => {
        const parsed = z.string().safeParse(rawFolderPath);
        if (!parsed.success) return { success: false, error: 'Invalid path' };
        const folderPath = parsed.data;
        if (!existsSync(folderPath)) return { success: false, error: `Folder does not exist: ${folderPath}` };
        try {
            if (folderWatcher !== null && folderWatcher !== undefined) {
                folderWatcher.close();
                folderWatcher = null;
            }
            folderWatcher = watch(folderPath, { recursive: true }, (eventType, filename) => {
                const win = getMainWindow();
                if (win !== null && !win.isDestroyed()) win.webContents.send('fs:changed', { eventType, filename });
            });
            folderWatcher.on('error', (err) => log.error('[fs-service] Watcher error:', err));
            return { success: true };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    ipc.handle('fs:unwatchFolder', () => {
        if (folderWatcher !== null) {
            folderWatcher.close();
            folderWatcher = null;
        }
        return { success: true };
    });

    // Resolve ![[embed]] path
    ipc.handle(
        'file:resolveEmbedPath',
        async (_event, rawFileName: unknown, rawNoteDir: unknown, rawEmbedVaultRoot: unknown) => {
            const parsed = ResolveEmbedArgsSchema.safeParse({
                fileName: rawFileName,
                noteDir: rawNoteDir,
                embedVaultRoot: rawEmbedVaultRoot,
            });
            if (!parsed.success) return { success: false, error: 'Invalid arguments' };
            const { fileName, noteDir, embedVaultRoot } = parsed.data;
            try {
                const root = requireVaultRoot();
                // Both noteDir and embedVaultRoot must be inside the active vault
                assertInsideBoundary(noteDir, root);
                assertInsideBoundary(embedVaultRoot, root);

                const relToNote = path.resolve(noteDir, fileName);
                if (relToNote.startsWith(root + path.sep) || relToNote === root) {
                    try {
                        await fs.access(relToNote);
                        return { success: true, path: relToNote };
                    } catch {
                        /* not found here */
                    }
                }
                const relToVault = path.resolve(embedVaultRoot, fileName);
                if (relToVault.startsWith(root + path.sep) || relToVault === root) {
                    try {
                        await fs.access(relToVault);
                        return { success: true, path: relToVault };
                    } catch {
                        /* not found here */
                    }
                }
                const found = await findFileRecursive(embedVaultRoot, path.basename(fileName));
                if (found !== null) {
                    assertInsideBoundary(found, root);
                    return { success: true, path: found };
                }
                return { success: false, error: 'File not found' };
            } catch (error) {
                return { success: false, error: (error as Error).message };
            }
        },
    );

    // Copy external file into vault
    ipc.handle('file:copyToVault', async (_event, rawSourcePath: unknown, rawTargetDir: unknown) => {
        const parsed = FileCopyToVaultArgsSchema.safeParse({ sourcePath: rawSourcePath, targetDir: rawTargetDir });
        if (!parsed.success) return { success: false, error: 'Invalid arguments' };
        const { sourcePath, targetDir } = parsed.data;
        try {
            // Source can be anywhere (user dragged from Finder), but target must be inside vault
            assertInsideVault(targetDir);
            await fs.mkdir(targetDir, { recursive: true });
            let baseName = path.basename(sourcePath);
            let targetPath = path.join(targetDir, baseName);
            let counter = 1;
            const ext = path.extname(baseName);
            const stem = baseName.slice(0, baseName.length - ext.length);
            while (true) {
                try {
                    await fs.access(targetPath);
                    targetPath = path.join(targetDir, `${stem} (${counter})${ext}`);
                    baseName = path.basename(targetPath);
                    counter++;
                } catch {
                    break;
                }
            }
            await fs.copyFile(sourcePath, targetPath);
            return { success: true, fileName: baseName, path: targetPath };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Read text file
    ipc.handle('file:read', async (_event, rawFilePath: unknown) => {
        const parsed = z.string().safeParse(rawFilePath);
        if (!parsed.success) return { success: false, error: 'Invalid path' };
        const filePath = parsed.data;
        try {
            assertInsideVault(filePath);
            const content = await fs.readFile(filePath, 'utf-8');
            return { success: true, content };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Read image as base64 data URL
    ipc.handle('file:readImage', async (_event, rawFilePath: unknown) => {
        const parsed = z.string().safeParse(rawFilePath);
        if (!parsed.success) return { success: false, error: 'Invalid path' };
        const filePath = parsed.data;
        try {
            assertInsideVault(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const mimeType = IMAGE_MIMETYPES[ext] ?? 'image/png';
            const buf = await fs.readFile(filePath);
            return { success: true, dataUrl: `data:${mimeType};base64,${buf.toString('base64')}` };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Read audio as base64 data URL
    ipc.handle('file:readAudio', async (_event, rawFilePath: unknown) => {
        const parsed = z.string().safeParse(rawFilePath);
        if (!parsed.success) return { success: false, error: 'Invalid path' };
        const filePath = parsed.data;
        try {
            assertInsideVault(filePath);
            const ext = path.extname(filePath).toLowerCase();
            const mimeType = AUDIO_MIMETYPES[ext] ?? 'audio/mpeg';
            const buf = await fs.readFile(filePath);
            return { success: true, dataUrl: `data:${mimeType};base64,${buf.toString('base64')}` };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Write text file (atomic: write to .tmp then rename)
    ipc.handle('file:write', async (_event, rawFilePath: unknown, rawContent: unknown) => {
        const parsed = FileWriteArgsSchema.safeParse({ filePath: rawFilePath, content: rawContent });
        if (!parsed.success) return { success: false, error: 'Invalid arguments' };
        const { filePath, content } = parsed.data;
        try {
            assertInsideVault(filePath);
            const tmp = filePath + '.tmp';
            await fs.writeFile(tmp, content, 'utf-8');
            await fs.rename(tmp, filePath);
            return { success: true };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Create file
    ipc.handle('file:create', async (_event, rawFolderPath: unknown, rawFileName: unknown) => {
        const parsed = FileCreateArgsSchema.safeParse({ folderPath: rawFolderPath, fileName: rawFileName });
        if (!parsed.success) return { success: false, error: 'Invalid arguments' };
        const { folderPath, fileName } = parsed.data;
        try {
            assertInsideVault(folderPath);
            const filePath = path.join(folderPath, fileName);
            assertInsideVault(filePath);
            await fs.writeFile(filePath, '', 'utf-8');
            return { success: true, path: filePath };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Create folder
    ipc.handle('folder:create', async (_event, rawParentPath: unknown, rawFolderName: unknown) => {
        const parsed = FolderCreateArgsSchema.safeParse({ parentPath: rawParentPath, folderName: rawFolderName });
        if (!parsed.success) return { success: false, error: 'Invalid arguments' };
        const { parentPath, folderName } = parsed.data;
        try {
            assertInsideVault(parentPath);
            const folderPath = path.join(parentPath, folderName);
            assertInsideVault(folderPath);
            try {
                await fs.access(folderPath);
                return { success: false, error: 'A folder with this name already exists' };
            } catch {
                /* doesn't exist yet — good */
            }
            await fs.mkdir(folderPath, { recursive: true });
            return { success: true, path: folderPath };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Delete file → trash
    ipc.handle('file:delete', async (_event, rawFilePath: unknown) => {
        const parsed = z.string().safeParse(rawFilePath);
        if (!parsed.success) return { success: false, error: 'Invalid path' };
        const filePath = parsed.data;
        try {
            assertInsideVault(filePath);
            await shell.trashItem(filePath);
            return { success: true };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Rename file
    ipc.handle('file:rename', async (_event, rawOldPath: unknown, rawNewFileName: unknown) => {
        const parsed = FileRenameArgsSchema.safeParse({ oldPath: rawOldPath, newFileName: rawNewFileName });
        if (!parsed.success) return { success: false, error: 'Invalid arguments' };
        const { oldPath, newFileName } = parsed.data;
        try {
            assertInsideVault(oldPath);
            const newPath = path.join(path.dirname(oldPath), newFileName);
            assertInsideVault(newPath);
            if (oldPath.toLowerCase() !== newPath.toLowerCase()) {
                try {
                    await fs.access(newPath);
                    return { success: false, error: 'A file with this name already exists' };
                } catch {
                    /* good */
                }
            }
            await fs.rename(oldPath, newPath);
            return { success: true, newPath };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Update embed references across all markdown files when a file is renamed
    ipc.handle('file:updateEmbedRefs', async (_event, rawOldFileName: unknown, rawNewFileName: unknown) => {
        const parsed = UpdateEmbedRefsArgsSchema.safeParse({
            oldFileName: rawOldFileName,
            newFileName: rawNewFileName,
        });
        if (!parsed.success) return { success: false, error: 'Invalid arguments' };
        const { oldFileName, newFileName } = parsed.data;
        try {
            const root = requireVaultRoot();
            const { files: allFiles } = await scanFolder(root);
            const mdFiles = allFiles.filter((f) => f.extension === '.md');
            let updatedCount = 0;

            // Match ![[oldFileName]] with optional |options or #heading suffixes
            const oldBase = oldFileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const embedRegex = new RegExp(`(!\\[\\[)${oldBase}((?:[|#][^\\]]*)?\\]\\])`, 'g');

            for (const file of mdFiles) {
                const content = await fs.readFile(file.path, 'utf-8');
                if (!embedRegex.test(content)) {
                    embedRegex.lastIndex = 0;
                    continue;
                }
                embedRegex.lastIndex = 0;
                const updated = content.replace(embedRegex, `$1${newFileName}$2`);
                await fs.writeFile(file.path, updated, 'utf-8');
                updatedCount++;
            }

            return { success: true, updatedCount };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Rename folder
    ipc.handle('folder:rename', async (_event, rawOldPath: unknown, rawNewFolderName: unknown) => {
        const parsed = FolderRenameArgsSchema.safeParse({ oldPath: rawOldPath, newFolderName: rawNewFolderName });
        if (!parsed.success) return { success: false, error: 'Invalid arguments' };
        const { oldPath, newFolderName } = parsed.data;
        try {
            assertInsideVault(oldPath);
            const newPath = path.join(path.dirname(oldPath), newFolderName);
            assertInsideVault(newPath);
            if (oldPath.toLowerCase() !== newPath.toLowerCase()) {
                try {
                    await fs.access(newPath);
                    return { success: false, error: 'A folder with this name already exists' };
                } catch {
                    /* good */
                }
            }
            await fs.rename(oldPath, newPath);
            return { success: true, newPath };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Delete folder → trash
    ipc.handle('folder:delete', async (_event, rawFolderPath: unknown) => {
        const parsed = z.string().safeParse(rawFolderPath);
        if (!parsed.success) return { success: false, error: 'Invalid path' };
        const folderPath = parsed.data;
        try {
            assertInsideVault(folderPath);
            await shell.trashItem(folderPath);
            return { success: true };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Move file
    ipc.handle('file:move', async (_event, rawFilePath: unknown, rawTargetFolderPath: unknown) => {
        const parsed = FileMoveArgsSchema.safeParse({ filePath: rawFilePath, targetFolderPath: rawTargetFolderPath });
        if (!parsed.success) return { success: false, error: 'Invalid arguments' };
        const { filePath, targetFolderPath } = parsed.data;
        try {
            assertInsideVault(filePath);
            assertInsideVault(targetFolderPath);
            const newPath = path.join(targetFolderPath, path.basename(filePath));
            if (filePath === newPath) return { success: true, newPath };
            try {
                await fs.access(newPath);
                return { success: false, error: 'A file with this name already exists in the target folder' };
            } catch {
                /* good */
            }
            await fs.rename(filePath, newPath);
            return { success: true, newPath };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Move folder
    ipc.handle('folder:move', async (_event, rawFolderPath: unknown, rawTargetFolderPath: unknown) => {
        const parsed = FolderMoveArgsSchema.safeParse({
            folderPath: rawFolderPath,
            targetFolderPath: rawTargetFolderPath,
        });
        if (!parsed.success) return { success: false, error: 'Invalid arguments' };
        const { folderPath, targetFolderPath } = parsed.data;
        try {
            assertInsideVault(folderPath);
            assertInsideVault(targetFolderPath);
            const newPath = path.join(targetFolderPath, path.basename(folderPath));
            if (folderPath === newPath) return { success: true, newPath };
            if (targetFolderPath.startsWith(folderPath + path.sep) || targetFolderPath === folderPath) {
                return { success: false, error: 'Cannot move a folder into itself' };
            }
            try {
                await fs.access(newPath);
                return { success: false, error: 'A folder with this name already exists in the target folder' };
            } catch {
                /* good */
            }
            await fs.rename(folderPath, newPath);
            return { success: true, newPath };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    // Bookmarks — persisted in <vault>/.leaf/bookmarks.json
    ipc.handle('bookmarks:load', async () => {
        try {
            const root = requireVaultRoot();
            const bookmarksPath = path.join(root, '.leaf', 'bookmarks.json');
            try {
                const raw = await fs.readFile(bookmarksPath, 'utf-8');
                const parsed: unknown = JSON.parse(raw);
                if (!Array.isArray(parsed)) return { success: true, bookmarks: [] };
                // Only return paths that are still inside the vault
                const valid = parsed.filter((p): p is string => typeof p === 'string' && p.startsWith(root + path.sep));
                return { success: true, bookmarks: valid };
            } catch {
                return { success: true, bookmarks: [] };
            }
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    ipc.handle('bookmarks:save', async (_event, rawBookmarks: unknown) => {
        const parsed = z.array(z.string()).safeParse(rawBookmarks);
        if (!parsed.success) return { success: false, error: 'Invalid bookmarks payload' };
        try {
            const root = requireVaultRoot();
            const leafDir = path.join(root, '.leaf');
            await fs.mkdir(leafDir, { recursive: true });
            const bookmarksPath = path.join(leafDir, 'bookmarks.json');
            // Validate every path is inside the vault before persisting
            for (const p of parsed.data) {
                assertInsideBoundary(p, root);
            }
            await fs.writeFile(bookmarksPath, JSON.stringify(parsed.data, null, 2), 'utf-8');
            return { success: true };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });
}

function requireVaultRoot(): string {
    if (vaultRoot === null) throw new Error('No vault is open.');
    return vaultRoot;
}

/** Resolve `p` and assert it lives inside the active vault. */
function assertInsideVault(p: string): string {
    return assertInsideBoundary(p, requireVaultRoot());
}

async function scanFolder(folderPath: string, basePath = folderPath): Promise<ScanResult> {
    const files: FileInfo[] = [];
    const folders: FolderInfo[] = [];
    try {
        const entries = await fs.readdir(folderPath, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(folderPath, entry.name);
            const relativePath = path.relative(basePath, fullPath);
            if (entry.isDirectory()) {
                if (entry.name === '.leaf') continue; // hide Leaf's internal metadata folder
                folders.push({
                    name: entry.name,
                    path: fullPath,
                    relativePath,
                    type: 'folder',
                    folder: path.dirname(relativePath),
                });
                const sub = await scanFolder(fullPath, basePath);
                files.push(...sub.files);
                folders.push(...sub.folders);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (ALLOWED_EXTENSIONS.has(ext)) {
                    const stats = await fs.stat(fullPath);
                    files.push({
                        name: entry.name,
                        path: fullPath,
                        relativePath,
                        extension: ext,
                        size: stats.size,
                        modified: stats.mtime.toISOString(),
                        folder: path.dirname(relativePath),
                    });
                }
            }
        }
    } catch (error) {
        log.error('[fs-service] Error scanning folder:', error);
    }
    return { success: true, files, folders };
}

async function findFileRecursive(dir: string, targetName: string): Promise<string | null> {
    let entries;
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
        return null;
    }
    for (const entry of entries) {
        if (entry.name.startsWith('.')) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isFile() && entry.name === targetName) return fullPath;
        if (entry.isDirectory()) {
            const found = await findFileRecursive(fullPath, targetName);
            if (found !== null) return found;
        }
    }
    return null;
}
