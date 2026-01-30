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

export interface ScanResult {
    success: boolean;
    files?: FileInfo[];
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
export interface FileDeleteResult {
    success: boolean;
    error?: string;
}

export interface FileRenameResult {
    success: boolean;
    newPath?: string;
    error?: string;
}

export interface ElectronAPI {
    isElectron: () => boolean;
    openFolderDialog: () => Promise<string | null>;
    scanFolder: (folderPath: string) => Promise<ScanResult>;
    readFile: (filePath: string) => Promise<FileReadResult>;
    writeFile: (filePath: string, content: string) => Promise<FileWriteResult>;
    createFile: (folderPath: string, fileName: string) => Promise<FileCreateResult>;
    deleteFile: (filePath: string) => Promise<FileDeleteResult>;
    renameFile: (filePath: string, newFileName: string) => Promise<FileRenameResult>;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}
