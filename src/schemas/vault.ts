import { z } from 'zod';

import type { IpcErrorCode } from '@/schemas/errors';

export type ContextMenuItem = {
    label: string;
    action: string;
    shortcut?: string;
    disabled?: boolean;
};

export type FileInfo = {
    name: string;
    path: string;
    relativePath: string;
    extension: string;
    size: number;
    modified: string;
    folder: string;
};

export type FolderInfo = {
    name: string;
    path: string;
    relativePath: string;
    type: 'folder';
    folder: string;
};

export type ScanResult = {
    success: boolean;
    root?: string;
    files: FileInfo[];
    folders: FolderInfo[];
    error?: IpcErrorCode;
};

export type FileReadResult = {
    success: boolean;
    content?: string;
    error?: IpcErrorCode;
};

export type ImageReadResult = {
    success: boolean;
    dataUrl?: string;
    error?: IpcErrorCode;
};

export type AudioReadResult = {
    success: boolean;
    dataUrl?: string;
    error?: IpcErrorCode;
};

export type EmbedResolveResult = {
    success: boolean;
    path?: string;
    error?: IpcErrorCode;
};

export type FileWriteResult = {
    success: boolean;
    error?: IpcErrorCode;
};

export type FileCreateResult = {
    success: boolean;
    path?: string;
    error?: IpcErrorCode;
};

export type FolderCreateResult = {
    success: boolean;
    path?: string;
    error?: IpcErrorCode;
};

export type FileDeleteResult = {
    success: boolean;
    error?: IpcErrorCode;
};

export type FileRenameResult = {
    success: boolean;
    newPath?: string;
    error?: IpcErrorCode;
};

export type FolderRenameResult = {
    success: boolean;
    newPath?: string;
    error?: IpcErrorCode;
};

export type FolderDeleteResult = {
    success: boolean;
    error?: IpcErrorCode;
};

export type FileMoveResult = {
    success: boolean;
    newPath?: string;
    error?: IpcErrorCode;
};

export type FolderMoveResult = {
    success: boolean;
    newPath?: string;
    error?: IpcErrorCode;
};

export type AudioSaveResult = {
    success: boolean;
    path?: string;
    error?: IpcErrorCode;
};

export type TreeNode = {
    path: string;
    name: string;
    type: 'folder' | 'file';
    children?: TreeNode[];
    file?: FileInfo;
};

export type LanguageInfo = {
    id: string;
    name: string;
    path: string;
};

export const LanguageStateSchema = z
    .object({
        activeLanguage: z.string().optional(),
    })
    .catchall(z.unknown());

export type LanguageState = z.infer<typeof LanguageStateSchema>;

export type ThemeInfo = {
    id: string;
    name: string;
    description: string;
    colors: Record<string, string>;
    path: string;
};

export const ThemeStateSchema = z
    .object({
        activeTheme: z.string().optional(),
    })
    .catchall(z.unknown());

export type ThemeState = z.infer<typeof ThemeStateSchema>;

export const TranscriptionResultSchema = z.union([z.string(), z.object({ text: z.string() })]);

export type Transcriber = (audio: Float32Array, options?: Record<string, unknown>) => Promise<unknown>;

export type TabState = {
    file: FileInfo;
    content: string | null;
    savedContent: string | null;
    hasUnsavedChanges: boolean;
    scrollTop: number;
};

const PersistedTabSchema = z.object({
    path: z.string(),
    scrollTop: z.number(),
});

export const PersistedTabStateSchema = z.object({
    tabs: z.array(PersistedTabSchema),
    activeIndex: z.number(),
});

export type PersistedTabState = z.infer<typeof PersistedTabStateSchema>;

export type HighlightPart = {
    text: string;
    highlighted: boolean;
};

// IPC handler input schemas — validated at the boundary before any FS operation
export const SaveDialogOptionsSchema = z.object({
    defaultPath: z.string().optional(),
    filters: z.array(z.object({ name: z.string(), extensions: z.array(z.string()) })).optional(),
});

export const FileWriteBufferArgsSchema = z.object({
    filePath: z.string(),
    base64Data: z.string(),
});

export const ResolveEmbedArgsSchema = z.object({
    fileName: z.string(),
    noteDir: z.string(),
    embedVaultRoot: z.string(),
});

export const FileWriteArgsSchema = z.object({
    filePath: z.string(),
    content: z.string(),
});

export const FileCreateArgsSchema = z.object({
    folderPath: z.string(),
    fileName: z.string(),
});

export const FolderCreateArgsSchema = z.object({
    parentPath: z.string(),
    folderName: z.string(),
});

export const FileRenameArgsSchema = z.object({
    oldPath: z.string(),
    newFileName: z.string(),
});

export const UpdateEmbedRefsArgsSchema = z.object({
    oldFileName: z.string(),
    newFileName: z.string(),
});

export const FolderRenameArgsSchema = z.object({
    oldPath: z.string(),
    newFolderName: z.string(),
});

export const FileMoveArgsSchema = z.object({
    filePath: z.string(),
    targetFolderPath: z.string(),
});

export const FolderMoveArgsSchema = z.object({
    folderPath: z.string(),
    targetFolderPath: z.string(),
});
