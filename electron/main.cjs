// Electron Main Process - Leaf note-taking app
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, screen } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { pathToFileURL } = require('url');

let mainWindow = null;
let folderWatcher = null; // fs.watch handle for vault directory

function createWindow() {
    // Set app icon based on platform
    const iconPath = process.platform === 'darwin'
        ? path.join(__dirname, '../build/icon.icns')
        : path.join(__dirname, '../build/icon.icns');

    // Use percentage-based sizing relative to the user's display
    const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
    const winWidth = Math.round(screenWidth * 0.75);   // 75% of screen width
    const winHeight = Math.round(screenHeight * 0.8);   // 80% of screen height
    const minW = Math.round(screenWidth * 0.45);        // 45% of screen width
    const minH = Math.round(screenHeight * 0.5);        // 50% of screen height

    mainWindow = new BrowserWindow({
        width: winWidth,
        height: winHeight,
        minWidth: minW,
        minHeight: minH,
        icon: iconPath,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false, // Security: don't expose Node to renderer
            contextIsolation: true,  // Security: isolate contexts
            sandbox: false,
            webSecurity: false, // Allow loading local files (required for video/media)
            // Disable all browser-like storage mechanisms
            partition: 'persist:leaf', // Use persistent session
            cache: false, // Disable HTTP cache
            spellcheck: true // Enable spellcheck
        },
        backgroundColor: '#1a1a1a',
        titleBarStyle: 'hiddenInset', // macOS style
        show: false // Don't show until ready
    });

    // Enable context menu with spellcheck suggestions
    mainWindow.webContents.on('context-menu', (event, params) => {
        const menu = Menu.buildFromTemplate([
            // Spellcheck suggestions
            ...params.dictionarySuggestions.map(suggestion => ({
                label: suggestion,
                click: () => mainWindow.webContents.replaceMisspelling(suggestion)
            })),
            // Separator if there are suggestions
            ...(params.dictionarySuggestions.length > 0 ? [{ type: 'separator' }] : []),
            // Add to dictionary option
            ...(params.misspelledWord ? [{
                label: 'Add to Dictionary',
                click: () => mainWindow.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord)
            }] : []),
            // Separator before standard options
            ...(params.misspelledWord ? [{ type: 'separator' }] : []),
            // Standard editing options
            { role: 'cut', visible: params.isEditable },
            { role: 'copy', visible: params.selectionText.length > 0 },
            { role: 'paste', visible: params.isEditable },
            { type: 'separator', visible: params.isEditable || params.selectionText.length > 0 },
            { role: 'selectAll' }
        ]);
        menu.popup();
    });

    // Load the app
    if (process.env.NODE_ENV === 'development') {
        mainWindow.loadURL('http://localhost:3000');
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    // Open external links in the OS default browser instead of inside the app
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            shell.openExternal(url);
        }
        return { action: 'deny' };
    });

    mainWindow.webContents.on('will-navigate', (event, url) => {
        // Allow loading the app itself (dev server or local file)
        const appOrigin = process.env.NODE_ENV === 'development'
            ? 'http://localhost:3000'
            : 'file://';
        if (!url.startsWith(appOrigin)) {
            event.preventDefault();
            if (url.startsWith('http://') || url.startsWith('https://')) {
                shell.openExternal(url);
            }
        }
    });

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

