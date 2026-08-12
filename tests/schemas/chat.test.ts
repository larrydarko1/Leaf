import { describe, it, expect } from 'vitest';
import { ChatMessageSchema } from '@/schemas/chat';

describe('ChatMessageSchema', () => {
    it.each(['user', 'assistant', 'system'] as const)('parses role "%s"', (role) => {
        const result = ChatMessageSchema.parse({ role, content: 'hello' });
        expect(result.role).toBe(role);
        expect(result.content).toBe('hello');
    });

    it('parses with thinking content', () => {
        const result = ChatMessageSchema.parse({ role: 'assistant', content: 'done', thinking: 'reasoning' });
        expect(result.thinking).toBe('reasoning');
    });

    it('rejects an invalid role', () => {
        expect(ChatMessageSchema.safeParse({ role: 'bot', content: 'hello' }).success).toBe(false);
    });

    it('rejects missing content', () => {
        expect(ChatMessageSchema.safeParse({ role: 'user' }).success).toBe(false);
    });
});
