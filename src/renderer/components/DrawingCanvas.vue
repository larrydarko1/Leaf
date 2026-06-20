<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useThrottleFn, useEventListener } from '@vueuse/core';
import type { ToolType, StrokeStyle, DefaultStyle } from '@/schemas/drawing';
import { useDrawingElements, genId } from '@/renderer/composables/drawing/useDrawingElements';
import { useCanvasRenderer } from '@/renderer/composables/drawing/useCanvasRenderer';
import { useDrawingInteraction } from '@/renderer/composables/drawing/useDrawingInteraction';
import { useTextEditing } from '@/renderer/composables/drawing/useTextEditing';
import { useDrawingHistory } from '@/renderer/composables/drawing/useDrawingHistory';
import { useDrawingPersistence } from '@/renderer/composables/drawing/useDrawingPersistence';
import DrawingToolbar from '@/renderer/components/drawing/DrawingToolbar.vue';
import DrawingPropertiesPanel from '@/renderer/components/drawing/DrawingPropertiesPanel.vue';
import DrawingFooter from '@/renderer/components/drawing/DrawingFooter.vue';
import DrawingExportDialog from '@/renderer/components/drawing/DrawingExportDialog.vue';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

type Props = {
    filePath: string;
    initialContent?: string;
};

const props = defineProps<Props>();

const emit = defineEmits<{
    save: [content: string];
    contentChanged: [hasChanges: boolean];
}>();

type StyleKey = 'strokeColor' | 'fillColor' | 'strokeWidth' | 'strokeStyle' | 'borderRadius' | 'fontSize';

const containerEl = ref<HTMLDivElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const textInputEl = ref<HTMLTextAreaElement | null>(null);
const toolbarRef = ref<InstanceType<typeof DrawingToolbar> | null>(null);
const scrollX = ref(0);
const scrollY = ref(0);
const zoom = ref(1);
const currentTool = ref<ToolType>('select');
const marqueeRect = ref<{ x: number; y: number; width: number; height: number } | null>(null);

const {
    elements,
    selectedId,
    selectedIds,
    creatingElement,
    clipboard,
    selectedElement,
    selectedElements,
    isShapeElement,
    getElementBounds,
    getHandlePositions,
    hitTestElement,
    hitTestHandle,
    isShapeTool,
} = useDrawingElements();

const defaultStyle = ref({
    strokeColor: '#ffffff',
    fillColor: 'transparent',
    strokeWidth: 2,
    strokeStyle: 'solid' as StrokeStyle,
    borderRadius: 0,
    fontSize: 20,
} as DefaultStyle);

const history = ref<string[]>([]);
const historyIndex = ref(-1);

const {
    setupCanvas,
    handleResize,
    renderScene,
    screenToWorld,
    worldToScreen,
    getScreenPoint,
    cssWidth,
    cssHeight,
    getCtx,
    exportToBlob,
} = useCanvasRenderer(
    canvas,
    containerEl,
    scrollX,
    scrollY,
    zoom,
    elements,
    creatingElement,
    selectedIds,
    selectedElement,
    marqueeRect,
    getElementBounds,
    getHandlePositions,
);

const {
    hasUnsavedChanges,
    isSaving,
    scheduleAutoSave,
    loadDrawing,
    cleanup: cleanupAutoSave,
} = useDrawingPersistence(
    canvas,
    () => props.initialContent,
    elements,
    scrollX,
    scrollY,
    zoom,
    history,
    historyIndex,
    genId,
    renderScene,
    getCtx,
    (content) => emit('save', content),
    (hasChanges) => emit('contentChanged', hasChanges),
);

const { saveToHistory, undo, redo, clearAll, copySelected, pasteClipboard, duplicateSelected, deleteSelected } =
    useDrawingHistory(
        elements,
        selectedId,
        selectedIds,
        selectedElement,
        selectedElements,
        clipboard,
        history,
        historyIndex,
        scheduleAutoSave,
        renderScene,
    );

const {
    textEditing,
    textValue,
    textOverlayStyle,
    startNewText,
    startEditText,
    startEditShapeText,
    cancelText,
    onTextEnter,
    finalizeText,
    onDoubleClick,
} = useTextEditing(
    canvas,
    textInputEl,
    zoom,
    elements,
    selectedId,
    getElementBounds,
    hitTestElement,
    isShapeElement,
    genId,
    defaultStyle,
    worldToScreen,
    screenToWorld,
    getCtx,
    renderScene,
    saveToHistory,
    scheduleAutoSave,
);

