import { describe, it, expect } from 'vitest';
import {
    AiModelInfoSchema,
    AiListModelsResultSchema,
    AiLoadResultSchema,
    AiChatResultSchema,
    AiStatusSchema,
    AiSimpleResultSchema,
    ConversationMessageSchema,
    ConversationSchema,
    ConversationMetaSchema,
    ConversationListResultSchema,
    ConversationCreateResultSchema,
    ConversationLoadResultSchema,
    AgentReadFileResultSchema,
    AgentProposeEditResultSchema,
    EditRecordSchema,
    AgentEditResultSchema,
    AgentPendingEditSchema,
    AgentPendingEditsResultSchema,
    PromptInfoSchema,
    PromptStateSchema,
} from '@/schemas/ai';

const validModelInfo = {
    name: 'llama-7b.gguf',
    path: '/models/llama-7b.gguf',
    size: 4000000000,
    sizeFormatted: '4 GB',
    modified: '2024-01-01T00:00:00Z',
};

const validConversationMessage = {
    role: 'user' as const,
    content: 'Hello',
};

const validConversation = {
    id: 'conv-1',
    title: 'Test chat',
    model: 'llama-7b',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    messages: [validConversationMessage],
};

describe('AiModelInfoSchema', () => {
    it('parses valid model info', () => {
        const result = AiModelInfoSchema.parse(validModelInfo);
        expect(result.name).toBe('llama-7b.gguf');
    });

    it('rejects missing path', () => {
        const { path: _path, ...rest } = validModelInfo;
        expect(AiModelInfoSchema.safeParse(rest).success).toBe(false);
    });

    it('rejects non-number size', () => {
        expect(AiModelInfoSchema.safeParse({ ...validModelInfo, size: '4GB' }).success).toBe(false);
    });
});

describe('AiListModelsResultSchema', () => {
    it('parses success result', () => {
        const result = AiListModelsResultSchema.parse({
            success: true,
            models: [validModelInfo],
            modelsDir: '/models',
        });
        expect(result.models).toHaveLength(1);
    });

    it('parses error result', () => {
        const result = AiListModelsResultSchema.parse({
            success: false,
            models: [],
            modelsDir: '/models',
            error: 'dir not found',
        });
        expect(result.error).toBe('dir not found');
    });

    it('rejects missing modelsDir', () => {
        expect(AiListModelsResultSchema.safeParse({ success: true, models: [] }).success).toBe(false);
    });
});

describe('AiLoadResultSchema', () => {
    it('parses success', () => {
        const result = AiLoadResultSchema.parse({ success: true, modelName: 'llama-7b' });
        expect(result.modelName).toBe('llama-7b');
    });

    it('parses failure without optional fields', () => {
        expect(() => AiLoadResultSchema.parse({ success: false })).not.toThrow();
    });
});

describe('AiChatResultSchema', () => {
    it('parses success with response', () => {
        const result = AiChatResultSchema.parse({ success: true, response: 'Hi there', compacted: false });
        expect(result.response).toBe('Hi there');
        expect(result.compacted).toBe(false);
    });

    it('parses failure with error', () => {
        const result = AiChatResultSchema.parse({ success: false, error: 'model not loaded' });
        expect(result.error).toBe('model not loaded');
    });
});

describe('AiStatusSchema', () => {
    it('parses full status', () => {
        const result = AiStatusSchema.parse({
            isModelLoaded: true,
            currentModelPath: '/models/llama.gguf',
            currentModelName: 'llama',
            isGenerating: false,
            modelsDir: '/models',
            contextTokens: 100,
            contextSize: 4096,
        });
        expect(result.isModelLoaded).toBe(true);
        expect(result.currentModelPath).toBe('/models/llama.gguf');
    });

    it('accepts null currentModelPath and currentModelName', () => {
        const result = AiStatusSchema.parse({
            isModelLoaded: false,
            currentModelPath: null,
            currentModelName: null,
            isGenerating: false,
            modelsDir: '/models',
            contextTokens: 0,
            contextSize: 4096,
        });
        expect(result.currentModelPath).toBeNull();
    });

    it('rejects missing contextSize', () => {
        expect(
            AiStatusSchema.safeParse({
                isModelLoaded: false,
                currentModelPath: null,
                currentModelName: null,
                isGenerating: false,
                modelsDir: '/models',
                contextTokens: 0,
            }).success,
        ).toBe(false);
    });
});

