<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import type { ToolType, StrokeStyle } from '../types/drawing';
import { useDrawingElements, genId } from '../composables/drawing/useDrawingElements';
import { useCanvasRenderer } from '../composables/drawing/useCanvasRenderer';
import { useDrawingInteraction } from '../composables/drawing/useDrawingInteraction';
import { useTextEditing } from '../composables/drawing/useTextEditing';
import { useDrawingHistory } from '../composables/drawing/useDrawingHistory';
import { useDrawingPersistence } from '../composables/drawing/useDrawingPersistence';

// Props and emits

const props = defineProps<{
    filePath: string;
    initialContent?: string;
}>();

const emit = defineEmits<{
    save: [content: string];
    contentChanged: [hasChanges: boolean];
}>();

// Constants

const strokeColorPalette = [
    '#1e1e1e',
    '#343a40',
    '#e03131',
    '#c2255c',
    '#6741d9',
    '#1971c2',
    '#0c8599',
    '#2f9e44',
    '#66a80f',
    '#f08c00',
    '#e8590c',
    '#ffffff',
];

const fillColorPalette = [
    '#ffc9c9',
    '#fcc2d7',
    '#eebefa',
    '#d0bfff',
    '#bac8ff',
    '#a5d8ff',
    '#99e9f2',
    '#b2f2bb',
    '#d8f5a2',
    '#ffec99',
    '#ffd8a8',
    '#e9ecef',
];

const strokeWidthOptions = [1, 2, 4];
const strokeStyleOptions = [
    { value: 'solid' as StrokeStyle, label: 'Solid', dash: '' },
    { value: 'dashed' as StrokeStyle, label: 'Dashed', dash: '8,5' },
    { value: 'dotted' as StrokeStyle, label: 'Dotted', dash: '2,4' },
];

// State

const containerEl = ref<HTMLDivElement | null>(null);
const canvas = ref<HTMLCanvasElement | null>(null);
const textInputEl = ref<HTMLTextAreaElement | null>(null);
const archDropdownEl = ref<HTMLDivElement | null>(null);

// Architecture shapes dropdown
const archDropdownOpen = ref(false);

const archShapeTypes: ToolType[] = [
    'database',
    'server',
    'user',
    'cloud',
    'document',
    'hexagon',
    'parallelogram',
    'star',
];
const isArchTool = computed(() => archShapeTypes.includes(currentTool.value));

const archShapes = [
    {
        tool: 'database' as ToolType,
        label: 'Database',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/><path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"/></svg>',
    },
    {
        tool: 'server' as ToolType,
        label: 'Server',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="1" fill="currentColor"/><circle cx="6" cy="18" r="1" fill="currentColor"/></svg>',
    },
    {
        tool: 'user' as ToolType,
        label: 'User',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="8" r="5"/><path d="M3 21c0-4.42 4-8 9-8s9 3.58 9 8"/></svg>',
    },
    {
        tool: 'cloud' as ToolType,
        label: 'Cloud',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/></svg>',
    },
    {
        tool: 'document' as ToolType,
        label: 'Document',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
    },
    {
        tool: 'hexagon' as ToolType,
        label: 'Hexagon',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12,2 22,7 22,17 12,22 2,17 2,7"/></svg>',
    },
    {
        tool: 'parallelogram' as ToolType,
        label: 'Parallelogram',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="6,4 22,4 18,20 2,20"/></svg>',
    },
    {
        tool: 'star' as ToolType,
        label: 'Star',
        icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26"/></svg>',
    },
];

function toggleArchDropdown() {
    archDropdownOpen.value = !archDropdownOpen.value;
}

function selectArchTool(tool: ToolType) {
    currentTool.value = tool;
    archDropdownOpen.value = false;
    selectedIds.value = new Set();
    renderScene();
}

function handleClickOutsideArchDropdown(e: MouseEvent) {
    if (archDropdownOpen.value && archDropdownEl.value && !archDropdownEl.value.contains(e.target as Node)) {
        archDropdownOpen.value = false;
    }
}

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

const fontSizeOptions = [
    { label: 'S', value: 16 },
    { label: 'M', value: 20 },
    { label: 'L', value: 28 },
    { label: 'XL', value: 36 },
];

const borderRadiusOptions = [
    { label: 'Sharp', value: 0, icon: 'sharp' },
    { label: 'Round', value: 8, icon: 'round' },
    { label: 'Extra round', value: 16, icon: 'extra' },
];

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
    document.addEventListener('mousedown', handleClickOutsideArchDropdown);
    nextTick(() => containerEl.value?.focus());
});

