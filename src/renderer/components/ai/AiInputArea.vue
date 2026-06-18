<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useThrottleFn } from '@vueuse/core';
import type { FileInfo } from '@/types/electron';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

type Props = {
    agentMode: boolean;
    includeNoteContext: boolean;
    activeFile: FileInfo | null;
    inputMessage: string;
    isReady: boolean;
    isAnyGenerating: boolean;
    isStreaming: boolean;
    inputField: HTMLTextAreaElement | null;
};

const props = defineProps<Props>();
void props;

defineEmits<{
    'update:inputMessage': [value: string];
    'update:includeNoteContext': [value: boolean];
    'send': [];
    'stop': [];
}>();

const inputAreaRef = ref<HTMLDivElement | null>(null);
const isResizing = ref(false);
const maxHeightPx = ref(120);
const minHeight = 40;
const maxHeight = 150;

function startResize(e: MouseEvent) {
    e.preventDefault();
    isResizing.value = true;
    const startY = e.clientY;
    const startHeight = maxHeightPx.value;

    // Prevent text selection during drag
    const originalUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    type ThrottledMouseMoveFn = ((moveEvent: MouseEvent) => void) & { cancel?: () => void };
    const handleMouseMove = useThrottleFn((moveEvent: MouseEvent) => {
        const delta = startY - moveEvent.clientY;
        const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + delta));
        maxHeightPx.value = newHeight;
    }, 16) as unknown as ThrottledMouseMoveFn;

    const handleMouseUp = () => {
        isResizing.value = false;
        document.body.style.userSelect = originalUserSelect;
        // Save the new height preference
        localStorage.setItem('ai-input-max-height', maxHeightPx.value.toString());
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        handleMouseMove.cancel?.();
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
}

onMounted(() => {
    // Restore saved height preference if available
    const saved = localStorage.getItem('ai-input-max-height');
    if (saved !== null && saved !== '') {
        const value = parseInt(saved, 10);
        if (!isNaN(value) && value >= minHeight && value <= maxHeight) {
            maxHeightPx.value = value;
        }
    }
});
</script>

<template>
    <div
        ref="inputAreaRef"
        class="ai-input-area">
        <div
            class="ai-resize-handle"
            :class="{ 'ai-resize-active': isResizing }"
            :title="t('ai.drag_to_resize_input_area')"
            @mousedown="startResize">
            <div class="ai-resize-grip" />
        </div>

        <!-- Agent mode indicator -->
        <div
            v-if="agentMode"
            class="ai-agent-indicator">
            <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true">
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
            </svg>
            <span
                v-if="activeFile"
                class="ai-agent-file-name"
                :aria-label="t('ai.agent_mode_active_with_file', { file: activeFile.name })"
                >{{ t('ai.agent_mode_active_with_file', { file: activeFile.name }) }}</span
            >
            <span
                v-else
                class="ai-agent-no-file"
                :aria-label="t('ai.agent_mode_active_no_file')"
                >{{ t('ai.agent_mode_active_no_file') }}</span
            >
        </div>

        <!-- Context inclusion indicator -->
        <div
            v-if="includeNoteContext && activeFile"
            class="ai-context-hint">
            <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
            </svg>
            <span :aria-label="t('ai.current_note_included_as_context', { file: activeFile.name })">{{
                t('ai.current_note_included_as_context', { file: activeFile.name })
            }}</span>
        </div>

        <div class="ai-input-row">
            <label
                class="ai-context-toggle"
                :title="t('ai.include_current_note_as_context')">
                <input
                    :checked="includeNoteContext"
                    type="checkbox"
                    :disabled="!activeFile"
                    :aria-label="t('ai.include_current_note_as_context')"
                    @change="$emit('update:includeNoteContext', ($event.target as HTMLInputElement).checked)" />
                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    :class="{ 'ai-context-active': includeNoteContext && activeFile }"
                    aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
                </svg>
            </label>
            <textarea
                ref="inputField"
                :value="inputMessage"
                :placeholder="t('ai.ask_something')"
                class="ai-input"
                :style="{ height: maxHeightPx + 'px' }"
                :disabled="!isReady || isAnyGenerating"
                rows="1"
                aria-label="AI message input"
                @input="$emit('update:inputMessage', ($event.target as HTMLTextAreaElement).value)"
                @keydown.enter.exact.prevent="$emit('send')" />
            <button
                v-if="isStreaming"
                class="ai-btn-send ai-btn-stop"
                :title="t('ai.stop_generating')"
                :aria-label="t('ai.stop_generating')"
                @click="$emit('stop')">
                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="var(--text3)"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true">
                    <rect
                        x="6"
                        y="6"
                        width="12"
                        height="12"
                        rx="2"
                        ry="2" />
                </svg>
            </button>
            <button
                v-else
                class="ai-btn-send"
                :disabled="!inputMessage.trim() || !isReady || isStreaming"
                :title="t('ai.send_message')"
                :aria-label="t('ai.send_message')"
                @click="$emit('send')">
                <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    aria-hidden="true">
                    <g
                        id="SVGRepo_bgCarrier"
                        stroke-width="0"></g>
                    <g
                        id="SVGRepo_tracerCarrier"
                        stroke-linecap="round"
                        stroke-linejoin="round"></g>
                    <g id="SVGRepo_iconCarrier">
                        <path
                            d="M10 14L13 21L20 4L3 11L6.5 12.5"
                            stroke="var(--text3)"
                            stroke-width="1.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"></path>
                    </g>
                </svg>
            </button>
        </div>
    </div>
