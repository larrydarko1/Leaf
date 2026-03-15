<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import type { ConversationMeta } from '../../types/ai';

const props = defineProps<{
    conversationList: ConversationMeta[];
    currentConversationId: string | null;
    renamingConversationId: string | null;
    renameValue: string;
}>();

const renameInputRef = ref<HTMLInputElement[]>();

watch(
    () => props.renamingConversationId,
    async (id) => {
        if (id) {
            await nextTick();
            renameInputRef.value?.[0]?.focus();
            renameInputRef.value?.[0]?.select();
        }
    },
);

defineEmits<{
    (e: 'load', id: string): void;
    (e: 'start-rename', conv: ConversationMeta): void;
    (e: 'confirm-rename', id: string): void;
    (e: 'cancel-rename'): void;
    (e: 'delete', id: string): void;
    (e: 'update:renameValue', value: string): void;
}>();

function formatRelativeDate(dateStr: string): string {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHrs = Math.floor(diffMins / 60);
    if (diffHrs < 24) return `${diffHrs}h ago`;
    const diffDays = Math.floor(diffHrs / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString();
}
</script>

<template>
    <div class="ai-history-panel">
        <div class="ai-history-header">
            <span class="ai-history-title">History</span>
        </div>
        <div class="ai-history-list">
            <div v-if="conversationList.length === 0" class="ai-history-empty">No conversations yet</div>
            <div
                v-for="conv in conversationList"
                :key="conv.id"
                class="ai-history-item"
                :class="{ active: currentConversationId === conv.id }"
                @click="$emit('load', conv.id)"
            >
                <div class="ai-history-item-content">
                    <span v-if="renamingConversationId === conv.id" class="ai-history-item-title">
                        <input
                            ref="renameInputRef"
                            :value="renameValue"
                            class="ai-history-rename-input"
                            @input="$emit('update:renameValue', ($event.target as HTMLInputElement).value)"
                            @keydown.enter.prevent="$emit('confirm-rename', conv.id)"
                            @keydown.escape.prevent="$emit('cancel-rename')"
                            @blur="$emit('confirm-rename', conv.id)"
                            @click.stop
                        />
                    </span>
                    <span v-else class="ai-history-item-title">{{ conv.title }}</span>
                    <span class="ai-history-item-meta">
                        {{ conv.messageCount }} msgs · {{ formatRelativeDate(conv.updatedAt) }}
                    </span>
                </div>
                <div class="ai-history-item-actions" @click.stop>
                    <button class="ai-btn-icon ai-btn-tiny" title="Rename" @click="$emit('start-rename', conv)">
                        <svg
                            width="9"
                            height="9"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                    </button>
                    <button
                        class="ai-btn-icon ai-btn-tiny ai-btn-danger"
                        title="Delete"
                        @click="$emit('delete', conv.id)"
                    >
                        <svg
                            width="9"
                            height="9"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2.5"
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
</template>

<style lang="scss" scoped>
.ai-history-panel {
    flex-shrink: 0;
    max-height: 45%;
    display: flex;
    flex-direction: column;
    border-bottom: 1px solid var(--text3);
    -webkit-app-region: no-drag;
}

.ai-history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.5rem 0.75rem 0.35rem;
}

.ai-history-title {
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--text2);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}

.ai-history-list {
    flex: 1;
    overflow-y: auto;
    padding: 0 0.5rem 0.5rem;
}

.ai-history-empty {
    font-size: 0.75rem;
    color: var(--text2);
    text-align: center;
    padding: 1rem 0;
}

.ai-history-item {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.45rem 0.55rem;
    border-radius: 8px;
    cursor: pointer;
    transition: background 0.12s;

    &:hover {
        background: var(--bg-hover);
        .ai-history-item-actions {
            opacity: 1;
        }
    }

    &.active {
        background: var(--bg-hover);
        .ai-history-item-title {
            color: var(--accent-color);
        }
    }
}

.ai-history-item-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
}

.ai-history-item-title {
    font-size: 0.78rem;
    color: var(--text1);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
}

.ai-history-item-meta {
    font-size: 0.66rem;
    color: var(--text2);
    opacity: 0.7;
}

.ai-history-item-actions {
    display: flex;
    gap: 0.1rem;
    opacity: 0;
    transition: opacity 0.15s;
    flex-shrink: 0;
}

.ai-history-rename-input {
    width: 100%;
    background: var(--bg-primary);
    color: var(--text1);
    border: 1px solid var(--accent-color);
    border-radius: 4px;
    padding: 0.15rem 0.35rem;
    font-size: 0.78rem;
    font-family: inherit;
    outline: none;
}

.ai-btn-icon {
    background: none;
    border: none;
    color: var(--text2);
    cursor: pointer;
    padding: 0.3rem;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;
    flex-shrink: 0;
    &:hover:not(:disabled) {
        background: var(--bg-hover);
        color: var(--text1);
    }
    &:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }
}

.ai-btn-tiny {
    padding: 0.2rem !important;
}
.ai-btn-danger {
    &:hover:not(:disabled) {
        color: var(--danger-color);
    }
}
</style>
