// Electron Main Process — Leaf note-taking app
// Responsibilities:
//   1. Create and manage the BrowserWindow
//   2. Register a custom local-file protocol (leaf://) so the renderer can
//      load images/audio/video without disabling webSecurity
//   3. Grant microphone permission for audio recording
//   4. Register IPC handlers by delegating to each service module
//
// IPC handler ownership:
//   fs-service           → file:*, folder:*, files:scan, fs:*, dialog:openFolder, file:resolveEmbedPath, file:copyToVault
//   media-service        → audio:saveRecording, spellcheck:getSuggestions
//   ai-service           → ai:*
//   conversation-service → conversations:*
//   agent-service        → agent:*
//   hf-download-service  → hf:*
//   speech-service       → speech:*

import { app, BrowserWindow, ipcMain, shell, Menu, screen, protocol, net, session, clipboard } from 'electron';
import path from 'path';
import { pathToFileURL } from 'url';

// ─── Service modules ─────────────────────────────────────────────────────────
import * as fsService from './services/fs';
import * as mediaService from './services/media';
import * as aiService from './services/ai';
import * as conversationService from './services/conversation';
import * as agentService from './services/agent';
import * as hfDownloadService from './services/hf-download';
import * as speechService from './services/speech';

// ─── Scheme privileges ───────────────────────────────────────────────────────
// Must be called before app.whenReady(). Tells Chromium the leaf:// scheme
// supports streaming (needed for video/audio playback with range requests),
// is secure (needed for iframe PDF viewing), and supports fetch.
protocol.registerSchemesAsPrivileged([{
    scheme: 'leaf',
    privileges: {
        standard: true,
        secure: true,
        supportFetchAPI: true,
        stream: true,
        bypassCSP: true,
    },
}]);

// ─── Window ──────────────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;

function getMainWindow(): BrowserWindow | null { return mainWindow; }

function createWindow(): void {
    // After electron-vite bundles to out/main/index.js, __dirname = out/main/
    const iconPath = path.join(__dirname, '../../build/icon.icns');

    const { width: sw, height: sh } = screen.getPrimaryDisplay().workAreaSize;

    mainWindow = new BrowserWindow({
        width: Math.round(sw * 0.75),
        height: Math.round(sh * 0.80),
        minWidth: Math.round(sw * 0.45),
        minHeight: Math.round(sh * 0.50),
        icon: iconPath,
        webPreferences: {
            // out/main/__dirname → ../../ → root → out/preload/index.mjs
            preload: path.join(__dirname, '../preload/index.mjs'),
            nodeIntegration: false,   // never expose Node to the renderer
            contextIsolation: true,    // keep renderer and preload worlds isolated
            sandbox: false,            // required for preload to use require()
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
    mainWindow.webContents.on('context-menu', (_event, params) => {
        const menu = Menu.buildFromTemplate([
            ...params.dictionarySuggestions.map(s => ({
                label: s,
                click: () => mainWindow!.webContents.replaceMisspelling(s),
            })),
            ...(params.dictionarySuggestions.length > 0 ? [{ type: 'separator' as const }] : []),
            ...(params.misspelledWord ? [
                { label: 'Add to Dictionary', click: () => mainWindow!.webContents.session.addWordToSpellCheckerDictionary(params.misspelledWord) },
                { type: 'separator' as const },
            ] : []),
            { role: 'cut' as const, visible: params.isEditable },
            { role: 'copy' as const, visible: params.selectionText.length > 0 },
            { role: 'paste' as const, visible: params.isEditable },
            { type: 'separator' as const, visible: params.isEditable || params.selectionText.length > 0 },
            { role: 'selectAll' as const },
        ]);
        menu.popup();
    });

    // Load the app
    // electron-vite sets ELECTRON_RENDERER_URL in dev mode
    if (process.env['ELECTRON_RENDERER_URL']) {
        mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
        mainWindow.webContents.openDevTools();
    } else {
        mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    }

    // Keep external links out of the app window
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (url.startsWith('http://') || url.startsWith('https://')) shell.openExternal(url);
        return { action: 'deny' };
    });

    mainWindow.webContents.on('will-navigate', (event, url) => {
        const isDevServer = !!process.env['ELECTRON_RENDERER_URL'];
        const appOrigin = isDevServer ? process.env['ELECTRON_RENDERER_URL']! : 'file://';
        if (!url.startsWith(appOrigin) && !url.startsWith('leaf://')) {
            event.preventDefault();
            if (url.startsWith('http://') || url.startsWith('https://')) shell.openExternal(url);
        }
    });

    mainWindow.once('ready-to-show', () => mainWindow!.show());
    mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── Custom protocol: leaf:// ─────────────────────────────────────────────────
// Serves local files (images, audio, video) to the renderer process with
// correct MIME types, replacing the need for webSecurity:false.
// Usage from renderer: <img src="leaf://localhost/absolute/path/to/file.png">

function registerLeafProtocol(ses: Electron.Session): void {
    ses.protocol.handle('leaf', (request) => {
        // leaf://localhost/path/to/file  →  /path/to/file
        const filePath = decodeURIComponent(new URL(request.url).pathname);
        // Forward the original request headers (including Range for video seeking)
        // to net.fetch so that streaming/range responses work correctly.
        return net.fetch(pathToFileURL(filePath).toString(), {
            method: request.method,
            headers: request.headers,
        });
    });
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
    const leafSession = session.fromPartition('persist:leaf');

    registerLeafProtocol(leafSession);
    createWindow();

    // Grant microphone access for audio recording.
    // In production (file:// origin) Electron denies all permission requests
    // by default, so we need an explicit handler.
    // Must target the partition session used by the BrowserWindow.
    leafSession.setPermissionRequestHandler((_webContents, permission, callback) => {
        // 'media' covers microphone and camera access in Electron
        callback(permission === 'media');
    });
    leafSession.setPermissionCheckHandler((_webContents, permission) => {
        return permission === 'media';
    });

    // ── Register IPC handlers ────────────────────────────────────────────────
    conversationService.init(app.getPath('userData'));

    fsService.register(ipcMain, getMainWindow);
    mediaService.register(ipcMain, fsService.getVaultRoot);
    aiService.register(ipcMain, getMainWindow);
    conversationService.register(ipcMain);
    agentService.register(ipcMain);
    hfDownloadService.register(ipcMain, getMainWindow);
    speechService.register(ipcMain, getMainWindow);

    // Clipboard
    ipcMain.handle('clipboard:write', (_event, text: string) => {
        if (typeof text === 'string') clipboard.writeText(text);
    });

    // Shell — open external URLs safely (http/https only)
    ipcMain.handle('shell:openExternal', async (_event, url: string) => {
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

// ─── Graceful shutdown ────────────────────────────────────────────────────────
// Clean up resources held by services before the process exits.
app.on('before-quit', async () => {
    fsService.cleanup();
    await agentService.cleanupAllPendingEdits();
    await aiService.cleanup();
    await speechService.cleanup();
});

process.on('uncaughtException', (error) => {
    console.error('[main] Uncaught exception:', error);
});
