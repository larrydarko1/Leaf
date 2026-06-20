import type { pipeline as PipelineFn } from '@huggingface/transformers';
import { z } from 'zod';

export const ContextMenuItemSchema = z.object({
    label: z.string(),
    action: z.string(),
    shortcut: z.string().optional(),
    disabled: z.boolean().optional(),
});

export type ContextMenuItem = z.infer<typeof ContextMenuItemSchema>;

export const FileInfoSchema = z.object({
    name: z.string(),
    path: z.string(),
    relativePath: z.string(),
    extension: z.string(),
    size: z.number(),
    modified: z.string(),
    folder: z.string(),
});

export type FileInfo = z.infer<typeof FileInfoSchema>;

export const FolderInfoSchema = z.object({
    name: z.string(),
    path: z.string(),
    relativePath: z.string(),
    type: z.literal('folder'),
    folder: z.string(),
});

export type FolderInfo = z.infer<typeof FolderInfoSchema>;

export const ScanResultSchema = z.object({
    success: z.boolean(),
    files: z.array(FileInfoSchema),
    folders: z.array(FolderInfoSchema),
    error: z.string().optional(),
});

export type ScanResult = z.infer<typeof ScanResultSchema>;

export const FileReadResultSchema = z.object({
    success: z.boolean(),
    content: z.string().optional(),
    error: z.string().optional(),
});

export type FileReadResult = z.infer<typeof FileReadResultSchema>;

export const ImageReadResultSchema = z.object({
    success: z.boolean(),
    dataUrl: z.string().optional(),
    error: z.string().optional(),
});

export type ImageReadResult = z.infer<typeof ImageReadResultSchema>;

export const AudioReadResultSchema = z.object({
    success: z.boolean(),
    dataUrl: z.string().optional(),
    error: z.string().optional(),
});

export type AudioReadResult = z.infer<typeof AudioReadResultSchema>;

export const EmbedResolveResultSchema = z.object({
    success: z.boolean(),
    path: z.string().optional(),
    error: z.string().optional(),
});

export type EmbedResolveResult = z.infer<typeof EmbedResolveResultSchema>;

export const CopyToVaultResultSchema = z.object({
    success: z.boolean(),
    fileName: z.string().optional(),
    path: z.string().optional(),
    error: z.string().optional(),
});

export type CopyToVaultResult = z.infer<typeof CopyToVaultResultSchema>;

export const FileWriteResultSchema = z.object({
    success: z.boolean(),
    error: z.string().optional(),
});

export type FileWriteResult = z.infer<typeof FileWriteResultSchema>;

export const FileCreateResultSchema = z.object({
    success: z.boolean(),
    path: z.string().optional(),
    error: z.string().optional(),
});

export type FileCreateResult = z.infer<typeof FileCreateResultSchema>;

export const FolderCreateResultSchema = z.object({
    success: z.boolean(),
    path: z.string().optional(),
    error: z.string().optional(),
});

export type FolderCreateResult = z.infer<typeof FolderCreateResultSchema>;

export const FileDeleteResultSchema = z.object({
    success: z.boolean(),
    error: z.string().optional(),
});

export type FileDeleteResult = z.infer<typeof FileDeleteResultSchema>;

export const FileRenameResultSchema = z.object({
    success: z.boolean(),
    newPath: z.string().optional(),
    error: z.string().optional(),
});

export type FileRenameResult = z.infer<typeof FileRenameResultSchema>;

export const FolderRenameResultSchema = z.object({
    success: z.boolean(),
    newPath: z.string().optional(),
    error: z.string().optional(),
});

export type FolderRenameResult = z.infer<typeof FolderRenameResultSchema>;

export const FolderDeleteResultSchema = z.object({
    success: z.boolean(),
    error: z.string().optional(),
});

export type FolderDeleteResult = z.infer<typeof FolderDeleteResultSchema>;

export const FileMoveResultSchema = z.object({
    success: z.boolean(),
    newPath: z.string().optional(),
    error: z.string().optional(),
});

export type FileMoveResult = z.infer<typeof FileMoveResultSchema>;

