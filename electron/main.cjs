// Electron Main Process - Leaf note-taking app
const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;

let mainWindow = null;

function createWindow() {
    // Set app icon based on platform
    const iconPath = process.platform === 'darwin'
        ? path.join(__dirname, '../build/icon.icns')
        : path.join(__dirname, '../build/icon.icns');

    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        icon: iconPath,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false, // Security: don't expose Node to renderer
            contextIsolation: true,  // Security: isolate contexts
            sandbox: false,
            // Disable all browser-like storage mechanisms
            partition: 'persist:leaf', // Use persistent session
            cache: false // Disable HTTP cache
        },
        backgroundColor: '#1a1a1a',
        titleBarStyle: 'hiddenInset', // macOS style
        show: false // Don't show until ready
    });

    // Load the app
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// Initialize app
app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

// Quit when all windows closed (except macOS)
app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

// Handle errors
process.on('uncaughtException', (error) => {
    console.error('Uncaught exception:', error);
});

// IPC Handlers for file system operations

// Open folder dialog and return the selected path
ipcMain.handle('dialog:openFolder', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory'],
        title: 'Select Your Notes Folder',
        buttonLabel: 'Select Folder'
    });

    if (result.canceled) {
        return null;
    }

    return result.filePaths[0];
});

// Recursively scan a folder for .txt and .md files
async function scanFolder(folderPath, basePath = folderPath) {
    const files = [];
    const folders = [];
    const allowedExtensions = ['.txt', '.md', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'];

    try {
        const entries = await fs.readdir(folderPath, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(folderPath, entry.name);
            const relativePath = path.relative(basePath, fullPath);

            if (entry.isDirectory()) {
                // Add the folder itself
                folders.push({
                    name: entry.name,
                    path: fullPath,
                    relativePath: relativePath,
                    type: 'folder',
                    folder: path.dirname(relativePath)
                });

                // Recursively scan subdirectories
                const subResult = await scanFolder(fullPath, basePath);
                files.push(...subResult.files);
                folders.push(...subResult.folders);
            } else if (entry.isFile()) {
                const ext = path.extname(entry.name).toLowerCase();
                if (allowedExtensions.includes(ext)) {
                    const stats = await fs.stat(fullPath);
                    files.push({
                        name: entry.name,
                        path: fullPath,
                        relativePath: relativePath,
                        extension: ext,
                        size: stats.size,
                        modified: stats.mtime.toISOString(),
                        folder: path.dirname(relativePath)
                    });
                }
            }
        }
    } catch (error) {
        console.error('Error scanning folder:', error);
    }

    return { files, folders };
}

// Get all files from a folder
ipcMain.handle('files:scan', async (event, folderPath) => {
    try {
        const result = await scanFolder(folderPath);
        return { success: true, files: result.files, folders: result.folders };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Read a file's content
ipcMain.handle('file:read', async (event, filePath) => {
    try {
        const content = await fs.readFile(filePath, 'utf-8');
        return { success: true, content };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Read an image file as base64 data URL
ipcMain.handle('file:readImage', async (event, filePath) => {
    try {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.svg': 'image/svg+xml',
            '.bmp': 'image/bmp',
            '.ico': 'image/x-icon'
        };
        const mimeType = mimeTypes[ext] || 'image/png';
        const imageBuffer = await fs.readFile(filePath);
        const base64 = imageBuffer.toString('base64');
        const dataUrl = `data:${mimeType};base64,${base64}`;
        return { success: true, dataUrl };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Write content to a file
ipcMain.handle('file:write', async (event, filePath, content) => {
    try {
        await fs.writeFile(filePath, content, 'utf-8');
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Create a new file
ipcMain.handle('file:create', async (event, folderPath, fileName) => {
    try {
        const filePath = path.join(folderPath, fileName);
        await fs.writeFile(filePath, '', 'utf-8');
        return { success: true, path: filePath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Create a new folder
ipcMain.handle('folder:create', async (event, parentPath, folderName) => {
    try {
        const folderPath = path.join(parentPath, folderName);

        // Check if folder already exists
        try {
            await fs.access(folderPath);
            return { success: false, error: 'A folder with this name already exists' };
        } catch {
            // Folder doesn't exist, proceed with creation
        }

        await fs.mkdir(folderPath, { recursive: true });
        return { success: true, path: folderPath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Delete a file (move to trash)
ipcMain.handle('file:delete', async (event, filePath) => {
    try {
        await shell.trashItem(filePath);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Rename a file
ipcMain.handle('file:rename', async (event, oldPath, newFileName) => {
    try {
        const directory = path.dirname(oldPath);
        const newPath = path.join(directory, newFileName);

        // Check if file with new name already exists
        try {
            await fs.access(newPath);
            return { success: false, error: 'A file with this name already exists' };
        } catch {
            // File doesn't exist, safe to rename
        }

        await fs.rename(oldPath, newPath);
        return { success: true, newPath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Rename a folder
ipcMain.handle('folder:rename', async (event, oldPath, newFolderName) => {
    try {
        const parentDirectory = path.dirname(oldPath);
        const newPath = path.join(parentDirectory, newFolderName);

        // Check if folder with new name already exists
        try {
            await fs.access(newPath);
            return { success: false, error: 'A folder with this name already exists' };
        } catch {
            // Folder doesn't exist, safe to rename
        }

        await fs.rename(oldPath, newPath);
        return { success: true, newPath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Delete a folder (move to trash)
ipcMain.handle('folder:delete', async (event, folderPath) => {
    try {
        await shell.trashItem(folderPath);
        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Move a file to a different folder
ipcMain.handle('file:move', async (event, filePath, targetFolderPath) => {
    try {
        const fileName = path.basename(filePath);
        const newPath = path.join(targetFolderPath, fileName);

        // If source and destination are the same, just return success
        if (filePath === newPath) {
            return { success: true, newPath };
        }

        // Check if file with same name already exists in target folder
        try {
            await fs.access(newPath);
            return { success: false, error: 'A file with this name already exists in the target folder' };
        } catch {
            // File doesn't exist, safe to move
        }

        await fs.rename(filePath, newPath);
        return { success: true, newPath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Move a folder to a different parent folder
ipcMain.handle('folder:move', async (event, folderPath, targetFolderPath) => {
    try {
        const folderName = path.basename(folderPath);
        const newPath = path.join(targetFolderPath, folderName);

        // If source and destination are the same, just return success
        if (folderPath === newPath) {
            return { success: true, newPath };
        }

        // Prevent moving a folder into itself or its own subdirectory
        if (targetFolderPath.startsWith(folderPath + path.sep) || targetFolderPath === folderPath) {
            return { success: false, error: 'Cannot move a folder into itself' };
        }

        // Check if folder with same name already exists in target folder
        try {
            await fs.access(newPath);
            return { success: false, error: 'A folder with this name already exists in the target folder' };
        } catch {
            // Folder doesn't exist, safe to move
        }

        await fs.rename(folderPath, newPath);
        return { success: true, newPath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});
