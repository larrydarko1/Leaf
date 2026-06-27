/**
 * Tests for useDrawingPersistence composable.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { useDrawingPersistence } from '@/renderer/composables/drawing/useDrawingPersistence';
import type { CanvasElement } from '@/schemas/drawing';

// ── Stubs ─────────────────────────────────────────────────────────────────────

const mockLog = { error: vi.fn(), info: vi.fn(), warn: vi.fn() };

// Patch electronAPI onto the existing window without replacing it
// (replacing window breaks vi.useFakeTimers)
Object.defineProperty(window, 'electronAPI', {
    value: { log: mockLog },
    writable: true,
    configurable: true,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

let idCounter = 0;
function genId(): string {
    return `id-${++idCounter}`;
}

function makeEl(id = genId()): CanvasElement {
    return {
        id,
        type: 'rectangle',
        x: 10,
        y: 20,
        width: 100,
        height: 50,
        strokeColor: '#000000',
        fillColor: '#ffffff',
        strokeWidth: 2,
        opacity: 1,
        borderRadius: 0,
        strokeStyle: 'solid',
        fontSize: 16,
    };
}

function makeV2Content(elems: CanvasElement[] = [], scrollX = 0, scrollY = 0, zoom = 1): string {
    return JSON.stringify({
        version: 2,
        elements: elems,
        viewState: { scrollX, scrollY, zoom },
    });
}

function makePersistence(contentFn: () => string | undefined = () => undefined) {
    const canvas = ref<HTMLCanvasElement | null>(null);
    const elements = ref<CanvasElement[]>([]);
    const scrollX = ref(0);
    const scrollY = ref(0);
    const zoom = ref(1);
    const history = ref<string[]>([]);
    const historyIndex = ref(0);
    const renderScene = vi.fn();
    const getCtx = vi.fn().mockReturnValue(null as CanvasRenderingContext2D | null);
    const onSave = vi.fn();
    const onContentChanged = vi.fn();

    const persistence = useDrawingPersistence(
        canvas,
        contentFn,
        elements,
        scrollX,
        scrollY,
        zoom,
        history,
        historyIndex,
        genId,
        renderScene,
        getCtx,
        onSave,
        onContentChanged,
    );

    return {
        canvas,
        elements,
        scrollX,
        scrollY,
        zoom,
        history,
        historyIndex,
        renderScene,
        getCtx,
        onSave,
        onContentChanged,
        ...persistence,
    };
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    idCounter = 0;
});

afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
});

// ── scheduleAutoSave ──────────────────────────────────────────────────────────

describe('scheduleAutoSave', () => {
    it('sets hasUnsavedChanges to true', () => {
        const { scheduleAutoSave, hasUnsavedChanges } = makePersistence();
        expect(hasUnsavedChanges.value).toBe(false);
        scheduleAutoSave();
        expect(hasUnsavedChanges.value).toBe(true);
    });

    it('calls onContentChanged(true)', () => {
        const { scheduleAutoSave, onContentChanged } = makePersistence();
        scheduleAutoSave();
        expect(onContentChanged).toHaveBeenCalledWith(true);
    });

    it('triggers saveDrawing after 1000ms', () => {
        const { scheduleAutoSave, onSave } = makePersistence();
        scheduleAutoSave();
        vi.advanceTimersByTime(1000);
        expect(onSave).toHaveBeenCalled();
    });

    it('clears previous timeout if called again quickly', () => {
        const { scheduleAutoSave, onSave } = makePersistence();
        scheduleAutoSave();
        scheduleAutoSave();
        // Second call resets the timer — advancing only 1000ms from the start
        // should still call onSave once (from the second timer)
        vi.advanceTimersByTime(1000);
        expect(onSave).toHaveBeenCalledTimes(1);
    });
});

// ── saveDrawing ───────────────────────────────────────────────────────────────

describe('saveDrawing', () => {
    it('calls onSave with serialized drawing data', () => {
        const el = makeEl();
        const { elements, scrollX, scrollY, zoom, saveDrawing, onSave } = makePersistence();
        elements.value = [el];
        scrollX.value = 10;
        scrollY.value = 20;
        zoom.value = 1.5;
        saveDrawing();
        expect(onSave).toHaveBeenCalled();
        const saved = JSON.parse((onSave.mock.calls[0] as string[])[0]);
        expect(saved.version).toBe(2);
        expect(saved.elements).toHaveLength(1);
        expect(saved.viewState.scrollX).toBe(10);
        expect(saved.viewState.scrollY).toBe(20);
        expect(saved.viewState.zoom).toBe(1.5);
    });

    it('sets isSaving to true immediately, then false after 300ms', () => {
        const { saveDrawing, isSaving } = makePersistence();
        saveDrawing();
        expect(isSaving.value).toBe(true);
        vi.advanceTimersByTime(300);
        expect(isSaving.value).toBe(false);
    });

    it('clears hasUnsavedChanges after save timeout', () => {
        const { scheduleAutoSave, saveDrawing, hasUnsavedChanges } = makePersistence();
        scheduleAutoSave();
        expect(hasUnsavedChanges.value).toBe(true);
        saveDrawing();
        vi.advanceTimersByTime(300);
        expect(hasUnsavedChanges.value).toBe(false);
    });

    it('calls onContentChanged(false) after save timeout', () => {
        const { saveDrawing, onContentChanged } = makePersistence();
        saveDrawing();
        vi.advanceTimersByTime(300);
        expect(onContentChanged).toHaveBeenCalledWith(false);
    });
});

// ── loadDrawing: empty/null cases ─────────────────────────────────────────────

describe('loadDrawing (empty)', () => {
    it('resets state when content is undefined', async () => {
        const el = makeEl();
        const { elements, scrollX, scrollY, zoom, history, historyIndex, loadDrawing } = makePersistence(
            () => undefined,
        );
        elements.value = [el];
        scrollX.value = 50;
        scrollY.value = 100;
        zoom.value = 2;
        loadDrawing();
        await nextTick();
        expect(elements.value).toHaveLength(0);
        expect(scrollX.value).toBe(0);
        expect(scrollY.value).toBe(0);
        expect(zoom.value).toBe(1);
        expect(history.value).toEqual(['[]']);
        expect(historyIndex.value).toBe(0);
    });

    it('resets state when content is empty string', async () => {
        const { elements, loadDrawing } = makePersistence(() => '');
        elements.value = [makeEl()];
        loadDrawing();
        await nextTick();
        expect(elements.value).toHaveLength(0);
    });

    it('still resets when ctx is null', async () => {
        const { elements, getCtx, loadDrawing } = makePersistence(() => makeV2Content([makeEl()]));
        getCtx.mockReturnValue(null);
        elements.value = [makeEl()];
        loadDrawing();
        await nextTick();
        expect(elements.value).toHaveLength(0);
    });
});

// ── loadDrawing: v2 format ────────────────────────────────────────────────────

describe('loadDrawing (v2 format)', () => {
    it('loads elements from v2 content', () => {
        const el = makeEl();
        const content = makeV2Content([el]);
        const { canvas, getCtx, elements, loadDrawing } = makePersistence(() => content);

        // Provide a canvas and ctx so loadDrawing proceeds past null check
        canvas.value = {} as HTMLCanvasElement;
        getCtx.mockReturnValue({} as CanvasRenderingContext2D);

        loadDrawing();
        expect(elements.value).toHaveLength(1);
        expect(elements.value[0].id).toBe(el.id);
    });

    it('loads scrollX, scrollY, zoom from v2 content', () => {
        const content = makeV2Content([], 30, 40, 2.0);
        const { canvas, getCtx, scrollX, scrollY, zoom, loadDrawing } = makePersistence(() => content);
        canvas.value = {} as HTMLCanvasElement;
        getCtx.mockReturnValue({} as CanvasRenderingContext2D);

        loadDrawing();
        expect(scrollX.value).toBe(30);
        expect(scrollY.value).toBe(40);
        expect(zoom.value).toBe(2.0);
    });

    it('initializes history with a single entry', () => {
        const content = makeV2Content([makeEl()]);
        const { canvas, getCtx, history, historyIndex, loadDrawing } = makePersistence(() => content);
        canvas.value = {} as HTMLCanvasElement;
        getCtx.mockReturnValue({} as CanvasRenderingContext2D);

        loadDrawing();
        expect(history.value).toHaveLength(1);
        expect(historyIndex.value).toBe(0);
    });

    it('calls renderScene', () => {
        const content = makeV2Content([]);
        const { canvas, getCtx, renderScene, loadDrawing } = makePersistence(() => content);
        canvas.value = {} as HTMLCanvasElement;
        getCtx.mockReturnValue({} as CanvasRenderingContext2D);
        loadDrawing();
        expect(renderScene).toHaveBeenCalled();
    });

    it('clears hasUnsavedChanges on load', () => {
        const content = makeV2Content([]);
        const { canvas, getCtx, scheduleAutoSave, hasUnsavedChanges, loadDrawing } = makePersistence(() => content);
        scheduleAutoSave();
        expect(hasUnsavedChanges.value).toBe(true);
        canvas.value = {} as HTMLCanvasElement;
        getCtx.mockReturnValue({} as CanvasRenderingContext2D);
        loadDrawing();
        expect(hasUnsavedChanges.value).toBe(false);
    });

    it('uses default viewState values when not provided', () => {
        const content = JSON.stringify({ version: 2, elements: [] });
        const { canvas, getCtx, scrollX, scrollY, zoom, loadDrawing } = makePersistence(() => content);
        canvas.value = {} as HTMLCanvasElement;
        getCtx.mockReturnValue({} as CanvasRenderingContext2D);
        loadDrawing();
        expect(scrollX.value).toBe(0);
        expect(scrollY.value).toBe(0);
        expect(zoom.value).toBe(1);
    });
});

// ── loadDrawing: v1 migration ─────────────────────────────────────────────────

describe('loadDrawing (v1 migration)', () => {
    it('migrates v1 shape strokes to v2 elements', () => {
        const v1Content = JSON.stringify({
            strokes: [
                {
                    tool: 'rectangle',
                    color: '#ff0000',
                    size: 2,
                    shape: { type: 'rectangle', x1: 0, y1: 0, x2: 100, y2: 50, fill: false },
                },
            ],
        });
        const { canvas, getCtx, elements, loadDrawing } = makePersistence(() => v1Content);
        canvas.value = {} as HTMLCanvasElement;
        getCtx.mockReturnValue({} as CanvasRenderingContext2D);
        loadDrawing();
        expect(elements.value).toHaveLength(1);
        expect(elements.value[0].strokeColor).toBe('#ff0000');
    });

    it('migrates v1 fill shape (sets fillColor to stroke color)', () => {
        const v1Content = JSON.stringify({
            strokes: [
                {
                    tool: 'rectangle',
                    color: '#00ff00',
                    size: 1,
                    shape: { type: 'rectangle', x1: 10, y1: 10, x2: 60, y2: 40, fill: true },
                },
            ],
        });
        const { canvas, getCtx, elements, loadDrawing } = makePersistence(() => v1Content);
        canvas.value = {} as HTMLCanvasElement;
        getCtx.mockReturnValue({} as CanvasRenderingContext2D);
        loadDrawing();
        expect(elements.value[0].fillColor).toBe('#00ff00');
    });

    it('migrates v1 line/arrow shapes correctly', () => {
        const v1Content = JSON.stringify({
            strokes: [
                {
                    tool: 'line',
                    color: '#000000',
                    size: 2,
                    shape: { type: 'line', x1: 0, y1: 0, x2: 100, y2: 100 },
                },
            ],
        });
        const { canvas, getCtx, elements, loadDrawing } = makePersistence(() => v1Content);
        canvas.value = {} as HTMLCanvasElement;
        getCtx.mockReturnValue({} as CanvasRenderingContext2D);
        loadDrawing();
        expect(elements.value[0].type).toBe('line');
        expect(elements.value[0].x).toBe(0);
        expect(elements.value[0].y).toBe(0);
    });

    it('migrates v1 freedraw points', () => {
        const v1Content = JSON.stringify({
            strokes: [
                {
                    tool: 'pen',
                    color: '#000000',
                    size: 1,
                    points: [
                        { x: 10, y: 10 },
                        { x: 20, y: 30 },
                        { x: 30, y: 20 },
                    ],
                },
            ],
        });
        const { canvas, getCtx, elements, loadDrawing } = makePersistence(() => v1Content);
        canvas.value = {} as HTMLCanvasElement;
        getCtx.mockReturnValue({} as CanvasRenderingContext2D);
        loadDrawing();
        expect(elements.value).toHaveLength(1);
        expect(elements.value[0].type).toBe('freedraw');
    });

    it('skips eraser strokes', () => {
        const v1Content = JSON.stringify({
            strokes: [
                {
                    tool: 'eraser',
                    color: '#fff',
                    size: 10,
                    points: [
                        { x: 0, y: 0 },
                        { x: 1, y: 1 },
                    ],
                },
            ],
        });
        const { canvas, getCtx, elements, loadDrawing } = makePersistence(() => v1Content);
        canvas.value = {} as HTMLCanvasElement;
        getCtx.mockReturnValue({} as CanvasRenderingContext2D);
        loadDrawing();
        expect(elements.value).toHaveLength(0);
    });

    it('handles v1 data with no strokes (empty object)', () => {
        const v1Content = JSON.stringify({});
        const { canvas, getCtx, elements, loadDrawing } = makePersistence(() => v1Content);
        canvas.value = {} as HTMLCanvasElement;
        getCtx.mockReturnValue({} as CanvasRenderingContext2D);
        loadDrawing();
        expect(elements.value).toHaveLength(0);
    });

    it('handles v1 data with null strokes', () => {
        const v1Content = JSON.stringify({ strokes: null });
        const { canvas, getCtx, elements, loadDrawing } = makePersistence(() => v1Content);
        canvas.value = {} as HTMLCanvasElement;
        getCtx.mockReturnValue({} as CanvasRenderingContext2D);
        loadDrawing();
        expect(elements.value).toHaveLength(0);
    });

    it('skips freedraw strokes with fewer than 2 points', () => {
        const v1Content = JSON.stringify({
            strokes: [{ tool: 'pen', color: '#000', size: 1, points: [{ x: 0, y: 0 }] }],
        });
        const { canvas, getCtx, elements, loadDrawing } = makePersistence(() => v1Content);
        canvas.value = {} as HTMLCanvasElement;
        getCtx.mockReturnValue({} as CanvasRenderingContext2D);
        loadDrawing();
        expect(elements.value).toHaveLength(0);
    });
});

// ── loadDrawing: error handling ───────────────────────────────────────────────

describe('loadDrawing (invalid content)', () => {
    it('logs error and resets state for invalid JSON', () => {
        const { canvas, getCtx, elements, loadDrawing } = makePersistence(() => 'not-json');
        canvas.value = {} as HTMLCanvasElement;
        getCtx.mockReturnValue({} as CanvasRenderingContext2D);
        loadDrawing();
        expect(mockLog.error).toHaveBeenCalled();
        expect(elements.value).toHaveLength(0);
    });

    it('logs error for content that is neither v1 nor v2', () => {
        const { canvas, getCtx, loadDrawing } = makePersistence(() => '"just a string"');
        canvas.value = {} as HTMLCanvasElement;
        getCtx.mockReturnValue({} as CanvasRenderingContext2D);
        loadDrawing();
        expect(mockLog.error).toHaveBeenCalled();
    });

    it('resets history to empty array on load error', () => {
        const { canvas, getCtx, history, loadDrawing } = makePersistence(() => 'bad-json');
        canvas.value = {} as HTMLCanvasElement;
        getCtx.mockReturnValue({} as CanvasRenderingContext2D);
        loadDrawing();
        expect(history.value).toEqual(['[]']);
    });
});

// ── cleanup ───────────────────────────────────────────────────────────────────

describe('cleanup', () => {
    it('does not throw when no pending timeout', () => {
        const { cleanup } = makePersistence();
        expect(() => cleanup()).not.toThrow();
    });

    it('cancels pending auto-save on cleanup', () => {
        const { scheduleAutoSave, cleanup, onSave } = makePersistence();
        scheduleAutoSave();
        cleanup();
        // After cleanup, advancing timers should NOT trigger onSave
        vi.advanceTimersByTime(2000);
        expect(onSave).not.toHaveBeenCalled();
    });
});
