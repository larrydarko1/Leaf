import { z } from 'zod';

export const AgentFileEditSchema = z.object({
    filePath: z.string(),
    newContent: z.string(),
    editId: z.string().optional(),
    originalContent: z.string().optional(),
    relativePath: z.string().optional(),
    isNewFile: z.boolean().optional(),
    status: z.enum(['pending', 'approved', 'rejected', 'error']),
    error: z.string().optional(),
});

export type AgentFileEdit = z.infer<typeof AgentFileEditSchema>;

export const ChatMessageSchema = z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    agentEdits: z.array(AgentFileEditSchema).optional(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
