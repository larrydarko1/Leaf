// Preload script - Bridge between frontend (Vue) and backend (Node.js)
// This exposes safe APIs to the renderer process via contextBridge.

import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: () => true,

    // Open external URLs in the OS default browser
    openExternal: (url: string) => ipcRenderer.invoke('shell:openExternal', url),

    // Dialog operations
    openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),
    showSaveDialog: (options: { defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) =>
        ipcRenderer.invoke('dialog:showSaveDialog', options),

    // Binary file write
    writeBuffer: (filePath: string, base64Data: string) => ipcRenderer.invoke('file:writeBuffer', filePath, base64Data),

    // File system operations
    scanFolder: (folderPath: string) => ipcRenderer.invoke('files:scan', folderPath),
    readFile: (filePath: string) => ipcRenderer.invoke('file:read', filePath),
    resolveEmbedPath: (fileName: string, noteDir: string, vaultRoot: string) =>
        ipcRenderer.invoke('file:resolveEmbedPath', fileName, noteDir, vaultRoot),
    copyFileToVault: (sourcePath: string, targetDir: string) =>
        ipcRenderer.invoke('file:copyToVault', sourcePath, targetDir),
    readImage: (filePath: string) => ipcRenderer.invoke('file:readImage', filePath),
    readAudio: (filePath: string) => ipcRenderer.invoke('file:readAudio', filePath),
    writeFile: (filePath: string, content: string) => ipcRenderer.invoke('file:write', filePath, content),
    createFile: (folderPath: string, fileName: string) => ipcRenderer.invoke('file:create', folderPath, fileName),
    createFolder: (parentPath: string, folderName: string) =>
        ipcRenderer.invoke('folder:create', parentPath, folderName),
    deleteFile: (filePath: string) => ipcRenderer.invoke('file:delete', filePath),
    renameFile: (filePath: string, newFileName: string) => ipcRenderer.invoke('file:rename', filePath, newFileName),
    updateEmbedRefs: (oldFileName: string, newFileName: string) =>
        ipcRenderer.invoke('file:updateEmbedRefs', oldFileName, newFileName),
    renameFolder: (folderPath: string, newFolderName: string) =>
        ipcRenderer.invoke('folder:rename', folderPath, newFolderName),
    deleteFolder: (folderPath: string) => ipcRenderer.invoke('folder:delete', folderPath),
    moveFile: (filePath: string, targetFolderPath: string) =>
        ipcRenderer.invoke('file:move', filePath, targetFolderPath),
    moveFolder: (folderPath: string, targetFolderPath: string) =>
        ipcRenderer.invoke('folder:move', folderPath, targetFolderPath),

    // Audio recording
    saveAudioRecording: (folderPath: string, fileName: string, base64Data: string) =>
        ipcRenderer.invoke('audio:saveRecording', folderPath, fileName, base64Data),

    // Spellcheck
    getSpellingSuggestions: (word: string) => ipcRenderer.invoke('spellcheck:getSuggestions', word),

    // AI / LLM operations
    aiListModels: () => ipcRenderer.invoke('ai:listModels'),
    aiLoadModel: (modelPath: string) => ipcRenderer.invoke('ai:loadModel', modelPath),
    aiUnloadModel: () => ipcRenderer.invoke('ai:unloadModel'),
    aiChat: (userMessage: string, noteContext: string) => ipcRenderer.invoke('ai:chat', userMessage, noteContext),
    aiStopChat: () => ipcRenderer.invoke('ai:stopChat'),
    aiResetChat: () => ipcRenderer.invoke('ai:resetChat'),
    aiRestoreChatHistory: (messages: object[]) => ipcRenderer.invoke('ai:restoreChatHistory', messages),
    aiGetStatus: () => ipcRenderer.invoke('ai:getStatus'),
    aiOpenModelsDir: () => ipcRenderer.invoke('ai:openModelsDir'),

    // AI streaming token listener
    onAiToken: (callback: (token: string) => void) => {
        ipcRenderer.on('ai:token', (_event, token: string) => callback(token));
    },
    removeAiTokenListener: () => {
        ipcRenderer.removeAllListeners('ai:token');
    },

    // Conversation persistence
    conversationList: () => ipcRenderer.invoke('conversations:list'),
    conversationCreate: (modelName: string) => ipcRenderer.invoke('conversations:create', modelName),
    conversationLoad: (id: string) => ipcRenderer.invoke('conversations:load', id),
    conversationSave: (conversation: object) => ipcRenderer.invoke('conversations:save', conversation),
    conversationAddMessage: (conversationId: string, message: object) =>
        ipcRenderer.invoke('conversations:addMessage', conversationId, message),
    conversationUpdateLastMessage: (conversationId: string, content: string) =>
        ipcRenderer.invoke('conversations:updateLastMessage', conversationId, content),
    conversationDelete: (id: string) => ipcRenderer.invoke('conversations:delete', id),
    conversationRename: (id: string, newTitle: string) => ipcRenderer.invoke('conversations:rename', id, newTitle),

    // Agent mode operations
    agentReadFile: (filePath: string, workspacePath: string) =>
        ipcRenderer.invoke('agent:readFile', filePath, workspacePath),
    agentProposeEdit: (filePath: string, newContent: string, workspacePath: string) =>
        ipcRenderer.invoke('agent:proposeEdit', filePath, newContent, workspacePath),
    agentApproveEdit: (editId: string) => ipcRenderer.invoke('agent:approveEdit', editId),
    agentRejectEdit: (editId: string) => ipcRenderer.invoke('agent:rejectEdit', editId),
    agentGetPendingEdits: () => ipcRenderer.invoke('agent:getPendingEdits'),

    // File system watcher
    watchFolder: (folderPath: string) => ipcRenderer.invoke('fs:watchFolder', folderPath),
    unwatchFolder: () => ipcRenderer.invoke('fs:unwatchFolder'),
    onFsChanged: (callback: (data: object) => void) => {
        ipcRenderer.on('fs:changed', (_event, data: object) => callback(data));
    },
    removeFsChangedListener: () => {
        ipcRenderer.removeAllListeners('fs:changed');
    },

    // Hugging Face model download operations
    hfSearch: (query: string, sort?: string, offset?: number) => ipcRenderer.invoke('hf:search', query, sort, offset),
    hfListFiles: (repoId: string) => ipcRenderer.invoke('hf:listFiles', repoId),
    hfDownload: (url: string, fileName: string) => ipcRenderer.invoke('hf:download', url, fileName),
    hfCancelDownload: (fileName: string) => ipcRenderer.invoke('hf:cancelDownload', fileName),
    hfGetActiveDownloads: () => ipcRenderer.invoke('hf:getActiveDownloads'),
    onHfDownloadProgress: (callback: (progress: object) => void) => {
        ipcRenderer.on('hf:downloadProgress', (_event, progress: object) => callback(progress));
    },
    removeHfDownloadProgressListener: () => {
        ipcRenderer.removeAllListeners('hf:downloadProgress');
    },

    // Clipboard
    writeClipboard: (text: string) => ipcRenderer.invoke('clipboard:write', text),

    // Speech-to-Text (Whisper) operations
    speechInit: () => ipcRenderer.invoke('speech:init'),
    speechTranscribe: (audioData: number[]) => ipcRenderer.invoke('speech:transcribe', audioData),
    speechGetStatus: () => ipcRenderer.invoke('speech:getStatus'),
    onSpeechStatus: (callback: (status: object) => void) => {
        ipcRenderer.on('speech:status', (_event, status: object) => callback(status));
    },
    removeSpeechStatusListener: () => {
        ipcRenderer.removeAllListeners('speech:status');
    },
});
