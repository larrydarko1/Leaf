import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';
import { shallowMount } from '@vue/test-utils';
import { i18n } from '@/renderer/i18n';
import DrawingCanvas from '@/renderer/components/DrawingCanvas.vue';

// ── drawing composable mocks ─────────────────────────────────────────────────

const mockElements = ref<unknown[]>([]);
const mockSelectedId = ref<string | null>(null);
const mockSelectedIds = ref<Set<string>>(new Set());
const mockCreatingElement = ref<unknown>(null);
const mockClipboard = ref<unknown[]>([]);
const mockSelectedElement = ref<unknown>(null);
const mockSelectedElements = ref<unknown[]>([]);

vi.mock('@/renderer/composables/drawing/useDrawingElements', () => ({
    genId: vi.fn().mockReturnValue('id-123'),
    useDrawingElements: vi.fn(() => ({
        elements: mockElements,
        selectedId: mockSelectedId,
        selectedIds: mockSelectedIds,
        creatingElement: mockCreatingElement,
        clipboard: mockClipboard,
        selectedElement: mockSelectedElement,
        selectedElements: mockSelectedElements,
        isShapeElement: vi.fn().mockReturnValue(false),
        getElementBounds: vi.fn().mockReturnValue({ x: 0, y: 0, width: 0, height: 0 }),
        getHandlePositions: vi.fn().mockReturnValue([]),
        hitTestElement: vi.fn().mockReturnValue(null),
        hitTestHandle: vi.fn().mockReturnValue(null),
        isShapeTool: vi.fn().mockReturnValue(false),
    })),
}));

const mockSetupCanvas = vi.fn();
const mockHandleResize = vi.fn();
const mockRenderScene = vi.fn();
const mockGetCtx = vi.fn().mockReturnValue(null);
const mockExportToBlob = vi.fn();

vi.mock('@/renderer/composables/drawing/useCanvasRenderer', () => ({
    useCanvasRenderer: vi.fn(() => ({
        setupCanvas: mockSetupCanvas,
        handleResize: mockHandleResize,
        renderScene: mockRenderScene,
        screenToWorld: vi.fn(),
        worldToScreen: vi.fn(),
        getScreenPoint: vi.fn(),
        cssWidth: ref(800),
        cssHeight: ref(600),
        getCtx: mockGetCtx,
        exportToBlob: mockExportToBlob,
    })),
}));

const mockLoadDrawing = vi.fn();
const mockCleanupAutoSave = vi.fn();
const mockScheduleAutoSave = vi.fn();

vi.mock('@/renderer/composables/drawing/useDrawingPersistence', () => ({
    useDrawingPersistence: vi.fn(() => ({
        hasUnsavedChanges: ref(false),
        isSaving: ref(false),
        scheduleAutoSave: mockScheduleAutoSave,
        loadDrawing: mockLoadDrawing,
        cleanup: mockCleanupAutoSave,
    })),
}));

const mockUndo = vi.fn();
const mockRedo = vi.fn();
const mockClearAll = vi.fn();
const mockCopySelected = vi.fn();
const mockPasteClipboard = vi.fn();
const mockDuplicateSelected = vi.fn();
const mockDeleteSelected = vi.fn();
const mockSaveToHistory = vi.fn();

vi.mock('@/renderer/composables/drawing/useDrawingHistory', () => ({
    useDrawingHistory: vi.fn(() => ({
        saveToHistory: mockSaveToHistory,
        undo: mockUndo,
        redo: mockRedo,
        clearAll: mockClearAll,
        copySelected: mockCopySelected,
        pasteClipboard: mockPasteClipboard,
        duplicateSelected: mockDuplicateSelected,
        deleteSelected: mockDeleteSelected,
    })),
}));

const mockTextEditing = ref(false);
const mockTextValue = ref('');
const mockCancelText = vi.fn();
const mockFinalizeText = vi.fn();
const mockOnTextEnter = vi.fn();
const mockOnDoubleClick = vi.fn();

vi.mock('@/renderer/composables/drawing/useTextEditing', () => ({
    useTextEditing: vi.fn(() => ({
        textEditing: mockTextEditing,
        textValue: mockTextValue,
        textOverlayStyle: computed(() => ({})),
        startNewText: vi.fn(),
        startEditText: vi.fn(),
        startEditShapeText: vi.fn(),
        cancelText: mockCancelText,
        onTextEnter: mockOnTextEnter,
        finalizeText: mockFinalizeText,
        onDoubleClick: mockOnDoubleClick,
    })),
}));

const mockEffectiveTool = ref<string>('select');
const mockIsDragging = ref(false);
const mockPointerMove = Object.assign(vi.fn(), { cancel: vi.fn() });
const mockWheel = Object.assign(vi.fn(), { cancel: vi.fn() });
const mockZoomToCenter = vi.fn();
const mockHandleKeydown = vi.fn();
const mockHandleKeyup = vi.fn();

