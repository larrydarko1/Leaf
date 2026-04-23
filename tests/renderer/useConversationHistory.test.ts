import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import { useConversationHistory } from '../../src/renderer/composables/ai/useConversationHistory';
import type { AiStatus, Conversation } from '../../src/renderer/types/ai';
import type { ChatMessage } from '../../src/renderer/types/chat';

// ── electronAPI mock ─────────────────────────────────────────────────────────

const mockConversationList = vi.fn();
const mockConversationCreate = vi.fn();
const mockConversationLoad = vi.fn();
const mockConversationSave = vi.fn();
const mockConversationDelete = vi.fn();
const mockConversationRename = vi.fn();
const mockAiResetChat = vi.fn().mockResolvedValue({ success: true });
const mockAiRestoreChatHistory = vi.fn().mockResolvedValue({ success: true });

Object.defineProperty(globalThis, 'window', {
    value: {
        electronAPI: {
            conversationList: mockConversationList,
            conversationCreate: mockConversationCreate,
            conversationLoad: mockConversationLoad,
            conversationSave: mockConversationSave,
            conversationDelete: mockConversationDelete,
            conversationRename: mockConversationRename,
            aiResetChat: mockAiResetChat,
            aiRestoreChatHistory: mockAiRestoreChatHistory,
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

function makeConversation(overrides: Partial<Conversation> = {}): Conversation {
    return {
        id: 'conv-1',
        title: 'Test Conversation',
        model: 'test.gguf',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages: [],
        tokenCount: 0,
        ...overrides,
    };
}

function makeHistory(initialMessages: ChatMessage[] = [], statusOverrides: Partial<AiStatus> = {}) {
    const status = ref<AiStatus>(makeStatus(statusOverrides));
    const lastUsedModelName = ref<string | null>(null);
    const messages = ref<ChatMessage[]>(initialMessages);
    const history = useConversationHistory(status, lastUsedModelName, messages);
    return { history, status, lastUsedModelName, messages };
}

// ── tests ────────────────────────────────────────────────────────────────────

describe('useConversationHistory', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockConversationList.mockResolvedValue({ success: true, conversations: [] });
        mockConversationCreate.mockResolvedValue({ success: true, conversation: makeConversation() });
        mockConversationLoad.mockResolvedValue({ success: true, conversation: makeConversation() });
        mockConversationSave.mockResolvedValue({ success: true });
        mockConversationDelete.mockResolvedValue({ success: true });
        mockConversationRename.mockResolvedValue({ success: true });
    });

    // ── initial state ────────────────────────────────────────────────────────
    describe('initial state', () => {
        it('starts with showHistory false', () => {
            const { history } = makeHistory();
            expect(history.showHistory.value).toBe(false);
        });

        it('starts with no currentConversationId', () => {
            const { history } = makeHistory();
            expect(history.currentConversationId.value).toBeNull();
        });

        it('starts with zero token count', () => {
            const { history } = makeHistory();
            expect(history.conversationTokenCount.value).toBe(0);
        });
    });

    // ── toggleHistory / openHistory ──────────────────────────────────────────
    describe('toggleHistory', () => {
        it('shows history when toggled from closed', async () => {
            const { history } = makeHistory();
            history.toggleHistory();
            expect(history.showHistory.value).toBe(true);
        });

        it('hides history when toggled from open', () => {
            const { history } = makeHistory();
            history.toggleHistory(); // open
            history.toggleHistory(); // close
            expect(history.showHistory.value).toBe(false);
        });

        it('calls refreshConversationList when opening', async () => {
            const { history } = makeHistory();
            history.toggleHistory();
            expect(mockConversationList).toHaveBeenCalledOnce();
        });

        it('does not call refreshConversationList when closing', () => {
            const { history } = makeHistory();
            history.toggleHistory(); // open — triggers refresh
            vi.clearAllMocks();
            history.toggleHistory(); // close — should not trigger refresh
            expect(mockConversationList).not.toHaveBeenCalled();
        });
    });

    // ── startNewConversation ─────────────────────────────────────────────────
    describe('startNewConversation', () => {
        it('calls aiResetChat', async () => {
            const { history } = makeHistory();
            await history.startNewConversation();
            expect(mockAiResetChat).toHaveBeenCalledOnce();
        });

        it('clears messages', async () => {
            const { history, messages } = makeHistory([
                { role: 'user', content: 'Hello' },
                { role: 'assistant', content: 'Hi' },
            ]);
            await history.startNewConversation();
            expect(messages.value).toHaveLength(0);
        });

        it('clears currentConversationId', async () => {
            const { history } = makeHistory();
            history.currentConversationId.value = 'conv-123';
            await history.startNewConversation();
            expect(history.currentConversationId.value).toBeNull();
        });

        it('resets token count', async () => {
            const { history } = makeHistory();
            history.conversationTokenCount.value = 500;
            await history.startNewConversation();
            expect(history.conversationTokenCount.value).toBe(0);
        });

        it('hides the history panel', async () => {
            const { history } = makeHistory();
            history.showHistory.value = true;
            await history.startNewConversation();
            expect(history.showHistory.value).toBe(false);
        });

        it('saves current conversation before clearing when one exists', async () => {
            const { history } = makeHistory([{ role: 'user', content: 'Hello' }]);
            history.currentConversationId.value = 'conv-abc';
            await history.startNewConversation();
            expect(mockConversationLoad).toHaveBeenCalledWith('conv-abc');
            expect(mockConversationSave).toHaveBeenCalledOnce();
        });
    });

    // ── createNewConversation ────────────────────────────────────────────────
    describe('createNewConversation', () => {
        it('calls conversationCreate with the current model name', async () => {
            const { history, status } = makeHistory();
            status.value.currentModelName = 'my-model.gguf';
            await history.createNewConversation();
            expect(mockConversationCreate).toHaveBeenCalledWith('my-model.gguf');
        });

        it('falls back to "unknown" when no model is loaded', async () => {
            const { history, status } = makeHistory();
            status.value.currentModelName = null;
            await history.createNewConversation();
            expect(mockConversationCreate).toHaveBeenCalledWith('unknown');
        });

        it('sets currentConversationId from the created conversation', async () => {
            const { history } = makeHistory();
            mockConversationCreate.mockResolvedValue({
                success: true,
                conversation: makeConversation({ id: 'new-conv-id' }),
            });
            await history.createNewConversation();
            expect(history.currentConversationId.value).toBe('new-conv-id');
        });

        it('does not set id when creation fails', async () => {
            const { history } = makeHistory();
            mockConversationCreate.mockResolvedValue({ success: false, error: 'DB error' });
            await history.createNewConversation();
            expect(history.currentConversationId.value).toBeNull();
        });
    });

    // ── loadConversation ─────────────────────────────────────────────────────
    describe('loadConversation', () => {
        it('loads messages from the conversation', async () => {
            const { history, messages } = makeHistory();
            mockConversationLoad.mockResolvedValue({
                success: true,
                conversation: makeConversation({
                    id: 'conv-2',
                    messages: [
                        { role: 'user', content: 'Hello', timestamp: new Date().toISOString() },
                        { role: 'assistant', content: 'Hi there', timestamp: new Date().toISOString() },
                    ],
                }),
            });
            await history.loadConversation('conv-2');
            expect(messages.value).toHaveLength(2);
            expect(messages.value[0].content).toBe('Hello');
            expect(messages.value[1].content).toBe('Hi there');
        });

        it('sets currentConversationId', async () => {
            const { history } = makeHistory();
            mockConversationLoad.mockResolvedValue({
                success: true,
                conversation: makeConversation({ id: 'conv-xyz' }),
            });
            await history.loadConversation('conv-xyz');
            expect(history.currentConversationId.value).toBe('conv-xyz');
        });

        it('sets lastUsedModelName from conversation model', async () => {
            const { history, lastUsedModelName } = makeHistory();
            mockConversationLoad.mockResolvedValue({
                success: true,
                conversation: makeConversation({ model: 'llama-3.gguf' }),
            });
            await history.loadConversation('conv-1');
            expect(lastUsedModelName.value).toBe('llama-3.gguf');
        });

        it('restores token count from conversation', async () => {
            const { history } = makeHistory();
            mockConversationLoad.mockResolvedValue({
                success: true,
                conversation: makeConversation({ tokenCount: 1234 }),
            });
            await history.loadConversation('conv-1');
            expect(history.conversationTokenCount.value).toBe(1234);
        });

        it('calls aiResetChat when model is loaded', async () => {
            const { history } = makeHistory([], { isModelLoaded: true });
            await history.loadConversation('conv-1');
            expect(mockAiResetChat).toHaveBeenCalledOnce();
        });

        it('does not call aiResetChat when model is not loaded', async () => {
            const { history } = makeHistory([], { isModelLoaded: false });
            await history.loadConversation('conv-1');
            expect(mockAiResetChat).not.toHaveBeenCalled();
        });

        it('calls aiRestoreChatHistory when model is loaded and messages exist', async () => {
            const { history } = makeHistory([], { isModelLoaded: true });
            mockConversationLoad.mockResolvedValue({
                success: true,
                conversation: makeConversation({
                    messages: [
                        { role: 'user', content: 'Hey', timestamp: new Date().toISOString() },
                        { role: 'assistant', content: 'Yo', timestamp: new Date().toISOString() },
                    ],
                }),
            });
            await history.loadConversation('conv-1');
            expect(mockAiRestoreChatHistory).toHaveBeenCalledWith([
                { role: 'user', content: 'Hey' },
                { role: 'assistant', content: 'Yo' },
            ]);
        });

        it('does not call aiRestoreChatHistory when model is not loaded', async () => {
            const { history } = makeHistory([], { isModelLoaded: false });
            mockConversationLoad.mockResolvedValue({
                success: true,
                conversation: makeConversation({
                    messages: [{ role: 'user', content: 'Hey', timestamp: new Date().toISOString() }],
                }),
            });
            await history.loadConversation('conv-1');
            expect(mockAiRestoreChatHistory).not.toHaveBeenCalled();
        });

        it('hides the history panel after loading', async () => {
            const { history } = makeHistory();
            history.showHistory.value = true;
            await history.loadConversation('conv-1');
            expect(history.showHistory.value).toBe(false);
        });
    });

    // ── deleteConversation ───────────────────────────────────────────────────
    describe('deleteConversation', () => {
        it('calls conversationDelete with the id', async () => {
            const { history } = makeHistory();
            await history.deleteConversation('conv-99');
            expect(mockConversationDelete).toHaveBeenCalledWith('conv-99');
        });

        it('clears state when deleting the active conversation', async () => {
            const { history, messages } = makeHistory([{ role: 'user', content: 'Hello' }]);
            history.currentConversationId.value = 'conv-active';
            history.conversationTokenCount.value = 200;
            await history.deleteConversation('conv-active');
            expect(messages.value).toHaveLength(0);
            expect(history.currentConversationId.value).toBeNull();
            expect(history.conversationTokenCount.value).toBe(0);
        });

        it('calls aiResetChat when deleting the active conversation', async () => {
            const { history } = makeHistory();
            history.currentConversationId.value = 'conv-active';
            await history.deleteConversation('conv-active');
            expect(mockAiResetChat).toHaveBeenCalledOnce();
        });

        it('does not clear state when deleting a different conversation', async () => {
            const { history, messages } = makeHistory([{ role: 'user', content: 'Hello' }]);
            history.currentConversationId.value = 'conv-active';
            await history.deleteConversation('conv-other');
            expect(messages.value).toHaveLength(1);
            expect(history.currentConversationId.value).toBe('conv-active');
        });

        it('refreshes conversation list after deletion', async () => {
            const { history } = makeHistory();
            await history.deleteConversation('conv-1');
            expect(mockConversationList).toHaveBeenCalledOnce();
        });
    });

    // ── saveCurrentConversation ──────────────────────────────────────────────
    describe('saveCurrentConversation', () => {
        it('does nothing when there is no active conversation', async () => {
            const { history } = makeHistory();
            history.currentConversationId.value = null;
            await history.saveCurrentConversation();
            expect(mockConversationLoad).not.toHaveBeenCalled();
        });

        it('saves messages excluding system messages', async () => {
            const { history } = makeHistory([
                { role: 'user', content: 'Hello' },
                { role: 'system', content: 'Compacted.' },
                { role: 'assistant', content: 'Hi' },
            ]);
            history.currentConversationId.value = 'conv-save';
            await history.saveCurrentConversation();

            const saved = mockConversationSave.mock.calls[0][0] as Conversation;
            expect(saved.messages).toHaveLength(2);
            expect(saved.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
        });

        it('saves the current token count', async () => {
            const { history } = makeHistory([{ role: 'user', content: 'Hello' }]);
            history.currentConversationId.value = 'conv-save';
            history.conversationTokenCount.value = 777;
            await history.saveCurrentConversation();

            const saved = mockConversationSave.mock.calls[0][0] as Conversation;
            expect(saved.tokenCount).toBe(777);
        });
    });

    // ── rename ───────────────────────────────────────────────────────────────
    describe('confirmRename', () => {
        it('calls conversationRename with trimmed value', async () => {
            const { history } = makeHistory();
            history.renameValue.value = '  New Title  ';
            await history.confirmRename('conv-1');
            expect(mockConversationRename).toHaveBeenCalledWith('conv-1', 'New Title');
        });

        it('cancels rename without calling API when value is empty', async () => {
            const { history } = makeHistory();
            history.renameValue.value = '   ';
            await history.confirmRename('conv-1');
            expect(mockConversationRename).not.toHaveBeenCalled();
        });

        it('clears rename state after confirming', async () => {
            const { history } = makeHistory();
            history.renameValue.value = 'New Name';
            history.renamingConversationId.value = 'conv-1';
            await history.confirmRename('conv-1');
            expect(history.renamingConversationId.value).toBeNull();
            expect(history.renameValue.value).toBe('');
        });

        it('refreshes conversation list after rename', async () => {
            const { history } = makeHistory();
            history.renameValue.value = 'Updated';
            await history.confirmRename('conv-1');
            expect(mockConversationList).toHaveBeenCalledOnce();
        });
    });

    describe('cancelRename', () => {
        it('clears rename state', () => {
            const { history } = makeHistory();
            history.renamingConversationId.value = 'conv-1';
            history.renameValue.value = 'Draft';
            history.cancelRename();
            expect(history.renamingConversationId.value).toBeNull();
            expect(history.renameValue.value).toBe('');
        });
    });

    // ── formatRelativeDate ───────────────────────────────────────────────────
    describe('formatRelativeDate', () => {
        it('returns "just now" for dates less than 1 minute ago', () => {
            const { history } = makeHistory();
            const date = new Date(Date.now() - 30_000).toISOString();
            expect(history.formatRelativeDate(date)).toBe('just now');
        });

        it('returns minutes for dates less than 1 hour ago', () => {
            const { history } = makeHistory();
            const date = new Date(Date.now() - 5 * 60_000).toISOString();
            expect(history.formatRelativeDate(date)).toBe('5m ago');
        });

        it('returns hours for dates less than 1 day ago', () => {
            const { history } = makeHistory();
            const date = new Date(Date.now() - 3 * 3_600_000).toISOString();
            expect(history.formatRelativeDate(date)).toBe('3h ago');
        });

        it('returns days for dates less than 1 week ago', () => {
            const { history } = makeHistory();
            const date = new Date(Date.now() - 2 * 86_400_000).toISOString();
            expect(history.formatRelativeDate(date)).toBe('2d ago');
        });

        it('returns locale date string for dates older than 1 week', () => {
            const { history } = makeHistory();
            const old = new Date(Date.now() - 10 * 86_400_000);
            expect(history.formatRelativeDate(old.toISOString())).toBe(old.toLocaleDateString());
        });
    });
});
