// File System Service
// Owns all vault-level file/folder IPC handlers.
// Pattern: export a register(ipcMain, getMainWindow) function that wires up
// its own handlers, keeping main.cjs focused on app bootstrap only.

const { ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');

let folderWatcher = null;

// ─── Helpers ────────────────────────────────────────────────────────────────

const TEXT_EXTENSIONS = ['.txt', '.md'];
const CODE_EXTENSIONS = [
    '.py', '.js', '.jsx', '.ts', '.tsx', '.html', '.htm', '.css', '.scss', '.sass', '.less',
    '.vue', '.svelte', '.json', '.xml', '.yaml', '.yml', '.toml', '.ini', '.conf', '.cfg',
    '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
    '.c', '.cpp', '.h', '.hpp', '.cs', '.java', '.kt', '.kts', '.go', '.rs', '.rb', '.php',
    '.swift', '.m', '.mm', '.r', '.R', '.pl', '.pm', '.lua', '.sql', '.graphql', '.gql',
    '.dockerfile', '.env', '.gitignore', '.gitattributes', '.editorconfig', '.eslintrc',
    '.prettierrc', '.babelrc', '.npmrc', '.nvmrc', '.cjs',
];
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'];
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.wma', '.aiff'];
const PDF_EXTENSIONS = ['.pdf'];
const DRAWING_EXTENSIONS = ['.drawing'];

const ALLOWED_EXTENSIONS = new Set([
    ...TEXT_EXTENSIONS, ...CODE_EXTENSIONS, ...IMAGE_EXTENSIONS,
    ...VIDEO_EXTENSIONS, ...AUDIO_EXTENSIONS, ...PDF_EXTENSIONS, ...DRAWING_EXTENSIONS,
]);

const IMAGE_MIMETYPES = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
    '.bmp': 'image/bmp', '.ico': 'image/x-icon',
};
const AUDIO_MIMETYPES = {
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.flac': 'audio/flac',
    '.aac': 'audio/aac', '.m4a': 'audio/mp4', '.ogg': 'audio/ogg',
    '.wma': 'audio/x-ms-wma', '.aiff': 'audio/aiff',
};

