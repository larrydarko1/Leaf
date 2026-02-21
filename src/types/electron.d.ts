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
    contextTokens: number;
    contextSize: number;
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
    tokenCount?: number;
}

export interface ConversationMeta {
    id: string;
    title: string;
    model: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
    tokenCount: number;
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

// Agent mode types
export interface AgentReadFileResult {
    success: boolean;
    content?: string;
    filePath?: string;
    error?: string;
}

export interface AgentProposeEditResult {
    success: boolean;
    editId?: string;
    filePath?: string;
    relativePath?: string;
    originalContent?: string;
    newContent?: string;
    isNewFile?: boolean;
    error?: string;
}

export interface AgentEditResult {
    success: boolean;
    error?: string;
}

export interface AgentPendingEdit {
    editId: string;
    filePath: string;
    relativePath: string;
    isNewFile: boolean;
    timestamp: string;
}

export interface AgentPendingEditsResult {
    success: boolean;
    edits: AgentPendingEdit[];
}

// Hugging Face download types
export interface HfSearchResult {
    id: string;
    author: string;
    name: string;
    downloads: number;
    likes: number;
    tags: string[];
    lastModified: string;
}

export interface HfSearchResponse {
    success: boolean;
    results?: HfSearchResult[];
    error?: string;
}

export interface HfModelTier {
    label: string;   // 'Small' | 'Medium' | 'Large' | 'Very Large' | 'Extreme'
    color: string;   // 'green' | 'blue' | 'orange' | 'red'
    description: string;
}

export interface HfShardFile {
    name: string;
    path: string;
    size: number;
    sizeFormatted: string;
    downloadUrl: string;
}

export interface HfRepoFile {
    name: string;
    path: string;
    size: number;
    sizeFormatted: string;
    downloadUrl: string;
    quantType: string | null;
    estimatedRam: number;
    estimatedRamFormatted: string;
    tier: HfModelTier;
    isSharded: boolean;
    shardCount: number;
    shardFiles: HfShardFile[] | null;
    architecture: string | null;
    contextLength: number | null;
}

export interface HfModelInfo {
    architecture: string | null;
    contextLength: number | null;
    totalParamSize: number | null;
    totalParamSizeFormatted: string;
}

export interface HfListFilesResponse {
    success: boolean;
    files?: HfRepoFile[];
    modelInfo?: HfModelInfo;
    repoId?: string;
    repoName?: string;
    error?: string;
}

export interface HfDownloadProgress {
    downloaded: number;
    total: number;
    percent: number;
    fileName: string;
}

export interface HfDownloadResult {
    success: boolean;
    filePath?: string;
    error?: string;
}

export interface ElectronAPI {
    isElectron: () => boolean;
    openFolderDialog: () => Promise<string | null>;
    scanFolder: (folderPath: string) => Promise<ScanResult>;
    readFile: (filePath: string) => Promise<FileReadResult>;
    readImage: (filePath: string) => Promise<ImageReadResult>;
    readAudio: (filePath: string) => Promise<AudioReadResult>;
    readOdt: (filePath: string) => Promise<FileReadResult>;
    writeOdt: (filePath: string, content: string) => Promise<FileWriteResult>;
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
}

declare global {
    interface Window {
        electronAPI: ElectronAPI;
    }
}