vi.mock('@/renderer/composables/drawing/useDrawingInteraction', () => ({
    useDrawingInteraction: vi.fn(() => ({
        isDragging: mockIsDragging,
        effectiveTool: mockEffectiveTool,
        onPointerDown: vi.fn(),
        onPointerMove: mockPointerMove,
        onPointerUp: vi.fn(),
        onWheel: mockWheel,
        zoomToCenter: mockZoomToCenter,
        handleKeydown: mockHandleKeydown,
        handleKeyup: mockHandleKeyup,
    })),
}));

// ── helper ────────────────────────────────────────────────────────────────────

const defaultProps = {
    filePath: '/vault/art.drawing',
    initialContent: '',
};

function mountCanvas(overrides: Partial<typeof defaultProps> = {}) {
    return shallowMount(DrawingCanvas, {
        props: { ...defaultProps, ...overrides },
        global: { plugins: [i18n] },
    });
}

beforeEach(() => {
    vi.clearAllMocks();
    mockSelectedIds.value = new Set();
    mockSelectedElement.value = null;
    mockSelectedElements.value = [];
    mockElements.value = [];
    mockEffectiveTool.value = 'select';
    mockIsDragging.value = false;
    mockTextEditing.value = false;
    mockPointerMove.cancel = vi.fn();
    mockWheel.cancel = vi.fn();
});

