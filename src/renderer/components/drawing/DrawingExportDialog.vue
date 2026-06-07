<script setup lang="ts">
import { ref, watch } from 'vue';
import type { CanvasElement } from '../../types/drawing';

const props = defineProps<{
    visible: boolean;
    hasSelection: boolean;
    filePath: string;
    elements: CanvasElement[];
    selectedIds: Set<string>;
    exportToBlob: (opts: { elements: CanvasElement[]; withBackground: boolean; scale: number }) => Promise<Blob | null>;
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
        });
        if (!blob) return;
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    } finally {
        isExporting.value = false;
    }
}
</script>

<template>
    <teleport to="body">
        <transition name="export-fade">
            <div v-if="visible" class="export-overlay" role="presentation" @click.self="close">
                <dialog class="export-dialog" aria-labelledby="export-dialog-title" aria-modal="true">
                    <div class="export-preview">
                        <figure v-if="exportPreviewUrl" class="export-preview-figure">
                            <img
                                :src="exportPreviewUrl"
                                alt="Preview of the image to be exported"
                                class="export-preview-img"
                            />
                        </figure>
                        <div v-else class="export-empty" role="status" aria-live="polite">No elements to export</div>
                    </div>

                    <div class="export-settings">
                        <h2 id="export-dialog-title" class="export-title">Export image</h2>

                        <fieldset>
                            <legend class="sr-only">Export options</legend>

                            <label class="export-toggle">
                                <input
                                    v-model="exportWithBackground"
                                    type="checkbox"
                                    class="export-checkbox"
                                    aria-label="Include background in export"
                                />
                                <span class="toggle-track"><span class="toggle-thumb" aria-hidden="true"></span></span>
                                <span>Background</span>
                            </label>

                            <label v-if="hasSelection" class="export-toggle">
                                <input
                                    v-model="exportOnlySelected"
                                    type="checkbox"
                                    class="export-checkbox"
                                    aria-label="Export selected elements only"
                                />
                                <span class="toggle-track"><span class="toggle-thumb" aria-hidden="true"></span></span>
                                <span>Selected only</span>
                            </label>
                        </fieldset>

                        <fieldset class="export-field">
                            <legend class="export-label">Scale</legend>
                            <div class="export-scale-btns" role="group" aria-label="Export scale options">
                                <button
                                    v-for="opt in exportScaleOptions"
                                    :key="opt.value"
                                    class="export-scale-btn"
                                    :class="{ active: exportScale === opt.value }"
                                    :aria-pressed="exportScale === opt.value"
                                    @click="exportScale = opt.value"
                                >
                                    {{ opt.label }}
                                </button>
                            </div>
                        </fieldset>

                        <output v-if="exportPreviewWidth" class="export-dimensions" aria-label="Export dimensions">
                            {{ exportPreviewWidth }} &times; {{ exportPreviewHeight }}
                        </output>

                        <div class="export-actions">
                            <button
                                class="export-action-btn primary"
                                :disabled="isExporting"
                                :aria-busy="isExporting"
                                @click="savePng"
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    aria-hidden="true"
                                    focusable="false"
                                >
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line x1="12" y1="15" x2="12" y2="3" />
                                </svg>
                                Save PNG
                            </button>
                            <button
                                class="export-action-btn"
                                :disabled="isExporting"
                                :aria-busy="isExporting"
                                @click="copyClipboard"
                            >
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    aria-hidden="true"
                                    focusable="false"
                                >
                                    <rect x="9" y="9" width="13" height="13" rx="2" />
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                </svg>
                                Copy PNG
                            </button>
                        </div>

                        <button class="export-close-btn" aria-label="Close export dialog" @click="close">
                            &times;
                        </button>
                    </div>
                </dialog>
            </div>
        </transition>
    </teleport>
</template>

<style scoped lang="scss">
.export-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: $z-max;
}

.export-dialog {
    display: flex;
    background: $bg-primary;
    border-radius: $border-radius-xl;
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
    padding: $space-6;
    background: $bg-secondary;

    &-inner {
        display: flex;
        align-items: center;
        justify-content: center;
        max-width: 100%;
        max-height: 60vh;
        border-radius: $border-radius-lg;
        overflow: hidden;
    }
}

.export-preview-img {
    max-width: 100%;
    max-height: 56vh;
    object-fit: contain;
}

.export-empty {
    padding: $space-10;
    color: $text-muted;
    font-size: $font-size-sm;
}

.export-settings {
    width: 220px;
    padding: $space-6 $space-5;
    display: flex;
    flex-direction: column;
    gap: $space-4;
    position: relative;
    border-left: 1px solid $border-color;
}

.export-title {
    font-size: $font-size-base;
    font-weight: $font-weight-semibold;
    margin: 0;
    color: $text1;
}

.export-toggle {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: $font-size-sm;
    color: $text1;
    cursor: pointer;
    user-select: none;

    .export-checkbox {
        display: none;
    }

    .toggle-track {
        width: 36px;
        height: 20px;
        border-radius: $border-radius-xl;
        background: $border-color;
        position: relative;
        transition: background $transition-base;
    }

    .toggle-thumb {
        position: absolute;
        top: 2px;
        left: 2px;
        width: 16px;
        height: 16px;
        border-radius: $border-radius-lg;
        background: $base2;
        transition: transform $transition-base;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    }

    .export-checkbox:checked + .toggle-track {
        background: $accent-color;

        .toggle-thumb {
            transform: translateX(16px);
        }
    }
}

.export-field {
    display: flex;
    flex-direction: column;
    gap: $space-2;
}

.export-label {
    font-size: $font-size-sm;
    color: $text2;
}

.export-scale-btns {
    display: flex;
    gap: 0;
    border: 1px solid $border-color;
    border-radius: $border-radius;
    overflow: hidden;
}

.export-scale-btn {
    flex: 1;
    padding: $space-2 0;
    border: none;
    background: transparent;
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    color: $text1;
    cursor: pointer;
    transition:
        background $transition-base,
        color $transition-base;

    &:not(:last-child) {
        border-right: 1px solid $border-color;
    }

    &:hover {
        background: $bg-hover;
    }

    &.active {
        background: $accent-color;
        color: $text3;
    }
}

.export-dimensions {
    font-size: $font-size-xs;
    color: $text2;
    text-align: center;
}

.export-actions {
    display: flex;
    flex-direction: column;
    gap: $space-2;
    margin-top: auto;
}

.export-action-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: $space-2;
    padding: $space-2 $space-3;
    border: 1px solid $border-color;
    border-radius: $border-radius-lg;
    background: $base3;
    color: $text1;
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    cursor: pointer;
    transition:
        background $transition-base,
        border-color $transition-base;

    &:hover:not(:disabled) {
        background: $bg-hover;
    }

    &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    &.primary {
        background: $accent-color;
        color: $text3;
        border-color: $accent-color;

        &:hover:not(:disabled) {
            filter: brightness(1.1);
            background: $accent-color;
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
    border-radius: $border-radius-xl;
    background: transparent;
    color: $text2;
    font-size: $font-size-lg;
    cursor: pointer;
    transition: background $transition-base;

    &:hover {
        background: $bg-hover;
    }
}

.export-fade-enter-active,
.export-fade-leave-active {
    transition: opacity $transition-base;
}
.export-fade-enter-from,
.export-fade-leave-to {
    opacity: 0;
}

fieldset {
    border: none;
    padding: 0;
    margin: 0;
}
</style>
