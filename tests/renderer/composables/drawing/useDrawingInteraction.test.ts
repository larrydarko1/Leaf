/**
 * Tests for useDrawingInteraction composable.
 * Focuses on keyboard handlers, zoom, and wheel events.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, computed } from 'vue';
import { useDrawingInteraction } from '@/renderer/composables/drawing/useDrawingInteraction';
import type { CanvasElement, DefaultStyle, ToolType } from '@/schemas/drawing';

// ── Helpers ───────────────────────────────────────────────────────────────────

let idCounter = 0;
const genId = () => `el-${++idCounter}`;

function makeEl(id = genId()): CanvasElement {
    return {
        id,
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
    };
}

function makeInteraction(
    opts: {
        initialTool?: ToolType;
        initialElements?: CanvasElement[];
        selectedId?: string | null;
        textEditing?: boolean;
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
    const isShapeTool = vi.fn().mockReturnValue(false);
    const hitTestElement = vi.fn().mockReturnValue(null);
    const hitTestHandle = vi.fn().mockReturnValue(null);
    const getElementBounds = vi.fn().mockImplementation((el: CanvasElement) => ({
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
    }));
    const screenToWorld = vi.fn().mockImplementation((sx: number, sy: number) => ({ x: sx, y: sy }));
    const getScreenPoint = vi
        .fn()
        .mockImplementation((e: { clientX: number; clientY: number }) => ({ x: e.clientX ?? 0, y: e.clientY ?? 0 }));
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
        hitTestElement,
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

function makeKeyEvent(
    key: string,
    modifiers: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean; code?: string } = {},
): KeyboardEvent {
    return {
        key,
        code: modifiers.code ?? key,
        ctrlKey: modifiers.ctrlKey ?? false,
        metaKey: modifiers.metaKey ?? false,
        shiftKey: modifiers.shiftKey ?? false,
        altKey: false,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn(),
    } as unknown as KeyboardEvent;
}

function makePointerEvent(type: string, overrides: Partial<PointerEvent> = {}): PointerEvent {
    return {
        type,
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

// ── effectiveTool ─────────────────────────────────────────────────────────────

describe('effectiveTool', () => {
    it('returns current tool when space is not held', () => {
        const { effectiveTool } = makeInteraction({ initialTool: 'rectangle' });
        expect(effectiveTool.value).toBe('rectangle');
    });

    it('returns hand tool when space is held', () => {
        const { spaceHeld, effectiveTool } = makeInteraction();
        spaceHeld.value = true;
        expect(effectiveTool.value).toBe('hand');
    });
});

// ── handleKeyup ───────────────────────────────────────────────────────────────

describe('handleKeyup', () => {
    it('releases Space when Space key is released', () => {
        const { spaceHeld, handleKeyup } = makeInteraction();
        spaceHeld.value = true;
        handleKeyup(makeKeyEvent('Space', { code: 'Space' }));
        expect(spaceHeld.value).toBe(false);
    });

    it('releases Shift when Shift key is released', () => {
        const { shiftHeld, handleKeyup } = makeInteraction();
        shiftHeld.value = true;
        handleKeyup(makeKeyEvent('Shift'));
        expect(shiftHeld.value).toBe(false);
    });
});

// ── handleKeydown: space ──────────────────────────────────────────────────────

describe('handleKeydown (Space)', () => {
    it('sets spaceHeld to true', () => {
        const { spaceHeld, handleKeydown } = makeInteraction();
        const e = makeKeyEvent('Space', { code: 'Space' });
        handleKeydown(e);
        expect(spaceHeld.value).toBe(true);
    });

    it('calls preventDefault on Space', () => {
        const { handleKeydown } = makeInteraction();
        const e = makeKeyEvent('Space', { code: 'Space' });
        handleKeydown(e);
        expect(e.preventDefault).toHaveBeenCalled();
    });

    it('ignores Space while dragging', () => {
        const { isDragging, spaceHeld, handleKeydown } = makeInteraction();
        isDragging.value = true;
        handleKeydown(makeKeyEvent('Space', { code: 'Space' }));
        expect(spaceHeld.value).toBe(false);
    });
});

// ── handleKeydown: shift ──────────────────────────────────────────────────────

describe('handleKeydown (Shift)', () => {
    it('sets shiftHeld to true', () => {
        const { shiftHeld, handleKeydown } = makeInteraction();
        handleKeydown(makeKeyEvent('Shift'));
        expect(shiftHeld.value).toBe(true);
    });
});

// ── handleKeydown: ignored during text editing ────────────────────────────────

describe('handleKeydown (text editing)', () => {
    it('ignores all keys while text editing is active', () => {
        const { undo, handleKeydown } = makeInteraction({ textEditing: true });
        handleKeydown(makeKeyEvent('z', { ctrlKey: true }));
        expect(undo).not.toHaveBeenCalled();
    });
});

// ── handleKeydown: undo/redo ──────────────────────────────────────────────────

describe('handleKeydown (undo/redo)', () => {
    it('calls undo on Ctrl+Z', () => {
        const { undo, handleKeydown } = makeInteraction();
        handleKeydown(makeKeyEvent('z', { ctrlKey: true }));
        expect(undo).toHaveBeenCalled();
    });

    it('calls undo on Meta+Z (Mac)', () => {
        const { undo, handleKeydown } = makeInteraction();
        handleKeydown(makeKeyEvent('z', { metaKey: true }));
        expect(undo).toHaveBeenCalled();
    });

    it('calls redo on Ctrl+Shift+Z', () => {
        const { redo, handleKeydown } = makeInteraction();
        handleKeydown(makeKeyEvent('z', { ctrlKey: true, shiftKey: true }));
        expect(redo).toHaveBeenCalled();
    });
});

// ── handleKeydown: copy/paste/duplicate ──────────────────────────────────────

describe('handleKeydown (copy/paste/duplicate)', () => {
    it('calls copySelected on Ctrl+C', () => {
        const { copySelected, handleKeydown } = makeInteraction();
        handleKeydown(makeKeyEvent('c', { ctrlKey: true }));
        expect(copySelected).toHaveBeenCalled();
    });

    it('calls pasteClipboard on Ctrl+V', () => {
        const { pasteClipboard, handleKeydown } = makeInteraction();
        handleKeydown(makeKeyEvent('v', { ctrlKey: true }));
        expect(pasteClipboard).toHaveBeenCalled();
    });

    it('calls duplicateSelected on Ctrl+D', () => {
        const { duplicateSelected, handleKeydown } = makeInteraction();
        handleKeydown(makeKeyEvent('d', { ctrlKey: true }));
        expect(duplicateSelected).toHaveBeenCalled();
    });
});

// ── handleKeydown: select all ─────────────────────────────────────────────────

describe('handleKeydown (select all)', () => {
    it('selects all elements on Ctrl+A', () => {
        const el1 = makeEl('a');
        const el2 = makeEl('b');
        const { elements, selectedIds, handleKeydown } = makeInteraction({ initialElements: [el1, el2] });
        elements.value = [el1, el2];
        handleKeydown(makeKeyEvent('a', { ctrlKey: true }));
        expect(selectedIds.value.size).toBe(2);
    });

    it('calls renderScene after select all', () => {
        const { renderScene, handleKeydown } = makeInteraction();
        handleKeydown(makeKeyEvent('a', { ctrlKey: true }));
        expect(renderScene).toHaveBeenCalled();
    });
});

// ── handleKeydown: delete ─────────────────────────────────────────────────────

describe('handleKeydown (delete)', () => {
    it('calls deleteSelected on Delete when elements are selected', () => {
        const { selectedIds, deleteSelected, handleKeydown } = makeInteraction();
        selectedIds.value = new Set(['id-1']);
        handleKeydown(makeKeyEvent('Delete'));
        expect(deleteSelected).toHaveBeenCalled();
    });

    it('calls deleteSelected on Backspace when elements are selected', () => {
        const { selectedIds, deleteSelected, handleKeydown } = makeInteraction();
        selectedIds.value = new Set(['id-1']);
        handleKeydown(makeKeyEvent('Backspace'));
        expect(deleteSelected).toHaveBeenCalled();
    });

    it('does not call deleteSelected when nothing is selected', () => {
        const { deleteSelected, handleKeydown } = makeInteraction();
        handleKeydown(makeKeyEvent('Delete'));
        expect(deleteSelected).not.toHaveBeenCalled();
    });
});

// ── handleKeydown: enter to edit ─────────────────────────────────────────────

describe('handleKeydown (Enter to edit)', () => {
    it('calls startEditText when Enter is pressed on a text element', () => {
        const textEl = makeEl('txt');
        textEl.type = 'text';
        const { selectedId, elements, startEditText, handleKeydown, isShapeElement } = makeInteraction();
        isShapeElement.mockReturnValue(false);
        elements.value = [textEl];
        selectedId.value = 'txt';
        handleKeydown(makeKeyEvent('Enter'));
        expect(startEditText).toHaveBeenCalledWith(textEl);
    });

    it('calls startEditShapeText when Enter is pressed on a shape element', () => {
        const shapeEl = makeEl('shape');
        const { selectedId, elements, startEditShapeText, handleKeydown, isShapeElement } = makeInteraction();
        isShapeElement.mockReturnValue(true);
        elements.value = [shapeEl];
        selectedId.value = 'shape';
        handleKeydown(makeKeyEvent('Enter'));
        expect(startEditShapeText).toHaveBeenCalledWith(shapeEl);
    });

    it('does nothing when no element is selected', () => {
        const { startEditText, startEditShapeText, handleKeydown } = makeInteraction();
        handleKeydown(makeKeyEvent('Enter'));
        expect(startEditText).not.toHaveBeenCalled();
        expect(startEditShapeText).not.toHaveBeenCalled();
    });
});

// ── handleKeydown: tool shortcuts ─────────────────────────────────────────────

describe('handleKeydown (tool shortcuts)', () => {
    const shortcuts: [string, ToolType][] = [
        ['v', 'select'],
        ['1', 'select'],
        ['h', 'hand'],
        ['2', 'hand'],
        ['r', 'rectangle'],
        ['p', 'freedraw'],
        ['e', 'eraser'],
        ['t', 'triangle'],
        ['a', 'arrow'],
        ['l', 'line'],
        ['x', 'text'],
        ['o', 'ellipse'],
    ];

    shortcuts.forEach(([key, tool]) => {
        it(`presses "${key}" → selects "${tool}" tool`, () => {
            const { selectTool, handleKeydown } = makeInteraction();
            handleKeydown(makeKeyEvent(key));
            expect(selectTool).toHaveBeenCalledWith(tool);
        });
    });

    it('does not change tool when Ctrl is held', () => {
        const { selectTool, handleKeydown } = makeInteraction();
        handleKeydown(makeKeyEvent('v', { ctrlKey: true }));
        expect(selectTool).not.toHaveBeenCalled();
    });
});

// ── handleKeydown: Escape ─────────────────────────────────────────────────────

describe('handleKeydown (Escape)', () => {
    it('clears selection on Escape', () => {
        const { selectedIds, handleKeydown } = makeInteraction();
        selectedIds.value = new Set(['a', 'b']);
        handleKeydown(makeKeyEvent('Escape'));
        expect(selectedIds.value.size).toBe(0);
    });

    it('cancels creating element on Escape', () => {
        const el = makeEl();
        const { isDragging, dragAction, creatingElement, handleKeydown } = makeInteraction();
        isDragging.value = true;
        dragAction.value = 'create';
        creatingElement.value = el;
        handleKeydown(makeKeyEvent('Escape'));
        expect(creatingElement.value).toBeNull();
        expect(isDragging.value).toBe(false);
    });
});

// ── handleKeydown: zoom shortcuts ────────────────────────────────────────────

describe('handleKeydown (zoom shortcuts)', () => {
    it('zooms in with Ctrl+=', () => {
        const { zoom, handleKeydown } = makeInteraction();
        zoom.value = 1.0;
        handleKeydown(makeKeyEvent('=', { ctrlKey: true }));
        expect(zoom.value).toBeGreaterThan(1.0);
    });

    it('zooms out with Ctrl+-', () => {
        const { zoom, handleKeydown } = makeInteraction();
        zoom.value = 1.5;
        handleKeydown(makeKeyEvent('-', { ctrlKey: true }));
        expect(zoom.value).toBeLessThan(1.5);
    });

    it('resets zoom with Ctrl+0', () => {
        const { zoom, handleKeydown } = makeInteraction();
        zoom.value = 2.5;
        handleKeydown(makeKeyEvent('0', { ctrlKey: true }));
        expect(zoom.value).toBe(1);
    });
});

// ── zoomAtPoint ───────────────────────────────────────────────────────────────

describe('zoomAtPoint', () => {
    it('clamps minimum zoom to 0.1', () => {
        const { zoom, zoomAtPoint } = makeInteraction();
        zoom.value = 0.2;
        zoomAtPoint(0.0, 0, 0);
        expect(zoom.value).toBe(0.1);
    });

    it('clamps maximum zoom to 5', () => {
        const { zoom, zoomAtPoint } = makeInteraction();
        zoom.value = 4.9;
        zoomAtPoint(10, 0, 0);
        expect(zoom.value).toBe(5);
    });

    it('adjusts scroll to zoom around the given point', () => {
        const { zoom, scrollX, scrollY, zoomAtPoint } = makeInteraction();
        zoom.value = 1;
        scrollX.value = 0;
        scrollY.value = 0;
        zoomAtPoint(2, 100, 100);
        expect(zoom.value).toBe(2);
        // scroll should be adjusted (not zero)
        expect(scrollX.value).toBe(-100);
        expect(scrollY.value).toBe(-100);
    });

    it('accepts zoom in the valid range', () => {
        const { zoom, zoomAtPoint } = makeInteraction();
        zoomAtPoint(1.5, 0, 0);
        expect(zoom.value).toBe(1.5);
    });
});

// ── zoomToCenter ──────────────────────────────────────────────────────────────

describe('zoomToCenter', () => {
    it('sets zoom to given value centered on canvas', () => {
        const { zoom, zoomToCenter } = makeInteraction();
        zoomToCenter(2);
        expect(zoom.value).toBe(2);
    });

    it('calls renderScene', () => {
        const { renderScene, zoomToCenter } = makeInteraction();
        zoomToCenter(1);
        expect(renderScene).toHaveBeenCalled();
    });
});

// ── onWheel ───────────────────────────────────────────────────────────────────

describe('onWheel', () => {
    it('scrolls when Ctrl/Meta is not held', () => {
        const { scrollX, scrollY, onWheel, renderScene } = makeInteraction();
        const e = {
            ctrlKey: false,
            metaKey: false,
            deltaX: 10,
            deltaY: 20,
            clientX: 0,
            clientY: 0,
            preventDefault: vi.fn(),
        } as unknown as WheelEvent;
        onWheel(e);
        expect(scrollX.value).toBe(-10);
        expect(scrollY.value).toBe(-20);
        expect(renderScene).toHaveBeenCalled();
    });

    it('zooms when Ctrl is held', () => {
        const { zoom, onWheel } = makeInteraction();
        zoom.value = 1;
        const e = {
            ctrlKey: true,
            metaKey: false,
            deltaX: 0,
            deltaY: -100,
            clientX: 400,
            clientY: 300,
            preventDefault: vi.fn(),
        } as unknown as WheelEvent;
        onWheel(e);
        expect(zoom.value).toBeGreaterThan(1);
    });
});

// ── onPointerDown / onPointerUp ───────────────────────────────────────────────

describe('onPointerDown', () => {
    it('does not throw with default setup', () => {
        const { onPointerDown } = makeInteraction();
        const e = makePointerEvent('pointerdown');
        expect(() => onPointerDown(e)).not.toThrow();
    });

    it('starts panning when hand tool is active', () => {
        const { onPointerDown, dragAction } = makeInteraction({ initialTool: 'hand' });
        const e = makePointerEvent('pointerdown');
        onPointerDown(e);
        expect(dragAction.value).toBe('pan');
    });
});

describe('onPointerUp', () => {
    it('does not throw without active drag', () => {
        const { onPointerUp } = makeInteraction();
        const e = makePointerEvent('pointerup');
        expect(() => onPointerUp(e)).not.toThrow();
    });
});
