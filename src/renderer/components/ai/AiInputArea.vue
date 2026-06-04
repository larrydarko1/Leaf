<script setup lang="ts">
import { ref, onMounted } from 'vue';
import type { FileInfo } from '../../types/electron';

defineProps<{
    agentMode: boolean;
    includeNoteContext: boolean;
    activeFile: FileInfo | null;
    inputMessage: string;
    isReady: boolean;
    isAnyGenerating: boolean;
    isStreaming: boolean;
    inputField: HTMLTextAreaElement | null;
}>();

defineEmits<{
    (e: 'update:inputMessage', value: string): void;
    (e: 'update:includeNoteContext', value: boolean): void;
    (e: 'send'): void;
    (e: 'stop'): void;
}>();

const inputAreaRef = ref<HTMLDivElement>(null!);
const isResizing = ref(false);
const maxHeightPx = ref(120);
const minHeight = 31;
const maxHeight = 150;

function startResize(e: MouseEvent) {
    e.preventDefault();
    isResizing.value = true;
    const startY = e.clientY;
    const startHeight = maxHeightPx.value;

    // Prevent text selection during drag
    const originalUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
        const delta = startY - moveEvent.clientY;
        const newHeight = Math.max(minHeight, Math.min(maxHeight, startHeight + delta));
        maxHeightPx.value = newHeight;
    };

    const handleMouseUp = () => {
        isResizing.value = false;
        document.body.style.userSelect = originalUserSelect;
        // Save the new height preference
        localStorage.setItem('ai-input-max-height', maxHeightPx.value.toString());
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
}

onMounted(() => {
    // Restore saved height preference if available
    const saved = localStorage.getItem('ai-input-max-height');
    if (saved) {
        const value = parseInt(saved, 10);
        if (!isNaN(value) && value >= minHeight && value <= maxHeight) {
            maxHeightPx.value = value;
        }
    }
});
</script>

<template>
    <div ref="inputAreaRef" class="ai-input-area">
        <div
            class="ai-resize-handle"
            :class="{ 'ai-resize-active': isResizing }"
            title="Drag to resize input area"
            @mousedown="startResize"
        >
            <div class="ai-resize-grip" />
        </div>
        <div v-if="agentMode" class="ai-agent-indicator">
            <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
            >
                <polyline points="16 18 22 12 16 6" />
                <polyline points="8 6 2 12 8 18" />
            </svg>
            <span v-if="activeFile" class="ai-agent-file-name">Agent · {{ activeFile.name }}</span>
            <span v-else class="ai-agent-no-file">Agent · No file open</span>
        </div>
        <div v-if="includeNoteContext && activeFile" class="ai-context-hint">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
            </svg>
            {{ activeFile.name }}
        </div>
        <div class="ai-input-row">
            <label class="ai-context-toggle" title="Include current note as context">
                <input
                    :checked="includeNoteContext"
                    type="checkbox"
                    :disabled="!activeFile"
                    @change="$emit('update:includeNoteContext', ($event.target as HTMLInputElement).checked)"
                />
                <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    :class="{ 'ai-context-active': includeNoteContext && activeFile }"
                >
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
                </svg>
            </label>
            <textarea
                ref="inputField"
                :value="inputMessage"
                placeholder="Ask something..."
                class="ai-input"
                :style="{ height: maxHeightPx + 'px' }"
                :disabled="!isReady || isAnyGenerating"
                rows="1"
                @input="$emit('update:inputMessage', ($event.target as HTMLTextAreaElement).value)"
                @keydown.enter.exact.prevent="$emit('send')"
            />
            <button v-if="isStreaming" class="ai-btn-send ai-btn-stop" title="Stop generating" @click="$emit('stop')">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="var(--text3)" xmlns="http://www.w3.org/2000/svg">
                    <rect x="6" y="6" width="12" height="12" rx="2" ry="2" />
                </svg>
            </button>
            <button
                v-else
                class="ai-btn-send"
                :disabled="!inputMessage.trim() || !isReady || isStreaming"
                title="Send message"
                @click="$emit('send')"
            >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <g id="SVGRepo_bgCarrier" stroke-width="0"></g>
                    <g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g>
                    <g id="SVGRepo_iconCarrier">
                        <path
                            d="M10 14L13 21L20 4L3 11L6.5 12.5"
                            stroke="var(--text3)"
                            stroke-width="1.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        ></path>
                    </g>
                </svg>
            </button>
        </div>
    </div>
</template>

<style lang="scss" scoped>
.ai-input-area {
    display: flex;
    flex-direction: column;
    padding: 0.5rem 0.75rem 0.75rem;
    flex-shrink: 0;
    user-select: none;
}

.ai-agent-indicator {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.7rem;
    color: $accent-color;
    padding: 0 0.25rem 0.4rem;
    flex-wrap: wrap;
    svg {
        flex-shrink: 0;
    }
    span {
        font-weight: 600;
        white-space: nowrap;
    }
}

.ai-context-hint {
    display: flex;
    align-items: center;
    gap: 0.35rem;
    font-size: 0.7rem;
    color: $accent-color;
    padding: 0 0.25rem 0.4rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.ai-input-row {
    display: flex;
    align-items: flex-start;
    gap: 0;
    background: $bg-primary;
    border: 1px solid $text3;
    border-radius: 12px;
    padding: 0.2rem 0.2rem 0.2rem 0.35rem;
    transition: border-color 0.2s;
    &:focus-within {
        border-color: $accent-color;
    }
}

.ai-context-toggle {
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    padding: 0.5em 0.3em;
    color: $text2;
    flex-shrink: 0;
    border-radius: 0.375em;
    transition:
        color 0.15s,
        background 0.15s;
    input {
        display: none;
    }
    &:hover {
        color: $text1;
        background: $bg-hover;
    }
}

.ai-context-active {
    color: $accent-color !important;
}

.ai-input {
    flex: 1;
    min-width: 0;
    padding: 0.4rem 0.5rem;
    background: transparent;
    color: $text1;
    border: none;
    font-size: 0.82rem;
    font-family: inherit;
    line-height: 1.4;
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

.ai-btn-send {
    background: $accent-color;
    color: $text1;
    border: none;
    border-radius: 8px;
    width: 30px;
    height: 30px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition:
        opacity 0.2s,
        transform 0.15s,
        color 0.15s;
    &:hover:not(:disabled) {
        opacity: 0.85;
        transform: scale(1.05);
    }
    &:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }

    &.ai-btn-stop {
        background: var(--danger-color, #e74c3c);
        &:hover {
            opacity: 0.85;
            transform: scale(1.05);
        }
    }
}

.ai-resize-handle {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 12px;
    margin-top: 0.35em;
    cursor: ns-resize;
    transition: background-color 0.2s;
    user-select: none;
    pointer-events: auto;

    &:hover,
    &.ai-resize-active {
        background-color: rgba(0, 0, 0, 0.05);
        .ai-resize-grip {
            background-color: $accent-color;
            opacity: 1;
        }
    }

    &.ai-resize-active {
        user-select: none;
        background-color: rgba(0, 0, 0, 0.08);
    }
}

.ai-resize-grip {
    width: 40px;
    height: 3px;
    background-color: $text3;
    border-radius: 0.125em;
    opacity: 0.4;
    transition:
        opacity 0.2s,
        background-color 0.2s;
}
</style>
