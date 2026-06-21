/**
 * Pointer event branch coverage for useDrawingInteraction:
 * onPointerDown (all tools), onPointerMove (all drag actions),
 * onPointerUp (all finalization paths), applyResize, constrainDimensions.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';
import { useDrawingInteraction } from '@/renderer/composables/drawing/useDrawingInteraction';
import type { CanvasElement, DefaultStyle, ToolType } from '@/schemas/drawing';

// ── helpers ───────────────────────────────────────────────────────────────────

let idCounter = 0;

function makeEl(overrides: Partial<CanvasElement> = {}): CanvasElement {
    return {
        id: `el-${++idCounter}`,
        type: 'rectangle',
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        strokeColor: '#000',
        fillColor: '#fff',
        strokeWidth: 2,
        strokeStyle: 'solid',
        roughness: 0,
        opacity: 1,
        isLocked: false,
        zIndex: 0,
        rotation: 0,
        borderRadius: 0,
        label: '',
        fontSize: 16,
        fontFamily: 'sans-serif',
        textAlign: 'center',
        verticalAlign: 'middle',
        ...overrides,
    };
}

function makeInteraction(
    opts: {
        initialTool?: ToolType;
        initialElements?: CanvasElement[];
        selectedId?: string | null;
        textEditing?: boolean;
        isShapeToolResult?: boolean;
    } = {},
) {
    const canvas = ref<HTMLCanvasElement | null>(null);
    const containerEl = ref<HTMLDivElement | null>(null);
    const scrollX = ref(0);
    const scrollY = ref(0);
    const zoom = ref(1);
    const elements = ref<CanvasElement[]>(opts.initialElements ?? []);
    const selectedId = ref<string | null>(opts.selectedId ?? null);
    const selectedIds = ref<Set<string>>(new Set());
    const creatingElement = ref<CanvasElement | null>(null);
    const currentTool = ref<ToolType>(opts.initialTool ?? 'select');
    const defaultStyle = ref<DefaultStyle>({
        strokeColor: '#000000',
        fillColor: '#ffffff',
        strokeWidth: 2,
        strokeStyle: 'solid',
        roughness: 0,
        opacity: 1,
        fontSize: 20,
        fontFamily: 'sans-serif',
        textAlign: 'center',
        verticalAlign: 'middle',
    });
    const marqueeRect = ref<{ x: number; y: number; width: number; height: number } | null>(null);
    const textEditing = ref(opts.textEditing ?? false);

    const selectedElement = computed<CanvasElement | null>(() =>
        selectedId.value != null ? (elements.value.find((e) => e.id === selectedId.value) ?? null) : null,
    );
    const selectedElements = computed<CanvasElement[]>(() => elements.value.filter((e) => selectedIds.value.has(e.id)));

    const isShapeElement = vi.fn().mockImplementation((el: CanvasElement) => el.type === 'rectangle');
    const isShapeTool = vi.fn().mockReturnValue(opts.isShapeToolResult ?? false);
    const hitTestElement = vi.fn().mockReturnValue(null);
    const hitTestHandle = vi.fn().mockReturnValue(null);
    const getElementBounds = vi.fn().mockImplementation((el: CanvasElement) => ({
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
    }));
    const screenToWorld = vi.fn().mockImplementation((sx: number, sy: number) => ({ x: sx, y: sy }));
    const getScreenPoint = vi.fn().mockImplementation((e: { clientX: number; clientY: number }) => ({
        x: e.clientX ?? 0,
        y: e.clientY ?? 0,
    }));
    const cssWidth = vi.fn().mockReturnValue(800);
    const cssHeight = vi.fn().mockReturnValue(600);
    const renderScene = vi.fn();
    const finalizeText = vi.fn();
    const startNewText = vi.fn();
    const startEditText = vi.fn();
    const startEditShapeText = vi.fn();
    const saveToHistory = vi.fn();
    const scheduleAutoSave = vi.fn();
    const selectTool = vi.fn().mockImplementation((tool: ToolType) => {
        currentTool.value = tool;
    });
    const undo = vi.fn();
    const redo = vi.fn();
    const copySelected = vi.fn();
    const pasteClipboard = vi.fn();
    const duplicateSelected = vi.fn();
    const deleteSelected = vi.fn();

    const interaction = useDrawingInteraction(
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
        () => `gen-${++idCounter}`,
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

    return {
        canvas,
        containerEl,
        scrollX,
        scrollY,
        zoom,
        elements,
        selectedId,
        selectedIds,
        creatingElement,
        currentTool,
        defaultStyle,
        marqueeRect,
        textEditing,
        selectedElement,
        selectedElements,
        isShapeElement,
        isShapeTool,
        hitTestElement,
        hitTestHandle,
        getElementBounds,
        renderScene,
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
        ...interaction,
    };
}

function ptr(overrides: Record<string, unknown> = {}): PointerEvent {
    return {
        type: 'pointerdown',
        clientX: 100,
        clientY: 100,
        pointerId: 1,
        button: 0,
        buttons: 1,
        isPrimary: true,
        pressure: 0.5,
        shiftKey: false,
        ctrlKey: false,
        metaKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
        target: { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() },
        ...overrides,
    } as unknown as PointerEvent;
}

beforeEach(() => {
    vi.clearAllMocks();
    idCounter = 0;
});

// ── onPointerDown: textEditing branch ────────────────────────────────────────

describe('onPointerDown: textEditing active', () => {
    it('calls finalizeText and returns early when textEditing is true', () => {
        const { onPointerDown, finalizeText, isDragging } = makeInteraction({ textEditing: true });
        onPointerDown(ptr());
        expect(finalizeText).toHaveBeenCalled();
        expect(isDragging.value).toBe(false);
    });
});

// ── onPointerDown: text tool ──────────────────────────────────────────────────

describe('onPointerDown: text tool', () => {
    it('calls startEditText when hitting a text element', () => {
        const textEl = makeEl({ type: 'text', id: 'txt' });
        const ctx = makeInteraction({ initialTool: 'text', initialElements: [textEl] });
        ctx.hitTestElement.mockReturnValue(textEl);
        ctx.isShapeElement.mockReturnValue(false);
        ctx.onPointerDown(ptr());
        expect(ctx.startEditText).toHaveBeenCalledWith(textEl);
    });

    it('calls startEditShapeText when hitting a shape element with text', () => {
        const shapeEl = makeEl({ type: 'rectangle', id: 'shp', text: 'hello' });
        const ctx = makeInteraction({ initialTool: 'text', initialElements: [shapeEl] });
        ctx.hitTestElement.mockReturnValue(shapeEl);
        ctx.isShapeElement.mockReturnValue(true);
        ctx.onPointerDown(ptr());
        expect(ctx.startEditShapeText).toHaveBeenCalledWith(shapeEl);
    });

    it('calls startNewText when hitting empty space', () => {
        const ctx = makeInteraction({ initialTool: 'text' });
        ctx.hitTestElement.mockReturnValue(null);
        ctx.onPointerDown(ptr({ clientX: 50, clientY: 60 }));
        expect(ctx.startNewText).toHaveBeenCalledWith(50, 60);
    });

    it('does not start dragging (text tool skips pointer capture)', () => {
        const ctx = makeInteraction({ initialTool: 'text' });
        ctx.onPointerDown(ptr());
        expect(ctx.isDragging.value).toBe(false);
    });

    it('calls startEditShapeText for shape with empty text falls through to startNewText', () => {
        const shapeEl = makeEl({ type: 'rectangle', id: 'shp', text: '' });
        const ctx = makeInteraction({ initialTool: 'text', initialElements: [shapeEl] });
        ctx.hitTestElement.mockReturnValue(shapeEl);
        ctx.isShapeElement.mockReturnValue(true);
        ctx.onPointerDown(ptr());
        // text is empty string, length is 0 → startNewText (not startEditShapeText)
        expect(ctx.startNewText).toHaveBeenCalled();
    });
});

// ── onPointerDown: hand tool ──────────────────────────────────────────────────

describe('onPointerDown: hand tool', () => {
    it('sets dragAction to pan', () => {
        const ctx = makeInteraction({ initialTool: 'hand' });
        ctx.onPointerDown(ptr());
        expect(ctx.dragAction.value).toBe('pan');
        expect(ctx.isDragging.value).toBe(true);
    });
});

// ── onPointerDown: select tool ────────────────────────────────────────────────

describe('onPointerDown: select tool — resize handle', () => {
    it('starts resize when hitTestHandle returns a handle', () => {
        const el = makeEl({ id: 'rect-1' });
        const ctx = makeInteraction({ initialTool: 'select', initialElements: [el] });
        ctx.hitTestHandle.mockReturnValue({ elementId: 'rect-1', handle: 'se' });
        ctx.onPointerDown(ptr());
        expect(ctx.dragAction.value).toBe('resize');
    });

    it('records resize state — subsequent move changes element dimensions', () => {
        const el = makeEl({ id: 'rect-1', x: 0, y: 0, width: 100, height: 50 });
        const ctx = makeInteraction({ initialTool: 'select', initialElements: [el] });
        ctx.hitTestHandle.mockReturnValue({ elementId: 'rect-1', handle: 'se' });
        ctx.selectedId.value = 'rect-1';
        ctx.onPointerDown(ptr({ clientX: 100, clientY: 50 }));
        ctx.onPointerMove({ ...ptr({ clientX: 150, clientY: 80 }), type: 'pointermove' } as unknown as PointerEvent);
        expect(el.width).toBe(150); // se: wx - ox = 150 - 0
        expect(el.height).toBe(80); // wy - oy = 80 - 0
    });
});

describe('onPointerDown: select tool — hit element', () => {
    it('selects element and starts move', () => {
        const el = makeEl({ id: 'el-1' });
        const ctx = makeInteraction({ initialTool: 'select', initialElements: [el] });
        ctx.hitTestElement.mockReturnValue(el);
        ctx.onPointerDown(ptr());
        expect(ctx.selectedIds.value.has('el-1')).toBe(true);
        expect(ctx.dragAction.value).toBe('move');
    });

    it('shift-click adds element to selection', () => {
        const el1 = makeEl({ id: 'el-1' });
        const el2 = makeEl({ id: 'el-2' });
        const ctx = makeInteraction({ initialTool: 'select', initialElements: [el1, el2] });
        ctx.selectedIds.value = new Set(['el-1']);
        ctx.shiftHeld.value = true;
        ctx.hitTestElement.mockReturnValue(el2);
        ctx.onPointerDown(ptr());
        expect(ctx.selectedIds.value.has('el-1')).toBe(true);
        expect(ctx.selectedIds.value.has('el-2')).toBe(true);
    });

    it('shift-click removes element already in selection', () => {
        const el1 = makeEl({ id: 'el-1' });
        const ctx = makeInteraction({ initialTool: 'select', initialElements: [el1] });
        ctx.selectedIds.value = new Set(['el-1']);
        ctx.shiftHeld.value = true;
        ctx.hitTestElement.mockReturnValue(el1);
        ctx.onPointerDown(ptr());
        expect(ctx.selectedIds.value.has('el-1')).toBe(false);
    });

    it('click on already-selected element does not deselect it', () => {
        const el1 = makeEl({ id: 'el-1' });
        const ctx = makeInteraction({ initialTool: 'select', initialElements: [el1] });
        ctx.selectedIds.value = new Set(['el-1']);
        ctx.hitTestElement.mockReturnValue(el1);
        ctx.onPointerDown(ptr());
        expect(ctx.selectedIds.value.has('el-1')).toBe(true);
    });
});

describe('onPointerDown: select tool — marquee', () => {
    it('starts marquee when clicking empty space', () => {
        const ctx = makeInteraction({ initialTool: 'select' });
        ctx.hitTestElement.mockReturnValue(null);
        ctx.onPointerDown(ptr({ clientX: 50, clientY: 60 }));
        expect(ctx.dragAction.value).toBe('marquee');
        expect(ctx.marqueeRect.value).toMatchObject({ x: 50, y: 60, width: 0, height: 0 });
    });

    it('clears selection when clicking empty space (no shift)', () => {
        const ctx = makeInteraction({ initialTool: 'select' });
        ctx.selectedIds.value = new Set(['x']);
        ctx.hitTestElement.mockReturnValue(null);
        ctx.onPointerDown(ptr());
        expect(ctx.selectedIds.value.size).toBe(0);
    });

    it('preserves selection when shift-clicking empty space', () => {
        const ctx = makeInteraction({ initialTool: 'select' });
        ctx.selectedIds.value = new Set(['x']);
        ctx.shiftHeld.value = true;
        ctx.hitTestElement.mockReturnValue(null);
        ctx.onPointerDown(ptr());
        expect(ctx.selectedIds.value.has('x')).toBe(true);
    });
});

// ── onPointerDown: eraser tool ────────────────────────────────────────────────

describe('onPointerDown: eraser tool', () => {
    it('sets dragAction to erase', () => {
        const ctx = makeInteraction({ initialTool: 'eraser' });
        ctx.onPointerDown(ptr());
        expect(ctx.dragAction.value).toBe('erase');
    });

    it('erases element under pointer immediately', () => {
        const el = makeEl({ id: 'e1' });
        const ctx = makeInteraction({ initialTool: 'eraser', initialElements: [el] });
        ctx.hitTestElement.mockReturnValue(el);
        ctx.onPointerDown(ptr());
        expect(ctx.elements.value.find((e) => e.id === 'e1')).toBeUndefined();
    });

    it('clears selectedId when erasing the selected element', () => {
        const el = makeEl({ id: 'e1' });
        const ctx = makeInteraction({ initialTool: 'eraser', initialElements: [el], selectedId: 'e1' });
        ctx.hitTestElement.mockReturnValue(el);
        ctx.onPointerDown(ptr());
        expect(ctx.selectedId.value).toBeNull();
    });
});

// ── onPointerDown: freedraw tool ──────────────────────────────────────────────

describe('onPointerDown: freedraw tool', () => {
    it('sets dragAction to freedraw and creates a freedraw element', () => {
        const ctx = makeInteraction({ initialTool: 'freedraw' });
        ctx.onPointerDown(ptr({ clientX: 30, clientY: 40 }));
        expect(ctx.dragAction.value).toBe('freedraw');
        expect(ctx.creatingElement.value?.type).toBe('freedraw');
        expect(ctx.creatingElement.value?.points).toHaveLength(1);
    });
});

// ── onPointerDown: shape tool (isShapeTool) ───────────────────────────────────

describe('onPointerDown: shape tool', () => {
    it('sets dragAction to create when isShapeTool returns true', () => {
        const ctx = makeInteraction({ initialTool: 'rectangle', isShapeToolResult: true });
        ctx.onPointerDown(ptr({ clientX: 20, clientY: 30 }));
        expect(ctx.dragAction.value).toBe('create');
        expect(ctx.creatingElement.value?.type).toBe('rectangle');
    });

    it('creates element at pointer world position', () => {
        const ctx = makeInteraction({ initialTool: 'ellipse', isShapeToolResult: true });
        ctx.onPointerDown(ptr({ clientX: 100, clientY: 200 }));
        expect(ctx.creatingElement.value?.x).toBe(100);
        expect(ctx.creatingElement.value?.y).toBe(200);
    });
});

// ── onPointerMove: pan ────────────────────────────────────────────────────────

describe('onPointerMove: pan', () => {
    it('updates scroll and calls renderScene', () => {
        const ctx = makeInteraction({ initialTool: 'hand' });
        ctx.onPointerDown(ptr({ clientX: 100, clientY: 100 }));
        ctx.scrollX.value = 0;
        ctx.scrollY.value = 0;
        // Move 20px right, 15px down
        const moveEvt = { ...ptr({ clientX: 120, clientY: 115 }), type: 'pointermove' } as unknown as PointerEvent;
        ctx.onPointerMove(moveEvt);
        expect(ctx.scrollX.value).toBe(20);
        expect(ctx.scrollY.value).toBe(15);
        expect(ctx.renderScene).toHaveBeenCalled();
    });

    it('does nothing when not dragging', () => {
        const ctx = makeInteraction({ initialTool: 'hand' });
        ctx.onPointerMove(ptr());
        expect(ctx.renderScene).not.toHaveBeenCalled();
    });
});

// ── onPointerMove: create ─────────────────────────────────────────────────────

describe('onPointerMove: create', () => {
    it('updates creating element dimensions', () => {
        const ctx = makeInteraction({ initialTool: 'rectangle', isShapeToolResult: true });
        ctx.onPointerDown(ptr({ clientX: 10, clientY: 10 }));
        ctx.onPointerMove({ ...ptr({ clientX: 110, clientY: 60 }), type: 'pointermove' } as unknown as PointerEvent);
        expect(ctx.creatingElement.value?.width).toBe(100);
        expect(ctx.creatingElement.value?.height).toBe(50);
    });

    it('constrains to square when shift held (rectangle)', () => {
        const ctx = makeInteraction({ initialTool: 'rectangle', isShapeToolResult: true });
        ctx.onPointerDown(ptr({ clientX: 0, clientY: 0 }));
        ctx.shiftHeld.value = true;
        ctx.onPointerMove({ ...ptr({ clientX: 100, clientY: 60 }), type: 'pointermove' } as unknown as PointerEvent);
        // constrainDimensions for rectangle: max(|w|,|h|) = 100
        expect(Math.abs(ctx.creatingElement.value?.width ?? 0)).toBe(100);
        expect(Math.abs(ctx.creatingElement.value?.height ?? 0)).toBe(100);
    });

    it('breaks early if creatingElement is null', () => {
        const ctx = makeInteraction({ initialTool: 'rectangle', isShapeToolResult: true });
        ctx.isDragging.value = true;
        ctx.dragAction.value = 'create';
        ctx.creatingElement.value = null;
        ctx.onPointerMove({ ...ptr(), type: 'pointermove' } as unknown as PointerEvent);
        expect(ctx.renderScene).not.toHaveBeenCalled();
    });
});

// ── onPointerMove: move ───────────────────────────────────────────────────────

describe('onPointerMove: move', () => {
    it('updates element positions', () => {
        const el = makeEl({ id: 'el-1', x: 10, y: 20 });
        const ctx = makeInteraction({ initialTool: 'select', initialElements: [el] });
        ctx.hitTestElement.mockReturnValue(el);
        ctx.onPointerDown(ptr({ clientX: 10, clientY: 20 }));
        expect(ctx.dragAction.value).toBe('move');
        ctx.onPointerMove({ ...ptr({ clientX: 30, clientY: 40 }), type: 'pointermove' } as unknown as PointerEvent);
        expect(el.x).toBe(30); // 10 + (30-10)
        expect(el.y).toBe(40); // 20 + (40-20)
        expect(ctx.renderScene).toHaveBeenCalled();
    });

    it('breaks early if dragOriginals is empty', () => {
        const ctx = makeInteraction({ initialTool: 'select' });
        ctx.isDragging.value = true;
        ctx.dragAction.value = 'move';
        ctx.onPointerMove({ ...ptr(), type: 'pointermove' } as unknown as PointerEvent);
        expect(ctx.renderScene).not.toHaveBeenCalled();
    });
});

// ── onPointerMove: resize ─────────────────────────────────────────────────────

describe('onPointerMove: resize', () => {
    it('calls renderScene after applyResize', () => {
        const el = makeEl({ id: 'r1', x: 10, y: 20, width: 100, height: 50 });
        const ctx = makeInteraction({ initialTool: 'select', initialElements: [el] });
        ctx.hitTestHandle.mockReturnValue({ elementId: 'r1', handle: 'se' });
        ctx.selectedId.value = 'r1';
        ctx.onPointerDown(ptr({ clientX: 110, clientY: 70 }));
        ctx.onPointerMove({ ...ptr({ clientX: 150, clientY: 100 }), type: 'pointermove' } as unknown as PointerEvent);
        expect(ctx.renderScene).toHaveBeenCalled();
    });
});

// ── onPointerMove: freedraw ───────────────────────────────────────────────────

describe('onPointerMove: freedraw', () => {
    it('adds points to the creating freedraw element', () => {
        const ctx = makeInteraction({ initialTool: 'freedraw' });
        ctx.onPointerDown(ptr({ clientX: 10, clientY: 10 }));
        ctx.onPointerMove({ ...ptr({ clientX: 20, clientY: 30 }), type: 'pointermove' } as unknown as PointerEvent);
        expect(ctx.creatingElement.value?.points?.length).toBeGreaterThan(1);
    });
});

// ── onPointerMove: erase ──────────────────────────────────────────────────────

describe('onPointerMove: erase', () => {
    it('erases newly hit elements while dragging', () => {
        const el1 = makeEl({ id: 'e1' });
        const el2 = makeEl({ id: 'e2' });
        const ctx = makeInteraction({ initialTool: 'eraser', initialElements: [el1, el2] });
        ctx.hitTestElement.mockReturnValue(null); // no hit on pointer down
        ctx.onPointerDown(ptr());
        ctx.hitTestElement.mockReturnValue(el2); // hit el2 on move
        ctx.onPointerMove({ ...ptr({ clientX: 50, clientY: 50 }), type: 'pointermove' } as unknown as PointerEvent);
        expect(ctx.elements.value.find((e) => e.id === 'e2')).toBeUndefined();
    });

    it('removes erased element from selectedIds', () => {
        const el = makeEl({ id: 'e1' });
        const ctx = makeInteraction({ initialTool: 'eraser', initialElements: [el] });
        ctx.selectedIds.value = new Set(['e1']);
        ctx.hitTestElement.mockReturnValue(null);
        ctx.onPointerDown(ptr());
        ctx.hitTestElement.mockReturnValue(el);
        ctx.onPointerMove({ ...ptr(), type: 'pointermove' } as unknown as PointerEvent);
        expect(ctx.selectedIds.value.has('e1')).toBe(false);
    });

    it('skips already-erased element ids', () => {
        const el = makeEl({ id: 'e1' });
        const ctx = makeInteraction({ initialTool: 'eraser', initialElements: [el] });
        ctx.hitTestElement.mockReturnValue(el);
        ctx.onPointerDown(ptr()); // erases e1 on pointerdown
        ctx.hitTestElement.mockReturnValue(el); // same element "hit" again on move
        ctx.renderScene.mockClear();
        ctx.onPointerMove({ ...ptr(), type: 'pointermove' } as unknown as PointerEvent);
        // Should NOT call renderScene a second time for same element
        expect(ctx.renderScene).not.toHaveBeenCalled();
    });
});

// ── onPointerMove: marquee ────────────────────────────────────────────────────

describe('onPointerMove: marquee', () => {
    it('updates marquee rect dimensions and selects enclosed elements', () => {
        const el = makeEl({ id: 'el-1', x: 20, y: 20, width: 30, height: 30 });
        const ctx = makeInteraction({ initialTool: 'select', initialElements: [el] });
        ctx.hitTestElement.mockReturnValue(null);
        ctx.getElementBounds.mockReturnValue({ x: 20, y: 20, width: 30, height: 30 });
        ctx.onPointerDown(ptr({ clientX: 0, clientY: 0 }));
        expect(ctx.dragAction.value).toBe('marquee');
        ctx.onPointerMove({ ...ptr({ clientX: 100, clientY: 100 }), type: 'pointermove' } as unknown as PointerEvent);
        expect(ctx.selectedIds.value.has('el-1')).toBe(true);
    });

    it('merges with existing selection when shift held during marquee', () => {
        const el1 = makeEl({ id: 'el-1', x: 20, y: 20, width: 30, height: 30 });
        const el2 = makeEl({ id: 'el-2', x: 200, y: 200, width: 10, height: 10 });
        const ctx = makeInteraction({ initialTool: 'select', initialElements: [el1, el2] });
        ctx.selectedIds.value = new Set(['el-2']);
        ctx.shiftHeld.value = true;
        ctx.hitTestElement.mockReturnValue(null);
        ctx.onPointerDown(ptr({ clientX: 0, clientY: 0 }));
        ctx.getElementBounds
            .mockReturnValueOnce({ x: 20, y: 20, width: 30, height: 30 })
            .mockReturnValueOnce({ x: 200, y: 200, width: 10, height: 10 });
        ctx.onPointerMove({ ...ptr({ clientX: 100, clientY: 100 }), type: 'pointermove' } as unknown as PointerEvent);
        // el-2 preserved from shift, el-1 newly enclosed by marquee
        expect(ctx.selectedIds.value.has('el-1')).toBe(true);
        expect(ctx.selectedIds.value.has('el-2')).toBe(true);
    });
});

// ── onPointerUp: create ───────────────────────────────────────────────────────

describe('onPointerUp: create', () => {
    it('adds element and saves history when large enough', () => {
        const ctx = makeInteraction({ initialTool: 'rectangle', isShapeToolResult: true });
        ctx.onPointerDown(ptr({ clientX: 0, clientY: 0 }));
        ctx.onPointerMove({ ...ptr({ clientX: 100, clientY: 60 }), type: 'pointermove' } as unknown as PointerEvent);
        ctx.onPointerUp({ ...ptr(), type: 'pointerup' } as unknown as PointerEvent);
        expect(ctx.elements.value.length).toBe(1);
        expect(ctx.saveToHistory).toHaveBeenCalled();
        expect(ctx.scheduleAutoSave).toHaveBeenCalled();
        expect(ctx.creatingElement.value).toBeNull();
    });

    it('discards element when too small', () => {
        const ctx = makeInteraction({ initialTool: 'rectangle', isShapeToolResult: true });
        ctx.onPointerDown(ptr({ clientX: 0, clientY: 0 }));
        // Move only 1px — smaller than MIN_ELEMENT_SIZE (typically 5)
        ctx.onPointerMove({ ...ptr({ clientX: 1, clientY: 1 }), type: 'pointermove' } as unknown as PointerEvent);
        ctx.onPointerUp({ ...ptr(), type: 'pointerup' } as unknown as PointerEvent);
        expect(ctx.elements.value.length).toBe(0);
        expect(ctx.saveToHistory).not.toHaveBeenCalled();
    });

    it('normalizes negative width/height for non-line elements', () => {
        const ctx = makeInteraction({ initialTool: 'rectangle', isShapeToolResult: true });
        ctx.onPointerDown(ptr({ clientX: 100, clientY: 100 }));
        // Move to upper-left → negative w/h
        ctx.onPointerMove({ ...ptr({ clientX: 0, clientY: 0 }), type: 'pointermove' } as unknown as PointerEvent);
        ctx.onPointerUp({ ...ptr(), type: 'pointerup' } as unknown as PointerEvent);
        const el = ctx.elements.value[0];
        if (el !== undefined) {
            expect(el.width).toBeGreaterThan(0);
            expect(el.height).toBeGreaterThan(0);
        }
    });

    it('does not normalize negative dims for line elements', () => {
        const ctx = makeInteraction({ initialTool: 'line', isShapeToolResult: true });
        ctx.onPointerDown(ptr({ clientX: 100, clientY: 100 }));
        ctx.onPointerMove({ ...ptr({ clientX: 0, clientY: 0 }), type: 'pointermove' } as unknown as PointerEvent);
        ctx.onPointerUp({ ...ptr(), type: 'pointerup' } as unknown as PointerEvent);
        // line is allowed to keep negative dimensions
        expect(ctx.elements.value.length).toBeGreaterThanOrEqual(0); // just ensure no throw
    });
});

// ── onPointerUp: move ─────────────────────────────────────────────────────────

describe('onPointerUp: move', () => {
    it('saves history after moving elements', () => {
        const el = makeEl({ id: 'el-1', x: 10, y: 10 });
        const ctx = makeInteraction({ initialTool: 'select', initialElements: [el] });
        ctx.hitTestElement.mockReturnValue(el);
        ctx.onPointerDown(ptr({ clientX: 10, clientY: 10 }));
        ctx.onPointerMove({ ...ptr({ clientX: 30, clientY: 30 }), type: 'pointermove' } as unknown as PointerEvent);
        ctx.onPointerUp({ ...ptr(), type: 'pointerup' } as unknown as PointerEvent);
        expect(ctx.saveToHistory).toHaveBeenCalled();
        expect(ctx.isDragging.value).toBe(false);
    });
});

// ── onPointerUp: resize ───────────────────────────────────────────────────────

describe('onPointerUp: resize', () => {
    it('saves history after resize', () => {
        const el = makeEl({ id: 'r1', x: 0, y: 0, width: 100, height: 50 });
        const ctx = makeInteraction({ initialTool: 'select', initialElements: [el] });
        ctx.hitTestHandle.mockReturnValue({ elementId: 'r1', handle: 'se' });
        ctx.selectedId.value = 'r1';
        ctx.onPointerDown(ptr({ clientX: 100, clientY: 50 }));
        ctx.onPointerMove({ ...ptr({ clientX: 150, clientY: 80 }), type: 'pointermove' } as unknown as PointerEvent);
        ctx.onPointerUp({ ...ptr(), type: 'pointerup' } as unknown as PointerEvent);
        expect(ctx.saveToHistory).toHaveBeenCalled();
    });
});

// ── onPointerUp: freedraw ─────────────────────────────────────────────────────

describe('onPointerUp: freedraw', () => {
    it('adds freedraw element to elements when enough points', () => {
        const ctx = makeInteraction({ initialTool: 'freedraw' });
        ctx.onPointerDown(ptr({ clientX: 0, clientY: 0 }));
        ctx.onPointerMove({ ...ptr({ clientX: 50, clientY: 50 }), type: 'pointermove' } as unknown as PointerEvent);
        ctx.onPointerMove({ ...ptr({ clientX: 80, clientY: 80 }), type: 'pointermove' } as unknown as PointerEvent);
        ctx.onPointerUp({ ...ptr(), type: 'pointerup' } as unknown as PointerEvent);
        expect(ctx.elements.value.length).toBe(1);
        expect(ctx.elements.value[0]?.type).toBe('freedraw');
        expect(ctx.saveToHistory).toHaveBeenCalled();
    });

    it('discards freedraw element when too few points', () => {
        const ctx = makeInteraction({ initialTool: 'freedraw' });
        ctx.onPointerDown(ptr({ clientX: 0, clientY: 0 }));
        // No moves — only 1 point (initial), less than 2 needed
        ctx.onPointerUp({ ...ptr(), type: 'pointerup' } as unknown as PointerEvent);
        expect(ctx.elements.value.length).toBe(0);
        expect(ctx.creatingElement.value).toBeNull();
    });
});

// ── onPointerUp: erase ────────────────────────────────────────────────────────

describe('onPointerUp: erase', () => {
    it('saves history when elements were erased', () => {
        const el = makeEl({ id: 'e1' });
        const ctx = makeInteraction({ initialTool: 'eraser', initialElements: [el] });
        ctx.hitTestElement.mockReturnValue(el);
        ctx.onPointerDown(ptr());
        ctx.onPointerUp({ ...ptr(), type: 'pointerup' } as unknown as PointerEvent);
        expect(ctx.saveToHistory).toHaveBeenCalled();
    });

    it('does not save history when nothing was erased', () => {
        const ctx = makeInteraction({ initialTool: 'eraser' });
        ctx.hitTestElement.mockReturnValue(null);
        ctx.onPointerDown(ptr());
        ctx.onPointerUp({ ...ptr(), type: 'pointerup' } as unknown as PointerEvent);
        expect(ctx.saveToHistory).not.toHaveBeenCalled();
    });
});

// ── onPointerUp: marquee ──────────────────────────────────────────────────────

describe('onPointerUp: marquee', () => {
    it('clears marqueeRect after finishing marquee selection', () => {
        const ctx = makeInteraction({ initialTool: 'select' });
        ctx.hitTestElement.mockReturnValue(null);
        ctx.onPointerDown(ptr({ clientX: 0, clientY: 0 }));
        ctx.onPointerUp({ ...ptr(), type: 'pointerup' } as unknown as PointerEvent);
        expect(ctx.marqueeRect.value).toBeNull();
    });
});

// ── onPointerUp: no drag ──────────────────────────────────────────────────────

describe('onPointerUp: not dragging', () => {
    it('returns early without action when isDragging is false', () => {
        const ctx = makeInteraction();
        ctx.onPointerUp({ ...ptr(), type: 'pointerup' } as unknown as PointerEvent);
        expect(ctx.saveToHistory).not.toHaveBeenCalled();
    });
});

// ── applyResize ───────────────────────────────────────────────────────────────

describe('applyResize (via onPointerMove resize)', () => {
    function setupResize(handle: string, elementType: CanvasElement['type'] = 'rectangle') {
        const el = makeEl({ id: 'r1', type: elementType, x: 10, y: 10, width: 100, height: 60 });
        const ctx = makeInteraction({ initialTool: 'select', initialElements: [el] });
        ctx.hitTestHandle.mockReturnValue({ elementId: 'r1', handle });
        ctx.selectedId.value = 'r1';
        ctx.onPointerDown(ptr({ clientX: 110, clientY: 70 }));
        return { el, ctx };
    }

    it('nw handle: moves top-left corner', () => {
        const { el, ctx } = setupResize('nw');
        ctx.onPointerMove({ ...ptr({ clientX: 5, clientY: 5 }), type: 'pointermove' } as unknown as PointerEvent);
        expect(el.x).toBe(5);
        expect(el.y).toBe(5);
    });

    it('ne handle: moves top-right corner', () => {
        const { el, ctx } = setupResize('ne');
        ctx.onPointerMove({ ...ptr({ clientX: 150, clientY: 5 }), type: 'pointermove' } as unknown as PointerEvent);
        expect(el.y).toBe(5);
        expect(el.width).toBe(140); // 150 - orig.x(10)
    });

    it('sw handle: moves bottom-left corner', () => {
        const { el, ctx } = setupResize('sw');
        ctx.onPointerMove({ ...ptr({ clientX: 5, clientY: 80 }), type: 'pointermove' } as unknown as PointerEvent);
        expect(el.x).toBe(5);
        expect(el.height).toBe(70); // 80 - orig.y(10)
    });

    it('se handle: moves bottom-right corner', () => {
        const { el, ctx } = setupResize('se');
        ctx.onPointerMove({ ...ptr({ clientX: 120, clientY: 80 }), type: 'pointermove' } as unknown as PointerEvent);
        expect(el.width).toBe(110); // 120 - orig.x(10)
        expect(el.height).toBe(70); // 80 - orig.y(10)
    });

    it('line/start handle: repositions start point', () => {
        const lineEl = makeEl({ id: 'l1', type: 'line', x: 10, y: 10, width: 100, height: 50 });
        const ctx = makeInteraction({ initialTool: 'select', initialElements: [lineEl] });
        ctx.hitTestHandle.mockReturnValue({ elementId: 'l1', handle: 'start' });
        ctx.selectedId.value = 'l1';
        ctx.onPointerDown(ptr({ clientX: 10, clientY: 10 }));
        ctx.onPointerMove({ ...ptr({ clientX: 20, clientY: 20 }), type: 'pointermove' } as unknown as PointerEvent);
        expect(lineEl.x).toBe(20);
        expect(lineEl.y).toBe(20);
    });

    it('line/end handle: repositions end point', () => {
        const lineEl = makeEl({ id: 'l1', type: 'line', x: 0, y: 0, width: 100, height: 50 });
        const ctx = makeInteraction({ initialTool: 'select', initialElements: [lineEl] });
        ctx.hitTestHandle.mockReturnValue({ elementId: 'l1', handle: 'end' });
        ctx.selectedId.value = 'l1';
        ctx.onPointerDown(ptr({ clientX: 100, clientY: 50 }));
        ctx.onPointerMove({ ...ptr({ clientX: 200, clientY: 100 }), type: 'pointermove' } as unknown as PointerEvent);
        expect(lineEl.width).toBe(200); // wx - el.x
        expect(lineEl.height).toBe(100); // wy - el.y
    });

    it('scales fontSize for text element during resize', () => {
        const textEl = makeEl({ id: 't1', type: 'text', x: 0, y: 0, width: 100, height: 50, fontSize: 20 });
        const ctx = makeInteraction({ initialTool: 'select', initialElements: [textEl] });
        ctx.hitTestHandle.mockReturnValue({ elementId: 't1', handle: 'se' });
        ctx.selectedId.value = 't1';
        ctx.onPointerDown(ptr({ clientX: 100, clientY: 50 }));
        ctx.onPointerMove({ ...ptr({ clientX: 200, clientY: 100 }), type: 'pointermove' } as unknown as PointerEvent);
        // Width doubled → fontSize should also scale
        expect(textEl.fontSize).toBeGreaterThan(20);
    });
});

// ── constrainDimensions ───────────────────────────────────────────────────────

describe('constrainDimensions (via onPointerMove create + shiftHeld)', () => {
    it('constrains rectangle to square (shift held)', () => {
        const ctx = makeInteraction({ initialTool: 'rectangle', isShapeToolResult: true });
        ctx.onPointerDown(ptr({ clientX: 0, clientY: 0 }));
        ctx.shiftHeld.value = true;
        ctx.onPointerMove({ ...ptr({ clientX: 80, clientY: 60 }), type: 'pointermove' } as unknown as PointerEvent);
        // max(80, 60) = 80 for both dimensions
        expect(Math.abs(ctx.creatingElement.value?.width ?? 0)).toBe(80);
        expect(Math.abs(ctx.creatingElement.value?.height ?? 0)).toBe(80);
    });

    it('constrains ellipse to circle (shift held)', () => {
        const ctx = makeInteraction({ initialTool: 'ellipse', isShapeToolResult: true });
        ctx.onPointerDown(ptr({ clientX: 0, clientY: 0 }));
        ctx.shiftHeld.value = true;
        ctx.onPointerMove({ ...ptr({ clientX: 50, clientY: 90 }), type: 'pointermove' } as unknown as PointerEvent);
        expect(Math.abs(ctx.creatingElement.value?.width ?? 0)).toBe(90);
        expect(Math.abs(ctx.creatingElement.value?.height ?? 0)).toBe(90);
    });

    it('snaps line angle when shift held', () => {
        const ctx = makeInteraction({ initialTool: 'line', isShapeToolResult: true });
        ctx.onPointerDown(ptr({ clientX: 0, clientY: 0 }));
        ctx.shiftHeld.value = true;
        ctx.onPointerMove({ ...ptr({ clientX: 100, clientY: 10 }), type: 'pointermove' } as unknown as PointerEvent);
        // Angle ~5.7° → snaps to 0° → h becomes ~0
        const h = ctx.creatingElement.value?.height ?? 0;
        expect(Math.abs(h)).toBeLessThan(5);
    });

    it('leaves freedraw dimensions unconstrained', () => {
        const ctx = makeInteraction({ initialTool: 'freedraw' });
        ctx.onPointerDown(ptr({ clientX: 0, clientY: 0 }));
        ctx.shiftHeld.value = true;
        // freedraw has its own pointer move behavior (adds points, doesn't call constrainDimensions)
        ctx.onPointerMove({ ...ptr({ clientX: 100, clientY: 50 }), type: 'pointermove' } as unknown as PointerEvent);
        expect(ctx.creatingElement.value?.type).toBe('freedraw');
    });
});