async function scanFolder(folderPath, basePath = folderPath) {
    const files = [];
    const folders = [];
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

async function findFileRecursive(dir, targetName) {
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

// ─── register ────────────────────────────────────────────────────────────────

/**
 * Wire up all file-system IPC handlers.
 * @param {Electron.IpcMain} ipc
 * @param {() => Electron.BrowserWindow | null} getMainWindow
 * @param {() => Electron.BrowserWindow | null} getMainWindowForDialog - same ref, passed to dialog
 */
function register(ipc, getMainWindow) {

    // Open folder dialog
    ipc.handle('dialog:openFolder', async () => {
        const win = getMainWindow();
        const result = await dialog.showOpenDialog(win, {
            properties: ['openDirectory'],
            title: 'Select Your Notes Folder',
            buttonLabel: 'Select Folder',
        });
        return result.canceled ? null : result.filePaths[0];
    });

    // Scan vault
    ipc.handle('files:scan', async (event, folderPath) => {
        if (typeof folderPath !== 'string') return { success: false, error: 'Invalid path' };
        try {
            const result = await scanFolder(folderPath);
            return { success: true, files: result.files, folders: result.folders };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Watch vault for external changes
    ipc.handle('fs:watchFolder', async (event, folderPath) => {
        if (typeof folderPath !== 'string') return { success: false, error: 'Invalid path' };
        try {
            if (folderWatcher) { folderWatcher.close(); folderWatcher = null; }
            folderWatcher = fsSync.watch(folderPath, { recursive: true }, (eventType, filename) => {
                const win = getMainWindow();
                if (win && !win.isDestroyed()) win.webContents.send('fs:changed', { eventType, filename });
            });
            folderWatcher.on('error', (err) => console.error('[fs-service] Watcher error:', err));
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipc.handle('fs:unwatchFolder', async () => {
        if (folderWatcher) { folderWatcher.close(); folderWatcher = null; }
        return { success: true };
    });

    // Resolve ![[embed]] path
    ipc.handle('file:resolveEmbedPath', async (event, fileName, noteDir, vaultRoot) => {
        if (typeof fileName !== 'string' || typeof noteDir !== 'string' || typeof vaultRoot !== 'string') {
            return { success: false, error: 'Invalid arguments' };
        }
        try {
            const relToNote = path.resolve(noteDir, fileName);
            try { await fs.access(relToNote); return { success: true, path: relToNote }; } catch { }
            const relToVault = path.resolve(vaultRoot, fileName);
            try { await fs.access(relToVault); return { success: true, path: relToVault }; } catch { }
            const found = await findFileRecursive(vaultRoot, path.basename(fileName));
            if (found) return { success: true, path: found };
            return { success: false, error: 'File not found' };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Copy external file into vault
    ipc.handle('file:copyToVault', async (event, sourcePath, targetDir) => {
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
            return { success: false, error: error.message };
        }
    });

    // Read text file
    ipc.handle('file:read', async (event, filePath) => {
        if (typeof filePath !== 'string') return { success: false, error: 'Invalid path' };
        try {
            const content = await fs.readFile(filePath, 'utf-8');
            return { success: true, content };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Read image as base64 data URL
    ipc.handle('file:readImage', async (event, filePath) => {
        if (typeof filePath !== 'string') return { success: false, error: 'Invalid path' };
        try {
            const ext = path.extname(filePath).toLowerCase();
            const mimeType = IMAGE_MIMETYPES[ext] ?? 'image/png';
            const buf = await fs.readFile(filePath);
            return { success: true, dataUrl: `data:${mimeType};base64,${buf.toString('base64')}` };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Read audio as base64 data URL
    ipc.handle('file:readAudio', async (event, filePath) => {
        if (typeof filePath !== 'string') return { success: false, error: 'Invalid path' };
        try {
            const ext = path.extname(filePath).toLowerCase();
            const mimeType = AUDIO_MIMETYPES[ext] ?? 'audio/mpeg';
            const buf = await fs.readFile(filePath);
            return { success: true, dataUrl: `data:${mimeType};base64,${buf.toString('base64')}` };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Write text file
    ipc.handle('file:write', async (event, filePath, content) => {
        if (typeof filePath !== 'string' || typeof content !== 'string') return { success: false, error: 'Invalid arguments' };
        try {
            await fs.writeFile(filePath, content, 'utf-8');
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Create file
    ipc.handle('file:create', async (event, folderPath, fileName) => {
        if (typeof folderPath !== 'string' || typeof fileName !== 'string') return { success: false, error: 'Invalid arguments' };
        try {
            const filePath = path.join(folderPath, fileName);
            await fs.writeFile(filePath, '', 'utf-8');
            return { success: true, path: filePath };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Create folder
    ipc.handle('folder:create', async (event, parentPath, folderName) => {
        if (typeof parentPath !== 'string' || typeof folderName !== 'string') return { success: false, error: 'Invalid arguments' };
        try {
            const folderPath = path.join(parentPath, folderName);
            try { await fs.access(folderPath); return { success: false, error: 'A folder with this name already exists' }; } catch { }
            await fs.mkdir(folderPath, { recursive: true });
            return { success: true, path: folderPath };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Delete file → trash
    ipc.handle('file:delete', async (event, filePath) => {
        if (typeof filePath !== 'string') return { success: false, error: 'Invalid path' };
        try {
            await shell.trashItem(filePath);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Rename file
    ipc.handle('file:rename', async (event, oldPath, newFileName) => {
        if (typeof oldPath !== 'string' || typeof newFileName !== 'string') return { success: false, error: 'Invalid arguments' };
        try {
            const newPath = path.join(path.dirname(oldPath), newFileName);
            try { await fs.access(newPath); return { success: false, error: 'A file with this name already exists' }; } catch { }
            await fs.rename(oldPath, newPath);
            return { success: true, newPath };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Rename folder
    ipc.handle('folder:rename', async (event, oldPath, newFolderName) => {
        if (typeof oldPath !== 'string' || typeof newFolderName !== 'string') return { success: false, error: 'Invalid arguments' };
        try {
            const newPath = path.join(path.dirname(oldPath), newFolderName);
            try { await fs.access(newPath); return { success: false, error: 'A folder with this name already exists' }; } catch { }
            await fs.rename(oldPath, newPath);
            return { success: true, newPath };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Delete folder → trash
    ipc.handle('folder:delete', async (event, folderPath) => {
        if (typeof folderPath !== 'string') return { success: false, error: 'Invalid path' };
        try {
            await shell.trashItem(folderPath);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Move file
    ipc.handle('file:move', async (event, filePath, targetFolderPath) => {
        if (typeof filePath !== 'string' || typeof targetFolderPath !== 'string') return { success: false, error: 'Invalid arguments' };
        try {
            const newPath = path.join(targetFolderPath, path.basename(filePath));
            if (filePath === newPath) return { success: true, newPath };
            try { await fs.access(newPath); return { success: false, error: 'A file with this name already exists in the target folder' }; } catch { }
            await fs.rename(filePath, newPath);
            return { success: true, newPath };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Move folder
    ipc.handle('folder:move', async (event, folderPath, targetFolderPath) => {
        if (typeof folderPath !== 'string' || typeof targetFolderPath !== 'string') return { success: false, error: 'Invalid arguments' };
        try {
            const newPath = path.join(targetFolderPath, path.basename(folderPath));
            if (folderPath === newPath) return { success: true, newPath };
            if (targetFolderPath.startsWith(folderPath + path.sep) || targetFolderPath === folderPath) {
                return { success: false, error: 'Cannot move a folder into itself' };
            }
            try { await fs.access(newPath); return { success: false, error: 'A folder with this name already exists in the target folder' }; } catch { }
            await fs.rename(folderPath, newPath);
            return { success: true, newPath };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
}

module.exports = { register };
