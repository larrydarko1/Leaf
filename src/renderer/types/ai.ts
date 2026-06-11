export type AiModelInfo = {
    name: string;
    path: string;
    size: number;
    sizeFormatted: string;
    modified: string;
};

export type AiListModelsResult = {
    success: boolean;
    models: AiModelInfo[];
    modelsDir: string;
    error?: string;
};

export type AiLoadResult = {
    success: boolean;
    modelName?: string;
    error?: string;
};

export type AiChatResult = {
    success: boolean;
    response?: string;
    compacted?: boolean;
    error?: string;
};

export type AiStatus = {
    isModelLoaded: boolean;
    currentModelPath: string | null;
    currentModelName: string | null;
    isGenerating: boolean;
    modelsDir: string;
    contextTokens: number;
    contextSize: number;
};

export type AiSimpleResult = {
    success: boolean;
    error?: string;
};

// Conversation persistence types
export type ConversationMessage = {
    role: 'user' | 'assistant';
    content: string;
    timestamp?: string;
};

export type Conversation = {
    id: string;
    title: string;
    model: string;
    createdAt: string;
    updatedAt: string;
    messages: ConversationMessage[];
    tokenCount?: number;
};

export type ConversationMeta = {
    id: string;
    title: string;
    model: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
    tokenCount: number;
};

export type ConversationListResult = {
    success: boolean;
    conversations: ConversationMeta[];
    error?: string;
};

export type ConversationCreateResult = {
    success: boolean;
    conversation?: Conversation;
    error?: string;
};

export type ConversationLoadResult = {
    success: boolean;
    conversation?: Conversation;
    error?: string;
};

// Agent mode types
export type AgentReadFileResult = {
    success: boolean;
    content?: string;
    filePath?: string;
    error?: string;
};

export type AgentProposeEditResult = {
    success: boolean;
    editId?: string;
    filePath?: string;
    relativePath?: string;
    originalContent?: string;
    newContent?: string;
    isNewFile?: boolean;
    error?: string;
};

export type AgentEditResult = {
    success: boolean;
    error?: string;
};

export type AgentPendingEdit = {
    editId: string;
    filePath: string;
    relativePath: string;
    isNewFile: boolean;
    timestamp: string;
};

export type AgentPendingEditsResult = {
    success: boolean;
    edits: AgentPendingEdit[];
};
