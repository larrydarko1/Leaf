/**
 * File System Service — owns all vault-level file/folder IPC handlers.
 * Exports a register function that wires up handlers, keeping main.ts
 * focused on app bootstrap only.
 */

import type { IpcMain, BrowserWindow } from 'electron';
import { app, dialog, shell } from 'electron';
import path from 'path';
import fs from 'fs/promises';
import { watch, existsSync } from 'fs';
import type { FSWatcher } from 'fs';
import { z } from 'zod';
import { ALLOWED_EXTENSIONS } from '@/main/lib/extensions';
import { IMAGE_MIMETYPES, AUDIO_MIMETYPES } from '@/main/lib/mime';
import { resolveInsideBoundary } from '@/main/lib/validation';
import { readState, updateState } from '@/main/lib/appState';
import { log } from '@/main/lib/logger';
import type { FileInfo, FolderInfo, ScanResult } from '@/schemas/vault';
import {
    SaveDialogOptionsSchema,
    FileWriteBufferArgsSchema,
    ResolveEmbedArgsSchema,
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

let vaultRoot: string | null = null;
const authorizedWritePaths: Set<string> = new Set<string>();

/** Returns the active vault root, or null if no vault is open. */
export function findVaultRoot(): string | null {
    return vaultRoot;
}

export async function initVaultRoot(): Promise<void> {
    try {
        const state = await readState();
        const saved: unknown = state.vaultRoot;
        if (typeof saved !== 'string' || saved === '') return;
        const resolved = path.resolve(saved);
        if (!existsSync(resolved)) {
            log.info('[fs-service] Persisted vault root no longer exists, ignoring:', resolved);
            return;
        }
        vaultRoot = resolved;
    } catch (err) {
        log.error('[fs-service] Failed to restore vault root:', err);
    }
}

/** Set and persist the vault root. Only reachable from the folder dialog. */
async function setVaultRoot(dir: string): Promise<string> {
    const resolved = path.resolve(dir);
    vaultRoot = resolved;
    await updateState((s): { vaultRoot: string } => ({ ...s, vaultRoot: resolved }));
    return resolved;
}

/** Clear the vault root and forget it across restarts. */
async function clearVaultRoot(): Promise<void> {
    vaultRoot = null;
    await updateState((s): Record<string, unknown> => {
        const next = { ...s };
        delete next.vaultRoot;
        return next;
    });
}

/** Close the folder watcher if active. Called during app shutdown. */
export function cleanup(): void {
    if (folderWatcher !== null) {
        folderWatcher.close();
        folderWatcher = null;
    }
}

export function register(ipc: IpcMain, findMainWindow: () => BrowserWindow | null): void {
    // Open folder dialog — the ONLY way the vault root changes.
    ipc.handle('dialog:openFolder', async (): Promise<string | { success: boolean; error: string } | null> => {
        const win = findMainWindow();
        if (win === null) return { success: false, error: 'No window available' };
        const result = await dialog.showOpenDialog(win, {
            properties: ['openDirectory'],
            title: 'Select Your Notes Folder',
            buttonLabel: 'Select Folder',
            defaultPath: vaultRoot ?? app.getPath('home'), // Electron 43+ falls back to Downloads when this is unset.
        });
        if (result.canceled) return null;
        return await setVaultRoot(result.filePaths[0]);
    });

    // Close the current vault, so it is not reopened on next launch.
    ipc.handle(
        'vault:close',
        async (): Promise<{ success: boolean; error?: undefined } | { success: boolean; error: string }> => {
            try {
                await clearVaultRoot();
                return { success: true };
            } catch (error) {
                return { success: false, error: (error as Error).message };
            }
        },
    );

    // Save-file dialog (for exporting images, etc.).
    // The chosen path is recorded as a one-shot write authorisation — see
    // `file:writeBuffer` below.
    ipc.handle(
        'dialog:showSaveDialog',
        async (_event, rawOptions: unknown): Promise<string | { success: boolean; error: string } | null> => {
            const parsed = SaveDialogOptionsSchema.safeParse(rawOptions);
            if (!parsed.success) return { success: false, error: 'Invalid arguments' };
            const win = findMainWindow();
            if (win === null) return { success: false, error: 'No window available' };
            // Electron 43+ resolves a bare filename against Downloads, so anchor it to the vault.
            const requested = parsed.data.defaultPath;
            const result = await dialog.showSaveDialog(win, {
                defaultPath:
                    requested === undefined || path.isAbsolute(requested)
                        ? requested
                        : path.join(vaultRoot ?? app.getPath('home'), requested),
                filters: parsed.data.filters,
            });
            if (result.canceled || result.filePath === undefined || result.filePath === '') return null;
            authorizedWritePaths.add(path.resolve(result.filePath));
            return result.filePath;
        },
    );

    /**
     * Write binary file from base64 data.
     */
    ipc.handle(
        'file:writeBuffer',
        async (
            _event,
            rawFilePath: unknown,
            rawBase64Data: unknown,
        ): Promise<{ success: boolean; error: string } | { success: boolean; error?: undefined }> => {
            const parsed = FileWriteBufferArgsSchema.safeParse({ filePath: rawFilePath, base64Data: rawBase64Data });
            if (!parsed.success) return { success: false, error: 'Invalid arguments' };
            const { filePath, base64Data } = parsed.data;
            const resolved = path.resolve(filePath);
            if (!authorizedWritePaths.delete(resolved)) {
                return { success: false, error: 'Access denied: path was not authorised by a save dialog.' };
            }
            try {
                await fs.writeFile(resolved, Buffer.from(base64Data, 'base64'));
                return { success: true };
            } catch (error) {
                return { success: false, error: (error as Error).message };
            }
        },
    );

    ipc.handle(
        'files:scan',
        async (): Promise<
            | {
                  success: boolean;
                  root: string;
                  files: {
                      name: string;
                      path: string;
                      relativePath: string;
                      extension: string;
                      size: number;
                      modified: string;
                      folder: string;
                  }[];
                  folders: FolderInfo[];
                  error?: undefined;
              }
            | { success: boolean; error: string; root?: undefined; files?: undefined; folders?: undefined }
        > => {
            try {
                const root = getVaultRoot();
                const result = await scanFolder(root);
                return { success: true, root, files: result.files, folders: result.folders };
            } catch (error) {
                return { success: false, error: (error as Error).message };
            }
        },
    );

    // Watch the active vault for external changes. Also takes no path.
    ipc.handle('fs:watchFolder', (): { success: boolean; error: string } | { success: boolean; error?: undefined } => {
        let root: string;
        try {
            root = getVaultRoot();
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
        if (!existsSync(root)) return { success: false, error: `Folder does not exist: ${root}` };
        try {
            if (folderWatcher !== null && folderWatcher !== undefined) {
                folderWatcher.close();
                folderWatcher = null;
            }
            folderWatcher = watch(root, { recursive: true }, (eventType, filename): void => {
                const win = findMainWindow();
                if (win !== null && !win.isDestroyed()) win.webContents.send('fs:changed', { eventType, filename });
            });
            folderWatcher.on('error', (err): void => log.error('[fs-service] Watcher error:', err));
            return { success: true };
        } catch (error) {
            return { success: false, error: (error as Error).message };
        }
    });

    ipc.handle('fs:unwatchFolder', (): { success: boolean } => {
        if (folderWatcher !== null) {
            folderWatcher.close();
            folderWatcher = null;
        }
        return { success: true };
    });

    // Resolve ![[embed]] path
    ipc.handle(
        'file:resolveEmbedPath',
        async (
            _event,
            rawFileName: unknown,
            rawNoteDir: unknown,
            rawEmbedVaultRoot: unknown,
        ): Promise<
            | { success: boolean; error: string; path?: undefined }
            | { success: boolean; path: string; error?: undefined }
        > => {
            const parsed = ResolveEmbedArgsSchema.safeParse({
                fileName: rawFileName,
                noteDir: rawNoteDir,
                embedVaultRoot: rawEmbedVaultRoot,
            });
            if (!parsed.success) return { success: false, error: 'Invalid arguments' };
            const { fileName, noteDir, embedVaultRoot } = parsed.data;
            try {
                const root = getVaultRoot();
                // Both noteDir and embedVaultRoot must be inside the active vault
                resolveInsideBoundary(noteDir, root);
                resolveInsideBoundary(embedVaultRoot, root);

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
                    resolveInsideBoundary(found, root);
                    return { success: true, path: found };
                }
                return { success: false, error: 'File not found' };
            } catch (error) {
                return { success: false, error: (error as Error).message };
            }
        },
    );

    // Read text file
    ipc.handle(
        'file:read',
        async (
            _event,
            rawFilePath: unknown,
        ): Promise<
            | { success: boolean; error: string; content?: undefined }
            | { success: boolean; content: string; error?: undefined }
        > => {
            const parsed = z.string().safeParse(rawFilePath);
            if (!parsed.success) return { success: false, error: 'Invalid path' };
            const filePath = parsed.data;
            try {
                resolveInsideVault(filePath);
                const content = await fs.readFile(filePath, 'utf-8');
                return { success: true, content };
            } catch (error) {
                return { success: false, error: (error as Error).message };
            }
        },
    );

    // Read image as base64 data URL
    ipc.handle(
        'file:readImage',
        async (
            _event,
            rawFilePath: unknown,
        ): Promise<
            | { success: boolean; error: string; dataUrl?: undefined }
            | { success: boolean; dataUrl: string; error?: undefined }
        > => {
            const parsed = z.string().safeParse(rawFilePath);
            if (!parsed.success) return { success: false, error: 'Invalid path' };
            const filePath = parsed.data;
            try {
                resolveInsideVault(filePath);
                const ext = path.extname(filePath).toLowerCase();
                const mimeType = IMAGE_MIMETYPES[ext] ?? 'image/png';
                const buf = await fs.readFile(filePath);
                return { success: true, dataUrl: `data:${mimeType};base64,${buf.toString('base64')}` };
            } catch (error) {
                return { success: false, error: (error as Error).message };
            }
        },
    );

    // Read audio as base64 data URL
    ipc.handle(
        'file:readAudio',
        async (
            _event,
            rawFilePath: unknown,
        ): Promise<
            | { success: boolean; error: string; dataUrl?: undefined }
            | { success: boolean; dataUrl: string; error?: undefined }
        > => {
            const parsed = z.string().safeParse(rawFilePath);
            if (!parsed.success) return { success: false, error: 'Invalid path' };
            const filePath = parsed.data;
            try {
                resolveInsideVault(filePath);
                const ext = path.extname(filePath).toLowerCase();
                const mimeType = AUDIO_MIMETYPES[ext] ?? 'audio/mpeg';
                const buf = await fs.readFile(filePath);
                return { success: true, dataUrl: `data:${mimeType};base64,${buf.toString('base64')}` };
            } catch (error) {
                return { success: false, error: (error as Error).message };
            }
        },
    );

    // Write text file (atomic: write to .tmp then rename)
    ipc.handle(
        'file:write',
        async (
            _event,
            rawFilePath: unknown,
            rawContent: unknown,
        ): Promise<{ success: boolean; error: string } | { success: boolean; error?: undefined }> => {
            const parsed = FileWriteArgsSchema.safeParse({ filePath: rawFilePath, content: rawContent });
            if (!parsed.success) return { success: false, error: 'Invalid arguments' };
            const { filePath, content } = parsed.data;
            try {
                resolveInsideVault(filePath);
                const tmp = filePath + '.tmp';
                await fs.writeFile(tmp, content, 'utf-8');
                await fs.rename(tmp, filePath);
                return { success: true };
            } catch (error) {
                return { success: false, error: (error as Error).message };
            }
        },
    );

    // Create file
    ipc.handle(
        'file:create',
        async (
            _event,
            rawFolderPath: unknown,
            rawFileName: unknown,
        ): Promise<
            | { success: boolean; error: string; path?: undefined }
            | { success: boolean; path: string; error?: undefined }
        > => {
            const parsed = FileCreateArgsSchema.safeParse({ folderPath: rawFolderPath, fileName: rawFileName });
            if (!parsed.success) return { success: false, error: 'Invalid arguments' };
            const { folderPath, fileName } = parsed.data;
            try {
                resolveInsideVault(folderPath);
                const filePath = path.join(folderPath, fileName);
                resolveInsideVault(filePath);
                await fs.writeFile(filePath, '', 'utf-8');
                return { success: true, path: filePath };
            } catch (error) {
                return { success: false, error: (error as Error).message };
            }
        },
    );

    // Create folder
    ipc.handle(
        'folder:create',
        async (
            _event,
            rawParentPath: unknown,
            rawFolderName: unknown,
        ): Promise<
            | { success: boolean; error: string; path?: undefined }
            | { success: boolean; path: string; error?: undefined }
        > => {
            const parsed = FolderCreateArgsSchema.safeParse({ parentPath: rawParentPath, folderName: rawFolderName });
            if (!parsed.success) return { success: false, error: 'Invalid arguments' };
            const { parentPath, folderName } = parsed.data;
            try {
                resolveInsideVault(parentPath);
                const folderPath = path.join(parentPath, folderName);
                resolveInsideVault(folderPath);
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
        },
    );

    // Delete file → trash
    ipc.handle(
        'file:delete',
        async (
            _event,
            rawFilePath: unknown,
        ): Promise<{ success: boolean; error: string } | { success: boolean; error?: undefined }> => {
            const parsed = z.string().safeParse(rawFilePath);
            if (!parsed.success) return { success: false, error: 'Invalid path' };
            const filePath = parsed.data;
            try {
                resolveInsideVault(filePath);
                await shell.trashItem(filePath);
                return { success: true };
            } catch (error) {
                return { success: false, error: (error as Error).message };
            }
        },
    );

    // Rename file
    ipc.handle(
        'file:rename',
        async (
            _event,
            rawOldPath: unknown,
            rawNewFileName: unknown,
        ): Promise<
            | { success: boolean; error: string; newPath?: undefined }
            | { success: boolean; newPath: string; error?: undefined }
        > => {
            const parsed = FileRenameArgsSchema.safeParse({ oldPath: rawOldPath, newFileName: rawNewFileName });
            if (!parsed.success) return { success: false, error: 'Invalid arguments' };
            const { oldPath, newFileName } = parsed.data;
            try {
                resolveInsideVault(oldPath);
                const newPath = path.join(path.dirname(oldPath), newFileName);
                resolveInsideVault(newPath);
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
        },
    );

    // Update embed references across all markdown files when a file is renamed
    ipc.handle(
        'file:updateEmbedRefs',
        async (
            _event,
            rawOldFileName: unknown,
            rawNewFileName: unknown,
        ): Promise<
            | { success: boolean; error: string; updatedCount?: undefined }
            | { success: boolean; updatedCount: number; error?: undefined }
        > => {
            const parsed = UpdateEmbedRefsArgsSchema.safeParse({
                oldFileName: rawOldFileName,
                newFileName: rawNewFileName,
            });
            if (!parsed.success) return { success: false, error: 'Invalid arguments' };
            const { oldFileName, newFileName } = parsed.data;
            try {
                const root = getVaultRoot();
                const { files: allFiles } = await scanFolder(root);
                const mdFiles = allFiles.filter((f): boolean => f.extension === '.md');
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
        },
    );

    // Rename folder
    ipc.handle(
        'folder:rename',
        async (
            _event,
            rawOldPath: unknown,
            rawNewFolderName: unknown,
        ): Promise<
            | { success: boolean; error: string; newPath?: undefined }
            | { success: boolean; newPath: string; error?: undefined }
        > => {
            const parsed = FolderRenameArgsSchema.safeParse({ oldPath: rawOldPath, newFolderName: rawNewFolderName });
            if (!parsed.success) return { success: false, error: 'Invalid arguments' };
            const { oldPath, newFolderName } = parsed.data;
            try {
                resolveInsideVault(oldPath);
                const newPath = path.join(path.dirname(oldPath), newFolderName);
                resolveInsideVault(newPath);
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
        },
    );

    // Delete folder → trash
    ipc.handle(
        'folder:delete',
        async (
            _event,
            rawFolderPath: unknown,
        ): Promise<{ success: boolean; error: string } | { success: boolean; error?: undefined }> => {
            const parsed = z.string().safeParse(rawFolderPath);
            if (!parsed.success) return { success: false, error: 'Invalid path' };
            const folderPath = parsed.data;
            try {
                resolveInsideVault(folderPath);
                await shell.trashItem(folderPath);
                return { success: true };
            } catch (error) {
                return { success: false, error: (error as Error).message };
            }
        },
    );

    // Move file
    ipc.handle(
        'file:move',
        async (
            _event,
            rawFilePath: unknown,
            rawTargetFolderPath: unknown,
        ): Promise<
            | { success: boolean; error: string; newPath?: undefined }
            | { success: boolean; newPath: string; error?: undefined }
        > => {
            const parsed = FileMoveArgsSchema.safeParse({
                filePath: rawFilePath,
                targetFolderPath: rawTargetFolderPath,
            });
            if (!parsed.success) return { success: false, error: 'Invalid arguments' };
            const { filePath, targetFolderPath } = parsed.data;
            try {
                resolveInsideVault(filePath);
                resolveInsideVault(targetFolderPath);
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
        },
    );

    // Move folder
    ipc.handle(
        'folder:move',
        async (
            _event,
            rawFolderPath: unknown,
            rawTargetFolderPath: unknown,
        ): Promise<
            | { success: boolean; error: string; newPath?: undefined }
            | { success: boolean; newPath: string; error?: undefined }
        > => {
            const parsed = FolderMoveArgsSchema.safeParse({
                folderPath: rawFolderPath,
                targetFolderPath: rawTargetFolderPath,
            });
            if (!parsed.success) return { success: false, error: 'Invalid arguments' };
            const { folderPath, targetFolderPath } = parsed.data;
            try {
                resolveInsideVault(folderPath);
                resolveInsideVault(targetFolderPath);
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
        },
    );

    // Bookmarks — persisted in <vault>/.leaf/bookmarks.json
    ipc.handle(
        'bookmarks:load',
        async (): Promise<
            | { success: boolean; bookmarks: string[]; error?: undefined }
            | { success: boolean; error: string; bookmarks?: undefined }
        > => {
            try {
                const root = getVaultRoot();
                const bookmarksPath = path.join(root, '.leaf', 'bookmarks.json');
                try {
                    const raw = await fs.readFile(bookmarksPath, 'utf-8');
                    const parsed: unknown = JSON.parse(raw);
                    if (!Array.isArray(parsed)) return { success: true, bookmarks: [] };
                    // Only return paths that are still inside the vault
                    const valid = parsed.filter(
                        (p): p is string => typeof p === 'string' && p.startsWith(root + path.sep),
                    );
                    return { success: true, bookmarks: valid };
                } catch {
                    return { success: true, bookmarks: [] };
                }
            } catch (error) {
                return { success: false, error: (error as Error).message };
            }
        },
    );

    ipc.handle(
        'bookmarks:save',
        async (
            _event,
            rawBookmarks: unknown,
        ): Promise<{ success: boolean; error: string } | { success: boolean; error?: undefined }> => {
            const parsed = z.array(z.string()).safeParse(rawBookmarks);
            if (!parsed.success) return { success: false, error: 'Invalid bookmarks payload' };
            try {
                const root = getVaultRoot();
                const leafDir = path.join(root, '.leaf');
                await fs.mkdir(leafDir, { recursive: true });
                const bookmarksPath = path.join(leafDir, 'bookmarks.json');
                // Validate every path is inside the vault before persisting
                for (const bookmarkPath of parsed.data) {
                    resolveInsideBoundary(bookmarkPath, root);
                }
                await fs.writeFile(bookmarksPath, JSON.stringify(parsed.data, null, 2), 'utf-8');
                return { success: true };
            } catch (error) {
                return { success: false, error: (error as Error).message };
            }
        },
    );
}

function getVaultRoot(): string {
    if (vaultRoot === null) throw new Error('No vault is open.');
    return vaultRoot;
}

/** Resolve `p` and assert it lives inside the active vault. */
function resolveInsideVault(p: string): string {
    return resolveInsideBoundary(p, getVaultRoot());
}

/** Describe one scanned file, or `null` when its extension is not one Leaf opens. */
async function findScannedFile(fullPath: string, relativePath: string, name: string): Promise<FileInfo | null> {
    const extension = path.extname(name).toLowerCase();
    if (!ALLOWED_EXTENSIONS.has(extension)) return null;
    const stats = await fs.stat(fullPath);
    return {
        name,
        path: fullPath,
        relativePath,
        extension,
        size: stats.size,
        modified: stats.mtime.toISOString(),
        folder: path.dirname(relativePath),
    };
}

async function scanFolder(folderPath: string, basePath = folderPath): Promise<ScanResult> {
    const files: FileInfo[] = [];
    const folders: FolderInfo[] = [];
    try {
        const entries = await fs.readdir(folderPath, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.name === '.leaf') continue; // hide Leaf's internal metadata folder
            const fullPath = path.join(folderPath, entry.name);
            const relativePath = path.relative(basePath, fullPath);
            if (entry.isDirectory()) {
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
                continue;
            }
            if (!entry.isFile()) continue;
            const info = await findScannedFile(fullPath, relativePath, entry.name);
            if (info !== null) files.push(info);
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
