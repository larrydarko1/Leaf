<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useThrottleFn } from '@vueuse/core';
import type { FileInfo } from '@/schemas/vault';
import type { ChatMessage } from '@/schemas/chat';
import { useAIModel } from '@/renderer/composables/ai/useAIModel';
import { useConversationHistory } from '@/renderer/composables/ai/useConversationHistory';
import { useAgentMode } from '@/renderer/composables/ai/useAgentMode';
import { useHfDownload } from '@/renderer/composables/ai/useHfDownload';
import { useAIChat } from '@/renderer/composables/ai/useAIChat';
import { MAX_CONTEXT_FILES } from '@/renderer/composables/ai/useAIChat';
import AiModelBar from '@/renderer/components/ai/AiModelBar.vue';
import AiHfPanel from '@/renderer/components/ai/AiHfPanel.vue';
import AiHistoryPanel from '@/renderer/components/ai/AiHistoryPanel.vue';
import AiMessageList from '@/renderer/components/ai/AiMessageList.vue';
import AiInputArea from '@/renderer/components/ai/AiInputArea.vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

type Props = {
    activeFile: FileInfo | null;
    workspacePath: string | null;
    files?: FileInfo[];
};

const props = withDefaults(defineProps<Props>(), {
    files: () => [],
});

const emit = defineEmits<{
    'close': [];
    'file-changed': [path: string];
}>();

const model = useAIModel();
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
const messages = ref<ChatMessage[]>([]);
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

const agent = useAgentMode(
    messages,
    computed(() => props.workspacePath),
    (path) => emit('file-changed', path),
);
const { agentMode, toggleAgentMode, parseAgentEdits, processAgentEdits, approveAgentEdit, rejectAgentEdit } = agent;

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
    showThinking,
    contextFiles,
    addContextFile,
    removeContextFile,
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

const panelWidth = ref(340);
const minWidth = 340;
const maxWidth = 600;
const isResizing = ref(false);

// Files selectable as additional context: text/markdown files not already attached
const availableContextFiles = computed(() =>
    props.files.filter(
        (f) => (f.extension === '.md' || f.extension === '.txt') && !contextFiles.value.some((c) => c.path === f.path),
    ),
);

const tokenUsagePercent = computed(() => {
    if (status.value.contextSize === 0 || status.value.contextSize === undefined) return 0;
    return Math.min(100, Math.round((conversationTokenCount.value / status.value.contextSize) * 100));
});

onMounted(async () => {
    await refreshStatus();
    await refreshModels();
    await refreshConversationList();
    if (status.value.isModelLoaded && inputField.value !== null) {
        inputField.value.focus();
    }
});

onBeforeUnmount(() => {
    isResizing.value = false;
});

async function loadSelectedModel() {
    const result = await model.loadModel();
    if (result.success) {
        await startNewConversation();
    } else {
        messages.value.push({ role: 'assistant', content: t('ai.failed_to_load_model', { error: result.error }) });
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
    const hasConversation = currentConversationId.value !== null && currentConversationId.value !== '';
    const history = messages.value.map((m) => ({ role: m.role, content: m.content }));
    const result = await model.loadPreviousModel(history, hasConversation);
    if (result.success) {
        if (!hasConversation) await startNewConversation();
        inputField.value?.focus();
    } else if (result.error !== null && result.error !== undefined && result.error !== '') {
        messages.value.push({ role: 'assistant', content: t('ai.failed_to_load_model', { error: result.error }) });
    }
}

function startResize(e: MouseEvent) {
    isResizing.value = true;
    const startX = e.clientX;
    const startWidth = panelWidth.value;

    type ThrottledMouseMoveFn = ((moveEvent: MouseEvent) => void) & { cancel?: () => void };
    const onMouseMove = useThrottleFn((moveEvent: MouseEvent) => {
        const delta = startX - moveEvent.clientX;
        panelWidth.value = Math.min(maxWidth, Math.max(minWidth, startWidth + delta));
    }, 16) as unknown as ThrottledMouseMoveFn;

    function onMouseUp() {
        isResizing.value = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
        onMouseMove.cancel?.();
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
}

function decreaseWidth() {
    panelWidth.value = Math.max(minWidth, panelWidth.value - 50);
}

function increaseWidth() {
    panelWidth.value = Math.min(maxWidth, panelWidth.value + 50);
}
</script>

<template>
    <main
        class="ai-panel"
        :style="{ width: panelWidth + 'px' }"
        :aria-label="t('ai.assistant_panel')">
        <div
            class="ai-panel-resize-handle"
            role="slider"
            aria-orientation="vertical"
            :aria-label="t('ai.resize_panel')"
            :aria-valuenow="panelWidth"
            aria-valuemin="340"
            aria-valuemax="600"
            tabindex="0"
            @mousedown.prevent="startResize"
            @keydown.left="decreaseWidth"
            @keydown.right="increaseWidth" />

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
            :aria-label="t('ai.model_selection_and_controls')"
            @select-model="selectModel"
            @load-model="loadSelectedModel"
            @unload-model="unloadModel"
            @open-models-folder="openModelsFolder"
            @refresh-models="refreshModels"
            @toggle-hf-panel="toggleHfPanel"
            @toggle-history="toggleHistory"
            @toggle-agent-mode="toggleAgentMode"
            @new-conversation="startNewConversation"
            @close="$emit('close')" />

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
            :aria-label="t('ai.hf_model_browser')"
            :aria-hidden="!showHfPanel"
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
            @close="showHfPanel = false" />

        <AiHistoryPanel
            v-if="showHistory"
            :conversation-list="conversationList"
            :current-conversation-id="currentConversationId"
            :renaming-conversation-id="renamingConversationId"
            :rename-value="renameValue"
            :aria-label="t('ai.conversation_history')"
            :aria-hidden="!showHistory"
            @load="loadConversation"
            @start-rename="startRename"
            @confirm-rename="confirmRename"
            @cancel-rename="cancelRename"
            @delete="deleteConversation"
            @update:rename-value="renameValue = $event" />

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
            :show-thinking="showThinking"
            role="log"
            :aria-label="t('ai.conversation_messages')"
            aria-live="polite"
            aria-atomic="false"
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
            @load-previous-model="loadPreviousModel" />

        <AiInputArea
            :agent-mode="agentMode"
            :show-thinking="showThinking"
            :active-file="activeFile"
            :input-message="inputMessage"
            :is-ready="isReady"
            :is-any-generating="isAnyGenerating"
            :is-streaming="isStreaming"
            :input-field="inputField"
            :context-files="contextFiles"
            :available-files="availableContextFiles"
            :max-context-files="MAX_CONTEXT_FILES"
            :aria-label="t('ai.message_input_area')"
            @update:input-message="inputMessage = $event"
            @update:show-thinking="showThinking = $event"
            @add-context-file="addContextFile"
            @remove-context-file="removeContextFile"
            @send="sendMessage"
            @stop="stopGeneration" />
    </main>
</template>

<style lang="scss" scoped>
.ai-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: $base1;
    border-left: 1px solid $text3;
    position: relative;
    flex-shrink: 0;
}

.ai-panel-resize-handle {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    cursor: col-resize;
    z-index: 10;
    transition: background $transition-fast;

    &:hover,
    &:active {
        background: $accent-color;
        opacity: 0.5;
    }
}
</style>