describe('AiSimpleResultSchema', () => {
    it('parses success', () => {
        expect(AiSimpleResultSchema.parse({ success: true }).success).toBe(true);
    });

    it('parses failure with error', () => {
        const result = AiSimpleResultSchema.parse({ success: false, error: 'oops' });
        expect(result.error).toBe('oops');
    });
});

describe('ConversationMessageSchema', () => {
    it.each(['user', 'assistant'] as const)('accepts role "%s"', (role) => {
        const result = ConversationMessageSchema.parse({ role, content: 'hi' });
        expect(result.role).toBe(role);
    });

    it('parses with optional timestamp', () => {
        const result = ConversationMessageSchema.parse({
            role: 'user',
            content: 'hi',
            timestamp: '2024-01-01T00:00:00Z',
        });
        expect(result.timestamp).toBe('2024-01-01T00:00:00Z');
    });

    it('rejects invalid role', () => {
        expect(ConversationMessageSchema.safeParse({ role: 'system', content: 'hi' }).success).toBe(false);
    });

    it('rejects missing content', () => {
        expect(ConversationMessageSchema.safeParse({ role: 'user' }).success).toBe(false);
    });
});

describe('ConversationSchema', () => {
    it('parses a valid conversation', () => {
        const result = ConversationSchema.parse(validConversation);
        expect(result.id).toBe('conv-1');
        expect(result.messages).toHaveLength(1);
    });

    it('parses with optional tokenCount', () => {
        const result = ConversationSchema.parse({ ...validConversation, tokenCount: 250 });
        expect(result.tokenCount).toBe(250);
    });

    it('rejects missing id', () => {
        const { id: _id, ...rest } = validConversation;
        expect(ConversationSchema.safeParse(rest).success).toBe(false);
    });
});

describe('ConversationMetaSchema', () => {
    it('parses valid meta', () => {
        const result = ConversationMetaSchema.parse({
            id: 'conv-1',
            title: 'Test',
            model: 'llama',
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
            messageCount: 5,
            tokenCount: 300,
        });
        expect(result.messageCount).toBe(5);
    });

    it('rejects non-number messageCount', () => {
        expect(
            ConversationMetaSchema.safeParse({
                id: 'c',
                title: 't',
                model: 'm',
                createdAt: '',
                updatedAt: '',
                messageCount: 'five',
                tokenCount: 0,
            }).success,
        ).toBe(false);
    });
});

describe('ConversationListResultSchema', () => {
    it('parses success with empty list', () => {
        const result = ConversationListResultSchema.parse({ success: true, conversations: [] });
        expect(result.conversations).toHaveLength(0);
    });

    it('rejects missing conversations array', () => {
        expect(ConversationListResultSchema.safeParse({ success: true }).success).toBe(false);
    });
});

describe('ConversationCreateResultSchema', () => {
    it('parses success with conversation', () => {
        const result = ConversationCreateResultSchema.parse({
            success: true,
            conversation: validConversation,
        });
        expect(result.conversation?.id).toBe('conv-1');
    });

    it('parses failure without conversation', () => {
        expect(() => ConversationCreateResultSchema.parse({ success: false, error: 'err' })).not.toThrow();
    });
});

describe('ConversationLoadResultSchema', () => {
    it('parses success', () => {
        const result = ConversationLoadResultSchema.parse({
            success: true,
            conversation: validConversation,
        });
        expect(result.conversation?.title).toBe('Test chat');
    });
});

