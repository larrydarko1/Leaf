// Electron Main Process — Leaf note-taking app
// Responsibilities:
//   1. Create and manage the BrowserWindow
//   2. Register a custom local-file protocol (leaf://) so the renderer can
//      load images/audio/video without disabling webSecurity
//   3. Grant microphone permission for audio recording
//   4. Register IPC handlers by delegating to each service module
//
// IPC handler ownership:
//   fs-service      → file:*, folder:*, files:scan, fs:*, dialog:openFolder, file:resolveEmbedPath, file:copyToVault
//   media-service   → audio:saveRecording, spellcheck:getSuggestions
//   ai-service      → ai:*
//   conversation-service → conversations:*
//   agent-service   → agent:*
//   hf-download-service  → hf:*
//   speech-service  → speech:*

'use strict';

const { app, BrowserWindow, ipcMain, shell, Menu, screen, protocol, net } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

// ─── Service modules ─────────────────────────────────────────────────────────
const fsService = require('./services/fs.cjs');
const mediaService = require('./services/media.cjs');
const aiService = require('./services/ai.cjs');
const conversationService = require('./services/conversation.cjs');
const agentService = require('./services/agent.cjs');
const hfDownloadService = require('./services/hf-download.cjs');
const speechService = require('./services/speech.cjs');

// ─── Window ──────────────────────────────────────────────────────────────────

let mainWindow = null;

/** @returns {Electron.BrowserWindow | null} */
function getMainWindow() { return mainWindow; }

function createWindow() {
    const iconPath = path.join(__dirname, '../build/icon.icns');

    const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;

    mainWindow = new BrowserWindow({
        width: Math.round(sw * 0.75),
        height: Math.round(sh * 0.80),
        minWidth: Math.round(sw * 0.45),
        minHeight: Math.round(sh * 0.50),
        icon: iconPath,
        webPreferences: {
            preload: path.join(__dirname, 'preload.cjs'),
            nodeIntegration: false,   // never expose Node to the renderer
            contextIsolation: true,    // keep renderer and preload worlds isolated
            sandbox: false,   // required for preload to use require()
            // webSecurity stays at its default (true).
            // Local files (images, audio, video) are served through the
            // leaf:// custom protocol registered below — no need to disable
            // webSecurity for that.
            partition: 'persist:leaf',
            spellcheck: true,
        },
        backgroundColor: '#1a1a1a',
        titleBarStyle: 'hiddenInset',
        show: false,
    });

    // Context menu: spellcheck suggestions + standard editing actions
    mainWindow.webContents.on('context-menu', (event, params) => {
        const menu = Menu.buildFromTemplate([
            ...params.dictionarySuggestions.map(s => ({
                label: s,
                click: () => mainWindow.webContents.replaceMisspelling(s),
            })),
            ...(params.dictionarySuggestions.length > 0 ? [{ type: 'separator' }] : []),
            ...(params.misspelledWord ? [
                { label: 'Add to Dictionary', click: () => mainWindow.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord) },
                { type: 'separator' },
            ] : []),
            { role: 'cut', visible: params.isEditable },
            { role: 'copy', visible: params.selectionText.length > 0 },
            { role: 'paste', visible: params.isEditable },
            { type: 'separator', visible: params.isEditable || params.selectionText.length > 0 },
            { role: 'selectAll' },
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

    // Keep external links out of the app window
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http://') || url.startsWith('https://')) shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.webContents.on('will-navigate', (event, url) => {
        const appOrigin = process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : 'file://';
        if (!url.startsWith(appOrigin)) {
            event.preventDefault();
            if (url.startsWith('http://') || url.startsWith('https://')) shell.openExternal(url);
        }
    });

    mainWindow.once('ready-to-show', () => mainWindow.show());
    mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── Custom protocol: leaf:// ─────────────────────────────────────────────────
// Serves local files (images, audio, video) to the renderer process with
// correct MIME types, replacing the need for webSecurity:false.
// Usage from renderer: <img src="leaf:///absolute/path/to/file.png">

const { MIME_MAP } = require('./lib/mime.cjs');

function registerLeafProtocol() {
    protocol.handle('leaf', (request) => {
        // leaf:///path/to/file  →  /path/to/file
        const filePath = decodeURIComponent(new URL(request.url).pathname);
        const ext = path.extname(filePath).toLowerCase();
        const mimeType = MIME_MAP[ext] ?? 'application/octet-stream';
        return net.fetch(pathToFileURL(filePath).toString(), {
            headers: { 'Content-Type': mimeType },
        });
    });
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
    registerLeafProtocol();
    createWindow();

    // Grant microphone access for audio recording.
    // In production (file:// origin) Electron denies all permission requests
    // by default, so we need an explicit handler.
    const { session } = require('electron');
    session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
        const allowed = permission === 'media' || permission === 'microphone' || permission === 'audioCapture';
        callback(allowed);
    });
    session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
        if (permission === 'media' || permission === 'microphone' || permission === 'audioCapture') return true;
        return null;
    });

    // ── Register IPC handlers ────────────────────────────────────────────────
    conversationService.init(app.getPath('userData'));

    fsService.register(ipcMain, getMainWindow);
    mediaService.register(ipcMain);
    aiService.register(ipcMain, getMainWindow);
    conversationService.register(ipcMain);
    agentService.register(ipcMain);
    hfDownloadService.register(ipcMain, getMainWindow);
    speechService.register(ipcMain, getMainWindow);

    // Shell — open external URLs safely (http/https only)
    ipcMain.handle('shell:openExternal', async (event, url) => {
        if (typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'))) {
            await shell.openExternal(url);
            return true;
        }
        return false;
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

process.on('uncaughtException', (error) => {
    console.error('[main] Uncaught exception:', error);
});
