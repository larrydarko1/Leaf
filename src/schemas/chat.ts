import { z } from 'zod';

export const ChatMessageSchema = z.object({
    role: z.enum(['user', 'assistant', 'system']),
    content: z.string(),
    thinking: z.string().optional(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
