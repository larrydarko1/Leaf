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
    <div class="canvas-footer">
        <div class="footer-left">
            <div class="zoom-controls">
                <button class="zoom-btn" title="Zoom out" @click="emit('zoomToCenter', zoom - 0.1)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                </button>
                <button class="zoom-value" title="Reset zoom" @click="emit('zoomToCenter', 1)">
                    {{ zoomPercent }}%
                </button>
                <button class="zoom-btn" title="Zoom in" @click="emit('zoomToCenter', zoom + 0.1)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                    </svg>
                </button>
            </div>
        </div>
        <div class="footer-center">
            <button class="footer-btn" :disabled="historyIndex <= 0" title="Undo (⌘Z)" @click="emit('undo')">
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path d="M3 7v6h6" />
                    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                </svg>
            </button>
            <button
                class="footer-btn"
                :disabled="historyIndex >= historyLength - 1"
                title="Redo (⌘⇧Z)"
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
                >
                    <path d="M21 7v6h-6" />
                    <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
                </svg>
            </button>
            <button class="footer-btn" title="Clear canvas" @click="emit('clearAll')">
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path d="M3 6h18" />
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                </svg>
            </button>
        </div>
        <div class="footer-right">
            <span v-if="isSaving" class="save-status saving">Saving...</span>
            <span v-else-if="hasUnsavedChanges" class="save-status unsaved">Unsaved</span>
            <button class="footer-btn export-btn" title="Export image" @click="emit('openExportDialog')">
                <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="7 10 12 15 17 10" />
                    <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
            </button>
        </div>
    </div>
</template>

<style scoped lang="scss">
// ─── Footer ──────────────────────────────────────────────────────────────────

.canvas-footer {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 40px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 12px;
    background: color-mix(in srgb, var(--bg-primary, #fff) 90%, transparent);
    backdrop-filter: blur(8px);
    border-top: 1px solid var(--border-color, #e0e0e0);
    z-index: 15;
}

.footer-left,
.footer-center,
.footer-right {
    display: flex;
    align-items: center;
    gap: 4px;
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
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 6px;
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
    color: var(--text2, #6e6e73);
    cursor: pointer;
    transition: background 0.12s;

    &:hover {
        background: var(--bg-hover, #f0f0f0);
        color: var(--text1, #1d1d1f);
    }
}

.zoom-btn {
    width: 28px;
    padding: 0;
}

.zoom-value {
    padding: 0 6px;
    font-size: 12px;
    font-weight: 500;
    min-width: 46px;
    border-left: 1px solid var(--border-color, #e0e0e0);
    border-right: 1px solid var(--border-color, #e0e0e0);
}

.footer-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text2, #6e6e73);
    cursor: pointer;
    transition:
        background 0.12s,
        color 0.12s;

    &:hover:not(:disabled) {
        background: var(--bg-hover, #f0f0f0);
        color: var(--text1, #1d1d1f);
    }

    &:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }
}

.save-status {
    font-size: 12px;
    font-weight: 500;

    &.saving {
        color: var(--text-muted, #8e8e93);
        font-style: italic;
    }

    &.unsaved {
        color: var(--accent-color, #3eb489);
    }
}

.export-btn {
    margin-left: 8px;
}
</style>
