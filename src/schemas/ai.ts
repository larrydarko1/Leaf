import { z } from 'zod';

// IPC result shapes. Plain types: the main process is the only producer and
// nothing validates them on the way back, so there is no schema to keep.

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

export const ConversationMessageSchema = z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
    thinking: z.string().optional(),
    timestamp: z.string().optional(),
});

export type ConversationMessage = z.infer<typeof ConversationMessageSchema>;

export const ConversationSchema = z.object({
    id: z.string(),
    title: z.string(),
    model: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    messages: z.array(ConversationMessageSchema),
    tokenCount: z.number().optional(),
});

export type Conversation = z.infer<typeof ConversationSchema>;

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

export type PromptInfo = {
    id: string;
    name: string;
    description: string;
    path: string;
};

export const PromptStateSchema = z
    .object({
        activePrompt: z.string().optional(),
    })
    .catchall(z.unknown());

export type PromptState = z.infer<typeof PromptStateSchema>;
