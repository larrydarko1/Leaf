<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import type { ConversationMeta } from '../../types/ai';

const props = defineProps<{
    conversationList: ConversationMeta[];
    currentConversationId: string | null;
    renamingConversationId: string | null;
    renameValue: string;
}>();

defineEmits<{
    (e: 'load' | 'confirm-rename' | 'delete' | 'update:renameValue', value: string): void;
    (e: 'start-rename', conv: ConversationMeta): void;
    (e: 'cancel-rename'): void;
}>();

const renameInputRef = ref<HTMLInputElement[]>();

watch(
    () => props.renamingConversationId,
    async (id) => {
        if (id !== null && id !== '') {
            await nextTick();
            renameInputRef.value?.[0]?.focus();
            renameInputRef.value?.[0]?.select();
        }
    },
);

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
    <nav
        class="ai-history-panel"
        aria-label="Conversation history">
        <!-- Header -->
        <header class="ai-history-header">
            <h2 class="ai-history-title">History</h2>
        </header>

        <!-- Conversation list -->
        <section
            class="ai-history-list"
            aria-live="polite"
            aria-label="Saved conversations">
            <div
                v-if="conversationList.length === 0"
                class="ai-history-empty"
                role="status">
                No conversations yet
            </div>

            <ul
                v-else
                class="ai-history-items"
                role="list">
                <li
                    v-for="conv in conversationList"
                    :key="conv.id"
                    class="ai-history-item"
                    :class="{ active: currentConversationId === conv.id }"
                    role="listitem">
                    <button
                        class="ai-history-item-button"
                        :aria-current="currentConversationId === conv.id ? 'page' : false"
                        :aria-label="`Open conversation: ${conv.title}`"
                        @click="$emit('load', conv.id)">
                        <!-- Item content area -->
                        <div class="ai-history-item-content">
                            <span
                                v-if="renamingConversationId === conv.id"
                                class="ai-history-item-title">
                                <input
                                    ref="renameInputRef"
                                    :value="renameValue"
                                    type="text"
                                    class="ai-history-rename-input"
                                    aria-label="Rename conversation"
                                    @input="$emit('update:renameValue', ($event.target as HTMLInputElement).value)"
                                    @keydown.enter.prevent="$emit('confirm-rename', conv.id)"
                                    @keydown.escape.prevent="$emit('cancel-rename')"
                                    @blur="$emit('confirm-rename', conv.id)"
                                    @click.stop />
                            </span>
                            <span
                                v-else
                                class="ai-history-item-title"
                                >{{ conv.title }}</span
                            >
                            <span
                                class="ai-history-item-meta"
                                aria-label="Conversation metadata">
                                {{ conv.messageCount }} msgs · {{ formatRelativeDate(conv.updatedAt) }}
                            </span>
                        </div>
                    </button>

                    <!-- Item actions -->
                    <div
                        class="ai-history-item-actions"
                        role="group"
                        aria-label="Conversation actions">
                        <button
                            class="ai-btn-icon ai-btn-tiny"
                            type="button"
                            title="Rename conversation"
                            aria-label="Rename this conversation"
                            @click.stop="$emit('start-rename', conv)">
                            <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                aria-hidden="true">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                            </svg>
                        </button>
                        <button
                            class="ai-btn-icon ai-btn-tiny ai-btn-danger"
                            type="button"
                            title="Delete conversation"
                            aria-label="Delete this conversation"
                            @click.stop="$emit('delete', conv.id)">
                            <svg
                                width="12"
                                height="12"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2.5"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                                aria-hidden="true">
                                <polyline points="3 6 5 6 21 6" />
                                <path
                                    d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                        </button>
                    </div>
                </li>
            </ul>
        </section>
    </nav>
</template>

<style lang="scss" scoped>
/* ––– Root Container ––– */

.ai-history-panel {
    flex-shrink: 0;
    max-height: 45%;
    display: flex;
    flex-direction: column;
    border-bottom: 1px solid $text3;
}

/* ––– Header Section ––– */

.ai-history-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: $space-2 $space-3 $space-1;
}

.ai-history-title {
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
    color: $text2;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin: 0;
}

/* ––– List Container ––– */

.ai-history-list {
    flex: 1;
    overflow-y: auto;
    padding: 0 $space-2 $space-2;
}

.ai-history-items {
    list-style: none;
    margin: 0;
    padding: 0;
}

.ai-history-empty {
    font-size: $font-size-xs;
    color: $text2;
    text-align: center;
    padding: $space-4 0;
}

/* ––– List Item Container ––– */

.ai-history-item {
    display: flex;
    align-items: center;
    gap: $space-1;
    margin: $space-1 0;
    padding: $space-2;
    border-radius: $border-radius-lg;
    transition: background $transition-fast;

    &:hover {
        background: $bg-hover;

        .ai-history-item-actions {
            opacity: 1;
        }
    }

    &.active {
        background: $bg-hover;

        .ai-history-item-title {
            color: $accent-color;
        }
    }
}

.ai-history-item-button {
    flex: 1;
    min-width: 0;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
    font-family: inherit;
    color: inherit;
    display: flex;
    align-items: center;
    gap: $space-1;

    &:focus-visible {
        outline: 2px solid $accent-color;
        outline-offset: 2px;
        border-radius: $border-radius-sm;
    }
}

/* ––– Item Content Area ––– */

.ai-history-item-content {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: $space-0;
}

.ai-history-item-title {
    font-size: $font-size-xs;
    color: $text1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: $line-height;
}

.ai-history-item-meta {
    font-size: $font-size-xxs;
    color: $text2;
    opacity: 0.7;
}

.ai-history-rename-input {
    width: 100%;
    background: $bg-primary;
    color: $text1;
    border: 1px solid $accent-color;
    border-radius: $border-radius-sm;
    padding: $space-0 $space-1;
    font-size: $font-size-xs;
    font-family: inherit;
    outline: none;

    &:focus {
        box-shadow: 0 0 0 2px rgb($accent-color / 10%);
    }
}

/* ––– Item Actions ––– */

.ai-history-item-actions {
    display: flex;
    gap: $space-2;
    opacity: 0;
    transition: opacity $transition-fast;
    flex-shrink: 0;
}

.ai-btn-icon {
    background: none;
    border: none;
    color: $text2;
    cursor: pointer;
    padding: $space-1;
    border-radius: $border-radius-sm;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all $transition-base;
    flex-shrink: 0;
    font-size: 0;

    &:hover:not(:disabled) {
        background: $bg-hover;
        color: $text1;
    }

    &:focus-visible {
        outline: 2px solid $accent-color;
        outline-offset: 2px;
    }

    &:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }
}

.ai-btn-tiny {
    padding: $space-1;
}

.ai-btn-danger {
    &:hover:not(:disabled) {
        color: $danger-color;
    }
}
</style>
