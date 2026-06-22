/**
 * useAIChat — coordinates streaming inference, message management, and editing.
 * Owns: send/stop, token streaming, markdown rendering, message CRUD.
 */

import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue';
import { useThrottleFn } from '@vueuse/core';
import type { Ref } from 'vue';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import type { FileInfo } from '@/schemas/vault';
import type { AiStatus } from '@/schemas/ai';
import type { ChatMessage, AgentFileEdit } from '@/schemas/chat';
import { AGENT_SYSTEM_PROMPT } from '@/renderer/composables/ai/useAgentMode';

// Configure marked once at module level
marked.setOptions({ breaks: true, gfm: true });

type AiChatDeps = {
    messages: Ref<ChatMessage[]>;
    status: Ref<AiStatus>;
    conversationTokenCount: Ref<number>;
    currentConversationId: Ref<string | null>;
    agentMode: Ref<boolean>;
    activeFile: { readonly value: FileInfo | null };
    workspacePath: { readonly value: string | null };
};

type AiChatActions = {
    createNewConversation: () => Promise<void>;
    saveCurrentConversation: () => Promise<void>;
    saveTokenCountToConversation: () => Promise<void>;
    refreshConversationList: () => Promise<void>;
    refreshStatus: () => Promise<void>;
    parseAgentEdits: (response: string) => { cleanContent: string; edits: AgentFileEdit[] };
    processAgentEdits: (msgIndex: number, edits: AgentFileEdit[]) => Promise<void>;
};

