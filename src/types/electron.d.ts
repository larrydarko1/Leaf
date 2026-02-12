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

// AI / LLM Types
export interface AiModelInfo {
    name: string;
    path: string;
    size: number;
    sizeFormatted: string;
    modified: string;
}

export interface AiListModelsResult {
    success: boolean;
    models: AiModelInfo[];
    modelsDir: string;
    error?: string;
}

export interface AiLoadResult {
    success: boolean;
    modelName?: string;
    error?: string;
}

export interface AiChatResult {
    success: boolean;
    response?: string;
    error?: string;
}

export interface AiStatus {
    isModelLoaded: boolean;
    currentModelPath: string | null;
    currentModelName: string | null;
    isGenerating: boolean;
    modelsDir: string;
}

export interface AiSimpleResult {
    success: boolean;
    error?: string;
}

// Conversation persistence types
export interface ConversationMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: string;
}

export interface Conversation {
    id: string;
    title: string;
    model: string;
    createdAt: string;
    updatedAt: string;
    messages: ConversationMessage[];
}

export interface ConversationMeta {
    id: string;
    title: string;
    model: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
}

export interface ConversationListResult {
    success: boolean;
    conversations: ConversationMeta[];
    error?: string;
}

export interface ConversationCreateResult {
    success: boolean;
    conversation?: Conversation;
    error?: string;
}

export interface ConversationLoadResult {
    success: boolean;
    conversation?: Conversation;
    error?: string;
}

export interface ElectronAPI {
    isElectron: () => boolean;
    openFolderDialog: () => Promise<string | null>;
    scanFolder: (folderPath: string) => Promise<ScanResult>;
    readFile: (filePath: string) => Promise<FileReadResult>;
    readImage: (filePath: string) => Promise<ImageReadResult>;
    readAudio: (filePath: string) => Promise<AudioReadResult>;
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
    aiResetChat: () => Promise<AiSimpleResult>;
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
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}
