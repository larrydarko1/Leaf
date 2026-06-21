import { describe, it, expect } from 'vitest';
import { AgentFileEditSchema, ChatMessageSchema } from '@/schemas/chat';

describe('AgentFileEditSchema', () => {
    it('parses with required fields only', () => {
        const result = AgentFileEditSchema.parse({
            filePath: '/src/foo.ts',
            newContent: 'const x = 1',
            status: 'pending',
        });
        expect(result.filePath).toBe('/src/foo.ts');
        expect(result.status).toBe('pending');
    });

    it('parses with all optional fields', () => {
        const result = AgentFileEditSchema.parse({
            filePath: '/src/foo.ts',
            newContent: 'const x = 1',
            editId: 'edit-1',
            originalContent: 'const x = 0',
            relativePath: 'src/foo.ts',
            isNewFile: true,
            status: 'approved',
            error: 'something went wrong',
        });
        expect(result.editId).toBe('edit-1');
        expect(result.isNewFile).toBe(true);
    });

    it.each(['pending', 'approved', 'rejected', 'error'] as const)('accepts status "%s"', (status) => {
        expect(() => AgentFileEditSchema.parse({ filePath: '/f', newContent: '', status })).not.toThrow();
    });

    it('rejects an invalid status value', () => {
        expect(AgentFileEditSchema.safeParse({ filePath: '/f', newContent: '', status: 'unknown' }).success).toBe(
            false,
        );
    });

    it('rejects missing required fields', () => {
        expect(AgentFileEditSchema.safeParse({ status: 'pending' }).success).toBe(false);
    });

    it('rejects wrong types', () => {
        expect(AgentFileEditSchema.safeParse({ filePath: 42, newContent: '', status: 'pending' }).success).toBe(false);
    });
});

describe('ChatMessageSchema', () => {
    it.each(['user', 'assistant', 'system'] as const)('parses role "%s"', (role) => {
        const result = ChatMessageSchema.parse({ role, content: 'hello' });
        expect(result.role).toBe(role);
        expect(result.content).toBe('hello');
    });

    it('parses with agentEdits', () => {
        const result = ChatMessageSchema.parse({
            role: 'assistant',
            content: 'done',
            agentEdits: [{ filePath: '/src/foo.ts', newContent: 'x', status: 'approved' }],
        });
        expect(result.agentEdits).toHaveLength(1);
    });

    it('rejects an invalid role', () => {
        expect(ChatMessageSchema.safeParse({ role: 'bot', content: 'hello' }).success).toBe(false);
    });

    it('rejects missing content', () => {
        expect(ChatMessageSchema.safeParse({ role: 'user' }).success).toBe(false);
    });
});