export function useAIChat(deps: AiChatDeps, actions: AiChatActions) {
    const { messages, status, conversationTokenCount, currentConversationId, agentMode, activeFile, workspacePath } =
        deps;
    const {
        createNewConversation,
        saveCurrentConversation,
        saveTokenCountToConversation,
        refreshConversationList,
        refreshStatus,
        parseAgentEdits,
        processAgentEdits,
    } = actions;

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

    // Scroll helpers

    function scrollToBottom(force = false) {
        if (!force && userScrolledUp.value) return;
        void nextTick(() => {
            if (messagesContainer.value !== null) {
                messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight;
            }
        });
    }

    function onMessagesScroll() {
        if (messagesContainer.value === null || !isStreaming.value) return;
        const el = messagesContainer.value;
        userScrolledUp.value = el.scrollHeight - el.scrollTop - el.clientHeight >= 40;
    }

    type ThrottledScrollFn = (() => void) & { cancel?: () => void };
    const throttledMessagesScroll = useThrottleFn(onMessagesScroll, 100) as unknown as ThrottledScrollFn;

    // Markdown and clipboard

    function renderMarkdown(content: string): string {
        if (content.length === 0) return '';
        const html = marked.parse(content, { async: false });
        // Sanitize marked output to prevent XSS from user/AI-generated markdown
        return DOMPurify.sanitize(html, {
            ALLOWED_TAGS: [
                'h1',
                'h2',
                'h3',
                'h4',
                'h5',
                'h6',
                'p',
                'br',
                'strong',
                'b',
                'em',
                'i',
                'u',
                'del',
                'mark',
                'code',
                'pre',
                'blockquote',
                'ol',
                'ul',
                'li',
                'table',
                'thead',
                'tbody',
                'tr',
                'th',
                'td',
                'a',
                'hr',
                'span',
            ],
            ALLOWED_ATTR: ['href', 'target', 'alt', 'title', 'class'],
        });
    }

    async function copyMessage(content: string, index: number) {
        try {
            await window.electronAPI.writeClipboard(content);
            copiedIndex.value = index;
            void setTimeout(() => {
                if (copiedIndex.value !== null && copiedIndex.value === index) copiedIndex.value = null;
            }, 2000);
        } catch (err) {
            window.electronAPI.log.error('Failed to copy:', err);
        }
    }

    // Message editing

    function startEditMessage(index: number) {
        if (messages.value[index]?.role !== 'user') return;
        editingIndex.value = index;
        editContent.value = messages.value[index].content;
        void nextTick(() => {
            if (editInputRef.value !== null && editInputRef.value.length > 0) editInputRef.value[0].focus();
        });
    }

    function cancelEditMessage() {
        editingIndex.value = null;
        editContent.value = '';
    }

    async function confirmEditMessage(index: number) {
        const newContent = editContent.value.trim();
        if (newContent.length === 0) {
            cancelEditMessage();
            return;
        }
        messages.value[index].content = newContent;
        messages.value.splice(index + 1);
        await window.electronAPI.aiResetChat();
        conversationTokenCount.value = 0;
        // Restore context of messages before the edited one so subsequent
        // sends have conversation history available.
        const priorMessages = messages.value.slice(0, index).filter((m) => m.role !== 'system');
        if (priorMessages.length > 0) {
            await window.electronAPI.aiRestoreChatHistory(
                priorMessages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
            );
        }
        await saveCurrentConversation();
        await saveTokenCountToConversation();
        await refreshConversationList();
        editingIndex.value = null;
        editContent.value = '';
        scrollToBottom();
    }

    // Resend, delete, and regenerate

    async function resendMessage(index: number) {
        const msg = messages.value[index];
        if (msg.role !== 'user' || !status.value.isModelLoaded || status.value.isGenerating) return;
        await window.electronAPI.aiResetChat();
        conversationTokenCount.value = 0;
        // Restore context of messages that preceded this one so the AI
        // doesn't lose conversation history on regenerate/resend.
        const priorMessages = messages.value.slice(0, index).filter((m) => m.role !== 'system');
        if (priorMessages.length > 0) {
            await window.electronAPI.aiRestoreChatHistory(
                priorMessages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
            );
        }
        messages.value.push({ role: 'assistant', content: '' });
        isStreaming.value = true;
        userScrolledUp.value = false;
        scrollToBottom(true);
        let noteContext: string | null = null;
        if (includeNoteContext.value && activeFile.value !== null) {
            try {
                const result = await window.electronAPI.readFile(activeFile.value.path);
                if (result.success && result.content !== null && result.content !== undefined)
                    noteContext = result.content;
            } catch (error) {
                window.electronAPI.log.error('Failed to read note for context:', error);
            }
        }
        try {
            const result = await window.electronAPI.aiChat(msg.content, noteContext);
            if (result.success === false) {
                const lastMsg = messages.value[messages.value.length - 1];
                if (lastMsg !== undefined && lastMsg.role === 'assistant') lastMsg.content = `Error: ${result.error}`;
            }
            const assistantMsg = messages.value[messages.value.length - 1];
            if (
                currentConversationId.value !== null &&
                assistantMsg !== undefined &&
                assistantMsg.role === 'assistant'
            ) {
                await window.electronAPI.conversationAddMessage(currentConversationId.value, {
                    role: 'assistant',
                    content: assistantMsg.content,
                });
            }
        } catch (error) {
            const lastMsg = messages.value[messages.value.length - 1];
            if (lastMsg !== undefined && lastMsg.role === 'assistant')
                lastMsg.content = `Error: ${(error as Error).message}`;
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
        // Restore context of remaining messages so the AI retains
        // conversation history after the deletion.
        const remainingMessages = messages.value.filter((m) => m.role !== 'system');
        if (remainingMessages.length > 0) {
            await window.electronAPI.aiRestoreChatHistory(
                remainingMessages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
            );
        }
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

    // Send and stop

    async function sendMessage() {
        const text = inputMessage.value.trim();
        if (text.length === 0 || isReady.value === false || isAnyGenerating.value === true) return;
        if (currentConversationId.value === null) await createNewConversation();
        const userMsg: ChatMessage = { role: 'user', content: text };
        messages.value.push(userMsg);
        inputMessage.value = '';
        if (currentConversationId.value !== null) {
            await window.electronAPI.conversationAddMessage(currentConversationId.value, {
                role: 'user',
                content: userMsg.content,
            });
        }
        messages.value.push({ role: 'assistant', content: '' });
        isStreaming.value = true;
        userScrolledUp.value = false;
        scrollToBottom(true);

        let noteContext: string | null = null;
        if (agentMode.value && workspacePath.value !== null && activeFile.value !== null) {
            let agentContext = AGENT_SYSTEM_PROMPT + '\n\n';
            try {
                const fileResult = await window.electronAPI.agentReadFile(activeFile.value.path, workspacePath.value);
                if (fileResult.success && fileResult.content !== null && fileResult.content !== undefined) {
                    agentContext += `Current content of "${activeFile.value.name}" (${activeFile.value.relativePath}):\n\`\`\`\n${fileResult.content}\n\`\`\`\n\n`;
                }
            } catch (err) {
                agentContext += `Note: Could not read "${activeFile.value.name}": ${(err as Error).message}\n\n`;
            }
            noteContext = agentContext;
        } else if (includeNoteContext.value && activeFile.value !== null) {
            try {
                const result = await window.electronAPI.readFile(activeFile.value.path);
                if (result.success && result.content !== null && result.content !== undefined)
                    noteContext = result.content;
            } catch (error) {
                window.electronAPI.log.error('Failed to read note for context:', error);
            }
        }

        try {
            const result = await window.electronAPI.aiChat(text, noteContext);
            if (result.success === false) {
                const lastMsg = messages.value[messages.value.length - 1];
                if (lastMsg !== undefined && lastMsg.role === 'assistant') lastMsg.content = `Error: ${result.error}`;
            }
            const assistantMsg = messages.value[messages.value.length - 1];
            if (
                agentMode.value &&
                assistantMsg !== undefined &&
                assistantMsg.role === 'assistant' &&
                assistantMsg.content.length > 0
            ) {
                const { cleanContent, edits } = parseAgentEdits(assistantMsg.content);
                if (edits.length > 0) {
                    assistantMsg.content = cleanContent;
                    assistantMsg.agentEdits = edits;
                    await processAgentEdits(messages.value.length - 1, edits);
                }
            }
            if (
                currentConversationId.value !== null &&
                assistantMsg !== undefined &&
                assistantMsg.role === 'assistant'
            ) {
                await window.electronAPI.conversationAddMessage(currentConversationId.value, {
                    role: 'assistant',
                    content: assistantMsg.content,
                });
            }
            if (result !== null && result !== undefined && result.compacted === true) {
                messages.value.push({
                    role: 'system',
                    content:
                        'Context memory was getting full — conversation has been summarized to free up space. All messages are preserved.',
                });
            }
        } catch (error) {
            const lastMsg = messages.value[messages.value.length - 1];
            if (lastMsg !== undefined && lastMsg.role === 'assistant')
                lastMsg.content = `Error: ${(error as Error).message}`;
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
            window.electronAPI.log.error('Failed to stop generation:', error);
        } finally {
            isStreaming.value = false;
            userScrolledUp.value = false;
            await refreshStatus();
            conversationTokenCount.value = status.value.contextTokens;
            await saveTokenCountToConversation();
        }
    }

    // Token streaming and utilities

    function handleToken(token: string) {
        const lastMsg = messages.value[messages.value.length - 1];
        if (lastMsg !== undefined && lastMsg.role === 'assistant') {
            lastMsg.content += token;
            scrollToBottom();
        }
    }

    function formatTokenCount(n: number): string {
        if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
        return String(n);
    }

    void watch(
        () => messages.value.length,
        () => {
            scrollToBottom();
        },
    );

    onMounted(() => {
        window.electronAPI.onAiToken(handleToken);
    });
    onUnmounted(() => {
        throttledMessagesScroll.cancel?.();
        window.electronAPI.removeAiTokenListener();
    });

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
        onMessagesScroll: throttledMessagesScroll,
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
