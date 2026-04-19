<script setup lang="ts">
import { ref, watch } from 'vue';
import type { CanvasElement } from '../../types/drawing';

const props = defineProps<{
    visible: boolean;
    hasSelection: boolean;
    isDark: boolean;
    filePath: string;
    elements: CanvasElement[];
    selectedIds: Set<string>;
    exportToBlob: (opts: {
        elements: CanvasElement[];
        withBackground: boolean;
        scale: number;
        darkMode: boolean;
    }) => Promise<Blob | null>;
}>();

const emit = defineEmits<{
    close: [];
}>();

// Export state
const exportWithBackground = ref(true);
const exportScale = ref(2);
const exportOnlySelected = ref(false);
const exportPreviewUrl = ref<string | null>(null);
const exportPreviewWidth = ref(0);
const exportPreviewHeight = ref(0);
const isExporting = ref(false);

const exportScaleOptions = [
    { label: '1x', value: 1 },
    { label: '2x', value: 2 },
    { label: '3x', value: 3 },
];

function getExportElements(): CanvasElement[] {
    return exportOnlySelected.value && props.hasSelection
        ? props.elements.filter((el) => props.selectedIds.has(el.id))
        : props.elements;
}

async function updateExportPreview() {
    if (exportPreviewUrl.value) {
        URL.revokeObjectURL(exportPreviewUrl.value);
        exportPreviewUrl.value = null;
    }

    const exportElements = getExportElements();
    if (exportElements.length === 0) return;

    const blob = await props.exportToBlob({
        elements: exportElements,
        withBackground: exportWithBackground.value,
        scale: exportScale.value,
        darkMode: props.isDark,
    });

    if (blob) {
        exportPreviewUrl.value = URL.createObjectURL(blob);
        const img = new Image();
        img.onload = () => {
            exportPreviewWidth.value = img.naturalWidth;
            exportPreviewHeight.value = img.naturalHeight;
        };
        img.src = exportPreviewUrl.value;
    }
}

function close() {
    if (exportPreviewUrl.value) {
        URL.revokeObjectURL(exportPreviewUrl.value);
        exportPreviewUrl.value = null;
    }
    emit('close');
}

async function savePng() {
    isExporting.value = true;
    try {
        const blob = await props.exportToBlob({
            elements: getExportElements(),
            withBackground: exportWithBackground.value,
            scale: exportScale.value,
            darkMode: props.isDark,
        });
        if (!blob) return;

        const baseName =
            props.filePath
                .split('/')
                .pop()
                ?.replace(/\.[^.]+$/, '') ?? 'drawing';
        const defaultName = `${baseName}.png`;

        const filePath = await window.electronAPI.showSaveDialog({
            defaultPath: defaultName,
            filters: [{ name: 'PNG Image', extensions: ['png'] }],
        });
        if (!filePath) return;

        const buffer = await blob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        await window.electronAPI.writeBuffer(filePath, base64);
    } finally {
        isExporting.value = false;
    }
}

async function copyClipboard() {
    isExporting.value = true;
    try {
        const blob = await props.exportToBlob({
            elements: getExportElements(),
            withBackground: exportWithBackground.value,
            scale: exportScale.value,
            darkMode: props.isDark,
        });
        if (!blob) return;
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    } finally {
        isExporting.value = false;
    }
}

// Update preview when dialog opens
watch(
    () => props.visible,
    (v) => {
        if (v) {
            exportOnlySelected.value = props.hasSelection;
            updateExportPreview();
        }
    },
);

// Update preview when settings change
watch([exportWithBackground, exportScale, exportOnlySelected], () => {
    if (props.visible) updateExportPreview();
});
</script>

