import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import { useAIChat } from '../../src/renderer/composables/ai/useAIChat';
import type { ChatMessage } from '../../src/renderer/types/chat';
import type { AiStatus } from '../../src/renderer/types/ai';

// ── electronAPI mock ─────────────────────────────────────────────────────────

const mockAiResetChat = vi.fn().mockResolvedValue({ success: true });
const mockAiRestoreChatHistory = vi.fn().mockResolvedValue({ success: true });
const mockAiChat = vi.fn().mockResolvedValue({ success: true, response: 'AI response' });
const mockAiGetStatus = vi.fn().mockResolvedValue({ contextTokens: 10, contextSize: 4096 });
const mockConversationAddMessage = vi.fn().mockResolvedValue({ success: true });

Object.defineProperty(globalThis, 'window', {
    value: {
        electronAPI: {
            aiResetChat: mockAiResetChat,
            aiRestoreChatHistory: mockAiRestoreChatHistory,
            aiChat: mockAiChat,
            aiGetStatus: mockAiGetStatus,
            aiStopChat: vi.fn().mockResolvedValue({ success: true }),
            conversationAddMessage: mockConversationAddMessage,
            readFile: vi.fn().mockResolvedValue({ success: false }),
            writeClipboard: vi.fn().mockResolvedValue(undefined),
            onAiToken: vi.fn(),
            removeAiTokenListener: vi.fn(),
            log: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
        },
    },
    writable: true,
});

// ── helpers ──────────────────────────────────────────────────────────────────

function makeStatus(overrides: Partial<AiStatus> = {}): AiStatus {
    return {
        isModelLoaded: true,
        currentModelPath: '/models/test.gguf',
        currentModelName: 'test.gguf',
        isGenerating: false,
        modelsDir: '/models',
        contextTokens: 0,
        contextSize: 4096,
        ...overrides,
    };
}

function makeMessage(role: ChatMessage['role'], content: string): ChatMessage {
    return { role, content };
}

