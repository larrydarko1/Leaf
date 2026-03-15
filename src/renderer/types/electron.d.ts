// Type definitions for Electron API
import type {
    AiListModelsResult, AiLoadResult, AiChatResult, AiStatus, AiSimpleResult,
    ConversationMessage, Conversation, ConversationListResult, ConversationCreateResult, ConversationLoadResult,
    AgentReadFileResult, AgentProposeEditResult, AgentEditResult, AgentPendingEditsResult,
} from './ai';
import type { HfSearchResponse, HfListFilesResponse, HfDownloadProgress, HfDownloadResult } from './hf';
import type { SpeechInitResult, SpeechTranscribeResult, SpeechStatus, SpeechStatusEvent } from './speech';

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

export interface ImageReadResult {
    success: boolean;
    dataUrl?: string;
    error?: string;
}

export interface AudioReadResult {
    success: boolean;
    dataUrl?: string;
    error?: string;
}

export interface EmbedResolveResult {
    success: boolean;
    path?: string;
    error?: string;
}

export interface CopyToVaultResult {
    success: boolean;
    fileName?: string;
    path?: string;
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

export interface FolderMoveResult {
    success: boolean;
    newPath?: string;
    error?: string;
}

export interface AudioSaveResult {
    success: boolean;
    path?: string;
    error?: string;
}

export interface ElectronAPI {
    isElectron: () => boolean;
    openExternal: (url: string) => Promise<boolean>;
    openFolderDialog: () => Promise<string | null>;
    scanFolder: (folderPath: string) => Promise<ScanResult>;
    readFile: (filePath: string) => Promise<FileReadResult>;
    readImage: (filePath: string) => Promise<ImageReadResult>;
    readAudio: (filePath: string) => Promise<AudioReadResult>;
    resolveEmbedPath: (fileName: string, noteDir: string, vaultRoot: string) => Promise<EmbedResolveResult>;
    copyFileToVault: (sourcePath: string, targetDir: string) => Promise<CopyToVaultResult>;
    createFolder: (parentPath: string, folderName: string) => Promise<FolderCreateResult>;
    writeFile: (filePath: string, content: string) => Promise<FileWriteResult>;
    createFile: (folderPath: string, fileName: string) => Promise<FileCreateResult>;
    deleteFile: (filePath: string) => Promise<FileDeleteResult>;
    renameFile: (filePath: string, newFileName: string) => Promise<FileRenameResult>;
    renameFolder: (folderPath: string, newFolderName: string) => Promise<FolderRenameResult>;
    deleteFolder: (folderPath: string) => Promise<FolderDeleteResult>;
    moveFile: (filePath: string, targetFolderPath: string) => Promise<FileMoveResult>;
    moveFolder: (folderPath: string, targetFolderPath: string) => Promise<FolderMoveResult>;
    saveAudioRecording: (folderPath: string, fileName: string, base64Data: string) => Promise<AudioSaveResult>;

    // AI / LLM operations
    aiListModels: () => Promise<AiListModelsResult>;
    aiLoadModel: (modelPath: string) => Promise<AiLoadResult>;
    aiUnloadModel: () => Promise<AiSimpleResult>;
    aiChat: (userMessage: string, noteContext?: string | null) => Promise<AiChatResult>;
    aiStopChat: () => Promise<AiSimpleResult>;
    aiResetChat: () => Promise<AiSimpleResult>;
    aiRestoreChatHistory: (messages: Array<{ role: string, content: string }>) => Promise<AiSimpleResult>;
    aiGetStatus: () => Promise<AiStatus>;
    aiOpenModelsDir: () => Promise<AiSimpleResult>;
    onAiToken: (callback: (token: string) => void) => void;
    removeAiTokenListener: () => void;

    // Conversation persistence
    conversationList: () => Promise<ConversationListResult>;
    conversationCreate: (modelName: string) => Promise<ConversationCreateResult>;
    conversationLoad: (id: string) => Promise<ConversationLoadResult>;
    conversationSave: (conversation: Conversation) => Promise<AiSimpleResult>;
    conversationAddMessage: (conversationId: string, message: ConversationMessage) => Promise<AiSimpleResult>;
    conversationUpdateLastMessage: (conversationId: string, content: string) => Promise<AiSimpleResult>;
    conversationDelete: (id: string) => Promise<AiSimpleResult>;
    conversationRename: (id: string, newTitle: string) => Promise<AiSimpleResult>;

    // Agent mode operations
    agentReadFile: (filePath: string, workspacePath: string) => Promise<AgentReadFileResult>;
    agentProposeEdit: (filePath: string, newContent: string, workspacePath: string) => Promise<AgentProposeEditResult>;
    agentApproveEdit: (editId: string) => Promise<AgentEditResult>;
    agentRejectEdit: (editId: string) => Promise<AgentEditResult>;
    agentGetPendingEdits: () => Promise<AgentPendingEditsResult>;

    // File system watcher
    watchFolder: (folderPath: string) => Promise<AiSimpleResult>;
    unwatchFolder: () => Promise<AiSimpleResult>;
    onFsChanged: (callback: (data: { eventType: string; filename: string }) => void) => void;
    removeFsChangedListener: () => void;

    // Hugging Face model download operations
    hfSearch: (query: string) => Promise<HfSearchResponse>;
    hfListFiles: (repoId: string) => Promise<HfListFilesResponse>;
    hfDownload: (url: string, fileName: string) => Promise<HfDownloadResult>;
    hfCancelDownload: (fileName: string) => Promise<AiSimpleResult>;
    hfGetActiveDownloads: () => Promise<{ success: boolean; downloads: string[] }>;
    onHfDownloadProgress: (callback: (progress: HfDownloadProgress) => void) => void;
    removeHfDownloadProgressListener: () => void;

    // Speech-to-Text (Whisper) operations
    speechInit: () => Promise<SpeechInitResult>;
    speechTranscribe: (audioData: number[]) => Promise<SpeechTranscribeResult>;
    speechGetStatus: () => Promise<SpeechStatus>;
    onSpeechStatus: (callback: (status: SpeechStatusEvent) => void) => void;
    removeSpeechStatusListener: () => void;
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}
