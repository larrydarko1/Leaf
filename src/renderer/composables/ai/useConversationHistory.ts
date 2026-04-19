/**
 * useConversationHistory — persists and navigates LLM conversation sessions via IPC.
 */

import { ref, nextTick } from 'vue';
import type { Ref } from 'vue';
import type { AiStatus, ConversationMeta } from '../../types/ai';
import type { ChatMessage } from '../../types/chat';

export function useConversationHistory(
    status: Ref<AiStatus>,
    lastUsedModelName: Ref<string | null>,
    messages: Ref<ChatMessage[]>,
) {
    const showHistory = ref(false);
    const conversationList = ref<ConversationMeta[]>([]);
    const currentConversationId = ref<string | null>(null);
    const conversationTokenCount = ref(0);

    // Rename state
    const renamingConversationId = ref<string | null>(null);
    const renameValue = ref('');
    const renameInputRef = ref<HTMLInputElement[] | null>(null);

    function toggleHistory() {
        showHistory.value = !showHistory.value;
        if (showHistory.value) refreshConversationList();
    }

    function openHistory() {
        showHistory.value = true;
        refreshConversationList();
    }

    async function refreshConversationList() {
        try {
            const result = await window.electronAPI.conversationList();
            if (result.success) conversationList.value = result.conversations;
        } catch (error) {
            console.error('Failed to list conversations:', error);
        }
    }

    /** Create a new conversation record (internal, called before the first message). */
    async function createNewConversation() {
        try {
            const modelName = status.value.currentModelName || 'unknown';
            const result = await window.electronAPI.conversationCreate(modelName);
            if (result.success && result.conversation) {
                currentConversationId.value = result.conversation.id;
            }
        } catch (error) {
            console.error('Failed to create conversation:', error);
        }
    }

    /**
     * Reset to a blank conversation. Saves the current one first.
     * Caller is responsible for focusing the input after this returns.
     */
    async function startNewConversation() {
        await saveCurrentConversation();
        try {
            await window.electronAPI.aiResetChat();
        } catch (error) {
            console.error('Failed to reset chat:', error);
        }
        messages.value = [];
        currentConversationId.value = null;
        conversationTokenCount.value = 0;
        showHistory.value = false;
    }

    async function saveCurrentConversation() {
        if (!currentConversationId.value) return;
        try {
            const result = await window.electronAPI.conversationLoad(currentConversationId.value);
            if (result.success && result.conversation) {
                result.conversation.messages = messages.value
                    .filter((m) => m.role !== 'system')
                    .map((m) => ({
                        role: m.role as 'user' | 'assistant',
                        content: m.content,
                        timestamp: new Date().toISOString(),
                    }));
                result.conversation.tokenCount = conversationTokenCount.value;
                await window.electronAPI.conversationSave(result.conversation);
            }
        } catch (error) {
            console.error('Failed to save conversation:', error);
        }
    }

    async function saveTokenCountToConversation() {
        if (!currentConversationId.value) return;
        try {
            const result = await window.electronAPI.conversationLoad(currentConversationId.value);
            if (result.success && result.conversation) {
                result.conversation.tokenCount = conversationTokenCount.value;
                await window.electronAPI.conversationSave(result.conversation);
            }
        } catch (error) {
            console.error('Failed to save token count:', error);
        }
    }

    /**
     * Load a conversation from history. Saves the current one first.
     * Caller is responsible for scrolling to bottom after this returns.
     */
    async function loadConversation(id: string) {
        try {
            await saveCurrentConversation();
            const result = await window.electronAPI.conversationLoad(id);
            if (result.success && result.conversation) {
                if (status.value.isModelLoaded) {
                    await window.electronAPI.aiResetChat();
                }
                currentConversationId.value = result.conversation.id;
                messages.value = result.conversation.messages.map((m) => ({
                    role: m.role,
                    content: m.content,
                }));
                if (result.conversation.model) {
                    lastUsedModelName.value = result.conversation.model;
                }
                conversationTokenCount.value = result.conversation.tokenCount || 0;
                if (status.value.isModelLoaded && messages.value.length > 0) {
                    await window.electronAPI.aiRestoreChatHistory(
                        messages.value
                            .filter((m) => m.role !== 'system')
                            .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
                    );
                }
                showHistory.value = false;
            }
        } catch (error) {
            console.error('Failed to load conversation:', error);
        }
    }

    async function deleteConversation(id: string) {
        try {
            await window.electronAPI.conversationDelete(id);
            if (currentConversationId.value === id) {
                messages.value = [];
                currentConversationId.value = null;
                conversationTokenCount.value = 0;
                await window.electronAPI.aiResetChat();
            }
            await refreshConversationList();
        } catch (error) {
            console.error('Failed to delete conversation:', error);
        }
    }

    function startRename(conv: ConversationMeta) {
        renamingConversationId.value = conv.id;
        renameValue.value = conv.title;
        nextTick(() => {
            if (renameInputRef.value && renameInputRef.value.length > 0) {
                renameInputRef.value[0].focus();
                renameInputRef.value[0].select();
            }
        });
    }

    async function confirmRename(id: string) {
        if (!renameValue.value.trim()) {
            cancelRename();
            return;
        }
        try {
            await window.electronAPI.conversationRename(id, renameValue.value.trim());
            await refreshConversationList();
        } catch (error) {
            console.error('Failed to rename conversation:', error);
        }
        renamingConversationId.value = null;
        renameValue.value = '';
    }

    function cancelRename() {
        renamingConversationId.value = null;
        renameValue.value = '';
    }

    function formatRelativeDate(dateStr: string): string {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMin = Math.floor(diffMs / 60000);
        const diffHr = Math.floor(diffMs / 3600000);
        const diffDay = Math.floor(diffMs / 86400000);
        if (diffMin < 1) return 'just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        if (diffHr < 24) return `${diffHr}h ago`;
        if (diffDay < 7) return `${diffDay}d ago`;
        return date.toLocaleDateString();
    }

    return {
        showHistory,
        conversationList,
        currentConversationId,
        conversationTokenCount,
        renamingConversationId,
        renameValue,
        renameInputRef,
        toggleHistory,
        openHistory,
        refreshConversationList,
        createNewConversation,
        startNewConversation,
        saveCurrentConversation,
        saveTokenCountToConversation,
        loadConversation,
        deleteConversation,
        startRename,
        confirmRename,
        cancelRename,
        formatRelativeDate,
    };
}