describe('AgentReadFileResultSchema', () => {
    it('parses success', () => {
        const result = AgentReadFileResultSchema.parse({
            success: true,
            content: 'file contents',
            filePath: '/src/foo.ts',
        });
        expect(result.content).toBe('file contents');
    });

    it('parses failure', () => {
        const result = AgentReadFileResultSchema.parse({ success: false, error: 'not found' });
        expect(result.error).toBe('not found');
    });
});

describe('AgentProposeEditResultSchema', () => {
    it('parses full result', () => {
        const result = AgentProposeEditResultSchema.parse({
            success: true,
            editId: 'e1',
            filePath: '/src/foo.ts',
            relativePath: 'src/foo.ts',
            originalContent: 'old',
            newContent: 'new',
            isNewFile: false,
        });
        expect(result.editId).toBe('e1');
    });

    it('parses minimal failure', () => {
        expect(() => AgentProposeEditResultSchema.parse({ success: false, error: 'err' })).not.toThrow();
    });
});

describe('EditRecordSchema', () => {
    it('parses a complete edit record', () => {
        const result = EditRecordSchema.parse({
            editId: 'e1',
            filePath: '/src/foo.ts',
            relativePath: 'src/foo.ts',
            backupPath: '/tmp/foo.ts.bak',
            originalContent: 'old',
            newContent: 'new',
            isNewFile: false,
            timestamp: '2024-01-01T00:00:00Z',
        });
        expect(result.backupPath).toBe('/tmp/foo.ts.bak');
    });

    it('rejects missing backupPath', () => {
        expect(
            EditRecordSchema.safeParse({
                editId: 'e1',
                filePath: '/f',
                relativePath: 'f',
                originalContent: '',
                newContent: '',
                isNewFile: false,
                timestamp: '',
            }).success,
        ).toBe(false);
    });
});

describe('AgentEditResultSchema', () => {
    it('parses success', () => {
        expect(AgentEditResultSchema.parse({ success: true }).success).toBe(true);
    });

    it('parses failure with error', () => {
        const result = AgentEditResultSchema.parse({ success: false, error: 'conflict' });
        expect(result.error).toBe('conflict');
    });
});

describe('AgentPendingEditSchema', () => {
    it('parses valid pending edit', () => {
        const result = AgentPendingEditSchema.parse({
            editId: 'e1',
            filePath: '/src/foo.ts',
            relativePath: 'src/foo.ts',
            isNewFile: true,
            timestamp: '2024-01-01T00:00:00Z',
        });
        expect(result.isNewFile).toBe(true);
    });
});

describe('AgentPendingEditsResultSchema', () => {
    it('parses with empty edits', () => {
        const result = AgentPendingEditsResultSchema.parse({ success: true, edits: [] });
        expect(result.edits).toHaveLength(0);
    });

    it('rejects missing edits array', () => {
        expect(AgentPendingEditsResultSchema.safeParse({ success: true }).success).toBe(false);
    });
});

describe('PromptInfoSchema', () => {
    it('parses valid prompt info', () => {
        const result = PromptInfoSchema.parse({
            id: 'p1',
            name: 'Code review',
            description: 'Reviews code',
            path: '/prompts/code-review.md',
        });
        expect(result.name).toBe('Code review');
    });
});

describe('PromptStateSchema', () => {
    it('parses empty object', () => {
        expect(() => PromptStateSchema.parse({})).not.toThrow();
    });

    it('parses with activePrompt', () => {
        const result = PromptStateSchema.parse({ activePrompt: 'p1' });
        expect(result.activePrompt).toBe('p1');
    });

    it('allows additional unknown keys via catchall', () => {
        const result = PromptStateSchema.parse({ activePrompt: 'p1', customKey: 'value' });
        expect(result['customKey']).toBe('value');
    });
});