const {
    isDragging,
    effectiveTool,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onWheel,
    zoomToCenter,
    handleKeydown,
    handleKeyup,
} = useDrawingInteraction(
    canvas,
    containerEl,
    scrollX,
    scrollY,
    zoom,
    elements,
    selectedId,
    selectedIds,
    creatingElement,
    selectedElement,
    selectedElements,
    isShapeElement,
    isShapeTool,
    hitTestElement,
    hitTestHandle,
    getElementBounds,
    genId,
    currentTool,
    defaultStyle,
    marqueeRect,
    screenToWorld,
    getScreenPoint,
    cssWidth,
    cssHeight,
    renderScene,
    textEditing,
    finalizeText,
    startNewText,
    startEditText,
    startEditShapeText,
    saveToHistory,
    scheduleAutoSave,
    selectTool,
    undo,
    redo,
    copySelected,
    pasteClipboard,
    duplicateSelected,
    deleteSelected,
);

const zoomPercent = computed(() => Math.round(zoom.value * 100));

const shouldShowProperties = computed(() => {
    const tool = effectiveTool.value;
    return (tool !== 'hand' && tool !== 'select') || selectedIds.value.size > 0;
});

const showFillOption = computed(() => {
    const tool = effectiveTool.value;
    if (selectedElement.value !== null) {
        return !['line', 'arrow', 'freedraw', 'text'].includes(selectedElement.value.type);
    }
    return !['freedraw', 'line', 'arrow', 'text', 'select', 'hand', 'eraser'].includes(tool);
});

const activeStrokeColor = computed(() => selectedElement.value?.strokeColor ?? defaultStyle.value.strokeColor);
const activeFillColor = computed(() => selectedElement.value?.fillColor ?? defaultStyle.value.fillColor);
const activeStrokeWidth = computed(() => selectedElement.value?.strokeWidth ?? defaultStyle.value.strokeWidth);
const activeStrokeStyle = computed(() => selectedElement.value?.strokeStyle ?? defaultStyle.value.strokeStyle);
const activeBorderRadius = computed(() => selectedElement.value?.borderRadius ?? defaultStyle.value.borderRadius);
const activeFontSize = computed(() => selectedElement.value?.fontSize ?? defaultStyle.value.fontSize);

const showFontSizeOption = computed(() => {
    if (selectedElements.value.length > 0) {
        return selectedElements.value.some(
            (el) => el.type === 'text' || (el.text !== null && el.text !== undefined && el.text !== ''),
        );
    }
    return currentTool.value === 'text';
});

const showRoundnessOption = computed(() => {
    const roundableTypes = ['rectangle', 'diamond', 'triangle', 'hexagon', 'parallelogram'];
    const tool = effectiveTool.value;
    if (selectedElement.value !== null) {
        return roundableTypes.includes(selectedElement.value.type);
    }
    return roundableTypes.includes(tool);
});

const canvasCursor = computed(() => {
    const tool = effectiveTool.value;
    if (tool === 'hand') return isDragging.value ? 'grabbing' : 'grab';
    if (tool === 'select') return 'default';
    if (tool === 'eraser') return 'cell';
    if (tool === 'text') return 'text';
    return 'crosshair';
});

const showExportDialog = ref(false);
const hasSelection = computed(() => selectedIds.value.size > 0);

onMounted(() => {
    setupCanvas();
    loadDrawing();
    useEventListener(window, 'resize', useThrottleFn(handleResize, 100) as unknown as () => void);
    document.addEventListener('mousedown', handleClickOutside);
    void nextTick(() => containerEl.value?.focus());
});

onUnmounted(() => {
    document.removeEventListener('mousedown', handleClickOutside);
    cleanupAutoSave();
    onPointerMove.cancel?.();
    onWheel.cancel?.();
});

watch(() => props.filePath, loadDrawing);
watch(() => props.initialContent, loadDrawing);

function selectTool(tool: ToolType) {
    currentTool.value = tool;
    if (tool !== 'select') selectedIds.value = new Set();
    renderScene();
}

function handleClickOutside(e: MouseEvent) {
    toolbarRef.value?.handleClickOutside(e);
}

function setProperty(prop: StyleKey, value: string | number) {
    // Update all selected elements
    if (selectedElements.value.length > 0) {
        for (const el of selectedElements.value) {
            el[prop] = value as never;

            // When fontSize changes on a text element, recalculate bounds to fit
            if (
                prop === 'fontSize' &&
                typeof value === 'number' &&
                el.type === 'text' &&
                el.text !== null &&
                el.text !== undefined &&
                el.text !== ''
            ) {
                const ctx = getCtx();
                if (ctx !== null) {
                    ctx.save();
                    ctx.font = `${value}px "Helvetica", "Segoe UI", sans-serif`;
                    const lines = el.text.split('\n');
                    const lh = value * 1.3;
                    let maxW = 0;
                    for (const line of lines) {
                        maxW = Math.max(maxW, ctx.measureText(line).width);
                    }
                    ctx.restore();
                    el.width = maxW;
                    el.height = lines.length * lh;
                }
            }
        }

        saveToHistory();
        scheduleAutoSave();
        renderScene();
    }
    // Always update default style
    if (prop in defaultStyle.value) {
        defaultStyle.value[prop] = value as never;
    }
}

