<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import type { ToolType, StrokeStyle } from '../types/drawing';
import { useDrawingElements, genId } from '../composables/drawing/useDrawingElements';
import { useCanvasRenderer } from '../composables/drawing/useCanvasRenderer';
import { useDrawingInteraction } from '../composables/drawing/useDrawingInteraction';
import { useTextEditing } from '../composables/drawing/useTextEditing';
import { useDrawingHistory } from '../composables/drawing/useDrawingHistory';
import { useDrawingPersistence } from '../composables/drawing/useDrawingPersistence';
import DrawingToolbar from './drawing/DrawingToolbar.vue';
import DrawingPropertiesPanel from './drawing/DrawingPropertiesPanel.vue';
import DrawingFooter from './drawing/DrawingFooter.vue';
import DrawingExportDialog from './drawing/DrawingExportDialog.vue';

// Props and emits

const props = defineProps<{
    filePath: string;
    initialContent?: string;
}>();

const emit = defineEmits<{
    save: [content: string];
    contentChanged: [hasChanges: boolean];
}>();

// State

const containerEl = ref<HTMLDivElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const textInputEl = ref<HTMLTextAreaElement | null>(null);
const toolbarRef = ref<InstanceType<typeof DrawingToolbar> | null>(null);

// View State
const scrollX = ref(0);
const scrollY = ref(0);
const zoom = ref(1);

// Tool State
const currentTool = ref<ToolType>('select');

// Marquee selection (shared between renderer and interaction)
const marqueeRect = ref<{ x: number; y: number; width: number; height: number } | null>(null);

// Element State
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

// Style Defaults
const defaultStyle = ref({
    strokeColor: '#1e1e1e',
    fillColor: 'transparent',
    strokeWidth: 2,
    strokeStyle: 'solid' as StrokeStyle,
    borderRadius: 0,
    fontSize: 20,
});

// History
const history = ref<string[]>([]);
const historyIndex = ref(-1);

// Theme
const isDark = ref(false);
let themeObserver: MutationObserver | null = null;

// Renderer

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
    isDark,
    elements,
    creatingElement,
    selectedIds,
    selectedElement,
    marqueeRect,
    getElementBounds,
    getHandlePositions,
);

// Persistence

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

// History

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

// Text editing

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

// Interaction

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

// Computed

const zoomPercent = computed(() => Math.round(zoom.value * 100));

const shouldShowProperties = computed(() => {
    const tool = effectiveTool.value;
    return (tool !== 'hand' && tool !== 'select') || selectedIds.value.size > 0;
});

const showFillOption = computed(() => {
    const tool = effectiveTool.value;
    if (selectedElement.value) {
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
        return selectedElements.value.some((el) => el.type === 'text' || !!el.text);
    }
    return currentTool.value === 'text';
});

