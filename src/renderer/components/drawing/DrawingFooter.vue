<script setup lang="ts">
defineProps<{
    zoom: number;
    zoomPercent: number;
    historyIndex: number;
    historyLength: number;
    isSaving: boolean;
    hasUnsavedChanges: boolean;
}>();

const emit = defineEmits<{
    zoomToCenter: [value: number];
    undo: [];
    redo: [];
    clearAll: [];
    openExportDialog: [];
}>();
</script>

<template>
    <footer class="canvas-footer" aria-label="Canvas controls">
        <div class="footer-left">
            <div class="zoom-controls" role="group" aria-label="Zoom controls">
                <button class="zoom-btn" aria-label="Zoom out" @click="emit('zoomToCenter', zoom - 0.1)">
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        aria-hidden="true"
                        focusable="false"
                    >
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                </button>
                <button class="zoom-value" aria-label="Reset zoom to 100%" @click="emit('zoomToCenter', 1)">
                    <span aria-hidden="true">{{ zoomPercent }}%</span>
                </button>
                <button class="zoom-btn" aria-label="Zoom in" @click="emit('zoomToCenter', zoom + 0.1)">
                    <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        aria-hidden="true"
                        focusable="false"
                    >
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                </button>
            </div>
        </div>

        <div class="footer-center">
            <button class="footer-btn" :disabled="historyIndex <= 0" aria-label="Undo (Cmd+Z)" @click="emit('undo')">
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                    focusable="false"
                >
                    <path d="M3 7v6h6" />
                    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                </svg>
            </button>
            <button
                class="footer-btn"
                :disabled="historyIndex >= historyLength - 1"
                aria-label="Redo (Cmd+Shift+Z)"
                @click="emit('redo')"
            >
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                    focusable="false"
                >
                    <path d="M21 7v6h-6" />
                    <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
                </svg>
            </button>
            <button class="footer-btn" aria-label="Clear canvas" @click="emit('clearAll')">
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                    focusable="false"
                >
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
            </button>
        </div>

        <div class="footer-right">
            <output
                v-if="isSaving || hasUnsavedChanges"
                class="save-status"
                :class="{ saving: isSaving, unsaved: hasUnsavedChanges }"
                role="status"
                aria-live="polite"
                aria-atomic="true"
            >
                {{ isSaving ? 'Saving...' : 'Unsaved' }}
            </output>
            <button class="footer-btn export-btn" aria-label="Export image" @click="emit('openExportDialog')">
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    aria-hidden="true"
                    focusable="false"
                >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
            </button>
        </div>
    </footer>
</template>

<style scoped lang="scss">
.canvas-footer {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 $space-3;
    background: $bg-primary;
    backdrop-filter: blur(8px);
    border-top: 1px solid $border-color;
    z-index: $z-mid;
}

.footer-left,
.footer-center,
.footer-right {
    display: flex;
    align-items: center;
    gap: $space-1;
}

.footer-left {
    min-width: 140px;
}
.footer-right {
    min-width: 140px;
    justify-content: flex-end;
}

.zoom-controls {
    display: flex;
    align-items: center;
    gap: 0;
    border: 1px solid $border-color;
    border-radius: $border-radius;
    overflow: hidden;
}

.zoom-btn,
.zoom-value {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 28px;
    border: none;
    background: transparent;
    color: $text2;
    cursor: pointer;
    transition: background $transition-base;

    &:hover {
        background: $bg-hover;
        color: $text1;
    }
}

.zoom-btn {
    width: 28px;
    padding: 0;
}

.zoom-value {
    padding: 0 $space-2;
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;
    min-width: 46px;
    border-left: 1px solid $border-color;
    border-right: 1px solid $border-color;
}

.footer-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: none;
    border-radius: $border-radius;
    background: transparent;
    color: $text2;
    cursor: pointer;
    transition:
        background $transition-fast,
        color $transition-fast;

    &:hover:not(:disabled) {
        background: $bg-hover;
        color: $text1;
    }

    &:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }
}

.save-status {
    font-size: $font-size-xs;
    font-weight: $font-weight-medium;

    &.saving {
        color: $text-muted;
        font-style: italic;
    }

    &.unsaved {
        color: $accent-color;
    }
}

.export-btn {
    margin-left: $space-2;
}
</style>
