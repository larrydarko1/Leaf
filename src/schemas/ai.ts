import { z } from 'zod';

export const AiModelInfoSchema = z.object({
    name: z.string(),
    path: z.string(),
    size: z.number(),
    sizeFormatted: z.string(),
    modified: z.string(),
});

export type AiModelInfo = z.infer<typeof AiModelInfoSchema>;

export const AiListModelsResultSchema = z.object({
    success: z.boolean(),
    models: z.array(AiModelInfoSchema),
    modelsDir: z.string(),
    error: z.string().optional(),
});

export type AiListModelsResult = z.infer<typeof AiListModelsResultSchema>;

export const AiLoadResultSchema = z.object({
    success: z.boolean(),
    modelName: z.string().optional(),
    error: z.string().optional(),
});

export type AiLoadResult = z.infer<typeof AiLoadResultSchema>;

export const AiChatResultSchema = z.object({
    success: z.boolean(),
    response: z.string().optional(),
    compacted: z.boolean().optional(),
    error: z.string().optional(),
});

export type AiChatResult = z.infer<typeof AiChatResultSchema>;

export const AiStatusSchema = z.object({
    isModelLoaded: z.boolean(),
    currentModelPath: z.string().nullable(),
    currentModelName: z.string().nullable(),
    isGenerating: z.boolean(),
    modelsDir: z.string(),
    contextTokens: z.number(),
    contextSize: z.number(),
});

export type AiStatus = z.infer<typeof AiStatusSchema>;

export const AiSimpleResultSchema = z.object({
    success: z.boolean(),
    error: z.string().optional(),
});

export type AiSimpleResult = z.infer<typeof AiSimpleResultSchema>;

// Conversation persistence types

export const ConversationMessageSchema = z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
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

export const ConversationMetaSchema = z.object({
    id: z.string(),
    title: z.string(),
    model: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
    messageCount: z.number(),
    tokenCount: z.number(),
});

export type ConversationMeta = z.infer<typeof ConversationMetaSchema>;

export const ConversationListResultSchema = z.object({
    success: z.boolean(),
    conversations: z.array(ConversationMetaSchema),
    error: z.string().optional(),
});

export type ConversationListResult = z.infer<typeof ConversationListResultSchema>;

export const ConversationCreateResultSchema = z.object({
    success: z.boolean(),
    conversation: ConversationSchema.optional(),
    error: z.string().optional(),
});

export type ConversationCreateResult = z.infer<typeof ConversationCreateResultSchema>;

export const ConversationLoadResultSchema = z.object({
    success: z.boolean(),
    conversation: ConversationSchema.optional(),
    error: z.string().optional(),
});

export type ConversationLoadResult = z.infer<typeof ConversationLoadResultSchema>;

// Agent mode types

export const AgentReadFileResultSchema = z.object({
    success: z.boolean(),
    content: z.string().optional(),
    filePath: z.string().optional(),
    error: z.string().optional(),
});

export type AgentReadFileResult = z.infer<typeof AgentReadFileResultSchema>;

export const AgentProposeEditResultSchema = z.object({
    success: z.boolean(),
    editId: z.string().optional(),
    filePath: z.string().optional(),
    relativePath: z.string().optional(),
    originalContent: z.string().optional(),
    newContent: z.string().optional(),
    isNewFile: z.boolean().optional(),
    error: z.string().optional(),
});

export type AgentProposeEditResult = z.infer<typeof AgentProposeEditResultSchema>;

export const EditRecordSchema = z.object({
    editId: z.string(),
    filePath: z.string(),
    relativePath: z.string(),
    backupPath: z.string(),
    originalContent: z.string(),
    newContent: z.string(),
    isNewFile: z.boolean(),
    timestamp: z.string(),
});

export type EditRecord = z.infer<typeof EditRecordSchema>;

export const AgentEditResultSchema = z.object({
    success: z.boolean(),
    error: z.string().optional(),
});

export type AgentEditResult = z.infer<typeof AgentEditResultSchema>;

export const AgentPendingEditSchema = z.object({
    editId: z.string(),
    filePath: z.string(),
    relativePath: z.string(),
    isNewFile: z.boolean(),
    timestamp: z.string(),
});

export type AgentPendingEdit = z.infer<typeof AgentPendingEditSchema>;

export const AgentPendingEditsResultSchema = z.object({
    success: z.boolean(),
    edits: z.array(AgentPendingEditSchema),
});

export type AgentPendingEditsResult = z.infer<typeof AgentPendingEditsResultSchema>;

export const PromptInfoSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    path: z.string(),
});

export type PromptInfo = z.infer<typeof PromptInfoSchema>;

export const PromptStateSchema = z
    .object({
        activePrompt: z.string().optional(),
    })
    .catchall(z.unknown());

export type PromptState = z.infer<typeof PromptStateSchema>;
