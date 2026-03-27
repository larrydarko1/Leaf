<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { FileInfo } from '../types/electron';
import type { ChatMessage } from '../types/chat';
import { useAIModel } from '../composables/ai/useAIModel';
import { useConversationHistory } from '../composables/ai/useConversationHistory';
import { useAgentMode } from '../composables/ai/useAgentMode';
import { useHfDownload } from '../composables/ai/useHfDownload';
import { useAIChat } from '../composables/ai/useAIChat';
import AiModelBar from './ai/AiModelBar.vue';
import AiHfPanel from './ai/AiHfPanel.vue';
import AiHistoryPanel from './ai/AiHistoryPanel.vue';
import AiMessageList from './ai/AiMessageList.vue';
import AiInputArea from './ai/AiInputArea.vue';

const props = defineProps<{
    activeFile: FileInfo | null;
    workspacePath: string | null;
}>();

const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'file-changed', path: string): void;
}>();

// AI model composable
const model = useAIModel();
// Template refs - used in template but not in script
/* eslint-disable @typescript-eslint/no-unused-vars */
const {
    status,
    availableModels,
    isLoading,
    selectedModelPath,
    lastUsedModelName,
    isReady,
    isAnyGenerating,
    selectedModelLabel,
    showDropdown,
    dropdownRef,
    dropdownPosition,
    previousModelMatch,
    toggleDropdown,
    selectModel,
    refreshModels,
    refreshStatus,
    openModelsFolder,
} = model;
/* eslint-enable @typescript-eslint/no-unused-vars */

// Shared messages state (passed to multiple composables)
const messages = ref<ChatMessage[]>([]);

// Conversation history composable
const conversation = useConversationHistory(status, lastUsedModelName, messages);
const {
    showHistory,
    conversationList,
    currentConversationId,
    conversationTokenCount,
    renamingConversationId,
    renameValue,
    toggleHistory,
    openHistory,
    refreshConversationList,
    createNewConversation,
    saveCurrentConversation,
    saveTokenCountToConversation,
    deleteConversation,
    startRename,
    confirmRename,
    cancelRename,
} = conversation;

// Agent mode composable
const agent = useAgentMode(
    messages,
    computed(() => props.workspacePath),
    (path) => emit('file-changed', path),
);
const { agentMode, toggleAgentMode, parseAgentEdits, processAgentEdits, approveAgentEdit, rejectAgentEdit } = agent;

// HF download composable
const hf = useHfDownload(refreshModels);
const {
    showHfPanel,
    hfSearchQuery,
    hfSearchResults,
    hfIsSearching,
    hfSelectedRepo,
    hfRepoFiles,
    hfModelInfo,
    hfIsLoadingFiles,
    hfDownloadProgress,
    hfActiveDownloads,
    hfDownloadError,
    hfSortBy,
    hfHasMore,
    hfIsLoadingMore,
    toggleHfPanel,
    searchHfModels,
    loadMoreResults,
    changeSortBy,
    selectHfRepo,
    downloadHfModel,
    cancelHfDownload,
} = hf;

// Chat composable
const chat = useAIChat(
    {
        messages,
        status,
        conversationTokenCount,
        currentConversationId,
        agentMode,
        activeFile: computed(() => props.activeFile),
        workspacePath: computed(() => props.workspacePath),
    },
    {
        createNewConversation,
        saveCurrentConversation,
        saveTokenCountToConversation,
        refreshConversationList,
        refreshStatus,
        parseAgentEdits,
        processAgentEdits,
    },
);
const {
    messagesContainer,
    inputField,
    inputMessage,
    isStreaming,
    includeNoteContext,
    copiedIndex,
    editingIndex,
    editContent,
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
    scrollToBottom,
} = chat;

// Token bar display
const tokenUsagePercent = computed(() => {
    if (!status.value.contextSize) return 0;
    return Math.min(100, Math.round((conversationTokenCount.value / status.value.contextSize) * 100));
});

// ============================
// Orchestration wrappers
// ============================

async function loadSelectedModel() {
    const result = await model.loadModel();
    if (result.success) {
        await startNewConversation();
    } else {
        messages.value.push({ role: 'assistant', content: `Failed to load model: ${result.error}` });
    }
}

async function unloadModel() {
    if (status.value.isGenerating) await stopGeneration();
    await saveCurrentConversation();
    await model.unloadModel();
    conversationTokenCount.value = 0;
}

async function startNewConversation() {
    await conversation.startNewConversation();
    inputField.value?.focus();
}

async function loadConversation(id: string) {
    await conversation.loadConversation(id);
    scrollToBottom();
}

