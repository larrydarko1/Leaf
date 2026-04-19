<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import type { ChatMessage } from '../../types/chat';
import type { AiModelInfo, AiStatus } from '../../types/ai';
import AiAgentEditCard from './AiAgentEditCard.vue';

const props = defineProps<{
    messages: ChatMessage[];
    status: AiStatus;
    availableModels: AiModelInfo[];
    isStreaming: boolean;
    isReady: boolean;
    editingIndex: number | null;
    editContent: string;
    copiedIndex: number | null;
    agentMode: boolean;
    previousModelMatch: AiModelInfo | null;
    isLoading: boolean;
    tokenUsagePercent: number;
    conversationTokenCount: number;
    renderMarkdown: (content: string) => string;
}>();

defineEmits<{
    (e: 'scroll'): void;
    (e: 'copy', content: string, index: number): void;
    (e: 'start-edit', index: number): void;
    (e: 'cancel-edit'): void;
    (e: 'confirm-edit', index: number): void;
    (e: 'update:editContent', value: string): void;
    (e: 'resend', index: number): void;
    (e: 'regenerate'): void;
    (e: 'delete-last-pair'): void;
    (e: 'approve-agent-edit', msgIndex: number, editIndex: number): void;
    (e: 'reject-agent-edit', msgIndex: number, editIndex: number): void;
    (e: 'open-models-folder'): void;
    (e: 'open-history'): void;
    (e: 'load-previous-model'): void;
}>();

const editInputRef = ref<HTMLTextAreaElement[]>();

watch(
    () => props.editingIndex,
    async (index) => {
        if (index !== null) {
            await nextTick();
            editInputRef.value?.[0]?.focus();
        }
    },
);

function truncate(str: string, len: number): string {
    return str.length > len ? str.slice(0, len) + '…' : str;
}

function formatTokenCount(n: number): string {
    if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
    return String(n);
}
</script>

<template>
    <!-- Chat messages -->
    <div ref="messagesContainer" class="ai-messages" @scroll="$emit('scroll')">
        <!-- Empty state -->
        <div v-if="messages.length === 0" class="ai-empty-state">
            <div class="ai-empty-icon">
                <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path
                        d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"
                    />
                    <line x1="9" y1="21" x2="15" y2="21" />
                    <line x1="10" y1="24" x2="14" y2="24" />
                </svg>
            </div>
            <p class="ai-empty-text">
                {{
                    status.isModelLoaded
                        ? 'Ask anything about your notes or just chat.'
                        : 'Load a model to get started. Place .gguf files in your models folder.'
                }}
            </p>
            <button
                v-if="!status.isModelLoaded && availableModels.length === 0"
                class="ai-btn-secondary"
                @click="$emit('open-models-folder')"
            >
                Open Models Folder
            </button>
            <button
                v-if="!status.isModelLoaded && availableModels.length > 0"
                class="ai-btn-secondary"
                @click="$emit('open-history')"
            >
                Browse History
            </button>
        </div>

        <!-- Messages -->
        <div v-for="(msg, index) in messages" :key="index" class="ai-message" :class="msg.role">
            <div class="ai-message-wrapper">
                <!-- User message: edit mode -->
                <div v-if="msg.role === 'user' && editingIndex === index" class="ai-message-edit">
                    <textarea
                        ref="editInputRef"
                        :value="editContent"
                        class="ai-edit-input"
                        rows="2"
                        @input="$emit('update:editContent', ($event.target as HTMLTextAreaElement).value)"
                        @keydown.enter.exact.prevent="$emit('confirm-edit', index)"
                        @keydown.escape.prevent="$emit('cancel-edit')"
                    />
                    <div class="ai-edit-actions">
                        <button class="ai-btn-icon ai-btn-tiny" title="Cancel" @click="$emit('cancel-edit')">
                            <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                        <button
                            class="ai-btn-icon ai-btn-tiny"
                            title="Save & resend"
                            @click="$emit('confirm-edit', index)"
                        >
                            <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </button>
                    </div>
                </div>
                <!-- User message: normal mode -->
                <div v-else-if="msg.role === 'user'" class="ai-message-content">
                    {{ msg.content }}
                </div>
                <!-- System message -->
                <div v-else-if="msg.role === 'system'" class="ai-message-content ai-system-notice">
                    <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                    <span>{{ msg.content }}</span>
                </div>
                <!-- Assistant message -->
                <div v-else class="ai-message-content ai-markdown" v-html="renderMarkdown(msg.content)"></div>
                <!-- Agent edit cards -->
                <div v-if="msg.agentEdits && msg.agentEdits.length > 0" class="ai-agent-edits">
                    <AiAgentEditCard
                        v-for="(edit, editIdx) in msg.agentEdits"
                        :key="editIdx"
                        :edit="edit"
                        @approve="$emit('approve-agent-edit', index, editIdx)"
                        @reject="$emit('reject-agent-edit', index, editIdx)"
                    />
                </div>
                <span v-if="msg.role === 'assistant' && index === messages.length - 1 && isStreaming" class="ai-cursor"
                    >▊</span
                >
                <!-- Message action buttons -->
                <div
                    v-if="
                        msg.role !== 'system' &&
                        msg.content &&
                        !(isStreaming && index >= messages.length - 2) &&
                        editingIndex !== index
                    "
                    class="ai-message-actions"
                >
                    <button
                        class="ai-btn-action"
                        :title="copiedIndex === index ? 'Copied!' : 'Copy'"
                        @click="$emit('copy', msg.content, index)"
                    >
                        <svg
                            v-if="copiedIndex !== index"
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                        <svg
                            v-else
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    </button>
                    <button
                        v-if="msg.role === 'user'"
                        class="ai-btn-action"
                        title="Edit"
                        @click="$emit('start-edit', index)"
                    >
                        <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                    </button>
                    <button
                        v-if="msg.role === 'user' && index === messages.length - 1 && isReady"
                        class="ai-btn-action"
                        title="Resend"
                        @click="$emit('resend', index)"
                    >
                        <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <polyline points="1 4 1 10 7 10" />
                            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                        </svg>
                    </button>
                    <button
                        v-if="msg.role === 'assistant' && index === messages.length - 1 && isReady"
                        class="ai-btn-action"
                        title="Regenerate"
                        @click="$emit('regenerate')"
                    >
                        <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <polyline points="23 4 23 10 17 10" />
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                        </svg>
                    </button>
                    <button
                        v-if="index === messages.length - 1"
                        class="ai-btn-action ai-btn-action-danger"
                        title="Delete"
                        @click="$emit('delete-last-pair')"
                    >
                        <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Load model banner -->
    <div v-if="!status.isModelLoaded && messages.length > 0" class="ai-load-model-banner">
        <div class="ai-load-model-banner-content">
            <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>Load a model to continue chatting</span>
        </div>
        <button
            v-if="previousModelMatch"
            class="ai-load-model-btn"
            :disabled="isLoading"
            @click="$emit('load-previous-model')"
        >
            <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            {{ isLoading ? 'Loading...' : 'Load ' + truncate(previousModelMatch.name, 20) }}
        </button>
    </div>

    <!-- Token counter -->
    <div v-if="status.isModelLoaded && status.contextSize > 0" class="ai-token-bar">
        <div class="ai-token-bar-track">
            <div
                class="ai-token-bar-fill"
                :class="{ warning: tokenUsagePercent > 75, danger: tokenUsagePercent > 90 }"
                :style="{ width: tokenUsagePercent + '%' }"
            ></div>
        </div>
        <span class="ai-token-label"
            >{{ formatTokenCount(conversationTokenCount) }} / {{ formatTokenCount(status.contextSize) }} ·
            {{ tokenUsagePercent }}%</span
        >
    </div>