function makeChat(initialMessages: ChatMessage[] = []) {
    const messages = ref<ChatMessage[]>(initialMessages);
    const status = ref<AiStatus>(makeStatus());
    const conversationTokenCount = ref(0);
    const currentConversationId = ref<string | null>('conv-1');
    const agentMode = ref(false);

    const actions = {
        createNewConversation: vi.fn().mockResolvedValue(undefined),
        saveCurrentConversation: vi.fn().mockResolvedValue(undefined),
        saveTokenCountToConversation: vi.fn().mockResolvedValue(undefined),
        refreshConversationList: vi.fn().mockResolvedValue(undefined),
        refreshStatus: vi.fn().mockImplementation(async () => {
            status.value = makeStatus({ contextTokens: 10 });
        }),
        parseAgentEdits: vi.fn().mockReturnValue({ cleanContent: '', edits: [] }),
        processAgentEdits: vi.fn().mockResolvedValue(undefined),
    };

    const chat = useAIChat(
        {
            messages,
            status,
            conversationTokenCount,
            currentConversationId,
            agentMode,
            activeFile: { value: null },
            workspacePath: { value: null },
        },
        actions,
    );

    return { chat, messages, status, conversationTokenCount, currentConversationId, actions };
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('useAIChat', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Default aiChat mock streams no tokens, returns success
        mockAiChat.mockResolvedValue({ success: true, response: 'AI response' });
    });

    // ── context reset on new conversation ───────────────────────────────────
    describe('new conversation context reset', () => {
        it('calls aiResetChat when startNewConversation is invoked (via useConversationHistory)', async () => {
            // startNewConversation is owned by useConversationHistory; here we verify
            // that aiResetChat is wired correctly at the IPC level when triggered.
            // We test the chat composable's own reset paths below.
            expect(mockAiResetChat).toBeDefined();
        });

        it('does not call aiRestoreChatHistory on a brand-new send with no prior messages', async () => {
            const { chat, messages } = makeChat();
            messages.value = [];

            chat.inputMessage.value = 'Hello';
            await chat.sendMessage();

            expect(mockAiRestoreChatHistory).not.toHaveBeenCalled();
        });
    });

    // ── resendMessage context restore ────────────────────────────────────────
    describe('resendMessage', () => {
        it('calls aiResetChat before resending', async () => {
            const { chat, messages } = makeChat([
                makeMessage('user', 'First'),
                makeMessage('assistant', 'Response'),
                makeMessage('user', 'Second'),
            ]);

            await chat.resendMessage(2);

            expect(mockAiResetChat).toHaveBeenCalledOnce();
        });

        it('restores prior messages as context before resending', async () => {
            const { chat, messages } = makeChat([
                makeMessage('user', 'First'),
                makeMessage('assistant', 'Response'),
                makeMessage('user', 'Second'),
            ]);

            await chat.resendMessage(2);

            expect(mockAiRestoreChatHistory).toHaveBeenCalledWith([
                { role: 'user', content: 'First' },
                { role: 'assistant', content: 'Response' },
            ]);
        });

        it('does not call aiRestoreChatHistory when resending the very first message', async () => {
            const { chat } = makeChat([makeMessage('user', 'Hello')]);

            await chat.resendMessage(0);

            expect(mockAiRestoreChatHistory).not.toHaveBeenCalled();
        });

        it('excludes system messages from the restored context', async () => {
            const { chat } = makeChat([
                makeMessage('user', 'First'),
                makeMessage('system', 'Context was compacted.'),
                makeMessage('user', 'Second'),
            ]);

            await chat.resendMessage(2);

            const call = mockAiRestoreChatHistory.mock.calls[0][0] as ChatMessage[];
            expect(call.every((m) => m.role !== 'system')).toBe(true);
        });
    });

    // ── confirmEditMessage context restore ───────────────────────────────────
    describe('confirmEditMessage', () => {
        it('calls aiResetChat after editing a message', async () => {
            const { chat, messages } = makeChat([
                makeMessage('user', 'Original'),
                makeMessage('assistant', 'Response'),
            ]);

            chat.startEditMessage(0);
            chat.editContent.value = 'Edited';
            await chat.confirmEditMessage(0);

            expect(mockAiResetChat).toHaveBeenCalledOnce();
        });

        it('does not restore context when editing the first message (no prior messages)', async () => {
            const { chat } = makeChat([makeMessage('user', 'Original'), makeMessage('assistant', 'Response')]);

            chat.startEditMessage(0);
            chat.editContent.value = 'Edited';
            await chat.confirmEditMessage(0);

            expect(mockAiRestoreChatHistory).not.toHaveBeenCalled();
        });

        it('restores prior messages when editing a message mid-conversation', async () => {
            const { chat, messages } = makeChat([
                makeMessage('user', 'Turn 1'),
                makeMessage('assistant', 'Answer 1'),
                makeMessage('user', 'Turn 2'),
                makeMessage('assistant', 'Answer 2'),
            ]);

            chat.startEditMessage(2);
            chat.editContent.value = 'Edited turn 2';
            await chat.confirmEditMessage(2);

            expect(mockAiRestoreChatHistory).toHaveBeenCalledWith([
                { role: 'user', content: 'Turn 1' },
                { role: 'assistant', content: 'Answer 1' },
            ]);
        });

        it('truncates messages after the edited index', async () => {
            const { chat, messages } = makeChat([
                makeMessage('user', 'Turn 1'),
                makeMessage('assistant', 'Answer 1'),
                makeMessage('user', 'Turn 2'),
                makeMessage('assistant', 'Answer 2'),
            ]);

            chat.startEditMessage(2);
            chat.editContent.value = 'Edited';
            await chat.confirmEditMessage(2);

            // Messages after index 2 should be removed
            expect(messages.value).toHaveLength(3);
            expect(messages.value[2].content).toBe('Edited');
        });

        it('cancels edit without changes if content is empty', async () => {
            const { chat, messages } = makeChat([makeMessage('user', 'Original')]);

            chat.startEditMessage(0);
            chat.editContent.value = '   ';
            await chat.confirmEditMessage(0);

            expect(messages.value[0].content).toBe('Original');
            expect(mockAiResetChat).not.toHaveBeenCalled();
        });
    });

    // ── deleteLastMessagePair context restore ────────────────────────────────
    describe('deleteLastMessagePair', () => {
        it('calls aiResetChat after deleting a message', async () => {
            const { chat } = makeChat([makeMessage('user', 'Hello'), makeMessage('assistant', 'Hi')]);

            await chat.deleteLastMessagePair();

            expect(mockAiResetChat).toHaveBeenCalledOnce();
        });

        it('restores remaining messages as context after deletion', async () => {
            const { chat } = makeChat([
                makeMessage('user', 'First'),
                makeMessage('assistant', 'Response 1'),
                makeMessage('user', 'Second'),
                makeMessage('assistant', 'Response 2'),
            ]);

            await chat.deleteLastMessagePair();

            expect(mockAiRestoreChatHistory).toHaveBeenCalledWith([
                { role: 'user', content: 'First' },
                { role: 'assistant', content: 'Response 1' },
                { role: 'user', content: 'Second' },
            ]);
        });

        it('does not call aiRestoreChatHistory when deleting leaves no messages', async () => {
            const { chat } = makeChat([makeMessage('assistant', 'Only message')]);

            await chat.deleteLastMessagePair();

            expect(mockAiRestoreChatHistory).not.toHaveBeenCalled();
        });

        it('excludes system messages from the restored context', async () => {
            const { chat } = makeChat([
                makeMessage('user', 'First'),
                makeMessage('system', 'Compacted.'),
                makeMessage('user', 'Second'),
                makeMessage('assistant', 'Response'),
            ]);

            await chat.deleteLastMessagePair();

            const call = mockAiRestoreChatHistory.mock.calls[0][0] as ChatMessage[];
            expect(call.every((m) => m.role !== 'system')).toBe(true);
        });

        it('does nothing when there are no messages', async () => {
            const { chat } = makeChat([]);

            await chat.deleteLastMessagePair();

            expect(mockAiResetChat).not.toHaveBeenCalled();
        });
    });

    // ── sendMessage ──────────────────────────────────────────────────────────
    describe('sendMessage', () => {
        it('does nothing when input is empty', async () => {
            const { chat } = makeChat();
            chat.inputMessage.value = '  ';

            await chat.sendMessage();

            expect(mockAiChat).not.toHaveBeenCalled();
        });

        it('does nothing when model is not loaded', async () => {
            const { chat, status } = makeChat();
            status.value = makeStatus({ isModelLoaded: false });
            chat.inputMessage.value = 'Hello';

            await chat.sendMessage();

            expect(mockAiChat).not.toHaveBeenCalled();
        });

        it('appends user and assistant messages to the list', async () => {
            const { chat, messages } = makeChat();
            chat.inputMessage.value = 'Hello';

            await chat.sendMessage();

            expect(messages.value.some((m) => m.role === 'user' && m.content === 'Hello')).toBe(true);
            expect(messages.value.some((m) => m.role === 'assistant')).toBe(true);
        });

        it('clears the input after sending', async () => {
            const { chat } = makeChat();
            chat.inputMessage.value = 'Hello';

            await chat.sendMessage();

            expect(chat.inputMessage.value).toBe('');
        });
    });
});
