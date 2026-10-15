import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ref } from 'vue';

import type { Canvas2D } from '@/renderer/composables/drawing/canvas2d';
import { useCanvasRenderer } from '@/renderer/composables/drawing/useCanvasRenderer';
import type { CanvasElement } from '@/schemas/drawing';
import { createFakeContext2D } from '@test-utils';

const { mockFindContext2D, mockEncodePng } = vi.hoisted(() => ({
    mockFindContext2D: vi.fn<(canvas: HTMLCanvasElement) => Canvas2D | null>(),
    mockEncodePng: vi.fn<(canvas: HTMLCanvasElement) => Promise<Blob | null>>(),
}));

vi.mock('@/renderer/composables/drawing/canvas2d', () => ({
    findContext2D: mockFindContext2D,
    encodePng: mockEncodePng,
}));

const mockCtx = createFakeContext2D();

function makeRect(overrides: Partial<CanvasElement> = {}): CanvasElement {
    return {
        id: 'el_1',
        type: 'rectangle',
        x: 10,
        y: 10,
        width: 100,
        height: 60,
        strokeColor: '#000',
        fillColor: 'transparent',
        strokeWidth: 2,
        strokeStyle: 'solid',
        opacity: 1,
        borderRadius: 0,
        ...overrides,
    };
}

function makeRenderer(
    options: {
        elements?: CanvasElement[];
        selectedIds?: string[];
        scrollX?: number;
        scrollY?: number;
        zoom?: number;
        creatingElement?: CanvasElement | null;
    } = {},
) {
    const canvasEl = document.createElement('canvas');
    canvasEl.width = 800;
    canvasEl.height = 600;

    const containerEl = document.createElement('div');
    Object.defineProperty(containerEl, 'getBoundingClientRect', {
        value: () => ({ width: 800, height: 600, top: 0, left: 0, right: 800, bottom: 600 }),
        configurable: true,
    });

    const canvasRef = ref<HTMLCanvasElement | null>(canvasEl);
    const containerRef = ref<HTMLDivElement | null>(containerEl);
    const scrollXRef = ref(options.scrollX ?? 0);
    const scrollYRef = ref(options.scrollY ?? 0);
    const zoomRef = ref(options.zoom ?? 1);
    const elementsRef = ref<CanvasElement[]>(options.elements ?? []);
    const creatingElementRef = ref<CanvasElement | null>(options.creatingElement ?? null);
    const selectedIdsRef = ref<Set<string>>(new Set(options.selectedIds ?? []));

    const marqueeRect = ref<{ x: number; y: number; width: number; height: number } | null>(null);

    function getElementBounds(el: CanvasElement) {
        return { x: el.x, y: el.y, width: el.width, height: el.height };
    }

    function getHandlePositions(el: CanvasElement) {
        const b = getElementBounds(el);
        return {
            nw: { x: b.x, y: b.y },
            ne: { x: b.x + b.width, y: b.y },
            se: { x: b.x + b.width, y: b.y + b.height },
            sw: { x: b.x, y: b.y + b.height },
        };
    }

    const renderer = useCanvasRenderer({
        canvas: canvasRef,
        containerEl: containerRef,
        scrollX: scrollXRef,
        scrollY: scrollYRef,
        zoom: zoomRef,
        elements: elementsRef,
        creatingElement: creatingElementRef,
        selectedIds: selectedIdsRef,
        marqueeRect,
        getElementBounds,
        getHandlePositions,
    });

    renderer.setupCanvas();

    return {
        renderer,
        canvasRef,
        containerRef,
        scrollXRef,
        scrollYRef,
        zoomRef,
        elementsRef,
        creatingElementRef,
        selectedIdsRef,
        marqueeRect,
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    mockFindContext2D.mockReturnValue(mockCtx);
    mockEncodePng.mockResolvedValue(null);
});