</template>

<style lang="scss" scoped>
.ai-messages {
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
}

.ai-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    text-align: center;
    padding: 1rem;
}

.ai-empty-icon {
    color: $text3;
    margin-bottom: 0.75rem;
}

.ai-empty-text {
    font-size: 0.8rem;
    color: $text2;
    line-height: 1.5;
    margin: 0;
}

.ai-btn-secondary {
    padding: 0.5rem 1rem;
    background: transparent;
    color: $text2;
    border: 1px solid $text3;
    border-radius: 6px;
    font-size: 0.8rem;
    cursor: pointer;
    transition: all 0.2s;
    margin-top: 0.5rem;
    &:hover {
        color: $text1;
        border-color: $text2;
    }
}

.ai-message {
    display: flex;

    &:hover .ai-message-actions {
        opacity: 1;
    }

    &.user {
        justify-content: flex-end;
        .ai-message-wrapper {
            max-width: 85%;
        }
        .ai-message-content {
            background: $accent-color;
            color: $text3;
            border-radius: 12px 12px 2px 12px;
        }
        .ai-message-actions {
            justify-content: flex-end;
        }
    }

    &.assistant {
        justify-content: flex-start;
        .ai-message-wrapper {
            max-width: 90%;
        }
        .ai-message-content {
            background: $bg-primary;
            color: $text1;
            border-radius: 12px 12px 12px 2px;
        }
        .ai-message-actions {
            justify-content: flex-start;
        }
    }

    &.system {
        justify-content: center;
        .ai-message-wrapper {
            max-width: 95%;
        }
    }
}

.ai-message-wrapper {
    position: relative;
}

.ai-message-content {
    padding: 0.6rem 0.85rem;
    font-size: 0.82rem;
    line-height: 1.55;
    word-break: break-word;
    white-space: pre-wrap;
}

