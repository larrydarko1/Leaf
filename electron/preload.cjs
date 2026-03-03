// Preload script - Bridge between frontend (Vue) and backend (Node.js)
// This exposes safe APIs to the renderer process
const { contextBridge, ipcRenderer } = require('electron');

// Expose Leaf API to the frontend
contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: () => true,

    // Open external URLs in the OS default browser
    openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),

    // Dialog operations
    openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),

    // File system operations
    scanFolder: (folderPath) => ipcRenderer.invoke('files:scan', folderPath),
    readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
    resolveEmbedPath: (fileName, noteDir, vaultRoot) => ipcRenderer.invoke('file:resolveEmbedPath', fileName, noteDir, vaultRoot),
    copyFileToVault: (sourcePath, targetDir) => ipcRenderer.invoke('file:copyToVault', sourcePath, targetDir),
    readImage: (filePath) => ipcRenderer.invoke('file:readImage', filePath),
    readAudio: (filePath) => ipcRenderer.invoke('file:readAudio', filePath),
    writeFile: (filePath, content) => ipcRenderer.invoke('file:write', filePath, content),
    createFile: (folderPath, fileName) => ipcRenderer.invoke('file:create', folderPath, fileName),
    createFolder: (parentPath, folderName) => ipcRenderer.invoke('folder:create', parentPath, folderName),
    deleteFile: (filePath) => ipcRenderer.invoke('file:delete', filePath),
    renameFile: (filePath, newFileName) => ipcRenderer.invoke('file:rename', filePath, newFileName),
    renameFolder: (folderPath, newFolderName) => ipcRenderer.invoke('folder:rename', folderPath, newFolderName),
    deleteFolder: (folderPath) => ipcRenderer.invoke('folder:delete', folderPath),
    moveFile: (filePath, targetFolderPath) => ipcRenderer.invoke('file:move', filePath, targetFolderPath),
    moveFolder: (folderPath, targetFolderPath) => ipcRenderer.invoke('folder:move', folderPath, targetFolderPath),

    // Audio recording
    saveAudioRecording: (folderPath, fileName, base64Data) => ipcRenderer.invoke('audio:saveRecording', folderPath, fileName, base64Data),

    // Spellcheck
    getSpellingSuggestions: (word) => ipcRenderer.invoke('spellcheck:getSuggestions', word),

    // AI / LLM operations
    aiListModels: () => ipcRenderer.invoke('ai:listModels'),
    aiLoadModel: (modelPath) => ipcRenderer.invoke('ai:loadModel', modelPath),
    aiUnloadModel: () => ipcRenderer.invoke('ai:unloadModel'),
    aiChat: (userMessage, noteContext) => ipcRenderer.invoke('ai:chat', userMessage, noteContext),
    aiStopChat: () => ipcRenderer.invoke('ai:stopChat'),
    aiResetChat: () => ipcRenderer.invoke('ai:resetChat'),
    aiRestoreChatHistory: (messages) => ipcRenderer.invoke('ai:restoreChatHistory', messages),
    aiGetStatus: () => ipcRenderer.invoke('ai:getStatus'),
    aiOpenModelsDir: () => ipcRenderer.invoke('ai:openModelsDir'),

    // AI streaming token listener
    onAiToken: (callback) => {
        ipcRenderer.on('ai:token', (event, token) => callback(token));
    },
    removeAiTokenListener: () => {
        ipcRenderer.removeAllListeners('ai:token');
    },

    // Conversation persistence
    conversationList: () => ipcRenderer.invoke('conversations:list'),
    conversationCreate: (modelName) => ipcRenderer.invoke('conversations:create', modelName),
    conversationLoad: (id) => ipcRenderer.invoke('conversations:load', id),
    conversationSave: (conversation) => ipcRenderer.invoke('conversations:save', conversation),
    conversationAddMessage: (conversationId, message) => ipcRenderer.invoke('conversations:addMessage', conversationId, message),
    conversationUpdateLastMessage: (conversationId, content) => ipcRenderer.invoke('conversations:updateLastMessage', conversationId, content),
    conversationDelete: (id) => ipcRenderer.invoke('conversations:delete', id),
    conversationRename: (id, newTitle) => ipcRenderer.invoke('conversations:rename', id, newTitle),

    // Agent mode operations
    agentReadFile: (filePath, workspacePath) => ipcRenderer.invoke('agent:readFile', filePath, workspacePath),
    agentProposeEdit: (filePath, newContent, workspacePath) => ipcRenderer.invoke('agent:proposeEdit', filePath, newContent, workspacePath),
    agentApproveEdit: (editId) => ipcRenderer.invoke('agent:approveEdit', editId),
    agentRejectEdit: (editId) => ipcRenderer.invoke('agent:rejectEdit', editId),
    agentGetPendingEdits: () => ipcRenderer.invoke('agent:getPendingEdits'),

    // File system watcher
    watchFolder: (folderPath) => ipcRenderer.invoke('fs:watchFolder', folderPath),
    unwatchFolder: () => ipcRenderer.invoke('fs:unwatchFolder'),
    onFsChanged: (callback) => {
        ipcRenderer.on('fs:changed', (event, data) => callback(data));
    },
    removeFsChangedListener: () => {
        ipcRenderer.removeAllListeners('fs:changed');
    },

    // Hugging Face model download operations
    hfSearch: (query) => ipcRenderer.invoke('hf:search', query),
    hfListFiles: (repoId) => ipcRenderer.invoke('hf:listFiles', repoId),
    hfDownload: (url, fileName) => ipcRenderer.invoke('hf:download', url, fileName),
    hfCancelDownload: (fileName) => ipcRenderer.invoke('hf:cancelDownload', fileName),
    hfGetActiveDownloads: () => ipcRenderer.invoke('hf:getActiveDownloads'),
    onHfDownloadProgress: (callback) => {
        ipcRenderer.on('hf:downloadProgress', (event, progress) => callback(progress));
    },
    removeHfDownloadProgressListener: () => {
        ipcRenderer.removeAllListeners('hf:downloadProgress');
    },

    // Speech-to-Text (Whisper) operations
    speechInit: () => ipcRenderer.invoke('speech:init'),
    speechTranscribe: (audioData) => ipcRenderer.invoke('speech:transcribe', audioData),
    speechGetStatus: () => ipcRenderer.invoke('speech:getStatus'),
    onSpeechStatus: (callback) => {
        ipcRenderer.on('speech:status', (event, status) => callback(status));
    },
    removeSpeechStatusListener: () => {
        ipcRenderer.removeAllListeners('speech:status');
    }
});