async function loadPreviousModel() {
    const hasConversation = !!currentConversationId.value;
    const history = messages.value.map((m) => ({ role: m.role, content: m.content }));
    const result = await model.loadPreviousModel(history, hasConversation);
    if (result.success) {
        if (!hasConversation) await startNewConversation();
        inputField.value?.focus();
    } else if (result.error) {
        messages.value.push({ role: 'assistant', content: `Failed to load model: ${result.error}` });
    }
}

onMounted(async () => {
    await refreshStatus();
    await refreshModels();
    await refreshConversationList();
    if (status.value.isModelLoaded && inputField.value) {
        inputField.value.focus();
    }
});
</script>

<template>
    <div class="ai-panel">
        <AiModelBar
            :status="status"
            :available-models="availableModels"
            :is-loading="isLoading"
            :selected-model-path="selectedModelPath"
            :selected-model-label="selectedModelLabel"
            :show-hf-panel="showHfPanel"
            :show-history="showHistory"
            :agent-mode="agentMode"
            :is-any-generating="isAnyGenerating"
            @select-model="selectModel"
            @load-model="loadSelectedModel"
            @unload-model="unloadModel"
            @open-models-folder="openModelsFolder"
            @refresh-models="refreshModels"
            @toggle-hf-panel="toggleHfPanel"
            @toggle-history="toggleHistory"
            @toggle-agent-mode="toggleAgentMode"
            @new-conversation="startNewConversation"
            @close="$emit('close')"
        />

        <AiHfPanel
            v-if="showHfPanel"
            :hf-search-query="hfSearchQuery"
            :hf-search-results="hfSearchResults"
            :hf-is-searching="hfIsSearching"
            :hf-selected-repo="hfSelectedRepo"
            :hf-repo-files="hfRepoFiles"
            :hf-model-info="hfModelInfo"
            :hf-is-loading-files="hfIsLoadingFiles"
            :hf-download-progress="hfDownloadProgress"
            :hf-active-downloads="hfActiveDownloads"
            :hf-download-error="hfDownloadError"
            :hf-sort-by="hfSortBy"
            :hf-has-more="hfHasMore"
            :hf-is-loading-more="hfIsLoadingMore"
            @update:hf-search-query="hfSearchQuery = $event"
            @search="searchHfModels"
            @select-repo="selectHfRepo"
            @download="downloadHfModel"
            @cancel-download="cancelHfDownload"
            @change-sort="changeSortBy"
            @load-more="loadMoreResults"
            @back="
                hfSelectedRepo = null;
                hfRepoFiles = [];
                hfModelInfo = null;
            "
            @close="showHfPanel = false"
        />

        <AiHistoryPanel
            v-if="showHistory"
            :conversation-list="conversationList"
            :current-conversation-id="currentConversationId"
            :renaming-conversation-id="renamingConversationId"
            :rename-value="renameValue"
            @load="loadConversation"
            @start-rename="startRename"
            @confirm-rename="confirmRename"
            @cancel-rename="cancelRename"
            @delete="deleteConversation"
            @update:rename-value="renameValue = $event"
        />

        <AiMessageList
            ref="messagesContainer"
            :messages="messages"
            :status="status"
            :available-models="availableModels"
            :is-streaming="isStreaming"
            :is-ready="isReady"
            :editing-index="editingIndex"
            :edit-content="editContent"
            :copied-index="copiedIndex"
            :agent-mode="agentMode"
            :previous-model-match="previousModelMatch"
            :is-loading="isLoading"
            :token-usage-percent="tokenUsagePercent"
            :conversation-token-count="conversationTokenCount"
            :render-markdown="renderMarkdown"
            @scroll="onMessagesScroll"
            @copy="copyMessage"
            @start-edit="startEditMessage"
            @cancel-edit="cancelEditMessage"
            @confirm-edit="confirmEditMessage"
            @update:edit-content="editContent = $event"
            @resend="resendMessage"
            @regenerate="regenerateLastResponse"
            @delete-last-pair="deleteLastMessagePair"
            @approve-agent-edit="approveAgentEdit"
            @reject-agent-edit="rejectAgentEdit"
            @open-models-folder="openModelsFolder"
            @open-history="openHistory"
            @load-previous-model="loadPreviousModel"
        />

        <AiInputArea
            :agent-mode="agentMode"
            :include-note-context="includeNoteContext"
            :active-file="activeFile"
            :input-message="inputMessage"
            :is-ready="isReady"
            :is-any-generating="isAnyGenerating"
            :is-streaming="isStreaming"
            :input-field="inputField"
            @update:input-message="inputMessage = $event"
            @update:include-note-context="includeNoteContext = $event"
            @send="sendMessage"
            @stop="stopGeneration"
        />
    </div>
</template>

<style lang="scss" scoped>
.ai-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--base1);
    border-left: 1px solid var(--text3);
    width: 340px;
    min-width: 280px;
}
</style>