<template>
    <teleport to="body">
        <transition name="export-fade">
            <div v-if="visible" class="export-overlay" @click.self="close">
                <div class="export-dialog">
                    <div class="export-preview">
                        <div>
                            <img
                                v-if="exportPreviewUrl"
                                :src="exportPreviewUrl"
                                alt="Export preview"
                                class="export-preview-img"
                            />
                            <div v-else class="export-empty">No elements to export</div>
                        </div>
                    </div>
                    <div class="export-settings">
                        <h3 class="export-title">Export image</h3>

                        <label class="export-toggle">
                            <span>Background</span>
                            <input v-model="exportWithBackground" type="checkbox" class="export-checkbox" />
                            <span class="toggle-track"><span class="toggle-thumb"></span></span>
                        </label>

                        <label v-if="hasSelection" class="export-toggle">
                            <span>Selected only</span>
                            <input v-model="exportOnlySelected" type="checkbox" class="export-checkbox" />
                            <span class="toggle-track"><span class="toggle-thumb"></span></span>
                        </label>

                        <div class="export-field">
                            <span class="export-label">Scale</span>
                            <div class="export-scale-btns">
                                <button
                                    v-for="opt in exportScaleOptions"
                                    :key="opt.value"
                                    class="export-scale-btn"
                                    :class="{ active: exportScale === opt.value }"
                                    @click="exportScale = opt.value"
                                >
                                    {{ opt.label }}
                                </button>
                            </div>
                        </div>

                        <div v-if="exportPreviewWidth" class="export-dimensions">
                            {{ exportPreviewWidth }} &times; {{ exportPreviewHeight }}
                        </div>

                        <div class="export-actions">
                            <button class="export-action-btn primary" :disabled="isExporting" @click="savePng">
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                >
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                                Save PNG
                            </button>
                            <button class="export-action-btn" :disabled="isExporting" @click="copyClipboard">
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                >
                                    <rect x="9" y="9" width="13" height="13" rx="2" />
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                </svg>
                                Copy PNG
                            </button>
                        </div>

                        <button class="export-close-btn" @click="close">&times;</button>
                    </div>
                </div>
            </div>
        </transition>
    </teleport>
</template>

<style scoped lang="scss">
// ─── Export Dialog ───────────────────────────────────────────────────────────

.export-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
}

.export-dialog {
    display: flex;
    background: var(--bg-primary, #fff);
    border-radius: 12px;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
    overflow: hidden;
    max-width: 720px;
    max-height: 80vh;
    width: 90vw;
}

.export-preview {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    background: var(--bg-secondary, #f5f5f7);

    &-inner {
        display: flex;
        align-items: center;
        justify-content: center;
        max-width: 100%;
        max-height: 60vh;
        border-radius: 8px;
        overflow: hidden;
    }
}

.export-preview-img {
    max-width: 100%;
    max-height: 56vh;
    object-fit: contain;
}

.export-empty {
    padding: 40px;
    color: var(--text-muted, #8e8e93);
    font-size: 14px;
}

.export-settings {
    width: 220px;
    padding: 24px 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    position: relative;
    border-left: 1px solid var(--border-color, #e0e0e0);
}

.export-title {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
    color: var(--text1, #1d1d1f);
}

.export-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    color: var(--text1, #1d1d1f);
    cursor: pointer;
    user-select: none;

    .export-checkbox {
        display: none;
    }

    .toggle-track {
        width: 36px;
        height: 20px;
        border-radius: 10px;
        background: var(--border-color, #d1d1d6);
        position: relative;
        transition: background 0.2s;
    }

    .toggle-thumb {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #fff;
        transition: transform 0.2s;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }

    .export-checkbox:checked + .toggle-track {
        background: var(--accent-color, #3eb489);

        .toggle-thumb {
            transform: translateX(16px);
        }
    }
}

.export-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
}

.export-label {
    font-size: 13px;
    color: var(--text2, #6e6e73);
}

.export-scale-btns {
    display: flex;
    gap: 0;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 6px;
    overflow: hidden;
}

.export-scale-btn {
    flex: 1;
    padding: 5px 0;
    border: none;
    background: transparent;
    font-size: 13px;
    font-weight: 500;
    color: var(--text2, #6e6e73);
    cursor: pointer;
    transition:
        background 0.12s,
        color 0.12s;

    &:not(:last-child) {
        border-right: 1px solid var(--border-color, #e0e0e0);
    }

    &:hover {
        background: var(--bg-hover, #f0f0f0);
    }

    &.active {
        background: var(--accent-color, #3eb489);
        color: #fff;
    }
}

.export-dimensions {
    font-size: 12px;
    color: var(--text-muted, #8e8e93);
    text-align: center;
}

.export-actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: auto;
}

.export-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 8px 12px;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 8px;
    background: transparent;
    color: var(--text1, #1d1d1f);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition:
        background 0.12s,
        border-color 0.12s;

    &:hover:not(:disabled) {
        background: var(--bg-hover, #f0f0f0);
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    &.primary {
        background: var(--accent-color, #3eb489);
        color: #fff;
        border-color: var(--accent-color, #3eb489);

        &:hover:not(:disabled) {
            filter: brightness(1.1);
            background: var(--accent-color, #3eb489);
        }
    }
}

.export-close-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 50%;
    background: transparent;
    color: var(--text2, #6e6e73);
    font-size: 18px;
    cursor: pointer;
    transition: background 0.12s;

    &:hover {
        background: var(--bg-hover, #f0f0f0);
    }
}

.export-fade-enter-active,
.export-fade-leave-active {
    transition: opacity 0.2s ease;
}
.export-fade-enter-from,
.export-fade-leave-to {
    opacity: 0;
}
</style>