const showRoundnessOption = computed(() => {
    const roundableTypes = ['rectangle', 'diamond', 'triangle', 'hexagon', 'parallelogram'];
    const tool = effectiveTool.value;
    if (selectedElement.value) {
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

// Lifecycle

onMounted(() => {
    checkTheme();
    themeObserver = new MutationObserver(checkTheme);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    setupCanvas();
    loadDrawing();
    window.addEventListener('resize', handleResize);
    document.addEventListener('mousedown', handleClickOutside);
    nextTick(() => containerEl.value?.focus());
});

onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
    document.removeEventListener('mousedown', handleClickOutside);
    themeObserver?.disconnect();
    cleanupAutoSave();
});

watch(() => props.filePath, loadDrawing);
watch(() => props.initialContent, loadDrawing);
watch(isDark, () => {
    // Update default stroke for theme
    if (isDark.value && defaultStyle.value.strokeColor === '#1e1e1e') {
        defaultStyle.value.strokeColor = '#ffffff';
    } else if (!isDark.value && defaultStyle.value.strokeColor === '#ffffff') {
        defaultStyle.value.strokeColor = '#1e1e1e';
    }
    renderScene();
});

// Theme

function checkTheme() {
    isDark.value = document.documentElement.getAttribute('data-theme') === 'dark';
}

// Tool selection

function selectTool(tool: ToolType) {
    currentTool.value = tool;
    if (tool !== 'select') selectedIds.value = new Set();
    renderScene();
}

function handleClickOutside(e: MouseEvent) {
    toolbarRef.value?.handleClickOutside(e);
}

// Properties

// Style properties that can be set on both elements and the default style
type StyleKey = 'strokeColor' | 'fillColor' | 'strokeWidth' | 'strokeStyle' | 'borderRadius' | 'fontSize';

function setProperty(prop: StyleKey, value: string | number) {
    // Update all selected elements
    if (selectedElements.value.length > 0) {
        for (const el of selectedElements.value) {
            el[prop] = value as never;

            // When fontSize changes on a text element, recalculate bounds to fit
            if (prop === 'fontSize' && typeof value === 'number' && el.type === 'text' && el.text) {
                const ctx = getCtx();
                if (ctx) {
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

// Export dialog

const showExportDialog = ref(false);
const hasSelection = computed(() => selectedIds.value.size > 0);

function openExportDialog() {
    showExportDialog.value = true;
}

function closeExportDialog() {
    showExportDialog.value = false;
}
</script>

<template>
    <div
        ref="containerEl"
        class="excalidraw-container"
        tabindex="0"
        @keydown="handleKeydown"
        @keyup="handleKeyup"
        @contextmenu.prevent
    >
        <DrawingToolbar ref="toolbarRef" :current-tool="currentTool" @select-tool="selectTool" />

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
            @set-property="setProperty"
            @copy="copySelected"
            @duplicate="duplicateSelected"
            @delete="deleteSelected"
        />

        <!-- Canvas -->
        <canvas
            ref="canvas"
            :style="{ cursor: canvasCursor }"
            @pointerdown="onPointerDown"
            @pointermove="onPointerMove"
            @pointerup="onPointerUp"
            @pointerleave="onPointerUp"
            @dblclick="onDoubleClick"
            @wheel.prevent="onWheel"
        />

        <!-- Text Editing Overlay -->
        <textarea
            v-if="textEditing"
            ref="textInputEl"
            v-model="textValue"
            class="text-edit-overlay"
            :style="textOverlayStyle"
            @blur="finalizeText"
            @keydown.escape.prevent="cancelText"
            @keydown.enter.exact="onTextEnter"
            @pointerdown.stop
        />

        <DrawingFooter
            :zoom="zoom"
            :zoom-percent="zoomPercent"
            :history-index="historyIndex"
            :history-length="history.length"
            :is-saving="isSaving"
            :has-unsaved-changes="hasUnsavedChanges"
            @zoom-to-center="zoomToCenter"
            @undo="undo"
            @redo="redo"
            @clear-all="clearAll"
            @open-export-dialog="openExportDialog"
        />

        <DrawingExportDialog
            :visible="showExportDialog"
            :has-selection="hasSelection"
            :is-dark="isDark"
            :file-path="filePath"
            :elements="elements"
            :selected-ids="selectedIds"
            :export-to-blob="exportToBlob"
            @close="closeExportDialog"
        />
    </div>
</template>
<style scoped lang="scss">
.excalidraw-container {
    position: relative;
    width: 100%;
    height: 100%;
    overflow: hidden;
    outline: none;
    background: var(--bg-primary, #ffffff);
}

canvas {
    display: block;
    width: 100%;
    height: 100%;
}

// ─── Text Overlay ────────────────────────────────────────────────────────────

.text-edit-overlay {
    position: absolute;
    z-index: 30;
    border: 2px solid var(--accent-color, #3eb489);
    border-radius: 4px;
    background: color-mix(in srgb, var(--bg-primary, #fff) 85%, transparent);
    outline: none;
    resize: none;
    min-width: 60px;
    min-height: 1.4em;
    font-family: 'Helvetica', 'Segoe UI', sans-serif;
    padding: 4px 6px;
    overflow: hidden;
    white-space: pre-wrap;
    word-break: break-word;
    box-sizing: border-box;
}
</style>
