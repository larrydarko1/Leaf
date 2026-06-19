import type {
    AiListModelsResult,
    AiLoadResult,
    AiChatResult,
    AiStatus,
    AiSimpleResult,
    ConversationMessage,
    Conversation,
    ConversationListResult,
    ConversationCreateResult,
    ConversationLoadResult,
    AgentReadFileResult,
    AgentProposeEditResult,
    AgentEditResult,
    AgentPendingEditsResult,
} from '@/schemas/ai';
import type { HfSearchResponse, HfListFilesResponse, HfDownloadProgress, HfDownloadResult } from '@/schemas/hf';
import type { SpeechInitResult, SpeechTranscribeResult, SpeechStatus, SpeechStatusEvent } from '@/schemas/speech';
import type {
    ScanResult,
    FileReadResult,
    ImageReadResult,
    AudioReadResult,
    EmbedResolveResult,
    CopyToVaultResult,
    FileWriteResult,
    FileCreateResult,
    FolderCreateResult,
    FileDeleteResult,
    FileRenameResult,
    FolderRenameResult,
    FolderDeleteResult,
    FileMoveResult,
    FolderMoveResult,
    AudioSaveResult,
} from '@/schemas/vault';

export type ElectronAPI = {
    log: {
        error: (...args: unknown[]) => void;
        warn: (...args: unknown[]) => void;
        info: (...args: unknown[]) => void;
        debug: (...args: unknown[]) => void;
    };
    isElectron: () => boolean;
    openExternal: (url: string) => Promise<boolean>;
    openFolderDialog: () => Promise<string | null>;
    showSaveDialog: (options: {
        defaultPath?: string;
        filters?: { name: string; extensions: string[] }[];
    }) => Promise<string | null>;
    writeBuffer: (filePath: string, base64Data: string) => Promise<FileWriteResult>;
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
    updateEmbedRefs: (
        oldFileName: string,
        newFileName: string,
    ) => Promise<{ success: boolean; updatedCount?: number; error?: string }>;
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
    aiRestoreChatHistory: (messages: { role: string; content: string }[]) => Promise<AiSimpleResult>;
    aiGetStatus: () => Promise<AiStatus>;
    aiOpenLeafDir: () => Promise<AiSimpleResult>;
    systemPromptList: () => Promise<{
        success: boolean;
        prompts: { id: string; name: string; description: string; path: string }[];
        activeId: string;
        promptsDir: string;
        error?: string;
    }>;
    systemPromptSetActive: (id: string) => Promise<AiSimpleResult>;
    systemPromptOpenLeafDir: () => Promise<AiSimpleResult>;

    // Theme presets (~/.leaf/themes/*.json)
    themeList: () => Promise<{
        success: boolean;
        themes: {
            id: string;
            name: string;
            description: string;
            colors: Record<string, string>;
            path: string;
        }[];
        activeId: string;
        themesDir: string;
        error?: string;
    }>;
    themeSetActive: (id: string) => Promise<AiSimpleResult>;
    themeOpenLeafDir: () => Promise<AiSimpleResult>;

    // Language files (~/.leaf/locales/*.json)
    languageList: () => Promise<{
        success: boolean;
        languages: {
            id: string;
            name: string;
            path: string;
        }[];
        activeId: string;
        localesDir: string;
        error?: string;
    }>;
    languageSetActive: (id: string) => Promise<AiSimpleResult>;
    languageOpenLeafDir: () => Promise<AiSimpleResult>;

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
    hfSearch: (query: string, sort?: string, offset?: number) => Promise<HfSearchResponse>;
    hfListFiles: (repoId: string) => Promise<HfListFilesResponse>;
    hfDownload: (url: string, fileName: string) => Promise<HfDownloadResult>;
    hfCancelDownload: (fileName: string) => Promise<AiSimpleResult>;
    hfGetActiveDownloads: () => Promise<{ success: boolean; downloads: string[] }>;
    onHfDownloadProgress: (callback: (progress: HfDownloadProgress) => void) => void;
    removeHfDownloadProgressListener: () => void;

    // Clipboard
    writeClipboard: (text: string) => Promise<void>;

    // Bookmarks persistence
    bookmarksLoad: () => Promise<{ success: boolean; bookmarks?: string[]; error?: string }>;
    bookmarksSave: (bookmarks: string[]) => Promise<{ success: boolean; error?: string }>;

    // Speech-to-Text (Whisper) operations
    speechInit: () => Promise<SpeechInitResult>;
    speechTranscribe: (audioData: number[]) => Promise<SpeechTranscribeResult>;
    speechGetStatus: () => Promise<SpeechStatus>;
    onSpeechStatus: (callback: (status: SpeechStatusEvent) => void) => void;
    removeSpeechStatusListener: () => void;
};

declare global {
    /* eslint-disable @typescript-eslint/consistent-type-definitions */
    interface Window {
        electronAPI: ElectronAPI;
    }
}