onUnmounted(() => {
    window.removeEventListener('resize', handleResize);
    document.removeEventListener('mousedown', handleClickOutsideArchDropdown);
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

const hasSelection = computed(() => selectedIds.value.size > 0);

function openExportDialog() {
    exportOnlySelected.value = hasSelection.value;
    showExportDialog.value = true;
    updateExportPreview();
}

function closeExportDialog() {
    showExportDialog.value = false;
    if (exportPreviewUrl.value) {
        URL.revokeObjectURL(exportPreviewUrl.value);
        exportPreviewUrl.value = null;
    }
}

async function updateExportPreview() {
    if (exportPreviewUrl.value) {
        URL.revokeObjectURL(exportPreviewUrl.value);
        exportPreviewUrl.value = null;
    }

    const exportElements =
        exportOnlySelected.value && hasSelection.value
            ? elements.value.filter((el) => selectedIds.value.has(el.id))
            : elements.value;

    if (exportElements.length === 0) return;

    const blob = await exportToBlob({
        elements: exportElements,
        withBackground: exportWithBackground.value,
        scale: exportScale.value,
        darkMode: isDark.value,
    });

    if (blob) {
        exportPreviewUrl.value = URL.createObjectURL(blob);
        // Get dimensions for display
        const img = new Image();
        img.onload = () => {
            exportPreviewWidth.value = img.naturalWidth;
            exportPreviewHeight.value = img.naturalHeight;
        };
        img.src = exportPreviewUrl.value;
    }
}

watch([exportWithBackground, exportScale, exportOnlySelected], () => {
    if (showExportDialog.value) updateExportPreview();
});

async function getExportBlob(): Promise<Blob | null> {
    const exportElements =
        exportOnlySelected.value && hasSelection.value
            ? elements.value.filter((el) => selectedIds.value.has(el.id))
            : elements.value;

    return exportToBlob({
        elements: exportElements,
        withBackground: exportWithBackground.value,
        scale: exportScale.value,
        darkMode: isDark.value,
    });
}

async function exportSavePng() {
    isExporting.value = true;
    try {
        const blob = await getExportBlob();
        if (!blob) return;

        // Derive a default filename from the drawing file path
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

        // Convert blob to base64
        const buffer = await blob.arrayBuffer();
        const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
        await window.electronAPI.writeBuffer(filePath, base64);
    } finally {
        isExporting.value = false;
    }
}

async function exportCopyClipboard() {
    isExporting.value = true;
    try {
        const blob = await getExportBlob();
        if (!blob) return;
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    } finally {
        isExporting.value = false;
    }
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
        <!-- Floating Toolbar -->
        <div class="floating-toolbar">
            <div class="toolbar-inner">
                <!-- Selection -->
                <button
                    class="toolbar-btn"
                    :class="{ active: currentTool === 'select' }"
                    title="Selection — V"
                    @click="selectTool('select')"
                >
                    <svg width="20" height="20" viewBox="0 0 24 24">
                        <path
                            d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.36z"
                            fill="currentColor"
                        />
                    </svg>
                </button>

                <!-- Hand -->
                <button
                    class="toolbar-btn"
                    :class="{ active: currentTool === 'hand' }"
                    title="Hand (Pan) — H"
                    @click="selectTool('hand')"
                >
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path d="M18 11V6a2 2 0 0 0-4 0v5" />
                        <path d="M14 10V4a2 2 0 0 0-4 0v6" />
                        <path
                            d="M10 9.5V6a2 2 0 0 0-4 0v8l-1.46-1.46a2 2 0 0 0-2.83 2.83L7 20.64A4 4 0 0 0 9.83 22H15a4 4 0 0 0 4-4v-5a2 2 0 0 0-4 0v1"
                        />
                    </svg>
                </button>

                <span class="toolbar-sep"></span>

                <!-- Rectangle -->
                <button
                    class="toolbar-btn"
                    :class="{ active: currentTool === 'rectangle' }"
                    title="Rectangle — R"
                    @click="selectTool('rectangle')"
                >
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                    >
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                    </svg>
                </button>

                <!-- Diamond -->
                <button
                    class="toolbar-btn"
                    :class="{ active: currentTool === 'diamond' }"
                    title="Diamond — D"
                    @click="selectTool('diamond')"
                >
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                    >
                        <polygon points="12,2 22,12 12,22 2,12" />
                    </svg>
                </button>

                <!-- Ellipse -->
                <button
                    class="toolbar-btn"
                    :class="{ active: currentTool === 'ellipse' }"
                    title="Ellipse — O"
                    @click="selectTool('ellipse')"
                >
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                    >
                        <circle cx="12" cy="12" r="10" />
                    </svg>
                </button>

                <!-- Triangle -->
                <button
                    class="toolbar-btn"
                    :class="{ active: currentTool === 'triangle' }"
                    title="Triangle — T"
                    @click="selectTool('triangle')"
                >
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                    >
                        <polygon points="12,3 22,21 2,21" />
                    </svg>
                </button>

                <!-- Arrow -->
                <button
                    class="toolbar-btn"
                    :class="{ active: currentTool === 'arrow' }"
                    title="Arrow — A"
                    @click="selectTool('arrow')"
                >
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <line x1="5" y1="19" x2="19" y2="5" />
                        <polyline points="10,5 19,5 19,14" />
                    </svg>
                </button>

                <!-- Line -->
                <button
                    class="toolbar-btn"
                    :class="{ active: currentTool === 'line' }"
                    title="Line — L"
                    @click="selectTool('line')"
                >
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                    >
                        <line x1="5" y1="19" x2="19" y2="5" />
                    </svg>
                </button>

                <span class="toolbar-sep"></span>

                <!-- Freedraw -->
                <button
                    class="toolbar-btn"
                    :class="{ active: currentTool === 'freedraw' }"
                    title="Pen — P"
                    @click="selectTool('freedraw')"
                >
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path d="M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                    </svg>
                </button>

                <!-- Text -->
                <button
                    class="toolbar-btn"
                    :class="{ active: currentTool === 'text' }"
                    title="Text — X"
                    @click="selectTool('text')"
                >
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <polyline points="4 7 4 4 20 4 20 7" />
                        <line x1="9.5" y1="20" x2="14.5" y2="20" />
                        <line x1="12" y1="4" x2="12" y2="20" />
                    </svg>
                </button>

                <!-- Eraser -->
                <button
                    class="toolbar-btn"
                    :class="{ active: currentTool === 'eraser' }"
                    title="Eraser — E"
                    @click="selectTool('eraser')"
                >
                    <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.5"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <path
                            d="M20 20H7L3 16c-.8-.8-.8-2 0-2.8L13.8 2.4c.8-.8 2-.8 2.8 0L21 6.8c.8.8.8 2 0 2.8L12 18"
                        />
                    </svg>
                </button>

                <span class="toolbar-sep"></span>

                <!-- Architecture shapes dropdown -->
                <div ref="archDropdownEl" class="arch-dropdown">
                    <button
                        class="toolbar-btn"
                        :class="{ active: isArchTool }"
                        title="Architecture Shapes"
                        @click="toggleArchDropdown"
                    >
                        <svg
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="1.5"
                            stroke-linecap="round"
                            stroke-linejoin="round"
                        >
                            <ellipse cx="12" cy="5" rx="9" ry="3" />
                            <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
                            <path d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3" />
                        </svg>
                    </button>
                    <transition name="panel-fade">
                        <div v-if="archDropdownOpen" class="arch-dropdown-menu">
                            <button
                                v-for="shape in archShapes"
                                :key="shape.tool"
                                class="arch-shape-btn"
                                :class="{ active: currentTool === shape.tool }"
                                :title="shape.label"
                                @click="selectArchTool(shape.tool)"
                            >
                                <span class="arch-shape-icon" v-html="shape.icon"></span>
                                <span class="arch-shape-label">{{ shape.label }}</span>
                            </button>
                        </div>
                    </transition>
                </div>
            </div>
        </div>

        <!-- Properties Panel (left) -->
        <transition name="panel-fade">
            <div v-if="shouldShowProperties" class="properties-panel" @mousedown.prevent>
                <!-- Stroke Color -->
                <div class="prop-section">
                    <div class="prop-label">Stroke</div>
                    <div class="color-grid">
                        <button
                            v-for="c in strokeColorPalette"
                            :key="'s-' + c"
                            class="color-swatch"
                            :class="{ active: activeStrokeColor === c }"
                            :style="{ background: c }"
                            @click="setProperty('strokeColor', c)"
                        />
                    </div>
                </div>

                <!-- Fill Color (only for shapes) -->
                <div v-if="showFillOption" class="prop-section">
                    <div class="prop-label">Background</div>
                    <div class="color-grid">
                        <button
                            class="color-swatch transparent-swatch"
                            :class="{ active: activeFillColor === 'transparent' }"
                            @click="setProperty('fillColor', 'transparent')"
                        >
                            <svg width="16" height="16" viewBox="0 0 16 16">
                                <line x1="0" y1="16" x2="16" y2="0" stroke="currentColor" stroke-width="1.5" />
                            </svg>
                        </button>
                        <button
                            v-for="c in fillColorPalette"
                            :key="'f-' + c"
                            class="color-swatch"
                            :class="{ active: activeFillColor === c }"
                            :style="{ background: c }"
                            @click="setProperty('fillColor', c)"
                        />
                    </div>
                </div>

                <!-- Stroke Width -->
                <div class="prop-section">
                    <div class="prop-label">Stroke width</div>
                    <div class="stroke-width-row">
                        <button
                            v-for="w in strokeWidthOptions"
                            :key="w"
                            class="stroke-width-btn"
                            :class="{ active: activeStrokeWidth === w }"
                            @click="setProperty('strokeWidth', w)"
                        >
                            <span class="stroke-preview" :style="{ height: w + 'px' }"></span>
                        </button>
                    </div>
                </div>

                <!-- Stroke Style -->
                <div class="prop-section">
                    <div class="prop-label">Stroke style</div>
                    <div class="stroke-style-row">
                        <button
                            v-for="s in strokeStyleOptions"
                            :key="s.value"
                            class="stroke-style-btn"
                            :class="{ active: activeStrokeStyle === s.value }"
                            :title="s.label"
                            @click="setProperty('strokeStyle', s.value)"
                        >
                            <svg width="40" height="6" viewBox="0 0 40 6">
                                <line
                                    x1="0"
                                    y1="3"
                                    x2="40"
                                    y2="3"
                                    stroke="currentColor"
                                    stroke-width="2"
                                    :stroke-dasharray="s.dash"
                                />
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- Roundness -->
                <div v-if="showRoundnessOption" class="prop-section">
                    <div class="prop-label">Roundness</div>
                    <div class="roundness-row">
                        <button
                            v-for="r in borderRadiusOptions"
                            :key="r.value"
                            class="roundness-btn"
                            :class="{ active: activeBorderRadius === r.value }"
                            :title="r.label"
                            @click="setProperty('borderRadius', r.value)"
                        >
                            <svg
                                v-if="r.icon === 'sharp'"
                                width="18"
                                height="18"
                                viewBox="0 0 20 20"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.5"
                            >
                                <rect x="2" y="2" width="16" height="16" />
                            </svg>
                            <svg
                                v-else-if="r.icon === 'round'"
                                width="18"
                                height="18"
                                viewBox="0 0 20 20"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.5"
                            >
                                <rect x="2" y="2" width="16" height="16" rx="4" />
                            </svg>
                            <svg
                                v-else
                                width="18"
                                height="18"
                                viewBox="0 0 20 20"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="1.5"
                            >
                                <rect x="2" y="2" width="16" height="16" rx="8" />
                            </svg>
                        </button>
                    </div>
                </div>

                <!-- Font Size (text elements) -->
                <div v-if="showFontSizeOption" class="prop-section">
                    <div class="prop-label">
                        Font size <span class="font-size-value">{{ activeFontSize }}px</span>
                    </div>
                    <div class="font-size-row">
                        <button
                            v-for="fs in fontSizeOptions"
                            :key="fs.value"
                            class="font-size-btn"
                            :class="{ active: activeFontSize === fs.value }"
                            @click="setProperty('fontSize', fs.value)"
                        >
                            {{ fs.label }}
                        </button>
                    </div>
                </div>

                <!-- Actions (only when element selected) -->
                <div v-if="selectedIds.size > 0" class="prop-section">
                    <div class="prop-actions">
                        <button class="action-btn" title="Copy (⌘C)" @click="copySelected">
                            <svg
                                width="15"
                                height="15"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <rect x="9" y="9" width="13" height="13" rx="2" />
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                            </svg>
                            Copy
                        </button>
                        <button class="action-btn" title="Duplicate (⌘D)" @click="duplicateSelected">
                            <svg
                                width="15"
                                height="15"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                stroke-width="2"
                                stroke-linecap="round"
                                stroke-linejoin="round"
                            >
                                <rect x="3" y="3" width="13" height="13" rx="2" />
                                <rect x="8" y="8" width="13" height="13" rx="2" />
                            </svg>
                            Duplicate
                        </button>
                        <button class="action-btn action-btn--delete" title="Delete (⌫)" @click="deleteSelected">
                            <svg
                                width="15"
                                height="15"
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
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        </transition>

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

        <!-- Footer -->
        <div class="canvas-footer">
            <div class="footer-left">
                <div class="zoom-controls">
                    <button class="zoom-btn" title="Zoom out" @click="zoomToCenter(zoom - 0.1)">
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                        >
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                    </button>
                    <button class="zoom-value" title="Reset zoom" @click="zoomToCenter(1)">{{ zoomPercent }}%</button>
                    <button class="zoom-btn" title="Zoom in" @click="zoomToCenter(zoom + 0.1)">
                        <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                        >
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                    </button>
                </div>
            </div>
            <div class="footer-center">
                <button class="footer-btn" :disabled="historyIndex <= 0" title="Undo (⌘Z)" @click="undo">
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
                    :disabled="historyIndex >= history.length - 1"
                    title="Redo (⌘⇧Z)"
                    @click="redo"
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
                <button class="footer-btn" title="Clear canvas" @click="clearAll">
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
                <button class="footer-btn export-btn" title="Export image" @click="openExportDialog">
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

        <!-- Export Dialog -->
        <teleport to="body">
            <transition name="export-fade">
                <div v-if="showExportDialog" class="export-overlay" @click.self="closeExportDialog">
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
                                <button
                                    class="export-action-btn primary"
                                    :disabled="isExporting"
                                    @click="exportSavePng"
                                >
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
                                <button class="export-action-btn" :disabled="isExporting" @click="exportCopyClipboard">
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

                            <button class="export-close-btn" @click="closeExportDialog">&times;</button>
                        </div>
                    </div>
                </div>
            </transition>
        </teleport>
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

// ─── Floating Toolbar ────────────────────────────────────────────────────────

.floating-toolbar {
    position: absolute;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 20;
}

.toolbar-inner {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px;
    background: var(--bg-primary, #fff);
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 10px;
    box-shadow:
        0 1px 5px rgba(0, 0, 0, 0.08),
        0 4px 16px rgba(0, 0, 0, 0.04);
}

.toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--text2, #6e6e73);
    cursor: pointer;
    transition:
        background 0.12s,
        color 0.12s;
    flex-shrink: 0;

    &:hover {
        background: var(--bg-hover, #f0f0f0);
        color: var(--text1, #1d1d1f);
    }

    &.active {
        background: var(--accent-color-alpha, rgba(62, 180, 137, 0.12));
        color: var(--accent-color, #3eb489);
    }
}

.toolbar-sep {
    width: 1px;
    height: 24px;
    background: var(--border-color, #e0e0e0);
    margin: 0 2px;
    flex-shrink: 0;
}

// ─── Architecture Dropdown ───────────────────────────────────────────────────

.arch-dropdown {
    position: relative;
}

.arch-dropdown-menu {
    position: absolute;
    top: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2px;
    padding: 6px;
    background: var(--bg-primary, #fff);
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 10px;
    box-shadow:
        0 4px 20px rgba(0, 0, 0, 0.12),
        0 1px 6px rgba(0, 0, 0, 0.06);
    z-index: 25;
    min-width: 200px;
}

.arch-shape-btn {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--text2, #6e6e73);
    cursor: pointer;
    transition:
        background 0.12s,
        color 0.12s;
    font-size: 12px;
    white-space: nowrap;

    &:hover {
        background: var(--bg-hover, #f0f0f0);
        color: var(--text1, #1d1d1f);
    }

    &.active {
        background: var(--accent-color-alpha, rgba(62, 180, 137, 0.12));
        color: var(--accent-color, #3eb489);
    }
}

.arch-shape-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    flex-shrink: 0;

    svg {
        width: 18px;
        height: 18px;
    }
}

.arch-shape-label {
    font-weight: 500;
}

// ─── Properties Panel ────────────────────────────────────────────────────────

.properties-panel {
    position: absolute;
    top: 64px;
    left: 12px;
    width: 192px;
    background: var(--bg-primary, #fff);
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 10px;
    box-shadow:
        0 1px 5px rgba(0, 0, 0, 0.08),
        0 4px 16px rgba(0, 0, 0, 0.04);
    padding: 12px;
    z-index: 15;
}

.panel-fade-enter-active,
.panel-fade-leave-active {
    transition:
        opacity 0.15s ease,
        transform 0.15s ease;
}
.panel-fade-enter-from,
.panel-fade-leave-to {
    opacity: 0;
    transform: translateX(-8px);
}

.prop-section {
    margin-bottom: 12px;

    &:last-child {
        margin-bottom: 0;
    }
}

.prop-actions {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.action-btn {
    display: flex;
    align-items: center;
    gap: 7px;
    width: 100%;
    padding: 6px 8px;
    border-radius: 6px;
    border: none;
    background: transparent;
    color: $text1;
    font-size: 12px;
    cursor: pointer;
    transition: background 0.12s;
    text-align: left;

    &:hover {
        background: var(--hover-bg, rgba(128, 128, 128, 0.12));
    }

    &.action-btn--delete {
        color: #e05555;

        &:hover {
            background: rgba(224, 85, 85, 0.1);
        }
    }
}

.prop-label {
    font-size: 11px;
    font-weight: 600;
    color: var(--text-muted, #8e8e93);
    text-transform: uppercase;
    letter-spacing: 0.04em;
    margin-bottom: 6px;
}

.color-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
}

.color-swatch {
    width: 22px;
    height: 22px;
    border: 2px solid transparent;
    border-radius: 4px;
    cursor: pointer;
    transition:
        border-color 0.12s,
        transform 0.12s;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;

    &:hover {
        transform: scale(1.15);
    }

    &.active {
        border-color: var(--accent-color, #3eb489);
        transform: scale(1.15);
    }

    &.transparent-swatch {
        background:
            linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%),
            linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%);
        background-size: 8px 8px;
        background-position:
            0 0,
            0 4px,
            4px -4px,
            -4px 0;
        color: var(--text2, #888);

        svg {
            filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.3));
        }
    }
}

.stroke-width-row {
    display: flex;
    gap: 4px;
}

.stroke-width-btn {
    flex: 1;
    height: 32px;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition:
        background 0.12s,
        border-color 0.12s;

    &:hover {
        background: var(--bg-hover, #f0f0f0);
    }

    &.active {
        background: var(--accent-color-alpha, rgba(62, 180, 137, 0.12));
        border-color: var(--accent-color, #3eb489);
    }

    .stroke-preview {
        width: 60%;
        background: var(--text1, #1d1d1f);
        border-radius: 4px;
        min-height: 1px;
    }
}

.stroke-style-row {
    display: flex;
    gap: 4px;
}

.stroke-style-btn {
    flex: 1;
    height: 32px;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text1, #1d1d1f);
    transition:
        background 0.12s,
        border-color 0.12s;

    &:hover {
        background: var(--bg-hover, #f0f0f0);
    }

    &.active {
        background: var(--accent-color-alpha, rgba(62, 180, 137, 0.12));
        border-color: var(--accent-color, #3eb489);
    }
}

.roundness-row {
    display: flex;
    gap: 4px;
}

.roundness-btn {
    flex: 1;
    height: 32px;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text1, #1d1d1f);
    transition:
        background 0.12s,
        border-color 0.12s;

    &:hover {
        background: var(--bg-hover, #f0f0f0);
    }

    &.active {
        background: var(--accent-color-alpha, rgba(62, 180, 137, 0.12));
        border-color: var(--accent-color, #3eb489);
    }
}

.font-size-row {
    display: flex;
    gap: 4px;
}

.font-size-btn {
    flex: 1;
    height: 32px;
    border: 1px solid var(--border-color, #e0e0e0);
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text1, #1d1d1f);
    font-size: 12px;
    font-weight: 500;
    transition:
        background 0.12s,
        border-color 0.12s;

    &:hover {
        background: var(--bg-hover, #f0f0f0);
    }

    &.active {
        background: var(--accent-color-alpha, rgba(62, 180, 137, 0.12));
        border-color: var(--accent-color, #3eb489);
    }
}

.font-size-value {
    font-weight: 400;
    opacity: 0.6;
    margin-left: 4px;
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

// Export fade transition
.export-fade-enter-active,
.export-fade-leave-active {
    transition: opacity 0.2s ease;
}
.export-fade-enter-from,
.export-fade-leave-to {
    opacity: 0;
}
</style>
