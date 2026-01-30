// Preload script - Bridge between frontend (Vue) and backend (Node.js)
// This exposes safe APIs to the renderer process
const { contextBridge, ipcRenderer } = require('electron');

// Expose Leaf API to the frontend
contextBridge.exposeInMainWorld('electronAPI', {
    isElectron: () => true,

    // Dialog operations
    openFolderDialog: () => ipcRenderer.invoke('dialog:openFolder'),

    // File system operations
    scanFolder: (folderPath) => ipcRenderer.invoke('files:scan', folderPath),
    readFile: (filePath) => ipcRenderer.invoke('file:read', filePath),
    writeFile: (filePath, content) => ipcRenderer.invoke('file:write', filePath, content),
    createFile: (folderPath, fileName) => ipcRenderer.invoke('file:create', folderPath, fileName),
    createFolder: (parentPath, folderName) => ipcRenderer.invoke('folder:create', parentPath, folderName),
    deleteFile: (filePath) => ipcRenderer.invoke('file:delete', filePath),
    renameFile: (filePath, newFileName) => ipcRenderer.invoke('file:rename', filePath, newFileName),
    renameFolder: (folderPath, newFolderName) => ipcRenderer.invoke('folder:rename', folderPath, newFolderName),
    deleteFolder: (folderPath) => ipcRenderer.invoke('folder:delete', folderPath)
});