describe('useCanvasRenderer', () => {
    describe('setupCanvas', () => {
        it("asks for the canvas element's 2D context", () => {
            const { canvasRef } = makeRenderer();
            expect(mockFindContext2D).toHaveBeenCalledWith(canvasRef.value);
        });

        it('returns ctx via findCtx() after setup', () => {
            const { renderer } = makeRenderer();
            expect(renderer.findCtx()).toBe(mockCtx);
        });

        it('returns zero dimensions when canvas is null', () => {
            const { renderer, canvasRef } = makeRenderer();
            canvasRef.value = null;
            expect(renderer.cssWidth()).toBe(0);
            expect(renderer.cssHeight()).toBe(0);
        });
    });

    describe('coordinate transforms', () => {
        it('screenToWorld converts screen coordinates to world space', () => {
            const { renderer } = makeRenderer({ scrollX: 50, scrollY: 50, zoom: 2 });
            const result = renderer.screenToWorld(100, 100);
            expect(result.x).toBeCloseTo(25);
            expect(result.y).toBeCloseTo(25);
        });

        it('worldToScreen converts world coordinates to screen space', () => {
            const { renderer } = makeRenderer({ scrollX: 50, scrollY: 50, zoom: 2 });
            const result = renderer.worldToScreen(25, 25);
            expect(result.x).toBeCloseTo(100);
            expect(result.y).toBeCloseTo(100);
        });

        it('getScreenPoint returns zero for null canvas', () => {
            const { renderer, canvasRef } = makeRenderer();
            canvasRef.value = null;
            const e = new PointerEvent('pointermove', { clientX: 100, clientY: 200 });
            const pt = renderer.getScreenPoint(e);
            expect(pt.x).toBe(0);
            expect(pt.y).toBe(0);
        });

        it('getScreenPoint subtracts canvas bounding rect', () => {
            const canvasEl = document.createElement('canvas');
            Object.defineProperty(canvasEl, 'getBoundingClientRect', {
                value: () => ({ left: 10, top: 20, width: 800, height: 600 }),
            });
            const { renderer: r2, canvasRef: cr2 } = makeRenderer();
            cr2.value = canvasEl;
            const e = new PointerEvent('pointermove', { clientX: 110, clientY: 120 });
            const pt = r2.getScreenPoint(e);
            expect(pt.x).toBe(100);
            expect(pt.y).toBe(100);
        });
    });

    describe('renderScene', () => {
        it('calls ctx.setTransform when renderScene is called', () => {
            const { renderer } = makeRenderer();
            renderer.renderScene();
            expect(mockCtx.setTransform).toHaveBeenCalled();
        });

        it('renders elements in the elements array', () => {
            const rect = makeRect();
            const { renderer } = makeRenderer({ elements: [rect] });
            renderer.renderScene();
            expect(mockCtx.save).toHaveBeenCalled();
        });

        it('renders the creatingElement if one is set', () => {
            const rect = makeRect({ id: 'creating' });
            const { renderer } = makeRenderer({ creatingElement: rect });
            renderer.renderScene();
            expect(mockCtx.save).toHaveBeenCalled();
        });

        it('does nothing when ctx is null (canvas not set up)', () => {
            const canvasRef = ref<HTMLCanvasElement | null>(null);
            const containerRef = ref<HTMLDivElement | null>(null);
            const renderer = useCanvasRenderer({
                canvas: canvasRef,
                containerEl: containerRef,
                scrollX: ref(0),
                scrollY: ref(0),
                zoom: ref(1),
                elements: ref([]),
                creatingElement: ref(null),
                selectedIds: ref(new Set()),
                marqueeRect: ref(null),
                getElementBounds: (el) => ({ x: el.x, y: el.y, width: 0, height: 0 }),
                getHandlePositions: () => ({}),
            });
            renderer.renderScene();
            expect(mockCtx.setTransform).not.toHaveBeenCalled();
        });

        it('renders a selection outline for selected elements', () => {
            const rect = makeRect({ id: 'selected' });
            const { renderer } = makeRenderer({
                elements: [rect],
                selectedIds: ['selected'],
            });
            renderer.renderScene();
            expect(mockCtx.strokeRect).toHaveBeenCalled();
        });

        it('renders marquee rect when marqueeRect is set', () => {
            const { renderer, marqueeRect } = makeRenderer();
            marqueeRect.value = { x: 10, y: 10, width: 100, height: 80 };
            renderer.renderScene();
            expect(mockCtx.strokeRect).toHaveBeenCalled();
        });
    });

    describe('element types', () => {
        it('renders a rectangle element using roundRect', () => {
            const { renderer } = makeRenderer({ elements: [makeRect()] });
            renderer.renderScene();
            expect(mockCtx.roundRect).toHaveBeenCalled();
        });

        it('renders a rounded rectangle element', () => {
            const { renderer } = makeRenderer({
                elements: [makeRect({ borderRadius: 8 })],
            });
            renderer.renderScene();
            expect(mockCtx.roundRect).toHaveBeenCalled();
        });

        it('renders a diamond element', () => {
            const rect = makeRect({ type: 'diamond' });
            const { renderer } = makeRenderer({ elements: [rect] });
            renderer.renderScene();
            expect(mockCtx.beginPath).toHaveBeenCalled();
        });

        it('renders an ellipse element using ctx.ellipse', () => {
            const rect = makeRect({ type: 'ellipse' });
            const { renderer } = makeRenderer({ elements: [rect] });
            renderer.renderScene();
            expect(mockCtx.ellipse).toHaveBeenCalled();
        });

        it('renders a line element', () => {
            const line: CanvasElement = {
                id: 'line1',
                type: 'line',
                x: 0,
                y: 0,
                width: 100,
                height: 100,
                strokeColor: '#000',
                fillColor: 'transparent',
                strokeWidth: 2,
                strokeStyle: 'solid',
                opacity: 1,
            };
            const { renderer } = makeRenderer({ elements: [line] });
            renderer.renderScene();
            expect(mockCtx.moveTo).toHaveBeenCalled();
        });

        it('renders an arrow element', () => {
            const arrow: CanvasElement = {
                id: 'arr1',
                type: 'arrow',
                x: 0,
                y: 0,
                width: 100,
                height: 100,
                strokeColor: '#000',
                fillColor: 'transparent',
                strokeWidth: 2,
                strokeStyle: 'solid',
                opacity: 1,
                borderRadius: 0,
            };
            const { renderer } = makeRenderer({ elements: [arrow] });
            renderer.renderScene();
            expect(mockCtx.lineTo).toHaveBeenCalled();
        });

        it('renders a text element', () => {
            const text: CanvasElement = {
                id: 'txt1',
                type: 'text',
                x: 10,
                y: 10,
                width: 200,
                height: 30,
                text: 'Hello world',
                strokeColor: '#000',
                fillColor: 'transparent',
                strokeWidth: 1,
                strokeStyle: 'solid',
                opacity: 1,
                borderRadius: 0,
                fontSize: 16,
            };
            const { renderer } = makeRenderer({ elements: [text] });
            renderer.renderScene();
            expect(mockCtx.fillText).toHaveBeenCalled();
        });

        it('renders a freedraw element', () => {
            const freedraw: CanvasElement = {
                id: 'fd1',
                type: 'freedraw',
                x: 0,
                y: 0,
                width: 100,
                height: 100,
                points: [
                    { x: 0, y: 0 },
                    { x: 10, y: 10 },
                    { x: 20, y: 5 },
                ],
                strokeColor: '#000',
                fillColor: 'transparent',
                strokeWidth: 2,
                strokeStyle: 'solid',
                opacity: 1,
                borderRadius: 0,
            };
            const { renderer } = makeRenderer({ elements: [freedraw] });
            renderer.renderScene();
            expect(mockCtx.beginPath).toHaveBeenCalled();
        });

        it('renders a triangle element', () => {
            const tri = makeRect({ type: 'triangle' });
            const { renderer } = makeRenderer({ elements: [tri] });
            renderer.renderScene();
            expect(mockCtx.beginPath).toHaveBeenCalled();
        });

        it('applies dashed stroke style', () => {
            const { renderer } = makeRenderer({
                elements: [makeRect({ strokeStyle: 'dashed' })],
            });
            renderer.renderScene();
            expect(mockCtx.setLineDash).toHaveBeenCalled();
        });

        it('applies dotted stroke style', () => {
            const { renderer } = makeRenderer({
                elements: [makeRect({ strokeStyle: 'dotted' })],
            });
            renderer.renderScene();
            expect(mockCtx.setLineDash).toHaveBeenCalled();
        });

        it('applies non-transparent fill color', () => {
            const { renderer } = makeRenderer({
                elements: [makeRect({ fillColor: '#ff0000' })],
            });
            renderer.renderScene();
            expect(mockCtx.fill).toHaveBeenCalled();
        });

        it('renders element with opacity less than 1', () => {
            const { renderer } = makeRenderer({
                elements: [makeRect({ opacity: 0.5 })],
            });
            renderer.renderScene();
            expect(mockCtx.save).toHaveBeenCalled();
        });
    });

    describe('handleResize', () => {
        it('calls setTransform (re-renders) after resizing', () => {
            const { renderer } = makeRenderer();
            vi.clearAllMocks();
            renderer.handleResize();
            expect(mockCtx.setTransform).toHaveBeenCalled();
        });
    });

    describe('exportToBlob', () => {
        it('resolves with a Blob when elements are provided', async () => {
            const blob = new Blob(['fake'], { type: 'image/png' });
            mockEncodePng.mockResolvedValue(blob);
            const { renderer } = makeRenderer({ elements: [makeRect()] });
            const result = await renderer.exportToBlob({
                elements: [makeRect()],
                withBackground: true,
                scale: 1,
            });
            expect(result).not.toBeNull();
        });

        it('returns null immediately when elements array is empty', async () => {
            const { renderer } = makeRenderer();
            const result = await renderer.exportToBlob({
                elements: [],
                withBackground: false,
                scale: 1,
            });
            expect(result).toBeNull();
        });

        it('returns null when offscreen canvas getContext returns null', async () => {
            const { renderer } = makeRenderer();
            mockFindContext2D.mockReturnValueOnce(null);
            const result = await renderer.exportToBlob({
                elements: [makeRect()],
                withBackground: false,
                scale: 1,
            });
            expect(result).toBeNull();
        });
    });
});
