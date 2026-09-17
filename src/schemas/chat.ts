/** Chat message shape. A plain type: nothing validates it at runtime. */

export type ChatMessage = {
    role: 'user' | 'assistant' | 'system';
    content: string;
    thinking?: string;
};
