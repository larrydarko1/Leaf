<script setup lang="ts">
import { ref, watch, nextTick } from 'vue';
import type { ChatMessage } from '../../types/chat';
import type { AiModelInfo, AiStatus } from '../../types/ai';
import AiAgentEditCard from './AiAgentEditCard.vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

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
    (
        e:
            | 'scroll'
            | 'cancel-edit'
            | 'regenerate'
            | 'delete-last-pair'
            | 'open-models-folder'
            | 'open-history'
            | 'load-previous-model',
    ): void;
    (e: 'copy', content: string, index: number): void;
    (e: 'copy-code' | 'update:editContent', value: string): void;
    (e: 'start-edit' | 'confirm-edit' | 'resend', index: number): void;
    (e: 'approve-agent-edit' | 'reject-agent-edit', msgIndex: number, editIndex: number): void;
}>();

const editInputRef = ref<HTMLTextAreaElement[]>();

const copyIconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
const checkIconSvg = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;

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

/**
 * Extract all fenced code blocks from a markdown string.
 * Returns an array of { code, lang } objects.
 */
function extractCodeBlocks(content: string): { code: string; lang: string }[] {
    const blocks: { code: string; lang: string }[] = [];
    const regex = /```([^\n]*)\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
        blocks.push({ lang: match[1].trim(), code: match[2] });
    }
    return blocks;
}

/**
 * Wraps each <pre> block in the rendered HTML with a relative-positioned
 * container that holds a copy button overlay.
 */
function renderWithCopyBtns(content: string): string {
    const html = props.renderMarkdown(content);
    let blockIdx = 0;
    return html
        .replace(/<pre>/g, () => {
            const btn = `<button class="ai-code-copy-btn" data-block-idx="${blockIdx++}" title="Copy code" aria-label="Copy code">${copyIconSvg}</button>`;
            return `<div class="ai-pre-wrapper">${btn}<pre>`;
        })
        .replace(/<\/pre>/g, '</pre></div>');
}

async function onMarkdownClick(content: string, event: MouseEvent) {
    const target = event.target as Element;
    const closest = target.closest('.ai-code-copy-btn');
    const btn = closest instanceof HTMLButtonElement ? closest : null;
    if (btn === null) return;

    const idx = parseInt(btn.dataset.blockIdx ?? '-1', 10);
    if (idx < 0) return;

    const code = extractCodeBlocks(content)[idx]?.code;
    if (code === undefined || code === '') return;

    try {
        await window.electronAPI.writeClipboard(code);
        btn.innerHTML = checkIconSvg;
        btn.title = t('ai.copied');
        btn.setAttribute('aria-label', t('ai.copied'));
        setTimeout(() => {
            btn.innerHTML = copyIconSvg;
            btn.title = t('ai.copy_code');
            btn.setAttribute('aria-label', t('ai.copy_code'));
        }, 2000);
    } catch (err) {
        window.electronAPI.log.error('Failed to copy code:', err);
    }
}
</script>

<template>
    <!-- Chat messages container -->
    <section
        ref="messagesContainer"
        class="ai-messages"
        role="region"
        :aria-label="t('ai.chat_messages')"
        aria-live="polite"
        @scroll="$emit('scroll')">
        <!-- Empty state -->
        <div
            v-if="messages.length === 0"
            class="ai-empty-state"
            role="status">
            <div
                class="ai-empty-icon"
                aria-hidden="true">
                <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                    stroke-linecap="round"
                    stroke-linejoin="round">
                    <path
                        d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
                    <line
                        x1="9"
                        y1="21"
                        x2="15"
                        y2="21" />
                    <line
                        x1="10"
                        y1="24"
                        x2="14"
                        y2="24" />
                </svg>
            </div>
            <p class="ai-empty-text">
                {{ status.isModelLoaded ? t('ai.ask_anything') : t('ai.load_model_hint') }}
            </p>
            <button
                v-if="!status.isModelLoaded && availableModels.length === 0"
                class="ai-btn-secondary"
                :aria-label="t('ai.open_models_folder')"
                @click="$emit('open-models-folder')">
                {{ t('ai.open_models_folder') }}
            </button>
            <button
                v-if="!status.isModelLoaded && availableModels.length > 0"
                class="ai-btn-secondary"
                :aria-label="t('ai.browse_history')"
                @click="$emit('open-history')">
                {{ t('ai.browse_history') }}
            </button>
        </div>

        <!-- Messages list -->
        <div
            v-for="(msg, index) in messages"
            :key="index"
            class="ai-message"
            :class="msg.role"
            role="article"
            :aria-label="`${msg.role} message ${index + 1}`">
            <div class="ai-message-wrapper">
                <!-- User message: edit mode -->
                <div
                    v-if="msg.role === 'user' && editingIndex === index"
                    class="ai-message-edit">
                    <textarea
                        id="edit-input-user-msg"
                        ref="editInputRef"
                        :value="editContent"
                        class="ai-edit-input"
                        rows="2"
                        aria-label="Edit user message"
                        @input="$emit('update:editContent', ($event.target as HTMLTextAreaElement).value)"
                        @keydown.enter.exact.prevent="$emit('confirm-edit', index)"
                        @keydown.escape.prevent="$emit('cancel-edit')" />
                    <div class="ai-edit-actions">
                        <button
                            class="ai-btn-icon ai-btn-tiny"
                            :aria-label="t('ai.cancel_editing')"
                            @click="$emit('cancel-edit')">
                            <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2.5"
                                stroke-linecap="round"
                                stroke-linejoin="round">
                                <line
                                    x1="18"
                                    y1="6"
                                    x2="6"
                                    y2="18" />
                                <line
                                    x1="6"
                                    y1="6"
                                    x2="18"
                                    y2="18" />
                            </svg>
                        </button>
                        <button
                            class="ai-btn-icon ai-btn-tiny"
                            :aria-label="t('ai.save_changes_and_resend')"
                            @click="$emit('confirm-edit', index)">
                            <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2.5"
                                stroke-linecap="round"
                                stroke-linejoin="round">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- User message: normal mode -->
                <div
                    v-else-if="msg.role === 'user'"
                    class="ai-message-content">
                    {{ msg.content }}
                </div>

                <!-- System message -->
                <div
                    v-else-if="msg.role === 'system'"
                    class="ai-message-content ai-system-notice"
                    role="status">
                    <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        aria-hidden="true">
                        <circle
                            cx="12"
                            cy="12"
                            r="10" />
                        <line
                            x1="12"
                            y1="8"
                            x2="12"
                            y2="12" />
                        <line
                            x1="12"
                            y1="16"
                            x2="12.01"
                            y2="16" />
                    </svg>
                    <span>{{ msg.content }}</span>
                </div>

                <!-- Assistant message -->
                <div
                    v-else
                    class="ai-message-content ai-markdown"
                    role="article"
                    @click="onMarkdownClick(msg.content, $event)">
                    <div v-html="renderWithCopyBtns(msg.content)"></div>
                </div>

                <!-- Agent edit cards -->
                <div
                    v-if="msg.agentEdits && msg.agentEdits.length > 0"
                    class="ai-agent-edits">
                    <AiAgentEditCard
                        v-for="(edit, editIdx) in msg.agentEdits"
                        :key="editIdx"
                        :edit="edit"
                        @approve="$emit('approve-agent-edit', index, editIdx)"
                        @reject="$emit('reject-agent-edit', index, editIdx)" />
                </div>

                <!-- Streaming cursor -->
                <span
                    v-if="msg.role === 'assistant' && index === messages.length - 1 && isStreaming"
                    class="ai-cursor"
                    aria-hidden="true"
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
                    role="toolbar"
                    :aria-label="t('ai.message_actions', { role: msg.role, index: index + 1 })">
                    <button
                        class="ai-btn-action"
                        :aria-label="copiedIndex === index ? t('ai.copied') : t('ai.copy_message')"
                        @click="$emit('copy', msg.content, index)">
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
                            aria-hidden="true">
                            <rect
                                x="9"
                                y="9"
                                width="13"
                                height="13"
                                rx="2"
                                ry="2" />
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
                            aria-hidden="true">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    </button>
                    <button
                        v-if="msg.role === 'user'"
                        class="ai-btn-action"
                        :aria-label="t('ai.edit_message')"
                        @click="$emit('start-edit', index)">
                        <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                        </svg>
                    </button>
                    <button
                        v-if="msg.role === 'user' && index === messages.length - 1 && isReady"
                        class="ai-btn-action"
                        :aria-label="t('ai.resend_message')"
                        @click="$emit('resend', index)">
                        <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true">
                            <polyline points="1 4 1 10 7 10" />
                            <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                        </svg>
                    </button>
                    <button
                        v-if="msg.role === 'assistant' && index === messages.length - 1 && isReady"
                        class="ai-btn-action"
                        :aria-label="t('ai.regenerate_assistant_response')"
                        @click="$emit('regenerate')">
                        <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true">
                            <polyline points="23 4 23 10 17 10" />
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                        </svg>
                    </button>
                    <button
                        v-if="index === messages.length - 1"
                        class="ai-btn-action ai-btn-action-danger"
                        :aria-label="t('ai.delete_last_message_pair')"
                        @click="$emit('delete-last-pair')">
                        <svg
                            width="11"
                            height="11"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            aria-hidden="true">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    </section>

    <!-- Load model banner -->
    <aside
        v-if="!status.isModelLoaded && messages.length > 0"
        class="ai-load-model-banner"
        role="status"
        :aria-label="t('ai.model_status')">
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
                aria-hidden="true">
                <circle
                    cx="12"
                    cy="12"
                    r="10" />
                <line
                    x1="12"
                    y1="8"
                    x2="12"
                    y2="12" />
                <line
                    x1="12"
                    y1="16"
                    x2="12.01"
                    y2="16" />
            </svg>
            <span>{{ t('ai.load_model_to_continue') }}</span>
        </div>
        <button
            v-if="previousModelMatch"
            class="ai-load-model-btn"
            :disabled="isLoading"
            :aria-label="t('ai.load_model', { model: previousModelMatch.name })"
            @click="$emit('load-previous-model')">
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
                <polyline points="23 4 23 10 17 10" />
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            {{ isLoading ? t('ai.loading') : t('ai.load_model', { model: truncate(previousModelMatch.name, 20) }) }}
        </button>
    </aside>

    <!-- Token counter progress bar -->
    <div
        v-if="status.isModelLoaded && status.contextSize > 0"
        class="ai-token-bar"
        role="progressbar"
        :aria-valuenow="tokenUsagePercent"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-label="`Context tokens: ${formatTokenCount(conversationTokenCount)} of ${formatTokenCount(status.contextSize)}`">
        <div class="ai-token-bar-track">
            <div
                class="ai-token-bar-fill"
                :class="{ warning: tokenUsagePercent > 75, danger: tokenUsagePercent > 90 }"
                :style="{ width: tokenUsagePercent + '%' }"></div>
        </div>
        <span class="ai-token-label"
            >{{ formatTokenCount(conversationTokenCount) }} / {{ formatTokenCount(status.contextSize) }} ·
            {{ tokenUsagePercent }}%</span
        >
    </div>
</template>

<style lang="scss" scoped>
/* ––– Messages Container ––– */

.ai-messages {
    flex: 1;
    overflow-y: auto;
    padding: $space-3;
    display: flex;
    flex-direction: column;
    gap: $space-3;
}

/* ––– Empty State ––– */

.ai-empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    flex: 1;
    text-align: center;
    padding: $space-4;
}

.ai-empty-icon {
    color: $text3;
    margin-bottom: $space-3;
}

.ai-empty-text {
    font-size: $font-size-sm;
    color: $text2;
    line-height: $line-height;
    margin: 0;
}

.ai-btn-secondary {
    padding: $space-2 $space-4;
    background: transparent;
    color: $text2;
    border: 1px solid $text3;
    border-radius: $border-radius;
    font-size: $font-size-sm;
    cursor: pointer;
    transition: all $transition-base;
    margin-top: $space-5;

    &:hover {
        color: $text1;
        border-color: $text2;
    }

    &:focus-visible {
        outline: 2px solid $accent-color;
        outline-offset: 2px;
    }
}

/* ––– Message Items ––– */

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
            border-radius: $border-radius-xl $border-radius-xl $border-radius-xs $border-radius-xl;
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
            border-radius: $border-radius-xl $border-radius-xl $border-radius-xl $border-radius-xs;
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
    padding: $space-3 $space-4;
    font-size: $font-size-sm;
    line-height: $line-height;
    overflow-wrap: break-word;
    white-space: pre-wrap;
}

/* ––– System Message ––– */

.ai-system-notice {
    display: flex;
    align-items: center;
    gap: $space-2;
    background: $bg-secondary;
    border: 1px solid $border-color;
    border-radius: $border-radius-lg;
    padding: $space-2 $space-3;
    font-size: $font-size-xs;
    color: $text2;
    font-style: italic;
    white-space: normal;

    svg {
        flex-shrink: 0;
        opacity: 0.6;
    }
}

/* ––– Markdown Content ––– */

.ai-markdown {
    white-space: normal;
    position: relative;

    :deep(p) {
        margin: 0 0 $space-2;

        &:last-child {
            margin-bottom: 0;
        }
    }

    :deep(h1),
    :deep(h2),
    :deep(h3),
    :deep(h4) {
        margin: $space-3 0 $space-1 0;
        line-height: $line-height;

        &:first-child {
            margin-top: 0;
        }
    }

    :deep(h1) {
        font-size: $font-size-lg;
    }

    :deep(h2) {
        font-size: $font-size-base;
    }

    :deep(h3) {
        font-size: $font-size-sm;
    }

    :deep(ul),
    :deep(ol) {
        margin: $space-1 0;
        padding-left: $space-6;
    }

    :deep(li) {
        margin: $space-1 0;
    }

    :deep(code) {
        background: rgb(0 0 0 / 15%);
        padding: $space-0 $space-1;
        border-radius: $border-radius-xs;
        font-size: $font-size-sm;
        font-family: $font-family-mono;
    }

    :deep(pre) {
        background: rgb(0 0 0 / 20%);
        padding: $space-2 $space-3;
        border-radius: $border-radius;
        overflow-x: auto;
        margin: $space-2 0;
        position: relative;

        code {
            background: none;
            padding: 0;
            font-size: $font-size-sm;
        }
    }

    :deep(blockquote) {
        border-left: 3px solid $accent-color;
        margin: $space-2 0;
        padding: $space-1 $space-2;
        color: $text2;
    }

    :deep(table) {
        border-collapse: collapse;
        margin: $space-2 0;
        width: 100%;
        font-size: $font-size-sm;

        th,
        td {
            border: 1px solid $text3;
            padding: $space-1 $space-2;
            text-align: left;
        }

        th {
            background: rgb(0 0 0 / 10%);
        }
    }

    :deep(hr) {
        border: none;
        border-top: 1px solid $text3;
        margin: $space-2 0;
    }

    :deep(a) {
        color: $accent-color;
        text-decoration: underline;

        &:focus-visible {
            outline: 2px solid $accent-color;
            outline-offset: 2px;
        }
    }

    :deep(strong) {
        font-weight: $font-weight-semibold;
    }
}

.ai-markdown :deep(.ai-pre-wrapper) {
    position: relative;

    &:hover .ai-code-copy-btn,
    &:focus-within .ai-code-copy-btn {
        opacity: 1;
    }
}

.ai-markdown :deep(.ai-code-copy-btn) {
    position: absolute;
    top: 5.6px;
    right: 5.6px;
    background: rgb(0 0 0 / 35%);
    border: none;
    border-radius: $border-radius-sm;
    color: $text2;
    cursor: pointer;
    padding: $space-0 $space-1;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition:
        opacity $transition-fast,
        color $transition-fast,
        background $transition-fast;
    z-index: 1;

    &:hover {
        color: $text1;
        background: rgb(0 0 0 / 55%);
        opacity: 1;
    }

    &:focus-visible {
        opacity: 1;
        outline: 2px solid $accent-color;
        outline-offset: 2px;
    }
}

/* ––– Message Editing ––– */

.ai-message-edit {
    display: flex;
    flex-direction: column;
    gap: $space-1;
    width: 100%;
}

.ai-edit-input {
    width: 100%;
    min-height: 40px;
    max-height: 128px;
    padding: $space-2 $space-3;
    background: $bg-primary;
    color: $text1;
    border: 1px solid $accent-color;
    border-radius: $border-radius-lg;
    font-size: $font-size-sm;
    font-family: inherit;
    line-height: $line-height;
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
    gap: $space-1;
}

/* ––– Streaming Cursor ––– */

.ai-cursor {
    animation: blink 0.8s step-end infinite;
    color: $accent-color;
    font-size: $font-size-sm;
}

@keyframes blink {
    50% {
        opacity: 0;
    }
}

/* ––– Message Actions ––– */

.ai-message-actions {
    display: flex;
    align-items: center;
    gap: $space-0;
    opacity: 0;
    transition: opacity $transition-fast;
    margin-top: $space-0;
    padding: 0 $space-0;
}

.ai-btn-action {
    background: none;
    border: none;
    color: $text2;
    cursor: pointer;
    padding: $space-0 $space-1;
    border-radius: $border-radius-sm;
    transition:
        color $transition-fast,
        background $transition-fast;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
        color: $text1;
        background: $bg-hover;
    }

    &:focus-visible {
        outline: 2px solid $accent-color;
        outline-offset: 2px;
    }

    &.ai-btn-action-danger:hover {
        color: $danger-color;
    }
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

    &:hover:not(:disabled) {
        background: $bg-hover;
        color: $text1;
    }

    &:focus-visible {
        outline: 2px solid $accent-color;
        outline-offset: 2px;
    }
}

.ai-btn-tiny {
    padding: $space-1;
}

/* ––– Agent Edit Cards ––– */

.ai-agent-edits {
    display: flex;
    flex-direction: column;
    gap: $space-2;
    margin-top: $space-2;
    width: 100%;
}

/* ––– Load Model Banner ––– */

.ai-load-model-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: $space-2;
    padding: $space-2 $space-3;
    background: $bg-primary;
    border-top: 1px solid $text3;
    flex-shrink: 0;
}

.ai-load-model-banner-content {
    display: flex;
    align-items: center;
    gap: $space-2;
    font-size: $font-size-xs;
    color: $text2;

    svg {
        flex-shrink: 0;
        opacity: 0.7;
    }
}

.ai-load-model-btn {
    display: flex;
    align-items: center;
    gap: $space-1;
    padding: $space-1 $space-2;
    background: $accent-color;
    color: $base1;
    border: none;
    border-radius: $border-radius;
    font-size: $font-size-xs;
    font-weight: $font-weight-semibold;
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

    &:focus-visible {
        outline: 2px solid $base1;
        outline-offset: 2px;
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    svg {
        flex-shrink: 0;
    }
}

/* ––– Token Counter ––– */

.ai-token-bar {
    display: flex;
    align-items: center;
    gap: $space-2;
    padding: 0 $space-3;
    flex-shrink: 0;
}

.ai-token-bar-track {
    flex: 1;
    height: 3px;
    background: $text3;
    border-radius: $border-radius-xs;
    overflow: hidden;
}

.ai-token-bar-fill {
    height: 100%;
    background: $accent-color;
    border-radius: $border-radius-xs;
    transition: width $transition-slow;

    &.warning {
        background: $warning-color;
    }

    &.danger {
        background: $danger-color;
    }
}

.ai-token-label {
    font-size: $font-size-xs;
    color: $text2;
    white-space: nowrap;
    flex-shrink: 0;
    font-variant-numeric: tabular-nums;
}
</style>