describe('DrawingCanvas', () => {
    describe('initial render', () => {
        it('renders the canvas-container root', () => {
            const wrapper = mountCanvas();
            expect(wrapper.find('.canvas-container').exists()).toBe(true);
            wrapper.unmount();
        });

        it('renders a canvas element', () => {
            const wrapper = mountCanvas();
            expect(wrapper.find('canvas').exists()).toBe(true);
            wrapper.unmount();
        });

        it('renders DrawingToolbar', () => {
            const wrapper = mountCanvas();
            expect(wrapper.findComponent({ name: 'DrawingToolbar' }).exists()).toBe(true);
            wrapper.unmount();
        });

        it('renders DrawingPropertiesPanel', () => {
            const wrapper = mountCanvas();
            expect(wrapper.findComponent({ name: 'DrawingPropertiesPanel' }).exists()).toBe(true);
            wrapper.unmount();
        });

        it('renders DrawingFooter', () => {
            const wrapper = mountCanvas();
            expect(wrapper.findComponent({ name: 'DrawingFooter' }).exists()).toBe(true);
            wrapper.unmount();
        });

        it('renders DrawingExportDialog', () => {
            const wrapper = mountCanvas();
            expect(wrapper.findComponent({ name: 'DrawingExportDialog' }).exists()).toBe(true);
            wrapper.unmount();
        });
    });

    describe('lifecycle hooks', () => {
        it('calls setupCanvas on mount', () => {
            mountCanvas();
            expect(mockSetupCanvas).toHaveBeenCalled();
        });

        it('calls loadDrawing on mount', () => {
            mountCanvas();
            expect(mockLoadDrawing).toHaveBeenCalled();
        });

        it('calls cleanupAutoSave on unmount', () => {
            const wrapper = mountCanvas();
            wrapper.unmount();
            expect(mockCleanupAutoSave).toHaveBeenCalled();
        });

        it('calls cancel on throttled handlers on unmount', () => {
            const wrapper = mountCanvas();
            wrapper.unmount();
            expect(mockPointerMove.cancel).toHaveBeenCalled();
            expect(mockWheel.cancel).toHaveBeenCalled();
        });
    });

    describe('text editing overlay', () => {
        it('hides textarea when textEditing is false', () => {
            mockTextEditing.value = false;
            const wrapper = mountCanvas();
            expect(wrapper.find('textarea').exists()).toBe(false);
            wrapper.unmount();
        });

        it('shows textarea when textEditing is true', () => {
            mockTextEditing.value = true;
            const wrapper = mountCanvas();
            expect(wrapper.find('textarea').exists()).toBe(true);
            wrapper.unmount();
        });
    });

    describe('computed: canvasCursor', () => {
        it('returns "grab" cursor for hand tool (not dragging)', () => {
            mockEffectiveTool.value = 'hand';
            mockIsDragging.value = false;
            const wrapper = mountCanvas();
            expect(wrapper.find('canvas').attributes('style')).toContain('grab');
            wrapper.unmount();
        });

        it('returns "grabbing" cursor for hand tool when dragging', () => {
            mockEffectiveTool.value = 'hand';
            mockIsDragging.value = true;
            const wrapper = mountCanvas();
            expect(wrapper.find('canvas').attributes('style')).toContain('grabbing');
            wrapper.unmount();
        });

        it('returns "default" cursor for select tool', () => {
            mockEffectiveTool.value = 'select';
            const wrapper = mountCanvas();
            expect(wrapper.find('canvas').attributes('style')).toContain('default');
            wrapper.unmount();
        });

        it('returns "cell" cursor for eraser tool', () => {
            mockEffectiveTool.value = 'eraser';
            const wrapper = mountCanvas();
            expect(wrapper.find('canvas').attributes('style')).toContain('cell');
            wrapper.unmount();
        });

        it('returns "text" cursor for text tool', () => {
            mockEffectiveTool.value = 'text';
            const wrapper = mountCanvas();
            expect(wrapper.find('canvas').attributes('style')).toContain('text');
            wrapper.unmount();
        });

        it('returns "crosshair" cursor for draw tools', () => {
            mockEffectiveTool.value = 'freedraw';
            const wrapper = mountCanvas();
            expect(wrapper.find('canvas').attributes('style')).toContain('crosshair');
            wrapper.unmount();
        });
    });

    describe('computed: shouldShowProperties', () => {
        it('is false for hand/select tool with no selection', () => {
            mockEffectiveTool.value = 'select';
            mockSelectedIds.value = new Set();
            const wrapper = mountCanvas();
            const panel = wrapper.findComponent({ name: 'DrawingPropertiesPanel' });
            expect(panel.props('visible')).toBe(false);
            wrapper.unmount();
        });

        it('is true when something is selected', () => {
            mockEffectiveTool.value = 'select';
            mockSelectedIds.value = new Set(['el-1']);
            const wrapper = mountCanvas();
            const panel = wrapper.findComponent({ name: 'DrawingPropertiesPanel' });
            expect(panel.props('visible')).toBe(true);
            wrapper.unmount();
        });

        it('is true for non-select/hand tools', () => {
            mockEffectiveTool.value = 'rectangle';
            const wrapper = mountCanvas();
            const panel = wrapper.findComponent({ name: 'DrawingPropertiesPanel' });
            expect(panel.props('visible')).toBe(true);
            wrapper.unmount();
        });
    });

    describe('selectTool', () => {
        it('calls renderScene after tool change', async () => {
            const wrapper = mountCanvas();
            mockRenderScene.mockClear();
            const toolbar = wrapper.findComponent({ name: 'DrawingToolbar' });
            await toolbar.vm.$emit('select-tool', 'rectangle');
            expect(mockRenderScene).toHaveBeenCalled();
            wrapper.unmount();
        });

        it('clears selectedIds when switching away from select', async () => {
            mockSelectedIds.value = new Set(['el-1', 'el-2']);
            const wrapper = mountCanvas();
            const toolbar = wrapper.findComponent({ name: 'DrawingToolbar' });
            await toolbar.vm.$emit('select-tool', 'freedraw');
            expect(mockSelectedIds.value.size).toBe(0);
            wrapper.unmount();
        });

        it('does not clear selection when switching to select tool', async () => {
            mockSelectedIds.value = new Set(['el-1']);
            const wrapper = mountCanvas();
            const toolbar = wrapper.findComponent({ name: 'DrawingToolbar' });
            await toolbar.vm.$emit('select-tool', 'select');
            expect(mockSelectedIds.value.size).toBe(1);
            wrapper.unmount();
        });
    });

    describe('export dialog', () => {
        it('export dialog is hidden by default', () => {
            const wrapper = mountCanvas();
            expect(wrapper.findComponent({ name: 'DrawingExportDialog' }).props('visible')).toBe(false);
            wrapper.unmount();
        });

        it('opens export dialog via footer event', async () => {
            const wrapper = mountCanvas();
            await wrapper.findComponent({ name: 'DrawingFooter' }).vm.$emit('open-export-dialog');
            expect(wrapper.findComponent({ name: 'DrawingExportDialog' }).props('visible')).toBe(true);
            wrapper.unmount();
        });

        it('closes export dialog on close event', async () => {
            const wrapper = mountCanvas();
            await wrapper.findComponent({ name: 'DrawingFooter' }).vm.$emit('open-export-dialog');
            await wrapper.findComponent({ name: 'DrawingExportDialog' }).vm.$emit('close');
            expect(wrapper.findComponent({ name: 'DrawingExportDialog' }).props('visible')).toBe(false);
            wrapper.unmount();
        });
    });

    describe('file prop changes', () => {
        it('calls loadDrawing when filePath prop changes', async () => {
            const wrapper = mountCanvas({ filePath: '/vault/art.drawing' });
            mockLoadDrawing.mockClear();
            await wrapper.setProps({ filePath: '/vault/new.drawing' });
            expect(mockLoadDrawing).toHaveBeenCalled();
            wrapper.unmount();
        });

        it('calls loadDrawing when initialContent prop changes', async () => {
            const wrapper = mountCanvas({ initialContent: '' });
            mockLoadDrawing.mockClear();
            await wrapper.setProps({ initialContent: '{"elements":[]}' });
            expect(mockLoadDrawing).toHaveBeenCalled();
            wrapper.unmount();
        });
    });
});