export const FolderMoveResultSchema = z.object({
    success: z.boolean(),
    newPath: z.string().optional(),
    error: z.string().optional(),
});

export type FolderMoveResult = z.infer<typeof FolderMoveResultSchema>;

export const AudioSaveResultSchema = z.object({
    success: z.boolean(),
    path: z.string().optional(),
    error: z.string().optional(),
});

export type AudioSaveResult = z.infer<typeof AudioSaveResultSchema>;

export const TreeNodeSchema: z.ZodType<TreeNode> = z.lazy(() =>
    z.object({
        path: z.string(),
        name: z.string(),
        type: z.enum(['folder', 'file']),
        children: z.array(TreeNodeSchema).optional(),
        file: FileInfoSchema.optional(),
    }),
);

export type TreeNode = {
    path: string;
    name: string;
    type: 'folder' | 'file';
    children?: TreeNode[];
    file?: FileInfo;
};

export const LanguageInfoSchema = z.object({
    id: z.string(),
    name: z.string(),
    path: z.string(),
});

export type LanguageInfo = z.infer<typeof LanguageInfoSchema>;

export const LanguageStateSchema = z
    .object({
        activeLanguage: z.string().optional(),
    })
    .catchall(z.unknown());

export type LanguageState = z.infer<typeof LanguageStateSchema>;

export const ThemeInfoSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    colors: z.record(z.string(), z.string()),
    path: z.string(),
});

export type ThemeInfo = z.infer<typeof ThemeInfoSchema>;

export const ThemeStateSchema = z
    .object({
        activeTheme: z.string().optional(),
    })
    .catchall(z.unknown());

export type ThemeState = z.infer<typeof ThemeStateSchema>;

// Minimal shape of the parts of @huggingface/transformers we actually touch
export const TransformersEnvSchema = z.object({
    cacheDir: z.string(),
    allowRemoteModels: z.boolean(),
});

export const TransformersModuleSchema = z.object({
    pipeline: z.any() as z.ZodType<typeof PipelineFn>,
    env: TransformersEnvSchema,
});

export type TransformersModule = z.infer<typeof TransformersModuleSchema>;

export const TranscriptionResultSchema = z.union([z.object({ text: z.string() }), z.string()]);

export type TranscriptionResult = z.infer<typeof TranscriptionResultSchema>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TranscriberSchema = z.any() as z.ZodType<(audio: Float32Array) => Promise<any>>;

export type Transcriber = z.infer<typeof TranscriberSchema>;

export const TabStateSchema = z.object({
    file: FileInfoSchema,
    content: z.string().nullable(),
    savedContent: z.string().nullable(),
    hasUnsavedChanges: z.boolean(),
    scrollTop: z.number(),
});

export type TabState = z.infer<typeof TabStateSchema>;

export const PersistedTabSchema = z.object({
    path: z.string(),
    scrollTop: z.number(),
});

export const PersistedTabStateSchema = z.object({
    tabs: z.array(PersistedTabSchema),
    activeIndex: z.number(),
});

export type PersistedTabState = z.infer<typeof PersistedTabStateSchema>;

export const HighlightPartSchema = z.object({
    text: z.string(),
    highlighted: z.boolean(),
});

export type HighlightPart = z.infer<typeof HighlightPartSchema>;

// IPC handler input schemas — validated at the boundary before any FS operation
export const SaveDialogOptionsSchema = z.object({
    defaultPath: z.string().optional(),
    filters: z.array(z.object({ name: z.string(), extensions: z.array(z.string()) })).optional(),
});
export type SaveDialogOptions = z.infer<typeof SaveDialogOptionsSchema>;

export const FileWriteBufferArgsSchema = z.object({
    filePath: z.string(),
    base64Data: z.string(),
});

export const ResolveEmbedArgsSchema = z.object({
    fileName: z.string(),
    noteDir: z.string(),
    embedVaultRoot: z.string(),
});

export const FileCopyToVaultArgsSchema = z.object({
    sourcePath: z.string(),
    targetDir: z.string(),
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
