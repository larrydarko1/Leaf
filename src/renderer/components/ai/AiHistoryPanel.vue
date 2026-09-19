<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import type { ConversationMeta } from '@/schemas/ai';
import { useI18n } from 'vue-i18n';

type Props = {
    conversationList: ConversationMeta[];
    currentConversationId: string | null;
    renamingConversationId: string | null;
    renameValue: string;
};

const props = defineProps<Props>();

defineEmits<{
    'load': [value: string];
    'confirm-rename': [value: string];
    'delete': [value: string];
    'update:renameValue': [value: string];
    'start-rename': [conv: ConversationMeta];
    'cancel-rename': [];
}>();

const { t } = useI18n();

const renameInputRef = ref<HTMLInputElement[]>([]);

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
</script>

<template>
    <nav
        class="ai-history-panel stack"
        :aria-label="t('ai.conversation_history')">
        <!-- Header -->
        <header class="ai-history-header row">
            <h2 class="ai-history-title panel-label">{{ t('ai.history') }}</h2>
        </header>

        <!-- Conversation list -->
        <section
            class="ai-history-list fill scroll-y"
            aria-live="polite"
            :aria-label="t('ai.saved_conversations')">
            <div
                v-if="conversationList.length === 0"
                class="ai-history-empty list-empty"
                role="status">
                {{ t('ai.no_conversations_yet') }}
            </div>

            <ul
                v-else
                class="ai-history-items">
                <li
                    v-for="conv in conversationList"
                    :key="conv.id"
                    v-memo="[
                        conv.id,
                        currentConversationId,
                        renamingConversationId === conv.id,
                        renamingConversationId === conv.id && renameValue,
                    ]"
                    class="ai-history-item row"
                    :class="{ active: currentConversationId === conv.id }">
                    <button
                        class="ai-history-item-button row fill"
                        :aria-current="currentConversationId === conv.id ? 'page' : false"
                        :aria-label="t('ai.open_conversation', { title: conv.title })"
                        @click="$emit('load', conv.id)">
                        <!-- Item content area -->
                        <div class="ai-history-item-content stack fill">
                            <span
                                v-if="renamingConversationId === conv.id"
                                class="ai-history-item-title truncate">
                                <input
                                    ref="renameInputRef"
                                    :value="renameValue"
                                    type="text"
                                    class="ai-history-rename-input field field-sm"
                                    :aria-label="t('ai.rename_conversation')"
                                    @input="$emit('update:renameValue', ($event.target as HTMLInputElement).value)"
                                    @keydown.enter.prevent="$emit('confirm-rename', conv.id)"
                                    @keydown.escape.prevent="$emit('cancel-rename')"
                                    @blur="$emit('confirm-rename', conv.id)"
                                    @click.stop />
                            </span>
                            <span
                                v-else
                                class="ai-history-item-title truncate"
                                >{{ conv.title }}</span
                            >
                            <span
                                class="ai-history-item-meta"
                                :aria-label="t('ai.conversation_metadata')">
                                {{
                                    t('ai.history_item_meta', {
                                        count: conv.messageCount,
                                        date: formatRelativeDate(conv.updatedAt),
                                    })
                                }}
                            </span>
                        </div>
                    </button>

                    <!-- Item actions -->
                    <div
                        class="ai-history-item-actions"
                        role="group"
                        :aria-label="t('ai.conversation_actions')">
                        <button
                            class="ai-btn-icon ai-btn-tiny icon-btn"
                            type="button"
                            :title="t('ai.rename_conversation')"
                            :aria-label="t('ai.rename_conversation')"
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
                            class="ai-btn-icon ai-btn-tiny ai-btn-danger icon-btn icon-btn-danger"
                            type="button"
                            :title="t('ai.delete_conversation')"
                            :aria-label="t('ai.delete_conversation')"
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
// The history shares the AI panel's column with the message list, so it is capped
// as a fraction of it and scrolls inside that cap rather than pushing it.
.ai-history-panel {
    flex-shrink: 0;
    max-height: 45%;
    border-bottom: $border-width-thin $text3;
}

// Tighter than `.panel-header`: this labels a section inside a panel rather than
// the panel itself, so it sits closer to the list beneath it.
.ai-history-header {
    justify-content: space-between;
    padding: $space-2 $space-3 $space-1;
}

.ai-history-list {
    padding: 0 $space-2 $space-2;
}

.ai-history-items {
    list-style: none;
    margin: 0;
    padding: 0;
}

// Not `.result-item`: the row holds a button and an action cluster side by side,
// and hovering it reveals the cluster — a relationship the row has to own.
.ai-history-item {
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

// A button that is only a hit area: the row around it draws everything.
.ai-history-item-button {
    gap: $space-1;
    padding: 0;
    background: none;
    border: none;
    color: inherit;
    font-family: inherit;
    text-align: left;
    cursor: pointer;
}

.ai-history-item-content {
    gap: $space-0;
}

.ai-history-item-title {
    color: $text1;
    font-size: $font-size-xs;
    line-height: $line-height;
}

.ai-history-item-meta {
    color: $text2;
    font-size: $font-size-xxs;
    opacity: $opacity-mid-high;
}

.ai-history-item-actions {
    display: flex;
    flex-shrink: 0;
    gap: $space-2;
    opacity: 0;
    transition: opacity $transition-fast;
}
</style>