</template>

<style lang="scss" scoped>
/* ––– Root Container ––– */

.ai-input-area {
    display: flex;
    flex-direction: column;
    padding: $space-2 $space-3 $space-3;
    flex-shrink: 0;
    user-select: none;
}

/* ––– Resize Handle ––– */

.ai-resize-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 12px;
    margin-top: $space-1;
    cursor: ns-resize;
    transition: background-color $transition-base;
    user-select: none;
    pointer-events: auto;

    &:hover,
    &.ai-resize-active {
        background: transparent;

        .ai-resize-grip {
            background-color: $accent-color;
            opacity: 1;
        }
    }

    &.ai-resize-active {
        user-select: none;
        background: transparent;
    }
}

.ai-resize-grip {
    width: 40px;
    height: 3px;
    background-color: $text3;
    border-radius: $border-radius-xs;
    opacity: 0.4;
    transition:
        opacity $transition-base,
        background-color $transition-base;
}

/* ––– Agent Mode Indicator ––– */

.ai-agent-indicator {
    display: flex;
    align-items: center;
    gap: $space-1;
    font-size: $font-size-xs;
    color: $accent-color;
    padding: 0 $space-1 $space-2;
    flex-wrap: wrap;

    svg {
        flex-shrink: 0;
    }

    span {
        font-weight: $font-weight-semibold;
        white-space: nowrap;
    }
}

/* ––– Context Hint ––– */

.ai-context-hint {
    display: flex;
    align-items: center;
    gap: $space-1;
    font-size: $font-size-xs;
    color: $accent-color;
    padding: 0 $space-1 $space-2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

/* ––– Input Row ––– */

.ai-input-row {
    display: flex;
    align-items: flex-start;
    gap: 0;
    background: $bg-primary;
    border: 1px solid $text3;
    border-radius: $border-radius-xl;
    padding: $space-1 $space-1 $space-1 $space-2;
    transition: border-color $transition-base;

    &:focus-within {
        border-color: $accent-color;
    }
}

/* ––– Context Toggle ––– */

.ai-context-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: $space-3 $space-1;
    color: $text2;
    flex-shrink: 0;
    border-radius: $border-radius;
    transition:
        color $transition-fast,
        background $transition-fast;

    input {
        display: none;
    }

    &:hover {
        color: $text1;
        background: $bg-hover;
    }
}

.ai-context-active {
    color: $accent-color;
}

/* ––– Message Input ––– */

.ai-input {
    flex: 1;
    min-width: 0;
    padding: $space-2;
    background: transparent;
    color: $text1;
    border: none;
    font-size: $font-size-sm;
    font-family: inherit;
    line-height: $line-height;
    resize: none;
    overflow-y: auto;

    &::placeholder {
        color: $text2;
    }

    &:focus {
        outline: none;
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
}

/* ––– Send / Stop Button ––– */

.ai-btn-send {
    background: $accent-color;
    color: $text1;
    border: none;
    border-radius: $border-radius-lg;
    width: 40px;
    height: 40px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition:
        opacity $transition-base,
        transform $transition-fast,
        color $transition-fast;

    &:hover:not(:disabled) {
        opacity: 0.85;
        transform: scale(1.05);
    }

    &:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }

    &.ai-btn-stop {
        background: $danger-color;

        &:hover {
            opacity: 0.85;
            transform: scale(1.05);
        }
    }
}
</style>