function openExportDialog() {
    showExportDialog.value = true;
}

function closeExportDialog() {
    showExportDialog.value = false;
}
</script>

<template>
    <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -->
    <div
        ref="containerEl"
        class="canvas-container"
        role="application"
        :aria-label="t('drawing.canvas_application')"
        aria-describedby="canvas-instructions"
        tabindex="0"
        @keydown="handleKeydown"
        @keyup="handleKeyup"
        @contextmenu.prevent>
        <!-- Toolbar -->
        <DrawingToolbar
            ref="toolbarRef"
            :current-tool="currentTool"
            role="toolbar"
            :aria-label="t('drawing.toolbar')"
            @select-tool="selectTool" />

        <!-- Properties Panel -->
        <DrawingPropertiesPanel
            :visible="shouldShowProperties"
            :active-stroke-color="activeStrokeColor"
            :active-fill-color="activeFillColor"
            :active-stroke-width="activeStrokeWidth"
            :active-stroke-style="activeStrokeStyle"
            :active-border-radius="activeBorderRadius"
            :active-font-size="activeFontSize"
            :show-fill-option="showFillOption"
            :show-font-size-option="showFontSizeOption"
            :show-roundness-option="showRoundnessOption"
            :has-selection="hasSelection"
            role="complementary"
            :aria-label="t('drawing.properties_panel')"
            aria-hidden="false"
            @set-property="setProperty"
            @copy="copySelected"
            @duplicate="duplicateSelected"
            @delete="deleteSelected" />

        <!-- Canvas -->
        <!-- eslint-disable-next-line vuejs-accessibility/no-static-element-interactions -->
        <canvas
            ref="canvas"
            :style="{ cursor: canvasCursor }"
            :aria-label="t('drawing.canvas')"
            role="application"
            :aria-describedby="hasSelection ? 'selection-status' : undefined"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointerleave="onPointerUp"
            @dblclick="onDoubleClick"
            @wheel.prevent="onWheel" />

        <!-- Text Editing Overlay -->
        <textarea
            v-if="textEditing"
            ref="textInputEl"
            v-model="textValue"
            class="text-edit-overlay"
            :style="textOverlayStyle"
            :aria-label="t('drawing.text_editing_area')"
            @blur="finalizeText"
            @keydown.escape.prevent="cancelText"
            @keydown.enter.exact="onTextEnter"
            @pointerdown.stop />

        <!-- Footer -->
        <DrawingFooter
            :zoom="zoom"
            :zoom-percent="zoomPercent"
            :history-index="historyIndex"
            :history-length="history.length"
            :is-saving="isSaving"
            :has-unsaved-changes="hasUnsavedChanges"
            role="contentinfo"
            :aria-label="t('drawing.footer')"
            @zoom-to-center="zoomToCenter"
            @undo="undo"
            @redo="redo"
            @clear-all="clearAll"
            @open-export-dialog="openExportDialog" />

        <!-- Export Dialog -->
        <DrawingExportDialog
            :visible="showExportDialog"
            :has-selection="hasSelection"
            :file-path="filePath"
            :elements="elements"
            :selected-ids="selectedIds"
            :export-to-blob="exportToBlob"
            role="dialog"
            :aria-label="t('drawing.export_dialog', { selection: hasSelection ? t('drawing.selection') : '' })"
            aria-modal="true"
            @close="closeExportDialog" />
    </div>
</template>

<style scoped lang="scss">
/* ––– Main Container ––– */
.canvas-container {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    outline: none;
    background: $bg-primary;
}

/* ––– Canvas ––– */
canvas {
    display: block;
    width: 100%;
    height: 100%;
}

/* ––– Text Editing Overlay ––– */
.text-edit-overlay {
    position: absolute;
    z-index: $z-dropdown;
    border: none;
    background: color-mix(in srgb, $bg-primary 85%, transparent);
    outline: none;
    resize: none;
    min-width: 60px;
    min-height: 22.5px;
    font-family: $font-family;
    padding: $space-1 $space-2;
    overflow: hidden;
    white-space: pre-wrap;
    overflow-wrap: break-word;
    box-sizing: border-box;
}
</style>