.ai-system-notice {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    background: var(--bg-secondary, #2a2a2a);
    border: 1px solid var(--border-color, #3a3a3a);
    border-radius: 8px;
    padding: 0.4rem 0.7rem;
    font-size: 0.72rem;
    color: var(--text2, #999);
    font-style: italic;
    white-space: normal;
    svg {
        flex-shrink: 0;
        opacity: 0.6;
    }
}

.ai-markdown {
    white-space: normal;

    :deep(p) {
        margin: 0 0 0.5em 0;
        &:last-child {
            margin-bottom: 0;
        }
    }
    :deep(h1),
    :deep(h2),
    :deep(h3),
    :deep(h4) {
        margin: 0.6em 0 0.3em 0;
        line-height: 1.3;
        &:first-child {
            margin-top: 0;
        }
    }
    :deep(h1) {
        font-size: 1.1em;
    }
    :deep(h2) {
        font-size: 1em;
    }
    :deep(h3) {
        font-size: 0.95em;
    }
    :deep(ul),
    :deep(ol) {
        margin: 0.3em 0;
        padding-left: 1.4em;
    }
    :deep(li) {
        margin: 0.15em 0;
    }
    :deep(code) {
        background: rgba(0, 0, 0, 0.15);
        padding: 0.15em 0.35em;
        border-radius: 3px;
        font-size: 0.9em;
        font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
    }
    :deep(pre) {
        background: rgba(0, 0, 0, 0.2);
        padding: 0.6em 0.75em;
        border-radius: 6px;
        overflow-x: auto;
        margin: 0.4em 0;
        code {
            background: none;
            padding: 0;
            font-size: 0.85em;
        }
    }
    :deep(blockquote) {
        border-left: 3px solid $accent-color;
        margin: 0.4em 0;
        padding: 0.2em 0.6em;
        color: $text2;
    }
    :deep(table) {
        border-collapse: collapse;
        margin: 0.4em 0;
        width: 100%;
        font-size: 0.9em;
        th,
        td {
            border: 1px solid $text3;
            padding: 0.3em 0.5em;
            text-align: left;
        }
        th {
            background: rgba(0, 0, 0, 0.1);
        }
    }
    :deep(hr) {
        border: none;
        border-top: 1px solid $text3;
        margin: 0.5em 0;
    }
    :deep(a) {
        color: $accent-color;
        text-decoration: underline;
    }
    :deep(strong) {
        font-weight: 600;
    }
}

.ai-message-actions {
    display: flex;
    align-items: center;
    gap: 2px;
    opacity: 0;
    transition: opacity 0.15s;
    margin-top: 3px;
    padding: 0 2px;
}

.ai-btn-action {
    background: none;
    border: none;
    color: $text2;
    cursor: pointer;
    padding: 3px 4px;
    border-radius: 4px;
    transition:
        color 0.15s,
        background 0.15s;
    display: flex;
    align-items: center;
    justify-content: center;
    &:hover {
        color: $text1;
        background: $bg-hover;
    }
    &.ai-btn-action-danger:hover {
        color: #e55;
    }
}

.ai-message-edit {
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
}

.ai-edit-input {
    width: 100%;
    min-height: 2.5rem;
    max-height: 8rem;
    padding: 0.5rem 0.65rem;
    background: $bg-primary;
    color: $text1;
    border: 1px solid $accent-color;
    border-radius: 8px;
    font-size: 0.82rem;
    font-family: inherit;
    line-height: 1.5;
    resize: vertical;
    outline: none;
    &:focus {
        border-color: $accent-color;
        box-shadow: 0 0 0 1px $accent-color;
    }
}

.ai-edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 4px;
}

.ai-cursor {
    animation: blink 0.8s step-end infinite;
    color: $accent-color;
    font-size: 0.9em;
}
@keyframes blink {
    50% {
        opacity: 0;
    }
}

.ai-btn-icon {
    background: none;
    border: none;
    color: $text2;
    cursor: pointer;
    padding: 0.3rem;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    flex-shrink: 0;
    &:hover:not(:disabled) {
        background: $bg-hover;
        color: $text1;
    }
}

.ai-btn-tiny {
    padding: 0.2rem !important;
}

// Agent edit cards
.ai-agent-edits {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.5rem;
    width: 100%;
}

// Load model banner
.ai-load-model-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: $bg-primary;
    border-top: 1px solid $text3;
    flex-shrink: 0;
}

.ai-load-model-banner-content {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.72rem;
    color: $text2;
    svg {
        flex-shrink: 0;
        opacity: 0.7;
    }
}

.ai-load-model-btn {
    display: flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.6rem;
    background: $accent-color;
    color: $base1;
    border: none;
    border-radius: 7px;
    font-size: 0.7rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition:
        opacity 0.15s,
        transform 0.1s;
    flex-shrink: 0;
    &:hover:not(:disabled) {
        opacity: 0.85;
        transform: scale(1.02);
    }
    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    svg {
        flex-shrink: 0;
    }
}

// Token counter bar
.ai-token-bar {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0 0.75rem;
    flex-shrink: 0;
}

.ai-token-bar-track {
    flex: 1;
    height: 3px;
    background: $text3;
    border-radius: 2px;
    overflow: hidden;
}

.ai-token-bar-fill {
    height: 100%;
    background: $accent-color;
    border-radius: 2px;
    transition: width 0.3s ease;
    &.warning {
        background: #e6a700;
    }
    &.danger {
        background: var(--danger-color, #e74c3c);
    }
}

.ai-token-label {
    font-size: 0.62rem;
    color: $text2;
    white-space: nowrap;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
}
</style>