// Open external URLs in the OS default browser
ipcMain.handle('shell:openExternal', async (event, url) => {
    // Only allow http/https URLs for security
    if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
        await shell.openExternal(url);
        return true;
    }
    return false;
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

// Recursively scan a folder for text, code, image and video files
async function scanFolder(folderPath, basePath = folderPath) {
    const files = [];
    const folders = [];
    // Text and markdown files
    const textExtensions = ['.txt', '.md'];
    // Code files
    const codeExtensions = [
        '.py', '.js', '.jsx', '.ts', '.tsx', '.html', '.htm', '.css', '.scss', '.sass', '.less',
        '.vue', '.svelte', '.json', '.xml', '.yaml', '.yml', '.toml', '.ini', '.conf', '.cfg',
        '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
        '.c', '.cpp', '.h', '.hpp', '.cs', '.java', '.kt', '.kts', '.go', '.rs', '.rb', '.php',
        '.swift', '.m', '.mm', '.r', '.R', '.pl', '.pm', '.lua', '.sql', '.graphql', '.gql',
        '.dockerfile', '.env', '.gitignore', '.gitattributes', '.editorconfig', '.eslintrc',
        '.prettierrc', '.babelrc', '.npmrc', '.nvmrc', '.cjs'
    ];
    // Image files
    const imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'];
    // Video files
    const videoExtensions = ['.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv'];
    // Audio files
    const audioExtensions = ['.mp3', '.wav', '.flac', '.aac', '.m4a', '.ogg', '.wma', '.aiff'];
    // PDF files
    const pdfExtensions = ['.pdf'];
    // Drawing files
    const drawingExtensions = ['.drawing'];
    const allowedExtensions = [...textExtensions, ...codeExtensions, ...imageExtensions, ...videoExtensions, ...audioExtensions, ...pdfExtensions, ...drawingExtensions];

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

// Watch a folder for external file system changes
ipcMain.handle('fs:watchFolder', async (event, folderPath) => {
    try {
        // Close any existing watcher
        if (folderWatcher) {
            folderWatcher.close();
            folderWatcher = null;
        }

        // Use recursive fs.watch (supported on macOS and Windows)
        folderWatcher = fsSync.watch(folderPath, { recursive: true }, (eventType, filename) => {
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('fs:changed', { eventType, filename });
            }
        });

        folderWatcher.on('error', (err) => {
            console.error('Folder watcher error:', err);
        });

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Stop watching the folder
ipcMain.handle('fs:unwatchFolder', async () => {
    if (folderWatcher) {
        folderWatcher.close();
        folderWatcher = null;
    }
    return { success: true };
});

// Copy an external file into the vault (for drag-and-drop embed)
ipcMain.handle('file:copyToVault', async (event, sourcePath, targetDir) => {
    try {
        // Ensure target directory exists
        await fs.mkdir(targetDir, { recursive: true });

        let baseName = path.basename(sourcePath);
        let targetPath = path.join(targetDir, baseName);

        // Avoid overwriting: append (1), (2), etc. if file exists
        let counter = 1;
        const ext = path.extname(baseName);
        const nameWithoutExt = baseName.slice(0, baseName.length - ext.length);
        while (true) {
            try {
                await fs.access(targetPath);
                // File exists, try next name
                targetPath = path.join(targetDir, `${nameWithoutExt} (${counter})${ext}`);
                baseName = `${nameWithoutExt} (${counter})${ext}`;
                counter++;
            } catch {
                // File doesn't exist, we can use this name
                break;
            }
        }

        await fs.copyFile(sourcePath, targetPath);
        return { success: true, fileName: baseName, path: targetPath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Resolve an embed file path (Obsidian-style ![[file]] search)
ipcMain.handle('file:resolveEmbedPath', async (event, fileName, noteDir, vaultRoot) => {
    try {
        // 1. Try exact relative path from the current note's directory
        const relToNote = path.resolve(noteDir, fileName);
        try {
            await fs.access(relToNote);
            return { success: true, path: relToNote };
        } catch { }

        // 2. Try relative to vault root
        const relToVault = path.resolve(vaultRoot, fileName);
        try {
            await fs.access(relToVault);
            return { success: true, path: relToVault };
        } catch { }

        // 3. Recursive search by filename in the entire vault
        const targetName = path.basename(fileName);
        async function findFileRecursive(dir) {
            let entries;
            try {
                entries = await fs.readdir(dir, { withFileTypes: true });
            } catch {
                return null;
            }
            for (const entry of entries) {
                if (entry.name.startsWith('.')) continue;
                const fullPath = path.join(dir, entry.name);
                if (entry.isFile() && entry.name === targetName) {
                    return fullPath;
                }
                if (entry.isDirectory()) {
                    const found = await findFileRecursive(fullPath);
                    if (found) return found;
                }
            }
            return null;
        }

        const found = await findFileRecursive(vaultRoot);
        if (found) {
            return { success: true, path: found };
        }

        return { success: false, error: 'File not found' };
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

// Read an audio file as base64 data URL
ipcMain.handle('file:readAudio', async (event, filePath) => {
    try {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.mp3': 'audio/mpeg',
            '.wav': 'audio/wav',
            '.flac': 'audio/flac',
            '.aac': 'audio/aac',
            '.m4a': 'audio/mp4',
            '.ogg': 'audio/ogg',
            '.wma': 'audio/x-ms-wma',
            '.aiff': 'audio/aiff'
        };
        const mimeType = mimeTypes[ext] || 'audio/mpeg';
        const audioBuffer = await fs.readFile(filePath);
        const base64 = audioBuffer.toString('base64');
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

// Get spelling suggestions for a word
ipcMain.handle('spellcheck:getSuggestions', async (event, word) => {
    try {
        const suggestions = event.sender.session.availableSpellCheckerLanguages;
        // Use Chromium's spell checker to get suggestions
        // Note: Electron doesn't expose direct API for suggestions, so we return empty array
        // The context menu will be handled by Chromium's native spellcheck
        return { success: true, suggestions: [] };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// Save audio recording as WAV file
ipcMain.handle('audio:saveRecording', async (event, folderPath, fileName, base64Data) => {
    try {
        const filePath = path.join(folderPath, fileName);

        // Convert base64 to buffer
        const audioBuffer = Buffer.from(base64Data, 'base64');

        // Write the file
        await fs.writeFile(filePath, audioBuffer);

        return { success: true, path: filePath };
    } catch (error) {
        return { success: false, error: error.message };
    }
});

// ============================
// AI / LLM IPC Handlers
// ============================
const aiService = require('./ai-service.cjs');
const conversationService = require('./conversation-service.cjs');
const agentService = require('./agent-service.cjs');
const hfDownloadService = require('./hf-download-service.cjs');
const speechService = require('./speech-service.cjs');

// Initialize conversation storage in app's userData directory
conversationService.init(app.getPath('userData'));

// List available models in ~/leaf-models/
ipcMain.handle('ai:listModels', async () => {
    return await aiService.listModels();
});

// Load a model by file path
ipcMain.handle('ai:loadModel', async (event, modelPath) => {
    return await aiService.loadModel(modelPath);
});

// Unload the current model
ipcMain.handle('ai:unloadModel', async () => {
    return await aiService.unloadModel();
});

// Send a chat message with streaming tokens
ipcMain.handle('ai:chat', async (event, userMessage, noteContext) => {
    return await aiService.chat(
        userMessage,
        (token) => {
            // Stream each token to the renderer process
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('ai:token', token);
            }
        },
        noteContext
    );
});

// Reset chat session (clear history)
ipcMain.handle('ai:resetChat', async () => {
    return await aiService.resetChat();
});

// Restore chat history into the current LLM session
ipcMain.handle('ai:restoreChatHistory', async (event, messages) => {
    return await aiService.restoreChatHistory(messages);
});

// Stop the current generation
ipcMain.handle('ai:stopChat', async () => {
    return aiService.stopChat();
});

// Get AI service status
ipcMain.handle('ai:getStatus', async () => {
    return aiService.getStatus();
});

// Open the models directory in Finder/Explorer
ipcMain.handle('ai:openModelsDir', async () => {
    return await aiService.openModelsDir();
});

// ============================
// Conversation Persistence IPC Handlers
// ============================

// List all conversations (metadata only)
ipcMain.handle('conversations:list', async () => {
    return await conversationService.listConversations();
});

// Create a new conversation
ipcMain.handle('conversations:create', async (event, modelName) => {
    return await conversationService.createConversation(modelName);
});

// Load a full conversation by ID
ipcMain.handle('conversations:load', async (event, id) => {
    return await conversationService.loadConversation(id);
});

// Save a full conversation object
ipcMain.handle('conversations:save', async (event, conversation) => {
    return await conversationService.saveConversation(conversation);
});

// Add a message to a conversation
ipcMain.handle('conversations:addMessage', async (event, conversationId, message) => {
    return await conversationService.addMessage(conversationId, message);
});

// Update the last message (for streaming completion)
ipcMain.handle('conversations:updateLastMessage', async (event, conversationId, content) => {
    return await conversationService.updateLastMessage(conversationId, content);
});

// Delete a conversation
ipcMain.handle('conversations:delete', async (event, id) => {
    return await conversationService.deleteConversation(id);
});

// Rename a conversation
ipcMain.handle('conversations:rename', async (event, id, newTitle) => {
    return await conversationService.renameConversation(id, newTitle);
});

// ============================
// Agent Mode IPC Handlers
// ============================

// Read a file for the agent (scoped to workspace)
ipcMain.handle('agent:readFile', async (event, filePath, workspacePath) => {
    return await agentService.readFileForAgent(filePath, workspacePath);
});

// Propose an edit (backup + write)
ipcMain.handle('agent:proposeEdit', async (event, filePath, newContent, workspacePath) => {
    return await agentService.proposeEdit(filePath, newContent, workspacePath);
});

// Approve a pending edit
ipcMain.handle('agent:approveEdit', async (event, editId) => {
    return await agentService.approveEdit(editId);
});

// Reject a pending edit (restore from backup)
ipcMain.handle('agent:rejectEdit', async (event, editId) => {
    return await agentService.rejectEdit(editId);
});

// Get all pending edits
ipcMain.handle('agent:getPendingEdits', async () => {
    return agentService.getPendingEdits();
});

// ============================
// Hugging Face Download IPC Handlers
// ============================

// Search for GGUF models on Hugging Face
ipcMain.handle('hf:search', async (event, query) => {
    return await hfDownloadService.searchModels(query);
});

// List GGUF files in a HF repo
ipcMain.handle('hf:listFiles', async (event, repoId) => {
    return await hfDownloadService.listRepoFiles(repoId);
});

// Download a model file
ipcMain.handle('hf:download', async (event, url, fileName) => {
    return await hfDownloadService.downloadModel(url, fileName, (progress) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('hf:downloadProgress', progress);
        }
    });
});

// Cancel a download
ipcMain.handle('hf:cancelDownload', async (event, fileName) => {
    return await hfDownloadService.cancelDownload(fileName);
});

// Get active downloads
ipcMain.handle('hf:getActiveDownloads', async () => {
    return { success: true, downloads: hfDownloadService.getActiveDownloads() };
});

// ============================
// Speech-to-Text (Whisper) IPC Handlers
// ============================

// Initialize the Whisper model (downloads on first use, then local)
ipcMain.handle('speech:init', async () => {
    return await speechService.initModel(mainWindow);
});

// Transcribe an audio chunk (Float32 PCM at 16kHz mono)
ipcMain.handle('speech:transcribe', async (event, audioData) => {
    return await speechService.transcribe(audioData);
});

// Get speech service status
ipcMain.handle('speech:getStatus', async () => {
    return speechService.getStatus();
});
