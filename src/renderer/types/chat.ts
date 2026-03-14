export interface AgentFileEdit {
    filePath: string;
    newContent: string;
    editId?: string;
    originalContent?: string;
    relativePath?: string;
    isNewFile?: boolean;
    status: 'pending' | 'approved' | 'rejected' | 'error';
    error?: string;
}

export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    agentEdits?: AgentFileEdit[];
}
