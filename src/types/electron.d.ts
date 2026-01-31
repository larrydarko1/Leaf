// Type definitions for Electron API

export interface FileInfo {
    name: string;
    path: string;
    relativePath: string;
    extension: string;
    size: number;
    modified: string;
    folder: string;
}

export interface FolderInfo {
    name: string;
    path: string;
    relativePath: string;
    type: 'folder';
    folder: string;
}

export interface ScanResult {
    success: boolean;
    files?: FileInfo[];
    folders?: FolderInfo[];
    error?: string;
}

export interface FileReadResult {
    success: boolean;
    content?: string;
    error?: string;
}

export interface FileWriteResult {
    success: boolean;
    error?: string;
}

export interface FileCreateResult {
    success: boolean;
    path?: string;
    error?: string;
}

export interface FolderCreateResult {
    success: boolean;
    path?: string;
    error?: string;
}

export interface FileDeleteResult {
    success: boolean;
    error?: string;
}

export interface FileRenameResult {
    success: boolean;
    newPath?: string;
    error?: string;
}

export interface FolderRenameResult {
    success: boolean;
    newPath?: string;
    error?: string;
}

export interface FolderDeleteResult {
    success: boolean;
    error?: string;
}

export interface FileMoveResult {
    success: boolean;
    newPath?: string;
    error?: string;
}

export interface ElectronAPI {
    isElectron: () => boolean;
    openFolderDialog: () => Promise<string | null>;
    scanFolder: (folderPath: string) => Promise<ScanResult>;
    readFile: (filePath: string) => Promise<FileReadResult>;
    createFolder: (parentPath: string, folderName: string) => Promise<FolderCreateResult>;
    writeFile: (filePath: string, content: string) => Promise<FileWriteResult>;
    createFile: (folderPath: string, fileName: string) => Promise<FileCreateResult>;
    deleteFile: (filePath: string) => Promise<FileDeleteResult>;
    renameFile: (filePath: string, newFileName: string) => Promise<FileRenameResult>;
    renameFolder: (folderPath: string, newFolderName: string) => Promise<FolderRenameResult>;
    deleteFolder: (folderPath: string) => Promise<FolderDeleteResult>;
    moveFile: (filePath: string, targetFolderPath: string) => Promise<FileMoveResult>;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}
