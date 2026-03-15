import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import type { Ref } from 'vue';
import { marked } from 'marked';
import type { FileInfo } from '../../types/electron';
import type { AiStatus } from '../../types/ai';
import type { ChatMessage, AgentFileEdit } from '../../types/chat';
import { AGENT_SYSTEM_PROMPT } from './useAgentMode';

// Configure marked once at module level
marked.setOptions({ breaks: true, gfm: true });

interface AiChatDeps {
    messages: Ref<ChatMessage[]>;
    status: Ref<AiStatus>;
    conversationTokenCount: Ref<number>;
    currentConversationId: Ref<string | null>;
    agentMode: Ref<boolean>;
    activeFile: { readonly value: FileInfo | null };
    workspacePath: { readonly value: string | null };
}

interface AiChatActions {
    createNewConversation: () => Promise<void>;
    saveCurrentConversation: () => Promise<void>;
    saveTokenCountToConversation: () => Promise<void>;
    refreshConversationList: () => Promise<void>;
    refreshStatus: () => Promise<void>;
    parseAgentEdits: (response: string) => { cleanContent: string; edits: AgentFileEdit[] };
    processAgentEdits: (msgIndex: number, edits: AgentFileEdit[]) => Promise<void>;
}

export function useAIChat(deps: AiChatDeps, actions: AiChatActions) {
    const { messages, status, conversationTokenCount, currentConversationId, agentMode, activeFile, workspacePath } = deps;
    const { createNewConversation, saveCurrentConversation, saveTokenCountToConversation, refreshConversationList, refreshStatus, parseAgentEdits, processAgentEdits } = actions;

    // DOM refs (bound via template ref="...")
    const messagesContainer = ref<HTMLElement | null>(null);
    const inputField = ref<HTMLTextAreaElement | null>(null);

    // Chat state
    const inputMessage = ref('');
    const isStreaming = ref(false);
    const includeNoteContext = ref(false);
    const copiedIndex = ref<number | null>(null);
    const userScrolledUp = ref(false);

    // Message editing state
    const editingIndex = ref<number | null>(null);
    const editContent = ref('');
    const editInputRef = ref<HTMLTextAreaElement[] | null>(null);

    const isReady = computed(() => status.value.isModelLoaded);
    const isAnyGenerating = computed(() => status.value.isGenerating);

    // ============================
    // Scroll helpers
    // ============================

    function scrollToBottom(force = false) {
        if (!force && userScrolledUp.value) return;
        nextTick(() => {
            if (messagesContainer.value) {
                messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
            }
        });
    }

    function onMessagesScroll() {
        if (!messagesContainer.value || !isStreaming.value) return;
        const el = messagesContainer.value;
        userScrolledUp.value = el.scrollHeight - el.scrollTop - el.clientHeight >= 40;
    }

    // ============================
    // Markdown + clipboard
    // ============================

    function renderMarkdown(content: string): string {
        if (!content) return '';
        return marked.parse(content, { async: false }) as string;
    }

    async function copyMessage(content: string, index: number) {
        try {
            await window.electronAPI.writeClipboard(content);
            copiedIndex.value = index;
            setTimeout(() => { if (copiedIndex.value === index) copiedIndex.value = null; }, 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }

    // ============================
    // Message editing
    // ============================

    function startEditMessage(index: number) {
        if (messages.value[index]?.role !== 'user') return;
        editingIndex.value = index;
        editContent.value = messages.value[index].content;
        nextTick(() => {
            if (editInputRef.value && editInputRef.value.length > 0) editInputRef.value[0].focus();
        });
    }

    function cancelEditMessage() {
        editingIndex.value = null;
        editContent.value = '';
    }

    async function confirmEditMessage(index: number) {
        const newContent = editContent.value.trim();
        if (!newContent) { cancelEditMessage(); return; }
        messages.value[index].content = newContent;
        messages.value.splice(index + 1);
        await window.electronAPI.aiResetChat();
        conversationTokenCount.value = 0;
        await saveCurrentConversation();
        await saveTokenCountToConversation();
        await refreshConversationList();
        editingIndex.value = null;
        editContent.value = '';
        scrollToBottom();
    }

    // ============================
    // Resend / delete / regenerate
    // ============================

    async function resendMessage(index: number) {
        const msg = messages.value[index];
        if (msg.role !== 'user' || !status.value.isModelLoaded || status.value.isGenerating) return;
        await window.electronAPI.aiResetChat();
        conversationTokenCount.value = 0;
        messages.value.push({ role: 'assistant', content: '' });
        isStreaming.value = true;
        userScrolledUp.value = false;
        scrollToBottom(true);
        let noteContext: string | null = null;
        if (includeNoteContext.value && activeFile.value) {
            try {
                const result = await window.electronAPI.readFile(activeFile.value.path);
                if (result.success && result.content) noteContext = result.content;
            } catch (error) { console.error('Failed to read note for context:', error); }
        }
        try {
            const result = await window.electronAPI.aiChat(msg.content, noteContext);
            if (!result.success) {
                const lastMsg = messages.value[messages.value.length - 1];
                if (lastMsg.role === 'assistant') lastMsg.content = `Error: ${result.error}`;
            }
            const assistantMsg = messages.value[messages.value.length - 1];
            if (currentConversationId.value && assistantMsg.role === 'assistant') {
                await window.electronAPI.conversationAddMessage(currentConversationId.value, {
                    role: 'assistant', content: assistantMsg.content
                });
            }
        } catch (error) {
            const lastMsg = messages.value[messages.value.length - 1];
            if (lastMsg.role === 'assistant') lastMsg.content = `Error: ${(error as Error).message}`;
        } finally {
            isStreaming.value = false;
            userScrolledUp.value = false;
            await refreshStatus();
            conversationTokenCount.value = status.value.contextTokens;
            await saveTokenCountToConversation();
            await refreshConversationList();
            scrollToBottom(true);
        }
    }

    async function deleteLastMessagePair() {
        if (messages.value.length === 0 || isStreaming.value) return;
        messages.value.pop();
        await window.electronAPI.aiResetChat();
        conversationTokenCount.value = 0;
        await saveCurrentConversation();
        await saveTokenCountToConversation();
        await refreshConversationList();
        scrollToBottom();
    }

    async function regenerateLastResponse() {
        if (messages.value.length < 2 || isStreaming.value) return;
        const lastMsg = messages.value[messages.value.length - 1];
        if (lastMsg.role !== 'assistant') return;
        messages.value.pop();
        await saveCurrentConversation();
        const lastIndex = messages.value.length - 1;
        if (lastIndex >= 0 && messages.value[lastIndex].role === 'user') {
            await resendMessage(lastIndex);
        }
    }

    // ============================
    // Send / stop
    // ============================

    async function sendMessage() {
        const text = inputMessage.value.trim();
        if (!text || !isReady.value || isAnyGenerating.value) return;
        if (!currentConversationId.value) await createNewConversation();
        const userMsg: ChatMessage = { role: 'user', content: text };
        messages.value.push(userMsg);
        inputMessage.value = '';
        if (currentConversationId.value) {
            await window.electronAPI.conversationAddMessage(currentConversationId.value, {
                role: 'user', content: userMsg.content
            });
        }
        messages.value.push({ role: 'assistant', content: '' });
        isStreaming.value = true;
        userScrolledUp.value = false;
        scrollToBottom(true);

        let noteContext: string | null = null;
        if (agentMode.value && workspacePath.value && activeFile.value) {
            let agentContext = AGENT_SYSTEM_PROMPT + '\n\n';
            try {
                const fileResult = await window.electronAPI.agentReadFile(activeFile.value.path, workspacePath.value);
                if (fileResult.success && fileResult.content !== undefined) {
                    agentContext += `Current content of "${activeFile.value.name}" (${activeFile.value.relativePath}):\n\`\`\`\n${fileResult.content}\n\`\`\`\n\n`;
                }
            } catch (err) {
                agentContext += `Note: Could not read "${activeFile.value.name}": ${(err as Error).message}\n\n`;
            }
            noteContext = agentContext;
        } else if (includeNoteContext.value && activeFile.value) {
            try {
                const result = await window.electronAPI.readFile(activeFile.value.path);
                if (result.success && result.content) noteContext = result.content;
            } catch (error) { console.error('Failed to read note for context:', error); }
        }

        try {
            const result = await window.electronAPI.aiChat(text, noteContext);
            if (!result.success) {
                const lastMsg = messages.value[messages.value.length - 1];
                if (lastMsg.role === 'assistant') lastMsg.content = `Error: ${result.error}`;
            }
            const assistantMsg = messages.value[messages.value.length - 1];
            if (agentMode.value && assistantMsg.role === 'assistant' && assistantMsg.content) {
                const { cleanContent, edits } = parseAgentEdits(assistantMsg.content);
                if (edits.length > 0) {
                    assistantMsg.content = cleanContent;
                    assistantMsg.agentEdits = edits;
                    await processAgentEdits(messages.value.length - 1, edits);
                }
            }
            if (currentConversationId.value && assistantMsg.role === 'assistant') {
                await window.electronAPI.conversationAddMessage(currentConversationId.value, {
                    role: 'assistant', content: assistantMsg.content
                });
            }
            if (result && result.compacted) {
                messages.value.push({
                    role: 'system',
                    content: 'Context memory was getting full — conversation has been summarized to free up space. All messages are preserved.'
                });
            }
        } catch (error) {
            const lastMsg = messages.value[messages.value.length - 1];
            if (lastMsg.role === 'assistant') lastMsg.content = `Error: ${(error as Error).message}`;
        } finally {
            isStreaming.value = false;
            userScrolledUp.value = false;
            await refreshStatus();
            conversationTokenCount.value = status.value.contextTokens;
            await saveTokenCountToConversation();
            await refreshConversationList();
            scrollToBottom(true);
        }
    }

    async function stopGeneration() {
        try {
            await window.electronAPI.aiStopChat();
        } catch (error) {
            console.error('Failed to stop generation:', error);
        } finally {
            isStreaming.value = false;
            userScrolledUp.value = false;
            await refreshStatus();
            conversationTokenCount.value = status.value.contextTokens;
            await saveTokenCountToConversation();
        }
    }

    // ============================
    // Token streaming + utilities
    // ============================

    function handleToken(token: string) {
        const lastMsg = messages.value[messages.value.length - 1];
        if (lastMsg && lastMsg.role === 'assistant') {
            lastMsg.content += token;
            scrollToBottom();
        }
    }

    function formatTokenCount(n: number): string {
        if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
        return String(n);
    }

    watch(() => messages.value.length, () => { scrollToBottom(); });

    onMounted(() => { window.electronAPI.onAiToken(handleToken); });
    onUnmounted(() => { window.electronAPI.removeAiTokenListener(); });

    return {
        messagesContainer,
        inputField,
        inputMessage,
        isStreaming,
        includeNoteContext,
        copiedIndex,
        editingIndex,
        editContent,
        editInputRef,
        scrollToBottom,
        onMessagesScroll,
        renderMarkdown,
        copyMessage,
        startEditMessage,
        cancelEditMessage,
        confirmEditMessage,
        resendMessage,
        deleteLastMessagePair,
        regenerateLastResponse,
        sendMessage,
        stopGeneration,
        formatTokenCount,
    };
}
