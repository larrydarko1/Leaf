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
    compacted?: boolean;
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
