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

// Maximum number of files a user can attach as additional context
export const MAX_CONTEXT_FILES = 10;

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
    const showThinking = ref(false);
    const contextFiles = ref<FileInfo[]>([]);
    const copiedIndex = ref<number | null>(null);
    const userScrolledUp = ref(false);

    // Message editing state
    const editingIndex = ref<number | null>(null);
    const editContent = ref('');
    const editInputRef = ref<HTMLTextAreaElement[] | null>(null);

    const isReady = computed(() => status.value.isModelLoaded);
    const isAnyGenerating = computed(() => status.value.isGenerating);

    // Context file management

    function addContextFile(file: FileInfo) {
        if (contextFiles.value.length >= MAX_CONTEXT_FILES) return;
        if (contextFiles.value.some((f) => f.path === file.path)) return;
        contextFiles.value.push(file);
    }

    function removeContextFile(path: string) {
        contextFiles.value = contextFiles.value.filter((f) => f.path !== path);
    }

    async function readFileForContext(file: FileInfo): Promise<string | null> {
        try {
            const result = await window.electronAPI.readFile(file.path);
            if (result.success && result.content !== null && result.content !== undefined) return result.content;
        } catch (error) {
            window.electronAPI.log.error('Failed to read file for context:', error);
        }
        return null;
    }

    /**
     * Collects the files to send as context, de-duplicated by path. In agent
     * mode the active file is always included so the agent can edit it; any
     * files the user attached via the context picker are always included.
     */
    function collectContextFiles(includeActive: boolean): FileInfo[] {
        const files: FileInfo[] = [];
        const seen = new Set<string>();
        if (includeActive && activeFile.value !== null) {
            files.push(activeFile.value);
            seen.add(activeFile.value.path);
        }
        for (const file of contextFiles.value) {
            if (!seen.has(file.path)) {
                files.push(file);
                seen.add(file.path);
            }
        }
        return files;
    }

    /**
     * Builds the note-context string passed to the model, supporting multiple
     * attached files. Returns null when there is nothing to include.
     */
    async function buildNoteContext(): Promise<string | null> {
        // Agent mode: always include the active file plus any attached files,
        // wrapped with the agent system prompt and the agent-aware reader.
        if (agentMode.value && workspacePath.value !== null) {
            const files = collectContextFiles(true);
            if (files.length === 0) return null;
            let agentContext = AGENT_SYSTEM_PROMPT + '\n\n';
            for (const file of files) {
                try {
                    const fileResult = await window.electronAPI.agentReadFile(file.path, workspacePath.value);
                    if (fileResult.success && fileResult.content !== null && fileResult.content !== undefined) {
                        agentContext += `Current content of "${file.name}" (${file.relativePath}):\n\`\`\`\n${fileResult.content}\n\`\`\`\n\n`;
                    }
                } catch (err) {
                    agentContext += `Note: Could not read "${file.name}": ${(err as Error).message}\n\n`;
                }
            }
            return agentContext;
        }

        // Normal mode: include only the files the user attached as context.
        const files = collectContextFiles(false);
        if (files.length === 0) return null;

        // Single file: pass raw content.
        if (files.length === 1) return await readFileForContext(files[0]);

        // Multiple files: label each clearly so the model can tell them apart.
        const parts: string[] = [];
        for (const file of files) {
            const content = await readFileForContext(file);
            if (content !== null) parts.push(`File: ${file.relativePath}\n\`\`\`\n${content}\n\`\`\``);
        }
        return parts.length > 0 ? parts.join('\n\n') : null;
    }

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
        const noteContext = await buildNoteContext();
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

        const noteContext = await buildNoteContext();

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

    function handleThinkingToken(token: string) {
        const lastMsg = messages.value[messages.value.length - 1];
        if (lastMsg !== undefined && lastMsg.role === 'assistant') {
            lastMsg.thinking = (lastMsg.thinking ?? '') + token;
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
        window.electronAPI.onAiThinkingToken(handleThinkingToken);
    });
    onUnmounted(() => {
        throttledMessagesScroll.cancel?.();
        window.electronAPI.removeAiTokenListener();
        window.electronAPI.removeAiThinkingTokenListener();
    });

    return {
        messagesContainer,
        inputField,
        inputMessage,
        isStreaming,
        showThinking,
        contextFiles,
        addContextFile,
        removeContextFile,
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
