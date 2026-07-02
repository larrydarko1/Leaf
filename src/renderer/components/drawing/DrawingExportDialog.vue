<script setup lang="ts">
import { ref, watch } from 'vue';
import type { CanvasElement } from '@/schemas/drawing';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

type Props = {
    visible: boolean;
    hasSelection: boolean;
    filePath: string;
    elements: CanvasElement[];
    selectedIds: Set<string>;
    exportToBlob: (opts: { elements: CanvasElement[]; withBackground: boolean; scale: number }) => Promise<Blob | null>;
};

const props = defineProps<Props>();

const emit = defineEmits<{
    close: [];
}>();

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

watch(
    () => props.visible,
    (v) => {
        if (v) {
            exportOnlySelected.value = props.hasSelection;
            void updateExportPreview();
        }
    },
);

watch([exportWithBackground, exportScale, exportOnlySelected], () => {
    if (props.visible) void updateExportPreview();
});

function getExportElements(): CanvasElement[] {
    return exportOnlySelected.value && props.hasSelection
        ? props.elements.filter((el) => props.selectedIds.has(el.id))
        : props.elements;
}

async function updateExportPreview() {
    if (exportPreviewUrl.value !== null) {
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

    if (blob !== null) {
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
    if (exportPreviewUrl.value !== null) {
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
        if (blob === null) return;

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
        if (filePath === null) return;

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
        if (blob === null) return;
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    } finally {
        isExporting.value = false;
    }
}
</script>

<template>
    <teleport to="body">
        <transition name="export-fade">
            <div
                v-if="visible"
                class="export-overlay"
                role="presentation"
                @click.self="close">
                <dialog
                    class="export-dialog"
                    aria-labelledby="export-dialog-title"
                    aria-modal="true">
                    <!-- Image preview area -->
                    <div class="export-preview">
                        <figure
                            v-if="exportPreviewUrl"
                            class="export-preview-figure">
                            <img
                                :src="exportPreviewUrl"
                                :alt="t('drawing.export_image')"
                                class="export-preview-img" />
                        </figure>
                        <div
                            v-else
                            class="export-empty"
                            role="status"
                            aria-live="polite"
                            >{{ t('drawing.no_elements_to_export') }}</div
                        >
                    </div>

                    <!-- Export options and controls -->
                    <div class="export-settings">
                        <h2
                            id="export-dialog-title"
                            class="export-title"
                            >{{ t('drawing.export_image') }}</h2
                        >

                        <!-- Toggles for background and selection -->
                        <fieldset>
                            <legend class="sr-only">{{ t('drawing.export_options') }}</legend>

                            <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
                            <label class="export-toggle">
                                <input
                                    v-model="exportWithBackground"
                                    type="checkbox"
                                    class="export-checkbox"
                                    :aria-label="t('drawing.include_background')" />
                                <span class="toggle-track"
                                    ><span
                                        class="toggle-thumb"
                                        aria-hidden="true"></span
                                ></span>
                                <span>{{ t('drawing.background') }}</span>
                            </label>

                            <!-- eslint-disable-next-line vuejs-accessibility/label-has-for -->
                            <label
                                v-if="hasSelection"
                                class="export-toggle">
                                <input
                                    v-model="exportOnlySelected"
                                    type="checkbox"
                                    class="export-checkbox"
                                    :aria-label="t('drawing.export_only_selected')" />
                                <span class="toggle-track"
                                    ><span
                                        class="toggle-thumb"
                                        aria-hidden="true"></span
                                ></span>
                                <span>{{ t('drawing.export_only_selected') }}</span>
                            </label>
                        </fieldset>

                        <!-- Scale selection buttons -->
                        <fieldset class="export-field">
                            <legend class="export-label">{{ t('drawing.scale') }}</legend>
                            <div
                                class="export-scale-btns"
                                role="group"
                                :aria-label="t('drawing.export_scale_options')">
                                <button
                                    v-for="opt in exportScaleOptions"
                                    :key="opt.value"
                                    class="export-scale-btn"
                                    :class="{ active: exportScale === opt.value }"
                                    :aria-pressed="exportScale === opt.value"
                                    @click="exportScale = opt.value">
                                    {{ opt.label }}
                                </button>
                            </div>
                        </fieldset>

                        <!-- Dimension display -->
                        <output
                            v-if="exportPreviewWidth"
                            class="export-dimensions"
                            :aria-label="t('drawing.export_dimensions')">
                            {{ exportPreviewWidth }} &times; {{ exportPreviewHeight }}
                        </output>

                        <!-- Action buttons: save and copy -->
                        <div class="export-actions">
                            <button
                                class="export-action-btn primary"
                                :disabled="isExporting"
                                :aria-busy="isExporting"
                                @click="savePng">
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    aria-hidden="true"
                                    focusable="false">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                    <polyline points="7 10 12 15 17 10" />
                                    <line
                                        x1="12"
                                        y1="15"
                                        x2="12"
                                        y2="3" />
                                </svg>
                                {{ t('drawing.save_png') }}
                            </button>
                            <button
                                class="export-action-btn"
                                :disabled="isExporting"
                                :aria-busy="isExporting"
                                @click="copyClipboard">
                                <svg
                                    width="16"
                                    height="16"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    aria-hidden="true"
                                    focusable="false">
                                    <rect
                                        x="9"
                                        y="9"
                                        width="13"
                                        height="13"
                                        rx="2" />
                                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                                </svg>
                                {{ t('drawing.copy_png') }}
                            </button>
                        </div>

                        <!-- Close button -->
                        <button
                            class="export-close-btn"
                            :aria-label="t('drawing.close_export_dialog')"
                            @click="close">
                            &times;
                        </button>
                    </div>
                </dialog>
            </div>
        </transition>
    </teleport>
</template>

<style scoped lang="scss">
/* ––– Overlay & Dialog Container ––– */

.export-overlay {
    position: fixed;
    inset: 0;
    background: color-mix(in srgb, $bg-primary 50%, transparent);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: $z-max;
}

.export-dialog {
    display: flex;
    background: $bg-primary;
    border-radius: $border-radius-xl;
    box-shadow: $shadow-lg;
    overflow: hidden;
    max-width: $size-31;
    max-height: 80vh;
    width: 90vw;
}

/* ––– Preview Area ––– */

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
    padding: $space-8;
    color: $text-muted;
    font-size: $font-size-sm;
}

/* ––– Settings Panel ––– */

.export-settings {
    width: $size-25;
    padding: $space-6 $space-5;
    display: flex;
    flex-direction: column;
    gap: $space-4;
    position: relative;
    border-left: $border-width-thin $border-color;
}

.export-title {
    font-size: $font-size-base;
    font-weight: $font-weight-semibold;
    margin: 0;
    color: $text1;
}

/* ––– Toggle Switches ––– */

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
        width: $size-13;
        height: $size-10;
        border-radius: $border-radius-xl;
        background: $border-color;
        position: relative;
        transition: background $transition-base;
    }

    .toggle-thumb {
        position: absolute;
        top: $space-0;
        left: $space-0;
        width: $size-8;
        height: $size-8;
        border-radius: $border-radius-lg;
        background: $base2;
        transition: transform $transition-base;
        box-shadow: $shadow-sm;
    }

    .export-checkbox:checked + .toggle-track {
        background: $accent-color;

        .toggle-thumb {
            transform: translateX($space-4);
        }
    }
}

/* ––– Scale Selection ––– */

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
    border: $border-width-thin $border-color;
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
        border-right: $border-width-thin $border-color;
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

/* ––– Action Buttons ––– */

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
    border: $border-width-thin $border-color;
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
        opacity: $opacity-mid-low;
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

/* ––– Close Button ––– */

.export-close-btn {
    position: absolute;
    top: $space-3;
    right: $space-3;
    width: $size-11;
    height: $size-11;
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

/* ––– Dialog Transition Animation ––– */

.export-fade-enter-active,
.export-fade-leave-active {
    transition: opacity $transition-base;
}

.export-fade-enter-from,
.export-fade-leave-to {
    opacity: 0;
}

/* ––– Fieldset Reset ––– */

fieldset {
    border: none;
    padding: 0;
    margin: 0;
}
</style>
