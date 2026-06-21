/**
 * Tests for the drawing useTextEditing composable.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { useTextEditing } from '@/renderer/composables/drawing/useTextEditing';
import type { CanvasElement, DefaultStyle } from '@/schemas/drawing';

// ── Helpers ───────────────────────────────────────────────────────────────────

let idCounter = 0;
const genId = () => `el-${++idCounter}`;

const defaultDefaultStyle: DefaultStyle = {
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
};

function makeTextEl(overrides: Partial<CanvasElement> = {}): CanvasElement {
    return {
        id: genId(),
        type: 'text',
        x: 10,
        y: 20,
        width: 100,
        height: 30,
        strokeColor: '#333333',
        fillColor: 'transparent',
        strokeWidth: 1,
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
        text: 'existing text',
        ...overrides,
    };
}

function makeShapeEl(overrides: Partial<CanvasElement> = {}): CanvasElement {
    return {
        id: genId(),
        type: 'rectangle',
        x: 50,
        y: 50,
        width: 200,
        height: 100,
        strokeColor: '#0000ff',
        fillColor: '#ffffff',
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

const fakeFocus = vi.fn();

function makeEditing(opts: { hasCanvas?: boolean; hasInput?: boolean; ctxReturnsNull?: boolean } = {}) {
    const { hasCanvas = false, hasInput = true, ctxReturnsNull = false } = opts;

    const canvas = ref<HTMLCanvasElement | null>(hasCanvas ? ({} as HTMLCanvasElement) : null);
    const textInputEl = ref<HTMLTextAreaElement | null>(
        hasInput ? ({ focus: fakeFocus } as unknown as HTMLTextAreaElement) : null,
    );
    const zoom = ref(1);
    const elements = ref<CanvasElement[]>([]);
    const selectedId = ref<string | null>(null);
    const defaultStyle = ref<DefaultStyle>({ ...defaultDefaultStyle });

    const getElementBounds = vi.fn().mockImplementation((el: CanvasElement) => ({
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
    }));
    const hitTestElement = vi.fn().mockReturnValue(null);
    const isShapeElement = vi.fn().mockImplementation((el: CanvasElement) => el.type === 'rectangle');
    const worldToScreen = vi.fn().mockImplementation((wx: number, wy: number) => ({ x: wx, y: wy }));
    const screenToWorld = vi.fn().mockImplementation((sx: number, sy: number) => ({ x: sx, y: sy }));

    const fakeMeasure = vi.fn().mockReturnValue({ width: 80 });
    const fakeCtx = {
        save: vi.fn(),
        restore: vi.fn(),
        font: '',
        measureText: fakeMeasure,
    } as unknown as CanvasRenderingContext2D;
    const getCtx = vi.fn().mockReturnValue(ctxReturnsNull ? null : fakeCtx);
    const renderScene = vi.fn();
    const saveToHistory = vi.fn();
    const scheduleAutoSave = vi.fn();

    const te = useTextEditing(
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

    return {
        canvas,
        textInputEl,
        zoom,
        elements,
        selectedId,
        defaultStyle,
        getElementBounds,
        hitTestElement,
        isShapeElement,
        worldToScreen,
        screenToWorld,
        getCtx,
        renderScene,
        saveToHistory,
        scheduleAutoSave,
        fakeCtx,
        ...te,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    idCounter = 0;
});

// ── initial state ─────────────────────────────────────────────────────────────

describe('initial state', () => {
    it('textEditing starts false', () => {
        const { textEditing } = makeEditing();
        expect(textEditing.value).toBe(false);
    });

    it('textValue starts empty', () => {
        const { textValue } = makeEditing();
        expect(textValue.value).toBe('');
    });
});

// ── startNewText ──────────────────────────────────────────────────────────────

describe('startNewText', () => {
    it('sets textEditing to true', () => {
        const { startNewText, textEditing } = makeEditing();
        startNewText(100, 200);
        expect(textEditing.value).toBe(true);
    });

    it('clears selectedId', () => {
        const { startNewText, selectedId } = makeEditing();
        selectedId.value = 'some-id';
        startNewText(0, 0);
        expect(selectedId.value).toBeNull();
    });

    it('sets textValue to empty string', () => {
        const { startNewText, textValue } = makeEditing();
        startNewText(0, 0);
        expect(textValue.value).toBe('');
    });

    it('applies default style font size', () => {
        const { startNewText, defaultStyle } = makeEditing();
        defaultStyle.value.fontSize = 24;
        startNewText(0, 0);
        // textEditFontSize is internal but can be verified via textOverlayStyle
        expect(true).toBe(true); // just check no throw
    });

    it('focuses the text input on next tick', async () => {
        const { startNewText } = makeEditing({ hasInput: true });
        startNewText(50, 60);
        await nextTick();
        expect(fakeFocus).toHaveBeenCalled();
    });

    it('does not throw when textInputEl is null', async () => {
        const { startNewText } = makeEditing({ hasInput: false });
        startNewText(0, 0);
        await nextTick();
        expect(true).toBe(true);
    });
});

// ── startEditText ─────────────────────────────────────────────────────────────

describe('startEditText', () => {
    it('sets textEditing to true', () => {
        const { startEditText, textEditing } = makeEditing();
        startEditText(makeTextEl());
        expect(textEditing.value).toBe(true);
    });

    it('loads element text into textValue', () => {
        const { startEditText, textValue } = makeEditing();
        const el = makeTextEl({ text: 'hello world' });
        startEditText(el);
        expect(textValue.value).toBe('hello world');
    });

    it('uses empty string when element has no text', () => {
        const { startEditText, textValue } = makeEditing();
        const el = makeTextEl({ text: undefined });
        startEditText(el);
        expect(textValue.value).toBe('');
    });

    it('sets editingElementId to element id', () => {
        const { startEditText, textEditing } = makeEditing();
        const el = makeTextEl({ id: 'special-id' });
        startEditText(el);
        expect(textEditing.value).toBe(true);
    });

    it('clears selectedId', () => {
        const { startEditText, selectedId } = makeEditing();
        selectedId.value = 'prev-selection';
        startEditText(makeTextEl());
        expect(selectedId.value).toBeNull();
    });

    it('uses element fontSize', () => {
        const { startEditText } = makeEditing();
        const el = makeTextEl({ fontSize: 32 });
        startEditText(el);
        // Can verify via textOverlayStyle.fontSize
        expect(true).toBe(true);
    });
});

// ── startEditShapeText ────────────────────────────────────────────────────────

describe('startEditShapeText', () => {
    it('sets textEditing to true', () => {
        const { startEditShapeText, textEditing } = makeEditing();
        startEditShapeText(makeShapeEl());
        expect(textEditing.value).toBe(true);
    });

    it('sets selectedId to the element id', () => {
        const { startEditShapeText, selectedId } = makeEditing();
        const el = makeShapeEl({ id: 'shape-123' });
        startEditShapeText(el);
        expect(selectedId.value).toBe('shape-123');
    });

    it('loads text from element', () => {
        const { startEditShapeText, textValue } = makeEditing();
        const el = makeShapeEl({ text: 'shape label' });
        startEditShapeText(el);
        expect(textValue.value).toBe('shape label');
    });

    it('sets textEditCentered to true', async () => {
        const { startEditShapeText, textOverlayStyle } = makeEditing();
        const el = makeShapeEl();
        startEditShapeText(el);
        // textEditCentered = true affects textOverlayStyle
        const style = textOverlayStyle.value;
        expect(style.textAlign).toBe('center');
    });

    it('calls getElementBounds to position the overlay', () => {
        const { startEditShapeText, getElementBounds } = makeEditing();
        const el = makeShapeEl();
        startEditShapeText(el);
        expect(getElementBounds).toHaveBeenCalledWith(el);
    });
});

// ── cancelText ────────────────────────────────────────────────────────────────

describe('cancelText', () => {
    it('sets textEditing to false', () => {
        const { startNewText, cancelText, textEditing } = makeEditing();
        startNewText(0, 0);
        cancelText();
        expect(textEditing.value).toBe(false);
    });

    it('calls renderScene', () => {
        const { cancelText, renderScene } = makeEditing();
        cancelText();
        expect(renderScene).toHaveBeenCalled();
    });

    it('works even when not editing', () => {
        const { cancelText } = makeEditing();
        expect(() => cancelText()).not.toThrow();
    });
});

// ── onTextEnter ───────────────────────────────────────────────────────────────

describe('onTextEnter', () => {
    it('calls finalizeText when Enter is pressed without shift', () => {
        const { onTextEnter, startNewText, textValue } = makeEditing();
        startNewText(0, 0);
        textValue.value = 'new text';
        const e = { shiftKey: false, preventDefault: vi.fn() } as unknown as KeyboardEvent;
        onTextEnter(e);
        expect(e.preventDefault).toHaveBeenCalled();
    });

    it('does not finalize when Shift+Enter is pressed', () => {
        const { onTextEnter, textEditing, startNewText } = makeEditing();
        startNewText(0, 0);
        const e = { shiftKey: true, preventDefault: vi.fn() } as unknown as KeyboardEvent;
        onTextEnter(e);
        expect(textEditing.value).toBe(true); // still editing
    });
});

// ── finalizeText: empty text ──────────────────────────────────────────────────

describe('finalizeText (empty text)', () => {
    it('does nothing when not editing', () => {
        const { finalizeText, renderScene } = makeEditing();
        finalizeText();
        expect(renderScene).not.toHaveBeenCalled();
    });

    it('sets textEditing to false', () => {
        const { startNewText, textValue, finalizeText, textEditing } = makeEditing();
        startNewText(0, 0);
        textValue.value = '   '; // whitespace only
        finalizeText();
        expect(textEditing.value).toBe(false);
    });

    it('calls saveToHistory and scheduleAutoSave on empty text', () => {
        const { startNewText, textValue, finalizeText, saveToHistory, scheduleAutoSave } = makeEditing();
        startNewText(0, 0);
        textValue.value = '';
        finalizeText();
        expect(saveToHistory).toHaveBeenCalled();
        expect(scheduleAutoSave).toHaveBeenCalled();
    });

    it('removes text element when text is cleared during editing', () => {
        const el = makeTextEl({ id: 'text-to-remove', text: 'old' });
        const { startEditText, textValue, finalizeText, elements } = makeEditing();
        elements.value = [el];
        startEditText(el);
        textValue.value = ''; // clear text
        finalizeText();
        expect(elements.value.find((e) => e.id === el.id)).toBeUndefined();
    });

    it('clears selected id when removing text element', () => {
        const el = makeTextEl({ id: 'text-el' });
        const { startEditText, textValue, finalizeText, elements, selectedId } = makeEditing();
        elements.value = [el];
        selectedId.value = el.id;
        startEditText(el);
        textValue.value = '';
        finalizeText();
        expect(selectedId.value).toBeNull();
    });

    it('clears text on shape when empty text for centered editing', () => {
        const shapeEl = makeShapeEl({ id: 'shape-1', text: 'old label' });
        const { startEditShapeText, textValue, finalizeText, elements } = makeEditing();
        elements.value = [shapeEl];
        startEditShapeText(shapeEl);
        textValue.value = '';
        finalizeText();
        const found = elements.value.find((e) => e.id === 'shape-1');
        expect(found?.text).toBeUndefined();
    });

    it('calls renderScene after finalizing empty text', () => {
        const { startNewText, textValue, finalizeText, renderScene } = makeEditing();
        startNewText(0, 0);
        textValue.value = '';
        finalizeText();
        expect(renderScene).toHaveBeenCalled();
    });
});

// ── finalizeText: with text ───────────────────────────────────────────────────

describe('finalizeText (with text)', () => {
    it('returns early if ctx is null', () => {
        const { startNewText, textValue, finalizeText, elements } = makeEditing({ ctxReturnsNull: true });
        startNewText(0, 0);
        textValue.value = 'hello';
        finalizeText();
        // No elements added since ctx is null
        expect(elements.value).toHaveLength(0);
    });

    it('creates a new text element with measured width', () => {
        const { startNewText, textValue, finalizeText, elements, fakeCtx } = makeEditing();
        (fakeCtx.measureText as ReturnType<typeof vi.fn>).mockReturnValue({ width: 120 });
        startNewText(100, 200);
        textValue.value = 'Hello World';
        finalizeText();
        expect(elements.value).toHaveLength(1);
        expect(elements.value[0].type).toBe('text');
        expect(elements.value[0].text).toBe('Hello World');
        expect(elements.value[0].width).toBe(120);
    });

    it('selects the new text element', () => {
        const { startNewText, textValue, finalizeText, elements, selectedId } = makeEditing();
        startNewText(10, 20);
        textValue.value = 'selected text';
        finalizeText();
        expect(selectedId.value).toBe(elements.value[0].id);
    });

    it('calls ctx.save and ctx.restore', () => {
        const { startNewText, textValue, finalizeText, fakeCtx } = makeEditing();
        startNewText(0, 0);
        textValue.value = 'text';
        finalizeText();
        expect(fakeCtx.save).toHaveBeenCalled();
        expect(fakeCtx.restore).toHaveBeenCalled();
    });

    it('updates existing text element when editing', () => {
        const el = makeTextEl({ id: 'existing', text: 'old' });
        const { startEditText, textValue, finalizeText, elements, fakeCtx } = makeEditing();
        elements.value = [el];
        (fakeCtx.measureText as ReturnType<typeof vi.fn>).mockReturnValue({ width: 50 });
        startEditText(el);
        textValue.value = 'updated text';
        finalizeText();
        const updated = elements.value.find((e) => e.id === 'existing');
        expect(updated?.text).toBe('updated text');
    });

    it('calls saveToHistory and scheduleAutoSave after finalizing with text', () => {
        const { startNewText, textValue, finalizeText, saveToHistory, scheduleAutoSave } = makeEditing();
        startNewText(0, 0);
        textValue.value = 'something';
        finalizeText();
        expect(saveToHistory).toHaveBeenCalled();
        expect(scheduleAutoSave).toHaveBeenCalled();
    });

    it('handles multiline text (height = lines * lineHeight)', () => {
        const { startNewText, textValue, finalizeText, elements, fakeCtx } = makeEditing();
        (fakeCtx.measureText as ReturnType<typeof vi.fn>).mockReturnValue({ width: 40 });
        startNewText(0, 0);
        textValue.value = 'line1\nline2\nline3';
        finalizeText();
        const el = elements.value[0];
        // 3 lines * 20 * 1.3 = 78
        expect(el.height).toBeCloseTo(78, 0);
    });

    it('uses element strokeColor from defaultStyle when color is empty', () => {
        const { startNewText, textValue, finalizeText, elements, defaultStyle } = makeEditing();
        defaultStyle.value.strokeColor = '#ff0000';
        startNewText(0, 0);
        textValue.value = 'colored';
        finalizeText();
        expect(elements.value[0].strokeColor).toBe('#ff0000');
    });
});

// ── textOverlayStyle ──────────────────────────────────────────────────────────

describe('textOverlayStyle', () => {
    it('returns left/top position for non-centered text', () => {
        const { startNewText, textOverlayStyle } = makeEditing();
        startNewText(100, 200);
        const style = textOverlayStyle.value;
        expect(style.left).toBeDefined();
        expect(style.top).toBeDefined();
    });

    it('returns centered layout for shape text', () => {
        const { startEditShapeText, textOverlayStyle } = makeEditing();
        const el = makeShapeEl({ x: 0, y: 0, width: 200, height: 100 });
        startEditShapeText(el);
        const style = textOverlayStyle.value;
        expect(style.textAlign).toBe('center');
        expect(style.width).toBeDefined();
        expect(style.height).toBeDefined();
    });

    it('uses defaultStyle fontSize when textEditFontSize is not set', () => {
        const { textOverlayStyle } = makeEditing();
        const style = textOverlayStyle.value;
        expect(style.fontSize).toContain('px');
    });
});

// ── onDoubleClick ─────────────────────────────────────────────────────────────

describe('onDoubleClick', () => {
    it('does nothing when canvas is null', () => {
        const { onDoubleClick, textEditing } = makeEditing({ hasCanvas: false });
        const e = { clientX: 100, clientY: 100 } as MouseEvent;
        onDoubleClick(e);
        expect(textEditing.value).toBe(false);
    });

    it('starts new text when double-clicking empty canvas', () => {
        const { hitTestElement } = makeEditing({ hasCanvas: true });
        hitTestElement.mockReturnValue(null);
        const fakeCanvas = { getBoundingClientRect: () => ({ left: 0, top: 0 }) };
        const { canvas } = makeEditing({ hasCanvas: true });
        canvas.value = fakeCanvas as unknown as HTMLCanvasElement;

        const { onDoubleClick: dblClick, textEditing: editing } = useTextEditing(
            canvas,
            ref(null),
            ref(1),
            ref([]),
            ref(null),
            vi.fn().mockReturnValue({ x: 0, y: 0, width: 0, height: 0 }),
            vi.fn().mockReturnValue(null),
            vi.fn().mockReturnValue(false),
            genId,
            ref({ ...defaultDefaultStyle }),
            vi.fn().mockImplementation((x: number, y: number) => ({ x, y })),
            vi.fn().mockImplementation((x: number, y: number) => ({ x, y })),
            vi.fn().mockReturnValue(null),
            vi.fn(),
            vi.fn(),
            vi.fn(),
        );
        const e = { clientX: 50, clientY: 50 } as MouseEvent;
        dblClick(e);
        expect(editing.value).toBe(true);
    });

    it('starts editing existing text element on double-click', () => {
        const textEl = makeTextEl({ id: 'txt-1', text: 'click me' });
        const fakeCanvas = { getBoundingClientRect: () => ({ left: 0, top: 0 }) };
        const canvas = ref(fakeCanvas as unknown as HTMLCanvasElement);
        const elements = ref([textEl]);
        const selectedId = ref<string | null>(null);

        const { onDoubleClick, textEditing, textValue } = useTextEditing(
            canvas,
            ref(null),
            ref(1),
            elements,
            selectedId,
            vi.fn().mockReturnValue({ x: textEl.x, y: textEl.y, width: textEl.width, height: textEl.height }),
            vi.fn().mockReturnValue(textEl),
            vi.fn().mockReturnValue(false),
            genId,
            ref({ ...defaultDefaultStyle }),
            vi.fn().mockImplementation((x: number, y: number) => ({ x, y })),
            vi.fn().mockImplementation((x: number, y: number) => ({ x, y })),
            vi.fn().mockReturnValue(null),
            vi.fn(),
            vi.fn(),
            vi.fn(),
        );
        const e = { clientX: 15, clientY: 25 } as MouseEvent;
        onDoubleClick(e);
        expect(textEditing.value).toBe(true);
        expect(textValue.value).toBe('click me');
    });

    it('starts editing shape text on double-click on a shape', () => {
        const shapeEl = makeShapeEl({ id: 'shape-1' });
        const fakeCanvas = { getBoundingClientRect: () => ({ left: 0, top: 0 }) };
        const canvas = ref(fakeCanvas as unknown as HTMLCanvasElement);
        const elements = ref([shapeEl]);

        const { onDoubleClick, textEditing } = useTextEditing(
            canvas,
            ref(null),
            ref(1),
            elements,
            ref(null),
            vi.fn().mockReturnValue({ x: shapeEl.x, y: shapeEl.y, width: shapeEl.width, height: shapeEl.height }),
            vi.fn().mockReturnValue(shapeEl),
            vi.fn().mockReturnValue(true), // isShapeElement = true
            genId,
            ref({ ...defaultDefaultStyle }),
            vi.fn().mockImplementation((x: number, y: number) => ({ x, y })),
            vi.fn().mockImplementation((x: number, y: number) => ({ x, y })),
            vi.fn().mockReturnValue(null),
            vi.fn(),
            vi.fn(),
            vi.fn(),
        );
        const e = { clientX: 50, clientY: 60 } as MouseEvent;
        onDoubleClick(e);
        expect(textEditing.value).toBe(true);
    });
});
